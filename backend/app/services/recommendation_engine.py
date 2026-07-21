"""Rule-based ward recommendation engine — generates unique, prioritised government actions
based on ward-specific pollution characteristics."""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Literal

# ── Types ─────────────────────────────────────────────────────────────────
Priority   = Literal["high", "medium", "low"]
ActionType = Literal["enforcement", "regulation", "infrastructure", "awareness"]


@dataclass
class WardProfile:
    """Pollution profile derived from ward data."""
    ward_name:            str
    ward_id:              str
    aqi:                  float
    pm25:                 float = 0.0
    pm10:                 float = 0.0
    no2:                  float = 0.0
    so2:                  float = 0.0
    co:                   float = 0.0
    o3:                   float = 0.0
    # Contextual factors (derived from industries / construction / ward type)
    industrial_density:   str = "low"     # low | medium | high
    traffic_density:      str = "medium"  # low | medium | high
    construction_activity:str = "low"     # low | medium | high
    green_cover:          str = "medium"  # low | medium | high
    waste_burning:        str = "low"     # low | medium | high
    # Industry detail
    industry_names:       list[str] = field(default_factory=list)
    industry_types:       list[str] = field(default_factory=list)
    industry_contributions: list[float] = field(default_factory=list)
    # Construction detail
    construction_sites:   list[str] = field(default_factory=list)
    high_dust_sites:      list[str] = field(default_factory=list)


@dataclass
class Action:
    """A single recommended government action."""
    title:        str
    description:  str
    action_type:  ActionType
    priority:     Priority
    impact:       str          # e.g. "Reduce PM2.5 by 15–20%"
    timeline:     str          # e.g. "48 hours"
    aqi_reduction: str         # e.g. "8–12%"
    source_tag:   str          # what problem this addresses


def _aqi_category(aqi: float) -> str:
    if aqi <= 50:   return "Good"
    if aqi <= 100:  return "Satisfactory"
    if aqi <= 200:  return "Moderate"
    if aqi <= 300:  return "Poor"
    if aqi <= 400:  return "Very Poor"
    return "Severe"


class WardRecommendationEngine:
    """Generates ward-specific, rule-based government action recommendations."""

    # ── Main entry point ──────────────────────────────────────────────
    def analyse(self, profile: WardProfile) -> dict:
        """Run full analysis and return ward report with actions."""
        aqi_cat = _aqi_category(profile.aqi)
        ward_type, risk_level = self._classify_ward(profile)
        primary_cause = self._primary_cause(profile)
        actions = self._generate_actions(profile)
        # Sort: high > medium > low, then by aqi_reduction descending
        priority_order = {"high": 0, "medium": 1, "low": 2}
        actions.sort(key=lambda a: (priority_order[a.priority],
                                    -self._parse_reduction(a.aqi_reduction)))
        return {
            "ward_id":      profile.ward_id,
            "ward_name":    profile.ward_name,
            "aqi":          round(profile.aqi, 1),
            "aqi_category": aqi_cat,
            "pm25":         round(profile.pm25, 1),
            "pm10":         round(profile.pm10, 1),
            "no2":          round(profile.no2, 1),
            "so2":          round(profile.so2, 1),
            "ward_type":    ward_type,
            "risk_level":   risk_level,
            "primary_cause":primary_cause,
            "industrial_density":    profile.industrial_density,
            "traffic_density":       profile.traffic_density,
            "construction_activity": profile.construction_activity,
            "green_cover":           profile.green_cover,
            "waste_burning":         profile.waste_burning,
            "recommendations": [
                {
                    "title":        a.title,
                    "description":  a.description,
                    "action_type":  a.action_type,
                    "priority":     a.priority,
                    "impact":       a.impact,
                    "timeline":     a.timeline,
                    "aqi_reduction":a.aqi_reduction,
                    "source_tag":   a.source_tag,
                }
                for a in actions[:6]   # top 6 actions
            ],
        }

    # ── Ward classification ───────────────────────────────────────────
    def _classify_ward(self, p: WardProfile) -> tuple[str, str]:
        types = []
        if p.industrial_density == "high":
            types.append("Industrial")
        if p.traffic_density == "high":
            types.append("Traffic Dominated")
        if p.construction_activity == "high":
            types.append("Construction Active")
        if p.green_cover == "low":
            types.append("Low Green Cover")
        if p.waste_burning == "high":
            types.append("Waste Burning")
        if not types:
            types = ["Mixed Residential"]
        ward_type = " + ".join(types)

        if p.aqi > 300:
            risk = "Severe"
        elif p.aqi > 200:
            risk = "High"
        elif p.aqi > 100:
            risk = "Moderate"
        else:
            risk = "Low"

        return ward_type, risk

    def _primary_cause(self, p: WardProfile) -> str:
        causes = []
        if p.industrial_density == "high" and p.industry_names:
            top = p.industry_names[0] if p.industry_names else "industrial units"
            causes.append(f"Industrial emissions from {top}")
        elif p.industrial_density == "medium":
            causes.append("Moderate industrial emissions")
        if p.traffic_density == "high":
            causes.append("high vehicular traffic and road dust")
        elif p.traffic_density == "medium" and not causes:
            causes.append("Moderate vehicular traffic")
        if p.construction_activity == "high":
            site = p.high_dust_sites[0] if p.high_dust_sites else "active construction"
            causes.append(f"dust from {site}")
        if p.waste_burning == "high":
            causes.append("open waste burning")
        if p.green_cover == "low" and not causes:
            causes.append("low vegetation cover reducing natural filtration")
        if not causes:
            causes.append("mixed urban pollution sources")
        return "; ".join(causes[:3]).capitalize() + "."

    # ── Action generation ─────────────────────────────────────────────
    def _generate_actions(self, p: WardProfile) -> list[Action]:
        actions: list[Action] = []

        # ── AQI Emergency (>300) ──────────────────────────────────────
        if p.aqi > 300:
            actions.append(Action(
                title="Declare Public Health Emergency Advisory",
                description=f"Issue immediate health emergency for {p.ward_name}. Alert residents via SMS, loudspeakers and social media. Distribute N95 masks at public distribution points.",
                action_type="awareness", priority="high",
                impact="Protect high-risk residents; reduce exposure to severe pollution",
                timeline="Immediate (today)", aqi_reduction="5–8%", source_tag="severe_aqi",
            ))
            actions.append(Action(
                title="Temporarily Close Schools and Outdoor Venues",
                description=f"Suspend outdoor activities in {p.ward_name}. Close schools for 2 days or until AQI drops below 200. Cancel public gatherings.",
                action_type="regulation", priority="high",
                impact="Protect children and vulnerable groups from AQI {:.0f} exposure".format(p.aqi),
                timeline="Within 6 hours", aqi_reduction="2–4%", source_tag="severe_aqi",
            ))
            actions.append(Action(
                title="Halt Non-Essential Construction & Demolition",
                description=f"Issue stop-work orders to all active construction sites in {p.ward_name} until AQI drops below 300. Exceptions for critical infrastructure only.",
                action_type="regulation", priority="high",
                impact="Eliminate construction dust contribution during severe episode",
                timeline="Within 12 hours", aqi_reduction="6–10%", source_tag="severe_aqi",
            ))

        # ── AQI Moderate-Poor (>200) ──────────────────────────────────
        elif p.aqi > 200:
            actions.append(Action(
                title="Issue Public Health Alert",
                description=f"Alert {p.ward_name} residents: AQI {p.aqi:.0f} ({_aqi_category(p.aqi)}). Advise sensitive groups (children, elderly, respiratory patients) to avoid outdoor activity.",
                action_type="awareness", priority="high",
                impact="Reduce health impact on sensitive groups",
                timeline="Immediate", aqi_reduction="3–5%", source_tag="high_aqi",
            ))

        # ── Industrial actions ────────────────────────────────────────
        if p.industrial_density in ("high", "medium") and p.industry_names:
            top_ind = p.industry_names[0]
            top_type = p.industry_types[0] if p.industry_types else "industry"
            top_contrib = p.industry_contributions[0] if p.industry_contributions else 0
            pr = "high" if p.industrial_density == "high" and top_contrib > 20 else "medium"

            actions.append(Action(
                title=f"Emergency Emission Audit — {top_ind}",
                description=f"Deploy pollution control officers to {top_ind} ({top_type}) for immediate stack emission testing. If limits exceeded, issue 24-hour show-cause notice.",
                action_type="enforcement", priority=pr,
                impact=f"Reduce {top_type} sector PM2.5 contribution by 20–30%",
                timeline="1–2 days", aqi_reduction="10–15%", source_tag="industrial",
            ))

            if p.industrial_density == "high":
                actions.append(Action(
                    title="Install CEMS on High-Emission Units",
                    description=f"Mandate Continuous Emission Monitoring Systems on all {p.industrial_density}-category units in {p.ward_name}. Real-time data to be reported to SPCB portal.",
                    action_type="regulation", priority="medium",
                    impact="Continuous compliance tracking; 15–25% emission reduction",
                    timeline="2 weeks", aqi_reduction="12–18%", source_tag="industrial",
                ))
                actions.append(Action(
                    title=f"Enforce Operational Restrictions — {top_type} Units",
                    description=f"Restrict operations of {top_type} units in {p.ward_name} to 6am–10pm during AQI > 200 episodes. Night-time emissions significantly worsen pollution trapping.",
                    action_type="regulation", priority="medium",
                    impact="Reduce overnight industrial PM2.5 by 35%",
                    timeline="1 week", aqi_reduction="8–12%", source_tag="industrial",
                ))
                actions.append(Action(
                    title="Roadside Water Sprinkling near Industrial Zone",
                    description=f"Deploy tankers for 2x daily water sprinkling on roads within 500m radius of industrial clusters in {p.ward_name}.",
                    action_type="infrastructure", priority="medium",
                    impact="Suppress secondary road dust near industrial areas by 15%",
                    timeline="48 hours", aqi_reduction="5–8%", source_tag="industrial",
                ))
            else:
                actions.append(Action(
                    title="Quarterly Compliance Inspection Programme",
                    description=f"Schedule quarterly inspections for all industrial units in {p.ward_name}. Verify emission logs and stack monitoring data.",
                    action_type="enforcement", priority="low",
                    impact="Maintain compliance; prevent deterioration",
                    timeline="1 month", aqi_reduction="5–8%", source_tag="industrial",
                ))

        elif p.industrial_density == "low" and p.aqi < 100:
            pass  # No industrial actions if low density and clean air

        # ── Traffic actions ───────────────────────────────────────────
        if p.traffic_density == "high":
            actions.append(Action(
                title="Introduce Odd-Even Vehicle Restrictions",
                description=f"Implement odd-even number plate restriction for private vehicles in {p.ward_name} during 7–10am and 5–8pm peak hours on high-AQI days (AQI > 150).",
                action_type="regulation", priority="high",
                impact="Reduce vehicular NO₂ and PM2.5 by 20–25% during peak hours",
                timeline="3 days", aqi_reduction="12–18%", source_tag="traffic",
            ))
            actions.append(Action(
                title="Restrict Heavy Vehicle Entry During Peak Hours",
                description=f"Ban trucks and heavy commercial vehicles from entering {p.ward_name} between 7am–10pm. Reroute via bypass roads.",
                action_type="regulation", priority="high",
                impact="Reduce diesel PM10 and NO₂ by 18–22%",
                timeline="1 week", aqi_reduction="10–15%", source_tag="traffic",
            ))
            actions.append(Action(
                title="Increase Public Transport Frequency",
                description=f"Add 20% more bus runs and increase frequency to every 8 minutes on key corridors in {p.ward_name}. Reduce dependence on private vehicles.",
                action_type="infrastructure", priority="medium",
                impact="Shift 15% of private trips to public transport",
                timeline="2 weeks", aqi_reduction="8–12%", source_tag="traffic",
            ))
            actions.append(Action(
                title="Deploy Intelligent Traffic Signal Management",
                description=f"Install adaptive signal controllers at top-5 congested intersections in {p.ward_name} to reduce idling time and vehicle queue lengths.",
                action_type="infrastructure", priority="medium",
                impact="Reduce idling emissions by 12–15%",
                timeline="1 month", aqi_reduction="6–9%", source_tag="traffic",
            ))

        elif p.traffic_density == "medium" and p.no2 > 40:
            actions.append(Action(
                title="Vehicle Emission Spot-Checks",
                description=f"Deploy traffic police and RTO teams for random PUC certificate checks at 3 key entry points of {p.ward_name}. Seize non-compliant vehicles.",
                action_type="enforcement", priority="medium",
                impact="Remove high-emission vehicles; reduce NO₂ by 8–12%",
                timeline="1 week", aqi_reduction="6–10%", source_tag="traffic",
            ))

        # ── Construction actions ──────────────────────────────────────
        if p.construction_activity == "high":
            site_name = p.high_dust_sites[0] if p.high_dust_sites else p.construction_sites[0] if p.construction_sites else "construction sites"
            actions.append(Action(
                title=f"Mandatory Anti-Smog Guns — {site_name}",
                description=f"Deploy anti-smog guns at {site_name} and all high-dust construction sites in {p.ward_name}. Require 4-hour operation cycles during working hours.",
                action_type="enforcement", priority="high",
                impact="Reduce airborne construction dust PM10 by 30–40%",
                timeline="48 hours", aqi_reduction="10–15%", source_tag="construction",
            ))
            actions.append(Action(
                title="Enforce Complete Site Coverage with Green Nets",
                description=f"Issue notices to all {len(p.construction_sites)} active sites in {p.ward_name}. Require 100% green net coverage on perimeter and debris storage areas within 24 hours.",
                action_type="regulation", priority="high",
                impact="Prevent dust dispersal; reduce PM10 by 20–25%",
                timeline="24 hours", aqi_reduction="8–12%", source_tag="construction",
            ))
            actions.append(Action(
                title="Road Vacuum Cleaning on Construction Corridors",
                description=f"Deploy road vacuum sweepers twice daily on all roads adjacent to active construction zones in {p.ward_name}.",
                action_type="infrastructure", priority="medium",
                impact="Remove settled construction dust before it re-enters air",
                timeline="3 days", aqi_reduction="5–8%", source_tag="construction",
            ))
            if p.aqi > 200:
                actions.append(Action(
                    title=f"Fine Non-Compliant Sites — Zero Tolerance",
                    description=f"Inspect all active sites and impose ₹50,000 fine per violation on sites not meeting CPCB dust control norms in {p.ward_name}.",
                    action_type="enforcement", priority="high",
                    impact="Force compliance; deter future violations",
                    timeline="1 week", aqi_reduction="8–10%", source_tag="construction",
                ))

        elif p.construction_activity == "medium" and p.pm10 > 80:
            actions.append(Action(
                title="Dust Suppression at Active Construction Sites",
                description=f"Require water sprinkling every 3 hours at active construction sites in {p.ward_name}. Verify compliance through surprise inspections.",
                action_type="regulation", priority="medium",
                impact="Reduce PM10 from construction by 15–20%",
                timeline="3 days", aqi_reduction="6–9%", source_tag="construction",
            ))

        # ── Low green cover ───────────────────────────────────────────
        if p.green_cover == "low":
            actions.append(Action(
                title="Urban Afforestation — Pollution-Resistant Species",
                description=f"Plant minimum 2,000 trees in {p.ward_name} prioritising species like Neem, Peepal, and Bamboo proven to absorb PM2.5 and NO₂. Create green buffers around industrial zones.",
                action_type="infrastructure", priority="medium",
                impact="10–15% long-term AQI reduction through natural filtration",
                timeline="3 months", aqi_reduction="8–12%", source_tag="green_cover",
            ))
            if p.industrial_density in ("high", "medium"):
                actions.append(Action(
                    title="Develop Industrial Green Belt",
                    description=f"Create mandatory 50m green buffer zone around all industrial clusters in {p.ward_name}. Pollution-resistant trees reduce particulate dispersion into residential areas.",
                    action_type="regulation", priority="low",
                    impact="Create natural PM10 barrier; reduce residential exposure by 10%",
                    timeline="6 months", aqi_reduction="5–8%", source_tag="green_cover",
                ))

        # ── Waste burning ─────────────────────────────────────────────
        if p.waste_burning == "high":
            actions.append(Action(
                title="Install CCTV Surveillance for Waste Burning Detection",
                description=f"Deploy CCTV cameras at known waste burning hotspots in {p.ward_name}. Feed to municipal monitoring centre with automated alerts.",
                action_type="infrastructure", priority="high",
                impact="Deter and detect open burning events in real-time",
                timeline="1 week", aqi_reduction="8–12%", source_tag="waste_burning",
            ))
            actions.append(Action(
                title="Increase Solid Waste Collection Frequency",
                description=f"Increase municipal waste pickup to twice daily in {p.ward_name}. Reduce waste accumulation that leads to open burning. Deploy additional compactors.",
                action_type="infrastructure", priority="high",
                impact="Reduce waste burning incidents by 60–70%",
                timeline="1 week", aqi_reduction="10–14%", source_tag="waste_burning",
            ))
            actions.append(Action(
                title="Strict Penalties for Open Waste Burning",
                description=f"Deploy anti-open-burning squads in {p.ward_name}. Issue ₹25,000 fines per incident under Air Prevention Act. Community awareness campaign with ward members.",
                action_type="enforcement", priority="high",
                impact="Deter waste burning; reduce CO and particulate spikes",
                timeline="Immediate", aqi_reduction="8–12%", source_tag="waste_burning",
            ))

        # ── Low AQI preventive actions ────────────────────────────────
        if p.aqi <= 100:
            actions.append(Action(
                title="Install Permanent AQI Monitoring Station",
                description=f"Deploy a permanent IoT-enabled AQI sensor in {p.ward_name} for 24×7 real-time monitoring. Integrate with city dashboard for early warning.",
                action_type="infrastructure", priority="low",
                impact="Enable early detection of pollution episodes",
                timeline="1 month", aqi_reduction="N/A", source_tag="preventive",
            ))
            if p.green_cover != "high":
                actions.append(Action(
                    title=f"Expand Green Cover in {p.ward_name}",
                    description="Plant 1,000 trees on road medians, parks, and school grounds. Focus on native species for maximum air filtration benefit.",
                    action_type="infrastructure", priority="low",
                    impact="Long-term AQI improvement through urban forestry",
                    timeline="3 months", aqi_reduction="5–10%", source_tag="preventive",
                ))

        # ── SO₂ specific ──────────────────────────────────────────────
        if p.so2 > 20 and p.industrial_density != "low":
            actions.append(Action(
                title="Enforce Scrubber Installation on SO₂-Emitting Units",
                description=f"SO₂ levels ({p.so2:.1f} μg/m³) in {p.ward_name} indicate inadequate flue gas desulfurisation. Issue 30-day compliance notice for scrubber installation.",
                action_type="regulation", priority="medium",
                impact="Reduce SO₂ by 40–60% per compliant unit",
                timeline="30 days", aqi_reduction="6–10%", source_tag="so2",
            ))

        # Fallback if nothing generated
        if not actions:
            actions.append(Action(
                title="Routine Air Quality Monitoring & Reporting",
                description=f"Maintain standard monitoring in {p.ward_name}. Review monthly trend data. No immediate interventions required at current AQI levels.",
                action_type="awareness", priority="low",
                impact="Maintain current air quality standard",
                timeline="Ongoing", aqi_reduction="N/A", source_tag="preventive",
            ))

        return actions

    @staticmethod
    def _parse_reduction(r: str) -> float:
        """Parse '10–15%' → 12.5 for sorting."""
        try:
            parts = r.replace("%", "").replace("–", "-").split("-")
            nums = [float(p.strip()) for p in parts if p.strip().replace(".", "").isdigit()]
            return sum(nums) / len(nums) if nums else 0.0
        except Exception:
            return 0.0


# ── DB → WardProfile builder ───────────────────────────────────────────────

def build_ward_profile(
    ward_id: str,
    ward_name: str,
    latest_aqi,          # AQIData ORM object
    avg_aqi: float,
    industries: list,    # Industry ORM objects
    construction: list,  # ConstructionSite ORM objects
) -> WardProfile:
    """Derive a WardProfile from database ORM objects."""
    # Industrial density
    n_ind = len(industries)
    critical_ind = [i for i in industries if i.emission_category in ("critical", "high")]
    if n_ind >= 3 or critical_ind:
        ind_density = "high"
    elif n_ind >= 1:
        ind_density = "medium"
    else:
        ind_density = "low"

    # Construction activity
    n_con = len(construction)
    high_dust = [c for c in construction if c.dust_emission_level == "high"]
    if n_con >= 3 or len(high_dust) >= 1:
        con_activity = "high"
    elif n_con >= 1:
        con_activity = "medium"
    else:
        con_activity = "low"

    # Traffic density — infer from NO₂ and ward type
    no2 = latest_aqi.no2 or 0
    pm10 = latest_aqi.pm10 or 0
    if no2 > 60 or (pm10 > 120 and ind_density == "low"):
        traffic = "high"
    elif no2 > 30 or pm10 > 70:
        traffic = "medium"
    else:
        traffic = "low"

    # Green cover — infer from ward (industrial wards tend to have less)
    if ind_density == "high" or con_activity == "high":
        green = "low"
    elif ind_density == "medium":
        green = "medium"
    else:
        green = "high"

    # Waste burning — infer from CO levels
    co = latest_aqi.co or 0
    if co > 2.0:
        waste = "high"
    elif co > 1.0:
        waste = "medium"
    else:
        waste = "low"

    # Sort industries by contribution
    sorted_ind = sorted(industries, key=lambda i: i.pollution_contribution or 0, reverse=True)

    return WardProfile(
        ward_id=ward_id,
        ward_name=ward_name,
        aqi=latest_aqi.aqi_value,
        pm25=latest_aqi.pm25 or 0,
        pm10=latest_aqi.pm10 or 0,
        no2=latest_aqi.no2 or 0,
        so2=latest_aqi.so2 or 0,
        co=co,
        o3=latest_aqi.o3 or 0,
        industrial_density=ind_density,
        traffic_density=traffic,
        construction_activity=con_activity,
        green_cover=green,
        waste_burning=waste,
        industry_names=[i.name for i in sorted_ind],
        industry_types=[i.industry_type for i in sorted_ind],
        industry_contributions=[i.pollution_contribution or 0 for i in sorted_ind],
        construction_sites=[c.name for c in construction],
        high_dust_sites=[c.name for c in high_dust],
    )
