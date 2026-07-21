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
        industries: str,
        construction_sites: str,
    ) -> tuple[str, list[dict]]:
        """Generate deep ward-specific analysis and recommended actions.

        Returns:
            Tuple of (analysis_text, list_of_action_dicts)
        """
        def _aqi_cat(v):
            if v <= 50: return "Good"
            if v <= 100: return "Satisfactory"
            if v <= 200: return "Moderate"
            if v <= 300: return "Poor"
            if v <= 400: return "Very Poor"
            return "Severe"

        analysis_prompt = (
            f"You are an expert environmental analyst advising the government of {ward_name}.\n"
            f"Current AQI: {current_aqi:.0f} ({_aqi_cat(current_aqi)})\n"
            f"7-day average AQI: {avg_aqi_7d:.0f}\n"
            f"PM2.5: {pm25:.1f} μg/m³, PM10: {pm10:.1f} μg/m³, NO₂: {no2:.1f} μg/m³\n"
            f"Major pollution sources — Industries: {industries}\n"
            f"Active construction: {construction_sites}\n\n"
            "Write a concise 3-sentence analysis covering: "
            "1) the current pollution situation, "
            "2) the primary contributing sources, "
            "3) the health risk to residents. "
            "Be specific to this ward. Use plain English."
        )

        actions_prompt = (
            f"Based on the air quality data for {ward_name} "
            f"(AQI {current_aqi:.0f}, PM2.5 {pm25:.1f}, industries: {industries}, "
            f"construction: {construction_sites}), "
            "suggest exactly 4 specific government actions. "
            "For each action output EXACTLY this format on one line:\n"
            "ACTION: <title> | TYPE: <regulation/enforcement/infrastructure/awareness> | "
            "PRIORITY: <high/medium/low> | IMPACT: <expected outcome in 10 words> | "
            "TIMELINE: <e.g. 1 week / 2 weeks / 1 month>\n"
            "Be specific to the ward's actual pollution sources."
        )

        fallback_analysis = (
            f"{ward_name} is currently experiencing {_aqi_cat(current_aqi)} air quality "
            f"with an AQI of {current_aqi:.0f}. Primary pollution contributors include "
            f"industrial emissions and vehicular traffic. "
            f"Residents, especially children and the elderly, face elevated respiratory risk."
        )

        fallback_actions = [
            {"title": "Issue Public Health Advisory", "action_type": "awareness",
             "priority": "high", "impact": "Reduce public exposure to harmful pollutants",
             "timeline": "Immediate"},
            {"title": "Industrial Emission Inspection", "action_type": "enforcement",
             "priority": "high", "impact": "Reduce industrial PM2.5 by 20%",
             "timeline": "1 week"},
            {"title": "Dust Suppression at Construction Sites", "action_type": "regulation",
             "priority": "medium", "impact": "Reduce PM10 levels near construction zones",
             "timeline": "2 days"},
            {"title": "Water Sprinkling on Main Roads", "action_type": "infrastructure",
             "priority": "medium", "impact": "Lower road dust contribution by 15%",
             "timeline": "3 days"},
        ]

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
                        "action_type": rec.get("type", "regulation"),
                        "priority":    rec.get("priority", "medium"),
                        "impact":      rec.get("impact", ""),
                        "timeline":    rec.get("timeline", "TBD"),
                    })

        return analysis, (actions if actions else fallback_actions)

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
