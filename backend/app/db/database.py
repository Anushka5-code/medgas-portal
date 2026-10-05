"""
db/database.py
==============
asyncpg connection pool.

On startup (init_db):
  1. Create pool
  2. Apply schema.sql  (idempotent — safe on existing DB)
  3. Seed wards, devices, users if tables are empty
"""

import asyncpg
import pathlib
from app.config import settings

_pool: asyncpg.Pool | None = None


# ─────────────────────────────────────────────────────────────────────────────
async def init_db() -> None:
    global _pool
    _pool = await asyncpg.create_pool(
        host=settings.db_host,
        port=settings.db_port,
        database=settings.db_name,
        user=settings.db_user,
        password=settings.db_password,
        min_size=2,
        max_size=10,
    )

    schema_path = pathlib.Path(__file__).parent / "schema.sql"
    ddl = schema_path.read_text()
    async with _pool.acquire() as conn:
        await conn.execute(ddl)

    await _seed()
    print("✅  Database connected, schema applied, seed checked.")


async def close_db() -> None:
    if _pool:
        await _pool.close()


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Database pool not initialised. Call init_db() first.")
    return _pool


# ─────────────────────────────────────────────────────────────────────────────
async def _seed() -> None:
    """
    Insert seed data only when each table is empty.
    Safe to call on every startup — all inserts are ON CONFLICT DO NOTHING.
    """
    # Import here to avoid circular imports (security needs get_pool)
    from app.security import hash_password

    async with _pool.acquire() as conn:

        # ── Wards ────────────────────────────────────────────────────────────
        await conn.execute("""
            INSERT INTO wards (name) VALUES
                ('ICU'),
                ('General Ward')
            ON CONFLICT (name) DO NOTHING
        """)

        icu_id = await conn.fetchval(
            "SELECT id FROM wards WHERE name = 'ICU'"
        )
        gen_id = await conn.fetchval(
            "SELECT id FROM wards WHERE name = 'General Ward'"
        )

        # ── Devices ──────────────────────────────────────────────────────────
        await conn.execute("""
            INSERT INTO devices (device_id, ward_id, bed_label) VALUES
                ('D001', $1, 'ICU Bed 1'),
                ('D002', $1, 'ICU Bed 2'),
                ('D003', $2, 'Ward Bed 1'),
                ('D004', $2, 'Ward Bed 2')
            ON CONFLICT (device_id) DO NOTHING
        """, icu_id, gen_id)

        # Also back-fill ward_id for devices that existed before migration
        await conn.execute("""
            UPDATE devices SET ward_id = $1, bed_label = 'ICU Bed 1'
            WHERE device_id = 'D001' AND ward_id IS NULL
        """, icu_id)
        await conn.execute("""
            UPDATE devices SET ward_id = $1, bed_label = 'ICU Bed 2'
            WHERE device_id = 'D002' AND ward_id IS NULL
        """, icu_id)
        await conn.execute("""
            UPDATE devices SET ward_id = $1, bed_label = 'Ward Bed 1'
            WHERE device_id = 'D003' AND ward_id IS NULL
        """, gen_id)
        await conn.execute("""
            UPDATE devices SET ward_id = $1, bed_label = 'Ward Bed 2'
            WHERE device_id = 'D004' AND ward_id IS NULL
        """, gen_id)

        # ── Users ────────────────────────────────────────────────────────────
        seed_users = [
            # (name,            username,       password,      role,     ward_id)
            ("Dr. Sharma",     "dr.sharma",    "Doctor@123",  "DOCTOR", None),
            ("Priya",          "nurse.priya",  "Nurse@123",   "NURSE",  icu_id),
            ("Anita",          "nurse.anita",  "Nurse@123",   "NURSE",  gen_id),
        ]
        for name, username, password, role, ward_id in seed_users:
            existing = await conn.fetchval(
                "SELECT id FROM users WHERE username = $1", username
            )
            if not existing:
                await conn.execute(
                    """
                    INSERT INTO users (name, username, password_hash, role, ward_id)
                    VALUES ($1, $2, $3, $4, $5)
                    """,
                    name, username, hash_password(password), role, ward_id,
                )
                print(f"   👤  Seeded user: {username} ({role})")
