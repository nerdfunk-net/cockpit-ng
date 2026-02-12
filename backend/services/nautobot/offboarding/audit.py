"""Audit logging for offboarding events."""

from __future__ import annotations

import logging
from typing import Any, Dict

from models.nautobot import OffboardDeviceRequest
from services.nautobot.offboarding.types import OffboardingResult

logger = logging.getLogger(__name__)


def log_offboarding_event(
    results: OffboardingResult,
    device_details: Dict[str, Any],
    request: OffboardDeviceRequest,
    current_user: Dict[str, Any],
    integration_mode: str,
) -> None:
    """Write an audit log entry for the offboarding operation."""
    username = current_user.get("username")
    user_id = current_user.get("user_id")

    if not username:
        logger.debug("No username found in current_user; skipping audit log")
        return

    from repositories.audit_log_repository import audit_log_repo

    # Prepare extra data for audit log
    removed_count = len(results["removed_items"])
    error_count = len(results["errors"])

    extra_data = {
        "integration_mode": integration_mode,
        "removed_items_count": removed_count,
        "errors_count": error_count,
    }

    # Add device details if available
    if device_details:
        if "serial" in device_details and device_details["serial"]:
            extra_data["serial_number"] = device_details["serial"]

        # Get platform name if available
        platform = device_details.get("platform")
        if platform and isinstance(platform, dict):
            extra_data["platform"] = platform.get("name")

        # Get device type/model if available
        device_type = device_details.get("device_type")
        if device_type and isinstance(device_type, dict):
            extra_data["device_type"] = device_type.get("model")

    # Add request properties
    extra_data["remove_interface_ips"] = request.remove_interface_ips
    extra_data["remove_primary_ip"] = request.remove_primary_ip
    extra_data["remove_from_checkmk"] = request.remove_from_checkmk

    # Log with appropriate severity based on success
    severity = "info" if results["success"] else "warning"

    audit_log_repo.create_log(
        username=username,
        user_id=user_id,
        event_type="offboard-device",
        message=f"Device '{results['device_name']}' offboarded from Nautobot",
        resource_type="device",
        resource_id=results["device_id"],
        resource_name=results.get("device_name", results["device_id"]),
        severity=severity,
        extra_data=extra_data,
    )

    logger.debug("Audit log entry created for device %s", results["device_id"])
