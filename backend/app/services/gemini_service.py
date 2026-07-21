"""Gemini AI service for generating health advice and government recommendations."""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Fallback response helpers
# ---------------------------------------------------------------------------

_FALLBACK_HEALTH_ADVICE = {
    "en": (
        "Based on the current air quality, please limit outdoor activities, "
        "wear a mask when going outside, keep windows closed, and stay hydrated. "
        "If you experience respiratory symptoms, consult a doctor promptly."
    ),
    "hi": (
        "वर्तमान वायु गुणवत्ता के आधार पर, कृपया बाहरी गतिविधियों को सीमित करें, "
        "बाहर जाते समय मास्क पहनें, खिड़कियाँ बंद रखें और पर्याप्त पानी पियें। "
        "यदि आपको सांस की समस्या हो, तो तुरंत डॉक्टर से मिलें।"
    ),
    "gu": (
        "વર્તમાન હવાની ગુણવત્તાના આધારે, કૃપા કરી બહારની પ્રવૃત્તિઓ મર્યાદિત કરો, "
        "બહાર જતી વખતે માસ્ક પહેરો, બારીઓ બંધ રાખો અને પૂરતું પાણી પીઓ. "
        "જો શ્વાસ સંબંધી લક્ષણો અનુભવો, તો તાત્કાલિક ડૉક્ટરનો સંપર્ક કરો."
    ),
}


def _fallback_health_advice(language: str) -> str:
    return _FALLBACK_HEALTH_ADVICE.get(language, _FALLBACK_HEALTH_ADVICE["en"])


# ---------------------------------------------------------------------------
# Gemini Service
# ---------------------------------------------------------------------------


class GeminiService:
    """Wrapper around the Google Generative AI SDK for domain-specific tasks.

    Falls back to rule-based responses when the API key is missing or an
    API error occurs, ensuring the system remains functional in offline
    / development environments.
    """

    def __init__(self) -> None:
        from app.config import get_settings

        settings = get_settings()
        self._api_key = settings.gemini_api_key
        self._model_name = "gemini-1.5-flash"
        self._client = None

        if self._api_key:
            try:
                import google.generativeai as genai

                genai.configure(api_key=self._api_key)
                self._client = genai.GenerativeModel(self._model_name)
                logger.info("GeminiService: client initialised with model %s", self._model_name)
            except Exception as exc:
                logger.warning("GeminiService: failed to initialise client — %s", exc)

    # ------------------------------------------------------------------
    # Internal helper
    # ------------------------------------------------------------------

    async def _generate(self, prompt: str, fallback: str) -> str:
        """Send *prompt* to Gemini and return the text response.

        Args:
            prompt: The prompt string to send to the model.
            fallback: Value to return if the API call fails.

        Returns:
            Model response text, or *fallback* on error.
        """
        if not self._client:
            return fallback
        try:
            response = self._client.generate_content(prompt)
            return response.text.strip()
        except Exception as exc:
            logger.warning("GeminiService._generate error: %s", exc)
            return fallback

    # ------------------------------------------------------------------
    # Public methods
    # ------------------------------------------------------------------

    async def generate_health_advice(
        self,
        aqi: float,
        age_category: str,
        has_respiratory: bool,
        language: str = "en",
        risk_category: str = "moderate",
    ) -> str:
        """Generate personalised health advice based on AQI and user profile.

        Args:
            aqi: Current AQI value.
            age_category: ``child``, ``adult``, or ``elderly``.
            has_respiratory: Whether the user has a respiratory condition.
            language: Response language — ``en``, ``hi``, or ``gu``.
            risk_category: Pre-computed risk category string.

        Returns:
            Human-readable health advice text.
        """
        lang_map = {"en": "English", "hi": "Hindi", "gu": "Gujarati"}
        lang_full = lang_map.get(language, "English")

        respiratory_note = (
            "The person has a pre-existing respiratory condition (e.g. asthma)."
            if has_respiratory
            else "No known respiratory conditions."
        )

        prompt = (
            f"You are an expert public health advisor. "
            f"The current Air Quality Index (AQI) is {aqi:.0f} (risk level: {risk_category}). "
            f"The user is a {age_category}. {respiratory_note} "
            f"Provide a concise, actionable health advisory in {lang_full}. "
            f"Include: what activities to avoid, what protective measures to take, "
            f"and when to seek medical help. Keep it under 150 words and in a friendly tone."
        )

        fallback = _fallback_health_advice(language)
        return await self._generate(prompt, fallback)

    async def generate_government_recommendations(
        self,
        aqi_data: list[dict[str, Any]],
        hotspots: list[dict] | None = None,
        industries: list[dict] | None = None,
    ) -> list[dict]:
        """Generate prioritised government policy recommendations.

        Args:
            aqi_data: List of dicts with ward_id, ward_name, aqi, pm25, pm10.
            hotspots: Optional list of detected hotspot dicts.
            industries: Optional list of industry dicts.

        Returns:
            List of recommendation dicts with keys: priority, action, ward,
            expected_impact, timeline.
        """
        if not aqi_data:
            return self._fallback_recommendations()

        # Build a compact summary for the prompt
        high_pollution_wards = sorted(
            aqi_data, key=lambda x: x.get("aqi", 0), reverse=True
        )[:5]
        ward_summary = "; ".join(
            f"{w.get('ward_name', w.get('ward_id'))} (AQI {w.get('aqi', 'N/A'):.0f})"
            for w in high_pollution_wards
        )

        prompt = (
            "You are an urban air quality policy advisor. "
            f"The five most polluted wards are: {ward_summary}. "
            "Generate 5 specific, actionable government interventions. "
            "Format each as: PRIORITY: <critical/high/medium> | ACTION: <action> | "
            "WARD: <ward or 'all'> | IMPACT: <expected outcome> | TIMELINE: <timeframe>. "
            "Separate each recommendation with a newline."
        )

        fallback_text = self._format_fallback_recommendations(high_pollution_wards)
        raw = await self._generate(prompt, fallback_text)
        return self._parse_recommendations(raw, high_pollution_wards)

    async def generate_report_summary(
        self,
        ward_data: dict,
        trends: dict,
        hotspots: list[dict],
    ) -> str:
        """Generate an executive summary narrative for an evidence report.

        Args:
            ward_data: Dict with ward_id, ward_name, current_aqi, etc.
            trends: Dict with avg_aqi, max_aqi, min_aqi, trend_direction.
            hotspots: List of hotspot dicts for the ward.

        Returns:
            Multi-paragraph narrative suitable for a PDF report.
        """
        ward_name = ward_data.get("ward_name", ward_data.get("ward_id", "unknown"))
        current_aqi = ward_data.get("current_aqi", "N/A")
        avg_aqi = trends.get("avg_aqi", "N/A")
        trend_dir = trends.get("trend_direction", "stable")
        hotspot_count = len(hotspots)

        prompt = (
            f"Write a professional executive summary for an air quality evidence report "
            f"for {ward_name}. "
            f"Current AQI: {current_aqi}. 30-day average AQI: {avg_aqi}. "
            f"Trend: {trend_dir}. Active hotspot clusters: {hotspot_count}. "
            "The summary should cover: current situation, key concerns, primary pollution "
            "sources, health implications, and urgency of government action. "
            "Use formal language suitable for a government report. Limit to 200 words."
        )

        fallback = (
            f"Executive Summary\n\n"
            f"This report presents an analysis of air quality in {ward_name}. "
            f"The current AQI stands at {current_aqi}, with a 30-day average of {avg_aqi}. "
            f"Air quality trends are {trend_dir}. "
            f"A total of {hotspot_count} pollution hotspot cluster(s) have been identified. "
            "Immediate government intervention is recommended to mitigate health risks to "
            "the local population, particularly vulnerable groups including children and "
            "the elderly."
        )
        return await self._generate(prompt, fallback)

    async def generate_ward_analysis(
        self,
        ward_name: str,
        current_aqi: float,
        avg_aqi_7d: float,
        pm25: float,
        pm10: float,
        no2: float,
        industries: str,        # comma-separated names/types
        construction_sites: str, # comma-separated names/dust levels
        industry_details: list | None = None,   # list of dicts with name,type,contribution
        construction_details: list | None = None, # list of dicts with name,dust
    ) -> tuple[str, list[dict]]:
        """Generate deep ward-specific analysis and recommended actions.

        Returns:
            Tuple of (analysis_text, list_of_action_dicts)
        """
        def _aqi_cat(v: float) -> str:
            if v <= 50:   return "Good"
            if v <= 100:  return "Satisfactory"
            if v <= 200:  return "Moderate"
            if v <= 300:  return "Poor"
            if v <= 400:  return "Very Poor"
            return "Severe"

        ind_details = industry_details or []
        con_details = construction_details or []
        n_ind = len(ind_details)
        n_con = len(con_details)
        aqi_cat = _aqi_cat(current_aqi)

        # ── Analysis prompt ────────────────────────────────────────────
        analysis_prompt = (
            f"You are an expert environmental analyst writing for the Municipal Corporation of {ward_name}.\n\n"
            f"Ward Data:\n"
            f"  Current AQI: {current_aqi:.0f} ({aqi_cat})\n"
            f"  7-day average AQI: {avg_aqi_7d:.0f}\n"
            f"  PM2.5: {pm25:.1f} μg/m³  |  PM10: {pm10:.1f} μg/m³  |  NO₂: {no2:.1f} μg/m³\n"
            f"  Industrial units: {n_ind} — {industries if industries != 'No industries recorded' else 'none'}\n"
            f"  Active construction: {n_con} sites — {construction_sites if construction_sites != 'No active construction sites' else 'none'}\n\n"
            "Write exactly 3 sentences:\n"
            "1. Describe the current pollution level and trend for this specific ward.\n"
            "2. Name the exact pollution sources present in this ward (mention actual industry names/types and construction sites if any).\n"
            "3. State the specific health risks for residents of this ward given these sources.\n"
            "Do NOT use generic language. Be precise."
        )

        # ── Actions prompt ─────────────────────────────────────────────
        # Build a rich context for action generation
        ind_context = ""
        if ind_details:
            top = sorted(ind_details, key=lambda x: x.get("contribution", 0), reverse=True)[:3]
            ind_context = ", ".join(
                f"{i['name']} ({i['type']}, {i['contribution']:.0f}% contribution)"
                for i in top
            )
        else:
            ind_context = "no significant industries"

        con_context = ""
        if con_details:
            high_dust = [c for c in con_details if c.get("dust") == "high"]
            con_context = (
                f"{len(con_details)} active sites"
                + (f" ({len(high_dust)} high-dust)" if high_dust else "")
                + ": " + ", ".join(c["name"] for c in con_details[:3])
            )
        else:
            con_context = "no active construction"

        actions_prompt = (
            f"You are an urban pollution control officer for {ward_name}.\n\n"
            f"Current situation:\n"
            f"  AQI: {current_aqi:.0f} ({aqi_cat}), PM2.5: {pm25:.1f}, PM10: {pm10:.1f}, NO₂: {no2:.1f}\n"
            f"  Top pollution sources: {ind_context}\n"
            f"  Construction activity: {con_context}\n\n"
            f"Generate exactly 4 specific, targeted government actions for THIS ward.\n"
            f"Each action MUST be tailored to the actual sources above — NOT generic.\n"
            f"If AQI < 100, focus on preventive/monitoring actions, NOT emergency ones.\n"
            f"If no industries exist, do NOT recommend industrial inspections.\n"
            f"If no construction, do NOT recommend dust suppression at construction sites.\n\n"
            "Output EXACTLY 4 lines, each in this format:\n"
            "ACTION: <specific title> | TYPE: <regulation/enforcement/infrastructure/awareness> | "
            "PRIORITY: <high/medium/low> | IMPACT: <specific measurable outcome> | "
            "TIMELINE: <specific timeframe>\n"
            "Make every action name-specific to this ward's actual situation."
        )

        # ── Ward-specific fallback (data-driven, not generic) ──────────
        fallback_analysis = self._build_ward_analysis_fallback(
            ward_name, current_aqi, aqi_cat, avg_aqi_7d,
            pm25, pm10, no2, ind_details, con_details
        )
        fallback_actions = self._build_ward_actions_fallback(
            ward_name, current_aqi, aqi_cat, pm25, pm10, no2,
            ind_details, con_details
        )

        analysis = await self._generate(analysis_prompt, fallback_analysis)
        raw_actions = await self._generate(actions_prompt, "")

        actions = []
        if raw_actions:
            for line in raw_actions.strip().splitlines():
                line = line.strip()
                if not line or "ACTION:" not in line:
                    continue
                rec: dict = {}
                for part in line.split("|"):
                    part = part.strip()
                    if ":" in part:
                        k, _, v = part.partition(":")
                        rec[k.strip().lower()] = v.strip()
                if rec.get("action"):
                    actions.append({
                        "title":       rec.get("action", "Intervention"),
                        "action_type": rec.get("type", "regulation").lower(),
                        "priority":    rec.get("priority", "medium").lower(),
                        "impact":      rec.get("impact", ""),
                        "timeline":    rec.get("timeline", "TBD"),
                    })

        return analysis, (actions if len(actions) >= 2 else fallback_actions)

    @staticmethod
    def _build_ward_analysis_fallback(
        ward_name, current_aqi, aqi_cat, avg_aqi_7d,
        pm25, pm10, no2, ind_details, con_details
    ) -> str:
        """Build a data-driven analysis text without Gemini."""
        trend = "consistent" if abs(current_aqi - avg_aqi_7d) < 10 else \
                ("worsening" if current_aqi > avg_aqi_7d else "improving")

        # Source sentence
        sources = []
        if ind_details:
            top = sorted(ind_details, key=lambda x: x.get("contribution", 0), reverse=True)[:2]
            sources.append(f"{', '.join(i['name'] + ' (' + i['type'] + ')' for i in top)}")
        if con_details:
            high = [c for c in con_details if c.get("dust") == "high"]
            if high:
                sources.append(f"high-dust construction at {high[0]['name']}")
            else:
                sources.append(f"{len(con_details)} active construction site(s)")
        if not sources:
            sources = ["vehicular traffic and road dust"]

        # Health risk sentence
        if current_aqi <= 100:
            health = (f"At AQI {current_aqi:.0f}, air quality poses minimal risk; "
                      "routine monitoring is sufficient for most residents.")
        elif current_aqi <= 200:
            health = (f"PM2.5 at {pm25:.1f} μg/m³ poses moderate risk to sensitive groups "
                      "including children and the elderly in {ward_name}.")
        else:
            health = (f"Elevated PM2.5 ({pm25:.1f} μg/m³) and PM10 ({pm10:.1f} μg/m³) "
                      f"pose significant respiratory risk for all {ward_name} residents.")

        return (
            f"{ward_name} is currently recording {aqi_cat} air quality "
            f"(AQI {current_aqi:.0f}), with a {trend} trend against the 7-day average of {avg_aqi_7d:.0f}. "
            f"Primary pollution contributors are: {'; '.join(sources)}. "
            + health
        )

    @staticmethod
    def _build_ward_actions_fallback(
        ward_name, current_aqi, aqi_cat, pm25, pm10, no2,
        ind_details, con_details
    ) -> list[dict]:
        """Build ward-specific actions based on actual data — no generic defaults."""
        actions = []

        # ── Industrial actions (only if industries exist) ──────────────
        if ind_details:
            top = sorted(ind_details, key=lambda x: x.get("contribution", 0), reverse=True)
            critical = [i for i in top if i.get("category") in ("critical", "high")]
            if critical:
                names = ", ".join(i["name"] for i in critical[:2])
                actions.append({
                    "title":       f"Immediate Emission Audit — {critical[0]['name']}",
                    "action_type": "enforcement",
                    "priority":    "high" if current_aqi > 150 else "medium",
                    "impact":      f"Reduce {critical[0].get('type','industrial')} emissions by 20–30%",
                    "timeline":    "1 week",
                })
                if len(critical) > 1:
                    actions.append({
                        "title":       f"Enforce Emission Caps — {critical[1]['name']}",
                        "action_type": "regulation",
                        "priority":    "high" if current_aqi > 200 else "medium",
                        "impact":      f"Reduce PM2.5 contribution from {critical[1].get('type','industry')}",
                        "timeline":    "2 weeks",
                    })
            else:
                actions.append({
                    "title":       f"Routine Compliance Check — {top[0]['name']}",
                    "action_type": "enforcement",
                    "priority":    "low",
                    "impact":      "Verify emissions within permissible limits",
                    "timeline":    "1 month",
                })

        # ── Construction actions (only if construction exists) ─────────
        if con_details:
            high_dust = [c for c in con_details if c.get("dust") == "high"]
            if high_dust:
                actions.append({
                    "title":       f"Mandatory Dust Suppression — {high_dust[0]['name']}",
                    "action_type": "regulation",
                    "priority":    "high",
                    "impact":      f"Reduce PM10 from high-dust site by 15–25%",
                    "timeline":    "48 hours",
                })
            else:
                actions.append({
                    "title":       "Water Sprinkling at Active Construction Sites",
                    "action_type": "infrastructure",
                    "priority":    "medium",
                    "impact":      f"Lower PM10 levels across {len(con_details)} sites",
                    "timeline":    "3 days",
                })

        # ── AQI-level based actions ────────────────────────────────────
        if current_aqi > 200:
            actions.append({
                "title":       f"Public Health Emergency Alert — {ward_name}",
                "action_type": "awareness",
                "priority":    "high",
                "impact":      "Warn vulnerable residents; reduce outdoor exposure",
                "timeline":    "Immediate",
            })
            actions.append({
                "title":       "Deploy Mobile Air Quality Monitoring Units",
                "action_type": "infrastructure",
                "priority":    "high",
                "impact":      "Real-time source identification for targeted action",
                "timeline":    "3 days",
            })
        elif current_aqi > 100:
            actions.append({
                "title":       f"Targeted Health Advisory for {ward_name} Residents",
                "action_type": "awareness",
                "priority":    "medium",
                "impact":      "Advise sensitive groups to limit outdoor activity",
                "timeline":    "Immediate",
            })
            actions.append({
                "title":       "Water Sprinkling on High-Traffic Roads",
                "action_type": "infrastructure",
                "priority":    "medium",
                "impact":      "Reduce road dust contributing to elevated PM10",
                "timeline":    "3 days",
            })
        else:
            # Low AQI — preventive
            actions.append({
                "title":       "Install Continuous AQI Monitoring Sensor",
                "action_type": "infrastructure",
                "priority":    "low",
                "impact":      "Early warning system for future pollution spikes",
                "timeline":    "1 month",
            })
            actions.append({
                "title":       f"Expand Green Cover in {ward_name}",
                "action_type": "infrastructure",
                "priority":    "low",
                "impact":      "Long-term air quality improvement through tree plantation",
                "timeline":    "3 months",
            })

        # Ensure exactly 4 actions
        while len(actions) < 4:
            actions.append({
                "title":       "Strengthen Air Quality Monitoring Network",
                "action_type": "infrastructure",
                "priority":    "low",
                "impact":      "Improve data granularity for better policy decisions",
                "timeline":    "2 months",
            })
        return actions[:4]


        """Translate advisory text to Hindi or Gujarati.

        Args:
            text: Source text in English.
            target_language: ``hi`` for Hindi, ``gu`` for Gujarati.

        Returns:
            Translated text, or original text if translation fails.
        """
        lang_map = {"hi": "Hindi", "gu": "Gujarati"}
        lang_full = lang_map.get(target_language)
        if not lang_full:
            return text

        prompt = (
            f"Translate the following health advisory text to {lang_full}. "
            f"Keep the same tone and structure:\n\n{text}"
        )
        return await self._generate(prompt, text)

    # ------------------------------------------------------------------
    # Fallback helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _fallback_recommendations() -> list[dict]:
        return [
            {
                "priority": "high",
                "action": "Increase frequency of air quality monitoring stations",
                "ward": "all",
                "expected_impact": "Better real-time data for decision-making",
                "timeline": "30 days",
            },
            {
                "priority": "high",
                "action": "Issue public health advisory and distribute masks",
                "ward": "all",
                "expected_impact": "Reduce direct health exposure",
                "timeline": "Immediate",
            },
            {
                "priority": "medium",
                "action": "Enforce vehicle emission checks in high-AQI zones",
                "ward": "all",
                "expected_impact": "Reduce vehicular pollution by 15–20%",
                "timeline": "2 weeks",
            },
            {
                "priority": "medium",
                "action": "Mandate dust suppression at construction sites",
                "ward": "all",
                "expected_impact": "Reduce PM10 by 10–15%",
                "timeline": "1 week",
            },
            {
                "priority": "low",
                "action": "Plant trees and expand green cover in industrial zones",
                "ward": "all",
                "expected_impact": "Long-term AQI improvement",
                "timeline": "6 months",
            },
        ]

    @staticmethod
    def _format_fallback_recommendations(wards: list[dict]) -> str:
        lines = []
        for i, w in enumerate(wards[:3], 1):
            name = w.get("ward_name", w.get("ward_id", f"Ward {i}"))
            aqi = w.get("aqi", 250)
            lines.append(
                f"PRIORITY: high | ACTION: Emergency monitoring in {name} | "
                f"WARD: {name} | IMPACT: Reduce AQI from {aqi:.0f} | TIMELINE: Immediate"
            )
        return "\n".join(lines)

    @staticmethod
    def _parse_recommendations(raw: str, wards: list[dict]) -> list[dict]:
        """Parse structured recommendation lines from Gemini output."""
        results: list[dict] = []
        for line in raw.strip().splitlines():
            line = line.strip()
            if not line:
                continue
            rec: dict[str, str] = {}
            for part in line.split("|"):
                part = part.strip()
                if ":" in part:
                    key, _, value = part.partition(":")
                    rec[key.strip().lower()] = value.strip()
            if rec:
                results.append(
                    {
                        "priority": rec.get("priority", "medium"),
                        "action": rec.get("action", line),
                        "ward": rec.get("ward", "all"),
                        "expected_impact": rec.get("impact", ""),
                        "timeline": rec.get("timeline", "TBD"),
                    }
                )

        # If parsing yields nothing, fall back to structured defaults
        if not results:
            return GeminiService._fallback_recommendations()
        return results
