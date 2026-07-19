"""Geospatial utility functions for distance calculation and proximity filtering."""

from __future__ import annotations

import math
from typing import Any


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_EARTH_RADIUS_KM = 6371.0


# ---------------------------------------------------------------------------
# Core functions
# ---------------------------------------------------------------------------


def haversine_distance(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
) -> float:
    """Calculate the great-circle distance between two geographic points.

    Uses the Haversine formula, which assumes a spherical Earth.

    Args:
        lat1: Latitude of the first point in decimal degrees.
        lon1: Longitude of the first point in decimal degrees.
        lat2: Latitude of the second point in decimal degrees.
        lon2: Longitude of the second point in decimal degrees.

    Returns:
        Distance between the two points in kilometres.

    Examples:
        >>> haversine_distance(23.03, 72.58, 23.06, 72.62)
        4.82...
    """
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return _EARTH_RADIUS_KM * c


def find_nearby_locations(
    lat: float,
    lng: float,
    locations: list[dict[str, Any]],
    radius_km: float,
) -> tuple[set[int], dict[int, float]]:
    """Filter a list of locations to those within *radius_km* of a point.

    Each location dict must have an ``id``, ``latitude``, and ``longitude`` key.

    Args:
        lat: Latitude of the query point.
        lng: Longitude of the query point.
        locations: List of dicts with at least ``id``, ``latitude``,
            ``longitude`` keys.
        radius_km: Search radius in kilometres.

    Returns:
        A tuple of:
        - Set of ``id`` values for locations within the radius.
        - Dict mapping each qualifying ``id`` to its distance in km.

    Examples:
        >>> locs = [{"id": 1, "latitude": 23.05, "longitude": 72.58}]
        >>> ids, dists = find_nearby_locations(23.03, 72.58, locs, 5.0)
        >>> 1 in ids
        True
    """
    nearby_ids: set[int] = set()
    distances: dict[int, float] = {}

    for loc in locations:
        dist = haversine_distance(lat, lng, loc["latitude"], loc["longitude"])
        if dist <= radius_km:
            loc_id = loc["id"]
            nearby_ids.add(loc_id)
            distances[loc_id] = dist

    return nearby_ids, distances


def calculate_buffer_zone(
    lat: float,
    lng: float,
    radius_km: float,
) -> dict[str, float]:
    """Return an approximate bounding box around a point.

    The bounding box is computed using constant degree-to-km conversions:
    - 1° latitude ≈ 111 km
    - 1° longitude ≈ 111 km * cos(latitude)

    This is suitable for fast pre-filtering before exact haversine calculations.

    Args:
        lat: Centre latitude in decimal degrees.
        lng: Centre longitude in decimal degrees.
        radius_km: Radius in kilometres.

    Returns:
        Dict with keys ``min_lat``, ``max_lat``, ``min_lon``, ``max_lon``.
    """
    lat_delta = radius_km / 111.0
    lon_delta = radius_km / (111.0 * math.cos(math.radians(lat)))

    return {
        "min_lat": lat - lat_delta,
        "max_lat": lat + lat_delta,
        "min_lon": lng - lon_delta,
        "max_lon": lng + lon_delta,
    }


def get_ward_for_location(
    lat: float,
    lng: float,
    ward_boundaries: list[dict[str, Any]],
) -> dict[str, Any] | None:
    """Find which ward a geographic point falls within.

    Uses a simple bounding-box test against each ward's centre coordinates
    (within 1.5 km). For production use, replace with a proper point-in-polygon
    test using shapely or geopandas.

    Args:
        lat: Latitude of the query point.
        lng: Longitude of the query point.
        ward_boundaries: List of ward boundary dicts. Each must have
            ``ward_id``, ``ward_name``, ``center_latitude``,
            ``center_longitude``, and optionally ``area_sqkm``.

    Returns:
        The matching ward boundary dict, or ``None`` if no ward is found.
    """
    best_ward = None
    best_dist = float("inf")

    for ward in ward_boundaries:
        center_lat = ward.get("center_latitude")
        center_lon = ward.get("center_longitude")
        if center_lat is None or center_lon is None:
            continue
        dist = haversine_distance(lat, lng, center_lat, center_lon)
        if dist < best_dist:
            best_dist = dist
            best_ward = ward

    # Return the nearest ward only if it is within a reasonable distance (3 km)
    if best_dist <= 3.0:
        return best_ward
    return None


def degrees_to_km(degrees: float) -> float:
    """Convert a degree difference to approximate kilometres.

    Uses the standard 1° ≈ 111 km approximation.

    Args:
        degrees: Angle in decimal degrees.

    Returns:
        Approximate distance in kilometres.
    """
    return degrees * 111.0


def km_to_degrees(km: float) -> float:
    """Convert kilometres to approximate degree difference.

    Uses the standard 1° ≈ 111 km approximation.

    Args:
        km: Distance in kilometres.

    Returns:
        Approximate angle in decimal degrees.
    """
    return km / 111.0
