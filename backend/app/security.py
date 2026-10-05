"""
security.py
===========
JWT creation / verification, password hashing, and FastAPI dependency
functions that routers can use to protect endpoints.

Dependencies exported
---------------------
get_current_user   — decodes JWT, returns UserRecord; raises 401 on failure
require_role(role) — factory that returns a dep raising 403 if role != required
require_any_role   — accepts DOCTOR or NURSE; raises 401 if unauthenticated
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings
from app.db.database import get_pool

# ── Password hashing ──────────────────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── JWT ───────────────────────────────────────────────────────────────────────
def create_access_token(data: dict) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        hours=settings.access_token_expire_hours
    )
    payload["exp"] = expire
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT. Raises JWTError on failure."""
    return jwt.decode(
        token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
    )


# ── OAuth2 scheme (used by Swagger UI) ───────────────────────────────────────
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


# ── Shared user record type (plain dict, from asyncpg row) ────────────────────
# Fields: id, name, username, role, ward_id, ward_name

async def _fetch_user_by_id(user_id: int) -> Optional[dict]:
    pool = get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT u.id, u.name, u.username, u.role, u.ward_id,
                   w.name AS ward_name
            FROM   users u
            LEFT   JOIN wards w ON w.id = u.ward_id
            WHERE  u.id = $1
            """,
            user_id,
        )
    return dict(row) if row else None


# ── Core dependency: decode token → user dict ─────────────────────────────────
async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
) -> dict:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exc
    try:
        payload = decode_token(token)
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    user = await _fetch_user_by_id(int(user_id))
    if user is None:
        raise credentials_exc
    return user


# ── Role guard factory ────────────────────────────────────────────────────────
def require_role(role: str):
    """
    Returns a FastAPI dependency that raises 403 if the current user's role
    does not match `role`.

    Usage:
        @router.get("/...", dependencies=[Depends(require_role("DOCTOR"))])
        async def my_endpoint(user=Depends(get_current_user)): ...
    """
    async def _dep(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] != role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role {role}",
            )
        return user
    return _dep


# ── Any-role dependency (just ensures authenticated) ─────────────────────────
async def require_any_role(user: dict = Depends(get_current_user)) -> dict:
    """Passes through as long as the JWT is valid (DOCTOR or NURSE)."""
    return user


# ── Ward-scoped guard helper ──────────────────────────────────────────────────
def assert_ward_access(user: dict, ward_id: int) -> None:
    """
    Raises 403 if a NURSE tries to access a ward that isn't theirs.
    DOCTOR has unrestricted access.
    """
    if user["role"] == "NURSE" and user["ward_id"] != ward_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Nurses can only access their own ward",
        )


# ── WebSocket token helper (no Depends — called manually) ────────────────────
async def get_ws_user(token: str) -> Optional[dict]:
    """
    Validate a token from a WebSocket query param.
    Returns user dict or None (caller decides whether to close).
    """
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if user_id is None:
            return None
        return await _fetch_user_by_id(int(user_id))
    except JWTError:
        return None
