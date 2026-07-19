"""Data ingestion services: OpenAQ, OpenWeatherMap, and synthetic data generation."""

from __future__ import annotations

import logging
import math
import random
from datetime import datetime, timedelta, timezone
from typing import Any

import aiohttp
import numpy as np

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# OpenAQ Fetcher
# ---------------------------------------------------------------------------


class OpenAQFetcher:
    """Fetch real-time air quality data from the OpenAQ API v3."""

    BASE_URL = "https://api.openaq.io/v3"

    def __init__(self, api_key: str = "") -> None:
        self._api_key = api_key
        self._headers = {"X-API-Key": api_key} if api_key else {}

    async def fetch_locations(
        self,
        city: str = "Ahmedabad",
        country: str = "IN",
        limit: int = 50,
    ) -> list[dict]:
        """Fetch monitoring locations for a city.

        Args:
            city: City name.
            country: ISO 3166-1 alpha-2 country code.
            limit: Maximum number of locations to return.

        Returns:
            List of location dicts from the OpenAQ API.
        """
        params = {"city": city, "country": country, "limit": limit}
        return await self._get("/locations", params)

    async def fetch_measurements(
        self,
        location_id: int,
        parameter: str = "pm25",
        limit: int = 100,
    ) -> list[dict]:
        """Fetch measurements for a specific location.

        Args:
            location_id: OpenAQ location ID.
            parameter: Pollutant parameter (pm25, pm10, no2, etc.).
            limit: Maximum number of measurements.

        Returns:
            List of measurement dicts.
        """
        params = {
            "locations_id": location_id,
            "parameter": parameter,
            "limit": limit,
        }
        return await self._get("/measurements", params)

    async def _get(self, endpoint: str, params: dict) -> list[dict]:
        """Send a GET request to the OpenAQ API.

        Args:
            endpoint: API endpoint path.
            params: Query parameters.

        Returns:
            List of result dicts, or empty list on error.
        """
        if not self._api_key:
            logger.warning("OpenAQFetcher: no API key configured, skipping fetch")
            return []
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.BASE_URL}{endpoint}",
                    params=params,
                    headers=self._headers,
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as resp:
                    if resp.status != 200:
                        logger.warning("OpenAQFetcher: HTTP %d from %s", resp.status, endpoint)
                        return []
                    data = await resp.json()
                    return data.get("results", [])
        except Exception as exc:
            logger.warning("OpenAQFetcher fetch error: %s", exc)
            return []


# ---------------------------------------------------------------------------
# Weather Fetcher
# ---------------------------------------------------------------------------


class WeatherFetcher:
    """Fetch weather data from the OpenWeatherMap API."""

    BASE_URL = "https://api.openweathermap.org/data/2.5"

    def __init__(self, api_key: str = "") -> None:
        self._api_key = api_key

    async def fetch_current_weather(
        self,
        lat: float,
        lon: float,
    ) -> dict[str, Any]:
        """Fetch current weather conditions for a geographic point.

        Args:
            lat: Latitude.
            lon: Longitude.

        Returns:
            Dict with temperature, humidity, wind_speed, weather_condition,
            or empty dict on error.
        """
        if not self._api_key:
            logger.warning("WeatherFetcher: no API key configured")
            return {}
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.BASE_URL}/weather",
                    params={
                        "lat": lat,
                        "lon": lon,
                        "appid": self._api_key,
                        "units": "metric",
                    },
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as resp:
                    if resp.status != 200:
                        logger.warning("WeatherFetcher: HTTP %d", resp.status)
                        return {}
                    data = await resp.json()
                    return {
                        "temperature": data.get("main", {}).get("temp"),
                        "humidity": data.get("main", {}).get("humidity"),
                        "wind_speed": data.get("wind", {}).get("speed"),
                        "weather_condition": (
                            data.get("weather", [{}])[0].get("main")
                        ),
                        "visibility": data.get("visibility"),
                    }
        except Exception as exc:
            logger.warning("WeatherFetcher error: %s", exc)
            return {}

    async def fetch_air_pollution(self, lat: float, lon: float) -> dict[str, Any]:
        """Fetch current air pollution data from OpenWeatherMap.

        Args:
            lat: Latitude.
            lon: Longitude.

        Returns:
            Dict with aqi and component concentrations, or empty dict on error.
        """
        if not self._api_key:
            return {}
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.BASE_URL}/air_pollution",
                    params={"lat": lat, "lon": lon, "appid": self._api_key},
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as resp:
                    if resp.status != 200:
                        return {}
                    data = await resp.json()
                    items = data.get("list", [])
                    if not items:
                        return {}
                    item = items[0]
                    components = item.get("components", {})
                    return {
                        "owm_aqi": item.get("main", {}).get("aqi"),
                        "pm25": components.get("pm2_5"),
                        "pm10": components.get("pm10"),
                        "no2": components.get("no2"),
                        "so2": components.get("so2"),
                        "co": components.get("co"),
                        "o3": components.get("o3"),
                    }
        except Exception as exc:
            logger.warning("WeatherFetcher.air_pollution error: %s", exc)
            return {}


# ---------------------------------------------------------------------------
# Synthetic Data Generator
# ---------------------------------------------------------------------------


# 20 Ahmedabad wards with realistic coordinates
_AHMEDABAD_WARDS = [
    {"id": "AMD_W01", "name": "Maninagar", "lat": 22.9929, "lon": 72.6142, "base_aqi": 145},
    {"id": "AMD_W02", "name": "Narol", "lat": 22.9701, "lon": 72.6420, "base_aqi": 210},
    {"id": "AMD_W03", "name": "Vatva GIDC", "lat": 22.9435, "lon": 72.6383, "base_aqi": 280},
    {"id": "AMD_W04", "name": "Odhav", "lat": 23.0123, "lon": 72.6567, "base_aqi": 240},
    {"id": "AMD_W05", "name": "Naroda", "lat": 23.0778, "lon": 72.6488, "base_aqi": 225},
    {"id": "AMD_W06", "name": "Chandkheda", "lat": 23.1062, "lon": 72.5897, "base_aqi": 130},
    {"id": "AMD_W07", "name": "Sabarmati", "lat": 23.0770, "lon": 72.5898, "base_aqi": 165},
    {"id": "AMD_W08", "name": "Thaltej", "lat": 23.0618, "lon": 72.5052, "base_aqi": 85},
    {"id": "AMD_W09", "name": "Bopal", "lat": 23.0294, "lon": 72.4667, "base_aqi": 72},
    {"id": "AMD_W10", "name": "Navrangpura", "lat": 23.0296, "lon": 72.5600, "base_aqi": 118},
    {"id": "AMD_W11", "name": "Paldi", "lat": 23.0018, "lon": 72.5726, "base_aqi": 135},
    {"id": "AMD_W12", "name": "Gota", "lat": 23.1110, "lon": 72.5300, "base_aqi": 98},
    {"id": "AMD_W13", "name": "Nikol", "lat": 23.0388, "lon": 72.6300, "base_aqi": 185},
    {"id": "AMD_W14", "name": "Bapunagar", "lat": 23.0520, "lon": 72.6135, "base_aqi": 170},
    {"id": "AMD_W15", "name": "Rakhial", "lat": 23.0622, "lon": 72.6145, "base_aqi": 195},
    {"id": "AMD_W16", "name": "Isanpur", "lat": 22.9801, "lon": 72.6244, "base_aqi": 230},
    {"id": "AMD_W17", "name": "Sarkhej", "lat": 22.9847, "lon": 72.5080, "base_aqi": 112},
    {"id": "AMD_W18", "name": "Ghatlodiya", "lat": 23.0850, "lon": 72.5400, "base_aqi": 90},
    {"id": "AMD_W19", "name": "Vejalpur", "lat": 22.9998, "lon": 72.5132, "base_aqi": 108},
    {"id": "AMD_W20", "name": "CTM Amraiwadi", "lat": 23.0280, "lon": 72.6390, "base_aqi": 200},
]

# 10 hospitals in Ahmedabad
_HOSPITALS = [
    {"name": "Civil Hospital Ahmedabad", "address": "Asarwa, Ahmedabad", "lat": 23.0538, "lon": 72.5981, "contact": "079-22680850", "emergency": True, "ward_id": "AMD_W07"},
    {"name": "Sterling Hospital", "address": "Off Gurukul Road, Ahmedabad", "lat": 23.0690, "lon": 72.5437, "contact": "079-40016000", "emergency": True, "ward_id": "AMD_W10"},
    {"name": "Zydus Hospitals", "address": "Thaltej, Ahmedabad", "lat": 23.0698, "lon": 72.5050, "contact": "079-66190000", "emergency": True, "ward_id": "AMD_W08"},
    {"name": "Apollo Hospitals", "address": "Plot No.1A, BHAT, Ahmedabad", "lat": 23.1028, "lon": 72.5278, "contact": "079-66696666", "emergency": True, "ward_id": "AMD_W12"},
    {"name": "SAL Hospital", "address": "Opp. Science City, Sola, Ahmedabad", "lat": 23.0744, "lon": 72.5345, "contact": "079-40054000", "emergency": True, "ward_id": "AMD_W12"},
    {"name": "CIMS Hospital", "address": "Near Shukan Mall, Science City Road", "lat": 23.0693, "lon": 72.5308, "contact": "079-71771000", "emergency": True, "ward_id": "AMD_W12"},
    {"name": "Shardaben General Hospital", "address": "Naroda Road, Ahmedabad", "lat": 23.0520, "lon": 72.6398, "contact": "079-22741400", "emergency": True, "ward_id": "AMD_W14"},
    {"name": "Rajasthan Hospitals", "address": "Shahibaug, Ahmedabad", "lat": 23.0663, "lon": 72.5837, "contact": "079-22863999", "emergency": False, "ward_id": "AMD_W07"},
    {"name": "Shalby Hospital", "address": "Opp. Karnavati Club, S G Highway", "lat": 23.0197, "lon": 72.5066, "contact": "079-40203000", "emergency": True, "ward_id": "AMD_W19"},
    {"name": "HCG Cancer Centre", "address": "C K 6 Opposite Mithakhali", "lat": 23.0339, "lon": 72.5591, "contact": "079-40019500", "emergency": False, "ward_id": "AMD_W10"},
]

# 15 industries
_INDUSTRIES = [
    {"name": "Vatva Chemical Works", "type": "Chemical", "lat": 22.9425, "lon": 72.6400, "ward_id": "AMD_W03", "contribution": 35.0, "category": "critical"},
    {"name": "Narol Textile Mill", "type": "Textile", "lat": 22.9700, "lon": 72.6415, "ward_id": "AMD_W02", "contribution": 22.0, "category": "high"},
    {"name": "Odhav Plastics", "type": "Plastics", "lat": 23.0120, "lon": 72.6560, "ward_id": "AMD_W04", "contribution": 18.0, "category": "high"},
    {"name": "Naroda Industrial Estate", "type": "Mixed Industrial", "lat": 23.0770, "lon": 72.6490, "ward_id": "AMD_W05", "contribution": 30.0, "category": "critical"},
    {"name": "Vatva GIDC Phase II", "type": "Pharmaceutical", "lat": 22.9500, "lon": 72.6350, "ward_id": "AMD_W03", "contribution": 20.0, "category": "high"},
    {"name": "Isanpur Dyeing Unit", "type": "Dyeing", "lat": 22.9800, "lon": 72.6250, "ward_id": "AMD_W16", "contribution": 15.0, "category": "medium"},
    {"name": "CTM Amraiwadi Factory", "type": "Engineering", "lat": 23.0280, "lon": 72.6380, "ward_id": "AMD_W20", "contribution": 12.0, "category": "medium"},
    {"name": "Bapunagar Weaving Mill", "type": "Textile", "lat": 23.0510, "lon": 72.6130, "ward_id": "AMD_W14", "contribution": 10.0, "category": "medium"},
    {"name": "Rakhial Foundry", "type": "Metal Casting", "lat": 23.0620, "lon": 72.6140, "ward_id": "AMD_W15", "contribution": 25.0, "category": "high"},
    {"name": "Maninagar Printing Press", "type": "Printing", "lat": 22.9930, "lon": 72.6145, "ward_id": "AMD_W01", "contribution": 8.0, "category": "low"},
    {"name": "Sabarmati Coal Depot", "type": "Coal/Energy", "lat": 23.0760, "lon": 72.5890, "ward_id": "AMD_W07", "contribution": 28.0, "category": "critical"},
    {"name": "Nikol Auto Parts", "type": "Automobile", "lat": 23.0390, "lon": 72.6300, "ward_id": "AMD_W13", "contribution": 14.0, "category": "medium"},
    {"name": "Narol Rubber Works", "type": "Rubber", "lat": 22.9690, "lon": 72.6430, "ward_id": "AMD_W02", "contribution": 11.0, "category": "medium"},
    {"name": "Odhav Ceramic Plant", "type": "Ceramic", "lat": 23.0130, "lon": 72.6550, "ward_id": "AMD_W04", "contribution": 9.0, "category": "low"},
    {"name": "Vatva API Manufacturer", "type": "Pharmaceutical API", "lat": 22.9440, "lon": 72.6370, "ward_id": "AMD_W03", "contribution": 17.0, "category": "high"},
]

# 8 construction sites
_CONSTRUCTION_SITES = [
    {"name": "Metro Rail Phase 2 - Narol Segment", "lat": 22.9750, "lon": 72.6380, "ward_id": "AMD_W02", "dust": "high", "contractor": "L&T Construction"},
    {"name": "Ring Road Widening - Odhav", "lat": 23.0150, "lon": 72.6520, "ward_id": "AMD_W04", "dust": "high", "contractor": "NHAI"},
    {"name": "Flyover Construction - Naroda", "lat": 23.0780, "lon": 72.6470, "ward_id": "AMD_W05", "dust": "medium", "contractor": "GMC Engineers"},
    {"name": "Residential Complex - Thaltej", "lat": 23.0610, "lon": 72.5060, "ward_id": "AMD_W08", "dust": "low", "contractor": "Godrej Properties"},
    {"name": "AMC Ward Office - Maninagar", "lat": 22.9950, "lon": 72.6100, "ward_id": "AMD_W01", "dust": "low", "contractor": "AMC PWD"},
    {"name": "BRTS Corridor - Rakhial", "lat": 23.0640, "lon": 72.6130, "ward_id": "AMD_W15", "dust": "medium", "contractor": "AMTS"},
    {"name": "Isanpur Bridge Renovation", "lat": 22.9810, "lon": 72.6200, "ward_id": "AMD_W16", "dust": "medium", "contractor": "Ahmedabad Bridge Corp"},
    {"name": "Commercial Tower - Navrangpura", "lat": 23.0290, "lon": 72.5610, "ward_id": "AMD_W10", "dust": "low", "contractor": "Piramal Realty"},
]


class SyntheticDataGenerator:
    """Generate realistic synthetic data for 20 wards in Ahmedabad.

    Generates:
    - 30 days of hourly AQI readings per ward (24*30*20 = 14,400 records)
    - Hospital records (10)
    - Industry records (15)
    - Construction site records (8)
    - Ward boundary records (20)
    """

    def __init__(self, seed: int = 42) -> None:
        self._rng = random.Random(seed)
        self._np_rng = np.random.default_rng(seed)

    # ------------------------------------------------------------------
    # AQI data
    # ------------------------------------------------------------------

    def generate_aqi_data(self, days_back: int = 30) -> list[dict]:
        """Generate hourly AQI readings for all 20 wards for the past *days_back* days.

        Args:
            days_back: Number of days of history to generate.

        Returns:
            List of AQI data dicts ready to insert into the database.
        """
        records = []
        now = datetime.now(timezone.utc)
        for ward in _AHMEDABAD_WARDS:
            for day_offset in range(days_back):
                for hour in range(0, 24, 3):  # Every 3 hours to keep volume reasonable
                    ts = now - timedelta(days=day_offset, hours=hour)
                    aqi = self._simulate_aqi(
                        ward["base_aqi"], ts.hour, ts.month
                    )
                    records.append(
                        {
                            "ward_id": ward["id"],
                            "ward_name": ward["name"],
                            "aqi_value": round(aqi, 1),
                            "pm25": round(aqi * 0.35 + self._rng.uniform(-5, 5), 1),
                            "pm10": round(aqi * 0.55 + self._rng.uniform(-8, 8), 1),
                            "no2": round(aqi * 0.10 + self._rng.uniform(-3, 3), 1),
                            "so2": round(aqi * 0.05 + self._rng.uniform(-2, 2), 1),
                            "co": round(aqi * 0.08 + self._rng.uniform(-2, 2), 1),
                            "o3": round(self._rng.uniform(20, 80), 1),
                            "timestamp": ts,
                            "latitude": ward["lat"] + self._rng.uniform(-0.005, 0.005),
                            "longitude": ward["lon"] + self._rng.uniform(-0.005, 0.005),
                            "source": "synthetic",
                        }
                    )
        return records

    def _simulate_aqi(self, base: float, hour: int, month: int) -> float:
        """Simulate a realistic AQI with diurnal and seasonal variation."""
        # Morning and evening peaks (rush hours)
        hour_effect = 30 * math.sin(math.pi * (hour - 6) / 12) + 20 * math.sin(
            math.pi * (hour - 18) / 6
        )
        # Winter months have higher pollution (reduced mixing height)
        season_effect = 20 * math.cos(2 * math.pi * (month - 1) / 12)
        noise = self._rng.gauss(0, base * 0.12)
        aqi = base + hour_effect + season_effect + noise
        return max(15.0, min(500.0, aqi))

    # ------------------------------------------------------------------
    # Static dataset generators
    # ------------------------------------------------------------------

    def generate_hospitals(self) -> list[dict]:
        """Return the static hospital dataset.

        Returns:
            List of hospital dicts.
        """
        return [
            {
                "name": h["name"],
                "address": h["address"],
                "latitude": h["lat"],
                "longitude": h["lon"],
                "contact": h["contact"],
                "emergency_facilities": h["emergency"],
                "ward_id": h["ward_id"],
                "specializations": "General Medicine, Pulmonology, Cardiology",
            }
            for h in _HOSPITALS
        ]

    def generate_industries(self) -> list[dict]:
        """Return the static industry dataset.

        Returns:
            List of industry dicts.
        """
        return [
            {
                "name": i["name"],
                "industry_type": i["type"],
                "latitude": i["lat"],
                "longitude": i["lon"],
                "ward_id": i["ward_id"],
                "pollution_contribution": i["contribution"],
                "emission_category": i["category"],
                "last_inspection": datetime.now(timezone.utc) - timedelta(
                    days=self._rng.randint(30, 365)
                ),
            }
            for i in _INDUSTRIES
        ]

    def generate_construction_sites(self) -> list[dict]:
        """Return the static construction site dataset.

        Returns:
            List of construction site dicts.
        """
        now = datetime.now(timezone.utc)
        return [
            {
                "name": cs["name"],
                "latitude": cs["lat"],
                "longitude": cs["lon"],
                "ward_id": cs["ward_id"],
                "dust_emission_level": cs["dust"],
                "start_date": now - timedelta(days=self._rng.randint(30, 180)),
                "end_date": now + timedelta(days=self._rng.randint(30, 365)),
                "contractor": cs["contractor"],
                "is_active": True,
            }
            for cs in _CONSTRUCTION_SITES
        ]

    def generate_ward_boundaries(self) -> list[dict]:
        """Generate simplified ward boundary records with GeoJSON polygons.

        Returns:
            List of ward boundary dicts.
        """
        import json

        boundaries = []
        for ward in _AHMEDABAD_WARDS:
            # Generate a simple square polygon around the ward centre
            half = 0.015  # ~1.5 km
            polygon = {
                "type": "Feature",
                "properties": {"ward_id": ward["id"], "ward_name": ward["name"]},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [ward["lon"] - half, ward["lat"] - half],
                            [ward["lon"] + half, ward["lat"] - half],
                            [ward["lon"] + half, ward["lat"] + half],
                            [ward["lon"] - half, ward["lat"] + half],
                            [ward["lon"] - half, ward["lat"] - half],
                        ]
                    ],
                },
            }
            boundaries.append(
                {
                    "ward_id": ward["id"],
                    "ward_name": ward["name"],
                    "city": "Ahmedabad",
                    "state": "Gujarat",
                    "geojson_data": json.dumps(polygon),
                    "population": self._rng.randint(50_000, 250_000),
                    "area_sqkm": round(self._rng.uniform(3.0, 15.0), 2),
                    "center_latitude": ward["lat"],
                    "center_longitude": ward["lon"],
                }
            )
        return boundaries
