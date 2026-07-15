"""
Profiles router: named, reusable sets of Nautobot device/IP default values.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from core.safe_http_errors import raise_internal_server_error
from dependencies import get_defaults_profile_service
from models.settings import ProfileCreateRequest, ProfileUpdateRequest
from services.settings.exceptions import ProfileValidationError
from services.settings.profile_service import ProfileService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/settings/profiles", tags=["profiles"])


@router.get("")
async def list_profiles(
    current_user: dict = Depends(require_permission("settings.defaults", "read")),
    profiles: ProfileService = Depends(get_defaults_profile_service),
):
    """List all profiles (built-in Network/Server plus any custom profiles)."""
    try:
        return {"success": True, "data": profiles.list()}
    except Exception as e:
        raise_internal_server_error(logger, "Failed to retrieve profiles: ", e)


@router.get("/{profile_id}")
async def get_profile(
    profile_id: int,
    current_user: dict = Depends(require_permission("settings.defaults", "read")),
    profiles: ProfileService = Depends(get_defaults_profile_service),
):
    """Get a specific profile by ID."""
    try:
        profile = profiles.get(profile_id)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Profile with ID {profile_id} not found",
            )
        return {"success": True, "data": profile}
    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(logger, "Failed to retrieve profile: ", e)


@router.post("")
async def create_profile(
    profile_request: ProfileCreateRequest,
    current_user: dict = Depends(require_permission("settings.defaults", "write")),
    profiles: ProfileService = Depends(get_defaults_profile_service),
):
    """Create a new custom profile."""
    try:
        created = profiles.create(
            name=profile_request.name,
            fields=profile_request.model_dump(exclude={"name"}),
        )
        return {
            "success": True,
            "message": "Profile created successfully",
            "data": created,
        }
    except ProfileValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise_internal_server_error(logger, "Failed to create profile: ", e)


@router.put("/{profile_id}")
async def update_profile(
    profile_id: int,
    profile_request: ProfileUpdateRequest,
    current_user: dict = Depends(require_permission("settings.defaults", "write")),
    profiles: ProfileService = Depends(get_defaults_profile_service),
):
    """Update a profile's fields, optionally renaming it (built-ins cannot be renamed).

    Only fields explicitly present in the request body are applied - a
    rename-only payload (just {"name": "..."}) leaves the other 13 fields
    untouched rather than overwriting them with schema defaults.
    """
    try:
        updated = profiles.update(
            profile_id,
            name=profile_request.name,
            fields=profile_request.model_dump(exclude={"name"}, exclude_unset=True),
        )
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Profile with ID {profile_id} not found",
            )
        return {
            "success": True,
            "message": "Profile updated successfully",
            "data": updated,
        }
    except HTTPException:
        raise
    except ProfileValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise_internal_server_error(logger, "Failed to update profile: ", e)


@router.delete("/{profile_id}")
async def delete_profile(
    profile_id: int,
    current_user: dict = Depends(require_permission("settings.defaults", "write")),
    profiles: ProfileService = Depends(get_defaults_profile_service),
):
    """Delete a custom profile (built-ins cannot be deleted)."""
    try:
        deleted = profiles.delete(profile_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Profile with ID {profile_id} not found",
            )
        return {"success": True, "message": "Profile deleted successfully"}
    except HTTPException:
        raise
    except ProfileValidationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise_internal_server_error(logger, "Failed to delete profile: ", e)
