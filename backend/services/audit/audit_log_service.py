"""Application audit trail — router-facing API over AuditLogRepository."""

from __future__ import annotations

from typing import Any

from core.models import AuditLog
from repositories.audit_log.audit_log_repository import AuditLogRepository


class AuditLogService:
    """Thin service so routers do not import the repository directly."""

    def __init__(self, repository: AuditLogRepository | None = None) -> None:
        self._repo = repository or AuditLogRepository()

    def log_event(self, **kwargs: Any) -> AuditLog:
        """Persist an audit row; keyword arguments match ``create_log``."""
        return self._repo.create_log(**kwargs)
