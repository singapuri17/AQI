"""
Async SQLAlchemy database setup.

Development  : SQLite  (sqlite+aiosqlite:///./air_quality.db)
Production   : PostgreSQL (postgresql+asyncpg://user:pass@host/db)

The engine, session factory, and Base are configured here so that every
other module imports from this single place.  Switching to PostgreSQL for
production only requires changing DATABASE_URL in .env — no other code
needs to change.
"""

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncConnection,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

_is_sqlite = "sqlite" in settings.database_url

# SQLite-specific connection args — required to allow async usage
_connect_args: dict = {"check_same_thread": False} if _is_sqlite else {}

# pool_size and max_overflow are not supported by SQLite's NullPool
_pool_kwargs: dict = {} if _is_sqlite else {"pool_size": 5, "max_overflow": 10}

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,          # set DEBUG=true in .env to see SQL
    connect_args=_connect_args,
    **_pool_kwargs,
)


# Enable WAL mode and foreign keys for SQLite connections
# (these are no-ops on PostgreSQL so safe to leave in)
@event.listens_for(engine.sync_engine, "connect")
def _set_sqlite_pragmas(dbapi_conn, _connection_record):
    if _is_sqlite:
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")   # better concurrent reads
        cursor.execute("PRAGMA foreign_keys=ON")    # enforce FK constraints
        cursor.execute("PRAGMA synchronous=NORMAL") # safe + faster than FULL
        cursor.close()


# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------

AsyncSessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


# ---------------------------------------------------------------------------
# Declarative base
# ---------------------------------------------------------------------------

class Base(DeclarativeBase):
    """
    Base class for all ORM models.

    All models inherit from this.  SQLAlchemy's metadata tracks every table
    so that init_db() can create them all in one call.
    """
    pass


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

async def get_db():
    """
    Yield an async database session for use as a FastAPI dependency.

    Usage:
        @router.get("/items")
        async def list_items(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


# ---------------------------------------------------------------------------
# Table creation
# ---------------------------------------------------------------------------

async def init_db() -> None:
    """
    Create all tables that don't already exist (idempotent).

    Called once on application startup from main.py lifespan.
    For PostgreSQL + PostGIS you would also run:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
    before create_all.
    """
    # Import all models so their metadata is registered before create_all
    import app.models  # noqa: F401 — side-effect import

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
