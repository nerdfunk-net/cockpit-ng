"""
Nautobot settings router.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from core.safe_http_errors import raise_internal_server_error
from dependencies import get_audit_log_service
from models.settings import ConnectionTestRequest, NautobotSettingsRequest
from services.audit.audit_log_service import AuditLogService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/nautobot")
async def get_nautobot_settings(
    current_user: dict = Depends(require_permission("settings.nautobot", "write")),
):
    """Get Nautobot settings."""
    try:
        from services.settings.manager import SettingsManager

        settings_manager = SettingsManager()

        nautobot_settings = settings_manager.get_nautobot_settings()
        return {"success": True, "data": nautobot_settings}

    except Exception as e:
        logger.error("Error getting Nautobot settings: %s", e)
        return {
            "success": False,
            "message": f"Failed to retrieve Nautobot settings: {str(e)}",
        }


@router.put("/nautobot")
async def update_nautobot_settings(
    nautobot_request: NautobotSettingsRequest,
    current_user: dict = Depends(require_permission("settings.nautobot", "write")),
    audit_log: AuditLogService = Depends(get_audit_log_service),
):
    """Update Nautobot settings."""
    try:
        from services.settings.manager import SettingsManager

        settings_manager = SettingsManager()

        success = settings_manager.update_nautobot_settings(nautobot_request.dict())

        if success:
            audit_log.log_event(
                username=current_user.get("sub"),
                user_id=current_user.get("user_id"),
                event_type="settings-nautobot-updated",
                message="Nautobot connection settings updated",
                resource_type="settings",
                resource_name="nautobot",
                severity="info",
            )
            return {
                "message": "Nautobot settings updated successfully",
                "nautobot": settings_manager.get_nautobot_settings(),
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update Nautobot settings",
            )

    except Exception as e:
        raise_internal_server_error(logger, "Failed to update Nautobot settings: ", e)


@router.post("/nautobot")
async def create_nautobot_settings(
    nautobot_request: NautobotSettingsRequest,
    current_user: dict = Depends(require_permission("settings.nautobot", "write")),
    audit_log: AuditLogService = Depends(get_audit_log_service),
):
    """Create/Update Nautobot settings via POST."""
    try:
        from services.settings.manager import SettingsManager

        settings_manager = SettingsManager()

        success = settings_manager.update_nautobot_settings(nautobot_request.dict())

        if success:
            audit_log.log_event(
                username=current_user.get("sub"),
                user_id=current_user.get("user_id"),
                event_type="settings-nautobot-updated",
                message="Nautobot connection settings updated",
                resource_type="settings",
                resource_name="nautobot",
                severity="info",
            )
            return {
                "success": True,
                "message": "Nautobot settings updated successfully",
                "data": settings_manager.get_nautobot_settings(),
            }
        else:
            return {"success": False, "message": "Failed to update Nautobot settings"}

    except Exception as e:
        logger.error("Error updating Nautobot settings: %s", e)
        return {
            "success": False,
            "message": f"Failed to update Nautobot settings: {str(e)}",
        }


@router.post("/test/nautobot")
async def test_nautobot_connection(
    test_request: ConnectionTestRequest,
    current_user: dict = Depends(require_permission("settings.nautobot", "write")),
):
    """Test Nautobot connection with provided settings."""
    try:
        from connection_tester import connection_tester

        success, message = await connection_tester.test_nautobot_connection(test_request.dict())

        return {
            "success": success,
            "message": message,
            "tested_url": test_request.url,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        logger.error("Error testing Nautobot connection: %s", e)
        return {
            "success": False,
            "message": f"Test failed: {str(e)}",
            "tested_url": test_request.url,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
