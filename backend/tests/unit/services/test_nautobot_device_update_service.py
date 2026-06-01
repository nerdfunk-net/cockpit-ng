"""Unit tests for DeviceUpdateService.

All tests run offline - no real Nautobot instance required.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from services.nautobot.devices.types import InterfaceUpdateResult
from services.nautobot.devices.update import DeviceUpdateService
from tests.mocks import (
    DT_NETWORKA_ID,
    LOC_CITYA_ID,
    NS_GLOBAL_ID,
    PLATFORM_IOS_ID,
    ROLE_NETWORK_ID,
    STATUS_ACTIVE_ID,
    FakeNautobotService,
)

DEVICE_ID = "ab000000-0000-0000-0003-000000000001"
IP_ID = "ab000000-0000-0000-0001-000000000001"


def _device(name: str = "router-01", status: str = STATUS_ACTIVE_ID) -> dict:
    return {
        "id": DEVICE_ID,
        "name": name,
        "status": status,
        "primary_ip4": {"id": IP_ID, "address": "10.0.0.1/24"},
    }


def _service_with_mocked_facades() -> DeviceUpdateService:
    svc = DeviceUpdateService(FakeNautobotService())
    svc.common = MagicMock()
    svc.common.resolve_device_id = AsyncMock(return_value=DEVICE_ID)
    svc.common.get_device_details = AsyncMock(
        side_effect=[_device(), _device(status=STATUS_ACTIVE_ID)]
    )
    svc.common.extract_primary_ip_address = AsyncMock(return_value="10.0.0.1/24")
    svc.common.verify_device_updates = AsyncMock(return_value=(True, []))
    svc.interface_manager = MagicMock()
    svc.interface_manager.update_device_interfaces = AsyncMock(
        return_value=InterfaceUpdateResult(
            interfaces_created=1,
            interfaces_updated=0,
            interfaces_failed=0,
            ip_addresses_created=1,
            primary_ip4_id=IP_ID,
            warnings=[],
        )
    )
    return svc


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_resolve_device_id_uses_provided_uuid() -> None:
    """A valid device UUID is accepted and the device name is fetched from REST."""
    fake = FakeNautobotService()
    fake.seed_device(DEVICE_ID, {"name": "router-01"})
    svc = DeviceUpdateService(fake)

    result = await svc._resolve_device_id({"id": DEVICE_ID})

    assert result == (DEVICE_ID, "router-01")


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_resolve_device_id_fetches_name_when_identifier_is_ip() -> None:
    """IP-based resolution fetches the resolved device name from REST."""
    fake = FakeNautobotService()
    fake.seed_ip(IP_ID, {"address": "10.0.0.1/24"})
    fake.seed_device(
        DEVICE_ID,
        {
            "name": "router-from-ip",
            "primary_ip4": {"id": IP_ID, "address": "10.0.0.1/24"},
        },
    )
    svc = DeviceUpdateService(fake)

    result = await svc._resolve_device_id(
        {"ip_address": "10.0.0.1/24"}, matching_strategy="exact"
    )

    assert result == (DEVICE_ID, "router-from-ip")


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_validate_update_data_resolves_names_and_normalizes_values() -> None:
    """Name-based update fields are resolved to UUIDs before PATCH."""
    svc = DeviceUpdateService(FakeNautobotService())

    validated, ip_namespace = await svc.validate_update_data(
        DEVICE_ID,
        {
            "status": "Active",
            "platform.name": "cisco_ios",
            "role": "Network",
            "location": "City A",
            "device_type": "networkA",
            "tags": "edge, core",
            "custom_fields": {"owner": "netops"},
            "ip_namespace": "Global",
            "empty_field": "  ",
        },
    )

    assert validated["status"] == STATUS_ACTIVE_ID
    assert validated["platform"] == PLATFORM_IOS_ID
    assert validated["role"] == ROLE_NETWORK_ID
    assert validated["location"] == LOC_CITYA_ID
    assert validated["device_type"] == DT_NETWORKA_ID
    assert validated["tags"] == ["edge", "core"]
    assert validated["custom_fields"] == {"owner": "netops"}
    assert "empty_field" not in validated
    assert ip_namespace == "Global"


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_validate_update_data_drops_position_without_face() -> None:
    """Rack position is omitted when face is missing."""
    svc = DeviceUpdateService(FakeNautobotService())

    validated, _ = await svc.validate_update_data(
        DEVICE_ID,
        {"rack": None, "position": "12"},
    )

    assert validated["rack"] is None
    assert "position" not in validated


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_update_device_returns_noop_when_no_fields_or_interfaces() -> None:
    """An empty update returns success without PATCHing the device."""
    svc = _service_with_mocked_facades()
    svc.validate_update_data = AsyncMock(return_value=({}, None))

    result = await svc.update_device({"name": "router-01"}, {})

    assert result["success"] is True
    assert result["updated_fields"] == []
    assert result["warnings"] == ["No fields to update and no interfaces"]
    svc.interface_manager.update_device_interfaces.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_update_device_processes_interfaces_without_device_field_updates() -> (
    None
):
    """Interfaces are still processed when no device properties change."""
    svc = _service_with_mocked_facades()
    svc.validate_update_data = AsyncMock(return_value=({}, None))

    result = await svc.update_device(
        {"name": "router-01"},
        {},
        interfaces=[
            {"name": "Loopback0", "type": "virtual", "ip_address": "10.0.0.2/32"}
        ],
    )

    assert result["success"] is True
    assert result["interfaces_created"] == 1
    svc.interface_manager.update_device_interfaces.assert_awaited_once_with(
        device_id=DEVICE_ID,
        interfaces=[
            {"name": "Loopback0", "type": "virtual", "ip_address": "10.0.0.2/32"}
        ],
        add_prefixes_automatically=True,
        sync_interfaces=False,
    )


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_update_device_adds_verification_warning_on_mismatch() -> None:
    """Verification mismatches are surfaced as warnings in the result."""
    svc = _service_with_mocked_facades()
    svc.validate_update_data = AsyncMock(
        return_value=({"status": STATUS_ACTIVE_ID}, None)
    )
    svc._update_device_properties = AsyncMock(return_value=["status"])
    svc.common.verify_device_updates = AsyncMock(
        return_value=(
            False,
            [{"field": "status", "expected": STATUS_ACTIVE_ID, "actual": "wrong"}],
        )
    )

    result = await svc.update_device({"name": "router-01"}, {"status": "Active"})

    assert result["success"] is True
    assert "Some updates may not have been applied correctly" in result["warnings"]
    assert f"status: expected {STATUS_ACTIVE_ID}, got wrong" in result["warnings"]


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_update_device_properties_converts_primary_ip_to_uuid() -> None:
    """Primary IP updates create/resolve an IP and PATCH its UUID onto the device."""
    fake = FakeNautobotService()
    fake.seed_device(DEVICE_ID, {"name": "router-01", "primary_ip4": None})
    svc = DeviceUpdateService(fake)
    svc.common.update_interface_ip = AsyncMock(return_value=IP_ID)

    fields = await svc._update_device_properties(
        device_id=DEVICE_ID,
        validated_data={"primary_ip4": "10.0.0.2/24"},
        device_name="router-01",
        current_primary_ip4="10.0.0.1/24",
        ip_namespace=NS_GLOBAL_ID,
    )

    assert fields == ["primary_ip4"]
    assert fake._devices[DEVICE_ID]["primary_ip4"] == IP_ID
    svc.common.update_interface_ip.assert_awaited_once()
