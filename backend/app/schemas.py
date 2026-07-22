"""Pydantic schemas for request validation and response serialization."""

import json
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


# ---------------------------------------------------------------------------
# Auth / User schemas
# ---------------------------------------------------------------------------


class UserCreate(BaseModel):
    """Payload for registering a new user."""

    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    password: str = Field(..., min_length=6)
    role: str = Field(default="citizen", pattern="^(citizen|OFFICER|ADMIN)$")
    ward_id: Optional[str] = None
    ward_name: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None


class OfficerCreate(BaseModel):
    """Payload for admin to register a new government officer."""

    email: EmailStr
    full_name: str = Field(..., min_length=2, max_length=255)
    password: str = Field(..., min_length=6)
    city: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None


class OfficerUpdate(BaseModel):
    """Payload for admin to update an existing officer (all fields optional)."""

    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    city: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None


class UserLogin(BaseModel):
    """Credentials for login."""

    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """User object returned to clients (no password)."""

    id: int
    email: str
    full_name: str
    role: str
    ward_id: Optional[str] = None
    ward_name: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    """JWT token response."""

    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ---------------------------------------------------------------------------
# AQI schemas
# ---------------------------------------------------------------------------


class AQIDataCreate(BaseModel):
    """Payload for ingesting a new AQI reading."""

    ward_id: str
    ward_name: str
    aqi_value: float = Field(..., ge=0)
    pm25: Optional[float] = Field(None, ge=0)
    pm10: Optional[float] = Field(None, ge=0)
    no2: Optional[float] = Field(None, ge=0)
    so2: Optional[float] = Field(None, ge=0)
    co: Optional[float] = Field(None, ge=0)
    o3: Optional[float] = Field(None, ge=0)
    timestamp: Optional[datetime] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    source: Optional[str] = "manual"


class AQIDataResponse(BaseModel):
    """AQI reading returned to clients."""

    id: int
    ward_id: str
    ward_name: str
    aqi_value: float
    pm25: Optional[float] = None
    pm10: Optional[float] = None
    no2: Optional[float] = None
    so2: Optional[float] = None
    co: Optional[float] = None
    o3: Optional[float] = None
    timestamp: datetime
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    source: Optional[str] = None
    aqi_category: Optional[str] = None  # computed field

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Prediction schemas
# ---------------------------------------------------------------------------


class PredictionRequest(BaseModel):
    """Request to generate an AQI forecast."""

    ward_id: str
    prediction_horizon: str = Field(
        default="24h", pattern="^(24h|3d|7d)$"
    )
    model_type: Optional[str] = Field(
        default="xgboost", pattern="^(random_forest|xgboost|ensemble)$"
    )


class PredictionResponse(BaseModel):
    """Forecast result returned to clients."""

    id: int
    ward_id: str
    prediction_horizon: str
    predicted_aqi: float
    predicted_pm25: Optional[float] = None
    predicted_pm10: Optional[float] = None
    confidence: Optional[float] = None
    model_used: Optional[str] = None
    aqi_category: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Hospital schemas
# ---------------------------------------------------------------------------


class HospitalResponse(BaseModel):
    """Hospital record returned to clients."""

    id: int
    name: str
    address: Optional[str] = None
    latitude: float
    longitude: float
    contact: Optional[str] = None
    emergency_facilities: bool
    ward_id: Optional[str] = None
    specializations: Optional[str] = None
    distance_km: Optional[float] = None  # populated in nearby queries

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Industry schemas
# ---------------------------------------------------------------------------


class IndustryResponse(BaseModel):
    """Industry record returned to clients."""

    id: int
    name: str
    industry_type: str
    latitude: float
    longitude: float
    ward_id: Optional[str] = None
    pollution_contribution: Optional[float] = None
    emission_category: Optional[str] = None
    last_inspection: Optional[datetime] = None
    distance_km: Optional[float] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Construction site schemas
# ---------------------------------------------------------------------------


class ConstructionSiteResponse(BaseModel):
    """Construction site record returned to clients."""

    id: int
    name: str
    latitude: float
    longitude: float
    ward_id: Optional[str] = None
    dust_emission_level: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    contractor: Optional[str] = None
    is_active: bool

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Health Advisory schemas
# ---------------------------------------------------------------------------


class UserHealthProfile(BaseModel):
    """Extensible user health profile for personalised advisories."""

    age_category: str = Field(..., pattern="^(child|adult|elderly)$")
    conditions: dict[str, bool] = Field(default_factory=dict)
    # Future: pregnancy, heart_disease, outdoor_occupation, etc. via conditions dict

    def has_condition(self, key: str) -> bool:
        return bool(self.conditions.get(key, False))


class EnvironmentalContext(BaseModel):
    """Environmental readings and location context for health analysis."""

    aqi_level: float = Field(..., ge=0)
    aqi_category: Optional[str] = None
    pm25: Optional[float] = Field(None, ge=0)
    pm10: Optional[float] = Field(None, ge=0)
    no2: Optional[float] = Field(None, ge=0)
    so2: Optional[float] = Field(None, ge=0)
    co: Optional[float] = Field(None, ge=0)
    o3: Optional[float] = Field(None, ge=0)
    ward_id: Optional[str] = None
    ward_name: Optional[str] = None
    city: Optional[str] = None
    timestamp: Optional[datetime] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    source: Optional[str] = None
    extra: dict[str, Any] = Field(default_factory=dict)


class HealthAdvisoryRequest(BaseModel):
    """Request to generate a personalised health advisory."""

    aqi_level: float = Field(..., ge=0)
    age_category: str = Field(..., pattern="^(child|adult|elderly)$")
    has_respiratory_condition: bool = False
    health_conditions: dict[str, bool] = Field(default_factory=dict)
    language: str = Field(default="en", pattern="^(en|hi|gu)$")
    ward_id: Optional[str] = None
    ward_name: Optional[str] = None
    city: Optional[str] = None
    aqi_category: Optional[str] = None
    pm25: Optional[float] = Field(None, ge=0)
    pm10: Optional[float] = Field(None, ge=0)
    no2: Optional[float] = Field(None, ge=0)
    so2: Optional[float] = Field(None, ge=0)
    co: Optional[float] = Field(None, ge=0)
    o3: Optional[float] = Field(None, ge=0)
    timestamp: Optional[datetime] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    source: Optional[str] = None
    environmental_extra: dict[str, Any] = Field(default_factory=dict)

    def merged_conditions(self) -> dict[str, bool]:
        """Merge legacy respiratory flag with extensible conditions dict."""
        conditions = dict(self.health_conditions)
        if self.has_respiratory_condition:
            conditions["respiratory"] = True
        return conditions

    def to_environmental_context(self, aqi_category: Optional[str] = None) -> EnvironmentalContext:
        return EnvironmentalContext(
            aqi_level=self.aqi_level,
            aqi_category=self.aqi_category or aqi_category,
            pm25=self.pm25,
            pm10=self.pm10,
            no2=self.no2,
            so2=self.so2,
            co=self.co,
            o3=self.o3,
            ward_id=self.ward_id,
            ward_name=self.ward_name,
            city=self.city,
            timestamp=self.timestamp,
            latitude=self.latitude,
            longitude=self.longitude,
            source=self.source,
            extra=self.environmental_extra,
        )

    def to_health_profile(self) -> UserHealthProfile:
        return UserHealthProfile(
            age_category=self.age_category,
            conditions=self.merged_conditions(),
        )


class ElevatedPollutant(BaseModel):
    pollutant: str
    value: Optional[float] = None
    unit: str = "µg/m³"
    health_impact: str


class PollutionAnalysis(BaseModel):
    primary_pollutant: str
    why_aqi_dangerous: str
    elevated_pollutants: list[ElevatedPollutant] = Field(default_factory=list)


class RecommendationSection(BaseModel):
    recommendation: str
    reasoning: str


class MaskRecommendation(BaseModel):
    mask_type: str
    reasoning: str


class IndoorSafety(BaseModel):
    windows: str
    air_purifier: str
    hydration: str
    other_recommendations: list[str] = Field(default_factory=list)
    reasoning: str


class PersonalizedHealthRisk(BaseModel):
    risk_level: str
    explanation: str
    sensitive_population_warnings: list[str] = Field(default_factory=list)


class EmergencyWarning(BaseModel):
    active: bool = False
    message: str = ""
    when_to_seek_care: str = ""


class StructuredHealthAdvice(BaseModel):
    """Structured AI health advisory for frontend rendering."""

    overall_summary: str
    pollution_analysis: PollutionAnalysis
    activity_recommendation: RecommendationSection
    mask_recommendation: MaskRecommendation
    indoor_safety: IndoorSafety
    personalized_health_risk: PersonalizedHealthRisk
    symptoms_to_watch: list[str] = Field(default_factory=list)
    emergency_warning: Optional[EmergencyWarning] = None
    long_term_advice: list[str] = Field(default_factory=list)
    extra: dict[str, Any] = Field(default_factory=dict)


class HealthAdvisoryResponse(BaseModel):
    """Health advisory returned to clients."""

    id: int
    user_id: int
    aqi_level: float
    age_category: str
    has_respiratory_condition: bool
    risk_score: float
    risk_category: str
    advice_text: str
    advice_json: Optional[str] = None
    advice: StructuredHealthAdvice
    language: str
    ward_id: Optional[str] = None
    created_at: datetime

    @field_validator("advice", mode="before")
    @classmethod
    def parse_advice(cls, value, info):
        if isinstance(value, str):
            try:
                return json.loads(value)
            except Exception:
                return {"overall_summary": value}
        if value is None and info.context is not None:
            source = info.context.get("advice_json") if isinstance(info.context, dict) else None
            if isinstance(source, str):
                try:
                    return json.loads(source)
                except Exception:
                    return {"overall_summary": source}
        return value

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Hotspot schemas
# ---------------------------------------------------------------------------


class HotspotResponse(BaseModel):
    """Pollution hotspot cluster."""

    cluster_id: int
    ward_ids: list[str]
    ward_names: list[str]
    center_latitude: float
    center_longitude: float
    average_aqi: float
    max_aqi: float
    point_count: int
    severity: str  # moderate | high | very_high | hazardous
    primary_pollutant: Optional[str] = None
    nearby_industries: Optional[int] = None
    nearby_construction: Optional[int] = None


class WardPriorityResponse(BaseModel):
    """Ward ranked by intervention urgency."""

    ward_id: str
    ward_name: str
    current_aqi: float
    aqi_category: str
    priority_score: float
    rank: int
    contributing_factors: list[str]
    recommended_actions: list[str]


# ---------------------------------------------------------------------------
# Government Action schemas
# ---------------------------------------------------------------------------


class GovernmentActionCreate(BaseModel):
    """Payload to create a government action."""

    ward_id: str
    action_type: str = Field(
        ..., pattern="^(regulation|enforcement|awareness|infrastructure)$"
    )
    description: str = Field(..., min_length=10)
    priority: str = Field(
        default="medium", pattern="^(low|medium|high|critical)$"
    )
    assigned_to: Optional[str] = None


class GovernmentActionStatusUpdate(BaseModel):
    """Payload to update the status of a government action."""

    status: str = Field(..., pattern="^(pending|in_progress|completed|cancelled)$")


class GovernmentActionResponse(BaseModel):
    """Government action returned to clients."""

    id: int
    ward_id: str
    action_type: str
    description: str
    priority: str
    status: str
    assigned_to: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Report schemas
# ---------------------------------------------------------------------------


class ReportGenerationRequest(BaseModel):
    """Request to generate an evidence PDF report."""

    ward_id: str
    title: Optional[str] = None
    include_predictions: bool = True
    include_health_impact: bool = True
    include_root_cause: bool = True
    days_back: int = Field(default=30, ge=1, le=365)


class ReportResponse(BaseModel):
    """Metadata for a generated report."""

    id: int
    ward_id: str
    title: str
    pdf_path: Optional[str] = None
    created_at: datetime
    download_url: Optional[str] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Ward Boundary schemas
# ---------------------------------------------------------------------------


class WardBoundaryResponse(BaseModel):
    """Ward boundary record returned to clients."""

    id: int
    ward_id: str
    ward_name: str
    city: str
    state: str
    geojson_data: Optional[str] = None
    population: Optional[int] = None
    area_sqkm: Optional[float] = None
    center_latitude: Optional[float] = None
    center_longitude: Optional[float] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Generic response helpers
# ---------------------------------------------------------------------------


class MessageResponse(BaseModel):
    """Simple message response."""

    message: str
    detail: Optional[Any] = None


class PaginatedResponse(BaseModel):
    """Wrapper for paginated results."""

    total: int
    page: int
    page_size: int
    items: list[Any]
