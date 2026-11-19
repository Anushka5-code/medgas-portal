"""
routers/tablet.py
=================
POST /api/readings  — receive a tablet message

Rules (from portal-guide and steering/rules.md):
  - No API key or JWT required (tablet sends none today)
  - Return 200 on success
  - Return 200 for a duplicate (device_id + seq) without storing again
  - Ignore event == "test" (return 200, store nothing)
  - Auto-create the device in tablet_devices when device_id is new
  - Update last_seen_at on every accepted message
  - Store the message timestamp (from the tablet), not the arrival time
  - Do NOT compute thresholds; do NOT create alerts (next step)
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Request, HTTPException, status
from pydantic import ValidationError

from app.db.database import get_pool
from app.integration.adapter import normalize

router = APIRouter(prefix="/api", tags=["tablet"])


@router.post("/readings", status_code=200)
async def ingest_tablet_reading(request: Request):
    # ── Parse body ────────────────────────────────────────────────────────
    try:
        payload: dict[str, Any] = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    # ── Ignore test events BEFORE any validation (rule 11) ──────────────
    # Test messages only carry device_id, timestamp, event, alert_status.
    # They have no seq, so normalise() must never be called for them.
    if payload.get("event") == "test":
        return {"status": "ignored"}

    # ── Normalise ─────────────────────────────────────────────────────────
    try:
        msg = normalize(payload)
    except KeyError as exc:
        raise HTTPException(status_code=422, detail=f"Missing required field: {exc}")
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    pool = get_pool()
    async with pool.acquire() as conn:
        # ── Auto-create device if new ─────────────────────────────────────
        await conn.execute(
            """
            INSERT INTO tablet_devices (device_id, last_seen_at, status)
            VALUES ($1, $2, $3)
            ON CONFLICT (device_id) DO NOTHING
            """,
            msg.device_id,
            msg.timestamp,
            msg.alert_status or "UNKNOWN",
        )

        # ── Duplicate check (rule 6) ──────────────────────────────────────
        existing_id = await conn.fetchval(
            "SELECT id FROM tablet_messages WHERE device_id = $1 AND seq = $2",
            msg.device_id, msg.seq,
        )
        if existing_id is not None:
            return {"status": "duplicate", "message_id": existing_id}

        # ── Store message ─────────────────────────────────────────────────
        raw_json = json.dumps(payload)
        message_id = await conn.fetchval(
            """
            INSERT INTO tablet_messages
                (device_id, seq, event, alert_status, confidence_pct,
                 timestamp, received_at, raw_payload)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
            RETURNING id
            """,
            msg.device_id,
            msg.seq,
            msg.event,
            msg.alert_status,
            msg.confidence_pct,
            msg.timestamp,
            datetime.now(timezone.utc),
            raw_json,
        )

        # ── Store gauge readings ──────────────────────────────────────────
        for gauge in msg.gauges:
            await conn.execute(
                """
                INSERT INTO gauge_readings
                    (message_id, device_id, gauge_id, number, gas, kind,
                     reading, unit, status, status_text,
                     safe_low, safe_high, safe_critical, safe_buffer,
                     confidence_pct, timestamp)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
                """,
                message_id,
                msg.device_id,
                gauge.gauge_id,
                gauge.number,
                gauge.gas,
                gauge.kind,
                gauge.reading,
                gauge.unit,
                gauge.status,
                gauge.status_text,
                gauge.safe_low,
                gauge.safe_high,
                gauge.safe_critical,
                gauge.safe_buffer,
                gauge.confidence_pct,
                msg.timestamp,
            )

        # ── Update device last_seen_at and status ─────────────────────────
        await conn.execute(
            """
            UPDATE tablet_devices
            SET    last_seen_at = $1,
                   status       = $2
            WHERE  device_id    = $3
            """,
            msg.timestamp,
            msg.alert_status or "UNKNOWN",
            msg.device_id,
        )

    return {"status": "ok", "message_id": message_id}
