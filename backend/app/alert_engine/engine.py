"""
alert_engine/engine.py  (v3 — debounce + hysteresis)
=====================================================
Debounce (open):
  An alert opens only after ALERT_OPEN_AFTER_READINGS consecutive abnormal
  readings for the same device+parameter. A single stray reading is ignored.

Hysteresis (close):
  An open alert auto-resolves only after ALERT_CLOSE_AFTER_READINGS
  consecutive NORMAL readings  OR  ALERT_CLOSE_AFTER_SECONDS seconds of
  continuous normal readings — whichever comes first. A single stray normal
  reading cannot close an alert.

Debounce counters are persisted in the alert_debounce table so a restart
does not reset them.
"""

from datetime import datetime, timezone, timedelta
from app.config import settings
from app.db.database import get_pool
from app.ws_manager import manager


# ── Classifiers ──────────────────────────────────────────────────────────────

def classify_pressure(pressure: float) -> str:
    if pressure < settings.pressure_min: return "LOW_PRESSURE"
    if pressure > settings.pressure_max: return "HIGH_PRESSURE"
    return "NORMAL"


def classify_purity(purity: float) -> str:
    if purity < settings.purity_min: return "LOW_PURITY"
    if purity > settings.purity_max: return "HIGH_PURITY"
    return "NORMAL"


def classify(pressure: float) -> str:
    """Backward-compat alias."""
    return classify_pressure(pressure)


# ── Audit helper ─────────────────────────────────────────────────────────────

async def _log_event(conn, alert_id: int, event_type: str,
                     user_id=None, note=None):
    await conn.execute(
        "INSERT INTO alert_events (alert_id, event_type, user_id, note) "
        "VALUES ($1,$2,$3,$4)",
        alert_id, event_type, user_id, note,
    )


# ── Debounce state helpers ────────────────────────────────────────────────────

async def _get_debounce(conn, device_id: str, parameter: str) -> dict:
    row = await conn.fetchrow(
        "SELECT abnormal_streak, normal_streak, normal_since "
        "FROM alert_debounce WHERE device_id=$1 AND parameter=$2",
        device_id, parameter,
    )
    if row:
        return dict(row)
    return {"abnormal_streak": 0, "normal_streak": 0, "normal_since": None}


async def _set_debounce(conn, device_id: str, parameter: str,
                        abnormal_streak: int, normal_streak: int,
                        normal_since=None):
    await conn.execute(
        """
        INSERT INTO alert_debounce
            (device_id, parameter, abnormal_streak, normal_streak, normal_since, updated_at)
        VALUES ($1,$2,$3,$4,$5,NOW())
        ON CONFLICT (device_id, parameter) DO UPDATE
            SET abnormal_streak = EXCLUDED.abnormal_streak,
                normal_streak   = EXCLUDED.normal_streak,
                normal_since    = EXCLUDED.normal_since,
                updated_at      = NOW()
        """,
        device_id, parameter, abnormal_streak, normal_streak, normal_since,
    )


# ── Core per-parameter processor ─────────────────────────────────────────────

async def _process_parameter(
    conn,
    device_id: str,
    value: float,
    status: str,           # "NORMAL" | "LOW_PRESSURE" | "HIGH_PRESSURE" | …
    parameter: str,        # "pressure" | "purity"
    threshold_hi: float,
    threshold_lo: float,
    timestamp: datetime,
    reading_id: int,
    pressure_val: float,
    purity_val: float,
) -> dict | None:

    db = await _get_debounce(conn, device_id, parameter)
    abnormal_streak = db["abnormal_streak"]
    normal_streak   = db["normal_streak"]
    normal_since    = db["normal_since"]

    # Find any open alert for this device+parameter
    open_alert = await conn.fetchrow(
        """
        SELECT id, alert_type, status, max_value, min_value
        FROM   alerts
        WHERE  device_id = $1 AND parameter = $2
          AND  status IN ('ACTIVE','ACKNOWLEDGED')
        ORDER  BY created_at DESC LIMIT 1
        """,
        device_id, parameter,
    )

    event = None

    # ── NORMAL reading ────────────────────────────────────────────────────────
    if status == "NORMAL":
        # Reset abnormal streak
        abnormal_streak = 0

        if open_alert:
            # Update hysteresis counters
            normal_streak += 1
            if normal_since is None:
                normal_since = timestamp

            # Decide whether to close
            elapsed_secs = (timestamp - normal_since).total_seconds() \
                if normal_since else 0
            should_close = (
                normal_streak  >= settings.alert_close_after_readings or
                elapsed_secs   >= settings.alert_close_after_seconds
            )

            if should_close:
                await conn.execute(
                    """
                    UPDATE alerts
                    SET    status='RESOLVED', current_value=$1,
                           current_pressure=$2, resolved_at=$3, resolved_by=NULL
                    WHERE  id=$4
                    """,
                    value, pressure_val, timestamp, open_alert["id"],
                )
                await _log_event(conn, open_alert["id"], "AUTO_RESOLVED")
                # Reset counters
                normal_streak = 0; normal_since = None
                event = {
                    "event":     "alert_resolved",
                    "alert_id":  open_alert["id"],
                    "device_id": device_id,
                    "parameter": parameter,
                    "value":     value,
                    "timestamp": timestamp.isoformat(),
                }
            # else: accumulating normal readings, not closing yet
        else:
            # No open alert — just reset
            normal_streak = 0; normal_since = None

    # ── ABNORMAL reading ──────────────────────────────────────────────────────
    else:
        # Reset normal streak
        normal_streak = 0; normal_since = None
        abnormal_streak += 1

        threshold = threshold_hi if "HIGH" in status else threshold_lo

        if open_alert:
            # Alert already open — update running stats
            new_max = max(float(open_alert["max_value"]), value)
            new_min = min(float(open_alert["min_value"]), value)
            await conn.execute(
                """
                UPDATE alerts
                SET    current_value=$1, max_value=$2, min_value=$3,
                       current_pressure=$4
                WHERE  id=$5
                """,
                value, new_max, new_min, pressure_val, open_alert["id"],
            )
            await conn.execute(
                "INSERT INTO alert_readings (alert_id,pressure,oxygen_purity,timestamp) "
                "VALUES ($1,$2,$3,$4)",
                open_alert["id"], pressure_val, purity_val, timestamp,
            )
            event = {
                "event":      "alert_updated",
                "alert_id":   open_alert["id"],
                "device_id":  device_id,
                "parameter":  parameter,
                "alert_type": status,
                "value":      value,
                "threshold":  threshold,
                "timestamp":  timestamp.isoformat(),
            }

        elif abnormal_streak >= settings.alert_open_after_readings:
            # Debounce satisfied — open a new alert
            alert_id = await conn.fetchval(
                """
                INSERT INTO alerts
                    (device_id, alert_type, status, parameter,
                     initial_value, max_value, min_value, current_value, threshold,
                     initial_pressure, max_pressure, current_pressure, created_at)
                VALUES ($1,$2,'ACTIVE',$3,$4,$4,$4,$4,$5,$6,$6,$6,$7)
                RETURNING id
                """,
                device_id, status, parameter,
                value, threshold, pressure_val, timestamp,
            )
            await conn.execute(
                "INSERT INTO alert_readings (alert_id,pressure,oxygen_purity,timestamp) "
                "VALUES ($1,$2,$3,$4)",
                alert_id, pressure_val, purity_val, timestamp,
            )
            await _log_event(conn, alert_id, "CREATED")
            # Reset the streak counter (alert is now open)
            abnormal_streak = 0
            event = {
                "event":      "alert_created",
                "alert_id":   alert_id,
                "device_id":  device_id,
                "parameter":  parameter,
                "alert_type": status,
                "value":      value,
                "threshold":  threshold,
                "timestamp":  timestamp.isoformat(),
            }
        # else: abnormal but streak not yet met — silent accumulation

    # Persist updated debounce state
    await _set_debounce(
        conn, device_id, parameter,
        abnormal_streak, normal_streak, normal_since,
    )

    return event


# ── Public entry point ────────────────────────────────────────────────────────

async def process_reading(
    device_id: str,
    pressure: float,
    oxygen_purity: float,
    timestamp: datetime,
    reading_id: int,
) -> list[dict]:
    """Run engine for both parameters. Returns 0–2 event dicts."""
    pool     = get_pool()
    p_status = classify_pressure(pressure)
    o_status = classify_purity(oxygen_purity)
    events   = []

    async with pool.acquire() as conn:
        ev = await _process_parameter(
            conn, device_id, pressure, p_status,
            "pressure",
            settings.pressure_max, settings.pressure_min,
            timestamp, reading_id, pressure, oxygen_purity,
        )
        if ev: events.append(ev)

        ev = await _process_parameter(
            conn, device_id, oxygen_purity, o_status,
            "purity",
            settings.purity_max, settings.purity_min,
            timestamp, reading_id, pressure, oxygen_purity,
        )
        if ev: events.append(ev)

    return events


# ── Auto-escalation background task ──────────────────────────────────────────

async def check_auto_escalation():
    """
    Find ACTIVE alerts that are unacknowledged and older than
    AUTO_ESCALATE_MINUTES. Mark escalation_status=PENDING and broadcast.
    """
    pool   = get_pool()
    cutoff = datetime.now(timezone.utc) - timedelta(
        minutes=settings.auto_escalate_minutes
    )

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT a.id, a.device_id, a.alert_type, a.parameter
            FROM   alerts a
            WHERE  a.status            = 'ACTIVE'
              AND  a.escalation_status = 'NONE'
              AND  a.created_at        < $1
            """,
            cutoff,
        )
        for row in rows:
            await conn.execute(
                "UPDATE alerts SET escalation_status='PENDING', escalated_at=$1 "
                "WHERE id=$2",
                datetime.now(timezone.utc), row["id"],
            )
            await _log_event(conn, row["id"], "AUTO_ESCALATED")
            await manager.broadcast({
                "event":      "alert_escalated",
                "alert_id":   row["id"],
                "device_id":  row["device_id"],
                "alert_type": row["alert_type"],
                "parameter":  row["parameter"],
                "auto":       True,
            })
            print(
                f"⏰  Auto-escalated alert #{row['id']} "
                f"({row['device_id']} {row['parameter']})"
            )
