"""Government router — actions, AI recommendations, and evidence report generation."""

import json
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_government_user, get_current_user
from app.database import get_db
from app.models import AQIData, EvidenceReport, GovernmentAction
from app.schemas import (
    GovernmentActionCreate,
    GovernmentActionStatusUpdate,
    GovernmentActionResponse,
    ReportGenerationRequest,
    ReportResponse,
)

router = APIRouter(prefix="/government", tags=["Government"])


@router.get(
    "/actions",
    response_model=list[GovernmentActionResponse],
    summary="Get all government actions",
)
async def get_actions(
    ward_id: Optional[str] = None,
    city: Optional[str] = None,
    status_filter: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    from app.models import WardBoundary
    city = city.strip().title() if city else None
    query = select(GovernmentAction).order_by(desc(GovernmentAction.created_at))
    if ward_id:
        query = query.where(GovernmentAction.ward_id == ward_id)
    elif city:
        wb_result = await db.execute(
            select(WardBoundary.ward_id).where(WardBoundary.city == city)
        )
        city_ward_ids = [r[0] for r in wb_result.all()]
        if city_ward_ids:
            query = query.where(GovernmentAction.ward_id.in_(city_ward_ids))
    if status_filter:
        query = query.where(GovernmentAction.status == status_filter)
    query = query.limit(limit)
    result = await db.execute(query)
    return [GovernmentActionResponse.model_validate(a) for a in result.scalars().all()]


@router.post(
    "/actions",
    response_model=GovernmentActionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new government action (government users only)",
)
async def create_action(
    payload: GovernmentActionCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_government_user),
):
    """Persist a new government action record.

    Args:
        payload: Action details including ward, type, description, and priority.
        db: Async database session.
        current_user: Authenticated government user.

    Returns:
        Newly created GovernmentAction record.
    """
    action = GovernmentAction(
        ward_id=payload.ward_id,
        action_type=payload.action_type,
        description=payload.description,
        priority=payload.priority,
        assigned_to=payload.assigned_to,
        created_by=current_user.id,
    )
    db.add(action)
    await db.commit()
    await db.refresh(action)
    return GovernmentActionResponse.model_validate(action)


@router.patch(
    "/actions/{action_id}/status",
    response_model=GovernmentActionResponse,
    summary="Update the status of a government action",
)
async def update_action_status(
    action_id: int,
    payload: GovernmentActionStatusUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_government_user),
):
    """Change the status of an existing action (pending → in_progress → completed / cancelled)."""
    from datetime import datetime, timezone
    result = await db.execute(
        select(GovernmentAction).where(GovernmentAction.id == action_id)
    )
    action = result.scalar_one_or_none()
    if not action:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action not found")

    action.status = payload.status
    if payload.status == "completed":
        action.completed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(action)
    return GovernmentActionResponse.model_validate(action)


@router.get(
    "/recommendations",
    summary="Get AI-generated government recommendations for the city",
)
async def get_recommendations(
    city: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_government_user),
):
    from sqlalchemy import func
    from app.services.gemini_service import GeminiService
    from app.models import WardBoundary

    city = city.strip().title() if city else None

    # Fetch latest AQI per ward (filtered by city)
    subq = (
        select(func.max(AQIData.id).label("max_id"))
        .group_by(AQIData.ward_id)
        .subquery()
    )
    aqi_query = select(AQIData).where(AQIData.id.in_(select(subq.c.max_id)))
    if city:
        wb_result = await db.execute(
            select(WardBoundary.ward_id).where(WardBoundary.city == city)
        )
        city_ids = [r[0] for r in wb_result.all()]
        if city_ids:
            aqi_query = aqi_query.where(AQIData.ward_id.in_(city_ids))

    result = await db.execute(aqi_query)
    aqi_records = result.scalars().all()

    aqi_summary = [
        {"ward_id": r.ward_id, "ward_name": r.ward_name,
         "aqi": r.aqi_value, "pm25": r.pm25, "pm10": r.pm10}
        for r in aqi_records
    ]

    gemini = GeminiService()
    recommendations = await gemini.generate_government_recommendations(aqi_data=aqi_summary)
    return {"recommendations": recommendations, "ward_count": len(aqi_records)}


@router.get(
    "/recommendations/ward/{ward_id}",
    summary="Get deep ward-specific analysis and prioritised action recommendations",
)
async def get_ward_recommendations(
    ward_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_government_user),
):
    """Rule-based recommendation engine — generates unique actions per ward
    based on AQI, pollutants, industry data, and construction activity."""
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import func
    from app.models import ConstructionSite, Industry
    from app.services.recommendation_engine import WardRecommendationEngine, build_ward_profile

    # Latest AQI reading
    result = await db.execute(
        select(AQIData)
        .where(AQIData.ward_id == ward_id)
        .order_by(desc(AQIData.timestamp))
        .limit(1)
    )
    latest = result.scalar_one_or_none()
    if not latest:
        return {"ward_id": ward_id, "recommendations": [],
                "analysis": "No data available for this ward."}

    # 7-day average
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    avg_result = await db.execute(
        select(func.avg(AQIData.aqi_value))
        .where(AQIData.ward_id == ward_id, AQIData.timestamp >= cutoff)
    )
    avg_aqi = float(avg_result.scalar() or latest.aqi_value)

    # Industries
    ind_result = await db.execute(
        select(Industry)
        .where(Industry.ward_id == ward_id)
        .order_by(Industry.pollution_contribution.desc().nullslast())
    )
    industries = ind_result.scalars().all()

    # Active construction
    con_result = await db.execute(
        select(ConstructionSite)
        .where(ConstructionSite.ward_id == ward_id, ConstructionSite.is_active == True)
    )
    construction = con_result.scalars().all()

    # Build profile and run engine
    profile = build_ward_profile(
        ward_id=ward_id,
        ward_name=latest.ward_name,
        latest_aqi=latest,
        avg_aqi=avg_aqi,
        industries=list(industries),
        construction=list(construction),
    )
    engine = WardRecommendationEngine()
    report = engine.analyse(profile)

    # Add 7-day avg for display
    report["avg_aqi_7d"] = round(avg_aqi, 1)
    report["industry_count"] = len(industries)
    report["construction_count"] = len(construction)
    return report


@router.get(
    "/reports",
    summary="List all generated evidence reports",
)
async def list_reports(
    ward_id: Optional[str] = None,
    city: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """Return metadata for all generated reports, newest first, filtered by city."""
    from app.models import WardBoundary
    city = city.strip().title() if city else None
    query = select(EvidenceReport).order_by(desc(EvidenceReport.created_at))
    if ward_id:
        query = query.where(EvidenceReport.ward_id == ward_id)
    elif city:
        wb_result = await db.execute(
            select(WardBoundary.ward_id).where(WardBoundary.city == city)
        )
        city_ward_ids = [r[0] for r in wb_result.all()]
        if city_ward_ids:
            query = query.where(EvidenceReport.ward_id.in_(city_ward_ids))
    query = query.limit(limit)
    result = await db.execute(query)
    reports = result.scalars().all()
    out = []
    for r in reports:
        resp = ReportResponse.model_validate(r)
        resp.download_url = f"/government/reports/{r.id}/download"
        out.append(resp)
    return out


@router.post(
    "/reports/generate",
    response_model=ReportResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate an evidence PDF report for a ward",
)
async def generate_report(
    payload: ReportGenerationRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_government_user),
):
    """Generate a comprehensive PDF evidence report and store its metadata.

    Args:
        payload: Ward ID, title, and content flags.
        db: Async database session.
        current_user: Authenticated government user.

    Returns:
        ReportResponse with report ID and download URL.

    Raises:
        HTTPException 500: If PDF generation fails.
    """
    from app.services.report_service import ReportGenerator

    generator = ReportGenerator()
    try:
        pdf_path = await generator.generate_evidence_report(
            ward_id=payload.ward_id,
            db=db,
            days_back=payload.days_back,
            include_predictions=payload.include_predictions,
            include_health_impact=payload.include_health_impact,
            include_root_cause=payload.include_root_cause,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Report generation failed: {str(exc)}",
        )

    title = payload.title or f"AQI Evidence Report — Ward {payload.ward_id}"
    report = EvidenceReport(
        ward_id=payload.ward_id,
        title=title,
        pdf_path=pdf_path,
        created_by=current_user.id,
        content_json=json.dumps({"days_back": payload.days_back}),
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    resp = ReportResponse.model_validate(report)
    resp.download_url = f"/government/reports/{report.id}/download"
    return resp


@router.get(
    "/reports/{report_id}/download",
    summary="Download a previously generated evidence report",
)
async def download_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_government_user),
):
    """Stream the PDF file for report *report_id*.

    Args:
        report_id: Primary key of the EvidenceReport record.
        db: Async database session.
        _: Authenticated government user.

    Returns:
        PDF file as a streaming response.

    Raises:
        HTTPException 404: If the report or file is not found.
    """
    result = await db.execute(
        select(EvidenceReport).where(EvidenceReport.id == report_id)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report not found"
        )
    if not report.pdf_path or not os.path.exists(report.pdf_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF file not found on disk",
        )
    return FileResponse(
        path=report.pdf_path,
        media_type="application/pdf",
        filename=os.path.basename(report.pdf_path),
    )
