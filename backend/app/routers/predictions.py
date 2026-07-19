"""Predictions router — ML-based AQI forecasting endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import AQIData, PredictionData
from app.schemas import PredictionRequest, PredictionResponse

router = APIRouter(prefix="/predictions", tags=["Predictions"])


def _aqi_category(aqi: float) -> str:
    if aqi <= 50:
        return "Good"
    if aqi <= 100:
        return "Satisfactory"
    if aqi <= 200:
        return "Moderate"
    if aqi <= 300:
        return "Poor"
    if aqi <= 400:
        return "Very Poor"
    return "Severe"


@router.post(
    "/generate",
    response_model=PredictionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate an AQI prediction for a ward",
)
async def generate_prediction(
    payload: PredictionRequest,
    db: AsyncSession = Depends(get_db),
    _current_user=Depends(get_current_user),
):
    """Run the ML model to produce an AQI forecast and persist it.

    Args:
        payload: Ward ID, horizon (24h/3d/7d), and model type.
        db: Async database session.
        _current_user: Any authenticated user.

    Returns:
        The newly created prediction record.

    Raises:
        HTTPException 404: If no historical AQI data exists for the ward.
        HTTPException 500: If model inference fails.
    """
    from app.services.ml_service import AQIPredictor

    # Fetch ward history for feature engineering
    result = await db.execute(
        select(AQIData)
        .where(AQIData.ward_id == payload.ward_id)
        .order_by(desc(AQIData.timestamp))
        .limit(168)  # up to 7 days of hourly data
    )
    history = result.scalars().all()
    if not history:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No AQI history found for ward '{payload.ward_id}'",
        )

    try:
        predictor = AQIPredictor()
        prediction_result = predictor.predict(
            ward_id=payload.ward_id,
            horizon=payload.prediction_horizon,
            historical_data=history,
            model_type=payload.model_type or "xgboost",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction failed: {str(exc)}",
        )

    record = PredictionData(
        ward_id=payload.ward_id,
        prediction_horizon=payload.prediction_horizon,
        predicted_aqi=prediction_result["predicted_aqi"],
        predicted_pm25=prediction_result.get("predicted_pm25"),
        predicted_pm10=prediction_result.get("predicted_pm10"),
        confidence=prediction_result.get("confidence"),
        model_used=prediction_result.get("model_used"),
        feature_importance=prediction_result.get("feature_importance_json"),
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    resp = PredictionResponse.model_validate(record)
    resp.aqi_category = _aqi_category(record.predicted_aqi)
    return resp


@router.get(
    "/accuracy",
    summary="Get model accuracy metrics (MAE, RMSE, R²)",
)
async def get_accuracy_metrics():
    """Return cross-validated accuracy metrics for the trained models.

    Returns:
        Dict with metrics for each model (random_forest, xgboost).
    """
    from app.services.ml_service import AQIPredictor

    predictor = AQIPredictor()
    return predictor.get_accuracy_metrics()


@router.get(
    "/{ward_id}",
    response_model=list[PredictionResponse],
    summary="Get stored predictions for a ward",
)
async def get_ward_predictions(
    ward_id: str,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
):
    """Return the most-recent stored predictions for *ward_id*.

    Args:
        ward_id: Ward identifier string.
        limit: Maximum records to return.
        db: Async database session.

    Returns:
        List of prediction records ordered newest-first.
    """
    result = await db.execute(
        select(PredictionData)
        .where(PredictionData.ward_id == ward_id)
        .order_by(desc(PredictionData.created_at))
        .limit(limit)
    )
    records = result.scalars().all()
    out = []
    for r in records:
        resp = PredictionResponse.model_validate(r)
        resp.aqi_category = _aqi_category(r.predicted_aqi)
        out.append(resp)
    return out
