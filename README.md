# MedGas Portal 🏥

**Real-time medical gas pipeline monitoring system with role-based Doctor and Nurse portals.**

Built with FastAPI, React 19, PostgreSQL, and WebSockets. Monitors oxygen pressure (PSI) and O₂ purity (%) across hospital wards in real time — alerting clinical staff immediately when readings go outside safe ranges.

---

## Screenshots

| Login | Doctor Portal | Nurse Portal |
|---|---|---|
| Split-screen login with role selector | Full dashboard with escalations panel | Ward view with bed cards and action checklists |

---

## Features

### Core Monitoring
- **Dual-parameter monitoring** — Pressure (safe: 40–100 PSI) and O₂ Purity (safe: 93–99%)
- **Live WebSocket updates** — readings pushed to connected clients in real time
- **Alert debounce** — alerts open only after 3 consecutive abnormal readings (no false alarms from spikes)
- **Hysteresis** — alerts close only after 5 consecutive normal readings or 20 seconds of normal (no premature resolution)
- **Auto-escalation** — unacknowledged alerts auto-escalate to doctors after 3 minutes

### Doctor Portal (`/doctor`)
- Overview dashboard: pressure + O₂ purity trends, status donuts, device cards
- **Ward filter** — filter all data by ICU / General Ward
- **Escalations panel** — pending escalations with nurse notes, Respond + Resolve buttons
- **Structured acknowledgement** — clinical assessment, action taken, patient condition, follow-up fields
- **Remarks** — add/view clinical remarks on any alert (any status)
- Alerts tab with Escalated filter + expandable audit timeline
- Analytics page: histograms, trend charts, avg time to resolve

### Nurse Portal (`/nurse`)
- **Ward tab** — status banner, bed cards (both pressure + purity per bed), sticky "Needs Attention" panel
- **Bed cards** — large gauges, sparklines, color-coded borders (red=HIGH, amber=LOW)
- **Action checklists** — per alert type (LOW/HIGH pressure, LOW/HIGH purity), local checkbox state
- **Acknowledge modal** — required note with quick-note chips
- **Escalate modal** — required reason, notifies doctor immediately
- **Auto-escalate countdown** — "Auto-escalates in 01:30" shown on unacknowledged alerts
- **History tab** — shift handover summary (printable), alert history with event timeline drawer
- **Audio alarms** — Web Audio API beeps (repeated alarm for HIGH, single tone for LOW), toggleable
- Browser push notifications for HIGH alerts

### Auth & Security
- JWT authentication (8-hour expiry — one clinical shift)
- Role-based access: DOCTOR sees all wards; NURSE sees only their own ward
- Passwords hashed with bcrypt
- Simulator uses API key (`X-API-Key`) instead of JWT
- WebSocket authenticated via `?token=<JWT>` query param
- Session stored in `sessionStorage` (cleared when browser closes)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.13, FastAPI, asyncpg |
| Database | PostgreSQL |
| Auth | python-jose (JWT), passlib/bcrypt |
| Frontend | React 19, Vite, Tailwind CSS v4 |
| Charts | Recharts |
| Icons | Lucide React |
| Routing | React Router DOM v7 |
| Simulator | Python, httpx |

---

## Project Structure

```
medgas-portal/
├── backend/
│   ├── app/
│   │   ├── alert_engine/engine.py   ← debounce + hysteresis alert engine
│   │   ├── db/
│   │   │   ├── database.py          ← asyncpg pool + seed data on startup
│   │   │   └── schema.sql           ← idempotent PostgreSQL schema
│   │   ├── models/schemas.py        ← Pydantic models
│   │   ├── routers/
│   │   │   ├── auth.py              ← login, me, logout
│   │   │   ├── alerts.py            ← alerts CRUD + remarks
│   │   │   ├── devices.py           ← device list (ward-scoped)
│   │   │   ├── readings.py          ← ingest + query readings
│   │   │   ├── wards.py             ← ward list
│   │   │   ├── handover.py          ← shift summary, stats overview
│   │   │   └── ws.py                ← WebSocket endpoint
│   │   ├── security.py              ← JWT + bcrypt + dependencies
│   │   ├── ws_manager.py            ← role-aware broadcast
│   │   ├── config.py                ← settings from .env
│   │   └── main.py                  ← FastAPI app + auto-escalation loop
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   └── src/
│       ├── context/AuthContext.jsx  ← JWT state, login/logout
│       ├── hooks/
│       │   ├── useAuth.js
│       │   ├── useDashboardData.js  ← doctor data hook
│       │   └── useWebSocket.js      ← reconnecting WS
│       ├── api/client.js            ← authenticated fetch wrapper
│       ├── pages/                   ← Login, Overview, Devices, Alerts, Analytics
│       ├── components/              ← cards, charts, layout, ui, auth, routing
│       └── portals/
│           ├── doctor/DoctorApp.jsx
│           └── nurse/               ← full nurse portal (21 files)
├── simulator/
│   └── simulator.py                 ← scenario mode with fault injection
├── dataset/
│   └── pressure_data.csv
└── docs/
    ├── project-guide-part1.md       ← dataset, simulator, backend basics
    ├── project-guide-part2.md       ← database, alert engine, full frontend
    └── project-guide-part3.md       ← auth, portals, debounce, remarks
```

---

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 14+ (running locally)

### 1. Database setup

Create the database in PostgreSQL:
```sql
CREATE DATABASE medical_gas_db;
```

### 2. Backend

```bash
cd backend
pip install -r requirements.txt
```

Create `.env` (copy from `.env.example` and fill in your DB password):
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=medical_gas_db
DB_USER=postgres
DB_PASSWORD=your_password

JWT_SECRET=change-me-to-a-long-random-string
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_HOURS=8

SIMULATOR_API_KEY=sim-secret-key-2024
AUTO_ESCALATE_MINUTES=3
ALERT_OPEN_AFTER_READINGS=3
ALERT_CLOSE_AFTER_READINGS=5
ALERT_CLOSE_AFTER_SECONDS=20
```

Start the backend (schema is applied and seed data inserted automatically):
```bash
python -m uvicorn app.main:app --reload --port 8000
```

On first run you'll see:
```
👤  Seeded user: dr.sharma (DOCTOR)
👤  Seeded user: nurse.priya (NURSE)
👤  Seeded user: nurse.anita (NURSE)
✅  Database connected, schema applied, seed checked.
🚀  Auto-escalation background task started.
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`

### 4. Simulator

```bash
cd simulator
python simulator.py
```

Press **F + Enter** to inject a fault immediately for a demo.

Or inject on startup:
```bash
python simulator.py --fault-now
```

---

## Demo Accounts

| Username | Password | Role | Ward |
|---|---|---|---|
| `dr.sharma` | `Doctor@123` | DOCTOR | All wards |
| `nurse.priya` | `Nurse@123` | NURSE | ICU (D001, D002) |
| `nurse.anita` | `Nurse@123` | NURSE | General Ward (D003, D004) |

---

## How Alerts Work

```
Simulator sends abnormal reading
    ↓
Engine checks streak (need 3 consecutive)
    ↓ (streak < 3)        ↓ (streak ≥ 3)
Silent — no alert        ALERT CREATED → WebSocket broadcast
                             ↓
                    Nurse sees red banner + alarm
                    Doctor sees badge + escalations panel
                             ↓
                    After 3 min unacknowledged → AUTO-ESCALATED
                             ↓
                    Simulator returns to normal readings
                    Engine checks close streak (need 5 normal or 20s)
                             ↓
                         ALERT AUTO-RESOLVED
                             ↓
                    Staff add remarks in History tab
```

---

## API Summary

**Auth** — `POST /auth/login` · `GET /auth/me` · `POST /auth/logout`

**Data** — `GET /devices` · `GET /readings` · `GET /wards`

**Alerts** — `GET /alerts` · `GET /alerts/history` · `GET /alerts/{id}` · `GET /alerts/{id}/events` · `GET /alerts/{id}/remarks`

**Alert actions** — `POST /alerts/{id}/acknowledge` · `POST /alerts/{id}/escalate` · `POST /alerts/{id}/respond` · `POST /alerts/{id}/resolve` · `POST /alerts/{id}/remarks`

**Reports** — `GET /handover/summary` · `GET /stats/overview`

**Simulator** — `POST /readings` (X-API-Key, no JWT)

**WebSocket** — `ws://localhost:8000/ws?token=<JWT>`

Full API docs available at `http://localhost:8000/docs` when the backend is running.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `medical_gas_db` | Database name |
| `DB_USER` | `postgres` | DB username |
| `DB_PASSWORD` | — | DB password |
| `JWT_SECRET` | — | Secret for signing JWTs (change in production!) |
| `ACCESS_TOKEN_EXPIRE_HOURS` | `8` | Token expiry (one shift) |
| `SIMULATOR_API_KEY` | `sim-secret-key-2024` | API key for simulator |
| `AUTO_ESCALATE_MINUTES` | `3` | Minutes before auto-escalation |
| `ALERT_OPEN_AFTER_READINGS` | `3` | Consecutive abnormal readings to open alert |
| `ALERT_CLOSE_AFTER_READINGS` | `5` | Consecutive normal readings to close alert |
| `ALERT_CLOSE_AFTER_SECONDS` | `20` | Seconds of normal to close alert |

---

## License

MIT
