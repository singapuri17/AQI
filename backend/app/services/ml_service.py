"""Machine learning services: AQI prediction, hotspot detection, and health risk."""

from __future__ import annotations

import json
import logging
from typing import Any

import numpy as np
import pandas as pd
from sklearn.cluster import DBSCAN, KMeans
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from xgboost import XGBRegressor

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------


def _aqi_category(aqi: float) -> str:
    """Map a numeric AQI value to its category string."""
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


def _generate_synthetic_training_data(n_samples: int = 5000) -> pd.DataFrame:
    """Generate realistic synthetic AQI training data for model bootstrapping.

    Features:
        hour, day_of_week, month, ward_aqi_lag1, ward_aqi_lag24,
        pm25, pm10, no2, temperature, humidity, wind_speed

    Target:
        aqi_value (next period)

    Args:
        n_samples: Number of synthetic rows to generate.

    Returns:
        DataFrame with feature columns and target ``aqi_value``.
    """
    rng = np.random.default_rng(42)

    hours = rng.integers(0, 24, n_samples)
    dow = rng.integers(0, 7, n_samples)
    months = rng.integers(1, 13, n_samples)

    # Base AQI influenced by time-of-day and season
    base_aqi = (
        120
        + 40 * np.sin(2 * np.pi * hours / 24)
        + 20 * np.sin(2 * np.pi * months / 12)
        + rng.normal(0, 25, n_samples)
    )
    base_aqi = np.clip(base_aqi, 20, 500)

    pm25 = base_aqi * 0.35 + rng.normal(0, 8, n_samples)
    pm10 = base_aqi * 0.55 + rng.normal(0, 12, n_samples)
    no2 = base_aqi * 0.10 + rng.normal(0, 5, n_samples)
    temperature = 28 + 8 * np.sin(2 * np.pi * months / 12) + rng.normal(0, 3, n_samples)
    humidity = 60 + 20 * np.sin(2 * np.pi * months / 12) + rng.normal(0, 10, n_samples)
    wind_speed = np.abs(rng.normal(10, 5, n_samples))

    # Wind dilutes pollution
    aqi_target = base_aqi - wind_speed * 1.5 + rng.normal(0, 10, n_samples)
    aqi_target = np.clip(aqi_target, 20, 500)

    return pd.DataFrame(
        {
            "hour": hours,
            "day_of_week": dow,
            "month": months,
            "ward_aqi_lag1": base_aqi,
            "ward_aqi_lag24": np.roll(base_aqi, 24),
            "pm25": np.clip(pm25, 0, None),
            "pm10": np.clip(pm10, 0, None),
            "no2": np.clip(no2, 0, None),
            "temperature": temperature,
            "humidity": np.clip(humidity, 0, 100),
            "wind_speed": wind_speed,
            "aqi_value": aqi_target,
        }
    )


FEATURE_COLS = [
    "hour",
    "day_of_week",
    "month",
    "ward_aqi_lag1",
    "ward_aqi_lag24",
    "pm25",
    "pm10",
    "no2",
    "temperature",
    "humidity",
    "wind_speed",
]


# ---------------------------------------------------------------------------
# AQI Predictor
# ---------------------------------------------------------------------------


class AQIPredictor:
    """Train Random Forest and XGBoost models and generate AQI forecasts.

    Models are trained on synthetic data when instantiated, so predictions
    work out-of-the-box without requiring prior real data collection.
    """

    def __init__(self) -> None:
        self._rf: RandomForestRegressor | None = None
        self._xgb: XGBRegressor | None = None
        self._scaler = StandardScaler()
        self._metrics: dict[str, dict] = {}
        self._feature_importance: dict[str, list] = {}
        self._trained = False   # lazy — train only when first prediction is needed

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def _train(self) -> None:
        """Train both models on synthetic data and record metrics."""
        df = _generate_synthetic_training_data(n_samples=6000)
        X = df[FEATURE_COLS].values
        y = df["aqi_value"].values

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

        X_train_scaled = self._scaler.fit_transform(X_train)
        X_test_scaled = self._scaler.transform(X_test)

        # Random Forest
        self._rf = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
        self._rf.fit(X_train_scaled, y_train)
        rf_pred = self._rf.predict(X_test_scaled)
        self._metrics["random_forest"] = self._compute_metrics(y_test, rf_pred)
        self._feature_importance["random_forest"] = list(
            zip(FEATURE_COLS, self._rf.feature_importances_.tolist())
        )

        # XGBoost
        self._xgb = XGBRegressor(
            n_estimators=200,
            learning_rate=0.05,
            max_depth=6,
            random_state=42,
            verbosity=0,
        )
        self._xgb.fit(X_train_scaled, y_train)
        xgb_pred = self._xgb.predict(X_test_scaled)
        self._metrics["xgboost"] = self._compute_metrics(y_test, xgb_pred)
        self._feature_importance["xgboost"] = list(
            zip(FEATURE_COLS, self._xgb.feature_importances_.tolist())
        )

        logger.info("AQIPredictor: models trained. RF MAE=%.2f, XGB MAE=%.2f",
                    self._metrics["random_forest"]["mae"],
                    self._metrics["xgboost"]["mae"])

    @staticmethod
    def _compute_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
        rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
        return {
            "mae": float(mean_absolute_error(y_true, y_pred)),
            "rmse": rmse,
            "r2": float(r2_score(y_true, y_pred)),
        }

    # ------------------------------------------------------------------
    # Prediction
    # ------------------------------------------------------------------

    def _ensure_trained(self) -> None:
        """Train models on first use (lazy init)."""
        if not self._trained:
            self._train()
            self._trained = True

    def predict(
        self,
        ward_id: str,
        horizon: str,
        historical_data: list,
        model_type: str = "xgboost",
    ) -> dict[str, Any]:
        """Generate an AQI prediction for a ward.

        Args:
            ward_id: Ward identifier (used for logging).
            horizon: One of ``24h``, ``3d``, ``7d``.
            historical_data: List of AQIData ORM objects (newest-first).
            model_type: ``random_forest``, ``xgboost``, or ``ensemble``.

        Returns:
            Dict with predicted_aqi, confidence, model_used, and
            feature_importance_json.
        """
        # Build feature vector from recent history
        self._ensure_trained()
        features = self._build_features(historical_data)
        X = np.array([features])
        X_scaled = self._scaler.transform(X)

        # Apply horizon dampening: uncertainty grows with horizon
        horizon_noise = {"24h": 0.02, "3d": 0.06, "7d": 0.12}
        noise_factor = horizon_noise.get(horizon, 0.05)

        if model_type == "random_forest":
            model = self._rf
            model_name = "RandomForest"
        elif model_type == "ensemble":
            rf_pred = float(self._rf.predict(X_scaled)[0])
            xgb_pred = float(self._xgb.predict(X_scaled)[0])
            avg = (rf_pred + xgb_pred) / 2
            noise = np.random.default_rng().normal(0, avg * noise_factor)
            predicted = float(np.clip(avg + noise, 0, 500))
            confidence = max(0.55, 0.90 - noise_factor * 3)
            return {
                "predicted_aqi": round(predicted, 2),
                "predicted_pm25": round(predicted * 0.35, 2),
                "predicted_pm10": round(predicted * 0.55, 2),
                "confidence": round(confidence, 3),
                "model_used": "Ensemble(RF+XGB)",
                "feature_importance_json": json.dumps(
                    self._feature_importance.get("xgboost", [])
                ),
            }
        else:
            model = self._xgb
            model_name = "XGBoost"

        raw_pred = float(model.predict(X_scaled)[0])
        noise = np.random.default_rng().normal(0, raw_pred * noise_factor)
        predicted = float(np.clip(raw_pred + noise, 0, 500))
        confidence = max(0.55, 0.92 - noise_factor * 3)

        return {
            "predicted_aqi": round(predicted, 2),
            "predicted_pm25": round(predicted * 0.35, 2),
            "predicted_pm10": round(predicted * 0.55, 2),
            "confidence": round(confidence, 3),
            "model_used": model_name,
            "feature_importance_json": json.dumps(
                self._feature_importance.get(
                    "random_forest" if model_name == "RandomForest" else "xgboost", []
                )
            ),
        }

    @staticmethod
    def _build_features(historical_data: list) -> list[float]:
        """Extract feature vector from a list of AQIData ORM objects."""
        import datetime

        if not historical_data:
            # Return neutral features if no data
            return [12, 2, 6, 150.0, 145.0, 52.5, 82.5, 15.0, 28.0, 60.0, 10.0]

        latest = historical_data[0]
        lag24 = historical_data[24] if len(historical_data) > 24 else latest

        ts = latest.timestamp
        if hasattr(ts, "hour"):
            hour = ts.hour
            dow = ts.weekday()
            month = ts.month
        else:
            now = datetime.datetime.now()
            hour, dow, month = now.hour, now.weekday(), now.month

        return [
            hour,
            dow,
            month,
            float(latest.aqi_value),
            float(lag24.aqi_value),
            float(latest.pm25 or latest.aqi_value * 0.35),
            float(latest.pm10 or latest.aqi_value * 0.55),
            float(latest.no2 or latest.aqi_value * 0.10),
            28.0,   # temperature placeholder
            60.0,   # humidity placeholder
            10.0,   # wind_speed placeholder
        ]

    # ------------------------------------------------------------------
    # Metrics & feature importance
    # ------------------------------------------------------------------

    def get_accuracy_metrics(self) -> dict:
        """Return MAE, RMSE, and R² for each trained model."""
        self._ensure_trained()
        return self._metrics

    def get_feature_importance(self) -> dict:
        """Return feature importances as (feature_name, importance) pairs.

        Returns:
            Dict keyed by model name with list of (name, importance) tuples.
        """
        return self._feature_importance


# ---------------------------------------------------------------------------
# Hotspot Detector
# ---------------------------------------------------------------------------


class HotspotDetector:
    """Detect geographic pollution clusters using DBSCAN and K-Means."""

    def detect_clusters(self, aqi_data: list) -> list[dict]:
        """Identify pollution hotspots with DBSCAN.

        Points with AQI > 100 are included in the clustering. Points with
        label -1 (noise) are treated as isolated hotspots if their AQI > 200.

        Args:
            aqi_data: List of AQIData ORM objects with latitude, longitude,
                aqi_value, ward_id, ward_name.

        Returns:
            List of hotspot dicts matching the HotspotResponse schema.
        """
        records = [
            r for r in aqi_data if r.latitude is not None and r.longitude is not None
        ]
        if not records:
            return []

        coords = np.array([[r.latitude, r.longitude] for r in records])
        aqi_vals = np.array([r.aqi_value for r in records])

        # DBSCAN with haversine metric; eps=0.01 ≈ 1 km
        coords_rad = np.radians(coords)
        clustering = DBSCAN(
            eps=0.015,  # ~1.5 km
            min_samples=2,
            algorithm="ball_tree",
            metric="haversine",
        ).fit(coords_rad)

        labels = clustering.labels_
        hotspots: list[dict] = []
        unique_labels = set(labels)

        for cluster_id in unique_labels:
            mask = labels == cluster_id
            cluster_records = [r for r, m in zip(records, mask) if m]
            cluster_aqi = aqi_vals[mask]

            # Skip noise points with low AQI
            if cluster_id == -1:
                high_noise = [r for r in cluster_records if r.aqi_value > 200]
                if not high_noise:
                    continue
                cluster_records = high_noise
                cluster_aqi = np.array([r.aqi_value for r in cluster_records])

            avg_aqi = float(np.mean(cluster_aqi))
            max_aqi = float(np.max(cluster_aqi))
            center_lat = float(np.mean([r.latitude for r in cluster_records]))
            center_lon = float(np.mean([r.longitude for r in cluster_records]))

            severity = _aqi_category(avg_aqi)

            # Determine primary pollutant
            pm25_vals = [r.pm25 for r in cluster_records if r.pm25]
            pm10_vals = [r.pm10 for r in cluster_records if r.pm10]
            no2_vals = [r.no2 for r in cluster_records if r.no2]
            primary_pollutant = "PM2.5"
            if pm25_vals and pm10_vals:
                primary_pollutant = (
                    "PM2.5" if np.mean(pm25_vals) >= np.mean(pm10_vals) * 0.6
                    else "PM10"
                )
            elif no2_vals and pm25_vals and np.mean(no2_vals) > np.mean(pm25_vals):
                primary_pollutant = "NO2"

            hotspots.append(
                {
                    "cluster_id": int(cluster_id),
                    "ward_ids": list({r.ward_id for r in cluster_records}),
                    "ward_names": list({r.ward_name for r in cluster_records}),
                    "center_latitude": round(center_lat, 6),
                    "center_longitude": round(center_lon, 6),
                    "average_aqi": round(avg_aqi, 2),
                    "max_aqi": round(max_aqi, 2),
                    "point_count": len(cluster_records),
                    "severity": severity,
                    "primary_pollutant": primary_pollutant,
                    "nearby_industries": None,
                    "nearby_construction": None,
                }
            )

        hotspots.sort(key=lambda h: h["average_aqi"], reverse=True)
        return hotspots

    def kmeans_clusters(self, aqi_data: list, k: int = 5) -> list[dict]:
        """Partition AQI data into K geographic clusters using K-Means.

        Args:
            aqi_data: List of AQIData ORM objects.
            k: Number of clusters.

        Returns:
            List of cluster summary dicts.
        """
        records = [
            r for r in aqi_data if r.latitude is not None and r.longitude is not None
        ]
        if len(records) < k:
            return []

        coords = np.array([[r.latitude, r.longitude] for r in records])
        km = KMeans(n_clusters=k, random_state=42, n_init=10)
        labels = km.fit_predict(coords)

        clusters = []
        for cid in range(k):
            mask = labels == cid
            cluster_records = [r for r, m in zip(records, mask) if m]
            if not cluster_records:
                continue
            aqi_vals = [r.aqi_value for r in cluster_records]
            clusters.append(
                {
                    "cluster_id": cid,
                    "ward_ids": list({r.ward_id for r in cluster_records}),
                    "center_latitude": float(km.cluster_centers_[cid][0]),
                    "center_longitude": float(km.cluster_centers_[cid][1]),
                    "average_aqi": round(float(np.mean(aqi_vals)), 2),
                    "max_aqi": round(float(np.max(aqi_vals)), 2),
                    "point_count": len(cluster_records),
                }
            )
        return clusters


# ---------------------------------------------------------------------------
# Health Risk Calculator
# ---------------------------------------------------------------------------


class HealthRiskCalculator:
    """Rule-based health risk calculator — no external API required."""

    # Base risk multipliers by age category
    _AGE_MULTIPLIER = {"child": 1.4, "adult": 1.0, "elderly": 1.5}
    # Respiratory condition adds additional weight
    _RESPIRATORY_BONUS = 20.0

    def calculate_risk(
        self,
        aqi: float,
        age_category: str,
        has_respiratory: bool,
        weather_data: dict | None = None,
    ) -> dict:
        """Compute a numeric risk score and categorical risk level.

        Args:
            aqi: Current or forecast AQI value.
            age_category: ``child``, ``adult``, or ``elderly``.
            has_respiratory: Whether the person has a respiratory condition.
            weather_data: Optional dict with temperature/humidity (unused in
                current version but kept for future integration).

        Returns:
            Dict with keys: risk_score (0–100), risk_category, aqi_category,
            contributing_factors, precautions.
        """
        multiplier = self._AGE_MULTIPLIER.get(age_category, 1.0)

        # Normalised AQI contribution: 0–60 of the 100-point scale
        aqi_contrib = min(aqi / 500.0, 1.0) * 60.0

        # Age sensitivity: 0–20 of the 100-point scale
        age_contrib = (multiplier - 1.0) * 40.0

        # Respiratory bonus: 0–20 of the 100-point scale
        resp_contrib = self._RESPIRATORY_BONUS if has_respiratory else 0.0

        risk_score = min(round(aqi_contrib + age_contrib + resp_contrib, 2), 100.0)

        if risk_score <= 20:
            category = "low"
        elif risk_score <= 40:
            category = "moderate"
        elif risk_score <= 60:
            category = "high"
        elif risk_score <= 80:
            category = "very_high"
        else:
            category = "hazardous"

        factors: list[str] = []
        if aqi > 300:
            factors.append("Severe air pollution levels")
        elif aqi > 200:
            factors.append("High air pollution levels")
        elif aqi > 100:
            factors.append("Moderate air pollution levels")
        if age_category in ("child", "elderly"):
            factors.append(f"Vulnerable age group ({age_category})")
        if has_respiratory:
            factors.append("Pre-existing respiratory condition")

        precautions: list[str] = []
        if aqi > 300:
            precautions += ["Avoid all outdoor activities", "Wear N95 mask if outdoors"]
        elif aqi > 200:
            precautions += ["Reduce outdoor exertion", "Keep windows closed"]
        elif aqi > 100:
            precautions += ["Limit prolonged outdoor activities"]
        if has_respiratory:
            precautions.append("Keep rescue inhaler accessible")
        if age_category == "child":
            precautions.append("Limit outdoor play time")
        if age_category == "elderly":
            precautions.append("Monitor for respiratory symptoms")

        return {
            "risk_score": risk_score,
            "risk_category": category,
            "aqi_category": _aqi_category(aqi),
            "contributing_factors": factors,
            "precautions": precautions,
        }
