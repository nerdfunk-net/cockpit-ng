"""Unit tests for NautobotMetadataService.

All tests run offline - no real Nautobot instance required.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from services.nautobot.metadata_service import NautobotMetadataService


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_get_device_custom_fields_returns_results() -> None:
    """Device custom fields are returned from the REST result list."""
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(return_value={"results": [{"name": "owner"}]})
    svc = NautobotMetadataService(mock_nb)

    result = await svc.get_device_custom_fields()

    assert result == [{"name": "owner"}]
    mock_nb.rest_request.assert_awaited_once_with("extras/custom-fields/?content_types=dcim.device")


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_get_prefix_custom_fields_returns_empty_list_when_missing_results() -> None:
    """Missing REST results are treated as an empty list."""
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(return_value={})
    svc = NautobotMetadataService(mock_nb)

    result = await svc.get_prefix_custom_fields()

    assert result == []


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_get_vm_custom_fields_uses_limit_zero_endpoint() -> None:
    """VM custom fields are fetched using the virtualization content type."""
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(return_value={"results": [{"name": "service"}]})
    svc = NautobotMetadataService(mock_nb)

    result = await svc.get_vm_custom_fields()

    assert result == [{"name": "service"}]
    mock_nb.rest_request.assert_awaited_once_with(
        "extras/custom-fields/?content_types=virtualization.virtualmachine&limit=0"
    )


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_get_custom_field_choices_returns_choices() -> None:
    """Custom field choices are returned for the requested field name."""
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(return_value={"results": [{"value": "gold"}]})
    svc = NautobotMetadataService(mock_nb)

    result = await svc.get_custom_field_choices("support_tier")

    assert result == [{"value": "gold"}]
    mock_nb.rest_request.assert_awaited_once_with("extras/custom-field-choices/?custom_field=support_tier")
