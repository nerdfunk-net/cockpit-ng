"""Post-login persistence: last_login + audit in one database transaction."""

from __future__ import annotations

from typing import Optional

from core.database import db_transaction
from repositories.audit_log.audit_log_repository import AuditLogRepository
from repositories.auth.user_repository import UserRepository


class LoginRecordingService:
    def __init__(
        self,
        user_repository: UserRepository | None = None,
        audit_repository: AuditLogRepository | None = None,
    ) -> None:
        self._users = user_repository or UserRepository()
        self._audit = audit_repository or AuditLogRepository()

    def record_successful_login(
        self,
        user_id: int,
        username: str,
        role_names: list[str],
        *,
        authentication_method: str,
        message: Optional[str] = None,
        extra_data: Optional[dict] = None,
    ) -> None:
        msg = message or f"User '{username}' logged in"
        merged: dict = {
            "authentication_method": authentication_method,
            "roles": role_names,
        }
        if extra_data:
            merged.update(extra_data)
        with db_transaction() as db:
            self._users.update_last_login(
                user_id, db=db, auto_commit=False
            )
            self._audit.create_log(
                username=username,
                user_id=user_id,
                event_type="login",
                message=msg,
                resource_type="authentication",
                resource_id=str(user_id),
                resource_name=username,
                severity="info",
                extra_data=merged,
                db=db,
                auto_commit=False,
            )
