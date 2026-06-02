"""
Network defaults settings router.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends

from core.auth import require_permission
from models.settings import NetworkDefaultsRequest

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/network/defaults")
async def get_network_defaults(
    current_user: dict = Depends(require_permission("settings.nautobot", "read")),
):
    """Get network default values for device/IP creation."""
    try:
        from services.settings.manager import SettingsManager

        settings_manager = SettingsManager()
        defaults = settings_manager.get_network_defaults()

        return {"success": True, "data": defaults}

    except Exception:
        logger.error("Error getting network defaults", exc_info=True)
        return {
            "success": False,
            "message": "Failed to retrieve network defaults",
        }


@router.post("/network/defaults")
async def update_network_defaults(
    defaults_request: NetworkDefaultsRequest,
    current_user: dict = Depends(require_permission("settings.nautobot", "write")),
):
    """Update network default values for device/IP creation."""
    try:
        from services.settings.manager import SettingsManager

        settings_manager = SettingsManager()
        success = settings_manager.update_network_defaults(defaults_request.dict())

        if success:
            return {
                "success": True,
                "message": "Network defaults updated successfully",
                "data": settings_manager.get_network_defaults(),
            }
        return {"success": False, "message": "Failed to update network defaults"}

    except Exception:
        logger.error("Error updating network defaults", exc_info=True)
        return {
            "success": False,
            "message": "Failed to update network defaults",
        }
