"""
Cache configuration settings router.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from core.safe_http_errors import raise_internal_server_error
from models.settings import CacheSettingsRequest

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/cache")
async def get_cache_settings(
    current_user: dict = Depends(require_permission("settings.nautobot", "write")),
):
    """Get Cache settings."""
    try:
        from services.settings.manager import SettingsManager

        settings_manager = SettingsManager()

        cache_settings = settings_manager.get_cache_settings()
        return {"success": True, "data": cache_settings}
    except Exception:
        logger.error("Error getting Cache settings", exc_info=True)
        return {
            "success": False,
            "message": "Failed to retrieve Cache settings",
        }


@router.put("/cache")
async def update_cache_settings(
    cache_request: CacheSettingsRequest,
    current_user: dict = Depends(require_permission("settings.nautobot", "write")),
):
    """Update Cache settings."""
    try:
        from services.settings.manager import SettingsManager

        settings_manager = SettingsManager()

        success = settings_manager.update_cache_settings(cache_request.dict())
        if success:
            updated = settings_manager.get_cache_settings()
            return {
                "success": True,
                "message": "Cache settings updated successfully",
                "data": updated,
                "cache": updated,  # backward compatibility
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update Cache settings",
            )
    except Exception as e:
        raise_internal_server_error(logger, "Failed to update Cache settings: ", e)


@router.post("/cache")
async def create_cache_settings(
    cache_request: CacheSettingsRequest,
    current_user: dict = Depends(require_permission("settings.nautobot", "write")),
):
    """Create/Update Cache settings via POST."""
    try:
        from services.settings.manager import SettingsManager

        settings_manager = SettingsManager()

        success = settings_manager.update_cache_settings(cache_request.dict())
        if success:
            updated = settings_manager.get_cache_settings()
            return {
                "success": True,
                "message": "Cache settings updated successfully",
                "data": updated,
                "cache": updated,  # backward compatibility
            }
        else:
            return {"success": False, "message": "Failed to update Cache settings"}
    except Exception:
        logger.error("Error updating Cache settings", exc_info=True)
        return {
            "success": False,
            "message": "Failed to update Cache settings",
        }
