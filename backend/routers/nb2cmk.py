"""
Nautobot to CheckMK comparison router for device synchronization and comparison.
"""

from __future__ import annotations
import logging
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import verify_token
from services.cmk_nb2cmk_service import nb2cmk_service
from models.nb2cmk import (
    DeviceList,
    DeviceListWithStatus, 
    DeviceComparison,
    DeviceOperationResult,
    DeviceUpdateResult,
    DefaultSiteResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/nb2cmk", tags=["nb2cmk"])


# Device Sync Endpoints


@router.get("/devices", response_model=dict)
async def get_devices_for_sync(
    current_user: dict = Depends(verify_token),
):
    """Get all devices from Nautobot for CheckMK sync"""
    try:
        result = await nb2cmk_service.get_devices_for_sync()
        return result.model_dump()
    except Exception as e:
        logger.error(f"Error getting devices for CheckMK sync: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get devices for CheckMK sync: {str(e)}",
        )


@router.get("/device/{device_id}/normalized")
async def get_device_normalized(
    device_id: str, current_user: dict = Depends(verify_token)
):
    """Get normalized device config from Nautobot for CheckMK comparison."""
    try:
        return await nb2cmk_service.get_device_normalized(device_id)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error getting normalized device config for {device_id}: {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get normalized device config: {str(e)}",
        )


@router.get("/get_default_site")
async def get_default_site(current_user: dict = Depends(verify_token)):
    """Get the default site from CheckMK configuration."""
    try:
        result = nb2cmk_service.get_default_site()
        return result.model_dump()
    except Exception as e:
        logger.error(f"Error getting default site: {str(e)}")
        # Return default value even if config reading fails
        return {"default_site": "cmk"}


@router.get("/get_diff", response_model=dict)
async def get_devices_diff(
    current_user: dict = Depends(verify_token),
):
    """Get all devices from Nautobot with CheckMK comparison status"""
    try:
        result = await nb2cmk_service.get_devices_diff()
        return result.model_dump()
    except Exception as e:
        logger.error(f"Error getting devices diff: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get devices diff: {str(e)}",
        )


@router.get("/device/{device_id}/compare")
async def compare_device_config(
    device_id: str, current_user: dict = Depends(verify_token)
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
    device_id: str, current_user: dict = Depends(verify_token)
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
    device_id: str, current_user: dict = Depends(verify_token)
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


# Legacy functions kept for backward compatibility (but now using utility functions)
def get_device_site(normalized_data: dict) -> str:
    """Extract site from normalized device data, falling back to default site."""
    from utils.cmk_site_utils import get_device_site_from_normalized_data
    return get_device_site_from_normalized_data(normalized_data)


def parse_folder_value(folder_template: str, device_data: dict) -> str:
    """Parse folder template variables and return the processed folder path."""
    from utils.cmk_folder_utils import parse_folder_value as parse_folder
    return parse_folder(folder_template, device_data)


def get_site(device_data: dict) -> str:
    """Get the correct CheckMK site for a device based on configuration rules."""
    from utils.cmk_site_utils import get_device_site
    return get_device_site(device_data)


def get_folder(device_data: dict) -> str:
    """Get the correct CheckMK folder for a device based on configuration rules."""
    from utils.cmk_site_utils import get_device_folder
    return get_device_folder(device_data, None)


async def create_path(folder_path: str, site_name: str, current_user: dict) -> bool:
    """Create a complete folder path in CheckMK by creating folders incrementally."""
    from services.cmk_folder_service import checkmk_folder_service
    return await checkmk_folder_service.create_path(folder_path, site_name, current_user)

