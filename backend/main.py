"""FastAPI application entry point for the Urban Air Quality Intelligence System."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db
from app.routers import aqi, auth, government, health, hospitals, hotspots, predictions

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

settings = get_settings()


# ---------------------------------------------------------------------------
# Lifespan event handler
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s v%s", settings.app_name, settings.app_version)
    await init_db()
    logger.info("Database initialized")
    await seed_data_if_empty()
    await seed_admin_account()
    # Note: Real-time AQI refresh is disabled — application uses synthetic data
    yield
    logger.info("Shutting down %s", settings.app_name)


async def _aqi_refresh_loop() -> None:
    """Background loop: refresh AQI from real API every N minutes."""
    import asyncio
    from app.config import get_settings
    from app.database import AsyncSessionLocal
    from app.models import WardBoundary
    from app.services.real_aqi_service import RealTimeAQIIngestor
    from sqlalchemy import select

    s = get_settings()
    interval = s.aqi_refresh_interval_minutes * 60   # convert to seconds

    if not s.weather_api_key and not s.waqi_api_key:
        logger.info(
            "AQI auto-refresh: no API key configured. "
            "Set WEATHER_API_KEY or WAQI_API_KEY in backend/.env to enable real-time data."
        )
        return

    ingestor = RealTimeAQIIngestor(owm_key=s.weather_api_key, waqi_token=s.waqi_api_key)
    logger.info("AQI auto-refresh scheduler started (interval: %d min)", s.aqi_refresh_interval_minutes)

    while True:
        try:
            async with AsyncSessionLocal() as db:
                result = await db.execute(
                    select(WardBoundary.ward_id, WardBoundary.ward_name,
                           WardBoundary.center_latitude, WardBoundary.center_longitude)
                )
                wards = [
                    {"ward_id": r[0], "ward_name": r[1], "lat": r[2], "lon": r[3]}
                    for r in result.all() if r[2] and r[3]
                ]
                if wards:
                    summary = await ingestor.ingest_all_wards(db, wards)
                    logger.info("Auto-refresh complete: %s", summary)
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.error("Auto-refresh error: %s", exc)

        await asyncio.sleep(interval)


async def seed_data_if_empty() -> None:
    """Populate the database with synthetic data if no AQI records exist."""
    from sqlalchemy import select

    from app.auth import get_password_hash
    from app.database import AsyncSessionLocal
    from app.models import AQIData, ConstructionSite, Hospital, Industry, User, WardBoundary
    from app.services.data_ingestion import SyntheticDataGenerator

    async with AsyncSessionLocal() as db:
        # Check if we already have AQI data
        result = await db.execute(select(AQIData).limit(1))
        if result.scalar_one_or_none():
            logger.info("Database already has data, skipping seed")
            return

        logger.info("Database is empty, seeding synthetic data...")
        generator = SyntheticDataGenerator()

        # Seed demo users so login always works after a DB wipe
        demo_users = [
            User(email="citizen@demo.com",    full_name="Demo Citizen",    hashed_password=get_password_hash("demo123"), role="citizen",    city="Ahmedabad", is_active=True),
            User(email="government@demo.com", full_name="Demo Government", hashed_password=get_password_hash("demo123"), role="government", city="Ahmedabad", is_active=True),
        ]
        for u in demo_users:
            db.add(u)
        logger.info("Inserted %d demo users", len(demo_users))

        # Generate and insert AQI data (past 30 days)
        aqi_records = generator.generate_aqi_data(days_back=30)
        for rec in aqi_records:
            db.add(AQIData(**rec))
        logger.info("Inserted %d AQI records", len(aqi_records))

        # Generate and insert hospitals
        hospitals = generator.generate_hospitals()
        for h in hospitals:
            db.add(Hospital(**h))
        logger.info("Inserted %d hospitals", len(hospitals))

        # Generate and insert industries
        industries = generator.generate_industries()
        for i in industries:
            db.add(Industry(**i))
        logger.info("Inserted %d industries", len(industries))

        # Generate and insert construction sites
        construction_sites = generator.generate_construction_sites()
        for cs in construction_sites:
            db.add(ConstructionSite(**cs))
        logger.info("Inserted %d construction sites", len(construction_sites))

        # Generate and insert ward boundaries
        ward_boundaries = generator.generate_ward_boundaries()
        for wb in ward_boundaries:
            db.add(WardBoundary(**wb))
        logger.info("Inserted %d ward boundaries", len(ward_boundaries))

        await db.commit()
        logger.info("Synthetic data seeded successfully")


async def seed_admin_account() -> None:
    """Ensure the default administrator account exists in the database.

    Creates admin@airsense.gov / Admin@123 with role=ADMIN on first run.
    Safe to call on every startup — does nothing if the account already exists.
    """
    from sqlalchemy import select

    from app.auth import get_password_hash
    from app.database import AsyncSessionLocal
    from app.models import User

    ADMIN_EMAIL = "admin@airsense.gov"
    ADMIN_PASSWORD = "Admin@123"
    ADMIN_NAME = "System Administrator"

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == ADMIN_EMAIL))
        if result.scalar_one_or_none():
            return  # already exists

        admin = User(
            email=ADMIN_EMAIL,
            full_name=ADMIN_NAME,
            hashed_password=get_password_hash(ADMIN_PASSWORD),
            role="ADMIN",
            is_active=True,
        )
        db.add(admin)
        await db.commit()
        logger.info("Default admin account created: %s", ADMIN_EMAIL)


# ---------------------------------------------------------------------------
# FastAPI app initialization
# ---------------------------------------------------------------------------

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "An AI-powered platform for urban air quality monitoring, prediction, "
        "health risk assessment, and government intervention planning. "
        "Built with FastAPI, SQLAlchemy, XGBoost, and Google Gemini."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS middleware (allow all origins for development)
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Health check endpoint
# ---------------------------------------------------------------------------


@app.get(
    "/",
    tags=["Health"],
    summary="Health check endpoint",
)
async def root():
    """Root endpoint that confirms the API is running.

    Returns:
        Dict with message, app name, and version.
    """
    return {
        "message": "Urban Air Quality Intelligence and Intervention System API",
        "status": "online",
        "version": settings.app_version,
        "docs": "/docs",
    }


# ---------------------------------------------------------------------------
# Include all routers
# ---------------------------------------------------------------------------

app.include_router(auth.router)
app.include_router(aqi.router)
app.include_router(predictions.router)
app.include_router(hospitals.router)
app.include_router(health.router)
app.include_router(hotspots.router)
app.include_router(government.router)

logger.info("All routers registered")


# ---------------------------------------------------------------------------
# Entry point for running with uvicorn
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level="info",
    )
