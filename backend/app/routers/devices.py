"""
routers/devices.py
==================
GET /devices   — list devices with latest reading + active alert
  DOCTOR : all devices; accepts optional ?ward_id= filter
  NURSE  : only devices in their own ward (ward_id filter ignored)
"""

from fastapi import APIRouter, Depends, Query
from typing import Optional

from app.db.database import get_pool
from app.models.schemas import DeviceOut
from app.security import require_any_role

router = APIRouter(prefix="/devices", tags=["devices"])


@router.get("", response_model=list[DeviceOut])
async def get_devices(
    ward_id: Optional[int] = Query(None, description="Doctor only: filter by ward"),
    user: dict = Depends(require_any_role),
):
    pool = get_pool()

    # Build ward filter based on role
    if user["role"] == "NURSE":
        # Nurses are always scoped to their own ward regardless of query param
        effective_ward_id = user["ward_id"]
    else:
        # Doctors can optionally filter by ward_id
        effective_ward_id = ward_id

    async with pool.acquire() as conn:
        if effective_ward_id is not None:
            rows = await conn.fetch(
                """
                SELECT
                    d.device_id,
                    d.ward_id,
                    w.name          AS ward_name,
                    d.bed_label,
                    r.pressure      AS latest_pressure,
                    r.oxygen_purity AS latest_purity,
                    r.status        AS latest_status,
                    r.purity_status AS latest_purity_status,
                    r.timestamp     AS latest_timestamp,
                    a.id            AS active_alert_id
                FROM devices d
                LEFT JOIN wards w ON w.id = d.ward_id
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
                      AND  status IN ('ACTIVE','ACKNOWLEDGED')
                    ORDER  BY created_at DESC
                    LIMIT  1
                ) a ON TRUE
                WHERE d.ward_id = $1
                ORDER BY d.device_id
                """,
                effective_ward_id,
            )
        else:
            rows = await conn.fetch(
                """
                SELECT
                    d.device_id,
                    d.ward_id,
                    w.name          AS ward_name,
                    d.bed_label,
                    r.pressure      AS latest_pressure,
                    r.oxygen_purity AS latest_purity,
                    r.status        AS latest_status,
                    r.purity_status AS latest_purity_status,
                    r.timestamp     AS latest_timestamp,
                    a.id            AS active_alert_id
                FROM devices d
                LEFT JOIN wards w ON w.id = d.ward_id
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
                      AND  status IN ('ACTIVE','ACKNOWLEDGED')
                    ORDER  BY created_at DESC
                    LIMIT  1
                ) a ON TRUE
                ORDER BY d.device_id
                """
            )

    return [dict(r) for r in rows]
