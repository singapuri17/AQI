"""
Real-time AQI ingestion service.

Primary source  : OpenWeatherMap Air Pollution API (free, 60 calls/min)
Secondary source: WAQI (World Air Quality Index) API (free token)

Both APIs are queried per-ward using the ward's latitude/longitude.
If both fail, NO fake data is generated — the system returns the
last known reading with a staleness warning.

API key setup
─────────────
Set in backend/.env:
    WEATHER_API_KEY=<your OpenWeatherMap key>   # https://home.openweathermap.org/api_keys
    WAQI_API_KEY=<your WAQI token>              # https://aqicn.org/data-platform/token/

OpenWeatherMap Air Pollution endpoint
──────────────────────────────────────
GET https://api.openweathermap.org/data/2.5/air_pollution
    ?lat={lat}&lon={lon}&appid={key}

Returns AQI (1-5 scale) + components: co, no, no2, o3, so2, pm2_5, pm10, nh3
We convert the 1-5 AQI to India AQI scale using PM2.5 as primary driver.

WAQI endpoint
─────────────
GET https://api.waqi.info/feed/geo:{lat};{lon}/?token={token}
Returns direct AQI (India-compatible) + dominant pollutant.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import aiohttp

logger = logging.getLogger(__name__)

# ── India AQI breakpoints for PM2.5 (CPCB standard) ─────────────────────────
# (Cp_lo, Cp_hi, AQI_lo, AQI_hi)
_PM25_BREAKPOINTS = [
    (0,    30,    0,   50),
    (30,   60,   51,  100),
    (60,   90,  101,  200),
    (90,  120,  201,  300),
    (120, 250,  301,  400),
    (250, 500,  401,  500),
]


def _pm25_to_india_aqi(pm25: float) -> float:
    """Convert PM2.5 concentration (μg/m³) to India AQI using CPCB breakpoints."""
    for cp_lo, cp_hi, aqi_lo, aqi_hi in _PM25_BREAKPOINTS:
        if cp_lo <= pm25 <= cp_hi:
            return round(
                ((aqi_hi - aqi_lo) / (cp_hi - cp_lo)) * (pm25 - cp_lo) + aqi_lo, 1
            )
    return min(500.0, round(pm25 * 2, 1))


# ── OpenWeatherMap ingestion ──────────────────────────────────────────────────

class OpenWeatherAQIFetcher:
    """Fetch real-time air pollution data from OpenWeatherMap."""

    BASE = "https://api.openweathermap.org/data/2.5/air_pollution"

    def __init__(self, api_key: str) -> None:
        self._key = api_key

    async def fetch(self, lat: float, lon: float) -> dict[str, Any] | None:
        """
        Returns dict with keys: aqi, pm25, pm10, no2, so2, co, o3,
                                 source, fetched_at
        or None if the call fails.
        """
        if not self._key:
            logger.warning("OpenWeatherAQIFetcher: WEATHER_API_KEY not set")
            return None
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    self.BASE,
                    params={"lat": lat, "lon": lon, "appid": self._key},
                    timeout=aiohttp.ClientTimeout(total=8),
                ) as resp:
                    if resp.status != 200:
                        logger.warning("OWM Air Pollution API returned HTTP %d", resp.status)
                        return None
                    data = await resp.json()
                    items = data.get("list", [])
                    if not items:
                        return None
                    comp = items[0].get("components", {})
                    pm25 = comp.get("pm2_5", 0.0)
                    aqi  = _pm25_to_india_aqi(pm25)
                    return {
                        "aqi":        aqi,
                        "pm25":       round(pm25, 2),
                        "pm10":       round(comp.get("pm10", 0.0), 2),
                        "no2":        round(comp.get("no2",  0.0), 2),
                        "so2":        round(comp.get("so2",  0.0), 2),
                        "co":         round(comp.get("co",   0.0) / 1000, 3),  # μg→mg/m³
                        "o3":         round(comp.get("o3",   0.0), 2),
                        "source":     "OpenWeatherMap Air Pollution API",
                        "fetched_at": datetime.now(timezone.utc).isoformat(),
                    }
        except Exception as exc:
            logger.warning("OpenWeatherAQIFetcher.fetch error: %s", exc)
            return None


# ── WAQI ingestion ────────────────────────────────────────────────────────────

class WAQIFetcher:
    """Fetch real-time AQI from World Air Quality Index (waqi.info)."""

    BASE = "https://api.waqi.info/feed/geo:{lat};{lon}/"

    def __init__(self, token: str) -> None:
        self._token = token

    async def fetch(self, lat: float, lon: float) -> dict[str, Any] | None:
        if not self._token:
            logger.warning("WAQIFetcher: WAQI_API_KEY not set")
            return None
        try:
            async with aiohttp.ClientSession() as session:
                url = self.BASE.format(lat=lat, lon=lon)
                async with session.get(
                    url,
                    params={"token": self._token},
                    timeout=aiohttp.ClientTimeout(total=8),
                ) as resp:
                    if resp.status != 200:
                        return None
                    data = await resp.json()
                    if data.get("status") != "ok":
                        return None
                    d = data["data"]
                    iaqi = d.get("iaqi", {})

                    def _v(key: str) -> float:
                        return round(float(iaqi.get(key, {}).get("v", 0.0)), 2)

                    aqi = float(d.get("aqi", 0))
                    return {
                        "aqi":        round(aqi, 1),
                        "pm25":       _v("pm25"),
                        "pm10":       _v("pm10"),
                        "no2":        _v("no2"),
                        "so2":        _v("so2"),
                        "co":         _v("co"),
                        "o3":         _v("o3"),
                        "source":     f"WAQI — {d.get('city', {}).get('name', 'Unknown')}",
                        "fetched_at": datetime.now(timezone.utc).isoformat(),
                    }
        except Exception as exc:
            logger.warning("WAQIFetcher.fetch error: %s", exc)
            return None


# ── Main real-time ingestor ───────────────────────────────────────────────────

class RealTimeAQIIngestor:
    """
    Ingest real AQI data for all wards.

    Uses OpenWeatherMap as primary, WAQI as fallback.
    If both fail for a ward, that ward is skipped — NO fake values written.
    """

    def __init__(self, owm_key: str, waqi_token: str = "") -> None:
        self._owm   = OpenWeatherAQIFetcher(owm_key)
        self._waqi  = WAQIFetcher(waqi_token)

    async def fetch_ward(self, ward_id: str, ward_name: str,
                         lat: float, lon: float) -> dict | None:
        """Fetch real AQI for a single ward. Returns None if all sources fail."""
        # Try primary
        result = await self._owm.fetch(lat, lon)
        if result:
            result["ward_id"]   = ward_id
            result["ward_name"] = ward_name
            result["latitude"]  = lat
            result["longitude"] = lon
            logger.info("✅ [REAL] %s | AQI %.0f | Source: %s",
                        ward_name, result["aqi"], result["source"])
            return result

        # Try secondary
        result = await self._waqi.fetch(lat, lon)
        if result:
            result["ward_id"]   = ward_id
            result["ward_name"] = ward_name
            result["latitude"]  = lat
            result["longitude"] = lon
            logger.info("✅ [REAL-WAQI] %s | AQI %.0f | Source: %s",
                        ward_name, result["aqi"], result["source"])
            return result

        logger.warning("❌ [NO DATA] %s — both OWM and WAQI failed", ward_name)
        return None

    async def ingest_all_wards(self, db_session, ward_coordinates: list[dict]) -> dict:
        """
        Fetch and store real AQI for all wards.

        Args:
            db_session: AsyncSession
            ward_coordinates: list of {ward_id, ward_name, lat, lon}

        Returns:
            Summary dict: {success: int, failed: int, source: str}
        """
        from app.models import AQIData

        success = 0
        failed  = 0
        sources: set[str] = set()

        for ward in ward_coordinates:
            result = await self.fetch_ward(
                ward["ward_id"], ward["ward_name"],
                ward["lat"], ward["lon"]
            )
            if result is None:
                failed += 1
                continue

            record = AQIData(
                ward_id    = result["ward_id"],
                ward_name  = result["ward_name"],
                aqi_value  = result["aqi"],
                pm25       = result["pm25"],
                pm10       = result["pm10"],
                no2        = result["no2"],
                so2        = result["so2"],
                co         = result["co"],
                o3         = result["o3"],
                timestamp  = datetime.now(timezone.utc),
                latitude   = result["latitude"],
                longitude  = result["longitude"],
                source     = result["source"],
            )
            db_session.add(record)
            sources.add(result["source"])
            success += 1

        await db_session.commit()
        logger.info("Real AQI ingest complete: %d success, %d failed", success, failed)
        return {
            "success": success,
            "failed":  failed,
            "source":  ", ".join(sources) if sources else "none",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
