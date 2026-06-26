"""User profile service — manages UserProfile records in PostgreSQL."""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from core.api_keys import hash_api_key
from core.models import UserProfile
from repositories import ProfileRepository
from utils.time import utc_now_naive

logger = logging.getLogger(__name__)

_profile_repo = ProfileRepository()


def _profile_to_dict(profile: UserProfile) -> Dict[str, Any]:
    return {
        "id": profile.id,
        "username": profile.username,
        "realname": profile.realname,
        "email": profile.email,
        "debug": profile.debug_mode,
        # Only the sha256 digest is stored, so expose presence, not the value.
        "api_key_set": bool(profile.api_key),
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
        "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
    }


def get_user_profile(username: str) -> Optional[Dict[str, Any]]:
    profile = _profile_repo.get_by_username(username)
    if profile:
        return _profile_to_dict(profile)
    return {
        "username": username,
        "realname": "",
        "email": "",
        "debug": False,
        "api_key_set": False,
    }


def update_user_profile(
    username: str,
    realname: Optional[str] = None,
    email: Optional[str] = None,
    debug_mode: Optional[bool] = None,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    existing = _profile_repo.get_by_username(username)
    # Naive UTC for DB columns (same pattern as credentials_service)
    now = utc_now_naive()
    if existing:
        update_kwargs: Dict[str, Any] = {"updated_at": now}
        if realname is not None:
            update_kwargs["realname"] = realname
        if email is not None:
            update_kwargs["email"] = email
        if debug_mode is not None:
            update_kwargs["debug_mode"] = debug_mode
        if api_key is not None:
            # Empty string clears the key; otherwise store only the hash.
            update_kwargs["api_key"] = hash_api_key(api_key) if api_key else ""
        updated = _profile_repo.update(existing.id, **update_kwargs)
        return _profile_to_dict(updated)
    new_profile = _profile_repo.create(
        username=username,
        realname=realname or "",
        email=email or "",
        debug_mode=debug_mode if debug_mode is not None else False,
        api_key=hash_api_key(api_key) if api_key else api_key,
        created_at=now,
        updated_at=now,
    )
    return _profile_to_dict(new_profile)


def update_user_password(username: str, new_password: str) -> bool:
    """Update user password via CredentialsService."""
    import service_factory

    cred_mgr = service_factory.build_credentials_service()

    try:
        credentials = cred_mgr.list_credentials(include_expired=False)
        user_cred = next(
            (
                c
                for c in credentials
                if c["username"] == username and c["status"] == "active"
            ),
            None,
        )
        if user_cred:
            cred_mgr.update_credential(cred_id=user_cred["id"], password=new_password)
        else:
            cred_mgr.create_credential(
                name=f"{username} User Account",
                username=username,
                cred_type="generic",
                password=new_password,
                valid_until=None,
            )
        return True
    except Exception as e:
        logger.error("Error updating password for %s: %s", username, e)
        return False


def get_dashboard_layout(username: str) -> Optional[Dict[str, Any]]:
    return _profile_repo.get_dashboard_layout(username)


def update_dashboard_layout(username: str, layout: Dict[str, Any]) -> Dict[str, Any]:
    return _profile_repo.set_dashboard_layout(username, layout)


def delete_user_profile(username: str) -> bool:
    try:
        return _profile_repo.delete_by_username(username)
    except Exception as e:
        logger.error("Error deleting profile for %s: %s", username, e)
        return False
