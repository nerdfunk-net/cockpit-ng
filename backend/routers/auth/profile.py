"""
User profile management router.
"""

from __future__ import annotations
import logging
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional, List
from core.auth import get_current_username
import profile_manager
import credentials_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/profile", tags=["profile"])


class PersonalCredentialData(BaseModel):
    id: str
    name: str
    username: str
    type: str
    password: Optional[str] = None  # Optional for ssh_key type
    ssh_private_key: Optional[str] = None  # For ssh_key type
    ssh_passphrase: Optional[str] = None  # Optional passphrase for ssh_key
    has_ssh_key: Optional[bool] = None  # Indicates if SSH key is stored


class ProfileResponse(BaseModel):
    username: str
    realname: str
    email: str
    api_key: Optional[str]
    personal_credentials: Optional[List[PersonalCredentialData]] = []


class ProfileUpdateRequest(BaseModel):
    realname: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    api_key: Optional[str] = None
    personal_credentials: Optional[List[PersonalCredentialData]] = []


@router.get("", response_model=ProfileResponse)
async def get_profile(current_user: str = Depends(get_current_username)):
    """Get current user's profile information."""
    try:
        from services.auth.user_management import get_user_by_username

        user = get_user_by_username(current_user)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        # Get profile data including API key
        profile = profile_manager.get_user_profile(current_user)

        # Get personal credentials for this user
        all_credentials = credentials_manager.list_credentials(
            include_expired=True, source="private"
        )
        personal_credentials = []
        for cred in all_credentials:
            if cred.get("owner") == current_user:
                # For non-ssh_key types, get decrypted password to determine length
                password_token = ""
                if cred.get("type") != "ssh_key" and cred.get("has_password"):
                    try:
                        decrypted_password = credentials_manager.get_decrypted_password(
                            cred["id"]
                        )
                        # Create a token with the same length as the actual password
                        password_token = (
                            "•" * len(decrypted_password) if decrypted_password else ""
                        )
                    except Exception as e:
                        logger.warning(
                            f"Failed to decrypt password for credential {cred['id']}: {e}"
                        )
                        password_token = ""

                personal_credentials.append(
                    PersonalCredentialData(
                        id=str(cred["id"]),
                        name=cred["name"],
                        username=cred["username"],
                        type=cred["type"],
                        password=password_token,  # Return length-matched token instead of actual password
                        has_ssh_key=cred.get("has_ssh_key", False),
                    )
                )

        return ProfileResponse(
            username=user["username"],
            realname=user["realname"],
            email=user["email"] or "",
            api_key=profile.get("api_key"),
            personal_credentials=personal_credentials,
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
        from services.auth.user_management import get_user_by_username, update_user

        # Get current user to get user ID
        user = get_user_by_username(current_user)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        # Validate API key length if provided (allow empty string for no API key)
        if (
            update_data.api_key is not None
            and update_data.api_key != ""
            and len(update_data.api_key) != 42
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="API key must be exactly 42 characters long",
            )

        # Update user in new database
        updated_user = update_user(
            user_id=user["id"],
            realname=update_data.realname,
            email=update_data.email,
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
            api_key=update_data.api_key,
        )

        # Handle personal credentials
        if update_data.personal_credentials is not None:
            # Get existing personal credentials for this user
            all_credentials = credentials_manager.list_credentials(
                include_expired=True, source="private"
            )
            existing_personal = [
                cred for cred in all_credentials if cred.get("owner") == current_user
            ]
            existing_ids = {str(cred["id"]) for cred in existing_personal}

            # Track which credentials we're keeping/updating
            processed_ids = set()

            # Process each credential from the frontend
            for cred_data in update_data.personal_credentials:
                # Check if this is an update to existing credential (must be numeric ID that exists)
                is_existing = cred_data.id.isdigit() and cred_data.id in existing_ids
                cred_type_lower = cred_data.type.lower()

                if is_existing:
                    processed_ids.add(cred_data.id)

                    if cred_type_lower == "ssh_key":
                        # Update SSH key credential
                        credentials_manager.update_credential(
                            cred_id=int(cred_data.id),
                            name=cred_data.name,
                            username=cred_data.username,
                            cred_type=cred_type_lower,
                            ssh_private_key=cred_data.ssh_private_key
                            if cred_data.ssh_private_key
                            else None,
                            ssh_passphrase=cred_data.ssh_passphrase
                            if cred_data.ssh_passphrase
                            else None,
                            source="private",
                            owner=current_user,
                        )
                    elif cred_data.password:
                        # Update credential with new password
                        credentials_manager.update_credential(
                            cred_id=int(cred_data.id),
                            name=cred_data.name,
                            username=cred_data.username,
                            cred_type=cred_type_lower,
                            password=cred_data.password,
                            source="private",
                            owner=current_user,
                        )
                    else:
                        # Update everything except password/ssh_key
                        credentials_manager.update_credential(
                            cred_id=int(cred_data.id),
                            name=cred_data.name,
                            username=cred_data.username,
                            cred_type=cred_type_lower,
                            source="private",
                            owner=current_user,
                        )
                else:
                    # Create new credential
                    if cred_type_lower == "ssh_key":
                        # SSH key credential - ssh_private_key is required
                        if not cred_data.ssh_private_key:
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail="SSH private key is required for new SSH key credentials",
                            )
                        new_cred = credentials_manager.create_credential(
                            name=cred_data.name,
                            username=cred_data.username,
                            cred_type=cred_type_lower,
                            ssh_private_key=cred_data.ssh_private_key,
                            ssh_passphrase=cred_data.ssh_passphrase,
                            valid_until=None,
                            source="private",
                            owner=current_user,
                        )
                    else:
                        # Non-SSH key credential - password is required
                        if not cred_data.password:
                            raise HTTPException(
                                status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Password is required for new personal credentials",
                            )
                        new_cred = credentials_manager.create_credential(
                            name=cred_data.name,
                            username=cred_data.username,
                            cred_type=cred_type_lower,
                            password=cred_data.password,
                            valid_until=None,
                            source="private",
                            owner=current_user,
                        )
                    # Track the new ID for existing credentials cleanup
                    processed_ids.add(str(new_cred["id"]))

            # Delete credentials that were removed (not in the processed list)
            for cred in existing_personal:
                if str(cred["id"]) not in processed_ids:
                    credentials_manager.delete_credential(cred["id"])

        logger.info(f"Profile updated for user: {current_user}")

        # Get updated profile data including API key and personal credentials
        profile = profile_manager.get_user_profile(current_user)

        # Get updated personal credentials for this user
        all_credentials = credentials_manager.list_credentials(
            include_expired=True, source="private"
        )
        personal_credentials = []
        for cred in all_credentials:
            if cred.get("owner") == current_user:
                cred_type = cred.get("type", "")

                # Handle SSH key credentials differently
                if cred_type == "ssh_key":
                    has_ssh_key = credentials_manager.has_ssh_key(cred["id"])
                    personal_credentials.append(
                        PersonalCredentialData(
                            id=str(cred["id"]),
                            name=cred["name"],
                            username=cred["username"],
                            type=cred["type"],
                            password=None,
                            has_ssh_key=has_ssh_key,
                        )
                    )
                else:
                    # Get decrypted password to determine length
                    try:
                        decrypted_password = credentials_manager.get_decrypted_password(
                            cred["id"]
                        )
                        # Create a token with the same length as the actual password
                        password_token = (
                            "•" * len(decrypted_password) if decrypted_password else ""
                        )
                    except Exception as e:
                        logger.warning(
                            f"Failed to decrypt password for credential {cred['id']}: {e}"
                        )
                        password_token = ""

                    personal_credentials.append(
                        PersonalCredentialData(
                            id=str(cred["id"]),
                            name=cred["name"],
                            username=cred["username"],
                            type=cred["type"],
                            password=password_token,  # Return length-matched token instead of actual password
                        )
                    )

        return ProfileResponse(
            username=updated_user["username"],
            realname=updated_user["realname"],
            email=updated_user["email"] or "",
            debug=updated_user["debug"],
            api_key=profile.get("api_key"),
            personal_credentials=personal_credentials,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating profile for {current_user}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile",
        )
