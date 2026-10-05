"""
routers/readings.py
===================
POST /readings   — ingest sensor reading (X-API-Key: simulator only)
GET  /readings   — fetch recent readings (auth required, ward-scoped)
"""

from fastapi import APIRouter, Query, HTTPException, status, Header, Depends
from datetime import datetime
from typing import Optional

from app.models.schemas import ReadingIn, ReadingOut
from app.db.database import get_pool
from app.alert_engine.engine import classify_pressure, classify_purity, process_reading
from app.ws_manager import manager
from app.config import settings
from app.security import require_any_role

router = APIRouter(prefix="/readings", tags=["readings"])


# ── POST /readings (simulator only, API key gated) ───────────────────────────
@router.post("", status_code=201)
async def ingest_reading(
    payload: ReadingIn,
    x_api_key: Optional[str] = Header(None),
):
    # Check API key
    if x_api_key != settings.simulator_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing X-API-Key",
        )

    pool = get_pool()
    p_status = classify_pressure(payload.pressure)
    o_status = classify_purity(payload.oxygen_purity)

    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO devices (device_id) VALUES ($1) ON CONFLICT DO NOTHING",
            payload.device_id,
        )
        reading_id = await conn.fetchval(
            """
            INSERT INTO readings
                (device_id, pressure, oxygen_purity, status, purity_status, timestamp)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
            """,
            payload.device_id,
            payload.pressure,
            payload.oxygen_purity,
            p_status,
            o_status,
            payload.timestamp,
        )

    # Run alert engine
    alert_events = await process_reading(
        device_id=payload.device_id,
        pressure=payload.pressure,
        oxygen_purity=payload.oxygen_purity,
        timestamp=payload.timestamp,
        reading_id=reading_id,
    )

    # WebSocket broadcast
    ws_payload = {
        "event": "new_reading",
        "reading": {
            "id":            reading_id,
            "device_id":     payload.device_id,
            "pressure":      payload.pressure,
            "oxygen_purity": payload.oxygen_purity,
            "status":        p_status,
            "purity_status": o_status,
            "timestamp":     payload.timestamp.isoformat(),
        },
        "alerts": alert_events,
    }
    await manager.broadcast(ws_payload)

    return {
        "reading_id":    reading_id,
        "status":        p_status,
        "purity_status": o_status,
        "alerts":        alert_events,
    }


# ── GET /readings (auth required, ward-scoped) ────────────────────────────────
@router.get("", response_model=list[ReadingOut])
async def get_readings(
    device_id: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
    user: dict = Depends(require_any_role),
):
    pool = get_pool()
    async with pool.acquire() as conn:
        if user["role"] == "NURSE":
            # Nurse: only devices in their ward
            if device_id:
                rows = await conn.fetch(
                    """
                    SELECT r.id, r.device_id, r.pressure, r.oxygen_purity,
                           r.status, r.purity_status, r.timestamp
                    FROM   readings r
                    JOIN   devices d ON d.device_id = r.device_id
                    WHERE  r.device_id = $1 AND d.ward_id = $2
                    ORDER  BY r.timestamp DESC
                    LIMIT  $3
                    """,
                    device_id, user["ward_id"], limit,
                )
            else:
                rows = await conn.fetch(
                    """
                    SELECT r.id, r.device_id, r.pressure, r.oxygen_purity,
                           r.status, r.purity_status, r.timestamp
                    FROM   readings r
                    JOIN   devices d ON d.device_id = r.device_id
                    WHERE  d.ward_id = $1
                    ORDER  BY r.timestamp DESC
                    LIMIT  $2
                    """,
                    user["ward_id"], limit,
                )
        else:
            # Doctor: all devices
            if device_id:
                rows = await conn.fetch(
                    """
                    SELECT id, device_id, pressure, oxygen_purity,
                           status, purity_status, timestamp
                    FROM   readings
                    WHERE  device_id = $1
                    ORDER  BY timestamp DESC
                    LIMIT  $2
                    """,
                    device_id, limit,
                )
            else:
                rows = await conn.fetch(
                    """
                    SELECT id, device_id, pressure, oxygen_purity,
                           status, purity_status, timestamp
                    FROM   readings
                    ORDER  BY timestamp DESC
                    LIMIT  $1
                    """,
                    limit,
                )

    return [dict(r) for r in rows]
