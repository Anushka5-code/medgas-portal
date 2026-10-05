"""
Medical Gas Monitoring — FastAPI backend v2
===========================================
Startup: connects to PostgreSQL, applies schema + seed, starts HTTP + WebSocket,
and launches auto-escalation background task.
"""

import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import init_db, close_db
from app.routers import readings, devices, alerts, ws, auth, wards, handover
from app.alert_engine.engine import check_auto_escalation


# ── Background task: auto-escalation every 30 seconds ─────────────────────────
_escalation_task: asyncio.Task | None = None


async def _escalation_loop():
    """Background loop: check for stale alerts every 30s."""
    while True:
        await asyncio.sleep(30)
        try:
            await check_auto_escalation()
        except Exception as e:
            print(f"⚠️  Auto-escalation error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _escalation_task
    await init_db()
    _escalation_task = asyncio.create_task(_escalation_loop())
    print("🚀  Auto-escalation background task started.")
    yield
    if _escalation_task:
        _escalation_task.cancel()
    await close_db()


app = FastAPI(
    title="Medical Gas Monitoring API v2",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — allow all origins for now (tighten in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers
app.include_router(auth.router)
app.include_router(wards.router)
app.include_router(handover.router)
app.include_router(readings.router)
app.include_router(devices.router)
app.include_router(alerts.router)
app.include_router(ws.router)


@app.get("/", tags=["health"])
async def health():
    return {
        "status": "ok",
        "service": "medical-gas-monitor-v2",
        "features": [
            "JWT auth",
            "role-based access (DOCTOR/NURSE)",
            "ward-scoped data",
            "auto-escalation",
            "audit trail",
        ],
    }
