"""
OIDC authentication router for OpenID Connect integration with multiple providers.
"""

from __future__ import annotations
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Union
from fastapi import APIRouter, HTTPException, status, Query
from models.auth import (
    LoginResponse,
    OIDCCallbackRequest,
    OIDCProvidersResponse,
    OIDCProvider,
    ApprovalPendingResponse,
    OIDCTestLoginRequest,
)
from core.auth import create_access_token
from services.auth.oidc import oidc_service
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
            allow_traditional_login=settings_manager.get_oidc_global_settings().get(
                "allow_traditional_login", True
            ),
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
    redirect_uri: str = Query(None, description="Optional redirect URI override"),
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


@router.post("/{provider_id}/test-login")
async def oidc_test_login(provider_id: str, test_params: OIDCTestLoginRequest):
    """
    Initiate OIDC authentication flow with custom test parameters.
    This endpoint allows overriding default configuration for testing purposes.
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

        logger.info(f"[OIDC Test] Initiating test login for provider '{provider_id}'")
        logger.info(f"[OIDC Test] Test parameters: {test_params.model_dump()}")

        # Generate authorization URL with test overrides
        auth_url = oidc_service.generate_authorization_url(
            provider_id=provider_id,
            config=config,
            state=state_with_provider,
            redirect_uri=test_params.redirect_uri,
            scopes_override=test_params.scopes,
            response_type_override=test_params.response_type,
            client_id_override=test_params.client_id,
        )

        return {
            "authorization_url": auth_url,
            "state": state_with_provider,
            "provider_id": provider_id,
            "test_mode": True,
            "overrides": {
                "redirect_uri": test_params.redirect_uri,
                "scopes": test_params.scopes,
                "response_type": test_params.response_type,
                "client_id": test_params.client_id,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"OIDC test login initiation failed for provider '{provider_id}': {e}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initiate OIDC test login with provider '{provider_id}'",
        )


@router.post(
    "/{provider_id}/callback",
    response_model=Union[LoginResponse, ApprovalPendingResponse],
)
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
        tokens = await oidc_service.exchange_code_for_tokens(
            provider_id, callback_data.code, callback_data.redirect_uri
        )

        id_token = tokens.get("id_token")
        if not id_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"No ID token received from OIDC provider '{provider_id}'",
            )

        # Verify and decode ID token
        claims = await oidc_service.verify_id_token(provider_id, id_token)

        # Extract user data from claims
        logger.debug("[OIDC Debug] Extracting user data from claims...")
        user_data = oidc_service.extract_user_data(provider_id, claims)

        # Provision or get existing user
        logger.debug("[OIDC Debug] Provisioning or retrieving user...")
        user, is_new_user = await oidc_service.provision_or_get_user(
            provider_id, user_data
        )

        # Check if user is inactive (new users awaiting approval)
        if not user.get("is_active", True):
            logger.info(
                f"[OIDC Debug] User '{user['username']}' created but awaiting admin approval from provider '{provider_id}'"
            )
            return ApprovalPendingResponse(
                status="approval_pending",
                message="Your account has been created but requires administrator approval before you can access the system.",
                username=user["username"],
                email=user.get("email"),
                oidc_provider=provider_id,
            )

        # Get user with RBAC roles and permissions
        logger.debug("[OIDC Debug] Fetching user RBAC roles and permissions...")
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

        # Determine primary role for legacy compatibility
        primary_role = "user"  # Default role
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

        # Create internal JWT token
        logger.debug("[OIDC Debug] Creating application access token...")
        access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
        access_token = create_access_token(
            data={
                "sub": user["username"],
                "user_id": user["id"],
                "permissions": user["permissions"],  # Legacy bitwise for token
                "oidc": True,  # Mark as OIDC authenticated
                "oidc_provider": provider_id,  # Track which provider was used
            },
            expires_delta=access_token_expires,
        )

        logger.info(
            f"[OIDC Debug] User '{user['username']}' authenticated successfully via OIDC provider '{provider_id}'"
        )

        # Log successful OIDC login to audit log
        from repositories.audit_log_repository import audit_log_repo

        audit_log_repo.create_log(
            username=user["username"],
            user_id=user["id"],
            event_type="login",
            message=f"User '{user['username']}' logged in via OIDC",
            resource_type="authentication",
            resource_id=str(user["id"]),
            resource_name=user["username"],
            severity="info",
            extra_data={
                "authentication_method": "oidc",
                "oidc_provider": provider_id,
                "roles": role_names,
                "is_new_user": is_new_user,
            },
        )

        # Build response user object with RBAC roles
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

        return LoginResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.access_token_expire_minutes * 60,
            user=response_user,
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


@router.get("/debug")
async def get_oidc_debug_info():
    """
    Get detailed debug information about OIDC configuration.
    This endpoint provides comprehensive configuration details for testing and troubleshooting.
    """
    try:
        oidc_enabled = settings_manager.is_oidc_enabled()
        global_settings = settings_manager.get_oidc_global_settings()

        providers_debug = []

        if oidc_enabled:
            enabled_providers = settings_manager.get_enabled_oidc_providers()

            for provider in enabled_providers:
                provider_id = provider["provider_id"]

                # Get full configuration
                try:
                    config = await oidc_service.get_oidc_config(provider_id)

                    # Validate configuration
                    issues = []
                    status_level = "ok"

                    if not provider.get("client_id"):
                        issues.append("Missing client_id")
                        status_level = "error"

                    if not provider.get("client_secret"):
                        issues.append("Missing client_secret")
                        status_level = "error"

                    if not config.authorization_endpoint:
                        issues.append("Missing authorization_endpoint")
                        status_level = "error"

                    if not config.token_endpoint:
                        issues.append("Missing token_endpoint")
                        status_level = "error"

                    if not config.jwks_uri:
                        issues.append("Missing jwks_uri")
                        status_level = "error"

                    # Check CA certificate if configured
                    ca_cert_path = provider.get("ca_cert_path")
                    ca_cert_exists = False
                    if ca_cert_path:
                        # Resolve path the same way as oidc_service does
                        ca_cert_file = Path(ca_cert_path)
                        if not ca_cert_file.is_absolute():
                            # Relative to project root (backend parent directory)
                            ca_cert_file = (
                                Path(__file__).parent.parent.parent / ca_cert_path
                            )

                        ca_cert_exists = ca_cert_file.exists()
                        if not ca_cert_exists:
                            issues.append(
                                f"CA certificate file not found: {ca_cert_path}"
                            )
                            status_level = (
                                "warning" if status_level == "ok" else status_level
                            )

                    # Get scopes from provider config (default to standard OIDC scopes)
                    scopes = provider.get("scopes", ["openid", "profile", "email"])

                    providers_debug.append(
                        {
                            "provider_id": provider_id,
                            "name": provider.get("name", provider_id),
                            "enabled": True,
                            "config": {
                                "client_id": provider.get("client_id", ""),
                                "authorization_endpoint": config.authorization_endpoint,
                                "token_endpoint": config.token_endpoint,
                                "userinfo_endpoint": config.userinfo_endpoint,
                                "jwks_uri": config.jwks_uri,
                                "issuer": config.issuer,
                                "ca_cert_path": ca_cert_path,
                                "ca_cert_exists": ca_cert_exists,
                                "scopes": scopes,
                                "response_type": "code",
                            },
                            "status": status_level,
                            "issues": issues,
                        }
                    )

                except Exception as e:
                    logger.error(
                        f"Failed to load configuration for provider '{provider_id}': {e}"
                    )
                    providers_debug.append(
                        {
                            "provider_id": provider_id,
                            "name": provider.get("name", provider_id),
                            "enabled": True,
                            "config": {},
                            "status": "error",
                            "issues": [f"Failed to load configuration: {str(e)}"],
                        }
                    )

        return {
            "oidc_enabled": oidc_enabled,
            "allow_traditional_login": global_settings.get(
                "allow_traditional_login", True
            ),
            "providers": providers_debug,
            "global_config": {
                "default_role": global_settings.get("default_role", "user"),
                "auto_create_users": global_settings.get("auto_create_users", True),
                "update_user_info": global_settings.get("update_user_info", True),
            },
            "timestamp": datetime.utcnow().isoformat(),
        }

    except Exception as e:
        logger.error(f"Failed to get OIDC debug info: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve OIDC debug information: {str(e)}",
        )
