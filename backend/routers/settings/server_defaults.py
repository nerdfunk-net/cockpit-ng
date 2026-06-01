"""
Server defaults settings router.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends

from core.auth import require_permission
from models.settings import ServerDefaultsRequest

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/server/defaults")
async def get_server_defaults(
    current_user: dict = Depends(require_permission("settings.server", "read")),
):
    """Get server default values for device/IP creation."""
    try:
        from services.settings.manager import SettingsManager

        settings_manager = SettingsManager()
        defaults = settings_manager.get_server_defaults()

        return {"success": True, "data": defaults}

    except Exception as e:
        logger.error("Error getting server defaults: %s", e, exc_info=True)
        return {
            "success": False,
            "message": f"Failed to retrieve server defaults: {str(e)}",
        }


@router.post("/server/defaults")
async def update_server_defaults(
    defaults_request: ServerDefaultsRequest,
    current_user: dict = Depends(require_permission("settings.server", "write")),
):
    """Update server default values for device/IP creation."""
    try:
        from services.settings.manager import SettingsManager

        settings_manager = SettingsManager()
        success = settings_manager.update_server_defaults(defaults_request.dict())

        if success:
            return {
                "success": True,
                "message": "Server defaults updated successfully",
                "data": settings_manager.get_server_defaults(),
            }
        return {"success": False, "message": "Failed to update server defaults"}

    except Exception as e:
        logger.error("Error updating server defaults: %s", e)
        return {
            "success": False,
            "message": f"Failed to update server defaults: {str(e)}",
        }
