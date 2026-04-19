from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.sql import func

from core.database import Base


class AuditLog(Base):
    """Audit log for tracking user activities and system events."""

    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(255), nullable=False, index=True)  # Username or "system"
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL")
    )  # Optional FK
    event_type = Column(
        String(100), nullable=False, index=True
    )  # authentication, onboarding, device_management, etc.
    message = Column(Text, nullable=False)  # Detailed log message
    ip_address = Column(String(45))  # IPv4 or IPv6 address
    resource_type = Column(String(100))  # device, credential, job, etc.
    resource_id = Column(String(255))  # ID of affected resource
    resource_name = Column(String(255))  # Name of affected resource
    severity = Column(
        String(20), nullable=False, default="info"
    )  # info, warning, error, critical
    extra_data = Column(Text)  # JSON string for additional context
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    __table_args__ = (
        Index("idx_audit_logs_event_type_created_at", "event_type", "created_at"),
        Index("idx_audit_logs_username_created_at", "username", "created_at"),
        Index("idx_audit_logs_resource", "resource_type", "resource_id"),
        Index("idx_audit_logs_severity", "severity"),
    )
