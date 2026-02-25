"""Repository for audit log operations."""

import logging
import json
from typing import Optional, List
from sqlalchemy.orm import Session
from core.database import get_db_session
from core.models import AuditLog

logger = logging.getLogger(__name__)


class AuditLogRepository:
    """Repository for audit log operations."""

    def create_log(
        self,
        username: str,
        event_type: str,
        message: str,
        user_id: Optional[int] = None,
        ip_address: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        resource_name: Optional[str] = None,
        severity: str = "info",
        extra_data: Optional[dict] = None,
        db: Session = None,
    ) -> AuditLog:
        """Create a new audit log entry."""
        should_close = False
        if db is None:
            db = get_db_session()
            should_close = True

        try:
            log_entry = AuditLog(
                username=username,
                user_id=user_id,
                event_type=event_type,
                message=message,
                ip_address=ip_address,
                resource_type=resource_type,
                resource_id=resource_id,
                resource_name=resource_name,
                severity=severity,
                extra_data=json.dumps(extra_data) if extra_data else None,
            )
            db.add(log_entry)
            db.commit()
            db.refresh(log_entry)
            return log_entry
        except Exception as e:
            logger.error(f"Failed to create audit log: {e}")
            if db:
                db.rollback()
            raise
        finally:
            if should_close:
                db.close()

    def get_logs(
        self,
        username: Optional[str] = None,
        event_type: Optional[str] = None,
        severity: Optional[str] = None,
        limit: int = 100,
        db: Session = None,
    ) -> List[AuditLog]:
        """Retrieve audit logs with optional filtering."""
        should_close = False
        if db is None:
            db = get_db_session()
            should_close = True

        try:
            query = db.query(AuditLog)

            if username:
                query = query.filter(AuditLog.username == username)
            if event_type:
                query = query.filter(AuditLog.event_type == event_type)
            if severity:
                query = query.filter(AuditLog.severity == severity)

            return query.order_by(AuditLog.created_at.desc()).limit(limit).all()
        finally:
            if should_close:
                db.close()


audit_log_repo = AuditLogRepository()
