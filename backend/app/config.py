"""
Application configuration using pydantic-settings.

All values can be overridden via environment variables or a .env file.

Migration note
--------------
To switch from SQLite to PostgreSQL, change DATABASE_URL in .env to:
    postgresql+asyncpg://user:password@localhost:5432/urban_air

No other code needs to change — the engine in database.py detects the
driver from the URL and adapts automatically.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Database ──────────────────────────────────────────────────────────────
    # Default: SQLite stored in backend/air_quality.db
    # Production: set DATABASE_URL=postgresql+asyncpg://... in .env
    database_url: str = "sqlite+aiosqlite:///./air_quality.db"

    # ── JWT ───────────────────────────────────────────────────────────────────
    secret_key: str = "uaqiis-dev-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # ── External APIs (optional) ──────────────────────────────────────────────
    gemini_api_key: str = ""
    openaq_api_key: str = ""
    weather_api_key: str = ""

    # ── App meta ──────────────────────────────────────────────────────────────
    app_name: str = "Urban Air Quality Intelligence and Intervention System"
    app_version: str = "1.0.0"
    debug: bool = False

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache()
def get_settings() -> Settings:
    """Return a cached Settings instance (reads .env once)."""
    return Settings()
