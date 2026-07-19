"""Hospitals router — listing and proximity search."""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Hospital
from app.schemas import HospitalResponse
from app.utils.geo_utils import find_nearby_locations

router = APIRouter(prefix="/hospitals", tags=["Hospitals"])


@router.get(
    "/",
    response_model=list[HospitalResponse],
    summary="Get all hospitals",
)
async def get_all_hospitals(db: AsyncSession = Depends(get_db)):
    """Return all hospital records in the database.

    Args:
        db: Async database session.

    Returns:
        List of all hospital records.
    """
    result = await db.execute(select(Hospital))
    hospitals = result.scalars().all()
    return [HospitalResponse.model_validate(h) for h in hospitals]


@router.get(
    "/nearby",
    response_model=list[HospitalResponse],
    summary="Get hospitals within a radius of a coordinate",
)
async def get_nearby_hospitals(
    lat: float = Query(..., description="Latitude of the search centre"),
    lng: float = Query(..., description="Longitude of the search centre"),
    radius_km: float = Query(default=5.0, ge=0.1, le=100.0),
    emergency_only: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
):
    """Return hospitals within *radius_km* kilometres of (lat, lng).

    Optionally filter to only hospitals that have emergency facilities.

    Args:
        lat: Latitude of the query point.
        lng: Longitude of the query point.
        radius_km: Search radius in kilometres.
        emergency_only: If True, only return hospitals with emergency facilities.
        db: Async database session.

    Returns:
        List of hospitals within the radius, each annotated with distance_km,
        sorted nearest-first.
    """
    query = select(Hospital)
    if emergency_only:
        query = query.where(Hospital.emergency_facilities == True)

    result = await db.execute(query)
    hospitals = result.scalars().all()

    locations = [
        {"id": h.id, "latitude": h.latitude, "longitude": h.longitude}
        for h in hospitals
    ]
    nearby_ids, distances = find_nearby_locations(lat, lng, locations, radius_km)

    nearby: list[HospitalResponse] = []
    for h in hospitals:
        if h.id in nearby_ids:
            resp = HospitalResponse.model_validate(h)
            resp.distance_km = round(distances[h.id], 3)
            nearby.append(resp)

    nearby.sort(key=lambda x: x.distance_km or float("inf"))
    return nearby
