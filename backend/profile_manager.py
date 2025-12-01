"""User profile management system.

Extends the user system to include profile information like API keys.
Database: PostgreSQL (cockpit database)
Table: user_profiles
"""

from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, Optional
from repositories import ProfileRepository
from core.models import UserProfile

# Initialize repository
_profile_repo = ProfileRepository()


def _profile_to_dict(profile: UserProfile) -> Dict[str, Any]:
    """Convert UserProfile model to dictionary."""
    return {
        "id": profile.id,
        "username": profile.username,
        "realname": profile.realname,
        "email": profile.email,
        "debug": profile.debug_mode,
        "api_key": profile.api_key,
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
        "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
    }


def get_user_profile(username: str) -> Optional[Dict[str, Any]]:
    """Get user profile by username.

    Returns default profile if none exists in database.
    """
    profile = _profile_repo.get_by_username(username)

    if profile:
        return _profile_to_dict(profile)

    # Return default profile if none exists
    return {
        "username": username,
        "realname": "",
        "email": "",
        "debug": False,
        "api_key": None,
    }


def update_user_profile(
    username: str,
    realname: Optional[str] = None,
    email: Optional[str] = None,
    debug_mode: Optional[bool] = None,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """Update or create user profile.

    Args:
        username: Username to update profile for
        realname: Real name (optional)
        email: Email address (optional)
        debug_mode: Debug mode enabled (optional)
        api_key: API key (optional)

    Returns:
        Updated profile dictionary
    """
    existing = _profile_repo.get_by_username(username)
    now = datetime.utcnow()

    if existing:
        # Update existing profile
        update_kwargs = {}

        if realname is not None:
            update_kwargs["realname"] = realname
        if email is not None:
            update_kwargs["email"] = email
        if debug_mode is not None:
            update_kwargs["debug_mode"] = debug_mode
        if api_key is not None:
            update_kwargs["api_key"] = api_key

        update_kwargs["updated_at"] = now

        updated = _profile_repo.update(existing.id, **update_kwargs)
        return _profile_to_dict(updated)
    else:
        # Create new profile
        new_profile = _profile_repo.create(
            username=username,
            realname=realname or "",
            email=email or "",
            debug_mode=debug_mode if debug_mode is not None else False,
            api_key=api_key,
            created_at=now,
            updated_at=now,
        )
        return _profile_to_dict(new_profile)


def update_user_password(username: str, new_password: str) -> bool:
    """Update user password in credentials table."""
    import credentials_manager as cred_mgr

    try:
        # Find the user's credential
        credentials = cred_mgr.list_credentials(include_expired=False)
        user_cred = None

        for cred in credentials:
            if cred["username"] == username and cred["status"] == "active":
                user_cred = cred
                break

        if user_cred:
            # Update existing credential
            cred_mgr.update_credential(cred_id=user_cred["id"], password=new_password)
            return True
        else:
            # Create new credential if none exists
            cred_mgr.create_credential(
                name=f"{username} User Account",
                username=username,
                cred_type="generic",
                password=new_password,
                valid_until=None,
            )
            return True

    except Exception as e:
        print(f"Error updating password for {username}: {e}")
        return False


def delete_user_profile(username: str) -> bool:
    """Delete user profile by username.

    Args:
        username: Username whose profile to delete

    Returns:
        True if profile was deleted or didn't exist, False on error
    """
    try:
        return _profile_repo.delete_by_username(username)
    except Exception as e:
        print(f"Error deleting profile for {username}: {e}")
        return False
