"""Unit tests for DeviceCreationService using FakeNautobotService.

All tests run offline - no real Nautobot instance required.
"""

import pytest
from unittest.mock import patch, MagicMock

from models.nautobot import AddDeviceRequest, InterfaceData, IpAddressData
from services.nautobot.devices.creation import DeviceCreationService
from tests.mocks import (
    FakeNautobotService,
    STATUS_ACTIVE_ID,
    DT_NETWORKA_ID,
    LOC_CITYA_ID,
    ROLE_NETWORK_ID,
    NS_GLOBAL_ID,
    PLATFORM_IOS_ID,
)


# ── Helpers ────────────────────────────────────────────────────────────────────


def make_request(**overrides) -> AddDeviceRequest:
    """Factory for AddDeviceRequest with sensible defaults (uses names, not UUIDs)."""
    defaults = {
        "name": "test-router-01",
        "role": "Network",
        "status": "Active",
        "location": "City A",
        "device_type": "networkA",
    }
    defaults.update(overrides)
    return AddDeviceRequest(**defaults)


def make_request_with_uuids(**overrides) -> AddDeviceRequest:
    """Factory for AddDeviceRequest that skips name resolution (uses seed UUIDs directly)."""
    defaults = {
        "name": "test-router-01",
        "role": ROLE_NETWORK_ID,
        "status": STATUS_ACTIVE_ID,
        "location": LOC_CITYA_ID,
        "device_type": DT_NETWORKA_ID,
    }
    defaults.update(overrides)
    return AddDeviceRequest(**defaults)


def make_interface(name: str = "Loopback0", ip: str | None = None) -> InterfaceData:
    ip_addresses = []
    if ip:
        ip_addresses.append(IpAddressData(address=ip, namespace="Global", is_primary=True))
    return InterfaceData(name=name, type="virtual", status="active", ip_addresses=ip_addresses)


@pytest.fixture
def fake_nb() -> FakeNautobotService:
    return FakeNautobotService()


@pytest.fixture
def creation_service(fake_nb):
    """DeviceCreationService with FakeNautobotService injected via service_factory patch."""
    with patch("service_factory.build_nautobot_service", return_value=fake_nb):
        with patch("services.nautobot.devices.creation.audit_log_repo", MagicMock()):
            yield DeviceCreationService()


# ── Tests: basic device creation ───────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_basic_device_success(creation_service, fake_nb):
    """A minimal request with name-based fields should create a device and return success."""
    result = await creation_service.create_device_with_interfaces(make_request())

    assert result["success"] is True
    assert result["device_id"] is not None
    # Device should exist in the fake store
    assert result["device_id"] in fake_nb._devices


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_device_stores_correct_name(creation_service, fake_nb):
    """Created device should have the requested name."""
    result = await creation_service.create_device_with_interfaces(
        make_request(name="core-switch-99")
    )

    assert result["success"] is True
    device = fake_nb._devices[result["device_id"]]
    assert device["name"] == "core-switch-99"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_device_resolves_names_to_uuids(creation_service, fake_nb):
    """Service should resolve human-readable names to UUIDs before calling the API."""
    result = await creation_service.create_device_with_interfaces(make_request())

    assert result["success"] is True
    device = fake_nb._devices[result["device_id"]]
    # All IDs in the stored device must be UUIDs, not names
    assert device.get("role") == ROLE_NETWORK_ID
    assert device.get("status") == STATUS_ACTIVE_ID
    assert device.get("location") == LOC_CITYA_ID
    assert device.get("device_type") == DT_NETWORKA_ID


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_device_with_uuid_fields_skips_resolution(creation_service, fake_nb):
    """Fields that are already valid UUIDs must be passed through unchanged."""
    result = await creation_service.create_device_with_interfaces(
        make_request_with_uuids()
    )

    assert result["success"] is True
    assert result["device_id"] in fake_nb._devices


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_device_with_platform(creation_service, fake_nb):
    """Optional platform field should be resolved and stored."""
    result = await creation_service.create_device_with_interfaces(
        make_request(platform="cisco_ios")
    )

    assert result["success"] is True
    device = fake_nb._devices[result["device_id"]]
    assert device.get("platform") == PLATFORM_IOS_ID


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_device_with_loopback_interface(creation_service, fake_nb):
    """A request with one interface + IP should create the device, interface, and IP."""
    request = make_request_with_uuids(
        interfaces=[make_interface("Loopback0", "192.168.1.1/24")]
    )

    result = await creation_service.create_device_with_interfaces(request)

    assert result["success"] is True
    assert result["device_id"] in fake_nb._devices
    assert len(fake_nb._interfaces) == 1
    assert len(fake_nb._ip_addresses) == 1


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_device_with_multiple_interfaces(creation_service, fake_nb):
    """Multiple interfaces should all be created."""
    request = make_request_with_uuids(interfaces=[
        make_interface("Loopback0", "10.0.0.1/32"),
        make_interface("GigabitEthernet0/0", "192.168.1.1/24"),
        make_interface("GigabitEthernet0/1"),
    ])

    result = await creation_service.create_device_with_interfaces(request)

    assert result["success"] is True
    assert len(fake_nb._interfaces) == 3


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_device_primary_ip_assigned(creation_service, fake_nb):
    """Interface marked is_primary=True should cause primary IP to be assigned on the device."""
    request = make_request_with_uuids(
        interfaces=[make_interface("Loopback0", "10.10.10.1/32")]
    )

    result = await creation_service.create_device_with_interfaces(request)

    assert result["success"] is True
    assert result["summary"]["primary_ipv4_assigned"] is True


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_device_without_interfaces_succeeds(creation_service, fake_nb):
    """A request with no interfaces should succeed with interfaces_created=0."""
    result = await creation_service.create_device_with_interfaces(
        make_request_with_uuids(interfaces=[])
    )

    assert result["success"] is True
    assert result["summary"]["interfaces_created"] == 0
    assert len(fake_nb._interfaces) == 0


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_device_dry_run_no_writes(creation_service, fake_nb):
    """dry_run=True must validate but must NOT create any resources."""
    result = await creation_service.create_device_with_interfaces(
        make_request_with_uuids(dry_run=True)
    )

    assert result["dry_run"] is True
    assert len(fake_nb._devices) == 0
    assert len(fake_nb._interfaces) == 0
    assert len(fake_nb._ip_addresses) == 0


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_device_dry_run_passes_when_valid(creation_service, fake_nb):
    """dry_run on a valid request should succeed (no errors)."""
    result = await creation_service.create_device_with_interfaces(
        make_request_with_uuids(dry_run=True)
    )

    assert result["dry_run"] is True
    assert result["success"] is True
    assert result["errors"] == []


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_device_dry_run_detects_missing_device_type(creation_service, fake_nb):
    """dry_run should report error when device_type UUID does not exist."""
    request = make_request_with_uuids(
        dry_run=True,
        device_type="99999999-9999-9999-9999-000000000001",  # non-existent
    )

    result = await creation_service.create_device_with_interfaces(request)

    assert result["dry_run"] is True
    assert result["success"] is False
    assert len(result["errors"]) > 0


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_device_duplicate_returns_error():
    """When Nautobot returns a duplicate error, result should indicate failure."""
    fake_dup = FakeNautobotService(error_on={("dcim/devices", "POST"): "duplicate"})
    with patch("service_factory.build_nautobot_service", return_value=fake_dup):
        with patch("services.nautobot.devices.creation.audit_log_repo", MagicMock()):
            service = DeviceCreationService()

    with pytest.raises(Exception) as exc_info:
        await service.create_device_with_interfaces(make_request_with_uuids())

    assert exc_info.value is not None


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_device_with_prefix_auto_creation(creation_service, fake_nb):
    """When add_prefix=True, prefixes for interface IPs should be created before the IPs."""
    request = make_request_with_uuids(
        add_prefix=True,
        interfaces=[make_interface("Loopback0", "172.16.1.1/24")],
    )

    result = await creation_service.create_device_with_interfaces(request)

    assert result["success"] is True
    assert len(fake_nb._prefixes) >= 1


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_device_with_virtual_chassis(creation_service, fake_nb):
    """new_virtual_chassis_name should create a VC and assign the device as master."""
    request = make_request_with_uuids(
        new_virtual_chassis_name="test-stack-01"
    )

    result = await creation_service.create_device_with_interfaces(request)

    assert result["success"] is True
    assert len(fake_nb._virtual_chassis) == 1


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_device_with_serial_and_asset_tag(creation_service, fake_nb):
    """Serial and asset_tag optional fields should be stored on the device."""
    result = await creation_service.create_device_with_interfaces(
        make_request_with_uuids(serial="SN-001", asset_tag="ASSET-001")
    )

    assert result["success"] is True
    device = fake_nb._devices[result["device_id"]]
    assert device.get("serial") == "SN-001"
    assert device.get("asset_tag") == "ASSET-001"
