"""
User profile management router.
"""

from __future__ import annotations
import logging
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional
from core.auth import verify_token
import profile_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/profile", tags=["profile"])

class ProfileResponse(BaseModel):
    username: str
    realname: str
    email: str
    debug: bool

class ProfileUpdateRequest(BaseModel):
    realname: Optional[str] = None
    email: Optional[str] = None
    debug: Optional[bool] = None
    password: Optional[str] = None

@router.get("", response_model=ProfileResponse)
async def get_profile(current_user: str = Depends(verify_token)):
    """Get current user's profile information."""
    try:
        profile = profile_manager.get_user_profile(current_user)
        
        return ProfileResponse(
            username=profile["username"],
            realname=profile["realname"] or "",
            email=profile["email"] or "",
            debug=profile["debug"]
        )
    except Exception as e:
        logger.error(f"Error fetching profile for {current_user}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch profile"
        )

@router.put("", response_model=ProfileResponse)
async def update_profile(
    update_data: ProfileUpdateRequest,
    current_user: str = Depends(verify_token)
):
    """Update current user's profile information."""
    try:
        # Update profile fields
        profile = profile_manager.update_user_profile(
            username=current_user,
            realname=update_data.realname,
            email=update_data.email,
            debug_mode=update_data.debug
        )
        
        # Update password if provided
        if update_data.password:
            success = profile_manager.update_user_password(current_user, update_data.password)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update password"
                )
            logger.info(f"Password updated for user: {current_user}")
        
        logger.info(f"Profile updated for user: {current_user}")
        
        return ProfileResponse(
            username=profile["username"],
            realname=profile["realname"] or "",
            email=profile["email"] or "",
            debug=profile["debug"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating profile for {current_user}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile"
        )