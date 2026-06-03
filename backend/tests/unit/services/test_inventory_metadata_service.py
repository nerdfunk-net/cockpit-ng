"""Unit tests for services/inventory/metadata_service.py."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.inventory.metadata_service import InventoryMetadataService


@pytest.mark.asyncio
@pytest.mark.unit
async def test_get_custom_fields_caches_result() -> None:
    svc = InventoryMetadataService()
    nautobot = MagicMock()
    nautobot.rest_request = AsyncMock(
        return_value={
            "results": [
                {
                    "key": "asset_owner",
                    "label": "Asset Owner",
                    "type": "text",
                }
            ]
        }
    )

    with patch("service_factory.build_nautobot_service", return_value=nautobot):
        first = await svc.get_custom_fields()
        second = await svc.get_custom_fields()

    assert first == second
    assert first[0]["name"] == "asset_owner"
    nautobot.rest_request.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_get_custom_fields_invalid_response_returns_empty() -> None:
    svc = InventoryMetadataService()
    nautobot = MagicMock()
    nautobot.rest_request = AsyncMock(return_value={})

    with patch("service_factory.build_nautobot_service", return_value=nautobot):
        result = await svc.get_custom_fields()

    assert result == []


@pytest.mark.asyncio
@pytest.mark.unit
async def test_get_field_values_status_field() -> None:
    svc = InventoryMetadataService()
    nautobot = MagicMock()
    nautobot.rest_request = AsyncMock(
        return_value={"results": [{"name": "active"}, {"name": "planned"}]}
    )

    with patch("service_factory.build_nautobot_service", return_value=nautobot):
        values = await svc.get_field_values("status")

    assert values == [
        {"value": "active", "label": "active"},
        {"value": "planned", "label": "planned"},
    ]
