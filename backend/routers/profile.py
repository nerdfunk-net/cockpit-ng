"""
User profile management router.
"""

from __future__ import annotations
import logging
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional
from core.auth import get_current_username
import profile_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/profile", tags=["profile"])


class ProfileResponse(BaseModel):
    username: str
    realname: str
    email: str
    debug: bool
    api_key: Optional[str]


class ProfileUpdateRequest(BaseModel):
    realname: Optional[str] = None
    email: Optional[str] = None
    debug: Optional[bool] = None
    password: Optional[str] = None
    api_key: Optional[str] = None


@router.get("", response_model=ProfileResponse)
async def get_profile(current_user: str = Depends(get_current_username)):
    """Get current user's profile information."""
    try:
        from services.user_management import get_user_by_username

        user = get_user_by_username(current_user)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        # Get profile data including API key
        profile = profile_manager.get_user_profile(current_user)

        return ProfileResponse(
            username=user["username"],
            realname=user["realname"],
            email=user["email"] or "",
            debug=user["debug"],
            api_key=profile.get("api_key"),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching profile for {current_user}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch profile",
        )


@router.put("", response_model=ProfileResponse)
async def update_profile(
    update_data: ProfileUpdateRequest, current_user: str = Depends(get_current_username)
):
    """Update current user's profile information."""
    try:
        from services.user_management import get_user_by_username, update_user

        # Get current user to get user ID
        user = get_user_by_username(current_user)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        # Validate API key length if provided
        if update_data.api_key is not None and len(update_data.api_key) != 42:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="API key must be exactly 42 characters long",
            )

        # Update user in new database
        updated_user = update_user(
            user_id=user["id"],
            realname=update_data.realname,
            email=update_data.email,
            debug=update_data.debug,
            password=update_data.password,
        )

        if not updated_user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update profile",
            )

        # Update profile with API key
        profile_manager.update_user_profile(
            username=current_user,
            realname=update_data.realname,
            email=update_data.email,
            debug_mode=update_data.debug,
            api_key=update_data.api_key,
        )

        logger.info(f"Profile updated for user: {current_user}")

        # Get updated profile data including API key
        profile = profile_manager.get_user_profile(current_user)

        return ProfileResponse(
            username=updated_user["username"],
            realname=updated_user["realname"],
            email=updated_user["email"] or "",
            debug=updated_user["debug"],
            api_key=profile.get("api_key"),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating profile for {current_user}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile",
        )
