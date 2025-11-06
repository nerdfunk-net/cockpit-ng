"""
OIDC authentication router for OpenID Connect integration with multiple providers.
"""

from __future__ import annotations
import logging
from datetime import timedelta
from typing import List, Union
from fastapi import APIRouter, HTTPException, status, Query, Response
from fastapi.responses import RedirectResponse
from models.auth import LoginResponse, OIDCCallbackRequest, OIDCProvidersResponse, OIDCProvider, ApprovalPendingResponse
from core.auth import create_access_token
from services.oidc_service import oidc_service
from settings_manager import settings_manager
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth/oidc", tags=["oidc-authentication"])


@router.get("/enabled")
async def check_oidc_enabled():
    """Check if OIDC authentication is enabled."""
    return {"enabled": settings_manager.is_oidc_enabled()}


@router.get("/providers", response_model=OIDCProvidersResponse)
async def get_oidc_providers():
    """Get list of available OIDC providers for login selection."""
    if not settings_manager.is_oidc_enabled():
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="OIDC authentication is not enabled",
        )

    try:
        enabled_providers = settings_manager.get_enabled_oidc_providers()
        
        # Return only user-facing information
        providers_list = [
            OIDCProvider(
                provider_id=provider["provider_id"],
                name=provider.get("name", provider["provider_id"]),
                description=provider.get("description", ""),
                icon=provider.get("icon", ""),
                display_order=provider.get("display_order", 999),
            )
            for provider in enabled_providers
        ]
        
        return OIDCProvidersResponse(
            providers=providers_list,
            allow_traditional_login=settings_manager.get_oidc_global_settings().get("allow_traditional_login", True),
        )

    except Exception as e:
        logger.error(f"Failed to get OIDC providers: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve OIDC providers",
        )


@router.get("/{provider_id}/login")
async def oidc_login(
    provider_id: str,
    redirect_uri: str = Query(None, description="Optional redirect URI override")
):
    """
    Initiate OIDC authentication flow with specific provider.
    Returns authorization URL for redirect.
    """
    if not settings_manager.is_oidc_enabled():
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="OIDC authentication is not enabled",
        )

    try:
        config = await oidc_service.get_oidc_config(provider_id)
        state = oidc_service.generate_state()
        
        # Include provider_id in state for callback validation
        state_with_provider = f"{provider_id}:{state}"

        # Generate authorization URL
        auth_url = oidc_service.generate_authorization_url(
            provider_id, config, state_with_provider, redirect_uri
        )

        return {
            "authorization_url": auth_url,
            "state": state_with_provider,
            "provider_id": provider_id,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OIDC login initiation failed for provider '{provider_id}': {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initiate OIDC login with provider '{provider_id}'",
        )


@router.post("/{provider_id}/callback", response_model=Union[LoginResponse, ApprovalPendingResponse])
async def oidc_callback(provider_id: str, callback_data: OIDCCallbackRequest):
    """
    Handle OIDC callback with authorization code for specific provider.
    Exchange code for tokens and authenticate user.
    """
    if not settings_manager.is_oidc_enabled():
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="OIDC authentication is not enabled",
        )

    try:
        # Validate state parameter includes correct provider_id
        if callback_data.state:
            state_parts = callback_data.state.split(":", 1)
            if len(state_parts) == 2:
                state_provider_id, _ = state_parts
                if state_provider_id != provider_id:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="State parameter provider mismatch",
                    )

        # Exchange authorization code for tokens
        tokens = await oidc_service.exchange_code_for_tokens(provider_id, callback_data.code)

        id_token = tokens.get("id_token")
        if not id_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"No ID token received from OIDC provider '{provider_id}'",
            )

        # Verify and decode ID token
        claims = await oidc_service.verify_id_token(provider_id, id_token)

        # Extract user data from claims
        logger.debug(f"[OIDC Debug] Extracting user data from claims...")
        user_data = oidc_service.extract_user_data(provider_id, claims)

        # Provision or get existing user
        logger.debug(f"[OIDC Debug] Provisioning or retrieving user...")
        user, is_new_user = await oidc_service.provision_or_get_user(provider_id, user_data)

        # Check if user is inactive (new users awaiting approval)
        if not user.get("is_active", True):
            logger.info(f"[OIDC Debug] User '{user['username']}' created but awaiting admin approval from provider '{provider_id}'")
            return ApprovalPendingResponse(
                status="approval_pending",
                message="Your account has been created but requires administrator approval before you can access the system.",
                username=user["username"],
                email=user.get("email"),
                oidc_provider=provider_id,
            )

        # Create internal JWT token
        logger.debug(f"[OIDC Debug] Creating application access token...")
        access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
        access_token = create_access_token(
            data={
                "sub": user["username"],
                "user_id": user["id"],
                "permissions": user["permissions"],
                "oidc": True,  # Mark as OIDC authenticated
                "oidc_provider": provider_id,  # Track which provider was used
            },
            expires_delta=access_token_expires,
        )
        
        logger.info(f"[OIDC Debug] User '{user['username']}' authenticated successfully via OIDC provider '{provider_id}'")

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
            oidc_provider=provider_id,  # Include which provider was used
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OIDC callback failed for provider '{provider_id}': {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"OIDC authentication failed with provider '{provider_id}'",
        )


@router.post("/{provider_id}/logout")
async def oidc_logout(provider_id: str, id_token_hint: str = Query(None)):
    """
    Handle OIDC logout for specific provider.
    Returns end session endpoint URL if available.
    """
    if not settings_manager.is_oidc_enabled():
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="OIDC authentication is not enabled",
        )

    try:
        config = await oidc_service.get_oidc_config(provider_id)

        if config.end_session_endpoint:
            # Build logout URL with optional ID token hint
            logout_url = config.end_session_endpoint
            if id_token_hint:
                logout_url += f"?id_token_hint={id_token_hint}"

            return {
                "logout_url": logout_url,
                "requires_redirect": True,
                "provider_id": provider_id,
            }
        else:
            return {
                "logout_url": None,
                "requires_redirect": False,
                "message": f"OIDC provider '{provider_id}' does not support end_session_endpoint",
                "provider_id": provider_id,
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OIDC logout failed for provider '{provider_id}': {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process OIDC logout for provider '{provider_id}'",
        )
