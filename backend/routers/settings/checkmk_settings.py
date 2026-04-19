"""
CheckMK settings router.
"""

from __future__ import annotations
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends

from core.auth import require_permission
from dependencies import get_checkmk_service
from models.settings import CheckMKSettingsRequest, CheckMKTestRequest

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/checkmk")
async def get_checkmk_settings(
    current_user: dict = Depends(require_permission("settings.nautobot", "write")),
):
    """Get CheckMK settings."""
    try:
        from settings_manager import settings_manager

        settings_data = settings_manager.get_checkmk_settings()
        return {"success": True, "data": settings_data}

    except Exception as e:
        logger.error("Error getting CheckMK settings: %s", e)
        return {
            "success": False,
            "message": f"Failed to get CheckMK settings: {str(e)}",
        }


@router.post("/checkmk")
async def create_checkmk_settings(
    checkmk_request: CheckMKSettingsRequest,
    current_user: dict = Depends(require_permission("settings.nautobot", "write")),
):
    """Create/Update CheckMK settings via POST."""
    try:
        from settings_manager import settings_manager

        success = settings_manager.update_checkmk_settings(checkmk_request.dict())

        if success:
            return {
                "success": True,
                "message": "CheckMK settings updated successfully",
                "data": settings_manager.get_checkmk_settings(),
            }
        else:
            return {"success": False, "message": "Failed to update CheckMK settings"}

    except Exception as e:
        logger.error("Error updating CheckMK settings: %s", e)
        return {
            "success": False,
            "message": f"Failed to update CheckMK settings: {str(e)}",
        }


@router.post("/test/checkmk")
async def test_checkmk_connection(
    test_request: CheckMKTestRequest,
    current_user: dict = Depends(require_permission("settings.nautobot", "write")),
    checkmk_service=Depends(get_checkmk_service),
):
    """Test CheckMK connection with provided settings."""
    try:
        success, message = await checkmk_service.test_connection(
            test_request.url,
            test_request.site,
            test_request.username,
            test_request.password,
            test_request.verify_ssl,
        )

        return {
            "success": success,
            "message": message,
            "tested_url": test_request.url,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        logger.error("Error testing CheckMK connection: %s", e)
        return {
            "success": False,
            "message": f"Test failed: {str(e)}",
            "tested_url": test_request.url,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
