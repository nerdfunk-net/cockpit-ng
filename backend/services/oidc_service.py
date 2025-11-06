"""
OIDC authentication service for handling OpenID Connect flows.
"""

from __future__ import annotations
import logging
import secrets
from typing import Dict, Any, Optional
from datetime import datetime, timedelta, timezone
import httpx
from jose import jwt, JWTError
from fastapi import HTTPException, status
from config import settings
from models.auth import OIDCConfig

logger = logging.getLogger(__name__)


class OIDCService:
    """Service for OIDC authentication operations."""

    def __init__(self):
        self._config: Optional[OIDCConfig] = None
        self._jwks_cache: Optional[Dict[str, Any]] = None
        self._jwks_cache_time: Optional[datetime] = None
        self._jwks_cache_ttl = timedelta(hours=1)

    async def get_oidc_config(self) -> OIDCConfig:
        """Fetch OIDC configuration from discovery endpoint."""
        if not settings.oidc_enabled:
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail="OIDC authentication is not enabled",
            )

        if not settings.oidc_discovery_url:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="OIDC discovery URL not configured",
            )

        # Return cached config if available
        if self._config:
            return self._config

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    settings.oidc_discovery_url, timeout=10.0
                )
                response.raise_for_status()
                config_data = response.json()

            self._config = OIDCConfig(**config_data)
            logger.info(f"Loaded OIDC config from {settings.oidc_discovery_url}")
            return self._config

        except httpx.HTTPError as e:
            logger.error(f"Failed to fetch OIDC configuration: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Unable to connect to OIDC provider",
            )
        except Exception as e:
            logger.error(f"Error parsing OIDC configuration: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Invalid OIDC provider configuration",
            )

    def generate_state(self) -> str:
        """Generate a secure random state parameter for CSRF protection."""
        return secrets.token_urlsafe(32)

    def generate_authorization_url(
        self, config: OIDCConfig, state: str, redirect_uri: Optional[str] = None
    ) -> str:
        """Generate the authorization URL for OIDC login."""
        redirect = redirect_uri or settings.oidc_redirect_uri
        scopes = " ".join(settings.oidc_scopes)

        params = {
            "client_id": settings.oidc_client_id,
            "response_type": "code",
            "scope": scopes,
            "redirect_uri": redirect,
            "state": state,
        }

        # Build query string
        query_params = "&".join(f"{k}={httpx.URL('').copy_with(params={k: v}).params[k]}" for k, v in params.items())
        return f"{config.authorization_endpoint}?{query_params}"

    async def exchange_code_for_tokens(
        self, code: str, redirect_uri: Optional[str] = None
    ) -> Dict[str, Any]:
        """Exchange authorization code for tokens."""
        config = await self.get_oidc_config()
        redirect = redirect_uri or settings.oidc_redirect_uri

        token_data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect,
            "client_id": settings.oidc_client_id,
            "client_secret": settings.oidc_client_secret,
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    config.token_endpoint,
                    data=token_data,
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                    timeout=10.0,
                )
                response.raise_for_status()
                return response.json()

        except httpx.HTTPError as e:
            logger.error(f"Token exchange failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Failed to exchange authorization code for tokens",
            )

    async def get_jwks(self) -> Dict[str, Any]:
        """Fetch and cache JWKS from the OIDC provider."""
        # Return cached JWKS if still valid
        if (
            self._jwks_cache
            and self._jwks_cache_time
            and datetime.now(timezone.utc) - self._jwks_cache_time < self._jwks_cache_ttl
        ):
            return self._jwks_cache

        config = await self.get_oidc_config()

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(config.jwks_uri, timeout=10.0)
                response.raise_for_status()
                jwks = response.json()

            self._jwks_cache = jwks
            self._jwks_cache_time = datetime.now(timezone.utc)
            logger.debug("JWKS cache updated")
            return jwks

        except httpx.HTTPError as e:
            logger.error(f"Failed to fetch JWKS: {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Unable to fetch OIDC signing keys",
            )

    async def verify_id_token(self, id_token: str) -> Dict[str, Any]:
        """Verify and decode ID token from OIDC provider."""
        config = await self.get_oidc_config()
        jwks = await self.get_jwks()

        try:
            # Decode header to get kid
            unverified_header = jwt.get_unverified_header(id_token)
            kid = unverified_header.get("kid")

            # Find matching key in JWKS
            key = None
            for jwk_key in jwks.get("keys", []):
                if jwk_key.get("kid") == kid:
                    key = jwk_key
                    break

            if not key:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Unable to find matching signing key",
                )

            # Verify and decode token
            # Note: We disable access_token validation since at_hash is optional
            # and we're not using it for additional validation
            claims = jwt.decode(
                id_token,
                key,
                algorithms=["RS256", "RS384", "RS512"],
                audience=settings.oidc_client_id,
                issuer=config.issuer,
                options={
                    "verify_at_hash": False  # Disable at_hash validation
                }
            )

            return claims

        except JWTError as e:
            logger.error(f"ID token verification failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid ID token",
            )

    async def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """Fetch user information from the userinfo endpoint."""
        config = await self.get_oidc_config()

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    config.userinfo_endpoint,
                    headers={"Authorization": f"Bearer {access_token}"},
                    timeout=10.0,
                )
                response.raise_for_status()
                return response.json()

        except httpx.HTTPError as e:
            logger.error(f"Failed to fetch user info: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Failed to fetch user information",
            )

    def extract_user_data(self, claims: Dict[str, Any]) -> Dict[str, Any]:
        """Extract user data from OIDC claims."""
        # Log available claims for debugging
        logger.debug(f"Available claims in ID token: {list(claims.keys())}")
        logger.debug(f"Looking for username claim: '{settings.oidc_claim_username}'")

        username = claims.get(settings.oidc_claim_username)
        email = claims.get(settings.oidc_claim_email)
        name = claims.get(settings.oidc_claim_name, username)

        if not username:
            logger.error(f"Username claim '{settings.oidc_claim_username}' not found in token")
            logger.error(f"Available claims: {claims}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Username claim '{settings.oidc_claim_username}' not found in token",
            )

        logger.info(f"Extracted user data: username={username}, email={email}, name={name}")

        return {
            "username": username,
            "email": email,
            "realname": name,
            "sub": claims.get("sub"),
        }

    async def provision_or_get_user(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        """Provision a new user or get existing user from OIDC data."""
        from services.user_management import (
            get_user_by_username,
            create_user,
            update_user,
        )
        from models.user_management import UserRole

        username = user_data["username"]
        user = get_user_by_username(username)

        if user:
            # Update user information if changed
            updates = {}
            if user_data.get("email") and user.get("email") != user_data["email"]:
                updates["email"] = user_data["email"]
            if user_data.get("realname") and user.get("realname") != user_data["realname"]:
                updates["realname"] = user_data["realname"]

            if updates:
                user = update_user(user["id"], **updates)
                logger.info(f"Updated OIDC user: {username}")

            return user

        # Create new user if auto-provisioning is enabled
        if not settings.oidc_auto_provision:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User does not exist and auto-provisioning is disabled",
            )

        try:
            # Generate a random password (won't be used for OIDC login)
            random_password = secrets.token_urlsafe(32)

            user = create_user(
                username=username,
                realname=user_data.get("realname", username),
                password=random_password,
                email=user_data.get("email"),
                role=UserRole.user,  # Default role for OIDC users
                debug=False,
            )

            logger.info(f"Auto-provisioned new OIDC user: {username}")
            return user

        except Exception as e:
            logger.error(f"Failed to provision OIDC user: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to provision user account",
            )


# Global OIDC service instance
oidc_service = OIDCService()
