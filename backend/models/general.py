"""Pydantic models for General section features."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class AuditLogItem(BaseModel):
    """Single audit log entry."""

    id: int
    username: str
    user_id: Optional[int] = None
    event_type: str
    message: str
    ip_address: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    resource_name: Optional[str] = None
    severity: str
    extra_data: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogsResponse(BaseModel):
    """Paginated audit logs response."""

    items: List[AuditLogItem]
    total: int
    page: int
    page_size: int


class EventTypesResponse(BaseModel):
    """Distinct event types present in the audit log."""

    event_types: List[str]
