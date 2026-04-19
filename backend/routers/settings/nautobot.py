"""
Nautobot settings router.
"""

from __future__ import annotations
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from repositories.audit_log_repository import audit_log_repo
from models.settings import (
    NautobotSettingsRequest,
    ConnectionTestRequest,
    NautobotDefaultsRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/nautobot")
async def get_nautobot_settings(
    current_user: dict = Depends(require_permission("settings.nautobot", "write")),
):
    """Get Nautobot settings."""
    try:
        from settings_manager import settings_manager

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
):
    """Update Nautobot settings."""
    try:
        from settings_manager import settings_manager

        success = settings_manager.update_nautobot_settings(nautobot_request.dict())

        if success:
            audit_log_repo.create_log(
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
        logger.error("Error updating Nautobot settings: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update Nautobot settings: {str(e)}",
        )


@router.post("/nautobot")
async def create_nautobot_settings(
    nautobot_request: NautobotSettingsRequest,
    current_user: dict = Depends(require_permission("settings.nautobot", "write")),
):
    """Create/Update Nautobot settings via POST."""
    try:
        from settings_manager import settings_manager

        success = settings_manager.update_nautobot_settings(nautobot_request.dict())

        if success:
            audit_log_repo.create_log(
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

        success, message = await connection_tester.test_nautobot_connection(
            test_request.dict()
        )

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


@router.get("/nautobot/defaults")
async def get_nautobot_defaults(
    current_user: dict = Depends(require_permission("settings.nautobot", "read")),
):
    """Get Nautobot default settings."""
    try:
        from settings_manager import settings_manager

        defaults = settings_manager.get_nautobot_defaults()

        return {"success": True, "data": defaults}

    except Exception as e:
        logger.error("Error getting Nautobot defaults: %s", e, exc_info=True)
        return {
            "success": False,
            "message": f"Failed to retrieve Nautobot defaults: {str(e)}",
        }


@router.post("/nautobot/defaults")
async def update_nautobot_defaults(
    defaults_request: NautobotDefaultsRequest,
    current_user: dict = Depends(require_permission("settings.nautobot", "write")),
):
    """Update Nautobot default settings."""
    try:
        from settings_manager import settings_manager

        success = settings_manager.update_nautobot_defaults(defaults_request.dict())

        if success:
            return {
                "success": True,
                "message": "Nautobot defaults updated successfully",
                "data": settings_manager.get_nautobot_defaults(),
            }
        else:
            return {"success": False, "message": "Failed to update Nautobot defaults"}

    except Exception as e:
        logger.error("Error updating Nautobot defaults: %s", e)
        return {
            "success": False,
            "message": f"Failed to update Nautobot defaults: {str(e)}",
        }
