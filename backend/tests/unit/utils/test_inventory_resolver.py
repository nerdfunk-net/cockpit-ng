"""Unit tests for utils/inventory_resolver.py."""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from utils.inventory_resolver import (
    resolve_inventory_to_device_ids,
    resolve_inventory_to_device_ids_sync,
)

_PATCH_PERSIST = "service_factory.build_inventory_persistence_service"
_PATCH_INV = "service_factory.build_inventory_service"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_resolve_inventory_returns_none_when_not_found() -> None:
    mock_persistence = MagicMock()
    mock_persistence.get_inventory_by_name.return_value = None

    with patch(_PATCH_PERSIST, return_value=mock_persistence):
        with patch(_PATCH_INV, return_value=MagicMock()):
            result = await resolve_inventory_to_device_ids("missing", "alice")

    assert result is None


@pytest.mark.asyncio
@pytest.mark.unit
async def test_resolve_inventory_returns_none_when_no_conditions() -> None:
    mock_persistence = MagicMock()
    mock_persistence.get_inventory_by_name.return_value = {"conditions": []}

    with patch(_PATCH_PERSIST, return_value=mock_persistence):
        with patch(_PATCH_INV, return_value=MagicMock()):
            result = await resolve_inventory_to_device_ids("empty", "alice")

    assert result is None


@pytest.mark.asyncio
@pytest.mark.unit
async def test_resolve_inventory_returns_device_ids() -> None:
    mock_persistence = MagicMock()
    mock_persistence.get_inventory_by_name.return_value = {
        "conditions": [{"type": "group", "operator": "AND", "children": []}],
    }
    mock_inventory = MagicMock()
    device = SimpleNamespace(id="uuid-1", name="r1")
    mock_inventory.preview_inventory = AsyncMock(return_value=([device], 1))

    with patch(_PATCH_PERSIST, return_value=mock_persistence):
        with patch(_PATCH_INV, return_value=mock_inventory):
            with patch(
                "utils.inventory_converter.convert_saved_inventory_to_operations",
                return_value=[MagicMock()],
            ):
                result = await resolve_inventory_to_device_ids("prod", "alice")

    assert result == ["uuid-1"]


@pytest.mark.unit
def test_resolve_inventory_sync_wrapper() -> None:
    with patch(
        "utils.inventory_resolver.resolve_inventory_to_device_ids",
        new_callable=AsyncMock,
        return_value=["id-1"],
    ) as async_resolve:
        result = resolve_inventory_to_device_ids_sync("prod", "bob")

    assert result == ["id-1"]
    async_resolve.assert_awaited_once_with("prod", "bob")
