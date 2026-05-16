"""Unit tests for services/checkmk/client/_connection_service.py.

All tests run offline:
- get_stats / get_version use FakeCheckMKClient via CheckMKClientFactory patch.
- test_connection patches CheckMKClient constructor directly.
- test_connection_from_settings patches get_checkmk_config + test_connection.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.checkmk.client._connection_service import CheckMKConnectionService
from services.checkmk.exceptions import CheckMKAPIError
from tests.mocks import FakeCheckMKClient

# ── Patch targets ──────────────────────────────────────────────────────────────

_PATCH_FACTORY = (
    "services.checkmk.client._connection_service"
    ".CheckMKClientFactory.build_client_from_settings"
)
_PATCH_CONFIG = "services.checkmk.client._connection_service.get_checkmk_config"
# CheckMKClient is imported inside _run() via `from services.checkmk.client import …`
_PATCH_CMK_CLIENT = "services.checkmk.client.CheckMKClient"


# ── get_stats ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_stats_cache_miss_returns_total_hosts():
    """Cache miss → fetches from CheckMK and returns total_hosts count."""
    fake = FakeCheckMKClient()
    fake.seed_host("router1", {})
    fake.seed_host("switch1", {})
    mock_cache = MagicMock()
    mock_cache.get.return_value = None  # cache miss

    with patch(_PATCH_FACTORY, return_value=fake):
        result = await CheckMKConnectionService().get_stats(mock_cache)

    assert result["total_hosts"] == 2
    mock_cache.set.assert_called_once()


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_stats_cache_hit_skips_factory():
    """Cache hit → returns cached data without calling the client factory."""
    cached = {"total_hosts": 5, "timestamp": "2024-01-01T00:00:00Z"}
    mock_cache = MagicMock()
    mock_cache.get.return_value = cached

    with patch(_PATCH_FACTORY) as mock_factory:
        result = await CheckMKConnectionService().get_stats(mock_cache)

    assert result["total_hosts"] == 5
    mock_factory.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_stats_includes_timestamp():
    """get_stats response includes a timestamp key."""
    fake = FakeCheckMKClient()
    mock_cache = MagicMock()
    mock_cache.get.return_value = None

    with patch(_PATCH_FACTORY, return_value=fake):
        result = await CheckMKConnectionService().get_stats(mock_cache)

    assert "timestamp" in result


# ── get_version ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_get_version_returns_version_dict():
    """get_version() returns the CheckMK version dictionary from the client."""
    fake = FakeCheckMKClient()

    with patch(_PATCH_FACTORY, return_value=fake):
        result = await CheckMKConnectionService().get_version()

    assert "versions" in result
    assert result["versions"]["checkmk"] == "2.3.0"


# ── test_connection ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_test_connection_success():
    """Successful ping returns (True, message containing version)."""
    mock_client = MagicMock()
    mock_client.test_connection.return_value = True
    mock_client.get_version.return_value = {"versions": {"checkmk": "2.3.0"}}

    with patch(_PATCH_CMK_CLIENT, return_value=mock_client):
        success, message = await CheckMKConnectionService().test_connection(
            "https://cmk.local", "prod", "user", "pass"
        )

    assert success is True
    assert "2.3.0" in message


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_test_connection_ping_fails():
    """test_connection() returns False when client.test_connection() is False."""
    mock_client = MagicMock()
    mock_client.test_connection.return_value = False

    with patch(_PATCH_CMK_CLIENT, return_value=mock_client):
        success, message = await CheckMKConnectionService().test_connection(
            "https://cmk.local", "prod", "user", "pass"
        )

    assert success is False
    assert message  # non-empty message


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_test_connection_auth_error_401():
    """HTTP 401 → False with authentication-related message."""
    mock_client = MagicMock()
    mock_client.test_connection.side_effect = CheckMKAPIError(
        "Unauthorized", status_code=401
    )

    with patch(_PATCH_CMK_CLIENT, return_value=mock_client):
        success, message = await CheckMKConnectionService().test_connection(
            "https://cmk.local", "prod", "user", "badpass"
        )

    assert success is False
    assert "auth" in message.lower() or "password" in message.lower()


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_test_connection_not_found_404():
    """HTTP 404 → False with URL-related message."""
    mock_client = MagicMock()
    mock_client.test_connection.side_effect = CheckMKAPIError(
        "Not found", status_code=404
    )

    with patch(_PATCH_CMK_CLIENT, return_value=mock_client):
        success, message = await CheckMKConnectionService().test_connection(
            "https://cmk.local", "bad-site", "user", "pass"
        )

    assert success is False
    assert "not found" in message.lower() or "url" in message.lower()


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_test_connection_ssl_error():
    """SSL-related exception → False with SSL message."""
    mock_client = MagicMock()
    mock_client.test_connection.side_effect = Exception(
        "SSL certificate verification failed"
    )

    with patch(_PATCH_CMK_CLIENT, return_value=mock_client):
        success, message = await CheckMKConnectionService().test_connection(
            "https://cmk.local", "prod", "user", "pass"
        )

    assert success is False
    assert "ssl" in message.lower()


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_test_connection_timeout_error():
    """Timeout exception → False with timeout message."""
    mock_client = MagicMock()
    mock_client.test_connection.side_effect = Exception("Connection timed out")

    with patch(_PATCH_CMK_CLIENT, return_value=mock_client):
        success, message = await CheckMKConnectionService().test_connection(
            "https://cmk.local", "prod", "user", "pass"
        )

    assert success is False
    assert "timeout" in message.lower()


# ── test_connection_from_settings ─────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_test_connection_from_settings_success():
    """test_connection_from_settings returns success dict on good credentials."""
    fake_config = MagicMock(
        protocol="https",
        host="cmk.local",
        site="prod",
        username="user",
        password="pass",
        verify_ssl=True,
    )

    with patch(_PATCH_CONFIG, return_value=fake_config):
        svc = CheckMKConnectionService()
        svc.test_connection = AsyncMock(
            return_value=(True, "Connection successful! CheckMK version: 2.3.0")
        )
        result = await svc.test_connection_from_settings()

    assert result["success"] is True
    assert result["connection_source"] == "database"
    assert "cmk.local" in result["checkmk_url"]


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_test_connection_from_settings_failure():
    """test_connection_from_settings returns failure dict when connection fails."""
    fake_config = MagicMock(
        protocol="https",
        host="cmk.local",
        site="prod",
        username="user",
        password="bad",
        verify_ssl=True,
    )

    with patch(_PATCH_CONFIG, return_value=fake_config):
        svc = CheckMKConnectionService()
        svc.test_connection = AsyncMock(
            return_value=(False, "Authentication failed.")
        )
        result = await svc.test_connection_from_settings()

    assert result["success"] is False
    assert result["connection_source"] == "database"
