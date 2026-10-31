# Medical Gas Monitor — Setup & Run Guide

Complete guide to install dependencies and run all three services locally.

---

## Prerequisites

Make sure these are installed on your machine before starting:

| Tool | Version | Download |
|------|---------|----------|
| Python | 3.10+ | https://python.org/downloads |
| Node.js | 18+ | https://nodejs.org |
| PostgreSQL | 14+ | https://postgresql.org/download |

To verify:
```bash
python --version
node --version
psql --version
```

---

## Project Structure

```
medical-gas-monitor/
├── backend/       ← FastAPI server   (port 3001)
├── frontend/      ← React / Vite app (port 5173)
└── simulator/     ← Node.js sensor simulator
```

---

## Step 1 — PostgreSQL Database Setup

1. Open pgAdmin or psql and create the database:

```sql
CREATE DATABASE medical_gas_db;
```

2. Make sure your PostgreSQL user has access (default is `postgres`).

The backend will **automatically create all tables and seed demo data** on first startup — no manual SQL needed.

---

## Step 2 — Backend Setup

### Navigate to the backend folder:
```powershell
cd medical-gas-monitor/backend
```

### Create and activate a virtual environment (recommended):
```powershell
python -m venv venv
venv\Scripts\activate
```

### Install Python dependencies:
```powershell
pip install -r requirements.txt
```

### Dependencies installed (`requirements.txt`):
| Package | Version | Purpose |
|---------|---------|---------|
| fastapi | 0.111.0 | Web framework |
| uvicorn[standard] | 0.29.0 | ASGI server |
| asyncpg | 0.29.0 | PostgreSQL async driver |
| pydantic | 2.7.1 | Data validation |
| pydantic-settings | 2.2.1 | Config from .env |
| python-dotenv | 1.0.1 | Load .env file |
| python-jose[cryptography] | 3.3.0 | JWT tokens |
| passlib[bcrypt] | 1.7.4 | Password hashing |
| bcrypt | 4.0.1 | Bcrypt backend |
| python-multipart | 0.0.9 | Form data parsing |

### Configure environment variables:

Copy the example env file:
```powershell
copy .env.example .env
```

Edit `.env` and set your PostgreSQL password:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=medical_gas_db
DB_USER=postgres
DB_PASSWORD=your_postgres_password_here

JWT_SECRET=change-me-to-a-long-random-string
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_HOURS=8

SIMULATOR_API_KEY=sim-secret-key-2024

AUTO_ESCALATE_MINUTES=3
ALERT_OPEN_AFTER_READINGS=3
ALERT_CLOSE_AFTER_READINGS=5
ALERT_CLOSE_AFTER_SECONDS=20
```

---

## Step 3 — Frontend Setup

### Navigate to the frontend folder:
```powershell
cd medical-gas-monitor/frontend
```

### Install Node dependencies:
```powershell
npm install
```

### Dependencies installed (`package.json`):
| Package | Version | Purpose |
|---------|---------|---------|
| react | ^19.2.8 | UI framework |
| react-dom | ^19.2.8 | DOM rendering |
| react-router-dom | ^7.18.4 | Client-side routing |
| recharts | ^3.10.1 | Charts and graphs |
| lucide-react | ^1.49.0 | Icons |
| vite | ^8.3.0 | Dev server & bundler |
| tailwindcss | ^4.3.3 | Utility CSS |

---

## Step 4 — Simulator Setup

### Navigate to the simulator folder:
```powershell
cd medical-gas-monitor/simulator
```

### Install Node dependencies:
```powershell
npm install
```

### Dependencies installed:
| Package | Version | Purpose |
|---------|---------|---------|
| axios | ^1.20.0 | HTTP POST to backend |
| csv-parse | ^7.0.3 | Parse pressure_data.csv |

---

## Running the App — 3 Terminals

Open **3 separate terminal windows** and run one command in each.

---

### Terminal 1 — Backend (FastAPI)

```powershell
cd medical-gas-monitor/backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 3001 --reload
```

**Expected output:**
```
✅  Database connected, schema applied, seed checked.
🚀  Auto-escalation background task started.
INFO:     Uvicorn running on http://0.0.0.0:3001
INFO:     Application startup complete.
```

> The backend auto-creates all database tables and seeds demo users on first run.

---

### Terminal 2 — Frontend (React + Vite)

```powershell
cd medical-gas-monitor/frontend
npm run dev
```

**Expected output:**
```
VITE v8.x.x  ready in 435 ms
➜  Local:   http://localhost:5173/
```

Open your browser at: **http://localhost:5173**

---

### Terminal 3 — Simulator (Node.js)

```powershell
cd medical-gas-monitor/simulator
node simulator.js
```

**Expected output:**
```
📂  Loading dataset from: .../pressure_data.csv
✅  Loaded rows for devices: D001, D002, D003, D004
🌐  Backend : http://localhost:3001
⏱️   Delay   : 2000ms – 6000ms

🚀  Starting simulator for D001
🚀  Starting simulator for D002
...
 12:00:01   D001       72.4         NORMAL
 12:00:03   D002       38.1         ⚠️  LOW_PRESSURE
```

The simulator continuously POSTs random sensor readings to the backend, triggering alerts when pressure goes out of range.

---

## Demo Login Credentials

These are automatically seeded into the database on first backend startup.

| Role | Username | Password |
|------|----------|----------|
| Doctor | `dr.sharma` | `Doctor@123` |
| Nurse (ICU) | `nurse.priya` | `Nurse@123` |
| Nurse (General Ward) | `nurse.anita` | `Nurse@123` |

---

## Port Summary

| Service | Port | URL |
|---------|------|-----|
| Backend API | 3001 | http://localhost:3001 |
| Frontend | 5173 | http://localhost:5173 |
| PostgreSQL | 5432 | localhost:5432 |

---

## Common Errors

### `uvicorn` not recognized
Use `python -m uvicorn` instead of just `uvicorn`:
```powershell
python -m uvicorn app.main:app --host 0.0.0.0 --port 3001 --reload
```

### `Failed to fetch` on login page
- Make sure the backend (Terminal 1) is running
- Make sure you started Vite (Terminal 2) **after** making any config changes
- Hard refresh the browser: `Ctrl + Shift + R`

### Database connection error
- Confirm PostgreSQL is running
- Check `DB_PASSWORD` in `backend/.env` matches your postgres user password
- Confirm the database `medical_gas_db` exists

### Simulator 422 errors
- Make sure the backend is fully started before running the simulator
- Check the `SIMULATOR_API_KEY` in `.env` matches the one in `simulator.js` (default: `sim-secret-key-2024`)
