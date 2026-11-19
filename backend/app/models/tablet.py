"""
models/tablet.py
================
Internal Pydantic models for tablet messages.
These represent the normalised form used inside the portal —
never the raw payload directly.
"""

from __future__ import annotations
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class GaugeReading(BaseModel):
    """One gauge entry from gauges[]."""
    gauge_id:       Optional[str]   = None
    number:         Optional[int]   = None
    kind:           Optional[str]   = None   # "analog" | "digital"
    gas:            Optional[str]   = None
    reading:        Optional[float] = None
    unit:           Optional[str]   = None
    status:         Optional[str]   = None   # OK | NEAR_LOW | LOW | CRITICAL | HIGH | READ | UNCERTAIN
    status_text:    Optional[str]   = None
    safe_low:       Optional[float] = None
    safe_high:      Optional[float] = None
    safe_critical:  Optional[float] = None
    safe_buffer:    Optional[float] = None
    confidence_pct: Optional[int]   = None


class TabletMessage(BaseModel):
    """
    Normalised tablet message, produced by adapter.normalize().
    All fields that can be absent in the wire format are Optional.
    """
    device_id:      str
    seq:            int
    event:          str                        # status_change | value_change | heartbeat | test
    alert_status:   Optional[str]   = None     # NORMAL | CRITICAL | UNREADABLE
    confidence_pct: Optional[int]   = None
    reading:        Optional[float] = None
    unit:           Optional[str]   = None
    gas:            Optional[str]   = None
    gauges:         list[GaugeReading] = Field(default_factory=list)
    lamps:          list[str]          = Field(default_factory=list)
    reasons:        list[str]          = Field(default_factory=list)
    app_version:    Optional[str]   = None
    timestamp:      datetime               # original message timestamp (with tz)
