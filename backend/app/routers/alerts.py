"""
routers/alerts.py  (v3)
=======================
Existing endpoints unchanged in shape.
New:
  POST /alerts/{id}/remarks       — add remark (DOCTOR or ward-nurse, any status)
  GET  /alerts/{id}/remarks       — list remarks
GET /alerts      — now includes remark_count + last_remark fields
GET /alerts/history — now includes remark_count, last_remark, needs_remark
                      supports ?needs_remark=true filter
"""

from fastapi import APIRouter, HTTPException, Query, Depends, status
from datetime import datetime, timezone, timedelta
from typing import Optional

from app.models.schemas import (
    AlertOut, AcknowledgeRequest, EscalateRequest,
    RespondRequest, ResolveRequest, AlertEventOut,
    RemarkIn, RemarkOut,
)
from app.db.database import get_pool
from app.ws_manager import manager
from app.security import require_any_role, require_role, assert_ward_access

router = APIRouter(prefix="/alerts", tags=["alerts"])

# ── Column sets ───────────────────────────────────────────────────────────────
_ALERT_COLS = """
    a.id, a.device_id, a.alert_type, a.status, a.parameter,
    a.initial_value, a.max_value, a.min_value, a.current_value, a.threshold,
    a.initial_pressure, a.max_pressure, a.current_pressure,
    a.created_at, a.acknowledged_at, a.resolved_at,
    a.acknowledged_by, a.acknowledged_note,
    a.escalated_at, a.escalated_by, a.escalation_note, a.escalation_status,
    a.responded_by, a.responded_at, a.resolved_by,
    d.ward_id,
    u.name AS acknowledged_by_name
"""

_REMARK_COLS = """
    COUNT(r.id)                             AS remark_count,
    MAX(r.created_at)                       AS last_remark_at,
    (ARRAY_AGG(r.text ORDER BY r.created_at DESC))[1]    AS last_remark_text,
    (ARRAY_AGG(ru.name ORDER BY r.created_at DESC))[1]   AS last_remark_author
"""

_ALERT_JOIN = """
    FROM   alerts a
    JOIN   devices d ON d.device_id = a.device_id
    LEFT   JOIN users u  ON u.id  = a.acknowledged_by
"""

_REMARK_JOIN = """
    LEFT   JOIN alert_remarks r  ON r.alert_id = a.id
    LEFT   JOIN users ru         ON ru.id = r.user_id
"""


async def _fetch_alert(conn, alert_id: int) -> dict | None:
    row = await conn.fetchrow(
        f"SELECT {_ALERT_COLS} {_ALERT_JOIN} WHERE a.id = $1",
        alert_id,
    )
    return dict(row) if row else None


async def _log_event(conn, alert_id: int, event_type: str,
                     user_id=None, note=None):
    await conn.execute(
        "INSERT INTO alert_events (alert_id, event_type, user_id, note) "
        "VALUES ($1,$2,$3,$4)",
        alert_id, event_type, user_id, note,
    )


def _enrich_with_remarks(row: dict) -> dict:
    """Attach remark fields if they came from the query."""
    d = dict(row)
    d.setdefault("remark_count", 0)
    last_at     = d.pop("last_remark_at",     None)
    last_text   = d.pop("last_remark_text",   None)
    last_author = d.pop("last_remark_author", None)
    if last_text:
        d["last_remark"] = {
            "text":   last_text,
            "author": last_author,
            "at":     last_at.isoformat() if last_at else None,
        }
    else:
        d["last_remark"] = None
    return d


# ══════════════════════════════════════════════════════════════════════════════
# GET /alerts/history  (must come before /{alert_id})
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/history")
async def get_alerts_history(
    hours:        int            = Query(24, ge=1, le=168),
    needs_remark: Optional[bool] = Query(None),
    user: dict = Depends(require_any_role),
):
    pool  = get_pool()
    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    async with pool.acquire() as conn:
        base = f"""
            SELECT {_ALERT_COLS}, {_REMARK_COLS}
            {_ALERT_JOIN} {_REMARK_JOIN}
            WHERE  a.status = 'RESOLVED'
              AND  a.resolved_at >= ${{since_idx}}
            GROUP  BY a.id, d.ward_id, u.name
            ORDER  BY a.resolved_at DESC
        """
        if user["role"] == "NURSE":
            sql  = base.replace("{since_idx}", "$2")
            rows = await conn.fetch(
                f"""
                SELECT {_ALERT_COLS}, {_REMARK_COLS}
                {_ALERT_JOIN} {_REMARK_JOIN}
                WHERE  a.status = 'RESOLVED' AND a.resolved_at >= $2
                  AND  d.ward_id = $1
                GROUP  BY a.id, d.ward_id, u.name
                ORDER  BY a.resolved_at DESC
                """,
                user["ward_id"], since,
            )
        else:
            rows = await conn.fetch(
                f"""
                SELECT {_ALERT_COLS}, {_REMARK_COLS}
                {_ALERT_JOIN} {_REMARK_JOIN}
                WHERE  a.status = 'RESOLVED' AND a.resolved_at >= $1
                GROUP  BY a.id, d.ward_id, u.name
                ORDER  BY a.resolved_at DESC
                """,
                since,
            )

    result = [_enrich_with_remarks(r) for r in rows]

    # needs_remark filter: RESOLVED + zero remarks
    if needs_remark is True:
        result = [r for r in result if r.get("remark_count", 0) == 0]

    # Attach needs_remark flag to each row
    for r in result:
        r["needs_remark"] = r.get("remark_count", 0) == 0

    return result


# ══════════════════════════════════════════════════════════════════════════════
# GET /alerts
# ══════════════════════════════════════════════════════════════════════════════
@router.get("")
async def get_alerts(
    status_filter: Optional[str] = Query(None, alias="status"),
    device_id:     Optional[str] = Query(None),
    parameter:     Optional[str] = Query(None),
    limit:         int           = Query(200, ge=1, le=500),
    user: dict = Depends(require_any_role),
):
    pool = get_pool()
    filters, args = [], []
    idx = 1

    if user["role"] == "NURSE":
        filters.append(f"d.ward_id = ${idx}"); args.append(user["ward_id"]); idx += 1

    for col, val in [
        ("a.status",    status_filter and status_filter.upper()),
        ("a.device_id", device_id),
        ("a.parameter", parameter),
    ]:
        if val:
            filters.append(f"{col} = ${idx}"); args.append(val); idx += 1

    where = ("WHERE " + " AND ".join(filters)) if filters else ""
    args.append(limit)

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            f"""
            SELECT {_ALERT_COLS}, {_REMARK_COLS}
            {_ALERT_JOIN} {_REMARK_JOIN}
            {where}
            GROUP  BY a.id, d.ward_id, u.name
            ORDER  BY a.created_at DESC
            LIMIT  ${idx}
            """,
            *args,
        )
    return [_enrich_with_remarks(r) for r in rows]


# ══════════════════════════════════════════════════════════════════════════════
# GET /alerts/{alert_id}
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/{alert_id}")
async def get_alert_detail(alert_id: int, user: dict = Depends(require_any_role)):
    pool = get_pool()
    async with pool.acquire() as conn:
        alert = await _fetch_alert(conn, alert_id)
        if not alert:
            raise HTTPException(404, "Alert not found")
        if user["role"] == "NURSE" and alert["ward_id"] != user["ward_id"]:
            raise HTTPException(403, "Access denied to this ward")
        readings = await conn.fetch(
            "SELECT id, alert_id, pressure, oxygen_purity, timestamp "
            "FROM alert_readings WHERE alert_id=$1 ORDER BY timestamp ASC",
            alert_id,
        )
    return {"alert": alert, "readings": [dict(r) for r in readings]}


# ══════════════════════════════════════════════════════════════════════════════
# POST /alerts/{alert_id}/acknowledge
# ══════════════════════════════════════════════════════════════════════════════
@router.post("/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: int,
    body: AcknowledgeRequest,
    user: dict = Depends(require_any_role),
):
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT a.status, d.ward_id FROM alerts a "
            "JOIN devices d ON d.device_id=a.device_id WHERE a.id=$1",
            alert_id,
        )
        if not row:
            raise HTTPException(404, "Alert not found")
        if row["status"] != "ACTIVE":
            raise HTTPException(400, f"Alert is '{row['status']}', only ACTIVE can be acknowledged")
        if user["role"] == "NURSE":
            assert_ward_access(user, row["ward_id"])
            if not body.note:
                raise HTTPException(400, "Nurses must provide a note when acknowledging")

        await conn.execute(
            "UPDATE alerts SET status='ACKNOWLEDGED', acknowledged_at=$1, "
            "acknowledged_by=$2, acknowledged_note=$3 WHERE id=$4",
            datetime.now(timezone.utc), user["id"], body.note, alert_id,
        )
        await _log_event(conn, alert_id, "ACKNOWLEDGED", user["id"], body.note)
        updated = await _fetch_alert(conn, alert_id)

    await manager.broadcast({
        "event": "alert_acknowledged", "alert_id": alert_id,
        "device_id": updated["device_id"], "parameter": updated["parameter"],
        "user_id": user["id"],
    })
    return updated


# ══════════════════════════════════════════════════════════════════════════════
# POST /alerts/{alert_id}/escalate  (NURSE only)
# ══════════════════════════════════════════════════════════════════════════════
@router.post("/{alert_id}/escalate")
async def escalate_alert(
    alert_id: int,
    body: EscalateRequest,
    user: dict = Depends(require_role("NURSE")),
):
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT a.status, d.ward_id FROM alerts a "
            "JOIN devices d ON d.device_id=a.device_id WHERE a.id=$1",
            alert_id,
        )
        if not row: raise HTTPException(404, "Alert not found")
        assert_ward_access(user, row["ward_id"])
        if row["status"] == "RESOLVED":
            raise HTTPException(400, "Cannot escalate a resolved alert")

        await conn.execute(
            "UPDATE alerts SET escalated_at=$1, escalated_by=$2, "
            "escalation_note=$3, escalation_status='PENDING' WHERE id=$4",
            datetime.now(timezone.utc), user["id"], body.note, alert_id,
        )
        await _log_event(conn, alert_id, "ESCALATED", user["id"], body.note)
        updated = await _fetch_alert(conn, alert_id)

    await manager.broadcast({
        "event": "alert_escalated", "alert_id": alert_id,
        "device_id": updated["device_id"], "parameter": updated["parameter"],
        "user_id": user["id"], "note": body.note,
    })
    return updated


# ══════════════════════════════════════════════════════════════════════════════
# POST /alerts/{alert_id}/respond  (DOCTOR only)
# ══════════════════════════════════════════════════════════════════════════════
@router.post("/{alert_id}/respond")
async def respond_alert(
    alert_id: int,
    body: RespondRequest,
    user: dict = Depends(require_role("DOCTOR")),
):
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT escalation_status FROM alerts WHERE id=$1", alert_id)
        if not row: raise HTTPException(404, "Alert not found")
        if row["escalation_status"] != "PENDING":
            raise HTTPException(400, "Only PENDING escalations can be responded to")

        await conn.execute(
            "UPDATE alerts SET escalation_status='RESPONDED', responded_by=$1, "
            "responded_at=$2 WHERE id=$3",
            user["id"], datetime.now(timezone.utc), alert_id,
        )
        await _log_event(conn, alert_id, "RESPONDED", user["id"], body.note)
        updated = await _fetch_alert(conn, alert_id)

    await manager.broadcast({
        "event": "alert_responded", "alert_id": alert_id,
        "device_id": updated["device_id"], "user_id": user["id"],
    })
    return updated


# ══════════════════════════════════════════════════════════════════════════════
# POST /alerts/{alert_id}/resolve  (DOCTOR only)
# ══════════════════════════════════════════════════════════════════════════════
@router.post("/{alert_id}/resolve")
async def resolve_alert(
    alert_id: int,
    body: ResolveRequest,
    user: dict = Depends(require_role("DOCTOR")),
):
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT status FROM alerts WHERE id=$1", alert_id)
        if not row: raise HTTPException(404, "Alert not found")
        if row["status"] == "RESOLVED": raise HTTPException(400, "Already resolved")

        await conn.execute(
            "UPDATE alerts SET status='RESOLVED', resolved_at=$1, resolved_by=$2 WHERE id=$3",
            datetime.now(timezone.utc), user["id"], alert_id,
        )
        await _log_event(conn, alert_id, "RESOLVED", user["id"], body.note)
        updated = await _fetch_alert(conn, alert_id)

    await manager.broadcast({
        "event": "alert_resolved", "alert_id": alert_id,
        "device_id": updated["device_id"], "parameter": updated["parameter"],
        "user_id": user["id"],
    })
    return updated


# ══════════════════════════════════════════════════════════════════════════════
# GET /alerts/{alert_id}/events
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/{alert_id}/events")
async def get_alert_events(alert_id: int, user: dict = Depends(require_any_role)):
    pool = get_pool()
    async with pool.acquire() as conn:
        alert = await conn.fetchrow(
            "SELECT d.ward_id FROM alerts a "
            "JOIN devices d ON d.device_id=a.device_id WHERE a.id=$1",
            alert_id,
        )
        if not alert: raise HTTPException(404, "Alert not found")
        if user["role"] == "NURSE" and alert["ward_id"] != user["ward_id"]:
            raise HTTPException(403, "Access denied")

        rows = await conn.fetch(
            """
            SELECT e.id, e.alert_id, e.event_type, e.user_id, e.note, e.created_at,
                   u.name AS user_name
            FROM   alert_events e
            LEFT   JOIN users u ON u.id = e.user_id
            WHERE  e.alert_id = $1 ORDER BY e.created_at DESC
            """,
            alert_id,
        )
    return [dict(r) for r in rows]


# ══════════════════════════════════════════════════════════════════════════════
# POST /alerts/{alert_id}/remarks  — add remark (any status, doctor or nurse)
# ══════════════════════════════════════════════════════════════════════════════
@router.post("/{alert_id}/remarks", response_model=RemarkOut, status_code=201)
async def add_remark(
    alert_id: int,
    body: RemarkIn,
    user: dict = Depends(require_any_role),
):
    pool = get_pool()
    async with pool.acquire() as conn:
        # Check alert exists + ward access for nurses
        alert = await conn.fetchrow(
            "SELECT d.ward_id FROM alerts a "
            "JOIN devices d ON d.device_id=a.device_id WHERE a.id=$1",
            alert_id,
        )
        if not alert:
            raise HTTPException(404, "Alert not found")
        if user["role"] == "NURSE" and alert["ward_id"] != user["ward_id"]:
            raise HTTPException(403, "Access denied — not your ward")

        remark_id = await conn.fetchval(
            "INSERT INTO alert_remarks (alert_id, user_id, role, text) "
            "VALUES ($1,$2,$3,$4) RETURNING id",
            alert_id, user["id"], user["role"], body.text,
        )
        await _log_event(conn, alert_id, "REMARK_ADDED", user["id"], body.text[:80])

        row = await conn.fetchrow(
            """
            SELECT r.id, r.alert_id, r.user_id, r.role, r.text, r.created_at,
                   u.name AS author
            FROM   alert_remarks r
            LEFT   JOIN users u ON u.id = r.user_id
            WHERE  r.id = $1
            """,
            remark_id,
        )

    await manager.broadcast({
        "event":    "alert_remark_added",
        "alert_id": alert_id,
        "device_id": await _get_device_id(alert_id),
        "author":   user.get("name") or user.get("username"),
        "role":     user["role"],
        "text":     body.text[:80],
    })

    return dict(row)


# ══════════════════════════════════════════════════════════════════════════════
# GET /alerts/{alert_id}/remarks  — list remarks
# ══════════════════════════════════════════════════════════════════════════════
@router.get("/{alert_id}/remarks", response_model=list[RemarkOut])
async def get_remarks(alert_id: int, user: dict = Depends(require_any_role)):
    pool = get_pool()
    async with pool.acquire() as conn:
        alert = await conn.fetchrow(
            "SELECT d.ward_id FROM alerts a "
            "JOIN devices d ON d.device_id=a.device_id WHERE a.id=$1",
            alert_id,
        )
        if not alert:
            raise HTTPException(404, "Alert not found")
        if user["role"] == "NURSE" and alert["ward_id"] != user["ward_id"]:
            raise HTTPException(403, "Access denied")

        rows = await conn.fetch(
            """
            SELECT r.id, r.alert_id, r.user_id, r.role, r.text, r.created_at,
                   u.name AS author
            FROM   alert_remarks r
            LEFT   JOIN users u ON u.id = r.user_id
            WHERE  r.alert_id = $1
            ORDER  BY r.created_at ASC
            """,
            alert_id,
        )
    return [dict(r) for r in rows]


# ── Helper ────────────────────────────────────────────────────────────────────
async def _get_device_id(alert_id: int) -> str:
    pool = get_pool()
    async with pool.acquire() as conn:
        return await conn.fetchval(
            "SELECT device_id FROM alerts WHERE id=$1", alert_id
        ) or ""
