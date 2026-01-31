"""Helper functions for audit logging."""

import logging
from typing import Optional
from repositories.audit_log_repository import audit_log_repo

logger = logging.getLogger(__name__)


def log_auth_event(
    username: str,
    action: str,  # "login", "logout", "login_failed"
    ip_address: Optional[str] = None,
    user_id: Optional[int] = None,
    success: bool = True,
):
    """Log authentication events."""
    severity = "info" if success else "warning"
    message = f"User {action}"

    try:
        audit_log_repo.create_log(
            username=username,
            user_id=user_id,
            event_type="authentication",
            message=message,
            ip_address=ip_address,
            severity=severity,
        )
    except Exception as e:
        logger.error(f"Failed to create auth audit log: {e}")


def log_device_onboarding(
    username: str,
    device_name: str,
    device_id: Optional[str] = None,
    user_id: Optional[int] = None,
    success: bool = True,
    error_message: Optional[str] = None,
):
    """Log device onboarding events."""
    severity = "info" if success else "error"
    message = f"Device '{device_name}' onboarded to Nautobot"

    if not success and error_message:
        message += f" - Error: {error_message}"

    logger.info(
        f"Creating audit log: username={username}, device={device_name}, device_id={device_id}"
    )

    try:
        audit_log_repo.create_log(
            username=username,
            user_id=user_id,
            event_type="onboarding",
            message=message,
            resource_type="device",
            resource_id=device_id,
            resource_name=device_name,
            severity=severity,
        )
        logger.info(f"Audit log created successfully for device {device_name}")
    except Exception as e:
        logger.error(
            f"Failed to create device onboarding audit log: {e}", exc_info=True
        )


def log_system_event(
    message: str,
    event_type: str = "system",
    severity: str = "info",
    extra_data: Optional[dict] = None,
):
    """Log system events."""
    try:
        audit_log_repo.create_log(
            username="system",
            event_type=event_type,
            message=message,
            severity=severity,
            extra_data=extra_data,
        )
    except Exception as e:
        logger.error(f"Failed to create system audit log: {e}")
