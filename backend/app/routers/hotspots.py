"""Hotspots router — pollution cluster detection, source lookup, and priority ranking."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import AQIData, ConstructionSite, Industry
from app.schemas import ConstructionSiteResponse, HotspotResponse, IndustryResponse

router = APIRouter(prefix="/hotspots", tags=["Hotspots"])


def _norm_city(city: str | None) -> str | None:
    """Normalise city name to title-case so 'surat' → 'Surat'."""
    return city.strip().title() if city else None


@router.get(
    "/",
    response_model=list[HotspotResponse],
    summary="Detect current pollution hotspots using DBSCAN clustering",
)
async def get_hotspots(
    hours_back: int = Query(default=720, ge=1, le=8760),
    city: str | None = Query(default=None, description="Filter by city name"),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime, timedelta, timezone
    from app.models import WardBoundary
    from app.services.ml_service import HotspotDetector

    city = _norm_city(city)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours_back)
    query = select(AQIData).where(
        AQIData.timestamp >= cutoff,
        AQIData.latitude.isnot(None),
        AQIData.longitude.isnot(None),
    )
    if city:
        wb_result = await db.execute(
            select(WardBoundary.ward_id).where(WardBoundary.city == city)
        )
        city_ward_ids = [r[0] for r in wb_result.all()]
        if city_ward_ids:
            query = query.where(AQIData.ward_id.in_(city_ward_ids))

    result = await db.execute(query)
    records = result.scalars().all()
    if not records:
        return []
    detector = HotspotDetector()
    return detector.detect_clusters(records)


@router.get(
    "/industries",
    response_model=list[IndustryResponse],
    summary="Get industries sorted by pollution contribution",
)
async def get_industries(
    ward_id: str | None = Query(default=None),
    city: str | None = Query(default=None, description="Filter by city name"),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    from app.models import WardBoundary
    city = _norm_city(city)
    query = select(Industry)
    if ward_id:
        query = query.where(Industry.ward_id == ward_id)
    elif city:
        wb_result = await db.execute(
            select(WardBoundary.ward_id).where(WardBoundary.city == city)
        )
        city_ward_ids = [r[0] for r in wb_result.all()]
        if city_ward_ids:
            query = query.where(Industry.ward_id.in_(city_ward_ids))
    query = query.order_by(Industry.pollution_contribution.desc().nullslast()).limit(limit)
    result = await db.execute(query)
    return [IndustryResponse.model_validate(i) for i in result.scalars().all()]


@router.get(
    "/construction",
    response_model=list[ConstructionSiteResponse],
    summary="Get active construction sites",
)
async def get_construction_sites(
    ward_id: str | None = Query(default=None),
    city: str | None = Query(default=None, description="Filter by city name"),
    active_only: bool = Query(default=True),
    db: AsyncSession = Depends(get_db),
):
    from app.models import WardBoundary
    city = _norm_city(city)
    query = select(ConstructionSite)
    if ward_id:
        query = query.where(ConstructionSite.ward_id == ward_id)
    elif city:
        wb_result = await db.execute(
            select(WardBoundary.ward_id).where(WardBoundary.city == city)
        )
        city_ward_ids = [r[0] for r in wb_result.all()]
        if city_ward_ids:
            query = query.where(ConstructionSite.ward_id.in_(city_ward_ids))
    if active_only:
        query = query.where(ConstructionSite.is_active == True)
    result = await db.execute(query)
    return [ConstructionSiteResponse.model_validate(s) for s in result.scalars().all()]


@router.get(
    "/priority-ranking",
    summary="Get wards ranked by intervention urgency",
)
async def get_priority_ranking(
    limit: int = Query(default=20, ge=1, le=50),
    city: str | None = Query(default=None, description="Filter by city name"),
    db: AsyncSession = Depends(get_db),
):
    from app.models import WardBoundary

    city = _norm_city(city)
    # Resolve city → ward_id list
    city_ward_ids: set[str] | None = None
    if city:
        wb_result = await db.execute(
            select(WardBoundary.ward_id).where(WardBoundary.city == city)
        )
        city_ward_ids = {r[0] for r in wb_result.all()}

    # Latest AQI per ward
    subq = (
        select(func.max(AQIData.id).label("max_id"))
        .group_by(AQIData.ward_id)
        .subquery()
    )
    aqi_query = select(AQIData).where(AQIData.id.in_(select(subq.c.max_id)))
    if city_ward_ids:
        aqi_query = aqi_query.where(AQIData.ward_id.in_(city_ward_ids))
    result = await db.execute(aqi_query)
    latest_aqi_records = result.scalars().all()

    # Industry count per ward
    ind_result = await db.execute(
        select(Industry.ward_id, func.count(Industry.id).label("count")).group_by(
            Industry.ward_id
        )
    )
    industry_counts = {row.ward_id: row.count for row in ind_result}

    # Construction site count per ward
    con_result = await db.execute(
        select(
            ConstructionSite.ward_id, func.count(ConstructionSite.id).label("count")
        )
        .where(ConstructionSite.is_active == True)
        .group_by(ConstructionSite.ward_id)
    )
    construction_counts = {row.ward_id: row.count for row in con_result}

    def _priority_score(aqi: float, n_ind: int, n_con: int) -> float:
        """Composite score: 70% AQI weight, 20% industry, 10% construction."""
        aqi_norm = min(aqi / 500.0, 1.0)
        ind_norm = min(n_ind / 10.0, 1.0)
        con_norm = min(n_con / 5.0, 1.0)
        return round(0.70 * aqi_norm + 0.20 * ind_norm + 0.10 * con_norm, 4)

    def _aqi_category(aqi: float) -> str:
        if aqi <= 50:
            return "Good"
        if aqi <= 100:
            return "Satisfactory"
        if aqi <= 200:
            return "Moderate"
        if aqi <= 300:
            return "Poor"
        if aqi <= 400:
            return "Very Poor"
        return "Severe"

    def _recommended_actions(aqi: float, n_ind: int, n_con: int) -> list[str]:
        actions = []
        if aqi > 300:
            actions.append("Issue public health emergency advisory")
            actions.append("Temporarily halt high-emission industrial operations")
        elif aqi > 200:
            actions.append("Increase air quality monitoring frequency")
            actions.append("Restrict vehicle movement in hotspot zones")
        if n_ind > 3:
            actions.append("Conduct emergency inspection of industrial units")
        if n_con > 2:
            actions.append("Enforce dust suppression norms at construction sites")
        if not actions:
            actions.append("Continue routine monitoring")
        return actions

    rankings = []
    for r in latest_aqi_records:
        n_ind = industry_counts.get(r.ward_id, 0)
        n_con = construction_counts.get(r.ward_id, 0)
        score = _priority_score(r.aqi_value, n_ind, n_con)
        factors = []
        if r.aqi_value > 200:
            factors.append(f"High AQI ({r.aqi_value:.0f})")
        if n_ind > 0:
            factors.append(f"{n_ind} industrial units")
        if n_con > 0:
            factors.append(f"{n_con} active construction sites")

        rankings.append(
            {
                "ward_id": r.ward_id,
                "ward_name": r.ward_name,
                "current_aqi": r.aqi_value,
                "aqi_category": _aqi_category(r.aqi_value),
                "priority_score": score,
                "contributing_factors": factors,
                "recommended_actions": _recommended_actions(r.aqi_value, n_ind, n_con),
            }
        )

    rankings.sort(key=lambda x: x["priority_score"], reverse=True)
    for rank, item in enumerate(rankings[:limit], start=1):
        item["rank"] = rank

    return rankings[:limit]
