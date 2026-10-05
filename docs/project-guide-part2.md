# 🏥 Medical Gas Monitor — Beginner's Guide PART 2
## Database + Alert Engine + All Routers + Complete Frontend

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PART 4: DATABASE FILES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## What is a Database? (Absolute Beginner)

A database is like a collection of Excel spreadsheets, but:
- Much faster (can handle millions of rows)
- Multiple programs can read/write simultaneously
- Data is permanent — survives restarts and power cuts
- You query it using SQL language (`SELECT`, `INSERT`, `UPDATE`)

We use **PostgreSQL** — a free, powerful, open-source database.

The database runs as a separate program on your computer (usually auto-starts with Windows). Your backend Python code CONNECTS to it, like how you connect to WiFi.

---

## `backend/app/db/schema.sql`

### What Type of File Is This?
A `.sql` file containing SQL commands that create the database structure (tables and indexes).

### What is a Table?
Think of each table as one Excel sheet. Our database has **4 tables**:

---

### TABLE 1: `devices`

```sql
CREATE TABLE IF NOT EXISTS devices (
    device_id     VARCHAR(20) PRIMARY KEY,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**`CREATE TABLE IF NOT EXISTS`** = "Create this table, but only if it doesn't already exist." Safe to run multiple times.

**Columns:**
- `device_id VARCHAR(20) PRIMARY KEY` — text up to 20 characters, must be unique (D001, D002, D003, D004)
- `registered_at TIMESTAMPTZ DEFAULT NOW()` — timestamp with timezone, automatically set to current time

**What goes in here:**
```
device_id | registered_at
──────────┼────────────────────────────
D001      | 2026-10-02 09:00:00+00
D002      | 2026-10-02 09:00:03+00
D003      | 2026-10-02 09:00:06+00
D004      | 2026-10-02 09:00:09+00
```

This table just registers that a device EXISTS. It gets populated automatically the first time the simulator sends a reading for that device.

---

### TABLE 2: `readings`

```sql
CREATE TABLE IF NOT EXISTS readings (
    id            SERIAL PRIMARY KEY,
    device_id     VARCHAR(20) NOT NULL REFERENCES devices(device_id),
    pressure      NUMERIC(8,2) NOT NULL,
    oxygen_purity NUMERIC(5,2) NOT NULL DEFAULT 96.0,
    status        VARCHAR(20) NOT NULL,
    purity_status VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    timestamp     TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Column explanations:**
- `id SERIAL PRIMARY KEY` — **auto-incrementing number**. First row = 1, next = 2, etc. You never set this manually; the database does it.
- `device_id REFERENCES devices(device_id)` — **foreign key**. This reading must belong to a device that exists in the `devices` table. You can't insert a reading for "D099" if D099 isn't in devices.
- `pressure NUMERIC(8,2)` — number up to 8 digits total with 2 decimal places (e.g., 112.75)
- `oxygen_purity NUMERIC(5,2)` — smaller number, same idea (e.g., 96.23)
- `status VARCHAR(20)` — classification string: `NORMAL`, `HIGH_PRESSURE`, or `LOW_PRESSURE`
- `purity_status VARCHAR(20)` — classification: `NORMAL`, `HIGH_PURITY`, or `LOW_PURITY`
- `timestamp` — WHEN the sensor took this reading (from the simulator)
- `created_at DEFAULT NOW()` — when we stored it in DB (usually a few ms after timestamp)

**What grows in here:**
```
id   | device_id | pressure | oxygen_purity | status        | purity_status | timestamp
─────┼───────────┼──────────┼───────────────┼───────────────┼───────────────┼──────────────────────
1    | D001      | 72.40    | 96.20         | NORMAL        | NORMAL        | 2026-10-02T09:00:00Z
2    | D002      | 68.10    | 95.80         | NORMAL        | NORMAL        | 2026-10-02T09:00:02Z
3    | D001      | 112.70   | 98.90         | HIGH_PRESSURE | NORMAL        | 2026-10-02T09:00:06Z
4    | D003      | 28.30    | 91.20         | LOW_PRESSURE  | LOW_PURITY    | 2026-10-02T09:00:08Z
```

This table grows fast — about 40 rows per minute (4 devices × ~10 readings/min each).

**Index:**
```sql
CREATE INDEX IF NOT EXISTS idx_readings_device_ts
    ON readings (device_id, timestamp DESC);
```
An **index** is like a book's index — it makes searching faster. Without it, finding "latest reading for D001" would scan ALL rows. With it, the database jumps directly to D001's rows.

---

### TABLE 3: `alerts`

This is the most complex table. **One row = one incident.**

```sql
CREATE TABLE IF NOT EXISTS alerts (
    id               SERIAL PRIMARY KEY,
    device_id        VARCHAR(20) NOT NULL REFERENCES devices(device_id),
    alert_type       VARCHAR(20) NOT NULL,    -- HIGH_PRESSURE | LOW_PRESSURE | HIGH_PURITY | LOW_PURITY
    status           VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',   -- ACTIVE | ACKNOWLEDGED | RESOLVED
    parameter        VARCHAR(20) NOT NULL DEFAULT 'pressure', -- 'pressure' | 'purity'
    initial_value    NUMERIC(8,2) NOT NULL,   -- value when alert first opened
    max_value        NUMERIC(8,2) NOT NULL,   -- WORST value seen (highest for HIGH, tracked over time)
    min_value        NUMERIC(8,2) NOT NULL,   -- LOWEST value seen during this incident
    current_value    NUMERIC(8,2) NOT NULL,   -- MOST RECENT value
    threshold        NUMERIC(8,2) NOT NULL,   -- the limit that was crossed (40, 100, 93, or 99)
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at  TIMESTAMPTZ,             -- NULL until someone clicks Acknowledge
    resolved_at      TIMESTAMPTZ,             -- NULL until auto-resolved or manually resolved
);
```

**Real example — what an active high-pressure alert looks like:**
```
id             | 42
device_id      | D001
alert_type     | HIGH_PRESSURE
status         | ACTIVE
parameter      | pressure
initial_value  | 112.70    ← pressure when alert first opened
max_value      | 118.50    ← worst it got (updated with each abnormal reading)
min_value      | 112.70    ← lowest during this incident
current_value  | 115.20    ← most recent reading
threshold      | 100.00    ← safe max was 100
created_at     | 2026-10-02T09:00:06Z
acknowledged_at| NULL      ← nobody has acknowledged yet
resolved_at    | NULL      ← still unresolved
```

**Why "one row per incident"?**
If D001 pressure stays above 100 for 20 consecutive readings, that's still **ONE alert row**. Each new abnormal reading just UPDATES `current_value` and `max_value`. This prevents notification spam.

**Alert lifecycle:**
```
ACTIVE → ACKNOWLEDGED → RESOLVED
         (someone clicked)  (manually clicked or pressure returned to normal)
```

---

### TABLE 4: `alert_readings`

```sql
CREATE TABLE IF NOT EXISTS alert_readings (
    id            SERIAL PRIMARY KEY,
    alert_id      INTEGER NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    pressure      NUMERIC(8,2) NOT NULL DEFAULT 0,
    oxygen_purity NUMERIC(5,2) NOT NULL DEFAULT 96.0,
    timestamp     TIMESTAMPTZ NOT NULL
);
```

**What it stores:** Every individual abnormal reading that belongs to an active alert incident.

Example — for alert #42 (D001 high pressure):
```
id | alert_id | pressure | oxygen_purity | timestamp
───┼──────────┼──────────┼───────────────┼──────────────────────
1  | 42       | 112.70   | 98.90         | 2026-10-02T09:00:06Z ← first
2  | 42       | 114.20   | 98.80         | 2026-10-02T09:00:12Z
3  | 42       | 118.50   | 98.90         | 2026-10-02T09:00:18Z ← worst
4  | 42       | 115.20   | 98.70         | 2026-10-02T09:00:24Z
```

**`ON DELETE CASCADE`** means: if alert #42 is deleted from `alerts`, all its rows in `alert_readings` are automatically deleted too.

**Why it exists:** The Analytics page's "Alerts Over Time" chart reads this data to show how pressure/purity changed throughout an alert incident.

### What Happens If You Delete This File?
Server starts but `init_db()` runs zero SQL commands → tables never get created → every API call fails with:
```
asyncpg.exceptions.UndefinedTableError: relation "devices" does not exist
```

---

## `backend/app/db/database.py`

### What Type of File Is This?
A Python module that manages the **PostgreSQL connection pool** using the `asyncpg` library.

### What is a Connection Pool? (Beginner Analogy)

Imagine a swimming pool (the database connection pool) and swimmers (API requests).

**Without a pool (naïve approach):**
Every request opens a new connection → uses it → closes it. Opening a database connection takes ~100ms. If you get 100 requests per second, that's 100 connections being opened/closed every second — extremely slow.

**With a pool:**
Keep 2–10 connections open permanently. When a request needs the database, it "borrows" one from the pool (takes <1ms), uses it, and returns it. Much faster!

### What Does It Do? (Code Walkthrough)

```python
import asyncpg
import pathlib
from app.config import settings

_pool: asyncpg.Pool | None = None  # ← global variable holding the pool
```

**`init_db()` — runs ONCE on startup:**
```python
async def init_db() -> None:
    global _pool
    
    # Create the connection pool
    _pool = await asyncpg.create_pool(
        host=settings.db_host,      # "localhost" from .env
        port=settings.db_port,      # 5432 from .env
        database=settings.db_name,  # "medical_gas_db" from .env
        user=settings.db_user,      # "postgres" from .env
        password=settings.db_password,  # "postgres123" from .env
        min_size=2,   # always keep at least 2 connections open
        max_size=10,  # never open more than 10 connections
    )
    
    # Read schema.sql file from disk
    schema_path = pathlib.Path(__file__).parent / "schema.sql"
    # pathlib.Path(__file__).parent = the folder containing database.py
    # / "schema.sql" = append "schema.sql" to the path
    
    ddl = schema_path.read_text()  # read the SQL as a string
    
    # Execute the SQL (creates tables if they don't exist)
    async with _pool.acquire() as conn:
        await conn.execute(ddl)
    
    print("✅  Database connected and schema applied.")
```

**`close_db()` — runs ONCE on shutdown:**
```python
async def close_db() -> None:
    if _pool:
        await _pool.close()  # gracefully close all connections
```

**`get_pool()` — called by every router and the alert engine:**
```python
def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Database pool not initialised. Call init_db() first.")
    return _pool
```

Usage pattern in every router:
```python
pool = get_pool()
async with pool.acquire() as conn:  # borrow a connection
    rows = await conn.fetch("SELECT * FROM devices")
    # connection automatically returned to pool when this block exits
```

### Why `asyncpg` Instead of Other Libraries?
FastAPI is **async** — it handles multiple requests simultaneously without waiting. `asyncpg` is an async PostgreSQL driver. Regular libraries like `psycopg2` are **sync** — they block while waiting for DB responses, which would freeze FastAPI.

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PART 5: PYDANTIC MODELS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## `backend/app/models/schemas.py`

### What is Pydantic? (Beginner Explanation)

Pydantic is a Python library that validates data. It ensures data has the right shape and type.

**Without Pydantic:**
```python
# Simulator sends: { "device_id": "D001", "pressure": "not_a_number", "oxygen_purity": 96.2 }
# Backend crashes trying to do math with "not_a_number"
```

**With Pydantic:**
```python
# Simulator sends: { "device_id": "D001", "pressure": "not_a_number" }
# FastAPI automatically responds: 422 Unprocessable Entity
# {"detail": [{"type": "float_parsing", "loc": ["body", "pressure"], "msg": "not a valid float"}]}
```

Pydantic catches bad data BEFORE it ever reaches your Python code.

### The Models Explained

**`ReadingIn` — The contract for data COMING IN from the simulator:**
```python
class ReadingIn(BaseModel):
    device_id:     str   = Field(..., examples=["D001"])   # must be a string
    pressure:      float = Field(..., examples=[72.4])     # must be a decimal number
    oxygen_purity: float = Field(..., examples=[96.2])     # must be a decimal number
    timestamp:     datetime                                # must be a valid ISO timestamp
```
The `...` means "required field" — if any of these are missing, FastAPI rejects the request.

**`ReadingOut` — What the frontend gets back from `GET /readings`:**
```python
class ReadingOut(BaseModel):
    id:            int       # 1234 (database auto-generated)
    device_id:     str       # "D001"
    pressure:      float     # 72.4
    oxygen_purity: float     # 96.2
    status:        str       # "NORMAL" / "HIGH_PRESSURE" / "LOW_PRESSURE"
    purity_status: str       # "NORMAL" / "HIGH_PURITY" / "LOW_PURITY"
    timestamp:     datetime
```
Note: `ReadingIn` (input) has no `id`, `status`, or `purity_status` — those are added by the backend.

**`DeviceOut` — What the frontend gets from `GET /devices`:**
```python
class DeviceOut(BaseModel):
    device_id:             str
    latest_pressure:       Optional[float]    # Optional = can be None (if no readings yet)
    latest_purity:         Optional[float]
    latest_status:         Optional[str]
    latest_purity_status:  Optional[str]
    latest_timestamp:      Optional[datetime]
    active_alert_id:       Optional[int]      # None if no active alert
```
Everything is `Optional` because a brand new device has no readings yet.

**`AlertOut` — Full alert data:**
```python
class AlertOut(BaseModel):
    id:               int
    device_id:        str
    alert_type:       str          # HIGH_PRESSURE | LOW_PRESSURE | LOW_PURITY | HIGH_PURITY
    status:           str          # ACTIVE | ACKNOWLEDGED | RESOLVED
    parameter:        str          # "pressure" or "purity"
    initial_value:    float        # value when incident started
    max_value:        float        # worst value seen
    min_value:        float        # lowest value during incident
    current_value:    float        # most recent value
    threshold:        float        # the limit that was crossed
    created_at:       datetime     # when alert opened
    acknowledged_at:  Optional[datetime]  # None until acknowledged
    resolved_at:      Optional[datetime]  # None until resolved
```

**`AlertReadingOut` — Individual readings within an alert:**
```python
class AlertReadingOut(BaseModel):
    id:            int
    alert_id:      int      # which alert this belongs to
    pressure:      float
    oxygen_purity: float
    timestamp:     datetime
```

### How FastAPI Uses These Automatically
```python
@router.get("", response_model=list[ReadingOut])
async def get_readings():
    rows = await conn.fetch("SELECT ...")
    return [dict(r) for r in rows]
    # FastAPI automatically: validates each dict against ReadingOut
    # removes any extra fields not in ReadingOut
    # converts Python types to JSON
```

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PART 6: THE ALERT ENGINE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## `backend/app/alert_engine/engine.py`

### What Type of File Is This?
The **most important business logic** file. This is where the "intelligence" of the system lives.

### What Does It Do?
It answers the question: **"Given this new sensor reading, what should happen with alerts?"**

### The Classifiers

```python
def classify_pressure(pressure: float) -> str:
    if pressure < settings.pressure_min:  # < 40.0
        return "LOW_PRESSURE"
    if pressure > settings.pressure_max:  # > 100.0
        return "HIGH_PRESSURE"
    return "NORMAL"

def classify_purity(purity: float) -> str:
    if purity < settings.purity_min:  # < 93.0
        return "LOW_PURITY"
    if purity > settings.purity_max:  # > 99.0
        return "HIGH_PURITY"
    return "NORMAL"
```

Examples:
```
classify_pressure(72.4)  → "NORMAL"
classify_pressure(112.7) → "HIGH_PRESSURE"
classify_pressure(28.3)  → "LOW_PRESSURE"

classify_purity(96.2) → "NORMAL"
classify_purity(99.6) → "HIGH_PURITY"
classify_purity(88.0) → "LOW_PURITY"
```

### The Core Logic — `_process_parameter()`

This function runs ONCE for pressure and ONCE for purity on every reading. Here's the decision tree in plain English:

```
Given: device_id, value, status ("NORMAL"/"HIGH_PRESSURE"/etc), parameter ("pressure"/"purity")

STEP 1: Ask the database:
        "Is there an ACTIVE or ACKNOWLEDGED alert for {device_id} + {parameter}?"

STEP 2a: If value is NORMAL and NO open alert exists:
         → Nothing to do. Return None.

STEP 2b: If value is NORMAL and there IS an open alert:
         → Pressure returned to normal! Close the incident.
         → UPDATE alerts SET status='RESOLVED', resolved_at=NOW
         → Return: { event: "alert_resolved", alert_id: ..., device_id: ..., ... }

STEP 2c: If value is ABNORMAL and there IS an open alert:
         → Same incident is still ongoing.
         → UPDATE alerts SET current_value=new_val, max_value=max(old, new)
         → INSERT INTO alert_readings (this reading is part of the incident)
         → Return: { event: "alert_updated", alert_id: ..., value: ..., ... }

STEP 2d: If value is ABNORMAL and NO open alert:
         → Brand new incident!
         → INSERT INTO alerts (new row, status=ACTIVE)
         → INSERT INTO alert_readings (first reading of this incident)
         → Return: { event: "alert_created", alert_id: ..., value: ..., ... }
```

### The Public Function — `process_reading()`

Called by `readings.py` after every sensor reading:

```python
async def process_reading(device_id, pressure, oxygen_purity, timestamp, reading_id):
    p_status = classify_pressure(pressure)    # e.g., "HIGH_PRESSURE"
    o_status = classify_purity(oxygen_purity) # e.g., "NORMAL"
    events = []
    
    async with pool.acquire() as conn:
        # Run logic for PRESSURE
        ev = await _process_parameter(
            conn, device_id, pressure, p_status, "pressure", ...
        )
        if ev: events.append(ev)  # e.g., { event: "alert_created", ... }
        
        # Run logic for PURITY (independently!)
        ev = await _process_parameter(
            conn, device_id, oxygen_purity, o_status, "purity", ...
        )
        if ev: events.append(ev)
    
    return events  # list of 0, 1, or 2 event dicts
```

**Key insight: Pressure and purity are tracked INDEPENDENTLY.**
One reading can trigger:
- 0 events (both normal, no open alerts) → quiet
- 1 event (pressure high, purity normal) → 1 alert created
- 2 events (pressure high AND purity low) → 2 alerts created simultaneously

### Real Example Walkthrough

**Scenario:** D001 pressure goes HIGH, stays HIGH, then returns to normal.

```
Reading 1: pressure=112.7, purity=96.2
  classify_pressure(112.7) → "HIGH_PRESSURE"
  classify_purity(96.2)    → "NORMAL"
  
  For pressure:
    Check DB: any open pressure alert for D001? → NO
    Status is ABNORMAL → CREATE new alert (id=42)
    INSERT alert_readings (112.7 PSI)
    Return: { event: "alert_created", alert_id: 42, value: 112.7 }
  
  For purity:
    classify = NORMAL, no open purity alert → Nothing
    Return: None
  
  events = [{ event: "alert_created", alert_id: 42, ... }]

─────────────────────────────────────

Reading 2: pressure=118.5, purity=97.1
  classify_pressure(118.5) → "HIGH_PRESSURE"
  
  For pressure:
    Check DB: open pressure alert for D001? → YES, alert #42
    Status is ABNORMAL → UPDATE alert #42:
      current_value = 118.5
      max_value = max(112.7, 118.5) = 118.5  ← new record!
    INSERT alert_readings (118.5 PSI)
    Return: { event: "alert_updated", alert_id: 42, value: 118.5 }
  
  events = [{ event: "alert_updated", ... }]

─────────────────────────────────────

Reading 3: pressure=74.2, purity=96.5
  classify_pressure(74.2) → "NORMAL"
  
  For pressure:
    Check DB: open pressure alert for D001? → YES, alert #42
    Status is NORMAL → RESOLVE alert:
      UPDATE alerts SET status='RESOLVED', resolved_at=NOW
    Return: { event: "alert_resolved", alert_id: 42, value: 74.2 }
  
  events = [{ event: "alert_resolved", alert_id: 42 }]
```

Result: alert_id=42 went from ACTIVE → RESOLVED automatically, with max_value=118.5 permanently recorded.

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PART 7: THE ROUTERS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## What is a Router? (Beginner)

In a restaurant, different waiters handle different sections. In FastAPI, **routers** are like sections — each router handles a group of related URLs.

All 4 routers are registered in `main.py` using `app.include_router(...)`.

---

## `backend/app/routers/readings.py`

### Handles:
- `POST /readings` — the simulator calls this (most important endpoint)
- `GET /readings` — the frontend calls this on page load

### `POST /readings` — Step by Step

```python
@router.post("", status_code=201)
async def ingest_reading(payload: ReadingIn):  # ← Pydantic validates input
```

**Step 1: Classify both values**
```python
p_status = classify_pressure(payload.pressure)   # e.g., "HIGH_PRESSURE"
o_status = classify_purity(payload.oxygen_purity) # e.g., "NORMAL"
```

**Step 2: Ensure device exists**
```python
await conn.execute(
    "INSERT INTO devices (device_id) VALUES ($1) ON CONFLICT DO NOTHING",
    payload.device_id,
)
```
`ON CONFLICT DO NOTHING` = "If D001 already exists, do nothing (don't error)." This is why you never have to manually create devices.

**Step 3: Store the reading**
```python
reading_id = await conn.fetchval(
    """
    INSERT INTO readings (device_id, pressure, oxygen_purity, status, purity_status, timestamp)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
    """,
    payload.device_id, payload.pressure, payload.oxygen_purity,
    p_status, o_status, payload.timestamp,
)
```
`RETURNING id` = "After inserting, give me back the auto-generated id." This is how we get `reading_id`.

**Step 4: Run the alert engine**
```python
alert_events = await process_reading(
    device_id=payload.device_id,
    pressure=payload.pressure,
    oxygen_purity=payload.oxygen_purity,
    timestamp=payload.timestamp,
    reading_id=reading_id,
)
# → returns [] or [alert_created] or [alert_resolved] or [alert_created, alert_created]
```

**Step 5: Broadcast everything to all browsers via WebSocket**
```python
ws_payload = {
    "event": "new_reading",
    "reading": {
        "id": reading_id,
        "device_id": payload.device_id,
        "pressure": payload.pressure,
        "oxygen_purity": payload.oxygen_purity,
        "status": p_status,
        "purity_status": o_status,
        "timestamp": payload.timestamp.isoformat(),
    },
    "alerts": alert_events,  # [0, 1, or 2 events]
}
await manager.broadcast(ws_payload)
```
This one call sends the data to every browser that has the dashboard open.

**Step 6: Return HTTP 201 Created**
```python
return {
    "reading_id": reading_id,
    "status": p_status,
    "purity_status": o_status,
    "alerts": alert_events,
}
```
The simulator receives this response and knows the reading was saved.

### `GET /readings`

```python
@router.get("", response_model=list[ReadingOut])
async def get_readings(
    device_id: str | None = Query(None),   # optional: filter by device
    limit: int = Query(200, ge=1, le=1000), # default 200, min 1, max 1000
):
```

Called by the frontend on initial page load to get the last 200–500 readings for charts.

---

## `backend/app/routers/devices.py`

### Handles:
- `GET /devices` — returns all 4 devices with their latest values

### The SQL Query — With LATERAL JOIN Explained

```sql
SELECT
    d.device_id,
    r.pressure          AS latest_pressure,
    r.oxygen_purity     AS latest_purity,
    r.status            AS latest_status,
    r.purity_status     AS latest_purity_status,
    r.timestamp         AS latest_timestamp,
    a.id                AS active_alert_id
FROM devices d
LEFT JOIN LATERAL (
    SELECT pressure, oxygen_purity, status, purity_status, timestamp
    FROM   readings
    WHERE  device_id = d.device_id
    ORDER  BY timestamp DESC
    LIMIT  1
) r ON TRUE
LEFT JOIN LATERAL (
    SELECT id
    FROM   alerts
    WHERE  device_id = d.device_id
      AND  status IN ('ACTIVE', 'ACKNOWLEDGED')
    ORDER  BY created_at DESC
    LIMIT  1
) a ON TRUE
ORDER BY d.device_id
```

**What is LATERAL JOIN?**
Normal JOIN: "merge these two tables together based on matching columns"
LATERAL JOIN: "for each row in the left table, run this subquery"

In plain English: "For each device, go get its most recent reading AND its most active alert. Put it all in one row."

Without LATERAL, you'd need 8 separate queries (latest reading for each device × 4, plus active alert for each × 4). LATERAL does it in ONE query.

**Result — returns 4 rows:**
```
device_id | latest_pressure | latest_purity | latest_status | latest_purity_status | active_alert_id
──────────┼─────────────────┼───────────────┼───────────────┼──────────────────────┼────────────────
D001      | 112.70          | 98.90         | HIGH_PRESSURE | NORMAL               | 42
D002      | 68.10           | 95.80         | NORMAL        | NORMAL               | NULL
D003      | 74.20           | 96.10         | NORMAL        | NORMAL               | NULL
D004      | 82.70           | 98.30         | NORMAL        | NORMAL               | NULL
```

---

## `backend/app/routers/alerts.py`

### Handles 4 endpoints:

### `GET /alerts` — List alerts with optional filters

```python
async def get_alerts(
    status:    str | None = Query(None),       # ACTIVE | ACKNOWLEDGED | RESOLVED
    device_id: str | None = Query(None),       # D001 | D002 | D003 | D004
    parameter: str | None = Query(None),       # pressure | purity
    limit:     int        = Query(200),
):
```

**Dynamic WHERE clause building:**
```python
filters, args = [], []
idx = 1
for col, val in [("status", status and status.upper()),
                 ("device_id", device_id),
                 ("parameter", parameter)]:
    if val:                              # only add filter if provided
        filters.append(f"{col} = ${idx}")
        args.append(val)
        idx += 1
where = ("WHERE " + " AND ".join(filters)) if filters else ""
```

Example calls:
```
GET /alerts                        → all alerts (no filter)
GET /alerts?status=ACTIVE          → WHERE status = 'ACTIVE'
GET /alerts?parameter=pressure     → WHERE parameter = 'pressure'
GET /alerts?status=ACTIVE&parameter=pressure → WHERE status='ACTIVE' AND parameter='pressure'
```

### `POST /alerts/{id}/acknowledge`

```python
async def acknowledge_alert(alert_id: int):
    # 1. Check alert exists
    row = await conn.fetchrow("SELECT status FROM alerts WHERE id = $1", alert_id)
    if not row:
        raise HTTPException(404, "Alert not found")  # ← 404 Not Found
    
    # 2. Must be ACTIVE to acknowledge
    if row["status"] != "ACTIVE":
        raise HTTPException(400, f"Alert is '{row['status']}', only ACTIVE can be acknowledged")
    
    # 3. Update database
    updated = await conn.fetchrow(
        "UPDATE alerts SET status='ACKNOWLEDGED', acknowledged_at=$1 WHERE id=$2 RETURNING ...",
        datetime.now(timezone.utc), alert_id,
    )
    
    # 4. Broadcast to all browsers
    await manager.broadcast({
        "event": "alert_acknowledged",
        "alert_id": alert_id,
        "device_id": updated["device_id"],
        "parameter": updated["parameter"],
    })
    
    return dict(updated)  # ← returns the updated alert to the button that clicked
```

### `POST /alerts/{id}/resolve`
Same pattern but sets `status='RESOLVED'` and `resolved_at=NOW`. Works on both ACTIVE and ACKNOWLEDGED alerts.

---

## `backend/app/routers/ws.py`

### Handles: `WebSocket /ws`

```python
@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)   # accept + add to list
    try:
        while True:
            await ws.receive_text()  # wait forever (keeps connection alive)
    except WebSocketDisconnect:
        manager.disconnect(ws)   # clean up on browser close
```

**Why `while True: await ws.receive_text()`?**
This infinite loop keeps the connection alive. The backend ONLY SENDS data — it never reads anything meaningful from the browser. But without this loop, the connection would immediately close after `connect()`. `receive_text()` just waits for incoming messages (which the browser doesn't send) to keep the coroutine alive.

When the browser closes (tab closed, refresh, internet cut), `receive_text()` raises `WebSocketDisconnect` exception → caught by `except` → `disconnect(ws)` removes from list.

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PART 8: FRONTEND CONFIG FILES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## `frontend/package.json`

### What Type of File Is This?
The frontend project's "manifest" — lists all dependencies and defines terminal commands.

### What It Contains

**`scripts` section — commands you can run:**
```json
"scripts": {
  "dev":     "vite",           ← runs development server (localhost:5173)
  "build":   "vite build",     ← compiles for production (creates dist/ folder)
  "lint":    "oxlint",         ← checks code for errors
  "preview": "vite preview"    ← previews the production build
}
```
You run these as `npm run dev`, `npm run build`, etc.

**`dependencies` — libraries included in the final website:**
```json
"dependencies": {
  "lucide-react": "^1.49.0",  ← 1000s of icons as React components
  "react":        "^19.2.8",  ← The React library itself
  "react-dom":    "^19.2.8",  ← Renders React components into the browser DOM
  "recharts":     "^3.10.1"   ← Chart library (LineChart, BarChart, PieChart, etc.)
}
```

**`devDependencies` — tools only used during development, not in final website:**
```json
"devDependencies": {
  "@vitejs/plugin-react": "^6.1.1",  ← enables JSX and React Fast Refresh in Vite
  "tailwindcss":          "^4.3.3",  ← the CSS utility framework
  "postcss":              "^8.5.28", ← processes CSS (needed by Tailwind)
  "vite":                 "^8.3.0"   ← the build tool
}
```

**What happens if you delete `node_modules/`?**
Run `npm install` — it reads `package.json` and downloads everything fresh.

---

## `frontend/index.html`

### What Type of File Is This?
The single HTML file that the browser loads. The entire React app lives inside it.

### What It Contains
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>frontend</title>  ← This is the browser tab title
  </head>
  <body>
    <div id="root"></div>           ← React renders EVERYTHING inside here
    <script type="module" src="/src/main.jsx"></script>  ← Loads the React app
  </body>
</html>
```

**The `<div id="root">` is the key.** React replaces this empty div with the entire app.

Without JavaScript, this page shows completely blank. The content comes from React.

---

## `frontend/vite.config.js`

### What Type of File Is This?
Vite's configuration file. Vite is the development server + build tool.

### What It Does

```javascript
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],   // ← enables JSX transformation and React Fast Refresh
  server: {
    proxy: {
      // These 4 paths get forwarded to the backend
      '/readings': 'http://127.0.0.1:8000',
      '/devices':  'http://127.0.0.1:8000',
      '/alerts':   'http://127.0.0.1:8000',
      '/ws': {
        target: 'ws://127.0.0.1:8000',  // WebSocket target
        ws: true,                        // this is a WebSocket proxy
      },
    },
  },
})
```

### Why Is This Proxy Necessary? (Windows-Specific Problem)

**The problem without proxy:**
```
Browser at localhost:5173 tries to call:
  fetch("http://localhost:8000/devices")   ← Problem 1: CORS error
  fetch("http://127.0.0.1:8000/devices")  ← Problem 2: localhost resolves to ::1 (IPv6)
                                             but backend on 127.0.0.1 (IPv4)
```

**With the proxy:**
```
Browser at localhost:5173 calls:
  fetch("/devices")           ← relative URL, no cross-origin issue
  
Vite intercepts → forwards to http://127.0.0.1:8000/devices
Backend responds → Vite sends response back to browser

Browser sees it as coming from localhost:5173 = same origin = no CORS issue!
```

---

## `frontend/src/main.jsx`

### What It Does
```javascript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'   // ← loads Tailwind + fonts + animations

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
```

- Finds the `<div id="root">` in `index.html`
- Injects the entire React application into it
- Imports `index.css` so styles apply globally

**This file runs first.** Everything starts here.

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PART 9: FRONTEND HOOKS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## What is a React Hook? (Absolute Beginner)

A React "hook" is a special function that lets you add state and behavior to components. Names always start with `use`.

Built-in hooks:
- `useState` — creates a variable that, when changed, causes the component to re-render (update the screen)
- `useEffect` — runs code at specific times (on mount, on update, on unmount)
- `useRef` — stores a value without causing re-renders (like a sticky note)
- `useCallback` — creates a stable function reference (prevents unnecessary re-renders)

---

## `frontend/src/api/client.js`

### What It Does

This is the **API communication module** — all backend calls go through here.

```javascript
const BASE = '';  // empty string = relative URLs (Vite proxy handles routing)

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {  // e.g., fetch('/devices')
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();  // parse JSON response body
}

export const api = {
  getDevices:  ()              => request('/devices'),
  getReadings: (params)        => request(`/readings?${new URLSearchParams(params)}`),
  getAlerts:   (status, param) => {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (param)  p.set('parameter', param);
    return request(`/alerts${p.toString() ? `?${p}` : ''}`);
  },
  acknowledgeAlert: (id) => request(`/alerts/${id}/acknowledge`, { method: 'POST' }),
  resolveAlert:     (id) => request(`/alerts/${id}/resolve`,     { method: 'POST' }),
};
```

**Why it exists:** Instead of writing `fetch('/devices')` in 10 different places, you write `api.getDevices()` everywhere. If you need to change the URL, change it in ONE place.

---

## `frontend/src/hooks/useWebSocket.js`

### What It Does

Manages a persistent WebSocket connection that **automatically reconnects** if it drops.

```javascript
const WS_URL = `ws://${window.location.host}/ws`;
// In dev: ws://localhost:5173/ws → Vite proxies to ws://127.0.0.1:8000/ws
```

**Connection state machine:**
```
DISCONNECTED
     ↓ connect() called
CONNECTING
     ↓ ws.onopen fires
CONNECTED (retryDelay reset to 1s)
     ↓ something goes wrong (server restart, internet drop)
ws.onclose fires
     ↓ wait retryDelay ms (1s, 2s, 4s, 8s... up to 30s)
CONNECTING (reconnect attempt)
     ↓ ws.onopen fires (success)
CONNECTED ← back to normal
```

**Exponential backoff explained:**
```javascript
retryDelay.current = Math.min(retryDelay.current * 2, 30000)
// 1000ms → 2000ms → 4000ms → 8000ms → 16000ms → 30000ms (cap)
```
Why exponential? If the backend is down, you don't want to hammer it with reconnect attempts every second. Wait longer between retries.

**The `onMsgRef` pattern:**
```javascript
const onMsgRef = useRef(onMessage);
onMsgRef.current = onMessage;  // ← update ref on every render
```
The `connect()` function is created once and never recreated (via `useCallback`). But `onMessage` changes on every render. Without this pattern, the old version of `onMessage` would be captured in the closure forever. The ref ensures `ws.onmessage` always calls the LATEST version.

---

## `frontend/src/hooks/useDashboardData.js`

### The Most Important Frontend File

This is the single source of truth for ALL data in the app. Every page component gets its data from here.

### State Variables (What It Tracks)

```javascript
const [devices,      setDevices]      = useState({});      // { D001: {...}, D002: {...}, ... }
const [trendData,    setTrendData]    = useState([]);       // pressure chart data
const [purityTrend,  setPurityTrend]  = useState([]);       // purity chart data
const [allReadings,  setAllReadings]  = useState([]);       // all readings for Analytics
const [alerts,       setAlerts]       = useState([]);       // all alerts
const [activities,   setActivities]   = useState([]);       // activity feed events
const [loading,      setLoading]      = useState(true);     // is initial load happening?
const [error,        setError]        = useState(null);     // error message or null
const [lastReceived, setLastReceived] = useState(null);     // time of last WS message
const [toasts,       setToasts]       = useState([]);       // notification array
```

### On Page Load — `fetchAll()`

```javascript
const [devList, readings, alertList] = await Promise.all([
    api.getDevices(),
    api.getReadings({ limit: 500 }),
    api.getAlerts(),
]);
```
`Promise.all()` fires all 3 requests **simultaneously** (not one after another). Saves time.

**Building the devices map:**
```javascript
const devMap = {};
for (const d of devList) {
    devMap[d.device_id] = {
        id: d.device_id,
        current_pressure: null,
        pressure_status: 'UNKNOWN',
        current_purity: null,
        purity_status: 'UNKNOWN',
        status: 'UNKNOWN',
        sparkline_p: [],   // last 20 pressure values for sparkline chart
        sparkline_o: [],   // last 20 purity values for sparkline chart
    };
}
```

**Populating from readings (oldest to newest):**
```javascript
const sorted = [...readings].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

for (const r of sorted) {
    const did = r.device_id;
    devMap[did].current_pressure = r.pressure;
    devMap[did].sparkline_p = [...devMap[did].sparkline_p, r.pressure].slice(-20);
    // .slice(-20) = keep only the LAST 20 values
    
    // Build trend chart bucket:
    const label = "09:00:01";  // time string from timestamp
    pTrend[label] = pTrend[label] || { time: label };
    pTrend[label][did] = r.pressure;  // → { time: "09:00:01", D001: 72.4, D002: 68.1, ... }
}
```

### On Every WebSocket Message — `handleWsMessage()`

Called for EVERY message the WebSocket receives:

```javascript
const handleWsMessage = (evt) => {
    const msg = JSON.parse(evt.data);  // parse JSON string to object
    
    if (msg.event === 'new_reading') {
        // Update device card in real time
        setDevices(prev => ({
            ...prev,
            [did]: {
                ...prev[did],
                current_pressure: pressure,  // new PSI value
                current_purity:   purity,    // new % value
                pressure_status:  pStat,     // "NORMAL"/"HIGH"/"LOW"
                purity_status:    oStat,
                sparkline_p: [...prev[did].sparkline_p, pressure].slice(-20),  // update sparkline
                sparkline_o: [...prev[did].sparkline_o, purity  ].slice(-20),
            }
        }));
        
        // Update trend chart
        setTrendData(prev => {
            const last = prev[prev.length - 1];
            // If same time bucket as last → merge; else → append new bucket
            if (last?.time === label) 
                return [...prev.slice(0,-1), { ...last, [did]: pressure }].slice(-30);
            return [...prev, { time: label, [did]: pressure }].slice(-30);
        });
        
        // Handle any alert events that came with this reading
        if (Array.isArray(msg.alerts)) {
            msg.alerts.forEach(ae => handleAlertEvent(ae));
        }
    }
};
```

**Why `.slice(-30)` and `.slice(-20)`?**
Without limits, arrays would grow forever (reading every 2 seconds = 1800 readings per hour). Keeping only the last 30 time buckets and 20 sparkline points prevents memory leaks.

### Alert Event Handling — `handleAlertEvent()`

```javascript
if (event === 'alert_created') {
    const fresh = await api.getAlerts();      // re-fetch from DB (get full data)
    setAlerts(fresh.map(normaliseAlert));
    pushToast('danger', '🚨 D001 Pressure: HIGH PRESSURE — 112.7');  // red toast
    pushActivity(makeActivity('alert_created', 'D001', '...'));       // activity feed
}

if (event === 'alert_updated') {
    // Just update max_value in existing state — no API call needed
    setAlerts(prev => prev.map(a => a.id !== alertId ? a : {
        ...a,
        max_value: Math.max(a.max_value, msg.value),
    }));
}

if (event === 'alert_resolved') {
    // Mark RESOLVED in state — no API call needed
    setAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, status: 'RESOLVED', resolved_at: new Date().toISOString() } : a
    ));
    pushToast('success', '✅ D001 Pressure alert resolved');  // green toast
}
```

### Derived Statistics

Computed fresh on every render from the current state:
```javascript
const pNormal = devList.filter(d => d.pressure_status === 'NORMAL').length;  // e.g., 3
const pLow    = devList.filter(d => d.pressure_status === 'LOW').length;     // e.g., 0
const pHigh   = devList.filter(d => d.pressure_status === 'HIGH').length;    // e.g., 1
const oNormal = devList.filter(d => d.purity_status   === 'NORMAL').length;
// etc...

const activeAlerts = alerts.filter(a => a.status === 'ACTIVE').length;
```

These update instantly when new WebSocket messages arrive — no extra API calls.

### Polling Fallback
```javascript
setInterval(() => {
    api.getAlerts().then(list => setAlerts(list.map(normaliseAlert))).catch(() => {});
}, 15000);  // every 15 seconds
```
If WebSocket misses something (brief disconnect, reconnect period), this ensures alerts are always fresh.

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PART 10: LAYOUT COMPONENTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## `frontend/src/components/layout/Shell.jsx`

The **outermost visual wrapper** for the entire app.

**What it renders (from outside in):**
```
[Entire screen: #F4F7FC light blue-gray background]
  [Decorations: dotted pattern top-left, blue blob top-right]
  [White floating rounded container (max 1440px wide)]
    [Sidebar (left)]
    [Main area (right)]
      [TopBar (horizontal strip at top)]
      [<main> scrollable content area]
        {children ← the actual page content goes here}
```

**Auto-collapse sidebar:**
```javascript
useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px)');
    const handler = (e) => setCollapsed(e.matches);
    setCollapsed(mq.matches);             // check immediately
    mq.addEventListener('change', handler); // listen for resize
    return () => mq.removeEventListener('change', handler); // cleanup
}, []);
```
`window.matchMedia` watches for screen width changes. Below 1024px → sidebar collapses to icon-only mode.

---

## `frontend/src/components/layout/Sidebar.jsx`

**The left navigation panel.** 5 sections:

**1. Logo:**
- Blue rounded square with SVG icon (gas cylinder + heart)
- "MEDI" in dark + "GAS" in blue + "Monitor" subtitle

**2. Navigation buttons (4 items):**
```javascript
const NAV = [
  { id: 'overview',  label: 'Overview',  Icon: LayoutDashboard },
  { id: 'devices',   label: 'Devices',   Icon: Monitor          },
  { id: 'alerts',    label: 'Alerts',    Icon: Bell             },
  { id: 'analytics', label: 'Analytics', Icon: BarChart2        },
];
```
Each button calls `onTabChange(id)` → `App.jsx` updates `activeTab` state → matching page renders.

**Active state** = blue background + blue text + left border accent (CSS `::before` pseudo-element).

**3. Alert badge on Alerts nav item:**
```javascript
{id === 'alerts' && activeAlertCount > 0 && (
    <span className="ml-auto bg-accent ...">
        {activeAlertCount > 9 ? '9+' : activeAlertCount}
    </span>
)}
```
Shows "3" (or "9+") in red circle next to Alerts. Updates in real-time.

**4. Live connection indicator (bottom):**
```javascript
<span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-success live-dot' : 'bg-danger live-dot-red'}`} />
```
`live-dot` = green pulsing CSS animation. `live-dot-red` = red pulsing.

**5. Hospital SVG illustration** — simple inline SVG: building, trees, ambulance.

---

## `frontend/src/components/layout/TopBar.jsx`

**The horizontal strip at top.** 3 sections:

**1. Search input:**
```javascript
<input
    value={searchQuery}
    onChange={e => onSearchChange(e.target.value)}
    placeholder="Enter device ID..."
/>
```
As you type "D001", `onSearchChange("D001")` updates `searchQuery` in `App.jsx` → passed to `Devices` and `Alerts` pages → they filter their lists.

**2. Bell dropdown:**
When clicked, shows `AlertDropdown` — a floating panel with up to 5 active alerts. Closes on:
- Click outside (via `document.addEventListener('mousedown', handler)`)
- Clicking the X button

**3. User avatar:**
Blue circle with "AD" initials. "Admin / Hospital Admin" label. No real authentication — this is UI only.

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PART 11: CARD COMPONENTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## `frontend/src/components/cards/HeroBanner.jsx`

The large banner at the top of Overview page.

**Dynamic headline logic:**
```javascript
const totalProblems = (pHigh + pLow) + (oHigh + oLow);

if (totalProblems === 0) {
    headline = 'All Systems Normal';      // green text
    subtitle = 'All 4 devices operating within safe ranges...';
} else {
    headline = `${totalProblems} Alerts Active`;  // pink-red text
    subtitle = '2 pressure issues · 1 purity issue — check immediately.';
}
```

**The gauge needle color:**
```javascript
<line stroke={totalProblems > 0 ? '#F0386B' : '#22C55E'} />  // red or green
```
When alerts are active, both gauge needles turn red. When all normal, they're green.

---

## `frontend/src/components/cards/DeviceCard.jsx`

**One card per device.** Each device has a hardcoded color theme:
```javascript
const PALETTE = [
  { header: '#2F80ED', ... },  // D001: blue
  { header: '#0D9488', ... },  // D002: teal
  { header: '#F59E0B', ... },  // D003: amber
  { header: '#1E2A4A', ... },  // D004: dark navy
];
```

**The pulse animation:**
```javascript
const [pulse, setPulse] = useState(false);

useEffect(() => {
    if (prevRef.current !== current_pressure) {  // value changed?
        setPulse(true);                           // trigger glow
        setTimeout(() => setPulse(false), 800);   // remove after 800ms
        prevRef.current = current_pressure;
    }
}, [current_pressure]);
```
When a new reading arrives and pressure changes, a colored ring briefly glows around the card. `useRef` stores the previous value without causing re-renders.

**Pressure progress bar:**
```
Width = Math.min(Math.max(pressure / 150 * 100, 0), 100)%
                              ↑              ↑
                         max PSI        clamp to 0-100%
```
Scale markers: 0, 40 (min threshold), 100 (max threshold), 150

**Purity progress bar:**
```
Width = Math.min(Math.max((purity - 85) / 15 * 100, 0), 100)%
                                   ↑
                         offset from 85% (chart starts at 85%)
```
Scale markers: 85%, 93% (min threshold), 99% (max threshold), 100%

---

## `frontend/src/components/cards/AlertCard.jsx`

**Alert metadata lookup:**
```javascript
const ALERT_META = {
  HIGH_PRESSURE: { label:'High Pressure', border:'#EF4444', ... },  // red
  LOW_PRESSURE:  { label:'Low Pressure',  border:'#F5A524', ... },  // amber
  HIGH_PURITY:   { label:'High O₂ Purity',border:'#8B5CF6', ... }, // purple
  LOW_PURITY:    { label:'Low O₂ Purity', border:'#F59E0B', ... },  // yellow
};
const meta = ALERT_META[alert.alert_type] || ALERT_META.HIGH_PRESSURE;
```
This drives the left border color and icon choice.

**Loading state for buttons:**
```javascript
const [loading, setLoading] = useState(null);  // null | 'ack' | 'resolve'

const handle = async (action, fn) => {
    setLoading(action);   // button shows "Working…"
    try { await fn(); }   // call API (might take 1-2 seconds)
    catch (_) {}
    finally { setLoading(null); }  // restore button text
};
```
While waiting for the API response, button shows "Working…" and is disabled.

---

## `frontend/src/components/cards/ActivityFeed.jsx`

**Timeline of recent events.** Shows last 10 of up to 30 stored events.

**Event types with icons:**
```javascript
const TYPE_CONFIG = {
  alert_created:      { Icon: Bell,          bg: 'bg-red-50',   label: 'Alert'    },
  alert_acknowledged: { Icon: AlertTriangle, bg: 'bg-amber-50', label: 'Ack'      },
  alert_resolved:     { Icon: CheckCircle,   bg: 'bg-green-50', label: 'Resolved' },
  reading:            { Icon: Activity,      bg: 'bg-blue-50',  label: 'Reading'  },
};
```

**Relative time formatter (handles bad dates):**
```javascript
function relativeTime(raw) {
    const d = raw instanceof Date ? raw : new Date(raw);
    if (isNaN(d.getTime())) return 'just now';  // ← never crashes on bad data
    const s = Math.floor((Date.now() - d) / 1000);
    if (s < 5)  return 'just now';
    if (s < 60) return `${s}s ago`;
    ...
}
```

---

## `frontend/src/components/cards/StatCard.jsx`

**Simple stat tile.** Props: `value`, `label`, `Icon`, `iconBg`, `iconColor`.

**Count-up animation:**
```javascript
useEffect(() => {
    if (prevVal.current !== value && numRef.current) {
        numRef.current.classList.remove('count-up');
        void numRef.current.offsetWidth;  // force reflow (restart animation)
        numRef.current.classList.add('count-up');
    }
    prevVal.current = value;
}, [value]);
```
`void numRef.current.offsetWidth` — this reads a CSS property, which forces the browser to pause and recalculate layout. This allows the animation class to be removed and re-added in the same frame, restarting the animation from scratch.

---

## `frontend/src/components/cards/SystemInfoCard.jsx`

Displays 5 rows of system health data:
```javascript
const rows = [
    { label: 'WebSocket',      value: connected ? 'Connected' : 'Disconnected' },
    { label: 'Last Reading',   value: safeTime(lastReceived) },  // "09:15:32 AM"
    { label: 'Readings / min', value: String(rpm ?? 0) },
    { label: 'Pressure Range', value: '40–100 PSI' },
    { label: 'O₂ Purity Range',value: '93–99 %' },
];
```

`rpm` (readings per minute) is calculated in `useDashboardData`:
```javascript
const elapsed = (Date.now() - windowStartRef.current) / 60000;  // minutes since page load
const rpm = Math.round(readingCountRef.current / elapsed);       // readings ÷ minutes
```

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PART 12: CHART COMPONENTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## What is Recharts? (Beginner)

Recharts is a React charting library. You define charts as JSX (HTML-like code):
```jsx
<LineChart data={trendData}>
  <Line dataKey="D001" stroke="#2F80ED" />
  <Line dataKey="D002" stroke="#22C55E" />
</LineChart>
```
It handles all the SVG drawing internally. You just pass data and config.

---

## `frontend/src/components/charts/PressureTrendChart.jsx`

**Data format expected:**
```javascript
[
  { time: "09:00:01", D001: 72.4, D002: 68.1, D003: 74.2, D004: 65.3 },
  { time: "09:00:05", D001: 73.1, D002: null, D003: 75.8, D004: 67.8 },
  //                                    ↑ D002 didn't send in this bucket
]
```

**Key configurations:**
```jsx
<YAxis domain={[0, 140]} />                    // Y-axis from 0 to 140 PSI
<ReferenceLine y={40}  stroke="#F5A524" />     // dashed amber line at 40 PSI
<ReferenceLine y={100} stroke="#EF4444" />     // dashed red line at 100 PSI
<Line connectNulls />                           // draw line through missing points
<Line isAnimationActive={false} />              // NO animation (prevents live-update lag)
```

`isAnimationActive={false}` is critical for live dashboards. With animation on, every new data point causes a distracting animation. With it off, the line just extends smoothly.

`connectNulls` handles the case where D002 didn't send data in a particular time bucket — the line continues unbroken.

**`singleDevice` prop:**
When used in the Devices drawer, pass `singleDevice="D001"` to show only D001's line.

---

## `frontend/src/components/charts/PurityTrendChart.jsx`

**Same structure as PressureTrendChart but:**
```jsx
<YAxis domain={[85, 100]} tickFormatter={v => `${v}%`} />  // 85% to 100%
<ReferenceLine y={93} stroke="#F5A524" />   // amber at 93%
<ReferenceLine y={99} stroke="#8B5CF6" />   // purple at 99%
```

---

## `frontend/src/components/charts/StatusDonut.jsx`

**Two PieCharts side by side.** The inner empty circle (donut hole) has a centered text label.

```javascript
// Filter out zero slices so they don't show in the chart
const data = [
    { name:'Normal', value: normal },
    { name:'Low',    value: low    },
    { name:'High',   value: high   },
].filter(d => d.value > 0);  // ← removes empty slices

// If ALL zeros, show a gray placeholder
const chartData = data.length ? data : [{ name:'No data', value:1, fill:'#E8EEFA' }];
```

Purity donut uses purple for "High" instead of red (to distinguish from pressure "High").

---

## `frontend/src/components/charts/AlertsPerDeviceBar.jsx`

**Grouped bar chart: 4 bars per device.**

```javascript
const data = DEVICES.map(id => {
    const da = alerts.filter(a => a.device_id === id);
    return {
        device: id,                              // x-axis label
        'P-High': da.filter(isHigh).length,     // bar 1 (red)
        'P-Low':  da.filter(isLow).length,      // bar 2 (amber)
        'O-High': da.filter(isHiO).length,      // bar 3 (purple)
        'O-Low':  da.filter(isLoO).length,      // bar 4 (yellow)
    };
});
```

**`useMemo(() => ..., [alerts])`** — only recalculates when `alerts` array changes, not on every render. Performance optimization.

**Below the chart: device summary row:**
```javascript
const total = d['P-High'] + d['P-Low'] + d['O-High'] + d['O-Low'];
// background: red if > 0, gray if 0
// number: red if > 0, green if 0
```

---

## `frontend/src/components/charts/Sparkline.jsx`

Tiny chart in device cards. 40px tall. No axes, no labels, no tooltips.

```javascript
const chartData = data.map((v, i) => ({ i, v }));
// [72.4, 73.1, 112.7] → [{ i:0, v:72.4 }, { i:1, v:73.1 }, { i:2, v:112.7 }]

<Line dataKey="v" dot={false} isAnimationActive={false} />
// dataKey="v" = use the "v" field as the Y value
// dot={false} = don't draw circles at each data point
```

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PART 13: UI COMPONENTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## `frontend/src/components/ui/StatusPill.jsx`

Tiny reusable badge. Used literally everywhere.

```javascript
const cfg = {
    NORMAL:       'bg-green-100 text-green-700',
    LOW:          'bg-amber-100 text-amber-700',
    HIGH:         'bg-red-100   text-red-700',
    ACTIVE:       'bg-red-100   text-red-700',
    ACKNOWLEDGED: 'bg-amber-100 text-amber-700',
    RESOLVED:     'bg-green-100 text-green-700',
    UNKNOWN:      'bg-gray-100  text-gray-500',
};
```

`size="xs"` → smaller padding and font. `size="sm"` → default. Determined by `px` variable.

---

## `frontend/src/components/ui/Toast.jsx`

**Fixed overlay at bottom-right of screen.** `z-index: 50` = on top of everything.

```javascript
const CONFIGS = {
    success: { bg: 'bg-green-50 border-green-200', Icon: CheckCircle,  ... },  // ✅
    warning: { bg: 'bg-amber-50 border-amber-200', Icon: AlertTriangle, ... }, // ⚠️
    danger:  { bg: 'bg-red-50   border-red-200',   Icon: XCircle,       ... }, // 🚨
    info:    { bg: 'bg-blue-50  border-blue-200',  Icon: Info,          ... }, // ℹ️
};
```

**`ToastContainer`** renders the `toasts` array from `useDashboardData`. Each toast has a dismiss (X) button and auto-dismisses after 4.5 seconds (the timeout is set in `useDashboardData.pushToast()`).

```javascript
// pointer-events-none on container, pointer-events-auto on each toast
// This lets clicks "pass through" the invisible container area
// while still receiving clicks on the actual toast boxes
```

---

## `frontend/src/components/ui/Skeleton.jsx`

**Loading placeholders** shown while data is fetching.

```javascript
// Single shimmer block:
<div className="animate-pulse bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100" />
```
The gradient moves left-to-right creating a "shimmer" effect (CSS `shimmer` animation in `index.css`).

**`PageSkeleton`** — full-page layout approximating the Overview tab:
```jsx
<Skeleton className="h-36 w-full" />        // hero banner
<div className="grid grid-cols-4 gap-4">
    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}  // 4 stat cards
</div>
<div className="grid grid-cols-3 gap-4">
    <Skeleton className="h-64 col-span-2" />  // chart
    <Skeleton className="h-64" />             // smaller chart
</div>
```

---

## `frontend/src/components/ui/Drawer.jsx`

**Right side-panel** used in the Devices tab.

```javascript
// Close on Escape key
useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);  // cleanup!
}, [open, onClose]);
```

**Two layers:**
1. **Backdrop** — semi-transparent dark overlay covering the page. Click = close drawer.
2. **Panel** — white panel on the right. `drawer-in` CSS class applies slide-in animation.

```jsx
if (!open) return null;  // ← don't render at all when closed (saves performance)
```

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PART 14: THE 4 PAGES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## `frontend/src/App.jsx`

The root component. Owns the tab state.

```javascript
const [activeTab,   setActiveTab]   = useState('overview');
const [searchQuery, setSearchQuery] = useState('');

const { devices, trendData, purityTrend, allReadings,
        alerts, activities, loading, error, connected,
        lastReceived, stats, rpm,
        toasts, dismissToast, acknowledgeAlert, resolveAlert
} = useDashboardData();  // ← all data from ONE hook
```

**Conditional rendering:**
```jsx
{!loading && activeTab === 'overview'  && <Overview  {...} />}
{!loading && activeTab === 'devices'   && <Devices   {...} />}
{!loading && activeTab === 'alerts'    && <Alerts    {...} />}
{!loading && activeTab === 'analytics' && <Analytics {...} />}
```
Only ONE page renders at a time. When `activeTab` changes → React unmounts old page, mounts new one.

---

## `frontend/src/pages/Overview.jsx`

**Two-column layout:**

**LEFT (70%):** Everything from top to bottom:
1. `<HeroBanner>` — dynamic headline
2. `<PressureTrendChart>` + `<PurityTrendChart>` side by side
3. `<StatusDonut>` — dual donut charts
4. `<AlertsPerDeviceBar>` — 4-device alert breakdown
5. Device cards grid (sorted: HIGH first, then LOW, then NORMAL)

**RIGHT (280px fixed):** Top to bottom:
1. Statistics card (rows for P Normal/Low/High, O₂ Normal/Low/High, Alert counts)
2. `<ActivityFeed>` — live event timeline
3. `<SystemInfoCard>` — WS status, readings/min, thresholds

**Device sort order:**
```javascript
const o = { HIGH:0, LOW:1, NORMAL:2, UNKNOWN:3 };
sorted = devList.sort((a, b) => (o[a.status]??3) - (o[b.status]??3));
```
Devices with problems always appear first — most critical at the top.

---

## `frontend/src/pages/Devices.jsx`

**Filter chips → Table → Drawer.**

**Status filters:**
```javascript
const STATUS_FILTERS = ['All','Normal','Low','High'];
// Clicking "High" → shows only devices where status === 'HIGH'
```

**Table rows:**
Each row has: Device ID, DualBar (P + O₂ progress bars), TrendIcon, StatusPills (2 of them), Last Updated, View button (hidden, appears on hover).

Clicking any row → `setSelectedId(dev.id)` → `Drawer` opens with `DeviceDetail`.

**Important pattern in `DeviceDetail`:**
```javascript
// Stores deviceId (string), NOT device object
const [selectedId, setSelectedId] = useState(null);

// DeviceDetail reads device data DIRECTLY from devices[deviceId]
const device = devices[deviceId];  // ALWAYS fresh data
```
Even while the drawer is open, if a new WebSocket message updates D001's data, the drawer shows the LATEST values immediately — because it reads from live state, not a snapshot.

**DualBar component:**
Two horizontal bars stacked:
- Top: pressure progress (0–150 PSI scale)
- Bottom: purity progress (85–100% scale)
Each colored based on threshold (green/amber/red/purple).

---

## `frontend/src/pages/Alerts.jsx`

**Two-level filtering system:**

**Level 1 — Status tabs (mutual exclusive):**
```
[Active (3)]  [Acknowledged (1)]  [Resolved (12)]
```

**Level 2 — Parameter chips (under the tabs):**
```
[All (3)]  [Pressure (2)]  [O₂ Purity (1)]
```

```javascript
const filtered = useMemo(() => {
    let list = alerts.filter(a => a.status === statusTab);      // filter by status
    if (paramTab === 'Pressure') list = list.filter(a => a.parameter === 'pressure');  // filter by param
    if (paramTab === 'Purity')   list = list.filter(a => a.parameter === 'purity');
    if (searchQuery) list = list.filter(a => a.device_id.includes(searchQuery));       // search filter
    return list.sort((a,b) => new Date(b.started_at) - new Date(a.started_at));       // newest first
}, [alerts, statusTab, paramTab, searchQuery]);
```

`useMemo` with `[alerts, statusTab, paramTab, searchQuery]` = "only recompute when one of these changes."

---

## `frontend/src/pages/Analytics.jsx`

**8 charts computed from data.** All use `useMemo` for performance.

**Chart 1 — Pressure Distribution Histogram:**
```javascript
const pressureHisto = useMemo(() => {
    const bins = {};
    for (let b=0; b<=140; b+=10) bins[b] = { range:`${b}–${b+10}`, count:0 };
    allReadings.forEach(r => {
        const b = Math.floor(r.pressure / 10) * 10;  // e.g., 72.4 → 70
        if (bins[b]) bins[b].count++;
    });
    return Object.values(bins);
}, [allReadings]);
```
Each reading is bucketed into a 10-PSI range. Result:
```
{ range: "70-80", count: 45 }
{ range: "100-110", count: 12 }  ← these are dangerous readings
```
Bars colored: amber (<40), blue (40–100 = normal), red (>100).

**Chart 5 — Alerts Over Time:**
```javascript
const alertsOverTime = useMemo(() => {
    const buckets = {};
    alerts.forEach(a => {
        const key = "10/02 09:00";  // hour bucket
        buckets[key] = buckets[key] || { time: key, Pressure:0, Purity:0 };
        if (a.parameter === 'purity') buckets[key].Purity++;
        else                          buckets[key].Pressure++;
    });
    return Object.values(buckets).sort(...).slice(-24);  // last 24 hours
}, [alerts]);
```

**Chart 8 — Time to Resolve:**
```javascript
const avg = resolvedAlerts.reduce((sum, a) => {
    const start = new Date(a.created_at);
    const end   = new Date(a.resolved_at);
    return sum + (end - start);  // milliseconds
}, 0) / resolvedAlerts.length / 60000;  // convert to minutes
```

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# FULL DATA FLOW — EVERY STEP
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```
1. simulator.py reads CSV row: { device_id:"D001", pressure:112.7, oxygen_purity:98.9 }
2. Waits 3.2 seconds (random)
3. POSTs to http://127.0.0.1:8000/readings with timestamp=NOW
4. Vite proxy NOT involved (simulator calls backend directly)

5. readings.py receives request
6. Pydantic validates: all fields present and correct types ✓
7. classify_pressure(112.7) → "HIGH_PRESSURE"
8. classify_purity(98.9)    → "NORMAL"
9. INSERT INTO devices (D001) ON CONFLICT DO NOTHING
10. INSERT INTO readings → returns id=1769
11. process_reading() called

12. engine.py for PRESSURE:
    SELECT open pressure alert for D001... → none found
    → CREATE new alert (id=42, type=HIGH_PRESSURE, status=ACTIVE)
    → INSERT alert_readings (112.7 PSI)
    → return { event:"alert_created", alert_id:42, ... }

13. engine.py for PURITY:
    classify = NORMAL, no open purity alert → return None

14. alert_events = [{ event:"alert_created", alert_id:42, ... }]

15. manager.broadcast({
        event:"new_reading",
        reading: { id:1769, device_id:"D001", pressure:112.7, oxygen_purity:98.9,
                   status:"HIGH_PRESSURE", purity_status:"NORMAL", timestamp:"..." },
        alerts: [{ event:"alert_created", alert_id:42, ... }]
    })
    → sends to ALL connected browsers simultaneously

16. readings.py returns HTTP 201 to simulator ✓

17. In browser: useWebSocket receives message
18. handleWsMessage parses JSON

19. event="new_reading":
    setDevices(prev => { ...prev, D001: { current_pressure:112.7, pressure_status:"HIGH", ... } })
    → DeviceCard D001 re-renders: shows 112.7 PSI in RED, HIGH pill
    → D001 sparkline gets 112.7 appended
    setTrendData → PressureTrendChart adds new point
    setPurityTrend → PurityTrendChart adds new point

20. msg.alerts has [alert_created] event:
    handleAlertEvent called
    api.getAlerts() → fresh alert list fetched
    setAlerts(fresh list)
    pushToast('danger', '🚨 D001 Pressure: HIGH PRESSURE — 112.7')
    → Toast appears bottom-right (red)
    pushActivity → ActivityFeed gets "Alert created" prepended

21. React re-renders:
    - D001 DeviceCard: red glow pulse + 112.7 PSI + HIGH pill
    - HeroBanner: "1 Alerts Active" in pink-red
    - Sidebar: Alerts badge shows "1"
    - Bell icon: red dot appears
    - StatusDonut: pHigh now = 1
    - Statistics panel: High count = 1
    - ActivityFeed: new event at top
    - Toast: red notification bottom-right

22. 4 seconds later: simulator sends D001 pressure=74.2 (normal)

23. engine.py for PRESSURE:
    SELECT open pressure alert for D001... → found alert #42
    classify_pressure(74.2) = NORMAL
    → UPDATE alerts #42 SET status='RESOLVED', resolved_at=NOW
    → return { event:"alert_resolved", alert_id:42, ... }

24. WS broadcast: { event:"new_reading", alerts:[{event:"alert_resolved"}] }

25. Browser:
    handleAlertEvent: event="alert_resolved"
    setAlerts: alert #42 → status="RESOLVED"
    pushToast('success', '✅ D001 Pressure alert resolved')
    → Green toast appears

26. React re-renders:
    - D001 DeviceCard: 74.2 PSI, NORMAL pill, green
    - HeroBanner: "All Systems Normal" in green
    - Sidebar: Alerts badge disappears
    - Alerts tab: alert #42 now in RESOLVED tab
    - Toast: green notification
```

---

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# QUICK ANSWERS FOR TEAMMATES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Q: What language is the backend?**
Python 3.11, using FastAPI framework

**Q: What language is the frontend?**
JavaScript (React 19), no TypeScript

**Q: What database?**
PostgreSQL (4 tables: devices, readings, alerts, alert_readings)

**Q: How does live updating work?**
WebSocket connection from browser to FastAPI. Every time simulator sends a reading, backend broadcasts to all browsers via WS. No page refresh needed.

**Q: How do alerts get created?**
`engine.py` — checks if value is outside threshold (40–100 PSI / 93–99%), creates/updates/resolves alert rows in DB automatically.

**Q: Why one alert per incident?**
To prevent spam. If pressure stays high for 30 readings, you get 1 alert (with updated max value), not 30 toasts.

**Q: What is the CSV for?**
Fake sensor data. The ECE team will provide real sensor data later. The simulator reads random rows from CSV and sends them to the backend.

**Q: Why Vite proxy?**
Windows resolves `localhost` to IPv6 (::1) but Python backend listens on IPv4 (127.0.0.1). Also avoids CORS issues between port 5173 (frontend) and port 8000 (backend).

**Q: How to start the project?**
3 terminals:
1. `cd backend → python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`
2. `cd simulator → python simulator.py`
3. `cd frontend → npm run dev`
Then open http://localhost:5173
