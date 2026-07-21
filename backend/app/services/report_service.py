"""Professional PDF evidence report generation using ReportLab, matplotlib, and seaborn."""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

import matplotlib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch, cm
from reportlab.platypus import (
    HRFlowable, Image, PageBreak, Paragraph,
    SimpleDocTemplate, Spacer, Table, TableStyle,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

matplotlib.use("Agg")
logger = logging.getLogger(__name__)

# ── Colour palette ────────────────────────────────────────────────────────
C_NAVY    = colors.HexColor("#0D1B2A")
C_BLUE    = colors.HexColor("#1565C0")
C_LBLUE   = colors.HexColor("#1E88E5")
C_ACCENT  = colors.HexColor("#42A5F5")
C_GOOD    = colors.HexColor("#2E7D32")
C_MOD     = colors.HexColor("#F57C00")
C_POOR    = colors.HexColor("#C62828")
C_LIGHT   = colors.HexColor("#E3F2FD")
C_GREY    = colors.HexColor("#ECEFF1")
C_DKGREY  = colors.HexColor("#546E7A")
C_WHITE   = colors.white


def _aqi_category(aqi: float) -> str:
    if aqi <= 50:   return "Good"
    if aqi <= 100:  return "Satisfactory"
    if aqi <= 200:  return "Moderate"
    if aqi <= 300:  return "Poor"
    if aqi <= 400:  return "Very Poor"
    return "Severe"


def _aqi_color(aqi: float):
    if aqi <= 100:  return C_GOOD
    if aqi <= 200:  return C_MOD
    return C_POOR


# ── Page template with header/footer ─────────────────────────────────────
def _make_page_template(canvas, doc, ward_name: str, report_date: str):
    canvas.saveState()
    w, h = A4

    # Top header bar
    canvas.setFillColor(C_NAVY)
    canvas.rect(0, h - 0.65 * inch, w, 0.65 * inch, fill=1, stroke=0)
    canvas.setFillColor(C_WHITE)
    canvas.setFont("Helvetica-Bold", 9)
    canvas.drawString(0.4 * inch, h - 0.38 * inch, "URBAN AIR QUALITY INTELLIGENCE & INTERVENTION SYSTEM")
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(w - 0.4 * inch, h - 0.38 * inch, f"Ward: {ward_name}  |  {report_date}")

    # Bottom footer bar
    canvas.setFillColor(C_NAVY)
    canvas.rect(0, 0, w, 0.45 * inch, fill=1, stroke=0)
    canvas.setFillColor(C_WHITE)
    canvas.setFont("Helvetica", 7.5)
    canvas.drawString(0.4 * inch, 0.16 * inch, "CONFIDENTIAL — For Government Use Only")
    canvas.drawCentredString(w / 2, 0.16 * inch, "Air Quality Evidence Report")
    canvas.drawRightString(w - 0.4 * inch, 0.16 * inch, f"Page {doc.page}")

    canvas.restoreState()


class ReportGenerator:
    """Generate professional A4 PDF evidence reports."""

    def __init__(self) -> None:
        self._output_dir = Path("./reports")
        self._output_dir.mkdir(parents=True, exist_ok=True)
        self._tmp = Path("./reports/temp_images")
        self._tmp.mkdir(parents=True, exist_ok=True)

    # ── Public API ────────────────────────────────────────────────────
    async def generate_evidence_report(
        self,
        ward_id: str,
        db: AsyncSession,
        days_back: int = 30,
        include_predictions: bool = True,
        include_health_impact: bool = True,
        include_root_cause: bool = True,
    ) -> str:
        from app.models import AQIData, ConstructionSite, Industry, PredictionData

        cutoff = datetime.now(timezone.utc) - timedelta(days=days_back)
        result = await db.execute(
            select(AQIData)
            .where(AQIData.ward_id == ward_id, AQIData.timestamp >= cutoff)
            .order_by(AQIData.timestamp.desc())
        )
        aqi_records = result.scalars().all()
        if not aqi_records:
            raise ValueError(f"No AQI data for ward '{ward_id}' in the past {days_back} days")

        ind_result = await db.execute(select(Industry).where(Industry.ward_id == ward_id))
        industries = ind_result.scalars().all()

        con_result = await db.execute(
            select(ConstructionSite).where(
                ConstructionSite.ward_id == ward_id, ConstructionSite.is_active == True
            )
        )
        construction = con_result.scalars().all()

        predictions = []
        if include_predictions:
            pred_result = await db.execute(
                select(PredictionData)
                .where(PredictionData.ward_id == ward_id)
                .order_by(PredictionData.created_at.desc())
                .limit(5)
            )
            predictions = pred_result.scalars().all()

        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        pdf_path = self._output_dir / f"AQI_Report_{ward_id}_{ts}.pdf"

        ward_name = aqi_records[0].ward_name if aqi_records else ward_id
        report_date = datetime.now().strftime("%d %B %Y")

        doc = SimpleDocTemplate(
            str(pdf_path), pagesize=A4,
            rightMargin=0.75 * inch, leftMargin=0.75 * inch,
            topMargin=0.85 * inch, bottomMargin=0.65 * inch,
            onFirstPage=lambda c, d: _make_page_template(c, d, ward_name, report_date),
            onLaterPages=lambda c, d: _make_page_template(c, d, ward_name, report_date),
        )

        story = self._build_story(
            ward_id, ward_name, aqi_records, industries, construction,
            predictions, days_back, include_root_cause, include_health_impact,
            include_predictions, report_date
        )
        doc.build(story)
        logger.info("Report generated: %s", pdf_path)
        return str(pdf_path.absolute())

    def _build_story(self, ward_id, ward_name, aqi_records, industries,
                     construction, predictions, days_back, include_root_cause,
                     include_health_impact, include_predictions, report_date):
        styles = getSampleStyleSheet()

        # Custom styles
        def S(name, **kw):
            base = kw.pop("parent", "Normal")
            return ParagraphStyle(name, parent=styles[base], **kw)

        title_s  = S("RTitle",  parent="Title",   fontSize=26, textColor=C_NAVY,   spaceAfter=4,  alignment=TA_CENTER)
        sub_s    = S("RSub",    fontSize=11,       textColor=C_DKGREY, spaceAfter=2, alignment=TA_CENTER)
        h1_s     = S("RH1",     fontSize=13,       textColor=C_BLUE,   spaceBefore=14, spaceAfter=6, fontName="Helvetica-Bold")
        h2_s     = S("RH2",     fontSize=10,       textColor=C_LBLUE,  spaceBefore=8,  spaceAfter=4, fontName="Helvetica-Bold")
        body_s   = S("RBody",   fontSize=9.5,      textColor=colors.HexColor("#212121"), leading=15, spaceAfter=6)
        label_s  = S("RLabel",  fontSize=8,        textColor=C_DKGREY, spaceAfter=2)
        small_s  = S("RSmall",  fontSize=8,        textColor=C_DKGREY)
        bold_s   = S("RBold",   fontSize=9.5,      fontName="Helvetica-Bold", textColor=C_NAVY)
        right_s  = S("RRight",  fontSize=8,        alignment=TA_RIGHT, textColor=C_DKGREY)

        story = []
        current_aqi = aqi_records[0].aqi_value
        avg_aqi = float(np.mean([r.aqi_value for r in aqi_records]))
        max_aqi = max(r.aqi_value for r in aqi_records)
        min_aqi = min(r.aqi_value for r in aqi_records)
        aqi_cat = _aqi_category(current_aqi)
        aqi_col = _aqi_color(current_aqi)

        # ── COVER PAGE ────────────────────────────────────────────────
        story += [
            Spacer(1, 0.4 * inch),
            Paragraph("AIR QUALITY EVIDENCE REPORT", title_s),
            Paragraph(f"{ward_name} Ward", S("CWard", fontSize=18, textColor=C_LBLUE, alignment=TA_CENTER, spaceAfter=4)),
            Paragraph(f"Analysis Period: {days_back}-Day Monitoring Cycle", sub_s),
            Paragraph(f"Report Date: {report_date}  |  Ward ID: {ward_id}", sub_s),
            Spacer(1, 0.25 * inch),
            HRFlowable(width="100%", thickness=2, color=C_BLUE, spaceAfter=12),
        ]

        # KPI summary boxes (4 across)
        kpi_data = [
            ["Current AQI", f"Avg AQI ({days_back}d)", "Peak AQI", "AQI Status"],
            [f"{current_aqi:.0f}", f"{avg_aqi:.0f}", f"{max_aqi:.0f}", aqi_cat],
        ]
        kpi_table = Table(kpi_data, colWidths=[1.55 * inch] * 4)
        kpi_table.setStyle(TableStyle([
            ("BACKGROUND",   (0, 0), (-1, 0), C_NAVY),
            ("TEXTCOLOR",    (0, 0), (-1, 0), C_WHITE),
            ("FONTNAME",     (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",     (0, 0), (-1, 0), 8),
            ("BACKGROUND",   (0, 1), (-1, 1), C_LIGHT),
            ("FONTNAME",     (0, 1), (-1, 1), "Helvetica-Bold"),
            ("FONTSIZE",     (0, 1), (-1, 1), 18),
            ("TEXTCOLOR",    (0, 1), (2, 1), C_NAVY),
            ("TEXTCOLOR",    (3, 1), (3, 1), aqi_col),
            ("ALIGN",        (0, 0), (-1, -1), "CENTER"),
            ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
            ("ROWBACKGROUNDS",(0, 1), (-1, 1), [C_LIGHT]),
            ("TOPPADDING",   (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING",(0, 0), (-1, -1), 8),
            ("BOX",          (0, 0), (-1, -1), 1, C_ACCENT),
            ("INNERGRID",    (0, 0), (-1, -1), 0.5, C_ACCENT),
            ("ROUNDEDCORNERS", [4]),
        ]))
        story += [kpi_table, Spacer(1, 0.2 * inch)]

        # Info grid: report type, industries, construction
        info_data = [
            ["Report Type", "Compliance & AQI Evidence"],
            ["Ward",         f"{ward_name} ({ward_id})"],
            ["Industries",   f"{len(industries)} units identified"],
            ["Construction", f"{len(construction)} active sites"],
            ["Data Points",  f"{len(aqi_records)} readings"],
        ]
        info_table = Table(info_data, colWidths=[1.6 * inch, 4.6 * inch])
        info_table.setStyle(TableStyle([
            ("FONTNAME",     (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE",     (0, 0), (-1, -1), 9),
            ("TEXTCOLOR",    (0, 0), (0, -1), C_BLUE),
            ("TEXTCOLOR",    (1, 0), (1, -1), C_NAVY),
            ("ROWBACKGROUNDS",(0, 0), (-1, -1), [C_GREY, C_WHITE]),
            ("TOPPADDING",   (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING",(0, 0), (-1, -1), 5),
            ("LEFTPADDING",  (0, 0), (-1, -1), 8),
            ("BOX",          (0, 0), (-1, -1), 0.5, C_ACCENT),
            ("INNERGRID",    (0, 0), (-1, -1), 0.3, colors.HexColor("#BBDEFB")),
        ]))
        story += [info_table, PageBreak()]

        # ── SECTION 1: EXECUTIVE SUMMARY ─────────────────────────────
        story.append(Paragraph("1. Executive Summary", h1_s))
        story.append(HRFlowable(width="100%", thickness=1, color=C_ACCENT, spaceAfter=8))

        high_days = sum(1 for r in aqi_records if r.aqi_value > 200)
        severe_days = sum(1 for r in aqi_records if r.aqi_value > 300)
        trend_direction = "deteriorating" if aqi_records[0].aqi_value > avg_aqi * 1.05 else \
                          "improving" if aqi_records[0].aqi_value < avg_aqi * 0.95 else "stable"

        summary = (
            f"This report presents a comprehensive analysis of air quality conditions in <b>{ward_name}</b> "
            f"ward over the past <b>{days_back} days</b>. The current Air Quality Index (AQI) is recorded at "
            f"<b>{current_aqi:.0f}</b>, classified as <b>{aqi_cat}</b> under the National Air Quality Index scale. "
            f"The {days_back}-day monitoring data reveals an average AQI of <b>{avg_aqi:.0f}</b>, with a "
            f"maximum recorded peak of <b>{max_aqi:.0f}</b> and a minimum of <b>{min_aqi:.0f}</b>. "
            f"The current trend is <b>{trend_direction}</b> relative to the monitoring period average.<br/><br/>"
            f"Over the analysis period, air quality exceeded the <b>Moderate</b> threshold (AQI &gt; 200) on "
            f"<b>{high_days}</b> occasion(s), with <b>{severe_days}</b> instance(s) classified as Severe "
            f"(AQI &gt; 300). A total of <b>{len(industries)}</b> industrial unit(s) and "
            f"<b>{len(construction)}</b> active construction site(s) have been identified as significant "
            f"pollution contributors in this ward. Immediate and sustained government intervention is "
            f"recommended to address the identified sources and protect public health."
        )
        story += [Paragraph(summary, body_s), Spacer(1, 0.15 * inch)]

        # ── SECTION 2: AQI TREND ─────────────────────────────────────
        story.append(Paragraph("2. Air Quality Trend Analysis", h1_s))
        story.append(HRFlowable(width="100%", thickness=1, color=C_ACCENT, spaceAfter=8))

        chart_path = self._create_trend_chart(aqi_records, ward_name)
        story += [
            Image(str(chart_path), width=6.2 * inch, height=3.4 * inch),
            Spacer(1, 0.1 * inch),
            Paragraph(
                f"<i>Figure 1: AQI trend for {ward_name} over the {days_back}-day analysis period. "
                f"Dashed reference lines indicate AQI threshold levels.</i>", small_s
            ),
            Spacer(1, 0.2 * inch),
        ]

        # Pollutant table
        story.append(Paragraph("2.1 Pollutant Concentration Summary", h2_s))
        pm25_avg = float(np.mean([r.pm25 for r in aqi_records if r.pm25]))
        pm10_avg = float(np.mean([r.pm10 for r in aqi_records if r.pm10]))
        no2_avg  = float(np.mean([r.no2  for r in aqi_records if r.no2]))
        so2_avg  = float(np.mean([r.so2  for r in aqi_records if r.so2]))
        co_avg   = float(np.mean([r.co   for r in aqi_records if r.co]))

        safe_limits = {"PM2.5": 60, "PM10": 100, "NO₂": 80, "SO₂": 80, "CO": 2}
        poll_data = [["Pollutant", f"Avg ({days_back}d) μg/m³", "CPCB Safe Limit", "Status"]]
        for name, val, limit in [("PM2.5", pm25_avg, 60), ("PM10", pm10_avg, 100),
                                   ("NO₂", no2_avg, 80), ("SO₂", so2_avg, 80), ("CO (mg/m³)", co_avg, 2)]:
            ratio = val / limit if limit else 0
            status = "✓ Within Limit" if ratio <= 1.0 else f"⚠ {ratio:.1f}× Limit"
            poll_data.append([name, f"{val:.1f}", f"{limit}", status])

        poll_table = Table(poll_data, colWidths=[1.4*inch, 1.6*inch, 1.6*inch, 1.6*inch])
        poll_table.setStyle(TableStyle([
            ("BACKGROUND",   (0, 0), (-1, 0), C_BLUE),
            ("TEXTCOLOR",    (0, 0), (-1, 0), C_WHITE),
            ("FONTNAME",     (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",     (0, 0), (-1, -1), 9),
            ("ROWBACKGROUNDS",(0, 1), (-1, -1), [C_GREY, C_WHITE]),
            ("ALIGN",        (1, 0), (-1, -1), "CENTER"),
            ("TOPPADDING",   (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING",(0, 0), (-1, -1), 6),
            ("LEFTPADDING",  (0, 0), (-1, -1), 8),
            ("BOX",          (0, 0), (-1, -1), 0.5, C_ACCENT),
            ("INNERGRID",    (0, 0), (-1, -1), 0.3, colors.HexColor("#BBDEFB")),
        ]))
        story += [poll_table, Spacer(1, 0.2 * inch)]

        # ── SECTION 3: ROOT CAUSE ─────────────────────────────────────
        if include_root_cause:
            story.append(PageBreak())
            story.append(Paragraph("3. Root Cause Analysis", h1_s))
            story.append(HRFlowable(width="100%", thickness=1, color=C_ACCENT, spaceAfter=8))

            story.append(Paragraph("3.1 Industrial Pollution Sources", h2_s))
            if industries:
                ind_data = [["#", "Industry Name", "Type", "Pollution %", "Category", "Last Inspection"]]
                for idx, ind in enumerate(industries[:12], 1):
                    last_insp = ind.last_inspection.strftime("%d %b %Y") if ind.last_inspection else "N/A"
                    cat_color = {"critical": C_POOR, "high": C_MOD, "medium": C_NAVY, "low": C_GOOD}
                    ind_data.append([
                        str(idx),
                        ind.name[:28],
                        ind.industry_type[:18],
                        f"{ind.pollution_contribution or 0:.1f}%",
                        (ind.emission_category or "N/A").upper(),
                        last_insp,
                    ])
                ind_table = Table(ind_data, colWidths=[0.3*inch, 1.7*inch, 1.3*inch, 0.8*inch, 0.9*inch, 1.1*inch])
                ind_table.setStyle(TableStyle([
                    ("BACKGROUND",   (0, 0), (-1, 0), C_NAVY),
                    ("TEXTCOLOR",    (0, 0), (-1, 0), C_WHITE),
                    ("FONTNAME",     (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE",     (0, 0), (-1, -1), 8),
                    ("ROWBACKGROUNDS",(0, 1), (-1, -1), [C_GREY, C_WHITE]),
                    ("ALIGN",        (3, 0), (4, -1), "CENTER"),
                    ("TOPPADDING",   (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING",(0, 0), (-1, -1), 5),
                    ("LEFTPADDING",  (0, 0), (-1, -1), 5),
                    ("BOX",          (0, 0), (-1, -1), 0.5, C_ACCENT),
                    ("INNERGRID",    (0, 0), (-1, -1), 0.3, colors.HexColor("#BBDEFB")),
                ]))
                story += [
                    ind_table,
                    Spacer(1, 0.06 * inch),
                    Paragraph(
                        f"<i>Table: {len(industries)} industrial unit(s) identified in {ward_name}. "
                        f"Units classified as 'Critical' or 'High' require immediate inspection.</i>", small_s
                    ),
                    Spacer(1, 0.15 * inch),
                ]
                # Pollution contribution bar chart
                if len(industries) > 1:
                    chart2 = self._create_industry_chart(industries, ward_name)
                    story += [
                        Image(str(chart2), width=6.0 * inch, height=3.0 * inch),
                        Paragraph(f"<i>Figure 2: Industrial pollution contribution (%) in {ward_name}.</i>", small_s),
                        Spacer(1, 0.15 * inch),
                    ]
            else:
                story += [
                    Paragraph(
                        f"No registered industrial units were identified in {ward_name} ward "
                        f"for the analysis period.", body_s
                    ),
                    Spacer(1, 0.1 * inch),
                ]

            story.append(Paragraph("3.2 Construction Site Activity", h2_s))
            if construction:
                con_data = [["#", "Site Name", "Contractor", "Dust Level", "Start Date", "End Date"]]
                for idx, cs in enumerate(construction[:8], 1):
                    con_data.append([
                        str(idx),
                        cs.name[:28],
                        (cs.contractor or "Unknown")[:22],
                        (cs.dust_emission_level or "N/A").upper(),
                        cs.start_date.strftime("%d %b %Y") if cs.start_date else "N/A",
                        cs.end_date.strftime("%d %b %Y")   if cs.end_date   else "N/A",
                    ])
                con_table = Table(con_data, colWidths=[0.3*inch, 1.7*inch, 1.5*inch, 0.8*inch, 0.9*inch, 0.9*inch])
                con_table.setStyle(TableStyle([
                    ("BACKGROUND",   (0, 0), (-1, 0), C_NAVY),
                    ("TEXTCOLOR",    (0, 0), (-1, 0), C_WHITE),
                    ("FONTNAME",     (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE",     (0, 0), (-1, -1), 8),
                    ("ROWBACKGROUNDS",(0, 1), (-1, -1), [C_GREY, C_WHITE]),
                    ("TOPPADDING",   (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING",(0, 0), (-1, -1), 5),
                    ("LEFTPADDING",  (0, 0), (-1, -1), 5),
                    ("BOX",          (0, 0), (-1, -1), 0.5, C_ACCENT),
                    ("INNERGRID",    (0, 0), (-1, -1), 0.3, colors.HexColor("#BBDEFB")),
                ]))
                story += [con_table, Spacer(1, 0.15 * inch)]
            else:
                story += [Paragraph(f"No active construction sites recorded in {ward_name}.", body_s), Spacer(1, 0.1 * inch)]

        # ── SECTION 4: HEALTH IMPACT ──────────────────────────────────
        if include_health_impact:
            story.append(PageBreak())
            story.append(Paragraph("4. Health Impact Assessment", h1_s))
            story.append(HRFlowable(width="100%", thickness=1, color=C_ACCENT, spaceAfter=8))

            high_days = sum(1 for r in aqi_records if r.aqi_value > 200)
            severe_days = sum(1 for r in aqi_records if r.aqi_value > 300)
            satisfactory = sum(1 for r in aqi_records if r.aqi_value <= 100)

            health_text = (
                f"Over the <b>{days_back}-day</b> monitoring period, air quality in <b>{ward_name}</b> "
                f"exceeded the <b>Moderate</b> threshold (AQI &gt; 200) on <b>{high_days}</b> occasion(s), "
                f"representing <b>{100*high_days/len(aqi_records):.0f}%</b> of all readings. "
                f"Severe pollution events (AQI &gt; 300) were recorded on <b>{severe_days}</b> occasion(s). "
                f"Air quality was within satisfactory levels (AQI ≤ 100) for <b>{satisfactory}</b> readings "
                f"({100*satisfactory/len(aqi_records):.0f}% of the period).<br/><br/>"
                f"Prolonged exposure to elevated PM2.5 and PM10 concentrations significantly increases the "
                f"risk of acute and chronic respiratory diseases, cardiovascular conditions, and premature "
                f"mortality. Vulnerable populations — including <b>children under 12</b>, "
                f"<b>adults over 60</b>, pregnant women, and individuals with pre-existing conditions such as "
                f"asthma and COPD — face disproportionately higher risks."
            )
            story += [Paragraph(health_text, body_s), Spacer(1, 0.15 * inch)]

            # Health impact summary table
            hi_data = [
                ["Population Group",   "Risk Level",    "Recommended Precaution"],
                ["General Population", _aqi_category(avg_aqi), "Limit prolonged outdoor activity on high-AQI days"],
                ["Children (< 12 yrs)","High",           "Restrict outdoor play; keep schools informed"],
                ["Elderly (> 60 yrs)", "High",           "Monitor for respiratory symptoms; limit exertion"],
                ["Respiratory Conditions","Very High",   "Keep inhaler accessible; consult doctor if worsening"],
                ["Pregnant Women",     "High",           "Minimise outdoor exposure; wear N95 mask if outdoors"],
            ]
            hi_table = Table(hi_data, colWidths=[1.8*inch, 1.2*inch, 3.2*inch])
            hi_table.setStyle(TableStyle([
                ("BACKGROUND",   (0, 0), (-1, 0), C_BLUE),
                ("TEXTCOLOR",    (0, 0), (-1, 0), C_WHITE),
                ("FONTNAME",     (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE",     (0, 0), (-1, -1), 8.5),
                ("ROWBACKGROUNDS",(0, 1), (-1, -1), [C_GREY, C_WHITE]),
                ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING",   (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING",(0, 0), (-1, -1), 6),
                ("LEFTPADDING",  (0, 0), (-1, -1), 8),
                ("BOX",          (0, 0), (-1, -1), 0.5, C_ACCENT),
                ("INNERGRID",    (0, 0), (-1, -1), 0.3, colors.HexColor("#BBDEFB")),
            ]))
            story += [hi_table, Spacer(1, 0.2 * inch)]

        # ── SECTION 5: PREDICTIONS ────────────────────────────────────
        if include_predictions and predictions:
            story.append(Paragraph("5. ML-Based AQI Forecasts", h1_s))
            story.append(HRFlowable(width="100%", thickness=1, color=C_ACCENT, spaceAfter=8))
            pred_data = [["Forecast Horizon", "Predicted AQI", "Category", "Confidence", "Model"]]
            for p in predictions[:5]:
                pred_data.append([
                    p.prediction_horizon,
                    f"{p.predicted_aqi:.1f}",
                    _aqi_category(p.predicted_aqi),
                    f"{(p.confidence or 0) * 100:.0f}%",
                    p.model_used or "N/A",
                ])
            pred_table = Table(pred_data, colWidths=[1.2*inch, 1.2*inch, 1.4*inch, 1.0*inch, 1.4*inch])
            pred_table.setStyle(TableStyle([
                ("BACKGROUND",   (0, 0), (-1, 0), C_NAVY),
                ("TEXTCOLOR",    (0, 0), (-1, 0), C_WHITE),
                ("FONTNAME",     (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE",     (0, 0), (-1, -1), 9),
                ("ROWBACKGROUNDS",(0, 1), (-1, -1), [C_GREY, C_WHITE]),
                ("ALIGN",        (1, 0), (-1, -1), "CENTER"),
                ("TOPPADDING",   (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING",(0, 0), (-1, -1), 6),
                ("LEFTPADDING",  (0, 0), (-1, -1), 8),
                ("BOX",          (0, 0), (-1, -1), 0.5, C_ACCENT),
                ("INNERGRID",    (0, 0), (-1, -1), 0.3, colors.HexColor("#BBDEFB")),
            ]))
            story += [pred_table, Spacer(1, 0.2 * inch)]

        # ── SECTION 6: RECOMMENDED ACTIONS ───────────────────────────
        story.append(PageBreak())
        story.append(Paragraph("6. Recommended Government Interventions", h1_s))
        story.append(HRFlowable(width="100%", thickness=1, color=C_ACCENT, spaceAfter=8))

        story.append(Paragraph("6.1 Immediate Actions (0–7 days)", h2_s))
        imm = []
        if any(r.aqi_value > 200 for r in aqi_records[:5]):
            imm.append("Issue public health advisory and distribute N95 masks in high-risk zones")
            imm.append("Temporarily restrict operations of critical/high-emission industrial units")
        if construction:
            high_sites = [c.name for c in construction if c.dust_emission_level == "high"]
            if high_sites:
                imm.append(f"Enforce mandatory dust suppression at: {', '.join(high_sites[:2])}")
        imm.append("Intensify monitoring frequency at existing AQI sensor stations")
        for a in imm:
            story.append(Paragraph(f"• {a}", body_s))
        story.append(Spacer(1, 0.1 * inch))

        story.append(Paragraph("6.2 Short-term Measures (1–4 weeks)", h2_s))
        short = [
            "Conduct emergency compliance inspection of all critical-category industries",
            "Deploy mobile air quality monitoring units at identified pollution hotspots",
            "Implement vehicle emission checks at major entry/exit points of the ward",
            "Coordinate with construction site operators to enforce CPCB dust norms",
        ]
        for a in short:
            story.append(Paragraph(f"• {a}", body_s))
        story.append(Spacer(1, 0.1 * inch))

        story.append(Paragraph("6.3 Long-term Interventions (1–6 months)", h2_s))
        long_ = [
            "Expand permanent air quality monitoring network with real-time public dashboards",
            "Implement strict industrial emission standards with quarterly compliance audits",
            "Promote public transit and green mobility to reduce vehicular emissions",
            "Launch urban greening programme — minimum 500 trees per km² in industrial zones",
        ]
        for a in long_:
            story.append(Paragraph(f"• {a}", body_s))
        story.append(Spacer(1, 0.2 * inch))

        # ── SECTION 7: COMPLIANCE STATUS ─────────────────────────────
        story.append(Paragraph("7. Regulatory Compliance Summary", h1_s))
        story.append(HRFlowable(width="100%", thickness=1, color=C_ACCENT, spaceAfter=8))
        comp_data = [
            ["Standard",          "Permissible Limit", f"Ward Average ({days_back}d)", "Status"],
            ["CPCB PM2.5 Annual",  "40 μg/m³",  f"{pm25_avg:.1f} μg/m³", "✓" if pm25_avg <= 40 else "✗ EXCEEDED"],
            ["CPCB PM10 Annual",   "60 μg/m³",  f"{pm10_avg:.1f} μg/m³", "✓" if pm10_avg <= 60 else "✗ EXCEEDED"],
            ["WHO PM2.5 Annual",   "15 μg/m³",  f"{pm25_avg:.1f} μg/m³", "✓" if pm25_avg <= 15 else "✗ EXCEEDED"],
            ["WHO PM10 Annual",    "45 μg/m³",  f"{pm10_avg:.1f} μg/m³", "✓" if pm10_avg <= 45 else "✗ EXCEEDED"],
        ]
        comp_table = Table(comp_data, colWidths=[2.0*inch, 1.4*inch, 1.8*inch, 1.0*inch])
        comp_table.setStyle(TableStyle([
            ("BACKGROUND",   (0, 0), (-1, 0), C_BLUE),
            ("TEXTCOLOR",    (0, 0), (-1, 0), C_WHITE),
            ("FONTNAME",     (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",     (0, 0), (-1, -1), 9),
            ("ROWBACKGROUNDS",(0, 1), (-1, -1), [C_GREY, C_WHITE]),
            ("ALIGN",        (1, 0), (-1, -1), "CENTER"),
            ("TOPPADDING",   (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING",(0, 0), (-1, -1), 6),
            ("LEFTPADDING",  (0, 0), (-1, -1), 8),
            ("BOX",          (0, 0), (-1, -1), 0.5, C_ACCENT),
            ("INNERGRID",    (0, 0), (-1, -1), 0.3, colors.HexColor("#BBDEFB")),
        ]))
        story += [comp_table, Spacer(1, 0.2 * inch)]

        # ── CLOSING ───────────────────────────────────────────────────
        story.append(HRFlowable(width="100%", thickness=1, color=C_ACCENT, spaceAfter=8))
        story.append(Paragraph(
            f"<i>This report was generated automatically by the Urban Air Quality Intelligence & Intervention System "
            f"on {datetime.now().strftime('%d %B %Y at %H:%M')}. Data is based on {len(aqi_records)} sensor "
            f"readings over the {days_back}-day analysis period. For queries, contact the Municipal AQI Cell.</i>",
            small_s
        ))

        return story

    # ── Chart generators ─────────────────────────────────────────────
    def _create_trend_chart(self, aqi_records: list, ward_name: str) -> Path:
        data = [{"timestamp": r.timestamp, "aqi": r.aqi_value} for r in reversed(aqi_records)]
        df = pd.DataFrame(data)

        sns.set_style("whitegrid")
        fig, ax = plt.subplots(figsize=(9, 4))

        # Fill under line by AQI level
        x = df["timestamp"]
        y = df["aqi"]
        ax.fill_between(x, y, alpha=0.12, color="#1565C0")
        ax.plot(x, y, color="#1565C0", linewidth=2, zorder=3)

        # 7-day rolling average
        if len(df) >= 7:
            roll = df["aqi"].rolling(7, min_periods=1).mean()
            ax.plot(x, roll, color="#F57C00", linewidth=1.5, linestyle="--", label="7-day avg", zorder=4)

        # Category bands
        thresholds = [(50,"Good","#2E7D32"), (100,"Satisfactory","#558B2F"),
                      (200,"Moderate","#F57C00"), (300,"Poor","#C62828"), (400,"Very Poor","#880E4F")]
        prev = 0
        for thr, lbl, col in thresholds:
            ax.axhspan(prev, thr, alpha=0.04, color=col, zorder=0)
            ax.axhline(y=thr, color=col, linewidth=0.8, linestyle=":", alpha=0.7)
            prev = thr

        ax.set_xlabel("Date", fontsize=10)
        ax.set_ylabel("AQI", fontsize=10)
        ax.set_title(f"AQI Trend — {ward_name}", fontsize=12, fontweight="bold", color="#0D1B2A")
        ax.legend(fontsize=9, loc="upper left")
        ax.grid(True, alpha=0.3)
        plt.xticks(rotation=35, ha="right", fontsize=8)
        plt.tight_layout()

        path = self._tmp / f"trend_{datetime.now().timestamp():.0f}.png"
        fig.savefig(str(path), dpi=150, bbox_inches="tight", facecolor="white")
        plt.close(fig)
        return path

    def _create_industry_chart(self, industries: list, ward_name: str) -> Path:
        names = [i.name[:20] for i in industries[:8]]
        values = [i.pollution_contribution or 0 for i in industries[:8]]
        cat_colors = {"critical": "#C62828", "high": "#E65100",
                      "medium": "#F9A825", "low": "#2E7D32", None: "#546E7A"}
        bar_colors = [cat_colors.get(i.emission_category, "#546E7A") for i in industries[:8]]

        fig, ax = plt.subplots(figsize=(8.5, 3.5))
        bars = ax.barh(names, values, color=bar_colors, edgecolor="white", height=0.6)
        for bar, val in zip(bars, values):
            ax.text(bar.get_width() + 0.3, bar.get_y() + bar.get_height()/2,
                    f"{val:.1f}%", va="center", fontsize=8, color="#0D1B2A")
        ax.set_xlabel("Pollution Contribution (%)", fontsize=9)
        ax.set_title(f"Industrial Pollution Contribution — {ward_name}", fontsize=11,
                     fontweight="bold", color="#0D1B2A")
        ax.invert_yaxis()
        ax.grid(axis="x", alpha=0.3)
        plt.tight_layout()

        path = self._tmp / f"industry_{datetime.now().timestamp():.0f}.png"
        fig.savefig(str(path), dpi=150, bbox_inches="tight", facecolor="white")
        plt.close(fig)
        return path
