# 🏥 Medical Gas Monitor — Beginner's Guide PART 3
## Authentication + Role Portals + Alert Debounce + Remarks + Scenario Simulator

> **What Parts 1 & 2 covered:** The original system — CSV dataset, simulator, PostgreSQL schema, FastAPI backend, WebSocket, alert engine, and the first React dashboard.
>
> **What Part 3 covers:** Every change and addition made after Part 2 — JWT login, Doctor and Nurse portals, alert debounce/hysteresis, remarks, structured acknowledgement, and the realistic scenario-mode simulator.

---

# TABLE OF CONTENTS

1. The New System Architecture
2. Backend: Authentication & JWT
3. Backend: Roles, Wards, Users (database changes)
4. Backend: Alert Debounce & Hysteresis (engine v3)
5. Backend: Remarks System
6. Backend: New & Updated Endpoints (full list)
7. Simulator: Scenario Mode
8. Frontend: Login Page & Auth Routing
9. Frontend: Doctor Portal
10. Frontend: Nurse Portal
11. How Everything Connects (end-to-end walkthrough)
12. Quick Reference — Environment Variables & Commands

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. THE NEW SYSTEM ARCHITECTURE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Before (Part 2)

```
Simulator → POST /readings → Backend → WebSocket → One dashboard (no login)
```

Everyone who opened the browser saw everything. No login, no roles, no restrictions.

## After (Part 3)

```
Simulator → POST /readings (X-API-Key) → Backend → WebSocket (/ws?token=JWT)
                                            ↓
                              Login page → JWT token
                                 ↓              ↓
                          Doctor Portal    Nurse Portal
                         (sees all wards)  (sees own ward only)
```

Now there is a **login page**. The system has two types of users:
- **DOCTOR** — sees all wards, can resolve alerts, can respond to escalations
- **NURSE** — sees only their own ward, can acknowledge and escalate alerts

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. BACKEND: AUTHENTICATION & JWT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## What is Authentication?

Authentication = "Who are you?" — proving your identity.

In a hospital system, this is critical. A random person should NOT be able to see patient data or acknowledge alerts.

## What is a JWT (JSON Web Token)?

JWT is like a **tamper-proof ID card**. Here's the analogy:

> Imagine you go to a hospital reception. You show your ID, they verify it, then give you a laminated visitor badge. Every door scanner in the hospital just reads the badge — it doesn't call reception every time. But if someone tries to fake a badge, the scanner immediately detects it's fake because only reception knows the secret to make a valid badge.

A JWT works the same way:
1. You send your username + password to `POST /auth/login`
2. The backend verifies them and creates a JWT token (the "badge")
3. You include this token in every API request: `Authorization: Bearer <token>`
4. The backend verifies the token on each request without hitting the database

## File: `backend/app/security.py`

This is a **new file** created in Part 3. It contains all security logic.

```python
from passlib.context import CryptContext
from jose import jwt

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

# JWT creation
def create_access_token(data: dict) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.access_token_expire_hours)
    payload["exp"] = expire
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
```

### Why bcrypt for passwords?

NEVER store passwords as plain text. bcrypt is a **one-way hashing function**:
- `"Doctor@123"` → `"$2b$12$jTAONDFDQ0uwu..."` (60 random-looking characters)
- You cannot reverse this. Ever.
- Every time you hash the same password, it looks different (random "salt" is added)
- To verify: hash what the user typed and compare with the stored hash

### The dependency functions

```python
async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)) -> dict:
    # Decodes the JWT, looks up the user in DB, returns their info
    # Raises HTTP 401 if token is missing or invalid

def require_role(role: str):
    # Returns a dependency that raises 403 if user doesn't have that role
    # Usage: @router.get("/doctors-only", dependencies=[Depends(require_role("DOCTOR"))])

async def require_any_role(user=Depends(get_current_user)) -> dict:
    # Passes through as long as any valid JWT is present

def assert_ward_access(user: dict, ward_id: int) -> None:
    # Raises 403 if a NURSE tries to access another ward
    # DOCTOR passes always

async def get_ws_user(token: str) -> Optional[dict]:
    # Used by the WebSocket endpoint to validate the ?token= query param
```

## File: `backend/app/routers/auth.py`

Three endpoints:

### `POST /auth/login`

```
Request:  { "username": "dr.sharma", "password": "Doctor@123", "role": "DOCTOR" }
Response: { "access_token": "eyJ...", "token_type": "bearer",
            "user": { "id": 1, "name": "Dr. Sharma", "username": "dr.sharma",
                      "role": "DOCTOR", "ward_id": null, "ward_name": null } }
```

**What the backend checks:**
1. Does this username exist in the `users` table?
2. Does the password match the stored bcrypt hash?
3. Does the user's `role` in the database match the `role` they selected on the login form?

If any of these fail → **401 "Invalid credentials or role"** (same message for all three — don't reveal which one failed, for security).

### `GET /auth/me`

Validates the JWT and returns the current user's profile. Used on app load to restore a previous session.

### `POST /auth/logout`

Stateless — the backend just returns 200. The client deletes the token from sessionStorage. JWT tokens cannot be "revoked" on the backend without a token blacklist (which adds complexity), so logout is purely client-side.

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. BACKEND: ROLES, WARDS, USERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## New Database Tables

### `wards` table
```sql
CREATE TABLE wards (
    id         SERIAL PRIMARY KEY,
    name       VARCHAR(100) NOT NULL UNIQUE,  -- "ICU", "General Ward"
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `users` table
```sql
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,        -- "Dr. Sharma"
    username      VARCHAR(60)  NOT NULL UNIQUE, -- "dr.sharma"
    password_hash TEXT         NOT NULL,        -- "$2b$12$..."
    role          VARCHAR(10)  NOT NULL CHECK (role IN ('DOCTOR','NURSE')),
    ward_id       INTEGER      REFERENCES wards(id),  -- NULL for doctors
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

### `alert_debounce` table (new in v3)
```sql
CREATE TABLE alert_debounce (
    device_id       VARCHAR(20) NOT NULL,
    parameter       VARCHAR(20) NOT NULL,  -- 'pressure' or 'purity'
    abnormal_streak INTEGER     NOT NULL DEFAULT 0,
    normal_streak   INTEGER     NOT NULL DEFAULT 0,
    normal_since    TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (device_id, parameter)
);
```
This stores per-device, per-parameter counters so the alert engine knows how many consecutive readings it has seen. Without this table, a backend restart would reset all counters.

### `alert_remarks` table (new in v3)
```sql
CREATE TABLE alert_remarks (
    id         SERIAL PRIMARY KEY,
    alert_id   INTEGER      NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    user_id    INTEGER      REFERENCES users(id) ON DELETE SET NULL,
    role       VARCHAR(10)  NOT NULL,   -- 'DOCTOR' or 'NURSE'
    text       VARCHAR(500) NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

### New columns on `alerts`
```sql
ALTER TABLE alerts ADD COLUMN acknowledged_by   INTEGER REFERENCES users(id);
ALTER TABLE alerts ADD COLUMN acknowledged_note TEXT;
ALTER TABLE alerts ADD COLUMN escalated_at      TIMESTAMPTZ;
ALTER TABLE alerts ADD COLUMN escalated_by      INTEGER REFERENCES users(id);
ALTER TABLE alerts ADD COLUMN escalation_note   TEXT;
ALTER TABLE alerts ADD COLUMN escalation_status VARCHAR(20) DEFAULT 'NONE'
                                  CHECK (escalation_status IN ('NONE','PENDING','RESPONDED'));
ALTER TABLE alerts ADD COLUMN responded_by      INTEGER REFERENCES users(id);
ALTER TABLE alerts ADD COLUMN responded_at      TIMESTAMPTZ;
ALTER TABLE alerts ADD COLUMN resolved_by       INTEGER REFERENCES users(id);
-- resolved_by = NULL means auto-resolved by the engine
-- resolved_by = user_id means manually resolved by a doctor
```

## Seed Data (auto-inserted on startup)

`backend/app/db/database.py` now calls `_seed()` on every startup. It inserts data **only if each table is empty** (using `ON CONFLICT DO NOTHING`):

| What | Data |
|---|---|
| Wards | ICU, General Ward |
| Devices | D001→ICU/ICU Bed 1, D002→ICU/ICU Bed 2, D003→General Ward/Ward Bed 1, D004→General Ward/Ward Bed 2 |
| Users | dr.sharma (DOCTOR), nurse.priya (NURSE, ICU), nurse.anita (NURSE, General Ward) |

## Role-Based Data Scoping

Every data endpoint now checks the JWT and filters accordingly:

| Endpoint | DOCTOR sees | NURSE sees |
|---|---|---|
| `GET /devices` | All devices (optional `?ward_id=`) | Only own ward |
| `GET /readings` | All readings | Only own ward |
| `GET /alerts` | All alerts | Only own ward |
| `GET /alerts/history` | All resolved | Own ward resolved |
| `GET /wards` | All wards | Own ward only |
| `GET /handover/summary` | ❌ 403 | Own ward last 8h |
| `GET /stats/overview` | ✅ | ❌ 403 |

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. BACKEND: ALERT DEBOUNCE & HYSTERESIS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## The Problem (Why the Old Engine Was Unrealistic)

The original engine (Part 2) was simple:
- First abnormal reading → **alert opens immediately**
- First normal reading → **alert closes immediately**

In real life, this creates "flapping" — alerts open and close within seconds when a sensor has a brief spike. Nurses would be overwhelmed by hundreds of meaningless alerts.

## The Solution: Debounce + Hysteresis

These are two separate concepts borrowed from electronics:

### Debounce (opening the alert)

> Like a door sensor that only triggers the alarm if the door is held open for 3 full seconds — not if it's just nudged.

**Config:** `ALERT_OPEN_AFTER_READINGS=3`

The engine now **counts consecutive abnormal readings**. Only after 3 in a row does it open an alert. A single spike is silently ignored.

```
Reading 1: 35 PSI (LOW)  → streak=1, no alert yet
Reading 2: 37 PSI (LOW)  → streak=2, no alert yet
Reading 3: 33 PSI (LOW)  → streak=3 ≥ 3 → ALERT CREATED ✅
```

If a normal reading comes in during the streak, the counter resets:
```
Reading 1: 35 PSI (LOW)  → streak=1
Reading 2: 72 PSI (OK)   → streak reset to 0
Reading 3: 36 PSI (LOW)  → streak=1 (starts over)
```

### Hysteresis (closing the alert)

> Like a thermostat that only turns off the heater after the room has been warm for 5 minutes — not if it just flickered to the right temperature once.

**Config:** `ALERT_CLOSE_AFTER_READINGS=5` and `ALERT_CLOSE_AFTER_SECONDS=20`

An open alert closes only after **5 consecutive normal readings** OR **20 seconds of continuous normal readings** — whichever comes first.

```
Alert is OPEN for D002 pressure...

Reading 1: 72 PSI (OK) → normal_streak=1, normal_since=10:05:00
Reading 2: 68 PSI (OK) → normal_streak=2
Reading 3: 75 PSI (OK) → normal_streak=3
Reading 4: 31 PSI (LOW) → ABNORMAL! normal_streak reset to 0, normal_since=None
Reading 5: 70 PSI (OK) → normal_streak=1, normal_since=10:05:20
...20 seconds pass...
Reading 6: 71 PSI (OK) → elapsed=22s ≥ 20s → ALERT AUTO-RESOLVED ✅
```

## How It's Stored

The counters are stored in the `alert_debounce` table (one row per device+parameter):

```
device_id | parameter | abnormal_streak | normal_streak | normal_since
----------|-----------|-----------------|---------------|-------------
D002      | pressure  | 0               | 3             | 2024-01-15 10:05:20
D001      | purity    | 2               | 0             | NULL
```

This means if the backend restarts mid-fault, the streaks survive. Without this, every restart would reset all counters and potentially miss an alert.

## File: `backend/app/alert_engine/engine.py` (v3)

The key function `_process_parameter()` now has this logic:

```python
async def _process_parameter(conn, device_id, value, status, parameter, ...):
    # 1. Load debounce state from DB
    db = await _get_debounce(conn, device_id, parameter)

    # 2. Find any open alert
    open_alert = await conn.fetchrow("SELECT ... FROM alerts WHERE ...")

    if status == "NORMAL":
        abnormal_streak = 0        # reset abnormal counter
        if open_alert:
            normal_streak += 1
            if normal_since is None: normal_since = timestamp

            elapsed = (timestamp - normal_since).total_seconds()
            should_close = (normal_streak >= CLOSE_AFTER_READINGS or
                            elapsed >= CLOSE_AFTER_SECONDS)

            if should_close:
                # AUTO-RESOLVE the alert
                UPDATE alerts SET status='RESOLVED' ...
                normal_streak = 0; normal_since = None

    else:  # ABNORMAL
        normal_streak = 0; normal_since = None   # reset normal counter
        abnormal_streak += 1

        if open_alert:
            # Update running stats (max/min/current)
            UPDATE alerts SET current_value=..., max_value=...

        elif abnormal_streak >= OPEN_AFTER_READINGS:
            # OPEN a new alert
            INSERT INTO alerts ...
            abnormal_streak = 0   # reset after opening

    # 3. Save updated counters back to DB
    await _set_debounce(conn, device_id, parameter, abnormal_streak, normal_streak, normal_since)
```

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 5. BACKEND: REMARKS SYSTEM
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## What Are Remarks?

After an alert resolves (either automatically or manually), clinical staff need a way to record what happened for the medical record. This is the **remarks system**.

Think of it like a physical logbook where nurses and doctors write notes after each incident: "Checked supply line at 10:15, found kinked pipe, straightened it. Patient stable throughout."

## Who Can Add Remarks?

- **DOCTOR** — can add remarks on ANY alert in any ward, at ANY status (active, acknowledged, or resolved)
- **NURSE** — can add remarks on alerts in their own ward only, at ANY status

## The `needs_remark` Flag

When `GET /alerts/history` is called, each returned alert now includes:
```json
{
  "id": 42,
  "status": "RESOLVED",
  "remark_count": 0,
  "needs_remark": true,    ← true if RESOLVED and zero remarks
  "last_remark": null
}
```

The frontend uses this to show an amber "Recommended" badge on alerts that haven't been remarked yet.

## New Endpoints

### `POST /alerts/{id}/remarks`
```
Request:  { "text": "Checked supply line, patient stable throughout." }
Response: { "id": 1, "alert_id": 42, "author": "Dr. Sharma",
            "role": "DOCTOR", "text": "...", "created_at": "..." }
```
Also logs a `REMARK_ADDED` event in the `alert_events` audit table and broadcasts a `alert_remark_added` WebSocket event (ward-scoped for nurses, all for doctors).

### `GET /alerts/{id}/remarks`
```
Response: [
  { "id": 1, "author": "Nurse Priya", "role": "NURSE",
    "text": "Noticed on my rounds at 14:20", "created_at": "..." },
  { "id": 2, "author": "Dr. Sharma", "role": "DOCTOR",
    "text": "Reviewed, no clinical impact.", "created_at": "..." }
]
```
Ordered oldest first. Ward-scoped for nurses.

## Changes to `alert_events` CHECK Constraint

The `alert_events` table has a CHECK constraint listing allowed event types. `REMARK_ADDED` was added. The migration handles this carefully:

```sql
-- 1. Find and drop the old constraint (its auto-generated name may vary)
SELECT conname FROM pg_constraint WHERE conrelid='alert_events'::regclass AND contype='c';
EXECUTE 'ALTER TABLE alert_events DROP CONSTRAINT ' || v_cname;

-- 2. Add the new constraint with REMARK_ADDED included
ALTER TABLE alert_events ADD CONSTRAINT alert_events_event_type_check_v3
    CHECK (event_type IN ('CREATED','UPDATED','ACKNOWLEDGED','ESCALATED',
                          'AUTO_ESCALATED','RESPONDED','RESOLVED','AUTO_RESOLVED',
                          'REMARK_ADDED'));
```

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 6. BACKEND: COMPLETE ENDPOINT REFERENCE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Auth endpoints (public — no JWT needed)
| Method | Path | Description |
|---|---|---|
| POST | `/auth/login` | Login, returns JWT + user info |
| GET | `/auth/me` | Get current user (requires JWT) |
| POST | `/auth/logout` | Stateless logout (requires JWT) |

## Data endpoints (all require JWT Bearer token)
| Method | Path | Role | Description |
|---|---|---|---|
| GET | `/devices` | ANY | List devices (nurse: own ward; doctor: all or ?ward_id=) |
| GET | `/readings` | ANY | List readings (ward-scoped) |
| GET | `/wards` | ANY | List wards (nurse: own; doctor: all) |
| GET | `/alerts` | ANY | List alerts with `remark_count` + `last_remark` |
| GET | `/alerts/history` | ANY | Resolved alerts with `needs_remark` flag; supports `?needs_remark=true` |
| GET | `/alerts/{id}` | ANY | Single alert + its readings |
| GET | `/alerts/{id}/events` | ANY | Audit trail (ward-scoped) |
| GET | `/alerts/{id}/remarks` | ANY | List remarks (ward-scoped) |
| POST | `/alerts/{id}/remarks` | ANY | Add remark (any alert status) |
| POST | `/alerts/{id}/acknowledge` | ANY | Acknowledge (nurse: note required, own ward; doctor: structured note) |
| POST | `/alerts/{id}/escalate` | NURSE | Escalate to doctor (own ward, note required) |
| POST | `/alerts/{id}/respond` | DOCTOR | Respond to escalation (note required) |
| POST | `/alerts/{id}/resolve` | DOCTOR | Manual resolve |
| GET | `/handover/summary` | NURSE | Shift summary for own ward (last 8h) |
| GET | `/stats/overview` | DOCTOR | Cross-ward device + alert counts |

## Simulator endpoint (API key gated — no JWT)
| Method | Path | Header | Description |
|---|---|---|---|
| POST | `/readings` | `X-API-Key: sim-secret-key-2024` | Ingest sensor reading |

## WebSocket
| URL | Description |
|---|---|
| `ws://localhost:8000/ws?token=<JWT>` | Real-time events (ward-scoped per role) |

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 7. SIMULATOR: SCENARIO MODE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## File: `simulator/simulator.py` (v2)

### The Problem with the Old Simulator

The old simulator picked **random rows** from the CSV — including abnormal rows. This meant:
- A device could flip between NORMAL and LOW/HIGH on every reading
- Alerts opened and closed every few seconds
- Staff had no time to acknowledge anything
- The debounce counters never reached 3 because a normal reading would always reset them

### Scenario Mode (default: `SIM_MODE=scenario`)

**Normal behaviour:** Every device sends only NORMAL readings (CSV rows with pressure 40–100 and purity 93–99) every 3–5 seconds.

**Fault injection:** Every 90–180 seconds, the simulator automatically picks ONE device and ONE metric (pressure or purity), then sends abnormal readings for 60–120 seconds.

```
10:00:03  D001  P[  OK   ] 72.4 PSI   O[  OK   ] 96.1%
10:00:07  D002  P[  OK   ] 68.3 PSI   O[  OK   ] 95.8%
10:00:11  D003  P[  OK   ] 71.0 PSI   O[  OK   ] 97.2%
...2 minutes pass...

🔴  FAULT: D002 PRESSURE LOW  duration=87s

10:02:15  D002  P[⚠ LOW-P] 33.2 PSI   O[  OK   ] 95.8%  ← reading 1/3 (no alert)
10:02:19  D002  P[⚠ LOW-P] 31.8 PSI   O[  OK   ] 95.6%  ← reading 2/3 (no alert)
10:02:23  D002  P[⚠ LOW-P] 34.1 PSI   O[  OK   ] 95.9%  ← reading 3/3 → ALERT CREATED
...87 seconds of low pressure readings...
10:03:42  D002  P[  OK   ] 71.5 PSI   O[  OK   ] 96.0%  ← reading 1 normal
...5 consecutive normal or 20s later...
                                                          → ALERT AUTO-RESOLVED
```

### How Fault Values Are Generated

```python
def _abnormal_pressure(fault_type: str) -> float:
    if fault_type == "LOW":
        base = random.uniform(20.0, 38.0)   # safely below 40 PSI threshold
    else:  # HIGH
        base = random.uniform(102.0, 130.0) # safely above 100 PSI threshold
    return round(base + random.uniform(-1.5, 1.5), 2)  # add small variation
```

The `±1.5` variation makes the readings look like real sensor data — not a flat line.

### Random Mode (old behaviour)
Set `SIM_MODE=random` to get the old random-row behaviour. Useful for stress testing.

### Manual Fault Injection

**Option 1: Press F + Enter** in the terminal while the simulator is running.

**Option 2: Start with `--fault-now`** flag:
```powershell
python simulator.py --fault-now
```
This triggers a fault immediately on startup — useful for demos.

### Configuration (environment variables)
| Variable | Default | Meaning |
|---|---|---|
| `SIM_MODE` | `scenario` | `scenario` or `random` |
| `MIN_DELAY` | `3` | Min seconds between readings |
| `MAX_DELAY` | `5` | Max seconds between readings |
| `FAULT_INTERVAL_MIN` | `90` | Min seconds between faults |
| `FAULT_INTERVAL_MAX` | `180` | Max seconds between faults |
| `FAULT_DURATION_MIN` | `60` | Min seconds a fault lasts |
| `FAULT_DURATION_MAX` | `120` | Max seconds a fault lasts |

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 8. FRONTEND: LOGIN PAGE & AUTH ROUTING
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## New Files Created

```
frontend/src/
├── context/AuthContext.jsx        ← stores token + user, exposes login/logout
├── hooks/useAuth.js               ← convenience hook: import this everywhere
├── api/auth.js                    ← raw fetch calls for /auth/login and /auth/me
├── api/client.js                  ← updated: attaches Bearer token, builds WS URL
├── components/auth/
│   ├── LoginForm.jsx              ← the form itself
│   ├── LoginIllustration.jsx      ← left panel: branding + SVG illustration
│   ├── RoleSelector.jsx           ← Doctor / Nurse selector cards
│   └── DemoCredentials.jsx        ← collapsible hint with "Fill" button
├── components/routing/
│   └── ProtectedRoute.jsx         ← redirects if not authenticated or wrong role
├── pages/Login.jsx                ← full split-screen login page
└── config.js                      ← AUTO_ESCALATE_MINUTES + threshold constants
```

## How Auth State Works (`AuthContext.jsx`)

```
App loads
   ↓
Check sessionStorage for 'medigas_token'
   ↓ (if found)
GET /auth/me with that token
   ↓ (200 OK)         ↓ (401 Unauthorized)
Store user + token   Clear token, go to /login
   ↓
Show the right portal
```

Token is stored in **sessionStorage** (not localStorage). This means:
- ✅ Survives page refresh
- ✅ Each browser tab has its own session
- ❌ Closing the browser/tab clears it (safer for hospital computers)

## How Routing Works (`App.jsx`)

```jsx
<BrowserRouter>
  <AuthProvider>
    <Routes>
      <Route path="/login"    element={<Login />} />
      <Route path="/doctor/*" element={<ProtectedRoute role="DOCTOR"><DoctorApp /></ProtectedRoute>} />
      <Route path="/nurse/*"  element={<ProtectedRoute role="NURSE"><NurseApp /></ProtectedRoute>} />
      <Route path="/"         element={<RootRedirect />} />
      <Route path="*"         element={<Navigate to="/login" />} />
    </Routes>
  </AuthProvider>
</BrowserRouter>
```

`ProtectedRoute` handles three cases:
1. **Loading** (restoring session) → shows skeleton screen, doesn't redirect yet
2. **Not authenticated** → redirects to `/login`
3. **Wrong role** (doctor visits `/nurse`) → redirects to their own portal `/doctor`

## The Login Page Layout

```
┌──────────────────────────────────────────────┐
│   Left panel (55%)     │   Right panel (45%)  │
│                        │                      │
│   MEDIGAS logo         │   Welcome back        │
│                        │   Sign in to portal   │
│   "Safer Gas Supply.   │                      │
│    Faster Response."   │  [Doctor] [Nurse]    │
│                        │   role selector      │
│   SVG illustration:    │                      │
│   gas cylinder,        │   Username ________  │
│   pipeline, gauges,    │   Password ________  │
│   hospital building    │   [show/hide eye]    │
│                        │                      │
│   Feature chips:       │  ☐ Remember username │
│   • Live monitoring    │                      │
│   • Instant alerts     │  [Sign in as Doctor] │
│   • Role-based access  │                      │
│                        │  ▼ Demo credentials  │
└──────────────────────────────────────────────┘
```

## api/client.js — Updated

The API client now:
1. Reads the JWT from sessionStorage and adds `Authorization: Bearer <token>` to every request
2. On any 401 response, fires a `medigas:logout` event (AuthContext listens and redirects)
3. Builds WebSocket URL as `ws://localhost:8000/ws?token=<JWT>`

```javascript
export const api = {
  get:  (path) => request(path, { method: 'GET' }),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),

  // WS URL with JWT token
  wsUrl: () => {
    const token = sessionStorage.getItem('medigas_token');
    return `ws://localhost:8000/ws?token=${encodeURIComponent(token)}`;
  }
};
```

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 9. FRONTEND: DOCTOR PORTAL
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Entry Point: `portals/doctor/DoctorApp.jsx`

This replaces the old standalone `App.jsx` dashboard. It:
- Mounts at `/doctor/*`
- Only accessible by users with role `DOCTOR`
- Renders the full Shell (Sidebar + TopBar + main content)
- Passes `wardId` state to `useDashboardData` for the ward filter

```jsx
export default function DoctorApp() {
  const [selectedWard, setSelectedWard] = useState(null);  // null = all wards

  const { devices, alerts, ... } = useDashboardData({ wardId: selectedWard });

  return (
    <Shell ... wards={wards} selectedWard={selectedWard} onWardChange={setSelectedWard}>
      {/* Overview / Devices / Alerts / Analytics tabs */}
    </Shell>
  );
}
```

## What Changed vs the Original Dashboard

### Sidebar
- Added **"Doctor Portal"** tag under the logo
- Bottom now shows **real user name + initials avatar** (from `useAuth()`)
- **Logout button** calls `logout()` and navigates to `/login`
- Alert badge turns **red and pulses** when there are pending escalations

### TopBar
- **"Admin / Hospital Admin"** replaced with real name from JWT (e.g. "Dr. Sharma")
- **Ward filter dropdown** added: All Wards / ICU / General Ward (fetched from `GET /wards`)
- Changing the ward re-fetches devices, readings, and alerts for that ward only
- Bell icon **pulses red** when there are pending escalations

### HeroBanner
- Subtitle now says **"Welcome back, Dr. Sharma"** (first name from JWT)

### useDashboardData.js — Updated
- Now calls `api/client.js` (authenticated) instead of raw `fetch`
- Accepts `{ wardId }` prop and passes it as `?ward_id=` to all REST calls
- Handles new WS events: `alert_escalated`, `alert_responded`, `alert_remark_added`
- Exposes `respondAlert`, `pendingEscalations`, `wards` in return value

### useWebSocket.js — Updated
- Now connects to `api.wsUrl()` which includes `?token=<JWT>`
- Backend validates this token and tags the connection with role/ward
- Doctors receive ALL events; nurses receive only own-ward events

## New: EscalationsPanel (`components/cards/EscalationsPanel.jsx`)

A dedicated panel in the Overview right column showing alerts with `escalation_status = 'PENDING'`.

```
┌─────────────────────────────────────┐
│ 🔴 Escalations        2 pending     │
├─────────────────────────────────────┤
│ D002 · ICU Bed 2            12m     │
│ LOW PRESSURE                        │
│ "Pressure not recovering after 2min"│
│ [Send Response] [Resolve]           │
├─────────────────────────────────────┤
│ D001 · ICU Bed 1  ⚡ Auto    3m    │
│ LOW PURITY                          │
│ [Send Response] [Resolve]           │
└─────────────────────────────────────┘
```

- **Respond** opens a modal where the doctor types a response note → calls `POST /alerts/{id}/respond`
- **Resolve** calls `POST /alerts/{id}/resolve`
- **Auto badge** appears when `escalated_by = NULL` (auto-escalated by the engine, not a nurse)
- The panel shows a pulsing red dot when there are pending escalations

## New: Structured Acknowledge (`DoctorAcknowledgeModal.jsx`)

When a doctor clicks "Acknowledge" on an alert, instead of a simple text box they get a structured form:

```
┌──────────────────────────────────────────────┐
│ Acknowledge Alert — Clinical Record          │
├──────────────────────────────────────────────┤
│ D002 · ICU Bed 2 · LOW PRESSURE · 33.2 PSI  │
├──────────────────────────────────────────────┤
│ Clinical Assessment * (free text)            │
│ [Patient stable, monitoring continued...]    │
│                                              │
│ Action Taken *                               │
│ [Reviewed and monitored          ▼]          │
│                                              │
│ Patient Condition                            │
│ [Normal] [Stable] [Unstable] [Critical]      │
│                                              │
│ Follow-up Required?                          │
│ [No] [Yes]                                   │
│                                              │
│              [Cancel] [Acknowledge & Record] │
└──────────────────────────────────────────────┘
```

All fields are compiled into a formatted `note` string:
```
[Clinical Assessment] Patient stable throughout. Pressure dipped briefly.
[Action Taken] Reviewed and monitored
[Patient Condition] Stable
[Follow-up] Not required
```

This is stored in `alerts.acknowledged_note` and shown on the alert card for the record.

## New: RemarksPanel (`components/cards/RemarksPanel.jsx`)

Appears at the bottom of every alert card regardless of status. Doctors can:
- See all existing remarks (from both doctors and nurses)
- Add a new remark (inline textarea, no modal needed)
- See an amber "Recommended" badge if the alert is resolved with zero remarks

```
┌─────────────────────────────────────────────┐
│ 💬 2 remarks                           ▼   │
├─────────────────────────────────────────────┤
│ Nurse Priya (NURSE) — 5m ago                │
│ "Checked wall outlet, seems fine now"        │
│                                             │
│ Dr. Sharma (DOCTOR) — 2m ago                │
│ "Reviewed, no clinical impact. Monitor."    │
├─────────────────────────────────────────────┤
│ Add a clinical remark…                      │
│ [_______________________________] 0/500     │
│                                  [Add Remark]│
└─────────────────────────────────────────────┘
```

## Doctor Alerts Page — New Features

- **Escalated tab** added (Active / Acknowledged / **Escalated** / Resolved)
- Escalation detail strip below each card shows the nurse's note and status
- **Audit timeline** (collapsible) shows every event with author, note, and timestamp
- `RemarksPanel` at bottom of every card
- `acknowledged_note` displayed as a formatted clinical record block

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 10. FRONTEND: NURSE PORTAL
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Entry Point: `portals/nurse/NurseApp.jsx`

Mounts at `/nurse/*`. Only accessible by NURSE role. Three tabs: **Ward, Alerts, History**.

## File Structure

```
portals/nurse/
├── NurseApp.jsx                  ← shell: sidebar + topbar + tab routing
├── hooks/
│   └── useNurseData.js           ← data hook: WS + REST, ward-scoped
├── components/
│   ├── NurseSidebar.jsx          ← Ward/Alerts/History nav, user info, logout
│   ├── NurseTopBar.jsx           ← ward chip, search, sound toggle, bell
│   ├── StatusBanner.jsx          ← full-width green/red banner
│   ├── BedCard.jsx               ← large card: pressure + O₂ purity, both with gauges
│   ├── PressureGauge.jsx         ← horizontal bar gauge with safe zone
│   ├── ActionChecklist.jsx       ← collapsible checklist for LOW/HIGH pressure/purity
│   ├── AutoEscalateTimer.jsx     ← countdown: "Auto-escalates in 01:30"
│   ├── EscalationStatus.jsx      ← amber "waiting" / green "doctor responded"
│   ├── AcknowledgeModal.jsx      ← required note + quick-note chips
│   ├── EscalateModal.jsx         ← required escalation reason
│   ├── NurseAlertCard.jsx        ← full alert card combining all above
│   ├── ShiftHandoverCard.jsx     ← GET /handover/summary with Print button
│   ├── HistoryTable.jsx          ← history table with drawer for event timeline
│   └── AlarmSound.js             ← Web Audio API alarms
└── pages/
    ├── WardPage.jsx              ← Ward tab
    ├── NurseAlerts.jsx           ← Alerts tab
    └── NurseHistory.jsx          ← History tab
```

## Tab 1: Ward Page

```
┌─────────────────────────────────────────────────────────────────┐
│  🔴 1 alert needs attention  ·  Last updated: 10:05:32          │
│  Pressure: 40–100 PSI · O₂ Purity: 93–99% · LOW PRESSURE       │
├──────────────────────────────────────────────────────────────────┤
│  [2 Devices]  [1 Normal]  [1 Low]  [0 High]                     │
│  Pressure safe: 40–100 PSI  ·  O₂ Purity safe: 93–99%          │
├────────────────────────────────┬────────────────────────────────┤
│                                │  Needs Attention (sticky)      │
│  ICU Bed 1  D001  ● NORMAL    │                                │
│  PRESSURE        O₂ PURITY   │  D002 · ICU Bed 2              │
│  72.4 PSI ●      96.1% ●     │  LOW PRESSURE · 33.2 PSI       │
│  [gauge bar]     [gauge bar] │  [Acknowledge] [Escalate]       │
│  [sparkline]     [sparkline] │                                │
│                                │  (scrollable if many alerts)   │
│  ICU Bed 2  D002  ● LOW       │                                │
│  PRESSURE        O₂ PURITY   │                                │
│  33.2 PSI 🔴     95.8% ●     │                                │
│  [gauge bar]     [gauge bar] │                                │
│  [sparkline]     [sparkline] │                                │
├────────────────────────────────┴────────────────────────────────┤
│  Recent Activities (full width, 2-col grid)                      │
│  🔔 D002 pressure alert      ✅ D001 alert auto-resolved        │
│  10:02:23                    09:58:41                           │
│  [Show 8 more]                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### BedCard — Both Parameters

Each bed card shows **both** pressure AND O₂ purity with:
- A large number (3xl font) in the correct status color
- A status pill (Normal/Low/High)
- A `PressureGauge` bar showing safe zone (green) and current value marker
- A `Sparkline` of the last 20 readings
- Pulsing border when a new reading arrives

### ActivityStrip Improvements
- Shows 6 events by default, "Show N more" toggle
- **Burst collapsing**: identical auto-resolved events for the same device within 10 seconds are collapsed to one row with a `×3` count badge
- 2-column grid on desktop, 3-column at 2xl, 1-column on mobile

## Tab 2: Alerts Page

Filter chips: **Active / Acknowledged / Escalated** × **All / Pressure / Purity**

### NurseAlertCard

Each alert card contains:

1. **Header**: bed label, device ID, parameter badge (🌬 Pressure / 💧 O₂ Purity), status pills, live "active for 03:12" timer
2. **Auto-escalate countdown**: `⏰ Auto-escalates in 01:30` (counts down from `AUTO_ESCALATE_MINUTES`)
3. **Values**: Current / Peak / Safe range
4. **EscalationStatus**: amber "Escalated at 14:32 — Waiting for doctor" or green "Dr. Sharma responded at 14:35"
5. **ActionChecklist** (collapsible, open by default for ACTIVE alerts):

   | Alert Type | Checklist |
   |---|---|
   | LOW_PRESSURE | Check SpO₂, switch to backup, check wall outlet, escalate if no recovery |
   | HIGH_PRESSURE | Check condition + flowmeter, reduce flow if safe, notify doctor, don't adjust pipeline |
   | LOW_PURITY | Check SpO₂ + breathing, switch to backup O₂ source, check concentrator, escalate |
   | HIGH_PURITY | Check delivery device, verify analyser calibration, reduce O₂ if appropriate, notify doctor |

6. **Buttons** (min 48px height for touch):
   - **Acknowledge** → opens AcknowledgeModal (required note + quick chips)
   - **Escalate to Doctor** → opens EscalateModal (required reason + quick chips)
   - NO Resolve button (auto-resolves when readings return to normal)
   - Helper text: "Auto-resolves when pressure returns to 40–100 PSI"

## Tab 3: History Page

Top: **ShiftHandoverCard** (GET /handover/summary)
```
┌────────────────────────────────────────────────────────┐
│ Shift Handover Summary               [↻] [🖨 Print]   │
│ ICU · Last 8 hours                                     │
├──────────┬──────────┬──────────┬──────────────────────┤
│ 4 Total  │ 1 Open   │ 3 Ack'd  │ 1 Escalated          │
├──────────┴──────────┴──────────┴──────────────────────┤
│ ⚠ Unstable at handover: D002                          │
│ Pressure safe: 40–100 PSI  · O₂ Purity safe: 93–99%  │
└────────────────────────────────────────────────────────┘
```

Below: time window filter (Last 8h / 24h / 48h) + history table.

Clicking a row opens a **right-side drawer** with the full event timeline for that alert.

## Real-time Behaviour

- New HIGH alert → **repeated double-beep alarm** (Web Audio API) + browser push notification
- New LOW alert → single soft beep
- Sound can be toggled on/off with the 🔊 button in the top bar
- WebSocket disconnect → **persistent warning banner**: "Connection lost — readings may be outdated"
- Reconnection: exponential backoff (1s → 2s → 4s → ... → 30s max)

## useNurseData.js Hook

The nurse portal's data hook:
- Calls `GET /devices`, `GET /readings`, `GET /alerts` (all ward-scoped by the backend automatically based on the nurse's JWT)
- Handles all 7 WS events: `new_reading`, `alert_created`, `alert_updated`, `alert_resolved`, `alert_acknowledged`, `alert_escalated`, `alert_responded`
- Exposes: `devices`, `alerts`, `activities`, `loading`, `error`, `connected`, `stats`, `acknowledgeAlert`, `escalateAlert`

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 11. END-TO-END WALKTHROUGH
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Here is exactly what happens from a fault starting in the simulator to a doctor adding a remark:

```
Step 1: Simulator (scenario mode)
  → Every 90-180s, picks D002 + PRESSURE + LOW
  → Sends abnormal readings every 3-5s

Step 2: POST /readings (X-API-Key)
  → Backend stores reading in DB
  → Calls process_reading() in engine.py

Step 3: Engine (first 2 abnormal readings)
  → abnormal_streak increments to 1, then 2
  → No alert opened yet (need 3)
  → Saves streak to alert_debounce table

Step 4: Engine (3rd abnormal reading)
  → abnormal_streak reaches 3 ≥ ALERT_OPEN_AFTER_READINGS
  → INSERT INTO alerts (status='ACTIVE', ...)
  → Returns { event: "alert_created", alert_id: 42, ... }

Step 5: WebSocket broadcast
  → Nurse's portal receives alert_created event (ward-scoped)
  → Doctor's portal receives alert_created event (all events)
  → Nurse sees red status banner + bed card border turns red
  → Doctor sees escalations badge + "Needs Attention" count increases
  → If sound enabled: HIGH = repeated alarm, LOW = single beep

Step 6: Nurse acknowledges (after ~2 min if not done)
  → Auto-escalate timer fires: escalation_status = 'PENDING'
  → Doctor sees pulsing red dot on bell + EscalationsPanel shows this alert
  → Nurse can still acknowledge using AcknowledgeModal (note required)

Step 7: Nurse escalates manually (or auto-escalates)
  → POST /alerts/42/escalate { note: "Pressure not recovering..." }
  → Backend sets escalated_by, escalation_status='PENDING'
  → Broadcast: alert_escalated event

Step 8: Doctor responds
  → Sees alert in EscalationsPanel with nurse's note
  → Opens RespondModal, types response note
  → POST /alerts/42/respond { note: "Reviewed, adjust flowmeter." }
  → Backend sets escalation_status='RESPONDED', responded_by=doctor_id
  → Broadcast: alert_responded event
  → Nurse's portal shows green "Dr. Sharma responded at 14:35"

Step 9: Simulator ends fault window
  → Devices return to normal readings
  → Engine receives 5 consecutive normal readings (or 20s elapsed)
  → UPDATE alerts SET status='RESOLVED', resolved_by=NULL
  → Broadcast: alert_resolved event
  → Both portals update instantly

Step 10: Post-resolution remark
  → History tab shows this alert with needs_remark=true (amber badge)
  → Nurse adds remark: "Checked supply line after incident, all clear"
  → Doctor adds remark: "No clinical impact. Monitor for recurrence."
  → POST /alerts/42/remarks
  → Stored in alert_remarks table
  → Visible to both portals in remarks panel
```

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 12. QUICK REFERENCE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## Start Commands

```powershell
# Terminal 1 — Backend
cd "...\medical-gas-monitor\backend"
python -m uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend
cd "...\medical-gas-monitor\frontend"
npm run dev

# Terminal 3 — Simulator (scenario mode)
cd "...\medical-gas-monitor\simulator"
python simulator.py

# Simulator with instant fault (for demo)
python simulator.py --fault-now
```

## Test Accounts

| Username | Password | Role | Ward |
|---|---|---|---|
| `dr.sharma` | `Doctor@123` | DOCTOR | All wards |
| `nurse.priya` | `Nurse@123` | NURSE | ICU (D001, D002) |
| `nurse.anita` | `Nurse@123` | NURSE | General Ward (D003, D004) |

## All Environment Variables (backend/.env)

| Variable | Default | What it does |
|---|---|---|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `medical_gas_db` | Database name |
| `DB_USER` | `postgres` | DB username |
| `DB_PASSWORD` | `postgres123` | DB password |
| `PRESSURE_MIN` | `40` | Low pressure threshold (PSI) |
| `PRESSURE_MAX` | `100` | High pressure threshold (PSI) |
| `JWT_SECRET` | (change me!) | Secret for signing JWT tokens |
| `JWT_ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_HOURS` | `8` | JWT expiry (one shift) |
| `SIMULATOR_API_KEY` | `sim-secret-key-2024` | X-API-Key for simulator |
| `AUTO_ESCALATE_MINUTES` | `3` | Minutes before unacknowledged alert auto-escalates |
| `ALERT_OPEN_AFTER_READINGS` | `3` | Consecutive abnormal readings before alert opens |
| `ALERT_CLOSE_AFTER_READINGS` | `5` | Consecutive normal readings before auto-resolve |
| `ALERT_CLOSE_AFTER_SECONDS` | `20` | Seconds of continuous normal before auto-resolve |

## New Files Added (Part 3)

**Backend:**
- `app/security.py` — JWT + bcrypt + dependency functions
- `app/routers/auth.py` — login, me, logout
- `app/routers/wards.py` — GET /wards
- `app/routers/handover.py` — handover summary, stats overview

**Frontend:**
- `src/config.js` — shared constants
- `src/context/AuthContext.jsx` — auth state provider
- `src/hooks/useAuth.js` — useAuth hook
- `src/api/auth.js` — auth API calls
- `src/pages/Login.jsx` — login page
- `src/components/auth/` — LoginForm, LoginIllustration, RoleSelector, DemoCredentials
- `src/components/routing/ProtectedRoute.jsx` — role-guarded routes
- `src/components/cards/DoctorAcknowledgeModal.jsx` — structured ack form
- `src/components/cards/RemarksPanel.jsx` — inline remarks UI
- `src/portals/doctor/DoctorApp.jsx` — doctor portal shell
- `src/portals/nurse/` — entire nurse portal (21 files)

**Modified:**
- `app/config.py` — new debounce + auth settings
- `app/db/schema.sql` — new tables, migration blocks
- `app/db/database.py` — seed data on startup
- `app/alert_engine/engine.py` — debounce + hysteresis (v3)
- `app/routers/alerts.py` — remarks endpoints, remark_count on list/history
- `app/models/schemas.py` — RemarkIn, RemarkOut models
- `app/ws_manager.py` — role + ward tagged connections
- `app/routers/ws.py` — token required as query param
- `app/routers/readings.py` — X-API-Key gate
- `app/routers/devices.py` — ward filtering
- `app/main.py` — all new routers, escalation background task
- `simulator/simulator.py` — scenario mode, fault injection
- `frontend/src/hooks/useWebSocket.js` — token URL
- `frontend/src/hooks/useDashboardData.js` — auth + ward filter + new events
- `frontend/src/components/layout/TopBar.jsx` — real user + ward filter
- `frontend/src/components/layout/Sidebar.jsx` — Doctor Portal tag + user
- `frontend/src/components/layout/Shell.jsx` — passes ward props
- `frontend/src/components/cards/HeroBanner.jsx` — personalised welcome
- `frontend/src/components/cards/AlertCard.jsx` — DoctorAcknowledgeModal + RemarksPanel
- `frontend/src/pages/Overview.jsx` — EscalationsPanel
- `frontend/src/pages/Alerts.jsx` — Escalated tab + audit timeline
- `frontend/src/App.jsx` — BrowserRouter + AuthProvider + role routing
