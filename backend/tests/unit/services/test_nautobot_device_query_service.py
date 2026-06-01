"""Unit tests for DeviceQueryService.

All tests run offline - no real Nautobot instance required.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.nautobot.common.exceptions import NautobotAPIError
from services.nautobot.devices.query import DeviceQueryService

DEVICE_ID = "aa000000-0000-0000-0003-000000000001"


def _device(device_id: str = DEVICE_ID, name: str = "router-01") -> dict:
    return {
        "id": device_id,
        "name": name,
        "role": {"name": "Network"},
        "location": {"name": "DC1"},
        "primary_ip4": {"address": "10.0.0.1/24"},
        "status": {"name": "Active"},
        "device_type": {"model": "networkA"},
    }


def _service(mock_nautobot: MagicMock | None = None, mock_cache: MagicMock | None = None) -> DeviceQueryService:
    if mock_nautobot is None:
        mock_nautobot = MagicMock()
        mock_nautobot.graphql_query = AsyncMock()
    if mock_cache is None:
        mock_cache = MagicMock()
        mock_cache.get.return_value = None

    with (
        patch("service_factory.build_nautobot_service", return_value=mock_nautobot),
        patch("service_factory.build_cache_service", return_value=mock_cache),
    ):
        svc = DeviceQueryService()

    return svc


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_get_device_details_returns_cached_device() -> None:
    """Cached device details are returned without calling GraphQL."""
    cached = _device()
    mock_nb = MagicMock()
    mock_nb.graphql_query = AsyncMock()
    mock_cache = MagicMock()
    mock_cache.get.return_value = cached
    svc = _service(mock_nb, mock_cache)

    result = await svc.get_device_details(DEVICE_ID)

    assert result == cached
    mock_nb.graphql_query.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_get_device_details_fetches_and_caches_device() -> None:
    """A cache miss fetches device details and writes them to cache."""
    device = _device()
    mock_nb = MagicMock()
    mock_nb.graphql_query = AsyncMock(return_value={"data": {"device": device}})
    mock_cache = MagicMock()
    mock_cache.get.return_value = None
    svc = _service(mock_nb, mock_cache)

    result = await svc.get_device_details(DEVICE_ID)

    assert result == device
    mock_nb.graphql_query.assert_awaited_once()
    mock_cache.set.assert_called_once()


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_get_device_details_not_found_raises_value_error() -> None:
    """Missing device details are converted into a ValueError."""
    mock_nb = MagicMock()
    mock_nb.graphql_query = AsyncMock(return_value={"data": {"device": None}})
    svc = _service(mock_nb)

    with pytest.raises(ValueError, match="Failed to fetch device details"):
        await svc.get_device_details(DEVICE_ID, use_cache=False)


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_get_devices_all_paginated_builds_navigation_links() -> None:
    """Paginated all-device queries include total count and next URL."""
    first_page = [_device(name="router-01")]
    all_devices = first_page + [_device("aa000000-0000-0000-0003-000000000002", "router-02")]
    mock_nb = MagicMock()
    mock_nb.graphql_query = AsyncMock(
        side_effect=[
            {"data": {"devices": first_page}},
            {"data": {"devices": all_devices}},
        ]
    )
    svc = _service(mock_nb)

    with (
        patch("services.nautobot.devices.query.get_cached_device_list", return_value=None),
        patch("services.nautobot.devices.query.cache_device_list") as cache_list,
    ):
        result = await svc.get_devices(limit=1, offset=0, reload=True)

    assert result["devices"] == first_page
    assert result["count"] == 2
    assert result["has_more"] is True
    assert result["next"] == "/api/nautobot/devices?limit=1&offset=1"
    cache_list.assert_called_once()


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_get_devices_name_filter_uses_count_then_data_query() -> None:
    """Name filtering issues a count query followed by the paginated data query."""
    device = _device(name="core-router")
    mock_nb = MagicMock()
    mock_nb.graphql_query = AsyncMock(
        side_effect=[
            {"data": {"devices": [{"id": device["id"]}]}},
            {"data": {"devices": [device]}},
        ]
    )
    svc = _service(mock_nb)

    with (
        patch("services.nautobot.devices.query.get_cached_device_list", return_value=None),
        patch("services.nautobot.devices.query.cache_device_list"),
    ):
        result = await svc.get_devices(filter_type="name", filter_value="core-router")

    assert result["devices"] == [device]
    assert result["count"] == 1
    assert result["is_paginated"] is False
    assert mock_nb.graphql_query.await_count == 2


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_get_devices_location_filter_flattens_location_devices() -> None:
    """Location filtering flattens devices from matching locations."""
    device = _device(name="switch-01")
    mock_nb = MagicMock()
    mock_nb.graphql_query = AsyncMock(return_value={"data": {"locations": [{"name": "DC1", "devices": [device]}]}})
    svc = _service(mock_nb)

    with (
        patch("services.nautobot.devices.query.get_cached_device_list", return_value=None),
        patch("services.nautobot.devices.query.cache_device_list"),
    ):
        result = await svc.get_devices(filter_type="location", filter_value="DC1")

    assert result["devices"][0]["name"] == "switch-01"
    assert result["devices"][0]["location"] == {"name": "DC1"}


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_get_devices_graphql_errors_raise_nautobot_api_error() -> None:
    """GraphQL errors from list queries propagate as NautobotAPIError."""
    mock_nb = MagicMock()
    mock_nb.graphql_query = AsyncMock(return_value={"errors": [{"message": "boom"}]})
    svc = _service(mock_nb)

    with (
        patch("services.nautobot.devices.query.get_cached_device_list", return_value=None),
        patch("services.nautobot.devices.query.cache_device_list"),
        pytest.raises(NautobotAPIError, match="GraphQL errors"),
    ):
        await svc.get_devices(limit=10, reload=True)
