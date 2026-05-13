"""Unit tests for services.auth.oidc.OIDCService.

Pure methods are tested directly. HTTP-dependent methods use mocked
httpx.AsyncClient. settings_manager is replaced with a MagicMock.
All tests run offline — no real OIDC provider required.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from models.auth import OIDCConfig
from services.auth.oidc import OIDCService

# ---------------------------------------------------------------------------
# Patch targets
# ---------------------------------------------------------------------------

_PATCH_SETTINGS = "services.auth.oidc.settings_manager"
_PATCH_HTTPX = "services.auth.oidc.httpx.AsyncClient"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _fake_oidc_config(**overrides) -> OIDCConfig:
    """Build a minimal OIDCConfig for use as a test double."""
    defaults = {
        "issuer": "https://idp.example.com",
        "authorization_endpoint": "https://idp.example.com/auth",
        "token_endpoint": "https://idp.example.com/token",
        "userinfo_endpoint": "https://idp.example.com/userinfo",
        "jwks_uri": "https://idp.example.com/jwks",
    }
    return OIDCConfig(**{**defaults, **overrides})


def _fake_provider(
    *,
    enabled: bool = True,
    client_id: str = "my-client",
    client_secret: str = "secret",
    redirect_uri: str = "https://app.example.com/callback",
    auto_provision: bool = True,
    default_role: str = "user",
    claim_mappings: dict | None = None,
) -> dict:
    """Build a minimal provider config dict as returned by settings_manager."""
    return {
        "enabled": enabled,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "discovery_url": "https://idp.example.com/.well-known/openid-configuration",
        "scopes": ["openid", "profile", "email"],
        "auto_provision": auto_provision,
        "default_role": default_role,
        "claim_mappings": claim_mappings or {},
    }


def _http_client_mock(json_response: dict) -> tuple[MagicMock, MagicMock]:
    """Return (mock_class, mock_client) with a pre-configured json response."""
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = json_response

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    mock_client.post = AsyncMock(return_value=mock_response)

    mock_cls = MagicMock()
    mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
    mock_cls.return_value.__aexit__ = AsyncMock(return_value=None)

    return mock_cls, mock_client


# ===========================================================================
# generate_state
# ===========================================================================


@pytest.mark.unit
class TestGenerateState:
    def test_returns_non_empty_string(self) -> None:
        """generate_state returns a non-empty URL-safe string."""
        svc = OIDCService()
        state = svc.generate_state()
        assert isinstance(state, str)
        assert len(state) >= 32

    def test_consecutive_calls_differ(self) -> None:
        """Each call to generate_state produces a unique value."""
        svc = OIDCService()
        assert svc.generate_state() != svc.generate_state()


# ===========================================================================
# _sanitize_token_response
# ===========================================================================


@pytest.mark.unit
class TestSanitizeTokenResponse:
    def setup_method(self) -> None:
        self.svc = OIDCService()

    def test_access_token_is_masked(self) -> None:
        """access_token longer than 20 chars is partially masked."""
        response = {"access_token": "a" * 30, "token_type": "Bearer"}
        sanitized = self.svc._sanitize_token_response(response)
        assert sanitized["access_token"] != "a" * 30
        assert "..." in sanitized["access_token"]

    def test_refresh_token_is_masked(self) -> None:
        """refresh_token is masked in the sanitized response."""
        response = {"refresh_token": "r" * 30}
        sanitized = self.svc._sanitize_token_response(response)
        assert sanitized["refresh_token"] != "r" * 30

    def test_id_token_is_masked(self) -> None:
        """id_token is masked in the sanitized response."""
        response = {"id_token": "i" * 30}
        sanitized = self.svc._sanitize_token_response(response)
        assert sanitized["id_token"] != "i" * 30

    def test_non_sensitive_fields_unchanged(self) -> None:
        """Non-sensitive fields like token_type and expires_in pass through."""
        response = {
            "access_token": "a" * 30,
            "token_type": "Bearer",
            "expires_in": 3600,
        }
        sanitized = self.svc._sanitize_token_response(response)
        assert sanitized["token_type"] == "Bearer"
        assert sanitized["expires_in"] == 3600

    def test_short_token_fully_masked(self) -> None:
        """Tokens with 20 or fewer chars are replaced with '***MASKED***'."""
        response = {"access_token": "short"}
        sanitized = self.svc._sanitize_token_response(response)
        assert sanitized["access_token"] == "***MASKED***"

    def test_original_dict_not_mutated(self) -> None:
        """The original response dict is not modified."""
        original_token = "x" * 30
        response = {"access_token": original_token}
        self.svc._sanitize_token_response(response)
        assert response["access_token"] == original_token


# ===========================================================================
# extract_user_data
# ===========================================================================


@pytest.mark.unit
class TestExtractUserData:
    def test_default_claim_mappings(self) -> None:
        """Default mappings use preferred_username, email, name claims."""
        svc = OIDCService()
        claims = {
            "preferred_username": "alice",
            "email": "alice@example.com",
            "name": "Alice Smith",
            "sub": "sub-123",
        }
        with patch(_PATCH_SETTINGS) as mock_sm:
            mock_sm.get_oidc_provider.return_value = _fake_provider()
            result = svc.extract_user_data("my-provider", claims)

        assert result["username"] == "alice"
        assert result["email"] == "alice@example.com"
        assert result["realname"] == "Alice Smith"
        assert result["sub"] == "sub-123"
        assert result["provider_id"] == "my-provider"

    def test_custom_claim_mappings(self) -> None:
        """Custom claim_mappings in provider config are applied correctly."""
        svc = OIDCService()
        claims = {
            "upn": "bob@corp.com",
            "mail": "bob@corp.com",
            "displayName": "Bob Jones",
            "sub": "sub-456",
        }
        provider = _fake_provider(
            claim_mappings={
                "username": "upn",
                "email": "mail",
                "name": "displayName",
            }
        )
        with patch(_PATCH_SETTINGS) as mock_sm:
            mock_sm.get_oidc_provider.return_value = provider
            result = svc.extract_user_data("corp-provider", claims)

        assert result["username"] == "bob@corp.com"
        assert result["email"] == "bob@corp.com"
        assert result["realname"] == "Bob Jones"

    def test_missing_username_claim_raises_401(self) -> None:
        """Missing username claim raises HTTPException with status 401."""
        svc = OIDCService()
        claims = {"email": "nobody@example.com"}  # no preferred_username
        with patch(_PATCH_SETTINGS) as mock_sm:
            mock_sm.get_oidc_provider.return_value = _fake_provider()
            with pytest.raises(HTTPException) as exc_info:
                svc.extract_user_data("my-provider", claims)

        assert exc_info.value.status_code == 401

    def test_unknown_provider_raises_404(self) -> None:
        """extract_user_data with an unknown provider_id raises 404."""
        svc = OIDCService()
        with patch(_PATCH_SETTINGS) as mock_sm:
            mock_sm.get_oidc_provider.return_value = None
            with pytest.raises(HTTPException) as exc_info:
                svc.extract_user_data("ghost", {"preferred_username": "alice"})

        assert exc_info.value.status_code == 404

    def test_name_defaults_to_username_when_absent(self) -> None:
        """When name claim is missing, realname falls back to username."""
        svc = OIDCService()
        claims = {"preferred_username": "alice", "sub": "sub-1"}
        with patch(_PATCH_SETTINGS) as mock_sm:
            mock_sm.get_oidc_provider.return_value = _fake_provider()
            result = svc.extract_user_data("my-provider", claims)

        assert result["realname"] == "alice"


# ===========================================================================
# generate_authorization_url
# ===========================================================================


@pytest.mark.unit
class TestGenerateAuthorizationUrl:
    def test_contains_required_query_params(self) -> None:
        """Authorization URL includes client_id, scope, redirect_uri, state."""
        svc = OIDCService()
        config = _fake_oidc_config()
        with patch(_PATCH_SETTINGS) as mock_sm:
            mock_sm.get_oidc_provider.return_value = _fake_provider()
            url = svc.generate_authorization_url("my-provider", config, state="abc123")

        assert "client_id=" in url
        assert "redirect_uri=" in url
        assert "state=abc123" in url
        assert "scope=" in url

    def test_url_starts_with_authorization_endpoint(self) -> None:
        """URL is rooted at the config's authorization_endpoint."""
        svc = OIDCService()
        config = _fake_oidc_config()
        with patch(_PATCH_SETTINGS) as mock_sm:
            mock_sm.get_oidc_provider.return_value = _fake_provider()
            url = svc.generate_authorization_url("my-provider", config, state="s")

        assert url.startswith("https://idp.example.com/auth")

    def test_client_id_override_used_in_url(self) -> None:
        """client_id_override replaces the provider's configured client_id."""
        svc = OIDCService()
        config = _fake_oidc_config()
        with patch(_PATCH_SETTINGS) as mock_sm:
            mock_sm.get_oidc_provider.return_value = _fake_provider(client_id="orig")
            url = svc.generate_authorization_url(
                "my-provider", config, state="s", client_id_override="override-id"
            )

        assert "override-id" in url
        assert "orig" not in url

    def test_missing_provider_raises_404(self) -> None:
        """generate_authorization_url raises 404 when provider is not found."""
        svc = OIDCService()
        config = _fake_oidc_config()
        with patch(_PATCH_SETTINGS) as mock_sm:
            mock_sm.get_oidc_provider.return_value = None
            with pytest.raises(HTTPException) as exc_info:
                svc.generate_authorization_url("ghost", config, state="s")

        assert exc_info.value.status_code == 404

    def test_missing_client_id_raises_500(self) -> None:
        """Missing client_id in provider config raises 500."""
        svc = OIDCService()
        config = _fake_oidc_config()
        provider = _fake_provider()
        provider.pop("client_id")  # remove it
        with patch(_PATCH_SETTINGS) as mock_sm:
            mock_sm.get_oidc_provider.return_value = provider
            with pytest.raises(HTTPException) as exc_info:
                svc.generate_authorization_url("my-provider", config, state="s")

        assert exc_info.value.status_code == 500

    def test_missing_redirect_uri_raises_500(self) -> None:
        """Missing redirect_uri in provider config raises 500."""
        svc = OIDCService()
        config = _fake_oidc_config()
        provider = _fake_provider()
        provider.pop("redirect_uri")
        with patch(_PATCH_SETTINGS) as mock_sm:
            mock_sm.get_oidc_provider.return_value = provider
            with pytest.raises(HTTPException) as exc_info:
                svc.generate_authorization_url("my-provider", config, state="s")

        assert exc_info.value.status_code == 500


# ===========================================================================
# get_oidc_config
# ===========================================================================


@pytest.mark.asyncio
@pytest.mark.unit
class TestGetOIDCConfig:
    async def test_oidc_disabled_raises_501(self) -> None:
        """When OIDC is globally disabled, get_oidc_config raises 501."""
        svc = OIDCService()
        with patch(_PATCH_SETTINGS) as mock_sm:
            mock_sm.is_oidc_enabled.return_value = False
            with pytest.raises(HTTPException) as exc_info:
                await svc.get_oidc_config("any-provider")

        assert exc_info.value.status_code == 501

    async def test_unknown_provider_raises_404(self) -> None:
        """Unknown provider_id raises 404."""
        svc = OIDCService()
        with patch(_PATCH_SETTINGS) as mock_sm:
            mock_sm.is_oidc_enabled.return_value = True
            mock_sm.get_oidc_provider.return_value = None
            with pytest.raises(HTTPException) as exc_info:
                await svc.get_oidc_config("ghost")

        assert exc_info.value.status_code == 404

    async def test_disabled_provider_raises_403(self) -> None:
        """A provider with enabled=False raises 403."""
        svc = OIDCService()
        with patch(_PATCH_SETTINGS) as mock_sm:
            mock_sm.is_oidc_enabled.return_value = True
            mock_sm.get_oidc_provider.return_value = _fake_provider(enabled=False)
            with pytest.raises(HTTPException) as exc_info:
                await svc.get_oidc_config("disabled-provider")

        assert exc_info.value.status_code == 403

    async def test_success_returns_oidc_config(self) -> None:
        """Successful discovery fetch returns an OIDCConfig instance."""
        svc = OIDCService()
        discovery_data = {
            "issuer": "https://idp.example.com",
            "authorization_endpoint": "https://idp.example.com/auth",
            "token_endpoint": "https://idp.example.com/token",
            "userinfo_endpoint": "https://idp.example.com/userinfo",
            "jwks_uri": "https://idp.example.com/jwks",
        }
        mock_cls, _ = _http_client_mock(discovery_data)
        with (
            patch(_PATCH_SETTINGS) as mock_sm,
            patch(_PATCH_HTTPX, mock_cls),
        ):
            mock_sm.is_oidc_enabled.return_value = True
            mock_sm.get_oidc_provider.return_value = _fake_provider()
            config = await svc.get_oidc_config("my-provider")

        assert isinstance(config, OIDCConfig)
        assert config.issuer == "https://idp.example.com"

    async def test_result_is_cached_on_second_call(self) -> None:
        """Second call returns cached config without making an HTTP request."""
        svc = OIDCService()
        discovery_data = {
            "issuer": "https://idp.example.com",
            "authorization_endpoint": "https://idp.example.com/auth",
            "token_endpoint": "https://idp.example.com/token",
            "userinfo_endpoint": "https://idp.example.com/userinfo",
            "jwks_uri": "https://idp.example.com/jwks",
        }
        mock_cls, mock_client = _http_client_mock(discovery_data)
        with (
            patch(_PATCH_SETTINGS) as mock_sm,
            patch(_PATCH_HTTPX, mock_cls),
        ):
            mock_sm.is_oidc_enabled.return_value = True
            mock_sm.get_oidc_provider.return_value = _fake_provider()
            await svc.get_oidc_config("my-provider")
            await svc.get_oidc_config("my-provider")

        # HTTP GET should only have been called once
        assert mock_client.get.call_count == 1


# ===========================================================================
# get_user_info
# ===========================================================================


@pytest.mark.asyncio
@pytest.mark.unit
class TestGetUserInfo:
    async def test_success_returns_user_info_dict(self) -> None:
        """get_user_info returns the JSON body from the userinfo endpoint."""
        svc = OIDCService()
        userinfo = {"sub": "u-123", "email": "alice@example.com", "name": "Alice"}
        # Pre-seed the config cache so get_oidc_config skips the discovery HTTP call.
        svc._configs["my-provider"] = _fake_oidc_config()

        mock_cls, _ = _http_client_mock(userinfo)
        with (
            patch(_PATCH_SETTINGS) as mock_sm,
            patch(_PATCH_HTTPX, mock_cls),
        ):
            mock_sm.is_oidc_enabled.return_value = True
            mock_sm.get_oidc_provider.return_value = _fake_provider()
            result = await svc.get_user_info("my-provider", "access-token-abc")

        assert result["sub"] == "u-123"
        assert result["email"] == "alice@example.com"

    async def test_http_error_raises_401(self) -> None:
        """An HTTP error from the userinfo endpoint raises HTTPException 401."""
        import httpx

        svc = OIDCService()
        # Pre-seed the config cache so get_oidc_config skips the discovery HTTP call.
        svc._configs["my-provider"] = _fake_oidc_config()

        mock_client = AsyncMock()
        mock_client.get = AsyncMock(side_effect=httpx.HTTPError("connection refused"))
        mock_cls = MagicMock()
        mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_cls.return_value.__aexit__ = AsyncMock(return_value=None)

        with (
            patch(_PATCH_SETTINGS) as mock_sm,
            patch(_PATCH_HTTPX, mock_cls),
        ):
            mock_sm.is_oidc_enabled.return_value = True
            mock_sm.get_oidc_provider.return_value = _fake_provider()
            with pytest.raises(HTTPException) as exc_info:
                await svc.get_user_info("my-provider", "bad-token")

        assert exc_info.value.status_code == 401


# ===========================================================================
# provision_or_get_user
# ===========================================================================


@pytest.mark.asyncio
@pytest.mark.unit
class TestProvisionOrGetUser:
    _PATCH_GET = "services.auth.user_management.get_user_by_username"
    _PATCH_CREATE = "services.auth.user_management.create_user"
    _PATCH_UPDATE = "services.auth.user_management.update_user"

    async def test_existing_user_is_returned(self) -> None:
        """An existing user is returned unchanged (no new user created)."""
        svc = OIDCService()
        existing = {
            "id": 1,
            "username": "alice",
            "email": "alice@example.com",
            "realname": "Alice Smith",
            "is_active": True,
            "permissions": 3,
            "role": "User",
        }
        user_data = {
            "username": "alice",
            "email": "alice@example.com",
            "realname": "Alice Smith",
        }

        with (
            patch(_PATCH_SETTINGS) as mock_sm,
            patch(self._PATCH_GET, return_value=existing),
            patch(self._PATCH_CREATE) as mock_create,
        ):
            mock_sm.get_oidc_provider.return_value = _fake_provider()
            user, is_new = await svc.provision_or_get_user("my-provider", user_data)

        assert user["username"] == "alice"
        assert is_new is False
        mock_create.assert_not_called()

    async def test_existing_user_email_updated_when_changed(self) -> None:
        """When existing user email differs from token, it is updated."""
        svc = OIDCService()
        existing = {
            "id": 1,
            "username": "alice",
            "email": "old@example.com",
            "realname": "Alice",
            "is_active": True,
            "permissions": 3,
            "role": "User",
        }
        updated = {**existing, "email": "new@example.com"}
        user_data = {
            "username": "alice",
            "email": "new@example.com",
            "realname": "Alice",
        }

        with (
            patch(_PATCH_SETTINGS) as mock_sm,
            patch(self._PATCH_GET, return_value=existing),
            patch(self._PATCH_UPDATE, return_value=updated) as mock_update,
        ):
            mock_sm.get_oidc_provider.return_value = _fake_provider()
            user, is_new = await svc.provision_or_get_user("my-provider", user_data)

        assert user["email"] == "new@example.com"
        assert is_new is False
        mock_update.assert_called_once()

    async def test_new_user_auto_provisioned_as_inactive(self) -> None:
        """Unknown user with auto_provision=True is created as inactive."""
        svc = OIDCService()
        new_user = {
            "id": 2,
            "username": "newbie",
            "email": "newbie@example.com",
            "realname": "New Bie",
            "is_active": False,
            "permissions": 3,
            "role": "User",
        }
        user_data = {
            "username": "newbie",
            "email": "newbie@example.com",
            "realname": "New Bie",
            "sub": "sub-999",
        }

        with (
            patch(_PATCH_SETTINGS) as mock_sm,
            patch(self._PATCH_GET, return_value=None),
            patch(self._PATCH_CREATE, return_value=new_user) as mock_create,
        ):
            mock_sm.get_oidc_provider.return_value = _fake_provider(auto_provision=True)
            user, is_new = await svc.provision_or_get_user("my-provider", user_data)

        assert is_new is True
        # is_active=False must be passed during creation
        call_kwargs = mock_create.call_args.kwargs
        assert call_kwargs.get("is_active") is False

    async def test_auto_provision_disabled_raises_403(self) -> None:
        """Unknown user with auto_provision=False raises HTTPException 403."""
        svc = OIDCService()
        user_data = {
            "username": "stranger",
            "email": "stranger@example.com",
            "realname": "Stranger",
            "sub": "sub-000",
        }

        with (
            patch(_PATCH_SETTINGS) as mock_sm,
            patch(self._PATCH_GET, return_value=None),
        ):
            mock_sm.get_oidc_provider.return_value = _fake_provider(
                auto_provision=False
            )
            with pytest.raises(HTTPException) as exc_info:
                await svc.provision_or_get_user("my-provider", user_data)

        assert exc_info.value.status_code == 403

    async def test_unknown_provider_raises_404(self) -> None:
        """provision_or_get_user raises 404 for an unknown provider_id."""
        svc = OIDCService()
        with patch(_PATCH_SETTINGS) as mock_sm:
            mock_sm.get_oidc_provider.return_value = None
            with pytest.raises(HTTPException) as exc_info:
                await svc.provision_or_get_user(
                    "ghost", {"username": "alice", "sub": "s"}
                )

        assert exc_info.value.status_code == 404
