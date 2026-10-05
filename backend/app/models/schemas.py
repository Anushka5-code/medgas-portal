"""
models/schemas.py
=================
All Pydantic request/response models for the API.
Existing shapes (ReadingIn, ReadingOut, DeviceOut, AlertOut) are preserved
exactly so the existing frontend and simulator keep working.
New models are added below the existing ones.
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


# ══════════════════════════════════════════════════════════════════════════════
# EXISTING MODELS — shapes unchanged
# ══════════════════════════════════════════════════════════════════════════════

class ReadingIn(BaseModel):
    device_id:     str   = Field(..., examples=["D001"])
    pressure:      float = Field(..., examples=[72.4])
    oxygen_purity: float = Field(..., examples=[96.2])
    timestamp:     datetime


class ReadingOut(BaseModel):
    id:            int
    device_id:     str
    pressure:      float
    oxygen_purity: float
    status:        str   # NORMAL | HIGH_PRESSURE | LOW_PRESSURE
    purity_status: str   # NORMAL | LOW_PURITY | HIGH_PURITY
    timestamp:     datetime


class DeviceOut(BaseModel):
    device_id:            str
    latest_pressure:      Optional[float]
    latest_purity:        Optional[float]
    latest_status:        Optional[str]
    latest_purity_status: Optional[str]
    latest_timestamp:     Optional[datetime]
    active_alert_id:      Optional[int]
    # new optional fields (None when not joined)
    ward_id:              Optional[int]   = None
    ward_name:            Optional[str]   = None
    bed_label:            Optional[str]   = None


class AlertOut(BaseModel):
    id:               int
    device_id:        str
    alert_type:       str
    status:           str
    parameter:        str
    initial_value:    float
    max_value:        float
    min_value:        float
    current_value:    float
    threshold:        float
    # legacy compat
    initial_pressure: float
    max_pressure:     float
    current_pressure: float
    created_at:       datetime
    acknowledged_at:  Optional[datetime]
    resolved_at:      Optional[datetime]
    # new optional fields
    acknowledged_by:    Optional[int]   = None
    acknowledged_note:  Optional[str]   = None
    escalated_at:       Optional[datetime] = None
    escalated_by:       Optional[int]   = None
    escalation_note:    Optional[str]   = None
    escalation_status:  str             = "NONE"
    responded_by:       Optional[int]   = None
    responded_at:       Optional[datetime] = None
    resolved_by:        Optional[int]   = None
    # joined display fields
    acknowledged_by_name: Optional[str] = None
    ward_id:              Optional[int] = None


class AlertReadingOut(BaseModel):
    id:            int
    alert_id:      int
    pressure:      float
    oxygen_purity: float
    timestamp:     datetime


# ══════════════════════════════════════════════════════════════════════════════
# AUTH
# ══════════════════════════════════════════════════════════════════════════════

class LoginRequest(BaseModel):
    username: str
    password: str
    role:     str   # "DOCTOR" | "NURSE"


class UserOut(BaseModel):
    id:        int
    name:      str
    username:  str
    role:      str
    ward_id:   Optional[int]
    ward_name: Optional[str]


class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    user:         UserOut


# ══════════════════════════════════════════════════════════════════════════════
# WARDS
# ══════════════════════════════════════════════════════════════════════════════

class WardOut(BaseModel):
    id:         int
    name:       str
    created_at: datetime


# ══════════════════════════════════════════════════════════════════════════════
# ALERT ACTIONS (request bodies)
# ══════════════════════════════════════════════════════════════════════════════

class AcknowledgeRequest(BaseModel):
    note: Optional[str] = None   # required for NURSE, optional for DOCTOR


class EscalateRequest(BaseModel):
    note: str = Field(..., min_length=1, description="Reason for escalation (required)")


class RespondRequest(BaseModel):
    note: str = Field(..., min_length=1, description="Doctor's response note (required)")


class ResolveRequest(BaseModel):
    note: Optional[str] = None


# ══════════════════════════════════════════════════════════════════════════════
# ALERT EVENTS (audit trail)
# ══════════════════════════════════════════════════════════════════════════════

class AlertEventOut(BaseModel):
    id:          int
    alert_id:    int
    event_type:  str
    user_id:     Optional[int]
    user_name:   Optional[str]   = None   # joined
    note:        Optional[str]
    created_at:  datetime


# ══════════════════════════════════════════════════════════════════════════════
# HANDOVER / STATS
# ══════════════════════════════════════════════════════════════════════════════

class HandoverSummary(BaseModel):
    ward_id:             int
    ward_name:           str
    shift_hours:         int
    total_alerts:        int
    active_alerts:       int
    acknowledged_alerts: int
    escalated_alerts:    int
    unstable_devices:    list[str]   # device_ids currently not NORMAL


class StatsOverview(BaseModel):
    total_devices:     int
    normal_devices:    int
    low_devices:       int
    high_devices:      int
    active_alerts:     int
    avg_resolve_mins:  Optional[float]   # None if no resolved alerts yet


# ══════════════════════════════════════════════════════════════════════════════
# REMARKS (added v3)
# ══════════════════════════════════════════════════════════════════════════════

class RemarkIn(BaseModel):
    text: str = Field(..., min_length=1, max_length=500,
                      description="Post-resolution remark (max 500 chars)")


class RemarkOut(BaseModel):
    id:         int
    alert_id:   int
    user_id:    Optional[int]
    author:     Optional[str]   # joined user.name
    role:       str
    text:       str
    created_at: datetime
