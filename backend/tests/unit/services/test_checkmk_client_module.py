"""Unit tests for legacy services/checkmk/client.py (shadowed by client/ package).

Python resolves ``services.checkmk.client`` to the package; this module file is
loaded explicitly so coverage includes the duplicate implementation.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.checkmk.exceptions import CheckMKAPIError, HostNotFoundError
from tests.mocks import FakeCheckMKClient

_LEGACY_PATH = (
    Path(__file__).resolve().parents[3] / "services" / "checkmk" / "client.py"
)


def _load_legacy_module():
    spec = importlib.util.spec_from_file_location(
        "services.checkmk._client_legacy", _LEGACY_PATH
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


_PATCH_CMK_CLIENT = "services.checkmk.client.CheckMKClient"


@pytest.mark.unit
def test_legacy_module_exports_checkmk_service_alias() -> None:
    mod = _load_legacy_module()

    assert mod.CheckMKService is mod.CheckMKConnectionService


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_legacy_test_connection_success() -> None:
    mod = _load_legacy_module()
    mock_client = MagicMock()
    mock_client.test_connection.return_value = True
    mock_client.get_version.return_value = {"versions": {"checkmk": "2.2.0"}}

    with patch(_PATCH_CMK_CLIENT, return_value=mock_client):
        success, message = await mod.CheckMKConnectionService().test_connection(
            "https://cmk.local", "prod", "user", "pass"
        )

    assert success is True
    assert "2.2.0" in message


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_legacy_test_connection_from_settings() -> None:
    mod = _load_legacy_module()
    fake_config = MagicMock(
        protocol="https",
        host="cmk.local",
        site="prod",
        username="user",
        password="pass",
        verify_ssl=True,
    )

    with patch(
        "services.checkmk.base.get_checkmk_config", return_value=fake_config
    ):
        svc = mod.CheckMKConnectionService()
        svc.test_connection = AsyncMock(return_value=(True, "ok"))
        result = await svc.test_connection_from_settings()

    assert result["success"] is True
    assert result["connection_source"] == "database"


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_legacy_get_stats_uses_cache() -> None:
    mod = _load_legacy_module()
    cache = MagicMock()
    cache.get.return_value = {"total_hosts": 5, "timestamp": "t"}

    result = await mod.CheckMKConnectionService().get_stats(cache)

    assert result["total_hosts"] == 5
    cache.get.assert_called_once()


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_legacy_get_stats_fetches_and_caches() -> None:
    mod = _load_legacy_module()
    cache = MagicMock()
    cache.get.return_value = None
    fake_client = FakeCheckMKClient()
    fake_client.seed_host("router1")

    with patch(
        "services.checkmk.base.CheckMKClientFactory.build_client_from_settings",
        return_value=fake_client,
    ):
        result = await mod.CheckMKConnectionService().get_stats(cache)

    assert result["total_hosts"] == 1
    cache.set.assert_called_once()


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_legacy_get_host_inventory_not_found() -> None:
    mod = _load_legacy_module()
    fake_config = MagicMock(
        protocol="https",
        host="cmk.local",
        site="prod",
        username="user",
        password="pass",
        verify_ssl=True,
    )
    response = MagicMock(status_code=404)

    with patch("services.checkmk.base.get_checkmk_config", return_value=fake_config):
        with patch("requests.get", return_value=response):
            with pytest.raises(HostNotFoundError):
                await mod.CheckMKConnectionService().get_host_inventory("missing-host")


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.checkmk
async def test_legacy_test_connection_auth_error() -> None:
    mod = _load_legacy_module()
    mock_client = MagicMock()
    mock_client.test_connection.side_effect = CheckMKAPIError(
        "Unauthorized", status_code=401
    )

    with patch(_PATCH_CMK_CLIENT, return_value=mock_client):
        success, message = await mod.CheckMKConnectionService().test_connection(
            "https://cmk.local", "prod", "user", "bad"
        )

    assert success is False
    assert "auth" in message.lower() or "password" in message.lower()
