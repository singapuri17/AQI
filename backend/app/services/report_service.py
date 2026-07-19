"""PDF evidence report generation using ReportLab, matplotlib, and seaborn."""

from __future__ import annotations

import io
import logging
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import matplotlib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Image,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

matplotlib.use("Agg")  # Non-GUI backend for server environments

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helper: AQI category
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Report Generator
# ---------------------------------------------------------------------------


class ReportGenerator:
    """Generate comprehensive PDF evidence reports with charts and tables."""

    def __init__(self) -> None:
        self._output_dir = Path("./reports")
        self._output_dir.mkdir(parents=True, exist_ok=True)
        self._temp_images_dir = Path("./reports/temp_images")
        self._temp_images_dir.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def generate_evidence_report(
        self,
        ward_id: str,
        db: AsyncSession,
        days_back: int = 30,
        include_predictions: bool = True,
        include_health_impact: bool = True,
        include_root_cause: bool = True,
    ) -> str:
        """Generate a comprehensive PDF evidence report for a ward.

        Args:
            ward_id: The ward identifier string.
            db: Async SQLAlchemy session.
            days_back: Number of days of historical data to include.
            include_predictions: Whether to include ML predictions.
            include_health_impact: Whether to include health impact analysis.
            include_root_cause: Whether to include root cause analysis.

        Returns:
            Absolute file path of the generated PDF.

        Raises:
            Exception: If no data is found or PDF generation fails.
        """
        from app.models import AQIData, ConstructionSite, Industry, PredictionData

        # Fetch AQI history
        cutoff = datetime.now(timezone.utc) - timedelta(days=days_back)
        result = await db.execute(
            select(AQIData)
            .where(AQIData.ward_id == ward_id, AQIData.timestamp >= cutoff)
            .order_by(AQIData.timestamp.desc())
        )
        aqi_records = result.scalars().all()
        if not aqi_records:
            raise ValueError(f"No AQI data found for ward '{ward_id}' in the past {days_back} days")

        # Fetch industries
        ind_result = await db.execute(select(Industry).where(Industry.ward_id == ward_id))
        industries = ind_result.scalars().all()

        # Fetch construction sites
        con_result = await db.execute(
            select(ConstructionSite).where(
                ConstructionSite.ward_id == ward_id, ConstructionSite.is_active == True
            )
        )
        construction_sites = con_result.scalars().all()

        # Fetch predictions (if requested)
        predictions = []
        if include_predictions:
            pred_result = await db.execute(
                select(PredictionData)
                .where(PredictionData.ward_id == ward_id)
                .order_by(PredictionData.created_at.desc())
                .limit(5)
            )
            predictions = pred_result.scalars().all()

        # Build filename
        timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"AQI_Report_{ward_id}_{timestamp_str}.pdf"
        pdf_path = self._output_dir / filename

        # Create PDF
        doc = SimpleDocTemplate(
            str(pdf_path),
            pagesize=A4,
            rightMargin=0.75 * inch,
            leftMargin=0.75 * inch,
            topMargin=0.75 * inch,
            bottomMargin=0.75 * inch,
        )

        story = []
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "CustomTitle",
            parent=styles["Title"],
            fontSize=24,
            textColor=colors.HexColor("#1a237e"),
            spaceAfter=12,
        )
        heading_style = ParagraphStyle(
            "CustomHeading",
            parent=styles["Heading1"],
            fontSize=16,
            textColor=colors.HexColor("#283593"),
            spaceAfter=10,
        )

        # Title page
        story.append(Paragraph("Air Quality Evidence Report", title_style))
        story.append(Spacer(1, 0.2 * inch))

        ward_name = aqi_records[0].ward_name if aqi_records else ward_id
        story.append(Paragraph(f"<b>Ward:</b> {ward_name} ({ward_id})", styles["Normal"]))
        story.append(Paragraph(f"<b>Report Generated:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", styles["Normal"]))
        story.append(Paragraph(f"<b>Analysis Period:</b> {days_back} days", styles["Normal"]))
        story.append(Spacer(1, 0.3 * inch))

        # Executive summary (using Gemini or fallback)
        current_aqi = aqi_records[0].aqi_value
        avg_aqi = np.mean([r.aqi_value for r in aqi_records])
        max_aqi = max(r.aqi_value for r in aqi_records)
        min_aqi = min(r.aqi_value for r in aqi_records)

        story.append(Paragraph("Executive Summary", heading_style))
        summary_text = (
            f"This report presents an analysis of air quality in {ward_name} over the past {days_back} days. "
            f"The current AQI stands at <b>{current_aqi:.1f}</b> ({_aqi_category(current_aqi)}). "
            f"Over the analysis period, the average AQI was <b>{avg_aqi:.1f}</b>, with a peak of <b>{max_aqi:.1f}</b> "
            f"and a minimum of <b>{min_aqi:.1f}</b>. "
            f"A total of <b>{len(industries)}</b> industrial units and <b>{len(construction_sites)}</b> active "
            f"construction sites have been identified as contributing sources. "
            "Immediate government intervention is recommended to mitigate health risks to the local population."
        )
        story.append(Paragraph(summary_text, styles["BodyText"]))
        story.append(Spacer(1, 0.3 * inch))

        # AQI trend chart
        story.append(Paragraph("AQI Trend Analysis", heading_style))
        chart_path = self._create_trend_chart(aqi_records)
        story.append(Image(str(chart_path), width=5.5 * inch, height=3.5 * inch))
        story.append(Spacer(1, 0.2 * inch))

        # Statistical summary table
        story.append(Paragraph("Statistical Summary", heading_style))
        stats_table_data = [
            ["Metric", "Value"],
            ["Current AQI", f"{current_aqi:.1f}"],
            ["Average AQI", f"{avg_aqi:.1f}"],
            ["Maximum AQI", f"{max_aqi:.1f}"],
            ["Minimum AQI", f"{min_aqi:.1f}"],
            ["Data Points", str(len(aqi_records))],
        ]
        stats_table = Table(stats_table_data, colWidths=[3 * inch, 2 * inch])
        stats_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#5c6bc0")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                    ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, 0), 12),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 10),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ]
            )
        )
        story.append(stats_table)
        story.append(Spacer(1, 0.3 * inch))

        # Root cause analysis
        if include_root_cause:
            story.append(PageBreak())
            story.append(Paragraph("Root Cause Analysis", heading_style))
            story.append(Paragraph(f"<b>Industries:</b> {len(industries)} industrial units identified", styles["Normal"]))
            if industries:
                ind_data = [["Name", "Type", "Pollution %", "Category"]]
                for ind in industries[:10]:  # Limit to top 10
                    ind_data.append(
                        [
                            ind.name[:30],
                            ind.industry_type[:20],
                            f"{ind.pollution_contribution or 0:.1f}%",
                            ind.emission_category or "N/A",
                        ]
                    )
                ind_table = Table(ind_data, colWidths=[2 * inch, 1.5 * inch, 1 * inch, 1 * inch])
                ind_table.setStyle(
                    TableStyle(
                        [
                            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#7986cb")),
                            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                            ("FONTSIZE", (0, 0), (-1, 0), 10),
                            ("FONTSIZE", (0, 1), (-1, -1), 8),
                            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                        ]
                    )
                )
                story.append(ind_table)
            story.append(Spacer(1, 0.2 * inch))

            story.append(Paragraph(f"<b>Construction Sites:</b> {len(construction_sites)} active sites", styles["Normal"]))
            if construction_sites:
                con_data = [["Name", "Dust Level", "Contractor"]]
                for cs in construction_sites[:8]:
                    con_data.append(
                        [
                            cs.name[:30],
                            cs.dust_emission_level or "N/A",
                            (cs.contractor or "Unknown")[:25],
                        ]
                    )
                con_table = Table(con_data, colWidths=[2.5 * inch, 1.5 * inch, 2 * inch])
                con_table.setStyle(
                    TableStyle(
                        [
                            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#9fa8da")),
                            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                            ("FONTSIZE", (0, 0), (-1, 0), 10),
                            ("FONTSIZE", (0, 1), (-1, -1), 8),
                            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                        ]
                    )
                )
                story.append(con_table)
            story.append(Spacer(1, 0.3 * inch))

        # Health impact
        if include_health_impact:
            story.append(PageBreak())
            story.append(Paragraph("Health Impact Assessment", heading_style))
            high_aqi_days = sum(1 for r in aqi_records if r.aqi_value > 200)
            severe_days = sum(1 for r in aqi_records if r.aqi_value > 300)
            health_text = (
                f"Over the past {days_back} days, air quality exceeded the <b>'Moderate'</b> threshold "
                f"(AQI > 200) on <b>{high_aqi_days}</b> occasions. "
                f"Severe pollution (AQI > 300) was recorded on <b>{severe_days}</b> occasions. "
                "Prolonged exposure to such levels increases the risk of respiratory and cardiovascular "
                "diseases, particularly among vulnerable populations including children, the elderly, and "
                "individuals with pre-existing conditions."
            )
            story.append(Paragraph(health_text, styles["BodyText"]))
            story.append(Spacer(1, 0.2 * inch))

        # Predictions
        if include_predictions and predictions:
            story.append(PageBreak())
            story.append(Paragraph("AQI Predictions (ML Models)", heading_style))
            pred_data = [["Date", "Horizon", "Predicted AQI", "Confidence", "Model"]]
            for p in predictions[:5]:
                pred_data.append(
                    [
                        p.created_at.strftime("%Y-%m-%d"),
                        p.prediction_horizon,
                        f"{p.predicted_aqi:.1f}",
                        f"{(p.confidence or 0) * 100:.0f}%",
                        p.model_used or "N/A",
                    ]
                )
            pred_table = Table(pred_data, colWidths=[1.2 * inch, 0.8 * inch, 1.2 * inch, 1 * inch, 1.3 * inch])
            pred_table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#c5cae9")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.black),
                        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, 0), 10),
                        ("FONTSIZE", (0, 1), (-1, -1), 9),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ]
                )
            )
            story.append(pred_table)
            story.append(Spacer(1, 0.3 * inch))

        # Recommended actions
        story.append(PageBreak())
        story.append(Paragraph("Recommended Government Actions", heading_style))
        actions_text = (
            "<b>1. Immediate Actions:</b><br/>"
            "• Issue public health advisory for vulnerable populations<br/>"
            "• Distribute N95 masks in affected areas<br/>"
            "• Temporarily halt high-emission industrial operations<br/><br/>"
            "<b>2. Short-term Measures (1-4 weeks):</b><br/>"
            "• Enforce dust suppression norms at all construction sites<br/>"
            "• Conduct emergency inspections of industrial units<br/>"
            "• Implement vehicle emission checks in hotspot zones<br/><br/>"
            "<b>3. Long-term Interventions (1-6 months):</b><br/>"
            "• Expand air quality monitoring network<br/>"
            "• Implement industrial emission standards and compliance tracking<br/>"
            "• Promote public transport and reduce vehicular traffic<br/>"
            "• Expand urban green cover through tree plantation drives<br/>"
        )
        story.append(Paragraph(actions_text, styles["BodyText"]))
        story.append(Spacer(1, 0.2 * inch))

        # Build PDF
        doc.build(story)
        logger.info("Report generated successfully: %s", pdf_path)
        return str(pdf_path.absolute())

    # ------------------------------------------------------------------
    # Chart generation
    # ------------------------------------------------------------------

    def _create_trend_chart(self, aqi_records: list) -> Path:
        """Generate a line chart showing AQI trends over time.

        Args:
            aqi_records: List of AQIData ORM objects (ordered newest-first).

        Returns:
            Path to the saved PNG image.
        """
        # Convert to DataFrame
        data = [
            {"timestamp": r.timestamp, "aqi": r.aqi_value}
            for r in reversed(aqi_records)
        ]
        df = pd.DataFrame(data)

        # Create plot
        sns.set_style("whitegrid")
        fig, ax = plt.subplots(figsize=(8, 5))
        ax.plot(
            df["timestamp"],
            df["aqi"],
            color="#1e88e5",
            linewidth=2,
            marker="o",
            markersize=3,
        )
        ax.set_xlabel("Date", fontsize=12)
        ax.set_ylabel("AQI", fontsize=12)
        ax.set_title("Air Quality Index Trend", fontsize=14, fontweight="bold")
        ax.grid(True, alpha=0.3)

        # AQI category reference lines
        ax.axhline(y=100, color="orange", linestyle="--", linewidth=1, alpha=0.6, label="Satisfactory")
        ax.axhline(y=200, color="red", linestyle="--", linewidth=1, alpha=0.6, label="Moderate")
        ax.axhline(y=300, color="purple", linestyle="--", linewidth=1, alpha=0.6, label="Poor")
        ax.legend(loc="upper left", fontsize=9)

        plt.xticks(rotation=45, ha="right")
        plt.tight_layout()

        # Save
        chart_path = self._temp_images_dir / f"trend_{datetime.now().timestamp()}.png"
        fig.savefig(str(chart_path), dpi=150, bbox_inches="tight")
        plt.close(fig)
        return chart_path
