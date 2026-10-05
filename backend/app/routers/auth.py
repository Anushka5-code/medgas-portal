"""
routers/auth.py
===============
POST /auth/login   — verify credentials + role, return JWT
GET  /auth/me      — return current user info
POST /auth/logout  — stateless logout (client drops token)
"""

from fastapi import APIRouter, HTTPException, status, Depends

from app.db.database import get_pool
from app.models.schemas import LoginRequest, TokenResponse, UserOut
from app.security import (
    verify_password,
    create_access_token,
    get_current_user,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    pool = get_pool()

    # Normalise role to uppercase
    role = body.role.upper()
    if role not in ("DOCTOR", "NURSE"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials or role",
        )

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT u.id, u.name, u.username, u.password_hash,
                   u.role, u.ward_id, w.name AS ward_name
            FROM   users u
            LEFT   JOIN wards w ON w.id = u.ward_id
            WHERE  u.username = $1
            """,
            body.username,
        )

    # Unknown user, wrong password, or role mismatch → same 401
    if not row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials or role",
        )
    if not verify_password(body.password, row["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials or role",
        )
    if row["role"] != role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials or role",
        )

    token = create_access_token({"sub": str(row["id"])})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut(
            id=row["id"],
            name=row["name"],
            username=row["username"],
            role=row["role"],
            ward_id=row["ward_id"],
            ward_name=row["ward_name"],
        ),
    )


@router.get("/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return UserOut(**user)


@router.post("/logout", status_code=200)
async def logout():
    """
    Stateless JWT logout — the client simply drops the token.
    Endpoint exists so front-ends can call it uniformly.
    """
    return {"detail": "Logged out successfully"}
