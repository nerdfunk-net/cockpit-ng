"""Unit tests for services/inventory/export_service.py."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from models.inventory import DeviceInfo
from services.inventory.export_service import InventoryExportService


def _device(**kwargs: object) -> DeviceInfo:
    defaults = {
        "id": "uuid-1",
        "name": "sw1",
        "location": "DC1",
        "role": "access",
        "tags": ["prod"],
        "device_type": "C9300",
        "manufacturer": "Cisco",
        "platform": "ios",
        "primary_ip4": "10.0.0.1",
        "status": "active",
    }
    defaults.update(kwargs)
    return DeviceInfo(**defaults)


@pytest.mark.asyncio
@pytest.mark.unit
async def test_render_inventory_delegates_to_template_service() -> None:
    template_mgr = MagicMock()
    template_mgr.render_template.return_value = "all:\n  hosts:\n    sw1:"

    svc = InventoryExportService()
    with patch(
        "service_factory.build_template_service",
        return_value=template_mgr,
    ):
        content, count = await svc.render_inventory(
            [_device()],
            template_name="inventory.j2",
            template_category="ansible",
        )

    assert count == 1
    assert "sw1" in content
    template_mgr.render_template.assert_called_once()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_analyze_devices_empty_list() -> None:
    svc = InventoryExportService()
    result = await svc.analyze_devices([])

    assert result["device_count"] == 0
    assert result["locations"] == []


@pytest.mark.asyncio
@pytest.mark.unit
async def test_analyze_devices_aggregates_fields() -> None:
    query_svc = MagicMock()
    query_svc.get_device_details = AsyncMock(
        return_value={
            "location": {"name": "DC1"},
            "role": {"name": "access"},
            "status": {"name": "active"},
            "tags": [{"name": "prod"}],
            "_custom_field_data": {"owner": "netops"},
        }
    )

    svc = InventoryExportService()
    with patch(
        "service_factory.build_device_query_service",
        return_value=query_svc,
    ):
        result = await svc.analyze_devices([_device()])

    assert result["device_count"] == 1
    assert "DC1" in result["locations"]
    assert "access" in result["roles"]
    assert "prod" in result["tags"]
