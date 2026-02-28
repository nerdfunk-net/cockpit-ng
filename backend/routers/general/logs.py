"""Router for audit log viewing."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from core.auth import require_permission
from core.database import get_db
from core.models import AuditLog
from models.general import AuditLogItem, AuditLogsResponse, EventTypesResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/logs", tags=["general-logs"])


@router.get("/event-types", response_model=EventTypesResponse)
async def get_event_types(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("general.logs", "read")),
) -> EventTypesResponse:
    """Return the distinct event_type values present in the audit_logs table."""
    rows = (
        db.query(AuditLog.event_type)
        .distinct()
        .order_by(AuditLog.event_type)
        .all()
    )
    return EventTypesResponse(event_types=[r[0] for r in rows])


@router.get("", response_model=AuditLogsResponse)
async def get_audit_logs(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=200, description="Items per page"),
    severity: Optional[str] = Query(None, description="Filter by severity (info/warning/error/critical)"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    username: Optional[str] = Query(None, description="Filter by username"),
    start_date: Optional[datetime] = Query(None, description="Filter by start date (ISO format)"),
    end_date: Optional[datetime] = Query(None, description="Filter by end date (ISO format)"),
    search: Optional[str] = Query(None, description="Search in message field"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("general.logs", "read")),
) -> AuditLogsResponse:
    """Retrieve paginated audit logs with optional filters."""
    query = db.query(AuditLog)

    if severity:
        query = query.filter(AuditLog.severity == severity)
    if event_type:
        query = query.filter(AuditLog.event_type == event_type)
    if username:
        query = query.filter(AuditLog.username.ilike(f"%{username}%"))
    if start_date:
        query = query.filter(AuditLog.created_at >= start_date)
    if end_date:
        query = query.filter(AuditLog.created_at <= end_date)
    if search:
        query = query.filter(AuditLog.message.ilike(f"%{search}%"))

    total = query.count()

    items = (
        query.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return AuditLogsResponse(
        items=[AuditLogItem.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )
