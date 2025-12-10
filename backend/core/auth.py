"""
Core authentication functions and dependencies.
"""

from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from passlib.hash import pbkdf2_sha256


# Security setup
security = HTTPBearer()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token."""
    from config import settings

    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode, settings.secret_key, algorithm=settings.algorithm
    )
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash."""
    return pbkdf2_sha256.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Get password hash."""
    return pbkdf2_sha256.hash(password)


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Verify JWT token and return user info."""
    from config import settings

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.secret_key,
            algorithms=[settings.algorithm],
        )
        username: str = payload.get("sub")
        user_id: int = payload.get("user_id")
        permissions: int = payload.get("permissions", 0)

        if username is None:
            raise credentials_exception

        return {"username": username, "user_id": user_id, "permissions": permissions}
    except jwt.InvalidTokenError:
        raise credentials_exception


def verify_admin_token(user_info: dict = Depends(verify_token)) -> dict:
    """Verify token and ensure user has admin permissions."""
    from user_db_manager import PERMISSIONS_ADMIN

    # Check if user has full admin permissions (exact match)
    user_permissions = user_info["permissions"]
    if user_permissions != PERMISSIONS_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required"
        )

    return user_info


def verify_api_key(x_api_key: Optional[str] = None) -> dict:
    """Verify API key and return user info."""

    if not x_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    # Search for user with matching API key
    import sqlite3
    from config import settings as config_settings
    import os

    db_path = os.path.join(
        config_settings.data_directory, "settings", "cockpit_settings.db"
    )

    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row

        user_row = conn.execute(
            "SELECT username FROM user_profiles WHERE api_key = ? AND api_key IS NOT NULL",
            (x_api_key,),
        ).fetchone()

        conn.close()

        if not user_row:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key",
                headers={"WWW-Authenticate": "ApiKey"},
            )

        # Get user details from user management system
        from services.user_management import get_user_by_username

        user = get_user_by_username(user_row["username"])

        if not user or not user.get("is_active", False):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account inactive",
                headers={"WWW-Authenticate": "ApiKey"},
            )

        return {
            "username": user["username"],
            "user_id": user["id"],
            "permissions": user["permissions"],
        }

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication error",
        )


def get_api_key_user(x_api_key: str = Header(None, alias="X-Api-Key")) -> dict:
    """Dependency to get user info from API key header."""
    return verify_api_key(x_api_key)


# Backward compatibility function for existing code
def get_current_username(user_info: dict = Depends(verify_token)) -> str:
    """Extract username from user info for backward compatibility."""
    return user_info["username"]


# ============================================================================
# RBAC Permission Checking
# ============================================================================


def require_permission(resource: str, action: str):
    """Dependency to require a specific permission.

    Usage:
        @app.get("/api/devices", dependencies=[Depends(require_permission("nautobot.devices", "read"))])
        def get_devices():
            ...
    """

    def permission_checker(user_info: dict = Depends(verify_token)) -> dict:
        import rbac_manager as rbac

        user_id = user_info.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found in token",
            )

        if not rbac.has_permission(user_id, resource, action):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {resource}:{action} required",
            )

        return user_info

    return permission_checker


def require_any_permission(resource: str, actions: list):
    """Dependency to require ANY of the specified permissions.

    Usage:
        @app.get("/api/devices", dependencies=[Depends(require_any_permission("nautobot.devices", ["read", "write"]))])
        def get_devices():
            ...
    """

    def permission_checker(user_info: dict = Depends(verify_token)) -> dict:
        import rbac_manager as rbac

        user_id = user_info.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found in token",
            )

        if not rbac.check_any_permission(user_id, resource, actions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: One of {resource}:{actions} required",
            )

        return user_info

    return permission_checker


def require_all_permissions(resource: str, actions: list):
    """Dependency to require ALL of the specified permissions.

    Usage:
        @app.get("/api/devices", dependencies=[Depends(require_all_permissions("nautobot.devices", ["read", "write"]))])
        def manage_devices():
            ...
    """

    def permission_checker(user_info: dict = Depends(verify_token)) -> dict:
        import rbac_manager as rbac

        user_id = user_info.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found in token",
            )

        if not rbac.check_all_permissions(user_id, resource, actions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: All of {resource}:{actions} required",
            )

        return user_info

    return permission_checker


def require_role(role_name: str):
    """Dependency to require a specific role.

    Usage:
        @app.get("/api/admin", dependencies=[Depends(require_role("admin"))])
        def admin_endpoint():
            ...
    """

    def role_checker(user_info: dict = Depends(verify_token)) -> dict:
        import rbac_manager as rbac

        user_id = user_info.get("user_id")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User ID not found in token",
            )

        user_roles = rbac.get_user_roles(user_id)
        role_names = [role["name"] for role in user_roles]

        if role_name not in role_names:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{role_name}' required",
            )

        return user_info

    return role_checker


def has_permission_check(user_id: int, resource: str, action: str) -> bool:
    """Helper function to check permission (non-dependency version)."""
    import rbac_manager as rbac

    return rbac.has_permission(user_id, resource, action)
