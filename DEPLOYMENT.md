# Deployment Guide

## Development (Local)

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env   # then edit .env
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Production with Docker

### Backend Dockerfile
Create `backend/Dockerfile`:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Frontend Dockerfile
Create `frontend/Dockerfile`:
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### docker-compose.yml (root)
```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+asyncpg://postgres:password@db:5432/urban_air
      - GEMINI_API_KEY=${GEMINI_API_KEY}
      - SECRET_KEY=${SECRET_KEY}
    depends_on:
      - db

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend

  db:
    image: postgis/postgis:15-3.3
    environment:
      - POSTGRES_DB=urban_air
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

Run:
```bash
docker-compose up --build
```

---

## PostgreSQL Migration

1. Install PostGIS extension:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

2. Update `DATABASE_URL` in `.env`:
```
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/urban_air
```

3. The app auto-creates all tables on startup via SQLAlchemy.

---

## Cloud Deployment Options

### Render.com (Free tier)
- Backend: New Web Service → Python → `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Frontend: New Static Site → Build command: `npm run build`, Publish: `dist`
- Database: New PostgreSQL database

### Railway.app
- Connect GitHub repo
- Deploy backend and frontend as separate services
- Add PostgreSQL plugin

### AWS / GCP / Azure
- Backend: Deploy to EC2/Cloud Run/App Service
- Frontend: S3 static hosting + CloudFront / Firebase Hosting
- Database: RDS PostgreSQL with PostGIS

---

## Environment Variables for Production

```env
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dbname
SECRET_KEY=<generate with: python -c "import secrets; print(secrets.token_hex(32))">
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
GEMINI_API_KEY=<your key from aistudio.google.com>
OPENAQ_API_KEY=<from openaq.org>
WEATHER_API_KEY=<from openweathermap.org>
```

## CORS Configuration

For production, update `main.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-frontend-domain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Frontend API URL

Update `frontend/vite.config.js` proxy target or set `VITE_API_URL` env variable in production builds.
