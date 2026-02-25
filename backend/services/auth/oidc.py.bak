"""
OIDC authentication service for handling OpenID Connect flows.
"""

from __future__ import annotations
import logging
import secrets
import ssl
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime, timedelta, timezone
import httpx
from jose import jwt, JWTError
from fastapi import HTTPException, status
from models.auth import OIDCConfig
from settings_manager import settings_manager

logger = logging.getLogger(__name__)


class OIDCService:
    """Service for OIDC authentication operations supporting multiple providers."""

    def __init__(self):
        # Cache per provider: {provider_id: config}
        self._configs: Dict[str, OIDCConfig] = {}
        # JWKS cache per provider: {provider_id: jwks}
        self._jwks_caches: Dict[str, Dict[str, Any]] = {}
        # JWKS cache time per provider: {provider_id: datetime}
        self._jwks_cache_times: Dict[str, datetime] = {}
        self._jwks_cache_ttl = timedelta(hours=1)
        # SSL context cache per provider
        self._ssl_contexts: Dict[str, ssl.SSLContext] = {}

    def _get_ssl_context(self, provider_id: str) -> Optional[ssl.SSLContext]:
        """Get or create SSL context with custom CA certificate for the provider."""
        # Return cached SSL context if available
        if provider_id in self._ssl_contexts:
            return self._ssl_contexts[provider_id]

        # Get provider configuration
        provider_config = settings_manager.get_oidc_provider(provider_id)
        if not provider_config:
            return None

        ca_cert_path = provider_config.get("ca_cert_path")
        if not ca_cert_path:
            logger.debug(
                f"No custom CA certificate configured for provider '{provider_id}'"
            )
            return None

        # Resolve the CA certificate path
        ca_cert_file = Path(ca_cert_path)
        if not ca_cert_file.is_absolute():
            # Relative to project root
            ca_cert_file = Path(__file__).parent.parent.parent / ca_cert_path

        if not ca_cert_file.exists():
            logger.warning(
                f"CA certificate not found for provider '{provider_id}': {ca_cert_file}"
            )
            return None

        try:
            # Create SSL context with custom CA certificate
            ssl_context = ssl.create_default_context()
            ssl_context.load_verify_locations(cafile=str(ca_cert_file))

            self._ssl_contexts[provider_id] = ssl_context
            logger.info(
                f"Loaded custom CA certificate for provider '{provider_id}': {ca_cert_file}"
            )
            return ssl_context
        except Exception as e:
            logger.error(
                f"Failed to load CA certificate for provider '{provider_id}': {e}"
            )
            return None

    def _sanitize_token_response(
        self, token_response: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Sanitize token response for logging by masking sensitive tokens."""
        sanitized = token_response.copy()

        # Mask sensitive fields but show first/last few characters for debugging
        sensitive_fields = ["access_token", "refresh_token", "id_token"]
        for field in sensitive_fields:
            if field in sanitized and sanitized[field]:
                token = sanitized[field]
                if len(token) > 20:
                    sanitized[field] = f"{token[:10]}...{token[-10:]}"
                else:
                    sanitized[field] = "***MASKED***"

        return sanitized

    async def get_oidc_config(self, provider_id: str) -> OIDCConfig:
        """Fetch OIDC configuration from discovery endpoint for specific provider."""
        # Check if any OIDC providers are enabled
        if not settings_manager.is_oidc_enabled():
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail="OIDC authentication is not enabled",
            )

        # Get provider configuration
        provider_config = settings_manager.get_oidc_provider(provider_id)
        if not provider_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"OIDC provider '{provider_id}' not found",
            )

        if not provider_config.get("enabled", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"OIDC provider '{provider_id}' is not enabled",
            )

        discovery_url = provider_config.get("discovery_url")
        if not discovery_url:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"OIDC discovery URL not configured for provider '{provider_id}'",
            )

        # Return cached config if available
        if provider_id in self._configs:
            return self._configs[provider_id]

        try:
            # Get SSL context for custom CA certificates
            ssl_context = self._get_ssl_context(provider_id)

            # Create httpx client with custom SSL context if available
            client_kwargs = {"timeout": 10.0}
            if ssl_context:
                client_kwargs["verify"] = ssl_context
                logger.debug(
                    f"Using custom CA certificate for provider '{provider_id}'"
                )

            async with httpx.AsyncClient(**client_kwargs) as client:
                response = await client.get(discovery_url)
                response.raise_for_status()
                config_data = response.json()

            config = OIDCConfig(**config_data)
            self._configs[provider_id] = config
            logger.info(
                f"Loaded OIDC config for provider '{provider_id}' from {discovery_url}"
            )
            return config

        except httpx.HTTPError as e:
            logger.error(f"Failed to fetch OIDC configuration for '{provider_id}': {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Unable to connect to OIDC provider '{provider_id}'",
            )
        except Exception as e:
            logger.error(f"Error parsing OIDC configuration for '{provider_id}': {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Invalid OIDC provider configuration for '{provider_id}'",
            )

    def generate_state(self) -> str:
        """Generate a secure random state parameter for CSRF protection."""
        return secrets.token_urlsafe(32)

    def generate_authorization_url(
        self,
        provider_id: str,
        config: OIDCConfig,
        state: str,
        redirect_uri: Optional[str] = None,
        scopes_override: Optional[list] = None,
        response_type_override: Optional[str] = None,
        client_id_override: Optional[str] = None,
    ) -> str:
        """Generate the authorization URL for OIDC login."""
        # Get provider configuration
        provider_config = settings_manager.get_oidc_provider(provider_id)
        if not provider_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"OIDC provider '{provider_id}' not found",
            )

        # Use provider-specific settings or overrides (for testing)
        client_id = (
            client_id_override
            if client_id_override
            else provider_config.get("client_id")
        )
        if not client_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"OIDC provider '{provider_id}' missing required 'client_id' in configuration",
            )

        scopes = (
            scopes_override
            if scopes_override
            else provider_config.get("scopes", ["openid", "profile", "email"])
        )
        response_type = response_type_override if response_type_override else "code"

        # Use provider redirect_uri or raise error if not specified
        if not redirect_uri:
            redirect_uri = provider_config.get("redirect_uri")
            if not redirect_uri:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"OIDC provider '{provider_id}' missing required 'redirect_uri' in configuration",
                )

        scopes_str = " ".join(scopes)

        # Log overrides for debugging
        if any([client_id_override, scopes_override, response_type_override]):
            logger.info(
                f"[OIDC Test] Generating authorization URL with overrides for '{provider_id}'"
            )
            if client_id_override:
                logger.info(f"[OIDC Test] - client_id overridden: {client_id_override}")
            if scopes_override:
                logger.info(
                    f"[OIDC Test] - scopes overridden: {', '.join(scopes_override)}"
                )
            if response_type_override:
                logger.info(
                    f"[OIDC Test] - response_type overridden: {response_type_override}"
                )

        params = {
            "client_id": client_id,
            "response_type": response_type,
            "scope": scopes_str,
            "redirect_uri": redirect_uri,
            "state": state,
        }

        # Build query string
        query_params = "&".join(
            f"{k}={httpx.URL('').copy_with(params={k: v}).params[k]}"
            for k, v in params.items()
        )
        return f"{config.authorization_endpoint}?{query_params}"

    async def exchange_code_for_tokens(
        self, provider_id: str, code: str, redirect_uri: Optional[str] = None
    ) -> Dict[str, Any]:
        """Exchange authorization code for tokens."""
        config = await self.get_oidc_config(provider_id)

        # Get provider configuration
        provider_config = settings_manager.get_oidc_provider(provider_id)
        if not provider_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"OIDC provider '{provider_id}' not found",
            )

        # Use provider-specific settings
        client_id = provider_config.get("client_id")
        if not client_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"OIDC provider '{provider_id}' missing required 'client_id' in configuration",
            )

        client_secret = provider_config.get("client_secret")
        if not client_secret:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"OIDC provider '{provider_id}' missing required 'client_secret' in configuration",
            )

        # Use provider redirect_uri or raise error if not specified
        if not redirect_uri:
            redirect_uri = provider_config.get("redirect_uri")
            if not redirect_uri:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"OIDC provider '{provider_id}' missing required 'redirect_uri' in configuration",
                )

        token_data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": client_id,
            "client_secret": client_secret,
        }

        # Debug logging: Log token request (sanitized)
        sanitized_request = token_data.copy()
        if "client_secret" in sanitized_request:
            sanitized_request["client_secret"] = "***MASKED***"
        if "code" in sanitized_request and len(sanitized_request["code"]) > 20:
            sanitized_request["code"] = (
                f"{sanitized_request['code'][:10]}...{sanitized_request['code'][-10:]}"
            )
        logger.debug(f"Token request to provider '{provider_id}': {sanitized_request}")
        logger.debug(f"Token endpoint URL: {config.token_endpoint}")

        try:
            # Get SSL context for custom CA certificates
            ssl_context = self._get_ssl_context(provider_id)

            # Create httpx client with custom SSL context if available
            client_kwargs = {"timeout": 10.0}
            if ssl_context:
                client_kwargs["verify"] = ssl_context

            async with httpx.AsyncClient(**client_kwargs) as client:
                response = await client.post(
                    config.token_endpoint,
                    data=token_data,
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                )

                # Debug logging: Log response status and headers
                logger.debug(
                    f"Token endpoint response status from provider '{provider_id}': {response.status_code}"
                )
                logger.debug(
                    f"Token endpoint response headers from provider '{provider_id}': {dict(response.headers)}"
                )

                response.raise_for_status()
                token_response = response.json()

                # Debug logging: Log the token response (sanitized)
                logger.debug(
                    f"Token response from provider '{provider_id}': {self._sanitize_token_response(token_response)}"
                )

                return token_response

        except httpx.HTTPError as e:
            logger.error(f"Token exchange failed for provider '{provider_id}': {e}")
            if hasattr(e, "response") and e.response is not None:
                logger.error(f"Error response status: {e.response.status_code}")
                logger.error(f"Error response body: {e.response.text}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Failed to exchange authorization code for tokens with provider '{provider_id}'",
            )

    async def get_jwks(self, provider_id: str) -> Dict[str, Any]:
        """Fetch and cache JWKS from the OIDC provider."""
        # Return cached JWKS if still valid
        if (
            provider_id in self._jwks_caches
            and provider_id in self._jwks_cache_times
            and datetime.now(timezone.utc) - self._jwks_cache_times[provider_id]
            < self._jwks_cache_ttl
        ):
            return self._jwks_caches[provider_id]

        config = await self.get_oidc_config(provider_id)

        try:
            # Get SSL context for custom CA certificates
            ssl_context = self._get_ssl_context(provider_id)

            # Create httpx client with custom SSL context if available
            client_kwargs = {"timeout": 10.0}
            if ssl_context:
                client_kwargs["verify"] = ssl_context

            async with httpx.AsyncClient(**client_kwargs) as client:
                response = await client.get(config.jwks_uri)
                response.raise_for_status()
                jwks = response.json()

            self._jwks_caches[provider_id] = jwks
            self._jwks_cache_times[provider_id] = datetime.now(timezone.utc)
            logger.debug(f"JWKS cache updated for provider '{provider_id}'")
            return jwks

        except httpx.HTTPError as e:
            logger.error(f"Failed to fetch JWKS for provider '{provider_id}': {e}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Unable to fetch OIDC signing keys from provider '{provider_id}'",
            )

    async def verify_id_token(self, provider_id: str, id_token: str) -> Dict[str, Any]:
        """Verify and decode ID token from OIDC provider."""
        logger.debug(f"[OIDC Debug] Verifying ID token for provider '{provider_id}'")

        config = await self.get_oidc_config(provider_id)
        jwks = await self.get_jwks(provider_id)

        # Get provider configuration
        provider_config = settings_manager.get_oidc_provider(provider_id)
        if not provider_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"OIDC provider '{provider_id}' not found",
            )

        client_id = provider_config.get("client_id")
        if not client_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"OIDC provider '{provider_id}' missing required 'client_id' in configuration",
            )

        logger.debug(f"[OIDC Debug] Issuer: {config.issuer}")
        logger.debug(f"[OIDC Debug] Client ID (audience): {client_id}")

        try:
            # Decode header to get kid
            unverified_header = jwt.get_unverified_header(id_token)
            algorithm = unverified_header.get("alg")
            kid = unverified_header.get("kid")

            logger.debug(f"[OIDC Debug] ID token algorithm: {algorithm}")
            logger.debug(f"[OIDC Debug] ID token key ID (kid): {kid}")

            # Find matching key in JWKS
            key = None
            for jwk_key in jwks.get("keys", []):
                if jwk_key.get("kid") == kid:
                    key = jwk_key
                    break

            if not key:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=f"Unable to find matching signing key for provider '{provider_id}'",
                )

            logger.debug("[OIDC Debug] Found matching key in JWKS")

            # Verify and decode token
            # Note: We disable access_token validation since at_hash is optional
            # and we're not using it for additional validation
            claims = jwt.decode(
                id_token,
                key,
                algorithms=["RS256", "RS384", "RS512"],
                audience=client_id,
                issuer=config.issuer,
                options={
                    "verify_at_hash": False  # Disable at_hash validation
                },
            )

            logger.debug("[OIDC Debug] ID token verified successfully")
            logger.debug(f"[OIDC Debug] Token claims: {list(claims.keys())}")
            logger.debug(f"[OIDC Debug] Subject (sub): {claims.get('sub')}")
            logger.debug(f"[OIDC Debug] Issued at (iat): {claims.get('iat')}")
            logger.debug(f"[OIDC Debug] Expires at (exp): {claims.get('exp')}")

            return claims

        except JWTError as e:
            logger.error(
                f"ID token verification failed for provider '{provider_id}': {e}"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid ID token from provider '{provider_id}'",
            )

    async def get_user_info(
        self, provider_id: str, access_token: str
    ) -> Dict[str, Any]:
        """Fetch user information from the userinfo endpoint."""
        config = await self.get_oidc_config(provider_id)

        try:
            # Get SSL context for custom CA certificates
            ssl_context = self._get_ssl_context(provider_id)

            # Create httpx client with custom SSL context if available
            client_kwargs = {"timeout": 10.0}
            if ssl_context:
                client_kwargs["verify"] = ssl_context

            async with httpx.AsyncClient(**client_kwargs) as client:
                response = await client.get(
                    config.userinfo_endpoint,
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                response.raise_for_status()
                return response.json()

        except httpx.HTTPError as e:
            logger.error(
                f"Failed to fetch user info from provider '{provider_id}': {e}"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Failed to fetch user information from provider '{provider_id}'",
            )

    def extract_user_data(
        self, provider_id: str, claims: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Extract user data from OIDC claims using provider-specific claim mappings."""
        logger.debug(
            f"[OIDC Debug] Extracting user data from claims for provider '{provider_id}'"
        )

        # Get provider configuration for claim mappings
        provider_config = settings_manager.get_oidc_provider(provider_id)
        if not provider_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"OIDC provider '{provider_id}' not found",
            )

        claim_mappings = provider_config.get("claim_mappings", {})
        username_claim = claim_mappings.get("username", "preferred_username")
        email_claim = claim_mappings.get("email", "email")
        name_claim = claim_mappings.get("name", "name")

        # Log available claims for debugging
        logger.debug(
            f"[OIDC Debug] Available claims in ID token from '{provider_id}': {list(claims.keys())}"
        )
        logger.debug(
            f"[OIDC Debug] Claim mappings - username: {username_claim}, email: {email_claim}, name: {name_claim}"
        )

        username = claims.get(username_claim)
        email = claims.get(email_claim)
        name = claims.get(name_claim, username)

        logger.debug(f"[OIDC Debug] Extracted username: {username}")
        logger.debug(f"[OIDC Debug] Extracted email: {email}")
        logger.debug(f"[OIDC Debug] Extracted name: {name}")

        if not username:
            logger.error(
                f"Username claim '{username_claim}' not found in token from provider '{provider_id}'"
            )
            logger.error(f"Available claims: {claims}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Username claim '{username_claim}' not found in token from provider '{provider_id}'",
            )

        logger.info(
            f"Extracted user data from provider '{provider_id}': username={username}, email={email}, name={name}"
        )

        return {
            "username": username,
            "email": email,
            "realname": name,
            "sub": claims.get("sub"),
            "provider_id": provider_id,
        }

    async def provision_or_get_user(
        self, provider_id: str, user_data: Dict[str, Any]
    ) -> tuple[Dict[str, Any], bool]:
        """Provision a new user or get existing user from OIDC data.

        Returns:
            tuple: (user_dict, is_new_user)
        """
        logger.debug(
            f"[OIDC Debug] Provisioning or retrieving user from provider '{provider_id}'"
        )
        logger.debug(f"[OIDC Debug] Username: {user_data.get('username')}")
        logger.debug(f"[OIDC Debug] Email: {user_data.get('email')}")
        logger.debug(f"[OIDC Debug] Subject (sub): {user_data.get('sub')}")

        # Get provider configuration
        provider_config = settings_manager.get_oidc_provider(provider_id)
        if not provider_config:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"OIDC provider '{provider_id}' not found",
            )

        # Check if auto-provisioning is enabled (default to True for backward compatibility)
        auto_provision_config = provider_config.get("auto_provision")
        if auto_provision_config is None:
            # If not specified in YAML, default to True
            auto_provision = True
        else:
            auto_provision = bool(auto_provision_config)

        from services.auth.user_management import (
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
            if (
                user_data.get("realname")
                and user.get("realname") != user_data["realname"]
            ):
                updates["realname"] = user_data["realname"]

            if updates:
                user = update_user(user["id"], **updates)
                logger.info(
                    f"[OIDC Debug] Updated user '{username}' information from provider '{provider_id}'"
                )
            else:
                logger.info(
                    f"[OIDC Debug] Existing user '{username}' logged in via OIDC provider '{provider_id}'"
                )

            logger.debug(
                f"[OIDC Debug] User ID: {user['id']}, is_active: {user.get('is_active', True)}, role: {user.get('role', 'unknown')}"
            )

            return user, False

        # Create new user if auto-provisioning is enabled
        if not auto_provision:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User does not exist and auto-provisioning is disabled for provider '{provider_id}'",
            )

        try:
            # Generate a random password (won't be used for OIDC login)
            random_password = secrets.token_urlsafe(32)

            # Get default role from provider config or use 'user'
            default_role_str = provider_config.get("default_role", "user")
            default_role = (
                UserRole.user if default_role_str == "user" else UserRole.admin
            )

            # Create new user as INACTIVE - requires admin approval
            user = create_user(
                username=username,
                realname=user_data.get("realname", username),
                password=random_password,
                email=user_data.get("email"),
                role=default_role,
                debug=False,
                is_active=False,  # New OIDC users start as inactive
            )

            logger.info(
                f"Auto-provisioned new INACTIVE OIDC user '{username}' from provider '{provider_id}' - requires admin approval"
            )
            return user, True  # Return True to indicate new user

        except Exception as e:
            logger.error(
                f"Failed to provision OIDC user from provider '{provider_id}': {e}"
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to provision user account from provider '{provider_id}'",
            )


# Global OIDC service instance
oidc_service = OIDCService()
