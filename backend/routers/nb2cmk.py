"""
Nautobot to CheckMK comparison router for device synchronization and comparison.
"""

from __future__ import annotations
import logging
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from services.nb2cmk_base_service import nb2cmk_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/nb2cmk", tags=["nb2cmk"])


# Device Sync Endpoints


@router.get("/get_default_site")
async def get_default_site(
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
):
    """Get the default site from CheckMK configuration."""
    try:
        result = nb2cmk_service.get_default_site()
        return result.model_dump()
    except Exception as e:
        logger.error(f"Error getting default site: {str(e)}")
        # Return default value even if config reading fails
        return {"default_site": "cmk"}


@router.get("/device/{device_id}/compare")
async def compare_device_config(
    device_id: str,
    current_user: dict = Depends(require_permission("checkmk.devices", "read")),
):
    """Compare normalized Nautobot device config with CheckMK host config."""
    try:
        result = await nb2cmk_service.compare_device_config(device_id)
        return result.model_dump()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error comparing device configs for {device_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compare device configs: {str(e)}",
        )


@router.post("/device/{device_id}/add")
async def add_device_to_checkmk(
    device_id: str,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
):
    """Add a device from Nautobot to CheckMK using normalized config."""
    try:
        result = await nb2cmk_service.add_device_to_checkmk(device_id)
        return result.model_dump()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding device {device_id} to CheckMK: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add device {device_id} to CheckMK: {str(e)}",
        )


@router.post("/device/{device_id}/update")
async def update_device_in_checkmk(
    device_id: str,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
):
    """Update/sync a device from Nautobot to CheckMK using normalized config."""
    try:
        result = await nb2cmk_service.update_device_in_checkmk(device_id)
        return result.model_dump()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating device {device_id} in CheckMK: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update device {device_id} in CheckMK: {str(e)}",
        )
