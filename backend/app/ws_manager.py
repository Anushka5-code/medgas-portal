"""
ws_manager.py
=============
WebSocket connection manager with role-based routing.
Each connection is tagged with (ws, user_id, role, ward_id).
broadcast() filters recipients by role + ward.
"""

import json
from typing import Optional
from fastapi import WebSocket


class Connection:
    def __init__(self, ws: WebSocket, user_id: int, role: str, ward_id: Optional[int]):
        self.ws = ws
        self.user_id = user_id
        self.role = role          # "DOCTOR" | "NURSE"
        self.ward_id = ward_id    # None for DOCTOR, int for NURSE


class ConnectionManager:
    def __init__(self):
        self._active: list[Connection] = []

    async def connect(
        self, ws: WebSocket, user_id: int, role: str, ward_id: Optional[int]
    ) -> None:
        await ws.accept()
        conn = Connection(ws, user_id, role, ward_id)
        self._active.append(conn)
        print(
            f"🔌  WS connected: user_id={user_id} role={role} "
            f"ward_id={ward_id or 'ALL'}  (total: {len(self._active)})"
        )

    def disconnect(self, ws: WebSocket) -> None:
        self._active = [c for c in self._active if c.ws != ws]
        print(f"🔌  WS disconnected (total: {len(self._active)})")

    async def broadcast(self, payload: dict) -> None:
        """
        Send JSON to all connected clients filtered by role + ward.

        Rules:
        - DOCTOR receives everything (all wards).
        - NURSE receives only events for devices in their own ward.

        Device-scoped events (new_reading, alert_*) have "device_id".
        We look up ward_id from the devices table if needed.
        If payload has no device_id → send to everyone (system-wide event).
        """
        message = json.dumps(payload, default=str)
        device_id = payload.get("device_id")
        ward_id_cache: Optional[int] = None

        # If device_id is present, fetch its ward_id once
        if device_id:
            from app.db.database import get_pool
            pool = get_pool()
            async with pool.acquire() as conn:
                ward_id_cache = await conn.fetchval(
                    "SELECT ward_id FROM devices WHERE device_id = $1", device_id
                )

        dead: list[WebSocket] = []
        for conn in self._active:
            # Decide if this connection should receive this event
            should_send = False

            if conn.role == "DOCTOR":
                # Doctors receive all events
                should_send = True
            elif conn.role == "NURSE":
                if device_id and ward_id_cache is not None:
                    # Nurse receives only if device is in their ward
                    should_send = (ward_id_cache == conn.ward_id)
                else:
                    # No device_id → system-wide event, send to everyone
                    should_send = True

            if should_send:
                try:
                    await conn.ws.send_text(message)
                except Exception:
                    dead.append(conn.ws)

        for ws in dead:
            self.disconnect(ws)


# Singleton
manager = ConnectionManager()
