"""
integration/adapter.py
======================
normalize(payload) maps the raw tablet JSON dict to the internal
TabletMessage model.  Tolerates:
  - missing or null top-level fields
  - an absent, null or empty gauges list
  - gauges entries that are missing individual fields
"""

from __future__ import annotations
from typing import Any
from app.models.tablet import TabletMessage, GaugeReading


def normalize(payload: dict[str, Any]) -> TabletMessage:
    """
    Convert the raw tablet POST body to a TabletMessage.
    Raises ValidationError (Pydantic) only if device_id, seq, event or
    timestamp are missing — everything else defaults to None / [].
    """
    raw_gauges = payload.get("gauges") or []

    gauges: list[GaugeReading] = []
    for g in raw_gauges:
        if not isinstance(g, dict):
            continue
        gauges.append(GaugeReading(
            gauge_id       = g.get("gauge_id"),
            number         = g.get("number"),
            kind           = g.get("kind"),
            gas            = g.get("gas"),
            reading        = g.get("reading"),
            unit           = g.get("unit"),
            status         = g.get("status"),
            status_text    = g.get("status_text"),
            safe_low       = g.get("safe_low"),
            safe_high      = g.get("safe_high"),
            safe_critical  = g.get("safe_critical"),
            safe_buffer    = g.get("safe_buffer"),
            confidence_pct = g.get("confidence_pct"),
        ))

    return TabletMessage(
        device_id      = payload["device_id"],
        seq            = payload["seq"],
        event          = payload["event"],
        alert_status   = payload.get("alert_status"),
        confidence_pct = payload.get("confidence_pct"),
        reading        = payload.get("reading"),
        unit           = payload.get("unit"),
        gas            = payload.get("gas"),
        gauges         = gauges,
        lamps          = payload.get("lamps") or [],
        reasons        = payload.get("reasons") or [],
        app_version    = payload.get("app_version"),
        timestamp      = payload["timestamp"],
    )
