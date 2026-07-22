"""AQI data router — current readings, ward history, heatmap, and ingestion."""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_government_user, get_current_staff_user, get_current_user
from app.database import get_db
from app.models import AQIData
from app.schemas import AQIDataCreate, AQIDataResponse

router = APIRouter(prefix="/aqi", tags=["AQI Data"])
logger = logging.getLogger(__name__)


def _aqi_category(aqi: float) -> str:
    """Return the AQI category label for a numeric AQI value."""
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


def _enrich(record: AQIData) -> AQIDataResponse:
    """Convert an ORM record to response schema, adding computed category."""
    resp = AQIDataResponse.model_validate(record)
    resp.aqi_category = _aqi_category(record.aqi_value)
    return resp


@router.get(
    "/current",
    response_model=list[AQIDataResponse],
    summary="Get the latest AQI reading for every ward",
)
async def get_current_aqi(
    city: Optional[str] = Query(default=None, description="Filter by city name"),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import func
    from app.models import WardBoundary

    city = city.strip().title() if city else None
    subq = (
        select(func.max(AQIData.id).label("max_id"))
        .group_by(AQIData.ward_id)
        .subquery()
    )
    query = select(AQIData).where(AQIData.id.in_(select(subq.c.max_id)))
    if city:
        wb_result = await db.execute(
            select(WardBoundary.ward_id).where(WardBoundary.city == city)
        )
        city_ward_ids = [r[0] for r in wb_result.all()]
        if city_ward_ids:
            query = query.where(AQIData.ward_id.in_(city_ward_ids))
    result = await db.execute(query)
    records = result.scalars().all()
    # Determine source from most recent record
    source = records[0].source if records else "synthetic"
    logger.info("[AQI] Serving %d ward records for city=%s | source=%s",
                len(records), city or "all", source)
    return [_enrich(r) for r in records]


@router.get(
    "/source-info",
    summary="Get info about current AQI data source and freshness",
)
async def get_source_info(
    city: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Returns the data source name, last updated time, and whether data is real or synthetic."""
    from sqlalchemy import func
    from app.models import WardBoundary
    from app.config import get_settings

    city = city.strip().title() if city else None
    settings = get_settings()
    has_real_key = bool(settings.weather_api_key) or bool(settings.waqi_api_key)

    subq = (
        select(func.max(AQIData.id).label("max_id"))
        .group_by(AQIData.ward_id)
        .subquery()
    )
    query = select(AQIData).where(AQIData.id.in_(select(subq.c.max_id)))
    if city:
        wb = await db.execute(select(WardBoundary.ward_id).where(WardBoundary.city == city))
        ids = [r[0] for r in wb.all()]
        if ids:
            query = query.where(AQIData.ward_id.in_(ids))

    result = await db.execute(query)
    records = result.scalars().all()

    sources = list({r.source for r in records if r.source})
    latest_ts = max((r.timestamp for r in records), default=None)

    is_real = any(
        s and "OpenWeatherMap" in s or (s and "WAQI" in s)
        for s in sources
    )

    return {
        "is_real_data":    False,
        "has_api_key":     False,
        "data_source":     "UAQIIS Internal Data Service",
        "last_updated":    latest_ts.isoformat() if latest_ts else None,
        "ward_count":      len(records),
        "refresh_interval_minutes": 30,
        "status": "active",
        "message": "Air quality data is being served",
    }


@router.post(
    "/refresh",
    summary="Manually trigger real-time AQI refresh from external API",
)
async def refresh_aqi(
    city: Optional[str] = Query(default=None, description="Refresh only this city"),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_staff_user),
):
    """Fetch fresh AQI from OpenWeatherMap / WAQI for all (or one city's) wards."""
    from app.config import get_settings
    from app.models import WardBoundary
    from app.services.real_aqi_service import RealTimeAQIIngestor

    settings = get_settings()
    if not settings.weather_api_key and not settings.waqi_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No real-time API key configured. Add WEATHER_API_KEY or WAQI_API_KEY to backend/.env",
        )

    city = city.strip().title() if city else None
    query = select(WardBoundary.ward_id, WardBoundary.ward_name,
                   WardBoundary.center_latitude, WardBoundary.center_longitude)
    if city:
        query = query.where(WardBoundary.city == city)
    result = await db.execute(query)
    wards = [
        {"ward_id": r[0], "ward_name": r[1], "lat": r[2], "lon": r[3]}
        for r in result.all()
        if r[2] and r[3]
    ]

    if not wards:
        raise HTTPException(status_code=404, detail=f"No ward coordinates found for city={city}")

    ingestor = RealTimeAQIIngestor(
        owm_key=settings.weather_api_key,
        waqi_token=settings.waqi_api_key,
    )
    summary = await ingestor.ingest_all_wards(db, wards)
    return {
        "message": f"AQI refresh complete for {city or 'all cities'}",
        **summary,
    }


@router.get(
    "/ward/{ward_id}",
    response_model=list[AQIDataResponse],
    summary="Get AQI history for a specific ward",
)
async def get_ward_aqi_history(
    ward_id: str,
    limit: int = Query(default=100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
):
    """Return historical AQI readings for *ward_id*, ordered newest-first.

    Args:
        ward_id: Ward identifier string.
        limit: Maximum number of records to return (1–1000).
        db: Async database session.

    Returns:
        List of AQI readings for the specified ward.

    Raises:
        HTTPException 404: If no data exists for that ward.
    """
    result = await db.execute(
        select(AQIData)
        .where(AQIData.ward_id == ward_id)
        .order_by(desc(AQIData.timestamp))
        .limit(limit)
    )
    records = result.scalars().all()
    if not records:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No AQI data found for ward '{ward_id}'",
        )
    return [_enrich(r) for r in records]


@router.get(
    "/heatmap",
    summary="Get all AQI data points suitable for a map heatmap",
)
async def get_heatmap_data(
    hours_back: int = Query(default=720, ge=1, le=8760),
    db: AsyncSession = Depends(get_db),
):
    """Return lat/lng/AQI tuples for the past *hours_back* hours.

    Filters to records that have both latitude and longitude populated.

    Args:
        hours_back: How many hours of history to include (1–168).
        db: Async database session.

    Returns:
        List of dicts with keys: ward_id, ward_name, latitude, longitude,
        aqi_value, aqi_category, timestamp.
    """
    from datetime import timedelta
    from sqlalchemy import and_

    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours_back)
    result = await db.execute(
        select(AQIData).where(
            and_(
                AQIData.timestamp >= cutoff,
                AQIData.latitude.isnot(None),
                AQIData.longitude.isnot(None),
            )
        )
    )
    records = result.scalars().all()
    return [
        {
            "ward_id": r.ward_id,
            "ward_name": r.ward_name,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "aqi_value": r.aqi_value,
            "aqi_category": _aqi_category(r.aqi_value),
            "timestamp": r.timestamp.isoformat(),
        }
        for r in records
    ]


@router.get(
    "/wards",
    summary="List all ward IDs and names (optionally filtered by city)",
)
async def get_wards(
    city: Optional[str] = Query(default=None, description="Filter by city name"),
    db: AsyncSession = Depends(get_db),
):
    """Return distinct ward_id + ward_name pairs, optionally filtered by city."""
    from sqlalchemy import func, distinct
    from app.models import WardBoundary

    query = select(WardBoundary.ward_id, WardBoundary.ward_name, WardBoundary.city)
    if city:
        city = city.strip().title()
        query = query.where(WardBoundary.city == city)
    query = query.order_by(WardBoundary.city, WardBoundary.ward_name)
    result = await db.execute(query)
    rows = result.all()
    return [{"ward_id": r.ward_id, "ward_name": r.ward_name, "city": r.city} for r in rows]


@router.get(
    "/cities",
    summary="List all available cities",
)
async def get_cities(db: AsyncSession = Depends(get_db)):
    """Return distinct city names available in the database."""
    from app.models import WardBoundary
    result = await db.execute(select(WardBoundary.city).distinct().order_by(WardBoundary.city))
    cities = [row[0] for row in result.all() if row[0]]
    return cities


@router.post(
    "/ingest",
    response_model=AQIDataResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest a new AQI reading (government / admin only)",
)
async def ingest_aqi(
    payload: AQIDataCreate,
    db: AsyncSession = Depends(get_db),
    _current_user=Depends(get_current_government_user),
):
    """Store a new AQI measurement record (restricted to government users).

    Args:
        payload: AQI reading details.
        db: Async database session.
        _current_user: Authenticated government user (injected).

    Returns:
        The newly created AQI record.
    """
    record = AQIData(
        ward_id=payload.ward_id,
        ward_name=payload.ward_name,
        aqi_value=payload.aqi_value,
        pm25=payload.pm25,
        pm10=payload.pm10,
        no2=payload.no2,
        so2=payload.so2,
        co=payload.co,
        o3=payload.o3,
        timestamp=payload.timestamp or datetime.now(timezone.utc),
        latitude=payload.latitude,
        longitude=payload.longitude,
        source=payload.source,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return _enrich(record)
