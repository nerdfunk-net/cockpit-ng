"""
Settings router for general application configuration management.
"""

from __future__ import annotations
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from models.settings import AllSettingsRequest

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("")
async def get_all_settings(
    current_user: dict = Depends(require_permission("settings.nautobot", "write")),
):
    """Get all application settings."""
    try:
        from settings_manager import settings_manager

        settings_data = settings_manager.get_all_settings()

        metadata = settings_data.get("metadata", {})
        if metadata.get("status") == "recovered":
            return {
                "settings": settings_data,
                "warning": metadata.get(
                    "message", "Database was recovered from corruption"
                ),
                "recovery_performed": True,
            }

        return {"settings": settings_data}

    except Exception as e:
        logger.error("Error getting settings: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve settings: {str(e)}",
        )


@router.put("")
async def update_all_settings(
    settings_request: AllSettingsRequest,
    current_user: dict = Depends(require_permission("settings.nautobot", "write")),
):
    """Update all application settings."""
    try:
        from settings_manager import settings_manager

        settings_dict = {
            "nautobot": settings_request.nautobot.dict(),
            "git": settings_request.git.dict(),
        }
        if settings_request.cache is not None:
            settings_dict["cache"] = settings_request.cache.dict()

        success = settings_manager.update_all_settings(settings_dict)

        if success:
            return {
                "message": "Settings updated successfully",
                "settings": settings_manager.get_all_settings(),
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update settings",
            )

    except Exception as e:
        logger.error("Error updating settings: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update settings: {str(e)}",
        )


@router.post("/reset")
async def reset_settings_to_defaults(
    current_user: dict = Depends(require_permission("settings.nautobot", "write")),
):
    """Reset all settings to default values."""
    try:
        from settings_manager import settings_manager

        success = settings_manager.reset_to_defaults()

        if success:
            return {
                "message": "Settings reset to defaults successfully",
                "settings": settings_manager.get_all_settings(),
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to reset settings to defaults",
            )

    except Exception as e:
        logger.error("Error resetting settings: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reset settings: {str(e)}",
        )


@router.get("/health")
async def check_settings_health(
    current_user: dict = Depends(require_permission("settings.nautobot", "write")),
):
    """Check settings database health."""
    try:
        from settings_manager import settings_manager

        health_info = settings_manager.health_check()

        if health_info["status"] == "healthy":
            return health_info
        else:
            recovery_result = settings_manager._handle_database_corruption()
            return {
                **health_info,
                "recovery_attempted": True,
                "recovery_result": recovery_result,
            }

    except Exception as e:
        logger.error("Settings health check failed: %s", e)
        return {
            "status": "error",
            "message": f"Health check failed: {str(e)}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


# Legacy template settings endpoints for backward compatibility
@router.get("/templates")
async def get_template_settings(
    current_user: dict = Depends(require_permission("settings.nautobot", "write")),
):
    """Get template settings (legacy endpoint - redirects to new template management)."""
    return {
        "message": "Template settings have been moved to /api/templates",
        "redirect_url": "/api/templates",
        "legacy": True,
    }


@router.post("/templates")
async def update_template_settings(
    template_data: dict,
    current_user: dict = Depends(require_permission("settings.nautobot", "write")),
):
    """Update template settings (legacy endpoint - redirects to new template management)."""
    return {
        "message": "Template settings have been moved to /api/templates",
        "redirect_url": "/api/templates",
        "legacy": True,
        "note": "Please use the new template management interface",
    }
