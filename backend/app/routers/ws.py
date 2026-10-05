"""
routers/ws.py
=============
WebSocket endpoint — /ws?token=<JWT>

Validates token, tags connection with user/role/ward, then keeps it alive.
Push-only: server broadcasts events, client never sends (receive_text just keeps alive).
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Optional

from app.ws_manager import manager
from app.security import get_ws_user

router = APIRouter(tags=["websocket"])


@router.websocket("/ws")
async def websocket_endpoint(
    ws: WebSocket,
    token: Optional[str] = Query(None, description="JWT access token"),
):
    # Validate token
    if not token:
        await ws.close(code=1008, reason="Missing token")
        return

    user = await get_ws_user(token)
    if not user:
        await ws.close(code=1008, reason="Invalid token")
        return

    # Connect with user context
    await manager.connect(ws, user["id"], user["role"], user.get("ward_id"))

    try:
        # Keep alive — we only push, never read
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)
