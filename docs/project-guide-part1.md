# 🏥 Medical Gas Monitor — Complete Beginner's Guide
## Every Single File Explained Like You're Learning to Code

---

## 📖 HOW TO USE THIS GUIDE

This document explains **every single file** in the project in extreme detail. It's written for someone who is:
- Learning programming
- Never built a full-stack project before
- Needs to explain this project to teammates

For each file, you'll learn:
1. **What type of file it is** (Python? JavaScript? Configuration?)
2. **What it does** (line by line when needed)
3. **Why it exists** (the problem it solves)
4. **What happens if you delete it**
5. **How it connects to other files**
6. **Beginner-friendly analogies** to understand complex concepts

---

# 🎯 THE BIG PICTURE FIRST

Before we dive into files, let's understand what this project actually does.

## Real-World Analogy

Imagine a hospital has 4 oxygen/gas supply machines in different rooms. Each machine has sensors that measure:
- **Pressure** (like water pressure in pipes — measured in PSI)
- **Oxygen Purity** (how pure the oxygen is — measured in %)

If pressure gets too low → patients don't get enough oxygen  
If pressure gets too high → pipes could burst  
If purity gets too low → patients get contaminated air  
If purity gets too high → fire hazard

**Our software job:** Watch these 4 machines 24/7 and scream (show alerts) when something goes wrong.

## The 4 Main Parts

```
┌─────────────────────────────────────────────────────────────┐
│  CSV FILE (pressure_data.csv)                               │
│  → Fake sensor data for testing                             │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────┐
│  SIMULATOR (simulator.py)                                   │
│  → Reads CSV, pretends to be 4 real sensors                 │
│  → Sends readings every 2-6 seconds                         │
└──────────────────┬──────────────────────────────────────────┘
                   ↓ (HTTP POST request)
┌─────────────────────────────────────────────────────────────┐
│  BACKEND (Python FastAPI)                                   │
│  → Receives readings, stores in PostgreSQL                  │
│  → Runs "alert engine" (checks if values are dangerous)     │
│  → Sends live updates to browser via WebSocket              │
└──────────────────┬──────────────────────────────────────────┘
                   ↓ (WebSocket + HTTP responses)
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (React web app)                                   │
│  → Dashboard in browser showing live charts, alerts, stats  │
│  → Updates automatically without page refresh               │
└─────────────────────────────────────────────────────────────┘
```

---

# 📂 PART 1: THE DATASET FOLDER

## `dataset/pressure_data.csv`

### What Type of File Is This?
A **CSV** (Comma-Separated Values) file — basically a spreadsheet saved as plain text. You can open it in Excel or any text editor.

### What Does It Contain?
Pre-written fake sensor readings. Example rows:
```
timestamp,          device_id, pressure, oxygen_purity
2026-10-01 08:00:01,  D001,      72.4,     96.2
2026-10-01 08:00:05,  D001,      73.1,     96.5
2026-10-01 08:00:09,  D001,     112.7,     98.9  ← HIGH pressure!
2026-10-01 08:00:13,  D001,      28.3,     91.2  ← LOW pressure AND low purity!
...
```

**4 columns:**
1. `timestamp` — when this reading was taken (NOTE: simulator ignores this and uses current time instead)
2. `device_id` — which machine: D001, D002, D003, or D004
3. `pressure` — PSI value (safe range: 40–100)
4. `oxygen_purity` — % value (safe range: 93–99%)

**Total rows:** About 280 (70 per device)

### Why Does It Exist?
The ECE team is building the real physical sensors. Until those are ready, we need fake data to test our software. This CSV is our fake sensor data source.

### Interesting Detail — The Data Has Patterns
The person who created this CSV was smart — they put dangerous values in it:
- Some rows have pressure above 100 (will trigger HIGH PRESSURE alert)
- Some rows have pressure below 40 (will trigger LOW PRESSURE alert)
- Some rows have purity below 93% (will trigger LOW PURITY alert)
- Some rows have purity above 99% (will trigger HIGH PURITY alert)

This means when you run the simulator, alerts will naturally fire during testing.

### What Happens If You Delete It?
The simulator crashes immediately with this error:
```
FileNotFoundError: [Errno 2] No such file or directory: '.../pressure_data.csv'
```
No data → simulator can't send anything → backend receives nothing → dashboard shows empty.

### How It Connects
- **Read by:** `simulator/simulator.py` (the simulator reads this file on startup)
- **Not used by:** Backend or frontend (they never touch this file directly)

---

# 🤖 PART 2: THE SIMULATOR FOLDER

## `simulator/simulator.py`

### What Type of File Is This?
A Python **script** (a program you run from the terminal with `python simulator.py`).

### What Does It Do? (Simple Version)
Pretends to be 4 physical gas sensors running at the same time, each sending pressure and purity readings to the backend every few seconds.

### What Does It Do? (Detailed Line-by-Line)

**SECTION 1: Imports** (lines 1–6)
```python
import asyncio, csv, os, random, pathlib
from datetime import datetime, timezone
import httpx
```
- `asyncio` — Python's library for running multiple things at once (needed to simulate 4 devices simultaneously)
- `csv` — reads the CSV file
- `random` — picks random rows and random delays
- `httpx` — sends HTTP requests (like `requests` but works with asyncio)
- `datetime` — gets current time

**SECTION 2: Configuration** (lines 8–18)
```python
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")
MIN_DELAY   = float(os.getenv("MIN_DELAY", "2"))
MAX_DELAY   = float(os.getenv("MAX_DELAY", "6"))
CSV_PATH    = os.getenv("CSV_PATH", "...pressure_data.csv")
```
`os.getenv("NAME", "default")` means: "Check if there's an environment variable called NAME. If yes, use it. If no, use this default value."

This lets you customize behavior without changing code:
```bash
# Run with custom delay:
MIN_DELAY=10 MAX_DELAY=20 python simulator.py
```

**Threshold constants:**
```python
PRESSURE_MIN = 40.0   # Below this = ⚠ LOW
PRESSURE_MAX = 100.0  # Above this = ⚠ HIGH
PURITY_MIN   = 93.0
PURITY_MAX   = 99.0
```
Used only for the terminal printout labels (the backend has its own copy of these thresholds).

**SECTION 3: Helper Functions** (lines 21–33)

`load_csv(path)` — reads the CSV and groups rows by device:
```python
{
  "D001": [ {device_id:"D001", pressure:72.4, oxygen_purity:96.2}, ... ],
  "D002": [ {device_id:"D002", pressure:68.1, oxygen_purity:95.8}, ... ],
  ...
}
```

`p_label()` and `o_label()` — return strings for terminal output:
```python
p_label(112.7) → "⚠ HI-P "
p_label(28.3)  → "⚠ LOW-P"
p_label(72.4)  → "  OK   "
```

**SECTION 4: Device Loop** — THE MOST IMPORTANT FUNCTION (lines 36–63)

This function runs **forever** for one device:
```python
async def run_device(device_id: str, rows: list[dict], client: httpx.AsyncClient):
    while True:  # ← infinite loop!
        # Step 1: Pick random row
        row = random.choice(rows)  # e.g., {pressure: 112.7, oxygen_purity: 98.9}
        
        # Step 2: Random delay (2 to 6 seconds)
        delay = random.uniform(MIN_DELAY, MAX_DELAY)  # e.g., 4.3 seconds
        await asyncio.sleep(delay)  # ← WAIT (doesn't block other devices!)
        
        # Step 3: Get current real time (not CSV timestamp!)
        now = datetime.now(timezone.utc)  # e.g., "2026-10-02 09:15:32.123456+00:00"
        
        # Step 4: Build payload (the data we're sending)
        payload = {
            "device_id":     device_id,      # "D001"
            "pressure":      row["pressure"],      # 112.7
            "oxygen_purity": row["oxygen_purity"], # 98.9
            "timestamp":     now.isoformat()       # "2026-10-02T09:15:32.123456+00:00"
        }
        
        # Step 5: Print status line to terminal
        print(f"  09:15:32  D001  P[⚠ HI-P ] 112.7 PSI  O[  OK   ] 98.9%")
        
        # Step 6: Send to backend (POST request)
        try:
            resp = await client.post(f"{BACKEND_URL}/readings", json=payload, timeout=5.0)
            if resp.status_code not in (200, 201):
                print(f"    ⛔ {device_id} → HTTP {resp.status_code}")
        except Exception as exc:
            print(f"    ⛔ {device_id} → {exc}")
        
        # Step 7: Loop back to Step 1
```

**Why `await asyncio.sleep(delay)` doesn't freeze everything:**

Normal Python `time.sleep(4)` would freeze the entire program for 4 seconds.  
`await asyncio.sleep(4)` says: "I'm pausing for 4 seconds, but let other tasks run while I wait."

This is how 4 devices can all run their loops simultaneously without blocking each other.

**SECTION 5: Main Function** (lines 66–92)

```python
async def main():
    # Print banner
    print("Medical Gas Sensor Simulator...")
    
    # Load CSV
    device_map = load_csv(CSV_PATH)  # { "D001": [...], "D002": [...], ... }
    
    # Print summary (how many rows per device, how many LOW/HIGH values)
    for did, rows in device_map.items():
        p_low  = sum(1 for r in rows if r["pressure"] < PRESSURE_MIN)
        p_high = sum(1 for r in rows if r["pressure"] > PRESSURE_MAX)
        print(f"  {did}: {len(rows)} rows  Pressure[LOW={p_low} HIGH={p_high}] ...")
    
    # Start all 4 device loops simultaneously
    async with httpx.AsyncClient() as client:
        tasks = []
        for did, rows in sorted(device_map.items()):
            await asyncio.sleep(0.3)  # stagger start by 0.3s
            tasks.append(asyncio.create_task(run_device(did, rows, client)))
        await asyncio.gather(*tasks)  # ← runs all 4 forever
```

`asyncio.gather(*tasks)` means: "Run all these tasks at the same time and wait for them to finish" (but they never finish because they loop forever).

**SECTION 6: Entry Point** (lines 95–96)
```python
if __name__ == "__main__":
    asyncio.run(main())
```
This means: "If someone runs this file directly (`python simulator.py`), execute `main()`."

### Key Behaviors to Understand

**1. Random row selection (not sequential)**
The simulator does NOT play the CSV from top to bottom. It picks rows randomly. This means:
- D001 might send 72 PSI, then 112 PSI, then 38 PSI — in any order
- This simulates real unpredictable sensor behavior

**2. Real timestamps replace CSV timestamps**
Even though the CSV has timestamps from October 2026, the simulator always sends `datetime.now()` — the current real time. This is why the live charts update with current times.

**3. Random delays between readings**
Each device waits a random time between 2 and 6 seconds before sending the next reading. This is realistic — real sensors don't send data at perfectly regular intervals.

### Terminal Output Example
```
  ──────────────────────────────────────────────────────────
  Medical Gas Sensor Simulator  [Pressure + Oxygen Purity]
  Backend : http://127.0.0.1:8000
  Delay   : 2s – 6s  (random)
  ──────────────────────────────────────────────────────────
  D001: 70 rows  Pressure[LOW=8 HIGH=12]  Purity[LOW=5 HIGH=7]
  D002: 70 rows  Pressure[LOW=6 HIGH=10]  Purity[LOW=4 HIGH=6]
  D003: 70 rows  Pressure[LOW=7 HIGH=11]  Purity[LOW=6 HIGH=8]
  D004: 70 rows  Pressure[LOW=9 HIGH=13]  Purity[LOW=5 HIGH=7]

  Starting 4 device loops …

  Time      Dev   Pressure              Purity
  ────────  ────  ────────────────────  ────────────────────
  09:00:00  D001  P[⚠ HI-P ] 112.7 PSI  O[  OK   ] 98.9%
  09:00:02  D003  P[  OK   ]  74.2 PSI  O[  OK   ] 96.1%
  09:00:03  D002  P[⚠ LOW-P]  28.3 PSI  O[⚠ LOW-O] 91.2%
  09:00:05  D004  P[  OK   ]  82.7 PSI  O[  OK   ] 98.3%
  ...
```

### What Happens If You Stop It?
- Backend stops receiving new readings
- Dashboard stops updating (stays frozen at last received data)
- No new alerts will be created
- Existing data in database remains (it's already been saved)

### How to Start It
```bash
cd simulator
python simulator.py
```
Keep it running forever in a terminal. Press Ctrl+C to stop.

---

# 🔧 PART 3: THE BACKEND FOLDER

The backend is the brain of the system. It's written in Python using a framework called **FastAPI**.

## What is FastAPI?
Think of FastAPI as a "web server kit" — it lets you create URLs that accept requests and send back responses. Example:
```
Browser/Simulator sends:  POST http://localhost:8000/readings
Backend receives it, processes it, saves to database
Backend sends back:       {"reading_id": 1234, "status": "HIGH_PRESSURE"}
```

---

## `backend/requirements.txt`

### What Type of File Is This?
A plain text file listing all the **Python packages** (libraries) the backend needs to run.

### What Does It Contain?
```
fastapi==0.111.0
uvicorn[standard]==0.29.0
asyncpg==0.29.0
pydantic==2.7.1
pydantic-settings==2.2.1
python-dotenv==1.0.1
```

Each line is:
```
package_name==exact_version_number
```

**What each package does:**
1. **fastapi** — the web framework (creates the API endpoints like `/readings`, `/devices`, etc.)
2. **uvicorn** — the web server that runs FastAPI (like a waiter serving HTTP requests)
3. **asyncpg** — PostgreSQL database driver (talks to the database using async Python)
4. **pydantic** — data validation library (makes sure incoming data has the right shape)
5. **pydantic-settings** — reads configuration from `.env` files
6. **python-dotenv** — loads `.env` files into environment variables

### Why Does It Exist?
Python doesn't come with these libraries built-in. You need to install them. This file tells `pip` (Python's package installer) what to install.

### How to Use It
```bash
cd backend
pip install -r requirements.txt
```
This reads the file and installs all 6 packages.

### What Happens If You Delete It?
Nothing breaks immediately (if packages are already installed). But if you set up the project on a new computer, you won't know what packages to install.

---

## `backend/.env`

### What Type of File Is This?
A **configuration file** in "key=value" format. Not committed to git (sensitive information like passwords).

### What Does It Contain?
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=medical_gas_db
DB_USER=postgres
DB_PASSWORD=postgres123
```

These are **environment variables** — settings that change between computers or environments (development vs production).

### Why Does It Exist?
**Security:** You don't want your database password hardcoded in Python files. If you push code to GitHub with a hardcoded password, anyone can see it.

**Flexibility:** Different team members might have different PostgreSQL passwords. Everyone creates their own `.env` file with their own password.

### How It Works
`pydantic-settings` automatically reads this file. In `config.py`:
```python
class Settings(BaseSettings):
    db_password: str = "postgres"  # ← default value
    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()  # ← automatically loads .env
print(settings.db_password)  # → "postgres123" (from .env)
```

### What Happens If You Delete It?
`config.py` falls back to default values. If your actual PostgreSQL password is different from "postgres", the backend will fail to connect with this error:
```
asyncpg.exceptions.InvalidPasswordError: password authentication failed for user "postgres"
```

---

## `backend/app/__init__.py`

### What Type of File Is This?
An empty (or nearly empty) Python file.

### Why Does It Exist?
In Python, a folder is only considered a "package" (importable) if it contains a file named `__init__.py`. Without it, `import app.config` wouldn't work.

Modern Python (3.3+) doesn't strictly require it, but it's still good practice.

### What Happens If You Delete It?
Probably nothing breaks (in Python 3.11+). But some tools might complain.

---

## `backend/app/config.py`

### What Type of File Is This?
A Python module (file) that defines all configuration settings using **Pydantic Settings**.

### What Does It Do? (Line by Line)
```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Database connection settings
    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "medical_gas_db"
    db_user: str = "postgres"
    db_password: str = "postgres"
    
    # Pressure thresholds (PSI)
    pressure_min: float = 40.0   # Below this = LOW_PRESSURE alert
    pressure_max: float = 100.0  # Above this = HIGH_PRESSURE alert
    
    # Oxygen purity thresholds (%)
    purity_min: float = 93.0     # Below this = LOW_PURITY alert
    purity_max: float = 99.0     # Above this = HIGH_PURITY alert
    
    # Tell Pydantic to load from .env file
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

# Create one settings object (singleton pattern)
settings = Settings()
```

**What is a singleton?** Only one `settings` object exists for the entire backend. Every file imports the same one:
```python
from app.config import settings
print(settings.pressure_max)  # → 100.0
```

### Why Thresholds Are Here
If you want to change the safe pressure range from 40–100 to 50–110, you change it in ONE place (this file) and the entire system updates:
- Alert engine uses these to classify readings
- Frontend might display them in the UI
- Simulator prints them in the terminal summary

### What Happens If You Delete It?
ImportError everywhere. Everything that imports `settings` crashes:
```python
from app.config import settings  # ← ModuleNotFoundError
```

---

## `backend/app/main.py`

### What Type of File Is This?
The **entry point** of the entire backend application. This is the file Uvicorn runs.

### What Does It Do? (Beginner Explanation)

Think of `main.py` as the "boss" file that:
1. Creates the web application
2. Sets up CORS (so browsers can call the API)
3. Connects to the database when starting
4. Registers all the URL routes (like `/readings`, `/devices`, etc.)
5. Closes the database when shutting down

### What Does It Do? (Code Walkthrough)

**IMPORT SECTION** (lines 1–8)
```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import init_db, close_db
from app.routers import readings, devices, alerts, ws
```
- `asynccontextmanager` — a decorator for startup/shutdown logic
- `FastAPI` — the main class that creates the web app
- `CORSMiddleware` — fixes the "blocked by CORS policy" browser error
- `init_db, close_db` — database connection functions
- `readings, devices, alerts, ws` — the 4 router modules (each handles different URLs)

**LIFESPAN HANDLER** (lines 11–15)
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()    # ← Run ONCE when server starts
    yield              # ← Server runs here (handling all requests)
    await close_db()   # ← Run ONCE when server shuts down
```

This is a special function that manages the application lifecycle:
```
Server starts → init_db() runs → Server handles requests → Ctrl+C pressed → close_db() runs
```

**CREATE THE APP** (lines 18–22)
```python
app = FastAPI(
    title="Medical Gas Monitoring API",
    version="1.0.0",
    lifespan=lifespan,  # ← connects the lifespan handler
)
```
This creates the core FastAPI application object. Everything else attaches to this.

**CORS MIDDLEWARE** (lines 25–31)
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # ← Allow requests from ANY website
    allow_credentials=False,
    allow_methods=["*"],      # ← Allow GET, POST, PUT, DELETE, etc.
    allow_headers=["*"],      # ← Allow any HTTP headers
)
```

**What is CORS?** Cross-Origin Resource Sharing — a browser security feature.

**The problem:**
- Frontend runs on `http://localhost:5173` (Vite dev server)
- Backend runs on `http://localhost:8000` (FastAPI)
- These are different "origins" (different ports)
- By default, browsers block requests from 5173 to 8000 (security protection)

**The solution:**
This middleware tells the browser: "It's okay, I allow requests from any origin." Without this, the frontend would get this error:
```
Access to fetch at 'http://localhost:8000/readings' from origin 'http://localhost:5173'
has been blocked by CORS policy
```

**REGISTER ROUTERS** (lines 34–37)
```python
app.include_router(readings.router)
app.include_router(devices.router)
app.include_router(alerts.router)
app.include_router(ws.router)
```

Each router is a separate Python file that defines a group of related endpoints:
- `readings.router` → `/readings` (POST and GET)
- `devices.router` → `/devices` (GET)
- `alerts.router` → `/alerts`, `/alerts/{id}/acknowledge`, `/alerts/{id}/resolve`
- `ws.router` → `/ws` (WebSocket endpoint)

Without these lines, those URLs wouldn't exist — requests to them would return 404.

**HEALTH CHECK ENDPOINT** (lines 40–42)
```python
@app.get("/", tags=["health"])
async def health():
    return {"status": "ok", "service": "medical-gas-monitor"}
```

A simple test endpoint. Visit `http://localhost:8000/` in your browser and you'll see:
```json
{"status": "ok", "service": "medical-gas-monitor"}
```
Useful for checking if the backend is running.

### How to Start the Backend
```bash
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**What each part means:**
- `python -m uvicorn` — run the uvicorn package as a Python module
- `app.main:app` — in the `app` folder, file `main.py`, variable `app`
- `--reload` — auto-restart when code changes (development mode)
- `--host 0.0.0.0` — listen on all network interfaces (important for Windows)
- `--port 8000` — listen on port 8000

### What Happens If You Delete It?
The backend doesn't exist anymore. Nothing works. Running `uvicorn app.main:app` fails with:
```
ModuleNotFoundError: No module named 'app.main'
```

---

## `backend/app/ws_manager.py`

### What Type of File Is This?
A Python module that defines a **WebSocket connection manager** class.

### What is WebSocket? (Beginner Explanation)

**Normal HTTP:** Client asks question, server answers, connection closes.
```
Browser → Server: "Hey, give me the list of devices"
Server → Browser: "Here: [D001, D002, D003, D004]"
[Connection closes]
```
If you want updates, you have to ask again.

**WebSocket:** Client and server open a permanent connection that stays open.
```
Browser → Server: "Open connection please"
Server → Browser: "Connected! I'll push updates to you automatically"
[Connection stays open forever]
Server → Browser: "New reading: D001 pressure is now 112 PSI" (pushed without being asked)
Server → Browser: "New alert created for D001" (pushed without being asked)
```

Think of it like a phone call vs. text messaging:
- HTTP = text message (ask, wait for answer, done)
- WebSocket = phone call (stay connected, talk whenever you want)

### What Does It Do? (Code Walkthrough)

```python
import json
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self._active: list[WebSocket] = []  # ← list of all connected browsers
```
When a browser opens the app, it connects to `/ws`. The WebSocket object goes into this list.

**`connect()` method:**
```python
async def connect(self, ws: WebSocket) -> None:
    await ws.accept()              # ← Accept the connection
    self._active.append(ws)        # ← Add to list
    print(f"🔌  WS client connected  (total: {len(self._active)})")
```
When a new browser opens the dashboard, this runs. The print shows in the backend terminal:
```
🔌  WS client connected  (total: 1)
🔌  WS client connected  (total: 2)  ← someone else opened the dashboard too
```

**`disconnect()` method:**
```python
def disconnect(self, ws: WebSocket) -> None:
    self._active.remove(ws)        # ← Remove from list
    print(f"🔌  WS client disconnected (total: {len(self._active)})")
```
When someone closes their browser tab or refreshes, this runs.

**`broadcast()` method — THE MOST IMPORTANT:**
```python
async def broadcast(self, payload: dict) -> None:
    """Send a JSON message to EVERY connected client simultaneously."""
    message = json.dumps(payload, default=str)  # ← Convert dict to JSON string
    dead: list[WebSocket] = []
    
    # Loop through every connected browser
    for ws in self._active:
        try:
            await ws.send_text(message)  # ← Send the message
        except Exception:
            dead.append(ws)  # ← This connection is broken, mark for removal
    
    # Remove dead connections
    for ws in dead:
        self._active.remove(ws)
```

**Real example — when a reading arrives:**
```python
# In readings.py, after storing a reading:
await manager.broadcast({
    "event": "new_reading",
    "reading": {
        "device_id": "D001",
        "pressure": 112.7,
        "oxygen_purity": 98.9,
        "status": "HIGH_PRESSURE",
        "timestamp": "2026-10-02T09:15:32Z"
    }
})
```
This JSON message gets sent to ALL open dashboards at the exact same moment.

**Singleton instance:**
```python
manager = ConnectionManager()  # ← One global instance
```
Every file imports this same `manager` object:
```python
from app.ws_manager import manager
await manager.broadcast({...})
```

### What Happens If You Delete It?
ImportError in `readings.py`, `alerts.py`, and `ws.py`. No WebSocket functionality → no live updates → dashboard only shows initial data, never refreshes.

---

*Due to length, I'll continue in the next response with the database files, alert engine, routers, and frontend...*

Would you like me to continue with the rest of the files? I'll cover:
- Database files (`schema.sql`, `database.py`)
- Models (`schemas.py`)
- Alert engine
- All 4 routers
- All frontend files (React components, hooks, pages)
- Configuration files

Let me know and I'll create the next part!