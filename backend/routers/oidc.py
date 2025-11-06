"""
OIDC authentication router for OpenID Connect integration.
"""

from __future__ import annotations
import logging
from datetime import timedelta
from fastapi import APIRouter, HTTPException, status, Query, Response
from fastapi.responses import RedirectResponse
from models.auth import LoginResponse, OIDCCallbackRequest
from core.auth import create_access_token
from services.oidc_service import oidc_service
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth/oidc", tags=["oidc-authentication"])


@router.get("/enabled")
async def check_oidc_enabled():
    """Check if OIDC authentication is enabled."""
    return {"enabled": settings.oidc_enabled}


@router.get("/login")
async def oidc_login(
    redirect_uri: str = Query(None, description="Optional redirect URI override")
):
    """
    Initiate OIDC authentication flow.
    Returns authorization URL for redirect.
    """
    if not settings.oidc_enabled:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="OIDC authentication is not enabled",
        )

    try:
        config = await oidc_service.get_oidc_config()
        state = oidc_service.generate_state()

        # Generate authorization URL
        auth_url = oidc_service.generate_authorization_url(
            config, state, redirect_uri
        )

        return {
            "authorization_url": auth_url,
            "state": state,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OIDC login initiation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initiate OIDC login",
        )


@router.post("/callback", response_model=LoginResponse)
async def oidc_callback(callback_data: OIDCCallbackRequest):
    """
    Handle OIDC callback with authorization code.
    Exchange code for tokens and authenticate user.
    """
    if not settings.oidc_enabled:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="OIDC authentication is not enabled",
        )

    try:
        # Exchange authorization code for tokens
        tokens = await oidc_service.exchange_code_for_tokens(callback_data.code)

        id_token = tokens.get("id_token")
        if not id_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="No ID token received from OIDC provider",
            )

        # Verify and decode ID token
        claims = await oidc_service.verify_id_token(id_token)

        # Extract user data from claims
        user_data = oidc_service.extract_user_data(claims)

        # Provision or get existing user
        user = await oidc_service.provision_or_get_user(user_data)

        # Create internal JWT token
        access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
        access_token = create_access_token(
            data={
                "sub": user["username"],
                "user_id": user["id"],
                "permissions": user["permissions"],
                "oidc": True,  # Mark as OIDC authenticated
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
                "debug": user.get("debug", False),
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OIDC callback failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="OIDC authentication failed",
        )


@router.post("/logout")
async def oidc_logout(id_token_hint: str = Query(None)):
    """
    Handle OIDC logout.
    Returns end session endpoint URL if available.
    """
    if not settings.oidc_enabled:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="OIDC authentication is not enabled",
        )

    try:
        config = await oidc_service.get_oidc_config()

        if config.end_session_endpoint:
            # Build logout URL with optional ID token hint
            logout_url = config.end_session_endpoint
            if id_token_hint:
                logout_url += f"?id_token_hint={id_token_hint}"

            return {
                "logout_url": logout_url,
                "requires_redirect": True,
            }
        else:
            return {
                "logout_url": None,
                "requires_redirect": False,
                "message": "OIDC provider does not support end_session_endpoint",
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OIDC logout failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process OIDC logout",
        )
