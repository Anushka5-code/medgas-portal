"""
routers/handover.py
===================
GET /handover/summary   — NURSE only, own ward, last 8 h shift summary
GET /stats/overview     — DOCTOR only, cross-ward overview counts
"""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from app.db.database import get_pool
from app.models.schemas import HandoverSummary, StatsOverview
from app.security import require_role, require_any_role

router = APIRouter(tags=["handover"])

SHIFT_HOURS = 8


# ── Handover summary (NURSE only) ─────────────────────────────────────────────
@router.get("/handover/summary", response_model=HandoverSummary)
async def handover_summary(user: dict = Depends(require_role("NURSE"))):
    if not user["ward_id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nurse account has no ward assigned",
        )

    pool = get_pool()
    since = datetime.now(timezone.utc) - timedelta(hours=SHIFT_HOURS)

    async with pool.acquire() as conn:
        # Ward name
        ward_name = user.get("ward_name") or await conn.fetchval(
            "SELECT name FROM wards WHERE id = $1", user["ward_id"]
        )

        # All alerts for this ward in the shift window
        alert_rows = await conn.fetch(
            """
            SELECT a.id, a.status, a.escalation_status, a.device_id
            FROM   alerts a
            JOIN   devices d ON d.device_id = a.device_id
            WHERE  d.ward_id = $1
              AND  a.created_at >= $2
            """,
            user["ward_id"], since,
        )

        # Devices in this ward that currently have an ACTIVE or ACKNOWLEDGED alert
        unstable = await conn.fetch(
            """
            SELECT DISTINCT a.device_id
            FROM   alerts a
            JOIN   devices d ON d.device_id = a.device_id
            WHERE  d.ward_id = $1
              AND  a.status IN ('ACTIVE', 'ACKNOWLEDGED')
            """,
            user["ward_id"],
        )

    total        = len(alert_rows)
    active       = sum(1 for r in alert_rows if r["status"] == "ACTIVE")
    acknowledged = sum(1 for r in alert_rows if r["status"] == "ACKNOWLEDGED")
    escalated    = sum(
        1 for r in alert_rows
        if r["escalation_status"] in ("PENDING", "RESPONDED")
    )

    return HandoverSummary(
        ward_id=user["ward_id"],
        ward_name=ward_name,
        shift_hours=SHIFT_HOURS,
        total_alerts=total,
        active_alerts=active,
        acknowledged_alerts=acknowledged,
        escalated_alerts=escalated,
        unstable_devices=[r["device_id"] for r in unstable],
    )


# ── Stats overview (DOCTOR only) ─────────────────────────────────────────────
@router.get("/stats/overview", response_model=StatsOverview)
async def stats_overview(user: dict = Depends(require_role("DOCTOR"))):
    pool = get_pool()
    async with pool.acquire() as conn:
        # Device counts — join latest reading per device
        device_rows = await conn.fetch(
            """
            SELECT r.status, r.purity_status
            FROM   devices d
            LEFT   JOIN LATERAL (
                SELECT status, purity_status
                FROM   readings
                WHERE  device_id = d.device_id
                ORDER  BY timestamp DESC
                LIMIT  1
            ) r ON TRUE
            """
        )

        active_alerts = await conn.fetchval(
            "SELECT COUNT(*) FROM alerts WHERE status = 'ACTIVE'"
        )

        # Average minutes to resolve (only resolved alerts with both timestamps)
        avg_resolve = await conn.fetchval(
            """
            SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60)
            FROM   alerts
            WHERE  status = 'RESOLVED'
              AND  resolved_at IS NOT NULL
            """
        )

    total   = len(device_rows)
    normal  = sum(
        1 for r in device_rows
        if r["status"] == "NORMAL" and r["purity_status"] == "NORMAL"
    )
    low  = sum(
        1 for r in device_rows
        if (r["status"] or "").endswith("LOW_PRESSURE")
        or (r["purity_status"] or "") == "LOW_PURITY"
    )
    high = sum(
        1 for r in device_rows
        if (r["status"] or "").endswith("HIGH_PRESSURE")
        or (r["purity_status"] or "") == "HIGH_PURITY"
    )

    return StatsOverview(
        total_devices=total,
        normal_devices=normal,
        low_devices=low,
        high_devices=high,
        active_alerts=int(active_alerts or 0),
        avg_resolve_mins=round(float(avg_resolve), 1) if avg_resolve else None,
    )
