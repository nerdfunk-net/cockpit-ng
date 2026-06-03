"""Unit tests for services/checkmk/sync/__init__.py facade."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.checkmk.sync import NautobotToCheckMKService

_PATCH_QUERY = "services.checkmk.sync.DeviceQueryService"
_PATCH_COMPARE = "services.checkmk.sync.DeviceComparisonService"
_PATCH_OPS = "services.checkmk.sync.DeviceSyncOperations"


@pytest.fixture
def facade() -> NautobotToCheckMKService:
    query = MagicMock()
    comparison = MagicMock()
    operations = MagicMock()
    with patch(_PATCH_QUERY, return_value=query):
        with patch(_PATCH_COMPARE, return_value=comparison):
            with patch(_PATCH_OPS, return_value=operations):
                svc = NautobotToCheckMKService()
    svc.query_service = query
    svc.comparison_service = comparison
    svc.operations_service = operations
    return svc


@pytest.mark.asyncio
@pytest.mark.unit
async def test_get_devices_for_sync_delegates(facade: NautobotToCheckMKService) -> None:
    expected = MagicMock()
    facade.query_service.get_devices_for_sync = AsyncMock(return_value=expected)

    result = await facade.get_devices_for_sync()

    assert result is expected
    facade.query_service.get_devices_for_sync.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_get_device_normalized_delegates(facade: NautobotToCheckMKService) -> None:
    facade.query_service.get_device_normalized = AsyncMock(return_value={"id": "1"})

    result = await facade.get_device_normalized("dev-1")

    assert result == {"id": "1"}
    facade.query_service.get_device_normalized.assert_awaited_once_with("dev-1")


@pytest.mark.asyncio
@pytest.mark.unit
async def test_get_devices_diff_delegates(facade: NautobotToCheckMKService) -> None:
    expected = MagicMock()
    facade.comparison_service.get_devices_diff = AsyncMock(return_value=expected)

    result = await facade.get_devices_diff()

    assert result is expected


@pytest.mark.asyncio
@pytest.mark.unit
async def test_compare_device_config_delegates(
    facade: NautobotToCheckMKService,
) -> None:
    expected = MagicMock()
    facade.comparison_service.compare_device_config = AsyncMock(return_value=expected)

    result = await facade.compare_device_config("dev-2")

    assert result is expected


@pytest.mark.unit
def test_compare_configurations_delegates(facade: NautobotToCheckMKService) -> None:
    facade.comparison_service._compare_configurations.return_value = ["diff"]

    result = facade._compare_configurations({"a": 1}, {"b": 2})

    assert result == ["diff"]
    facade.comparison_service._compare_configurations.assert_called_once()


@pytest.mark.unit
def test_filter_diff_by_ignored_attributes_static() -> None:
    with patch(
        "services.checkmk.sync.DeviceComparisonService.filter_diff_by_ignored_attributes",
        return_value="filtered",
    ) as mock_filter:
        result = NautobotToCheckMKService.filter_diff_by_ignored_attributes(
            "raw", ["tags"]
        )

    assert result == "filtered"
    mock_filter.assert_called_once_with("raw", ["tags"])


@pytest.mark.unit
def test_get_filtered_attributes_delegates(facade: NautobotToCheckMKService) -> None:
    facade.comparison_service.get_filtered_attributes.return_value = ["site"]

    result = facade.get_filtered_attributes([], [])

    assert result == ["site"]


@pytest.mark.asyncio
@pytest.mark.unit
async def test_add_device_to_checkmk_delegates(
    facade: NautobotToCheckMKService,
) -> None:
    expected = MagicMock()
    facade.operations_service.add_device_to_checkmk = AsyncMock(return_value=expected)

    result = await facade.add_device_to_checkmk("dev-3")

    assert result is expected


@pytest.mark.asyncio
@pytest.mark.unit
async def test_update_device_in_checkmk_delegates(
    facade: NautobotToCheckMKService,
) -> None:
    expected = MagicMock()
    facade.operations_service.update_device_in_checkmk = AsyncMock(return_value=expected)

    result = await facade.update_device_in_checkmk("dev-4")

    assert result is expected


@pytest.mark.unit
def test_get_default_site_delegates(facade: NautobotToCheckMKService) -> None:
    expected = MagicMock()
    facade.operations_service.get_default_site.return_value = expected

    result = facade.get_default_site()

    assert result is expected
