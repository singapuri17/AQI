"""SQLAlchemy ORM models for the Urban Air Quality system."""

from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------


class User(Base):
    """Platform user — either a citizen or a government official."""

    __tablename__ = "users"
    __table_args__ = (
        Index("ix_users_email", "email", unique=True),
        Index("ix_users_ward_id", "ward_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(
        String(50), nullable=False, default="citizen"
    )  # citizen | OFFICER | ADMIN
    gender: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    date_of_birth: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    document_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    ward_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    ward_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    health_advisories: Mapped[list["HealthAdvisory"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


# ---------------------------------------------------------------------------
# AQI Data
# ---------------------------------------------------------------------------


class AQIData(Base):
    """Measured air quality index data per ward snapshot."""

    __tablename__ = "aqi_data"
    __table_args__ = (
        Index("ix_aqi_data_ward_id", "ward_id"),
        Index("ix_aqi_data_timestamp", "timestamp"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    ward_id: Mapped[str] = mapped_column(String(50), nullable=False)
    ward_name: Mapped[str] = mapped_column(String(255), nullable=False)
    aqi_value: Mapped[float] = mapped_column(Float, nullable=False)
    pm25: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pm10: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    no2: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    so2: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    co: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    o3: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    source: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True, default="synthetic"
    )


# ---------------------------------------------------------------------------
# Prediction Data
# ---------------------------------------------------------------------------


class PredictionData(Base):
    """ML-generated AQI forecast for a given ward and time horizon."""

    __tablename__ = "prediction_data"
    __table_args__ = (
        Index("ix_prediction_data_ward_id", "ward_id"),
        Index("ix_prediction_data_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    ward_id: Mapped[str] = mapped_column(String(50), nullable=False)
    prediction_horizon: Mapped[str] = mapped_column(
        String(10), nullable=False
    )  # 24h | 3d | 7d
    predicted_aqi: Mapped[float] = mapped_column(Float, nullable=False)
    predicted_pm25: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    predicted_pm10: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    model_used: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    feature_importance: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # JSON string
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


# ---------------------------------------------------------------------------
# Hospital
# ---------------------------------------------------------------------------


class Hospital(Base):
    """Healthcare facility with emergency capabilities."""

    __tablename__ = "hospitals"
    __table_args__ = (Index("ix_hospitals_ward_id", "ward_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    contact: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    emergency_facilities: Mapped[bool] = mapped_column(Boolean, default=False)
    ward_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    specializations: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # comma-separated


# ---------------------------------------------------------------------------
# Industry
# ---------------------------------------------------------------------------


class Industry(Base):
    """Industrial facility contributing to air pollution."""

    __tablename__ = "industries"
    __table_args__ = (Index("ix_industries_ward_id", "ward_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    industry_type: Mapped[str] = mapped_column(String(100), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    ward_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    pollution_contribution: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True
    )  # percentage 0-100
    emission_category: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True
    )  # low | medium | high | critical
    last_inspection: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


# ---------------------------------------------------------------------------
# Construction Site
# ---------------------------------------------------------------------------


class ConstructionSite(Base):
    """Active construction site contributing to dust/particulate matter."""

    __tablename__ = "construction_sites"
    __table_args__ = (Index("ix_construction_sites_ward_id", "ward_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    ward_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    dust_emission_level: Mapped[Optional[str]] = mapped_column(
        String(50), nullable=True
    )  # low | medium | high
    start_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    end_date: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    contractor: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


# ---------------------------------------------------------------------------
# Health Advisory
# ---------------------------------------------------------------------------


class HealthAdvisory(Base):
    """Personalised health advisory generated for a user based on AQI and health profile."""

    __tablename__ = "health_advisories"
    __table_args__ = (
        Index("ix_health_advisories_user_id", "user_id"),
        Index("ix_health_advisories_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    aqi_level: Mapped[float] = mapped_column(Float, nullable=False)
    age_category: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # child | adult | elderly
    has_respiratory_condition: Mapped[bool] = mapped_column(Boolean, default=False)
    risk_score: Mapped[float] = mapped_column(Float, nullable=False)
    risk_category: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # low | moderate | high | very_high | hazardous
    advice_text: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(
        String(20), nullable=False, default="en"
    )  # en | hi | gu
    ward_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="health_advisories")


# ---------------------------------------------------------------------------
# Government Action
# ---------------------------------------------------------------------------


class GovernmentAction(Base):
    """Recorded or recommended government intervention for a ward."""

    __tablename__ = "government_actions"
    __table_args__ = (
        Index("ix_government_actions_ward_id", "ward_id"),
        Index("ix_government_actions_status", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    ward_id: Mapped[str] = mapped_column(String(50), nullable=False)
    action_type: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # regulation | enforcement | awareness | infrastructure
    description: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[str] = mapped_column(
        String(20), nullable=False, default="medium"
    )  # low | medium | high | critical
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="pending"
    )  # pending | in_progress | completed | cancelled
    assigned_to: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


# ---------------------------------------------------------------------------
# Evidence Report
# ---------------------------------------------------------------------------


class EvidenceReport(Base):
    """Generated PDF evidence / analytics report for a ward."""

    __tablename__ = "evidence_reports"
    __table_args__ = (Index("ix_evidence_reports_ward_id", "ward_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    ward_id: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content_json: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # JSON metadata / summary
    pdf_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    created_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


# ---------------------------------------------------------------------------
# Ward Boundary
# ---------------------------------------------------------------------------


class WardBoundary(Base):
    """Geospatial boundary and demographic information for a city ward."""

    __tablename__ = "ward_boundaries"
    __table_args__ = (
        Index("ix_ward_boundaries_ward_id", "ward_id", unique=True),
        Index("ix_ward_boundaries_city", "city"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    ward_id: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    ward_name: Mapped[str] = mapped_column(String(255), nullable=False)
    city: Mapped[str] = mapped_column(String(255), nullable=False)
    state: Mapped[str] = mapped_column(String(255), nullable=False)
    geojson_data: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # GeoJSON polygon as string
    population: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    area_sqkm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    center_latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    center_longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
