# Urban Air Quality Intelligence and Intervention System (UAQIIS)

A full-stack AI-powered Smart City platform for real-time air quality monitoring, prediction, health risk assessment, and government intervention planning.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite, Tailwind CSS, Recharts, React-Leaflet |
| Backend | FastAPI (Python 3.11+) |
| ML/AI | Scikit-learn, XGBoost, SHAP, Pandas, NumPy |
| Database | SQLite (dev) / PostgreSQL + PostGIS (prod) |
| LLM | Google Gemini API |
| Maps | OpenStreetMap via Leaflet (CartoDB dark tiles) |

---

## Project Structure

```
xx/
├── backend/
│   ├── main.py                    # FastAPI app entry point
│   ├── requirements.txt
│   ├── .env.example
│   └── app/
│       ├── config.py              # Pydantic settings
│       ├── database.py            # Async SQLAlchemy setup
│       ├── models.py              # ORM models (10 tables)
│       ├── schemas.py             # Pydantic request/response schemas
│       ├── auth.py                # JWT authentication
│       ├── routers/
│       │   ├── auth.py            # Register, login, profile
│       │   ├── aqi.py             # AQI data endpoints
│       │   ├── predictions.py     # ML prediction endpoints
│       │   ├── hospitals.py       # Hospital search
│       │   ├── health.py          # Health risk + advice
│       │   ├── hotspots.py        # Clustering + priority ranking
│       │   └── government.py      # Actions, reports, recommendations
│       ├── services/
│       │   ├── ml_service.py      # Random Forest + XGBoost models
│       │   ├── gemini_service.py  # Google Gemini AI integration
│       │   ├── report_service.py  # PDF generation (ReportLab)
│       │   └── data_ingestion.py  # Synthetic data generator
│       └── utils/
│           └── geo_utils.py       # Haversine distance, geo helpers
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── App.jsx                # Routes
        ├── main.jsx               # Entry point
        ├── api/                   # Axios + API functions
        ├── store/                 # Zustand auth state
        ├── utils/                 # AQI color/category helpers
        ├── components/
        │   ├── common/            # Navbar, Sidebar, StatCard, AQIBadge...
        │   ├── charts/            # Recharts components
        │   └── maps/              # React-Leaflet map components
        └── pages/
            ├── LandingPage.jsx
            ├── LoginPage.jsx
            ├── RegisterPage.jsx
            ├── CitizenDashboard.jsx
            ├── GovernmentDashboard.jsx
            ├── citizen/
            │   ├── AQIMapPage.jsx
            │   ├── PredictionsPage.jsx
            │   ├── HealthRiskPage.jsx
            │   └── HospitalsPage.jsx
            └── government/
                ├── HotspotsPage.jsx
                ├── IndustriesPage.jsx
                ├── PriorityPage.jsx
                ├── ActionsPage.jsx
                └── ReportsPage.jsx
```

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- npm or yarn

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env
# Edit .env and set GEMINI_API_KEY (optional but recommended)

# Start the server (auto-seeds sample data on first run)
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API available at: http://localhost:8000  
Swagger docs: http://localhost:8000/docs

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

App available at: http://localhost:5173

---

## Features

### Citizen Dashboard
- **Live AQI Map** — Interactive Leaflet map with color-coded ward markers, popups with pollutant data
- **AI Predictions** — 24h / 3-day / 7-day AQI forecasts (Random Forest + XGBoost)
- **Health Risk Score** — Personalized risk assessment (0–100) based on age, respiratory conditions, and AQI
- **AI Health Advice** — Gemini-powered recommendations in English, Hindi, and Gujarati
- **Hospital Locator** — Nearby hospitals with distance, contact, and emergency info

### Government Dashboard
- **Pollution Hotspots** — DBSCAN + K-Means clustering visualization on map
- **Industry Tracking** — Industrial pollution sources with contribution percentages
- **Priority Ranking** — Wards ranked by AQI severity, population density, hospital burden
- **AI Action Recommendations** — Gemini-powered intervention suggestions
- **Evidence Reports** — PDF generation with trend analysis and root cause reports

### ML Pipeline
- Random Forest Regressor and XGBoost for AQI prediction
- DBSCAN and K-Means for pollution hotspot detection
- SHAP-based feature importance analysis
- Accuracy metrics: MAE, RMSE, R²

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/register | Register new user |
| POST | /auth/login | Login (returns JWT) |
| GET | /auth/me | Current user profile |
| GET | /aqi/current | All wards current AQI |
| GET | /aqi/heatmap | Heatmap data points |
| POST | /predictions/generate | Generate AQI prediction |
| GET | /predictions/accuracy | Model accuracy metrics |
| GET | /hospitals/nearby | Hospitals within radius |
| POST | /health/risk-score | Calculate health risk |
| POST | /health/advice | Gemini health advice |
| GET | /hotspots/ | DBSCAN pollution clusters |
| GET | /hotspots/priority-ranking | Ward priority ranking |
| POST | /government/actions | Create intervention |
| GET | /government/recommendations | AI recommendations |
| POST | /government/report | Generate PDF report |

---

## Environment Variables

```env
DATABASE_URL=sqlite+aiosqlite:///./urban_air.db
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
GEMINI_API_KEY=your-gemini-api-key
OPENAQ_API_KEY=your-openaq-api-key
WEATHER_API_KEY=your-openweathermap-api-key
```

Get a free Gemini API key at: https://aistudio.google.com/app/apikey

---

## Demo Accounts

After starting the backend, register accounts via the UI or use the demo:

- **Citizen**: Register with role = "citizen"  
- **Government**: Register with role = "government"

The system auto-seeds 20 Ahmedabad wards with 30 days of realistic AQI data, 10 hospitals, 15 industries, and 8 construction sites on first startup.

---

## Database Schema

10 tables: `users`, `aqi_data`, `prediction_data`, `hospitals`, `industries`, `construction_sites`, `health_advisories`, `government_actions`, `evidence_reports`, `ward_boundaries`

All tables have proper foreign keys, indexes, and relationships.

---

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment instructions.
