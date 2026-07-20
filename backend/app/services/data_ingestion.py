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

    async def fetch_locations(self, city: str = "Ahmedabad", country: str = "IN", limit: int = 50) -> list[dict]:
        params = {"city": city, "country": country, "limit": limit}
        return await self._get("/locations", params)

    async def fetch_measurements(self, location_id: int, parameter: str = "pm25", limit: int = 100) -> list[dict]:
        params = {"locations_id": location_id, "parameter": parameter, "limit": limit}
        return await self._get("/measurements", params)

    async def _get(self, endpoint: str, params: dict) -> list[dict]:
        if not self._api_key:
            logger.warning("OpenAQFetcher: no API key configured, skipping fetch")
            return []
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.BASE_URL}{endpoint}", params=params,
                    headers=self._headers, timeout=aiohttp.ClientTimeout(total=10),
                ) as resp:
                    if resp.status != 200:
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

    async def fetch_current_weather(self, lat: float, lon: float) -> dict[str, Any]:
        if not self._api_key:
            return {}
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.BASE_URL}/weather",
                    params={"lat": lat, "lon": lon, "appid": self._api_key, "units": "metric"},
                    timeout=aiohttp.ClientTimeout(total=10),
                ) as resp:
                    if resp.status != 200:
                        return {}
                    data = await resp.json()
                    return {
                        "temperature": data.get("main", {}).get("temp"),
                        "humidity": data.get("main", {}).get("humidity"),
                        "wind_speed": data.get("wind", {}).get("speed"),
                        "weather_condition": data.get("weather", [{}])[0].get("main"),
                        "visibility": data.get("visibility"),
                    }
        except Exception as exc:
            logger.warning("WeatherFetcher error: %s", exc)
            return {}

    async def fetch_air_pollution(self, lat: float, lon: float) -> dict[str, Any]:
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
                    components = items[0].get("components", {})
                    return {
                        "owm_aqi": items[0].get("main", {}).get("aqi"),
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
# City ward data — Ahmedabad, Surat, Vadodara
# ---------------------------------------------------------------------------

_AHMEDABAD_WARDS = [
    {"id": "AMD_W01", "name": "Maninagar",     "lat": 22.9929, "lon": 72.6142, "base_aqi": 145, "city": "Ahmedabad"},
    {"id": "AMD_W02", "name": "Narol",          "lat": 22.9701, "lon": 72.6420, "base_aqi": 210, "city": "Ahmedabad"},
    {"id": "AMD_W03", "name": "Vatva GIDC",     "lat": 22.9435, "lon": 72.6383, "base_aqi": 280, "city": "Ahmedabad"},
    {"id": "AMD_W04", "name": "Odhav",          "lat": 23.0123, "lon": 72.6567, "base_aqi": 240, "city": "Ahmedabad"},
    {"id": "AMD_W05", "name": "Naroda",         "lat": 23.0778, "lon": 72.6488, "base_aqi": 225, "city": "Ahmedabad"},
    {"id": "AMD_W06", "name": "Chandkheda",     "lat": 23.1062, "lon": 72.5897, "base_aqi": 130, "city": "Ahmedabad"},
    {"id": "AMD_W07", "name": "Sabarmati",      "lat": 23.0770, "lon": 72.5898, "base_aqi": 165, "city": "Ahmedabad"},
    {"id": "AMD_W08", "name": "Thaltej",        "lat": 23.0618, "lon": 72.5052, "base_aqi":  85, "city": "Ahmedabad"},
    {"id": "AMD_W09", "name": "Bopal",          "lat": 23.0294, "lon": 72.4667, "base_aqi":  72, "city": "Ahmedabad"},
    {"id": "AMD_W10", "name": "Navrangpura",    "lat": 23.0296, "lon": 72.5600, "base_aqi": 118, "city": "Ahmedabad"},
    {"id": "AMD_W11", "name": "Paldi",          "lat": 23.0018, "lon": 72.5726, "base_aqi": 135, "city": "Ahmedabad"},
    {"id": "AMD_W12", "name": "Gota",           "lat": 23.1110, "lon": 72.5300, "base_aqi":  98, "city": "Ahmedabad"},
    {"id": "AMD_W13", "name": "Nikol",          "lat": 23.0388, "lon": 72.6300, "base_aqi": 185, "city": "Ahmedabad"},
    {"id": "AMD_W14", "name": "Bapunagar",      "lat": 23.0520, "lon": 72.6135, "base_aqi": 170, "city": "Ahmedabad"},
    {"id": "AMD_W15", "name": "Rakhial",        "lat": 23.0622, "lon": 72.6145, "base_aqi": 195, "city": "Ahmedabad"},
    {"id": "AMD_W16", "name": "Isanpur",        "lat": 22.9801, "lon": 72.6244, "base_aqi": 230, "city": "Ahmedabad"},
    {"id": "AMD_W17", "name": "Sarkhej",        "lat": 22.9847, "lon": 72.5080, "base_aqi": 112, "city": "Ahmedabad"},
    {"id": "AMD_W18", "name": "Ghatlodiya",     "lat": 23.0850, "lon": 72.5400, "base_aqi":  90, "city": "Ahmedabad"},
    {"id": "AMD_W19", "name": "Vejalpur",       "lat": 22.9998, "lon": 72.5132, "base_aqi": 108, "city": "Ahmedabad"},
    {"id": "AMD_W20", "name": "CTM Amraiwadi",  "lat": 23.0280, "lon": 72.6390, "base_aqi": 200, "city": "Ahmedabad"},
]

_SURAT_WARDS = [
    {"id": "SRT_W01", "name": "Udhna",          "lat": 21.1735, "lon": 72.8560, "base_aqi": 260, "city": "Surat"},
    {"id": "SRT_W02", "name": "Sachin GIDC",    "lat": 21.0900, "lon": 72.8900, "base_aqi": 295, "city": "Surat"},
    {"id": "SRT_W03", "name": "Pandesara",      "lat": 21.1480, "lon": 72.8720, "base_aqi": 245, "city": "Surat"},
    {"id": "SRT_W04", "name": "Katargam",       "lat": 21.2140, "lon": 72.8380, "base_aqi": 190, "city": "Surat"},
    {"id": "SRT_W05", "name": "Varachha",       "lat": 21.2070, "lon": 72.8780, "base_aqi": 175, "city": "Surat"},
    {"id": "SRT_W06", "name": "Adajan",         "lat": 21.1940, "lon": 72.7900, "base_aqi":  90, "city": "Surat"},
    {"id": "SRT_W07", "name": "Vesu",           "lat": 21.1590, "lon": 72.7760, "base_aqi":  75, "city": "Surat"},
    {"id": "SRT_W08", "name": "Athwa",          "lat": 21.1880, "lon": 72.8100, "base_aqi": 110, "city": "Surat"},
    {"id": "SRT_W09", "name": "Limbayat",       "lat": 21.1680, "lon": 72.8630, "base_aqi": 220, "city": "Surat"},
    {"id": "SRT_W10", "name": "Dindoli",        "lat": 21.1560, "lon": 72.8480, "base_aqi": 205, "city": "Surat"},
    {"id": "SRT_W11", "name": "Rander",         "lat": 21.2290, "lon": 72.7820, "base_aqi":  95, "city": "Surat"},
    {"id": "SRT_W12", "name": "Ichchhapor",     "lat": 21.2580, "lon": 72.8060, "base_aqi": 130, "city": "Surat"},
    {"id": "SRT_W13", "name": "Bhestan",        "lat": 21.2350, "lon": 72.7640, "base_aqi":  85, "city": "Surat"},
    {"id": "SRT_W14", "name": "Piplod",         "lat": 21.1720, "lon": 72.7850, "base_aqi":  80, "city": "Surat"},
    {"id": "SRT_W15", "name": "Althan",         "lat": 21.1640, "lon": 72.8020, "base_aqi": 100, "city": "Surat"},
]

_VADODARA_WARDS = [
    {"id": "VDR_W01", "name": "GIDC Makarpura",    "lat": 22.2677, "lon": 73.1732, "base_aqi": 270, "city": "Vadodara"},
    {"id": "VDR_W02", "name": "Gorwa",              "lat": 22.3305, "lon": 73.1490, "base_aqi": 235, "city": "Vadodara"},
    {"id": "VDR_W03", "name": "Chhani",             "lat": 22.3620, "lon": 73.1570, "base_aqi": 200, "city": "Vadodara"},
    {"id": "VDR_W04", "name": "Waghodia Road",      "lat": 22.2890, "lon": 73.2180, "base_aqi": 180, "city": "Vadodara"},
    {"id": "VDR_W05", "name": "Manjalpur",          "lat": 22.2600, "lon": 73.1820, "base_aqi": 145, "city": "Vadodara"},
    {"id": "VDR_W06", "name": "Subhanpura",         "lat": 22.3100, "lon": 73.1350, "base_aqi":  95, "city": "Vadodara"},
    {"id": "VDR_W07", "name": "Alkapuri",           "lat": 22.3140, "lon": 73.1680, "base_aqi":  80, "city": "Vadodara"},
    {"id": "VDR_W08", "name": "Fatehgunj",          "lat": 22.3280, "lon": 73.1820, "base_aqi": 120, "city": "Vadodara"},
    {"id": "VDR_W09", "name": "Sayajigunj",         "lat": 22.3180, "lon": 73.1780, "base_aqi": 115, "city": "Vadodara"},
    {"id": "VDR_W10", "name": "Harni",              "lat": 22.3420, "lon": 73.2010, "base_aqi": 155, "city": "Vadodara"},
    {"id": "VDR_W11", "name": "Karelibaug",         "lat": 22.3260, "lon": 73.2000, "base_aqi": 140, "city": "Vadodara"},
    {"id": "VDR_W12", "name": "Akota",              "lat": 22.2990, "lon": 73.1580, "base_aqi": 100, "city": "Vadodara"},
    {"id": "VDR_W13", "name": "Sama",               "lat": 22.3350, "lon": 73.2220, "base_aqi": 165, "city": "Vadodara"},
    {"id": "VDR_W14", "name": "Pratapnagar",        "lat": 22.2840, "lon": 73.1960, "base_aqi": 135, "city": "Vadodara"},
    {"id": "VDR_W15", "name": "Tarsali",            "lat": 22.2720, "lon": 73.2060, "base_aqi": 190, "city": "Vadodara"},
]

ALL_WARDS = _AHMEDABAD_WARDS + _SURAT_WARDS + _VADODARA_WARDS


# ---------------------------------------------------------------------------
# Hospitals — all 3 cities
# ---------------------------------------------------------------------------

_HOSPITALS = [
    # ── Ahmedabad ──────────────────────────────────────────────────────────
    {"name": "Civil Hospital Ahmedabad",    "address": "Asarwa, Ahmedabad",                  "lat": 23.0538, "lon": 72.5981, "contact": "079-22680850", "emergency": True,  "ward_id": "AMD_W07", "city": "Ahmedabad"},
    {"name": "Sterling Hospital",           "address": "Off Gurukul Road, Ahmedabad",         "lat": 23.0690, "lon": 72.5437, "contact": "079-40016000", "emergency": True,  "ward_id": "AMD_W10", "city": "Ahmedabad"},
    {"name": "Zydus Hospitals",             "address": "Thaltej, Ahmedabad",                  "lat": 23.0698, "lon": 72.5050, "contact": "079-66190000", "emergency": True,  "ward_id": "AMD_W08", "city": "Ahmedabad"},
    {"name": "Apollo Hospitals",            "address": "Plot No.1A, BHAT, Ahmedabad",         "lat": 23.1028, "lon": 72.5278, "contact": "079-66696666", "emergency": True,  "ward_id": "AMD_W12", "city": "Ahmedabad"},
    {"name": "SAL Hospital",                "address": "Opp. Science City, Sola, Ahmedabad",  "lat": 23.0744, "lon": 72.5345, "contact": "079-40054000", "emergency": True,  "ward_id": "AMD_W12", "city": "Ahmedabad"},
    {"name": "CIMS Hospital",               "address": "Science City Road, Ahmedabad",        "lat": 23.0693, "lon": 72.5308, "contact": "079-71771000", "emergency": True,  "ward_id": "AMD_W12", "city": "Ahmedabad"},
    {"name": "Shardaben General Hospital",  "address": "Naroda Road, Ahmedabad",              "lat": 23.0520, "lon": 72.6398, "contact": "079-22741400", "emergency": True,  "ward_id": "AMD_W14", "city": "Ahmedabad"},
    {"name": "Rajasthan Hospitals",         "address": "Shahibaug, Ahmedabad",                "lat": 23.0663, "lon": 72.5837, "contact": "079-22863999", "emergency": False, "ward_id": "AMD_W07", "city": "Ahmedabad"},
    {"name": "Shalby Hospital",             "address": "S G Highway, Ahmedabad",              "lat": 23.0197, "lon": 72.5066, "contact": "079-40203000", "emergency": True,  "ward_id": "AMD_W19", "city": "Ahmedabad"},
    {"name": "HCG Cancer Centre",           "address": "Mithakhali, Ahmedabad",               "lat": 23.0339, "lon": 72.5591, "contact": "079-40019500", "emergency": False, "ward_id": "AMD_W10", "city": "Ahmedabad"},
    # ── Surat ──────────────────────────────────────────────────────────────
    {"name": "New Civil Hospital Surat",    "address": "Majura Gate, Surat",                  "lat": 21.1944, "lon": 72.8359, "contact": "0261-2244000", "emergency": True,  "ward_id": "SRT_W08", "city": "Surat"},
    {"name": "Kiran Hospital",              "address": "Udhna Darwaja, Surat",                "lat": 21.1812, "lon": 72.8387, "contact": "0261-6191000", "emergency": True,  "ward_id": "SRT_W04", "city": "Surat"},
    {"name": "Sunshine Global Hospital",    "address": "Sardar Chowk, Surat",                 "lat": 21.2107, "lon": 72.8310, "contact": "0261-7186000", "emergency": True,  "ward_id": "SRT_W04", "city": "Surat"},
    {"name": "Apple Hospital Surat",        "address": "Athwa Lines, Surat",                  "lat": 21.1901, "lon": 72.8176, "contact": "0261-6625100", "emergency": True,  "ward_id": "SRT_W08", "city": "Surat"},
    {"name": "Nidhi Hospital Udhna",        "address": "Udhna, Surat",                        "lat": 21.1720, "lon": 72.8510, "contact": "0261-2730000", "emergency": False, "ward_id": "SRT_W01", "city": "Surat"},
    {"name": "Nirali Medical Sachin",       "address": "Sachin GIDC, Surat",                  "lat": 21.0950, "lon": 72.8870, "contact": "0261-6636300", "emergency": True,  "ward_id": "SRT_W02", "city": "Surat"},
    {"name": "Adajan Multispeciality",      "address": "Adajan, Surat",                       "lat": 21.1963, "lon": 72.7940, "contact": "0261-2770000", "emergency": False, "ward_id": "SRT_W06", "city": "Surat"},
    {"name": "Vesu Super Speciality",       "address": "Vesu, Surat",                         "lat": 21.1620, "lon": 72.7780, "contact": "0261-6632200", "emergency": True,  "ward_id": "SRT_W07", "city": "Surat"},
    # ── Vadodara ──────────────────────────────────────────────────────────
    {"name": "SSG Hospital Vadodara",       "address": "Sayajigunj, Vadodara",                "lat": 22.3187, "lon": 73.1801, "contact": "0265-2419611", "emergency": True,  "ward_id": "VDR_W09", "city": "Vadodara"},
    {"name": "Baroda Medical College",      "address": "Raopura, Vadodara",                   "lat": 22.3095, "lon": 73.1873, "contact": "0265-2413861", "emergency": True,  "ward_id": "VDR_W09", "city": "Vadodara"},
    {"name": "Bhailal Amin Hospital",       "address": "Gorwa Road, Vadodara",                "lat": 22.3302, "lon": 73.1511, "contact": "0265-2282888", "emergency": True,  "ward_id": "VDR_W02", "city": "Vadodara"},
    {"name": "Sterling Hospital Vadodara",  "address": "Race Course Road, Vadodara",          "lat": 22.3135, "lon": 73.1665, "contact": "0265-6678000", "emergency": True,  "ward_id": "VDR_W07", "city": "Vadodara"},
    {"name": "Kailash Cancer Hospital",     "address": "Muni Seva Ashram Road, Vadodara",     "lat": 22.3252, "lon": 73.1430, "contact": "0265-2392000", "emergency": False, "ward_id": "VDR_W06", "city": "Vadodara"},
    {"name": "Indu Hospital",               "address": "Alkapuri, Vadodara",                  "lat": 22.3160, "lon": 73.1710, "contact": "0265-6631900", "emergency": False, "ward_id": "VDR_W07", "city": "Vadodara"},
    {"name": "Makarpura General Hospital",  "address": "Makarpura, Vadodara",                 "lat": 22.2695, "lon": 73.1750, "contact": "0265-2640000", "emergency": True,  "ward_id": "VDR_W01", "city": "Vadodara"},
    {"name": "Harni Multispeciality",       "address": "Harni Road, Vadodara",                "lat": 22.3410, "lon": 73.1980, "contact": "0265-2762500", "emergency": False, "ward_id": "VDR_W10", "city": "Vadodara"},
]


# ---------------------------------------------------------------------------
# Industries — all 3 cities
# ---------------------------------------------------------------------------

_INDUSTRIES = [
    # Ahmedabad
    {"name": "Vatva Chemical Works",        "type": "Chemical",          "lat": 22.9425, "lon": 72.6400, "ward_id": "AMD_W03", "contribution": 35.0, "category": "critical"},
    {"name": "Narol Textile Mill",          "type": "Textile",           "lat": 22.9700, "lon": 72.6415, "ward_id": "AMD_W02", "contribution": 22.0, "category": "high"},
    {"name": "Odhav Plastics",             "type": "Plastics",           "lat": 23.0120, "lon": 72.6560, "ward_id": "AMD_W04", "contribution": 18.0, "category": "high"},
    {"name": "Naroda Industrial Estate",   "type": "Mixed Industrial",   "lat": 23.0770, "lon": 72.6490, "ward_id": "AMD_W05", "contribution": 30.0, "category": "critical"},
    {"name": "Vatva GIDC Phase II",        "type": "Pharmaceutical",     "lat": 22.9500, "lon": 72.6350, "ward_id": "AMD_W03", "contribution": 20.0, "category": "high"},
    {"name": "Sabarmati Coal Depot",       "type": "Coal/Energy",        "lat": 23.0760, "lon": 72.5890, "ward_id": "AMD_W07", "contribution": 28.0, "category": "critical"},
    {"name": "Rakhial Foundry",            "type": "Metal Casting",      "lat": 23.0620, "lon": 72.6140, "ward_id": "AMD_W15", "contribution": 25.0, "category": "high"},
    {"name": "Isanpur Dyeing Unit",        "type": "Dyeing",             "lat": 22.9800, "lon": 72.6250, "ward_id": "AMD_W16", "contribution": 15.0, "category": "medium"},
    # Surat
    {"name": "Sachin GIDC Chemical Zone",  "type": "Chemical",           "lat": 21.0910, "lon": 72.8920, "ward_id": "SRT_W02", "contribution": 40.0, "category": "critical"},
    {"name": "Udhna Textile Cluster",      "type": "Textile/Dyeing",     "lat": 21.1730, "lon": 72.8550, "ward_id": "SRT_W01", "contribution": 35.0, "category": "critical"},
    {"name": "Pandesara GIDC",             "type": "Mixed Industrial",   "lat": 21.1490, "lon": 72.8730, "ward_id": "SRT_W03", "contribution": 28.0, "category": "high"},
    {"name": "Katargam Weaving Mills",     "type": "Textile",            "lat": 21.2130, "lon": 72.8370, "ward_id": "SRT_W04", "contribution": 22.0, "category": "high"},
    {"name": "Limbayat Embroidery Units",  "type": "Garment/Dye",        "lat": 21.1670, "lon": 72.8640, "ward_id": "SRT_W09", "contribution": 18.0, "category": "high"},
    {"name": "Dindoli Industrial Estate",  "type": "Engineering",        "lat": 21.1570, "lon": 72.8500, "ward_id": "SRT_W10", "contribution": 15.0, "category": "medium"},
    # Vadodara
    {"name": "Makarpura GIDC",             "type": "Chemical/Engineering","lat": 22.2680, "lon": 73.1740, "ward_id": "VDR_W01", "contribution": 38.0, "category": "critical"},
    {"name": "Gorwa Industrial Area",      "type": "Petrochemical",      "lat": 22.3300, "lon": 73.1480, "ward_id": "VDR_W02", "contribution": 32.0, "category": "critical"},
    {"name": "IPCL Vadodara",              "type": "Plastics/Polymer",   "lat": 22.3620, "lon": 73.1560, "ward_id": "VDR_W03", "contribution": 25.0, "category": "high"},
    {"name": "Waghodia Road Industries",   "type": "Mixed Industrial",   "lat": 22.2900, "lon": 73.2190, "ward_id": "VDR_W04", "contribution": 20.0, "category": "high"},
    {"name": "Tarsali Ceramic Cluster",    "type": "Ceramic",            "lat": 22.2730, "lon": 73.2050, "ward_id": "VDR_W15", "contribution": 16.0, "category": "medium"},
]

# ---------------------------------------------------------------------------
# Construction sites — all 3 cities
# ---------------------------------------------------------------------------

_CONSTRUCTION_SITES = [
    # Ahmedabad
    {"name": "Metro Rail Phase 2 - Narol",      "lat": 22.9750, "lon": 72.6380, "ward_id": "AMD_W02", "dust": "high",   "contractor": "L&T Construction"},
    {"name": "Ring Road Widening - Odhav",       "lat": 23.0150, "lon": 72.6520, "ward_id": "AMD_W04", "dust": "high",   "contractor": "NHAI"},
    {"name": "Flyover Construction - Naroda",    "lat": 23.0780, "lon": 72.6470, "ward_id": "AMD_W05", "dust": "medium", "contractor": "GMC Engineers"},
    {"name": "Residential Complex - Thaltej",    "lat": 23.0610, "lon": 72.5060, "ward_id": "AMD_W08", "dust": "low",    "contractor": "Godrej Properties"},
    # Surat
    {"name": "Surat Metro Line 1 - Udhna",       "lat": 21.1740, "lon": 72.8540, "ward_id": "SRT_W01", "dust": "high",   "contractor": "DMRC Consultants"},
    {"name": "Sachin-Hazira Expressway",          "lat": 21.0930, "lon": 72.8950, "ward_id": "SRT_W02", "dust": "high",   "contractor": "NCC Limited"},
    {"name": "Adajan Riverfront Development",     "lat": 21.1950, "lon": 72.7920, "ward_id": "SRT_W06", "dust": "low",    "contractor": "SUDA"},
    {"name": "Varachha Road Widening",            "lat": 21.2060, "lon": 72.8790, "ward_id": "SRT_W05", "dust": "medium", "contractor": "SMC Roads Dept"},
    # Vadodara
    {"name": "Vadodara-Mumbai Expressway",        "lat": 22.2700, "lon": 73.1780, "ward_id": "VDR_W01", "dust": "high",   "contractor": "IRB Infrastructure"},
    {"name": "Harni Airport Expansion",           "lat": 22.3360, "lon": 73.2130, "ward_id": "VDR_W10", "dust": "high",   "contractor": "AAI"},
    {"name": "Sama Housing Project",              "lat": 22.3340, "lon": 73.2200, "ward_id": "VDR_W13", "dust": "medium", "contractor": "VUDA"},
    {"name": "Gorwa Road Flyover",                "lat": 22.3310, "lon": 73.1500, "ward_id": "VDR_W02", "dust": "medium", "contractor": "VMC Engineers"},
]


# ---------------------------------------------------------------------------
# Synthetic Data Generator
# ---------------------------------------------------------------------------

class SyntheticDataGenerator:
    """Generate realistic synthetic data for all 3 cities (50 wards total)."""

    def __init__(self, seed: int = 42) -> None:
        self._rng = random.Random(seed)
        self._np_rng = np.random.default_rng(seed)

    def generate_aqi_data(self, days_back: int = 30) -> list[dict]:
        records = []
        now = datetime.now(timezone.utc)
        for ward in ALL_WARDS:
            for day_offset in range(days_back):
                for hour in range(0, 24, 3):
                    ts = now - timedelta(days=day_offset, hours=hour)
                    aqi = self._simulate_aqi(ward["base_aqi"], ts.hour, ts.month)
                    records.append({
                        "ward_id":   ward["id"],
                        "ward_name": ward["name"],
                        "aqi_value": round(aqi, 1),
                        "pm25":  round(aqi * 0.35 + self._rng.uniform(-5, 5), 1),
                        "pm10":  round(aqi * 0.55 + self._rng.uniform(-8, 8), 1),
                        "no2":   round(aqi * 0.10 + self._rng.uniform(-3, 3), 1),
                        "so2":   round(aqi * 0.05 + self._rng.uniform(-2, 2), 1),
                        "co":    round(aqi * 0.08 + self._rng.uniform(-2, 2), 1),
                        "o3":    round(self._rng.uniform(20, 80), 1),
                        "timestamp": ts,
                        "latitude":  ward["lat"] + self._rng.uniform(-0.005, 0.005),
                        "longitude": ward["lon"] + self._rng.uniform(-0.005, 0.005),
                        "source": "synthetic",
                    })
        return records

    def _simulate_aqi(self, base: float, hour: int, month: int) -> float:
        hour_effect   = 30 * math.sin(math.pi * (hour - 6) / 12) + 20 * math.sin(math.pi * (hour - 18) / 6)
        season_effect = 20 * math.cos(2 * math.pi * (month - 1) / 12)
        noise = self._rng.gauss(0, base * 0.12)
        return max(15.0, min(500.0, base + hour_effect + season_effect + noise))

    def generate_hospitals(self) -> list[dict]:
        return [{
            "name": h["name"], "address": h["address"],
            "latitude": h["lat"], "longitude": h["lon"],
            "contact": h["contact"], "emergency_facilities": h["emergency"],
            "ward_id": h["ward_id"],
            "specializations": "General Medicine, Pulmonology, Cardiology",
        } for h in _HOSPITALS]

    def generate_industries(self) -> list[dict]:
        return [{
            "name": i["name"], "industry_type": i["type"],
            "latitude": i["lat"], "longitude": i["lon"],
            "ward_id": i["ward_id"],
            "pollution_contribution": i["contribution"],
            "emission_category": i["category"],
            "last_inspection": datetime.now(timezone.utc) - timedelta(days=self._rng.randint(30, 365)),
        } for i in _INDUSTRIES]

    def generate_construction_sites(self) -> list[dict]:
        now = datetime.now(timezone.utc)
        return [{
            "name": cs["name"], "latitude": cs["lat"], "longitude": cs["lon"],
            "ward_id": cs["ward_id"], "dust_emission_level": cs["dust"],
            "start_date": now - timedelta(days=self._rng.randint(30, 180)),
            "end_date":   now + timedelta(days=self._rng.randint(30, 365)),
            "contractor": cs["contractor"], "is_active": True,
        } for cs in _CONSTRUCTION_SITES]

    def generate_ward_boundaries(self) -> list[dict]:
        import json
        boundaries = []
        for ward in ALL_WARDS:
            half = 0.015
            polygon = {
                "type": "Feature",
                "properties": {"ward_id": ward["id"], "ward_name": ward["name"]},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [ward["lon"] - half, ward["lat"] - half],
                        [ward["lon"] + half, ward["lat"] - half],
                        [ward["lon"] + half, ward["lat"] + half],
                        [ward["lon"] - half, ward["lat"] + half],
                        [ward["lon"] - half, ward["lat"] - half],
                    ]],
                },
            }
            boundaries.append({
                "ward_id": ward["id"], "ward_name": ward["name"],
                "city": ward["city"], "state": "Gujarat",
                "geojson_data": json.dumps(polygon),
                "population": self._rng.randint(50_000, 250_000),
                "area_sqkm":  round(self._rng.uniform(3.0, 15.0), 2),
                "center_latitude":  ward["lat"],
                "center_longitude": ward["lon"],
            })
        return boundaries
