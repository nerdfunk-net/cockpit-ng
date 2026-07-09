"""Unit tests for InterfaceManagerService's creation-only default interface type.

All tests run offline against FakeNautobotService - no real Nautobot instance required.
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from services.nautobot.devices.interface_workflow import InterfaceManagerService
from tests.mocks import STATUS_ACTIVE_ID, FakeNautobotService

DEVICE_ID = "ab000000-0000-0000-0003-000000000001"
IFACE_ID = "ab000000-0000-0000-0002-000000000001"


def _manager() -> InterfaceManagerService:
    fake = FakeNautobotService()
    fake.seed_device(DEVICE_ID, {"name": "router-01"})
    return InterfaceManagerService(fake)


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_new_interface_uses_default_type_when_row_omits_it() -> None:
    """A brand-new interface with no 'type' falls back to default_interface_type."""
    mgr = _manager()

    result = await mgr.update_device_interfaces(
        device_id=DEVICE_ID,
        interfaces=[{"name": "Gi0/1", "status": "active"}],
        default_interface_type="1000base-t",
    )

    assert result.interfaces_created == 1
    assert result.interfaces_failed == 0
    created = next(iter(mgr.nautobot._interfaces.values()))
    assert created["type"] == "1000base-t"


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_new_interface_without_type_or_default_is_skipped() -> None:
    """No row type and no configured default -> interface is not created."""
    mgr = _manager()

    result = await mgr.update_device_interfaces(
        device_id=DEVICE_ID,
        interfaces=[{"name": "Gi0/1", "status": "active"}],
        default_interface_type=None,
    )

    assert result.interfaces_created == 0
    assert result.interfaces_failed == 0
    assert mgr.nautobot._interfaces == {}
    assert any("'type' is required" in w for w in result.warnings)


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_new_interface_row_type_wins_over_default() -> None:
    """A row-supplied type takes precedence over the configured default."""
    mgr = _manager()

    result = await mgr.update_device_interfaces(
        device_id=DEVICE_ID,
        interfaces=[{"name": "Gi0/1", "type": "10gbase-x-sfpp", "status": "active"}],
        default_interface_type="1000base-t",
    )

    assert result.interfaces_created == 1
    created = next(iter(mgr.nautobot._interfaces.values()))
    assert created["type"] == "10gbase-x-sfpp"


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_existing_interface_keeps_type_when_row_omits_it() -> None:
    """Patching an existing interface never applies the default type to it."""
    fake = FakeNautobotService()
    fake.seed_device(DEVICE_ID, {"name": "router-01"})
    fake.seed_interface(
        IFACE_ID,
        {
            "device_id": DEVICE_ID,
            "name": "Gi0/1",
            "type": "1000base-t",
            "status": STATUS_ACTIVE_ID,
        },
    )
    mgr = InterfaceManagerService(fake)

    result = await mgr.update_device_interfaces(
        device_id=DEVICE_ID,
        interfaces=[{"name": "Gi0/1"}],
        default_interface_type="10gbase-x-sfpp",
    )

    assert result.interfaces_updated == 1
    assert fake._interfaces[IFACE_ID]["type"] == "1000base-t"


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_existing_interface_type_overridden_when_row_supplies_one() -> None:
    """CSV wins: an explicit row type still overwrites an existing interface's type."""
    fake = FakeNautobotService()
    fake.seed_device(DEVICE_ID, {"name": "router-01"})
    fake.seed_interface(
        IFACE_ID,
        {
            "device_id": DEVICE_ID,
            "name": "Gi0/1",
            "type": "1000base-t",
            "status": STATUS_ACTIVE_ID,
        },
    )
    mgr = InterfaceManagerService(fake)

    result = await mgr.update_device_interfaces(
        device_id=DEVICE_ID,
        interfaces=[{"name": "Gi0/1", "type": "10gbase-x-sfpp"}],
        default_interface_type=None,
    )

    assert result.interfaces_updated == 1
    assert fake._interfaces[IFACE_ID]["type"] == "10gbase-x-sfpp"


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_existing_interface_ip_untouched_when_row_omits_it() -> None:
    """An interface row with no IP address doesn't clean the interface's existing IPs."""
    fake = FakeNautobotService()
    fake.seed_device(DEVICE_ID, {"name": "router-01"})
    fake.seed_interface(
        IFACE_ID,
        {
            "device_id": DEVICE_ID,
            "name": "Gi0/1",
            "type": "1000base-t",
            "status": STATUS_ACTIVE_ID,
        },
    )
    mgr = InterfaceManagerService(fake)
    mgr._clean_interface_ips = AsyncMock()

    result = await mgr.update_device_interfaces(
        device_id=DEVICE_ID,
        interfaces=[{"name": "Gi0/1"}],
        default_interface_type=None,
    )

    assert result.interfaces_updated == 1
    mgr._clean_interface_ips.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_existing_interface_ip_reassigned_when_row_supplies_one() -> None:
    """An interface row with an IP address cleans and reassigns the interface's IPs."""
    fake = FakeNautobotService()
    fake.seed_device(DEVICE_ID, {"name": "router-01"})
    fake.seed_interface(
        IFACE_ID,
        {
            "device_id": DEVICE_ID,
            "name": "Gi0/1",
            "type": "1000base-t",
            "status": STATUS_ACTIVE_ID,
        },
    )
    mgr = InterfaceManagerService(fake)
    mgr._clean_interface_ips = AsyncMock()

    result = await mgr.update_device_interfaces(
        device_id=DEVICE_ID,
        interfaces=[
            {
                "name": "Gi0/1",
                "ip_address": "10.0.0.5/24",
                "namespace": "Global",
            }
        ],
        default_interface_type=None,
    )

    assert result.interfaces_updated == 1
    mgr._clean_interface_ips.assert_awaited_once()
