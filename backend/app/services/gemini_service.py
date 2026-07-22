"""Gemini AI service for generating health advice and government recommendations."""

from __future__ import annotations

import ast
import json
import logging
import re
from datetime import datetime
from typing import Any

from app.schemas import EnvironmentalContext, UserHealthProfile

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
        environmental_context: EnvironmentalContext,
        health_profile: UserHealthProfile,
        language: str = "en",
    ) -> tuple[str, dict[str, Any]]:
        """Generate personalised structured health advice using Gemini AI.

        Args:
            environmental_context: Environmental pollutant and location context.
            health_profile: User health profile and conditions.
            language: Response language — ``en``, ``hi``, or ``gu``.

        Returns:
            Tuple of human-readable summary and structured advice dictionary.
        """
        lang_map = {"en": "English", "hi": "Hindi", "gu": "Gujarati"}
        lang_full = lang_map.get(language, "English")

        conditions = [
            key.replace("_", " ").title()
            for key, value in health_profile.conditions.items()
            if value
        ]
        if not conditions:
            condition_text = "No pre-existing health conditions reported."
        else:
            condition_text = "The user has: " + ", ".join(conditions) + "."

        pollutant_lines = []
        for key in ("pm25", "pm10", "no2", "so2", "co", "o3"):
            value = getattr(environmental_context, key)
            if value is not None:
                pollutant_lines.append(f"{key.upper()}: {value:.1f}")
        pollutant_summary = ", ".join(pollutant_lines) if pollutant_lines else "No pollutant readings available."

        ward_text = environmental_context.ward_name or environmental_context.ward_id or "the selected ward"
        city_text = environmental_context.city or "the city"
        timestamp_text = (
            environmental_context.timestamp.isoformat()
            if environmental_context.timestamp
            else "the current time"
        )
        location_text = (
            f"Latitude {environmental_context.latitude}, Longitude {environmental_context.longitude}."
            if environmental_context.latitude is not None and environmental_context.longitude is not None
            else ""
        )

        prompt = (
            "You are an Environmental Health Specialist. Analyze all available air quality data and the user's health profile. "
            "Do not rely only on AQI values; explain pollutant composition, the primary health risk driver, and the specific reason each recommendation is made. "
            "Return exactly one JSON object with the keys: overall_summary, pollution_analysis, activity_recommendation, mask_recommendation, indoor_safety, personalized_health_risk, symptoms_to_watch, emergency_warning, long_term_advice, extra. "
            "Use concise but specific explanations. Avoid generic phrases and repeat the reasoning in each section. "
            "If a field has no relevant data, use a brief meaningful fallback value."
            "\n\nEnvironmental data:\n"
            f"  AQI: {environmental_context.aqi_level:.0f}\n"
            f"  AQI Category: {environmental_context.aqi_category or 'N/A'}\n"
            f"  PM2.5: {environmental_context.pm25 or 'N/A'}\n"
            f"  PM10: {environmental_context.pm10 or 'N/A'}\n"
            f"  NO₂: {environmental_context.no2 or 'N/A'}\n"
            f"  SO₂: {environmental_context.so2 or 'N/A'}\n"
            f"  CO: {environmental_context.co or 'N/A'}\n"
            f"  O₃: {environmental_context.o3 or 'N/A'}\n"
            f"  Ward: {ward_text}\n"
            f"  City: {city_text}\n"
            f"  Timestamp: {timestamp_text}\n"
            f"  {location_text}\n"
            f"  Source: {environmental_context.source or 'unknown'}\n"
            "\nUser profile:\n"
            f"  Age category: {health_profile.age_category}\n"
            f"  Conditions: {condition_text}\n"
            "\nStructured JSON schema:\n"
            "{
"
            "  \"overall_summary\": \"string\",
"
            "  \"pollution_analysis\": {
"
            "    \"primary_pollutant\": \"string\",
"
            "    \"why_aqi_dangerous\": \"string\",
"
            "    \"elevated_pollutants\": [
"
            "      { \"pollutant\": \"string\", \"value\": number|null, \"unit\": \"µg/m³\", \"health_impact\": \"string\" }
"
            "    ]
"
            "  },
"
            "  \"activity_recommendation\": { \"recommendation\": \"string\", \"reasoning\": \"string\" },
"
            "  \"mask_recommendation\": { \"mask_type\": \"string\", \"reasoning\": \"string\" },
"
            "  \"indoor_safety\": { \"windows\": \"string\", \"air_purifier\": \"string\", \"hydration\": \"string\", \"other_recommendations\": [\"string\"], \"reasoning\": \"string\" },
"
            "  \"personalized_health_risk\": { \"risk_level\": \"string\", \"explanation\": \"string\", \"sensitive_population_warnings\": [\"string\"] },
"
            "  \"symptoms_to_watch\": [\"string\"],
"
            "  \"emergency_warning\": { \"active\": boolean, \"message\": \"string\", \"when_to_seek_care\": \"string\" },
"
            "  \"long_term_advice\": [\"string\"],
"
            "  \"extra\": { \"source\": \"string\", \"generated_by\": \"Gemini AI\" }
"
            "}"
        )

        fallback_advice = self._build_structured_health_advice(
            environmental_context, health_profile, language
        )
        fallback_text = json.dumps(fallback_advice, ensure_ascii=False)
        raw_response = await self._generate(prompt, fallback_text)
        advice = self._parse_structured_health_advice(raw_response) or fallback_advice
        summary = advice.get("overall_summary") or fallback_advice["overall_summary"]
        return summary, advice

    @staticmethod
    def _aqi_category(aqi: float) -> str:
        if aqi <= 50:
            return "Good"
        if aqi <= 100:
            return "Moderate"
        if aqi <= 200:
            return "Unhealthy"
        if aqi <= 300:
            return "Very Unhealthy"
        return "Hazardous"

    @staticmethod
    def _parse_structured_health_advice(raw: str) -> dict[str, Any] | None:
        if not raw or not raw.strip():
            return None
        text = raw.strip()
        if "{" not in text or "}" not in text:
            return None
        try:
            start = text.index("{")
            end = text.rfind("}") + 1
            payload = text[start:end]
            return json.loads(payload)
        except json.JSONDecodeError:
            try:
                payload = text[text.index("{"): text.rfind("}") + 1]
                return ast.literal_eval(payload)
            except Exception:
                return None

    @staticmethod
    def _build_structured_health_advice(
        environmental_context: EnvironmentalContext,
        health_profile: UserHealthProfile,
        language: str = "en",
    ) -> dict[str, Any]:
        aqi = environmental_context.aqi_level
        aqi_category = environmental_context.aqi_category or GeminiService._aqi_category(aqi)

        pollutants = [
            ("PM2.5", environmental_context.pm25, 35.0),
            ("PM10", environmental_context.pm10, 50.0),
            ("NO₂", environmental_context.no2, 40.0),
            ("SO₂", environmental_context.so2, 20.0),
            ("CO", environmental_context.co, 5.0),
            ("O₃", environmental_context.o3, 100.0),
        ]
        elevated = []
        primary_pollutant = "AQI"
        primary_score = 0.0
        for name, value, threshold in pollutants:
            if value is None:
                continue
            ratio = value / threshold if threshold else 0.0
            if ratio > primary_score:
                primary_score = ratio
                primary_pollutant = name
            if value >= threshold * 0.8:
                elevated.append(
                    {
                        "pollutant": name,
                        "value": round(value, 1),
                        "unit": "µg/m³",
                        "health_impact": (
                            "Can irritate the respiratory tract and worsen asthma symptoms."
                            if name in ("PM2.5", "PM10")
                            else "May increase airway inflammation and cardiovascular strain."
                        ),
                    }
                )

        if not elevated and pollutants:
            for name, value, threshold in pollutants:
                if value is not None:
                    elevated.append(
                        {
                            "pollutant": name,
                            "value": round(value, 1),
                            "unit": "µg/m³",
                            "health_impact": "Measured but not currently above the main advisory threshold.",
                        }
                    )
                    if len(elevated) >= 3:
                        break

        if aqi > 200:
            activity = "Avoid all outdoor exercise and limit time outside to essential travel only."
            mask = "N95 or KN95 mask outdoors given the current high particulate levels."
            window = "Keep windows closed while pollution persists."
        elif aqi > 100:
            activity = "Reduce strenuous outdoor activities and choose short walks instead of jogging."
            mask = "A surgical mask may help, but N95/KN95 is better if you are sensitive."
            window = "Keep windows closed when pollution peaks and ventilate briefly when air quality improves."
        else:
            activity = "Outdoor activities are generally safe, but remain aware of any symptoms."
            mask = "No special mask is required for most people; use one if you are sensitive."
            window = "Open windows when the air feels fresh; close them if pollution rises."

        sensitive_warnings = []
        if health_profile.age_category == "child":
            sensitive_warnings.append(
                "Children are more sensitive to fine particulates and should avoid prolonged outdoor play."
            )
        elif health_profile.age_category == "elderly":
            sensitive_warnings.append(
                "Elderly people are at higher risk of cardiovascular stress from polluted air."
            )
        if health_profile.conditions.get("respiratory"):
            sensitive_warnings.append(
                "Respiratory conditions increase sensitivity to PM2.5 and NO₂ exposure."
            )
        if health_profile.conditions.get("heart_disease"):
            sensitive_warnings.append(
                "Heart conditions raise the danger of pollution-related chest discomfort and fatigue."
            )
        if health_profile.conditions.get("pregnancy"):
            sensitive_warnings.append(
                "Pregnancy can make air pollution more harmful for both the mother and the developing baby."
            )
        if health_profile.conditions.get("outdoor_occupation"):
            sensitive_warnings.append(
                "Outdoor work increases exposure duration and makes protective actions more important."
            )

        symptoms = [
            "Coughing",
            "Wheezing",
            "Shortness of breath",
            "Chest tightness",
            "Eye irritation",
        ]

        emergency_active = aqi > 200 or primary_pollutant == "PM2.5" and aqi > 150
        emergency_msg = (
            "AQI is in a very unhealthy range. Move indoors and seek medical attention if breathing becomes difficult."
            if emergency_active
            else "Monitor symptoms and seek care if they worsen or do not improve after moving indoors."
        )

        return {
            "overall_summary": (
                f"Current air quality in {ward_text}, {city_text} is {aqi_category} (AQI {aqi:.0f}). "
                f"{primary_pollutant} is the main contributor today, and the recommendation is tailored to your profile."
            ),
            "pollution_analysis": {
                "primary_pollutant": primary_pollutant,
                "why_aqi_dangerous": (
                    f"AQI {aqi:.0f} is unhealthy because {primary_pollutant} levels are elevated and {condition_text.lower()}"
                    if condition_text != "No pre-existing health conditions reported."
                    else f"AQI {aqi:.0f} is elevated and the pollutant mix increases inflammation and respiratory strain."
                ),
                "elevated_pollutants": elevated,
            },
            "activity_recommendation": {
                "recommendation": activity,
                "reasoning": (
                    f"Because the air quality is {aqi_category} and {primary_pollutant} has the strongest contribution, outdoor exertion will increase breathing exposure."
                ),
            },
            "mask_recommendation": {
                "mask_type": (
                    "N95/KN95" if aqi > 150 or health_profile.conditions.get("respiratory") else "Surgical mask"
                ),
                "reasoning": (
                    f"Higher pollutant concentration and your profile mean respiratory protection is important when outdoors."
                ),
            },
            "indoor_safety": {
                "windows": window,
                "air_purifier": (
                    "Use an air purifier if available, especially when PM2.5 is above safe levels."
                    if environmental_context.pm25 and environmental_context.pm25 > 35
                    else "Use an air purifier if you have one, and keep indoor air as clean as possible."
                ),
                "hydration": (
                    "Stay well hydrated to help your airways cope with irritation."
                    if aqi > 100
                    else "Maintain regular hydration to support respiratory health."
                ),
                "other_recommendations": [
                    "Avoid burning incense or candles indoors.",
                    "Keep indoor air circulation gentle and avoid heavy cooking smoke."
                ],
                "reasoning": (
                    "Indoor air quality is easier to manage than outdoor air, so focus on limiting indoor sources and keeping the home environment safer."
                ),
            },
            "personalized_health_risk": {
                "risk_level": (
                    "High" if aqi > 150 or health_profile.conditions.get("respiratory") else "Moderate"
                ),
                "explanation": (
                    f"Your age category is {health_profile.age_category} and the current AQI is {aqi_category}, which increases the likelihood of respiratory symptoms."
                ),
                "sensitive_population_warnings": sensitive_warnings,
            },
            "symptoms_to_watch": symptoms,
            "emergency_warning": {
                "active": emergency_active,
                "message": emergency_msg,
                "when_to_seek_care": (
                    "If shortness of breath persists after moving indoors, seek medical attention immediately."
                    if emergency_active
                    else "If symptoms persist or worsen, consult a healthcare provider."
                ),
            },
            "long_term_advice": [
                "Reduce repeated outdoor exposure on days with poor air quality.",
                "Choose indoor exercise when pollution levels are high.",
                "Track AQI before planning outdoor activities.",
            ],
            "extra": {
                "source": environmental_context.source or "unknown",
                "generated_by": "Gemini AI",
                "timestamp": timestamp_text,
                "pollutant_summary": pollutant_summary,
            },
        }

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
