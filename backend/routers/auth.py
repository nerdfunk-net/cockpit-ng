"""
Authentication router for login and token management.
"""

from __future__ import annotations
import logging
from datetime import timedelta
from fastapi import APIRouter, HTTPException, status, Depends, Request
from models.auth import UserLogin, LoginResponse
from core.auth import create_access_token, get_current_username, get_api_key_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/login", response_model=LoginResponse)
async def login(user_data: UserLogin):
    """
    Authenticate user against new user database.
    """
    from config import settings
    from services.user_management import authenticate_user

    try:
        # Authenticate against new user database
        user = authenticate_user(user_data.username, user_data.password)

        if user:
            access_token_expires = timedelta(
                minutes=settings.access_token_expire_minutes
            )
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
                    "id": user["id"],
                    "username": user["username"],
                    "realname": user["realname"],
                    "role": user["role"],
                    "permissions": user["permissions"],
                    "debug": user["debug"],
                },
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
    from services.user_management import get_user_by_username
    import jwt as pyjwt

    # Extract Authorization header
    auth_header = request.headers.get('authorization') or request.headers.get('Authorization')
    if not auth_header or not auth_header.lower().startswith('bearer '):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = auth_header.split(' ', 1)[1].strip()

    try:
        # Decode token but do NOT verify expiration here; still verify signature.
        payload = pyjwt.decode(token, settings.secret_key, algorithms=[settings.algorithm], options={"verify_exp": False})
        username = payload.get('sub')
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
                "id": user["id"],
                "username": user["username"],
                "realname": user["realname"],
                "role": user["role"],
                "permissions": user["permissions"],
                "debug": user["debug"],
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
