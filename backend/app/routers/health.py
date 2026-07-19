"""Health router — risk scoring, AI-powered advice, and advisory history."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import HealthAdvisory, User
from app.schemas import HealthAdvisoryRequest, HealthAdvisoryResponse

router = APIRouter(prefix="/health", tags=["Health"])


@router.post(
    "/risk-score",
    summary="Calculate a personalised health risk score",
)
async def calculate_risk_score(
    payload: HealthAdvisoryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Compute a health risk score based on AQI and user health profile.

    Does **not** call an external API — uses the rule-based
    :class:`~app.services.ml_service.HealthRiskCalculator`.

    Args:
        payload: AQI level, age category, respiratory status, and language.
        db: Async database session.
        current_user: Authenticated user.

    Returns:
        Dict with risk_score, risk_category, contributing_factors.
    """
    from app.services.ml_service import HealthRiskCalculator

    calculator = HealthRiskCalculator()
    result = calculator.calculate_risk(
        aqi=payload.aqi_level,
        age_category=payload.age_category,
        has_respiratory=payload.has_respiratory_condition,
    )
    return result


@router.post(
    "/advice",
    response_model=HealthAdvisoryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate AI-powered personalised health advice",
)
async def get_health_advice(
    payload: HealthAdvisoryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate personalised health advice using Gemini AI and persist it.

    Falls back to a rule-based message if the Gemini API is unavailable.

    Args:
        payload: AQI level, age category, respiratory condition, language.
        db: Async database session.
        current_user: Authenticated user.

    Returns:
        Persisted HealthAdvisory record.
    """
    from app.services.gemini_service import GeminiService
    from app.services.ml_service import HealthRiskCalculator

    # Calculate risk first
    calculator = HealthRiskCalculator()
    risk_result = calculator.calculate_risk(
        aqi=payload.aqi_level,
        age_category=payload.age_category,
        has_respiratory=payload.has_respiratory_condition,
    )

    # Generate AI advice
    gemini = GeminiService()
    advice_text = await gemini.generate_health_advice(
        aqi=payload.aqi_level,
        age_category=payload.age_category,
        has_respiratory=payload.has_respiratory_condition,
        language=payload.language,
        risk_category=risk_result["risk_category"],
    )

    advisory = HealthAdvisory(
        user_id=current_user.id,
        aqi_level=payload.aqi_level,
        age_category=payload.age_category,
        has_respiratory_condition=payload.has_respiratory_condition,
        risk_score=risk_result["risk_score"],
        risk_category=risk_result["risk_category"],
        advice_text=advice_text,
        language=payload.language,
        ward_id=payload.ward_id,
    )
    db.add(advisory)
    await db.commit()
    await db.refresh(advisory)
    return HealthAdvisoryResponse.model_validate(advisory)


@router.get(
    "/advisories/{user_id}",
    response_model=list[HealthAdvisoryResponse],
    summary="Get health advisory history for a user",
)
async def get_user_advisories(
    user_id: int,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return past health advisories for *user_id*.

    Users may only view their own advisories unless they hold the government
    role.

    Args:
        user_id: ID of the user whose advisories to retrieve.
        limit: Maximum number of records to return.
        db: Async database session.
        current_user: Authenticated user.

    Returns:
        List of HealthAdvisory records ordered newest-first.

    Raises:
        HTTPException 403: If a citizen tries to view another user's advisories.
    """
    if current_user.role != "government" and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorised to view another user's advisories",
        )

    result = await db.execute(
        select(HealthAdvisory)
        .where(HealthAdvisory.user_id == user_id)
        .order_by(desc(HealthAdvisory.created_at))
        .limit(limit)
    )
    records = result.scalars().all()
    return [HealthAdvisoryResponse.model_validate(r) for r in records]
