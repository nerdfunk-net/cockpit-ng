"""
Authentication router for login and token management.
"""

from __future__ import annotations
import logging
from datetime import timedelta
from fastapi import APIRouter, HTTPException, status, Depends, Request
from models.auth import UserLogin, LoginResponse
from core.auth import create_access_token, get_api_key_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/login", response_model=LoginResponse)
async def login(user_data: UserLogin):
    """
    Authenticate user against new user database.
    """
    from config import settings
    from services.auth.user_management import authenticate_user
    import rbac_manager as rbac

    try:
        # Authenticate against new user database
        user = authenticate_user(user_data.username, user_data.password)

        if user:
            logger.info(f"Authenticated user {user['username']} (id={user['id']})")

            # Get user with RBAC roles
            user_with_roles = rbac.get_user_with_rbac(user["id"])

            if not user_with_roles:
                logger.warning(
                    f"get_user_with_rbac returned None for user_id={user['id']}, using base user"
                )
                user_with_roles = user
                user_with_roles["roles"] = []
                user_with_roles["permissions"] = []

            # Extract role names for the response
            role_names = [r["name"] for r in user_with_roles.get("roles", [])]

            # Set primary role (for legacy compatibility)
            # Priority: admin > operator > network_engineer > viewer > first role
            primary_role = None
            if "admin" in role_names:
                primary_role = "admin"
            elif "operator" in role_names:
                primary_role = "operator"
            elif "network_engineer" in role_names:
                primary_role = "network_engineer"
            elif "viewer" in role_names:
                primary_role = "viewer"
            elif role_names:
                primary_role = role_names[0]

            access_token_expires = timedelta(
                minutes=settings.access_token_expire_minutes
            )
            access_token = create_access_token(
                data={
                    "sub": user["username"],
                    "user_id": user["id"],
                    "permissions": user["permissions"],  # Legacy bitwise for token
                },
                expires_delta=access_token_expires,
            )

            # Build response user object
            response_user = {
                "id": user_with_roles["id"],
                "username": user_with_roles["username"],
                "realname": user_with_roles["realname"],
                "email": user_with_roles.get("email"),
                "role": primary_role,  # Legacy field for compatibility
                "roles": role_names,  # New RBAC roles array
                "permissions": user_with_roles.get(
                    "permissions", []
                ),  # New RBAC permissions
                "debug": user_with_roles.get("debug", False),
            }

            # Log successful login to audit log
            from repositories.audit_log_repository import audit_log_repo

            audit_log_repo.create_log(
                username=user["username"],
                user_id=user["id"],
                event_type="login",
                message=f"User '{user['username']}' logged in",
                resource_type="authentication",
                resource_id=str(user["id"]),
                resource_name=user["username"],
                severity="info",
                extra_data={
                    "authentication_method": "password",
                    "roles": role_names,
                },
            )

            return LoginResponse(
                access_token=access_token,
                token_type="bearer",
                expires_in=settings.access_token_expire_minutes * 60,
                user=response_user,
            )
    except Exception as e:
        # Log the error but don't expose it to the user
        logger.error(f"Authentication error for user {user_data.username}: {e}")

    # No valid authentication found
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid username or password",
        headers={"WWW-Authenticate": "Bearer"},
    )


@router.post("/refresh", response_model=LoginResponse)
async def refresh_token(request: Request):
    """Issue a new access token for the currently authenticated user.

    Accept expired access tokens for the purpose of refreshing, but always
    verify the token signature. This prevents race conditions where a token
    expires just before the refresh call.
    """
    from config import settings
    from services.auth.user_management import get_user_by_username
    import jwt as pyjwt

    # Extract Authorization header
    auth_header = request.headers.get("authorization") or request.headers.get(
        "Authorization"
    )
    if not auth_header or not auth_header.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = auth_header.split(" ", 1)[1].strip()

    try:
        # Decode token but do NOT verify expiration here; still verify signature.
        payload = pyjwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.algorithm],
            options={"verify_exp": False},
        )
        username = payload.get("sub")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except pyjwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        # Optional: enforce a small grace window (uncomment if desired)
        # exp = payload.get('exp', 0)
        # from time import time
        # if time() - exp > 3600:  # token expired more than 1 hour ago
        #     raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Token too old to refresh')

        # Get current user data from database
        user = get_user_by_username(username)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Get user with RBAC roles - same as login endpoint
        import rbac_manager as rbac

        user_with_roles = rbac.get_user_with_rbac(user["id"])

        if not user_with_roles:
            logger.warning(
                f"get_user_with_rbac returned None for user_id={user['id']}, using base user"
            )
            user_with_roles = user
            user_with_roles["roles"] = []
            user_with_roles["permissions"] = []

        # Extract role names for the response
        role_names = [r["name"] for r in user_with_roles.get("roles", [])]

        # Set primary role (for legacy compatibility)
        # Priority: admin > operator > network_engineer > viewer > first role
        primary_role = None
        if "admin" in role_names:
            primary_role = "admin"
        elif "operator" in role_names:
            primary_role = "operator"
        elif "network_engineer" in role_names:
            primary_role = "network_engineer"
        elif "viewer" in role_names:
            primary_role = "viewer"
        elif role_names:
            primary_role = role_names[0]

        access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
        access_token = create_access_token(
            data={
                "sub": user["username"],
                "user_id": user["id"],
                "permissions": user["permissions"],
            },
            expires_delta=access_token_expires,
        )

        return LoginResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.access_token_expire_minutes * 60,
            user={
                "id": user_with_roles["id"],
                "username": user_with_roles["username"],
                "realname": user_with_roles["realname"],
                "email": user_with_roles.get("email"),
                "role": primary_role,  # Legacy field for compatibility
                "roles": role_names,  # CRITICAL FIX: Include roles array for sidebar
                "permissions": user_with_roles.get(
                    "permissions", []
                ),  # New RBAC permissions
                "debug": user_with_roles.get("debug", False),
            },
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Token refresh failed for user {username}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token refresh failed",
            headers={"WWW-Authenticate": "Bearer"},
        )


@router.post("/api-key-login", response_model=LoginResponse)
async def api_key_login(user_info: dict = Depends(get_api_key_user)):
    """
    Authenticate using API key and return JWT token.
    This endpoint allows API key holders to get JWT tokens for accessing protected endpoints.
    """
    from config import settings

    try:
        # User is already authenticated via API key, now generate JWT token
        access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
        access_token = create_access_token(
            data={
                "sub": user_info["username"],
                "user_id": user_info["user_id"],
                "permissions": user_info["permissions"],
            },
            expires_delta=access_token_expires,
        )

        # Log API key login to audit log
        from repositories.audit_log_repository import audit_log_repo

        audit_log_repo.create_log(
            username=user_info["username"],
            user_id=user_info["user_id"],
            event_type="login",
            message=f"User '{user_info['username']}' logged in",
            resource_type="authentication",
            resource_id=str(user_info["user_id"]),
            resource_name=user_info["username"],
            severity="info",
            extra_data={
                "authentication_method": "api_key",
            },
        )

        return LoginResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.access_token_expire_minutes * 60,
            user={
                "id": user_info["user_id"],
                "username": user_info["username"],
                "realname": user_info.get("realname", ""),
                "role": "api_user",
                "permissions": user_info["permissions"],
                "debug": False,
            },
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate access token",
        )


@router.post("/logout")
async def logout(request: Request):
    """
    Log user logout event.

    This endpoint is called by the frontend when a user logs out.
    It logs the logout event to the audit log for tracking purposes.
    The actual token invalidation happens client-side by removing the token.
    """
    from config import settings
    import jwt as pyjwt

    # Try to get user info from token if available
    try:
        # Extract Authorization header
        auth_header = request.headers.get("authorization") or request.headers.get(
            "Authorization"
        )
        if auth_header and auth_header.lower().startswith("bearer "):
            token = auth_header.split(" ", 1)[1].strip()

            # Decode token to get user info
            payload = pyjwt.decode(
                token,
                settings.secret_key,
                algorithms=[settings.algorithm],
            )
            username = payload.get("sub")
            user_id = payload.get("user_id")

            if username:
                from repositories.audit_log_repository import audit_log_repo

                audit_log_repo.create_log(
                    username=username,
                    user_id=user_id,
                    event_type="logout",
                    message=f"User '{username}' logged out",
                    resource_type="authentication",
                    resource_id=str(user_id),
                    resource_name=username,
                    severity="info",
                )
    except Exception as e:
        # If we can't get user info, log generic logout
        logger.warning(f"Logout called but could not extract user info: {e}")

    return {"success": True, "message": "Logged out successfully"}
