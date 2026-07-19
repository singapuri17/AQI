"""Hotspots router — pollution cluster detection, source lookup, and priority ranking."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import AQIData, ConstructionSite, Industry
from app.schemas import ConstructionSiteResponse, HotspotResponse, IndustryResponse

router = APIRouter(prefix="/hotspots", tags=["Hotspots"])


@router.get(
    "/",
    response_model=list[HotspotResponse],
    summary="Detect current pollution hotspots using DBSCAN clustering",
)
async def get_hotspots(
    hours_back: int = Query(default=720, ge=1, le=8760),  # default 30 days
    db: AsyncSession = Depends(get_db),
):
    """Cluster recent AQI readings with DBSCAN to identify pollution hotspots.

    Args:
        hours_back: How many hours of data to include (1–168).
        db: Async database session.

    Returns:
        List of hotspot clusters with severity and geographic centre.
    """
    from datetime import datetime, timedelta, timezone

    from app.services.ml_service import HotspotDetector

    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours_back)
    result = await db.execute(
        select(AQIData).where(
            AQIData.timestamp >= cutoff,
            AQIData.latitude.isnot(None),
            AQIData.longitude.isnot(None),
        )
    )
    records = result.scalars().all()

    if not records:
        return []

    detector = HotspotDetector()
    hotspots = detector.detect_clusters(records)
    return hotspots


@router.get(
    "/industries",
    response_model=list[IndustryResponse],
    summary="Get industries sorted by pollution contribution",
)
async def get_industries(
    ward_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Return industries, optionally filtered by ward.

    Args:
        ward_id: Optional ward filter.
        limit: Maximum records to return.
        db: Async database session.

    Returns:
        List of industries sorted by pollution_contribution descending.
    """
    query = select(Industry)
    if ward_id:
        query = query.where(Industry.ward_id == ward_id)
    query = query.order_by(
        Industry.pollution_contribution.desc().nullslast()
    ).limit(limit)

    result = await db.execute(query)
    industries = result.scalars().all()
    return [IndustryResponse.model_validate(i) for i in industries]


@router.get(
    "/construction",
    response_model=list[ConstructionSiteResponse],
    summary="Get active construction sites",
)
async def get_construction_sites(
    ward_id: str | None = Query(default=None),
    active_only: bool = Query(default=True),
    db: AsyncSession = Depends(get_db),
):
    """Return construction sites, optionally filtered by ward and active status.

    Args:
        ward_id: Optional ward filter.
        active_only: If True, only return currently active sites.
        db: Async database session.

    Returns:
        List of construction site records.
    """
    query = select(ConstructionSite)
    if ward_id:
        query = query.where(ConstructionSite.ward_id == ward_id)
    if active_only:
        query = query.where(ConstructionSite.is_active == True)

    result = await db.execute(query)
    sites = result.scalars().all()
    return [ConstructionSiteResponse.model_validate(s) for s in sites]


@router.get(
    "/priority-ranking",
    summary="Get wards ranked by intervention urgency",
)
async def get_priority_ranking(
    limit: int = Query(default=20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Rank wards by combined AQI severity and source density.

    Uses the latest AQI per ward plus industry/construction site counts to
    compute a priority score for government intervention.

    Args:
        limit: Number of wards to include in the ranking.
        db: Async database session.

    Returns:
        List of ward priority objects sorted highest-priority-first.
    """
    from sqlalchemy import and_

    # Latest AQI per ward
    subq = (
        select(func.max(AQIData.id).label("max_id"))
        .group_by(AQIData.ward_id)
        .subquery()
    )
    result = await db.execute(
        select(AQIData).where(AQIData.id.in_(select(subq.c.max_id)))
    )
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
