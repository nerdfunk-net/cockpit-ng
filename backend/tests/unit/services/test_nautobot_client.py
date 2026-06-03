"""Unit tests for services/nautobot/client.py."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from services.nautobot.client import NautobotService
from services.nautobot.common.exceptions import (
    NautobotAPIError,
    NautobotNotFoundError,
    NautobotValidationError,
)


def _config() -> dict:
    return {
        "url": "https://nautobot.example.com",
        "token": "test-token",
        "timeout": 30,
        "verify_ssl": True,
    }


@pytest.mark.asyncio
@pytest.mark.unit
async def test_startup_and_shutdown() -> None:
    svc = NautobotService()
    await svc.startup()
    assert svc._client is not None
    await svc.shutdown()
    assert svc._client is None


@pytest.mark.asyncio
@pytest.mark.unit
async def test_graphql_query_success() -> None:
    svc = NautobotService()
    mock_response = MagicMock(status_code=200)
    mock_response.json.return_value = {"data": {"devices": []}}

    with (
        patch.object(svc, "_get_config", return_value=_config()),
        patch.object(svc, "_do_post", AsyncMock(return_value=mock_response)),
    ):
        result = await svc.graphql_query("query { devices { id } }", {})

    assert result["data"]["devices"] == []


@pytest.mark.asyncio
@pytest.mark.unit
async def test_graphql_query_requires_config() -> None:
    svc = NautobotService()
    with patch.object(svc, "_get_config", return_value={"url": "", "token": ""}):
        with pytest.raises(NautobotValidationError):
            await svc.graphql_query("query {}", {})


@pytest.mark.asyncio
@pytest.mark.unit
async def test_rest_request_404_raises_not_found() -> None:
    svc = NautobotService()
    mock_response = MagicMock(status_code=404, text="missing")

    with (
        patch.object(svc, "_get_config", return_value=_config()),
        patch.object(svc, "_do_request", AsyncMock(return_value=mock_response)),
    ):
        with pytest.raises(NautobotNotFoundError):
            await svc.rest_request("dcim/devices/missing/")


@pytest.mark.asyncio
@pytest.mark.unit
async def test_rest_request_204_returns_success_message() -> None:
    svc = NautobotService()
    mock_response = MagicMock(status_code=204)

    with (
        patch.object(svc, "_get_config", return_value=_config()),
        patch.object(svc, "_do_request", AsyncMock(return_value=mock_response)),
    ):
        result = await svc.rest_request("dcim/devices/1/", method="DELETE")

    assert result["status"] == "success"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_test_connection_success() -> None:
    svc = NautobotService()
    mock_response = MagicMock(status_code=200)
    mock_response.json.return_value = {"data": {"devices": [{"id": "1"}]}}

    mock_client = AsyncMock()
    mock_client.post = AsyncMock(return_value=mock_response)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("httpx.AsyncClient", return_value=mock_client):
        ok, message = await svc.test_connection(
            "https://nautobot.example.com",
            "token",
        )

    assert ok is True
    assert "successful" in message.lower()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_graphql_query_timeout_raises_api_error() -> None:
    svc = NautobotService()

    with (
        patch.object(svc, "_get_config", return_value=_config()),
        patch.object(
            svc,
            "_do_post",
            AsyncMock(side_effect=httpx.TimeoutException("timed out")),
        ),
    ):
        with pytest.raises(NautobotAPIError, match="timed out"):
            await svc.graphql_query("query {}", {})
