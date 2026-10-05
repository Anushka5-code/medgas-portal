"""
routers/wards.py
================
GET /wards   — list wards (doctor: all, nurse: own ward only)
"""

from fastapi import APIRouter, Depends

from app.db.database import get_pool
from app.models.schemas import WardOut
from app.security import require_any_role

router = APIRouter(prefix="/wards", tags=["wards"])


@router.get("", response_model=list[WardOut])
async def get_wards(user: dict = Depends(require_any_role)):
    pool = get_pool()
    async with pool.acquire() as conn:
        if user["role"] == "DOCTOR":
            rows = await conn.fetch(
                "SELECT id, name, created_at FROM wards ORDER BY name"
            )
        else:
            # NURSE — return only their own ward
            rows = await conn.fetch(
                "SELECT id, name, created_at FROM wards WHERE id = $1",
                user["ward_id"],
            )
    return [dict(r) for r in rows]
