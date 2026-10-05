"""
Medical Gas Sensor Simulator — Dual Parameter  (v2 — scenario mode)
====================================================================
SIM_MODE=scenario  (default)
  Each device sends only NORMAL readings every 3-5 s.
  Every 90-180 s one random device+metric gets a 60-120 s fault window
  (LOW or HIGH values, slightly varying). Only one fault runs at a time.

SIM_MODE=random  (old behaviour — kept for stress testing)
  Picks random CSV rows as before.

Press F + Enter in the terminal to inject a fault immediately.
Pass --fault-now on the command line to inject a fault on startup.
"""

import asyncio, csv, os, random, pathlib, sys, argparse, time, threading
from datetime import datetime, timezone
import httpx

# ── Config ────────────────────────────────────────────────────────────────────
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")
API_KEY     = os.getenv("API_KEY",     "sim-secret-key-2024")
SIM_MODE    = os.getenv("SIM_MODE",    "scenario")   # "scenario" | "random"

MIN_DELAY   = float(os.getenv("MIN_DELAY", "3"))
MAX_DELAY   = float(os.getenv("MAX_DELAY", "5"))

# Fault timing (scenario mode)
FAULT_INTERVAL_MIN = float(os.getenv("FAULT_INTERVAL_MIN", "90"))   # seconds between faults
FAULT_INTERVAL_MAX = float(os.getenv("FAULT_INTERVAL_MAX", "180"))
FAULT_DURATION_MIN = float(os.getenv("FAULT_DURATION_MIN", "60"))   # seconds a fault lasts
FAULT_DURATION_MAX = float(os.getenv("FAULT_DURATION_MAX", "120"))

CSV_PATH = os.getenv(
    "CSV_PATH",
    str(pathlib.Path(__file__).parent.parent / "dataset" / "pressure_data.csv"),
)

# Safe ranges (must match backend .env)
PRESSURE_MIN = 40.0; PRESSURE_MAX = 100.0
PURITY_MIN   = 93.0; PURITY_MAX   = 99.0

# ── Fault state (shared across coroutines) ───────────────────────────────────
_fault_lock       = asyncio.Lock()
_active_fault     = None     # {"device_id", "metric", "type", "ends_at"}
_fault_now_event  = asyncio.Event()  # set to inject fault immediately


# ── CSV loading ───────────────────────────────────────────────────────────────
def load_csv(path: str):
    normal, abnormal = {}, {}
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            did = row["device_id"]
            p   = float(row["pressure"])
            o   = float(row.get("oxygen_purity", 96.0))
            bucket = normal if (PRESSURE_MIN <= p <= PRESSURE_MAX and
                                PURITY_MIN   <= o <= PURITY_MAX) else abnormal
            bucket.setdefault(did, []).append({"device_id": did, "pressure": p, "oxygen_purity": o})
    return normal, abnormal


# ── Label helpers ─────────────────────────────────────────────────────────────
def p_label(p):
    if p < PRESSURE_MIN: return "⚠ LOW-P"
    if p > PRESSURE_MAX: return "⚠ HI-P "
    return "  OK   "

def o_label(o):
    if o < PURITY_MIN: return "⚠ LOW-O"
    if o > PURITY_MAX: return "⚠ HI-O "
    return "  OK   "


# ── Fault value generators ────────────────────────────────────────────────────
def _abnormal_pressure(fault_type: str) -> float:
    """Generate a mildly varying pressure outside the safe range."""
    if fault_type == "LOW":
        base = random.uniform(20.0, 38.0)
    else:   # HIGH
        base = random.uniform(102.0, 130.0)
    return round(base + random.uniform(-1.5, 1.5), 2)

def _abnormal_purity(fault_type: str) -> float:
    if fault_type == "LOW":
        base = random.uniform(86.0, 91.5)
    else:
        base = random.uniform(100.2, 102.0)
    return round(base + random.uniform(-0.5, 0.5), 2)


# ── Single device loop ────────────────────────────────────────────────────────
async def run_device(device_id: str, normal_rows: list, all_abnormal: dict,
                     client: httpx.AsyncClient, mode: str):
    while True:
        delay = random.uniform(MIN_DELAY, MAX_DELAY)
        await asyncio.sleep(delay)

        now = datetime.now(timezone.utc)
        pressure, purity = None, None

        if mode == "random":
            # Old behaviour: pick any CSV row for this device
            all_rows = normal_rows + all_abnormal.get(device_id, [])
            row = random.choice(all_rows) if all_rows else random.choice(normal_rows)
            pressure = row["pressure"]
            purity   = row["oxygen_purity"]

        else:
            # Scenario mode: check active fault
            async with _fault_lock:
                fault = _active_fault

            if fault and fault["device_id"] == device_id and time.time() < fault["ends_at"]:
                # Inject abnormal reading
                metric = fault["metric"]
                ftype  = fault["type"]
                # Normal value for the other metric
                base_row = random.choice(normal_rows)
                if metric == "pressure":
                    pressure = _abnormal_pressure(ftype)
                    purity   = base_row["oxygen_purity"]
                else:
                    pressure = base_row["pressure"]
                    purity   = _abnormal_purity(ftype)
            else:
                # Normal reading
                row      = random.choice(normal_rows)
                pressure = row["pressure"]
                purity   = row["oxygen_purity"]

        payload = {
            "device_id":     device_id,
            "pressure":      pressure,
            "oxygen_purity": purity,
            "timestamp":     now.isoformat(),
        }

        ts = now.strftime("%H:%M:%S")
        print(
            f"  {ts}  {device_id}  "
            f"P[{p_label(pressure)}] {pressure:.1f} PSI  "
            f"O[{o_label(purity)}] {purity:.1f}%"
        )

        try:
            resp = await client.post(
                f"{BACKEND_URL}/readings",
                json=payload,
                headers={"X-API-Key": API_KEY},
                timeout=5.0,
            )
            if resp.status_code not in (200, 201):
                print(f"    ⛔ {device_id} → HTTP {resp.status_code}: {resp.text[:120]}")
        except Exception as exc:
            print(f"    ⛔ {device_id} → {exc}")


# ── Fault injector (scenario mode only) ─────────────────────────────────────
async def fault_injector(device_ids: list):
    """
    Waits a random interval, then sets one fault at a time.
    Also responds to the _fault_now_event (F key or --fault-now).
    """
    global _active_fault

    # Small startup delay
    await asyncio.sleep(10)

    while True:
        # Wait for the next scheduled fault OR an immediate request
        interval = random.uniform(FAULT_INTERVAL_MIN, FAULT_INTERVAL_MAX)
        try:
            await asyncio.wait_for(_fault_now_event.wait(), timeout=interval)
            _fault_now_event.clear()
            print("\n  ⚡  Manual fault injection triggered!\n")
        except asyncio.TimeoutError:
            pass  # scheduled interval elapsed

        async with _fault_lock:
            if _active_fault and time.time() < _active_fault["ends_at"]:
                print("  ⏳  Fault already active — skipping injection.")
                continue

            did    = random.choice(device_ids)
            metric = random.choice(["pressure", "purity"])
            ftype  = random.choice(["LOW", "HIGH"])
            dur    = random.uniform(FAULT_DURATION_MIN, FAULT_DURATION_MAX)
            _active_fault = {
                "device_id": did,
                "metric":    metric,
                "type":      ftype,
                "ends_at":   time.time() + dur,
            }
            print(
                f"\n  🔴  FAULT: {did} {metric.upper()} {ftype}  "
                f"duration={dur:.0f}s\n"
            )


# ── Keyboard listener (runs in a thread, sets the asyncio event) ─────────────
def _keyboard_listener(loop: asyncio.AbstractEventLoop):
    while True:
        try:
            key = input()
        except EOFError:
            break
        if key.strip().upper() == "F":
            loop.call_soon_threadsafe(_fault_now_event.set)
            print("  [fault queued]")


# ── main ──────────────────────────────────────────────────────────────────────
async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--fault-now", action="store_true",
                        help="Inject a fault immediately on startup")
    parser.add_argument("--mode", default=None,
                        help="Override SIM_MODE (scenario|random)")
    args = parser.parse_args()

    mode = args.mode or SIM_MODE

    print(f"\n{'─'*65}")
    print(f"  Medical Gas Sensor Simulator  v2  [{mode.upper()} mode]")
    print(f"  Backend : {BACKEND_URL}")
    print(f"  Delay   : {MIN_DELAY}s – {MAX_DELAY}s  (random per reading)")
    if mode == "scenario":
        print(f"  Faults  : every {FAULT_INTERVAL_MIN:.0f}–{FAULT_INTERVAL_MAX:.0f}s,  "
              f"lasts {FAULT_DURATION_MIN:.0f}–{FAULT_DURATION_MAX:.0f}s")
        print(f"  Debounce: alert opens after 3 consecutive abnormal readings")
        print(f"  Press F + Enter to inject a fault immediately")
    print(f"{'─'*65}")

    normal_map, abnormal_map = load_csv(CSV_PATH)
    device_ids = sorted(normal_map.keys())

    for did in device_ids:
        n  = len(normal_map.get(did, []))
        ab = len(abnormal_map.get(did, []))
        print(f"  {did}: {n} normal rows, {ab} abnormal rows")

    if not device_ids:
        print("  ⛔ No devices found in CSV. Check CSV_PATH.")
        return

    print(f"\n  Starting {len(device_ids)} device loops …\n")
    print(f"  {'Time':8}  {'Dev':4}  {'Pressure':20}  {'Purity':20}")
    print(f"  {'─'*8}  {'─'*4}  {'─'*20}  {'─'*20}")

    if args.fault_now and mode == "scenario":
        _fault_now_event.set()

    # Start keyboard listener thread
    if mode == "scenario":
        loop = asyncio.get_event_loop()
        t = threading.Thread(target=_keyboard_listener, args=(loop,), daemon=True)
        t.start()

    async with httpx.AsyncClient() as client:
        tasks = []
        for i, did in enumerate(device_ids):
            await asyncio.sleep(0.5 * i)   # stagger startup
            normal_rows = normal_map.get(did, [])
            if not normal_rows:
                print(f"  ⚠  {did}: no normal rows in CSV, skipping")
                continue
            tasks.append(asyncio.create_task(
                run_device(did, normal_rows, abnormal_map, client, mode)
            ))

        if mode == "scenario":
            tasks.append(asyncio.create_task(fault_injector(device_ids)))

        await asyncio.gather(*tasks)


if __name__ == "__main__":
    asyncio.run(main())
