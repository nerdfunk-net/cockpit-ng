"""Unit tests for Nautobot managers using FakeNautobotService.

Tests IPManager, InterfaceManager, and DeviceManager in isolation.
"""

import pytest

from services.nautobot.managers.ip_manager import IPManager
from services.nautobot.managers.interface_manager import InterfaceManager
from services.nautobot.managers.device_manager import DeviceManager
from services.nautobot.resolvers.device_resolver import DeviceResolver
from services.nautobot.resolvers.network_resolver import NetworkResolver
from services.nautobot.resolvers.metadata_resolver import MetadataResolver
from services.nautobot.common.exceptions import NautobotAPIError
from tests.mocks import (
    FakeNautobotService,
    STATUS_ACTIVE_ID,
    NS_GLOBAL_ID,
)

DEVICE_ID = "ee000000-0000-0000-0003-000000000001"
IP_ID     = "ee000000-0000-0000-0001-000000000001"
IFACE_ID  = "ee000000-0000-0000-0002-000000000001"


@pytest.fixture
def fake_nb() -> FakeNautobotService:
    fake = FakeNautobotService()
    fake.seed_device(DEVICE_ID, {
        "name": "test-device",
        "status": {"id": STATUS_ACTIVE_ID, "name": "Active"},
        "primary_ip4": None,
    })
    return fake


@pytest.fixture
def network_resolver(fake_nb) -> NetworkResolver:
    return NetworkResolver(fake_nb)


@pytest.fixture
def metadata_resolver(fake_nb) -> MetadataResolver:
    return MetadataResolver(fake_nb)


@pytest.fixture
def ip_manager(fake_nb, network_resolver, metadata_resolver) -> IPManager:
    return IPManager(fake_nb, network_resolver, metadata_resolver)


@pytest.fixture
def interface_manager(fake_nb, network_resolver, metadata_resolver, ip_manager) -> InterfaceManager:
    return InterfaceManager(fake_nb, network_resolver, metadata_resolver, ip_manager)


@pytest.fixture
def device_resolver(fake_nb) -> DeviceResolver:
    return DeviceResolver(fake_nb)


@pytest.fixture
def device_manager(fake_nb, device_resolver, network_resolver) -> DeviceManager:
    return DeviceManager(fake_nb, device_resolver, network_resolver)


# ── IPManager tests ─────────────────────────────────────────────────────────────


class TestIPManager:
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_ensure_ip_creates_new(self, ip_manager, fake_nb):
        """IP that doesn't exist should be created."""
        ip_id = await ip_manager.ensure_ip_address_exists(
            ip_address="10.1.1.1/24",
            namespace_id=NS_GLOBAL_ID,
        )

        assert ip_id is not None
        assert ip_id in fake_nb._ip_addresses
        assert fake_nb._ip_addresses[ip_id]["address"] == "10.1.1.1/24"

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_ensure_ip_returns_existing(self, ip_manager, fake_nb):
        """IP that already exists should return the existing UUID without creating duplicate."""
        fake_nb.seed_ip(IP_ID, {"address": "10.1.1.1/24", "namespace_id": NS_GLOBAL_ID})

        ip_id = await ip_manager.ensure_ip_address_exists(
            ip_address="10.1.1.1/24",
            namespace_id=NS_GLOBAL_ID,
        )

        assert ip_id == IP_ID
        assert len(fake_nb._ip_addresses) == 1

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_ensure_ip_with_missing_prefix_and_auto_create(self, ip_manager, fake_nb):
        """With add_prefixes_automatically=True, a missing prefix error should trigger prefix creation."""
        # Simulate missing-prefix error on first POST, then succeed on retry
        call_count = {"n": 0}
        original_ip_list = fake_nb._ip_list

        def ip_list_with_prefix_error(method, params, data):
            if method == "POST":
                call_count["n"] += 1
                if call_count["n"] == 1:
                    raise NautobotAPIError(
                        "No suitable parent Prefix exists in namespace for 10.2.2.1/24"
                    )
            return original_ip_list(method, params, data)

        fake_nb._ip_list = ip_list_with_prefix_error

        ip_id = await ip_manager.ensure_ip_address_exists(
            ip_address="10.2.2.1/24",
            namespace_id=NS_GLOBAL_ID,
            add_prefixes_automatically=True,
        )

        assert ip_id is not None
        # A prefix should have been created
        assert len(fake_nb._prefixes) >= 1

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_ensure_ip_missing_prefix_no_auto_create_raises(self, ip_manager, fake_nb):
        """Without auto-prefix creation, a missing-prefix error should propagate."""
        original_ip_list = fake_nb._ip_list

        def always_raise_prefix_error(method, params, data):
            if method == "POST":
                raise NautobotAPIError(
                    "No suitable parent Prefix exists in namespace"
                )
            return original_ip_list(method, params, data)

        fake_nb._ip_list = always_raise_prefix_error

        with pytest.raises(NautobotAPIError, match="No suitable parent prefix"):
            await ip_manager.ensure_ip_address_exists(
                ip_address="10.3.3.1/24",
                namespace_id=NS_GLOBAL_ID,
                add_prefixes_automatically=False,
            )

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_assign_ip_to_interface_creates_association(self, ip_manager, fake_nb):
        fake_nb.seed_ip(IP_ID, {"address": "10.1.1.1/24"})

        result = await ip_manager.assign_ip_to_interface(IP_ID, IFACE_ID)

        assert result is not None
        assert len(fake_nb._ip_iface_assocs) == 1

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_assign_ip_to_interface_no_duplicate(self, ip_manager, fake_nb):
        """Second assignment call for same IP+interface should return existing, not create new."""
        fake_nb.seed_ip(IP_ID, {"address": "10.1.1.1/24"})

        await ip_manager.assign_ip_to_interface(IP_ID, IFACE_ID)
        await ip_manager.assign_ip_to_interface(IP_ID, IFACE_ID)

        assert len(fake_nb._ip_iface_assocs) == 1


# ── InterfaceManager tests ──────────────────────────────────────────────────────


class TestInterfaceManager:
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_ensure_interface_creates_new(self, interface_manager, fake_nb):
        iface_id = await interface_manager.ensure_interface_exists(
            device_id=DEVICE_ID,
            interface_name="Loopback0",
        )

        assert iface_id is not None
        assert iface_id in fake_nb._interfaces
        assert fake_nb._interfaces[iface_id]["name"] == "Loopback0"

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_ensure_interface_returns_existing(self, interface_manager, fake_nb):
        fake_nb.seed_interface(IFACE_ID, {
            "name": "Loopback0",
            "device_id": DEVICE_ID,
        })

        iface_id = await interface_manager.ensure_interface_exists(
            device_id=DEVICE_ID,
            interface_name="Loopback0",
        )

        assert iface_id == IFACE_ID
        assert len(fake_nb._interfaces) == 1

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_ensure_interface_with_ip_creates_all(self, interface_manager, fake_nb):
        ip_id = await interface_manager.ensure_interface_with_ip(
            device_id=DEVICE_ID,
            ip_address="192.168.1.1/24",
            interface_name="Management",
        )

        assert ip_id is not None
        assert ip_id in fake_nb._ip_addresses
        # Interface should also be created
        assert len(fake_nb._interfaces) >= 1
        # Association should be created
        assert len(fake_nb._ip_iface_assocs) >= 1


# ── DeviceManager tests ─────────────────────────────────────────────────────────


class TestDeviceManager:
    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_get_device_details_found(self, device_manager, fake_nb):
        result = await device_manager.get_device_details(DEVICE_ID)
        assert result["id"] == DEVICE_ID
        assert result["name"] == "test-device"

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_assign_primary_ip_updates_device(self, device_manager, fake_nb):
        fake_nb.seed_ip(IP_ID, {"address": "10.0.0.1/24"})

        success = await device_manager.assign_primary_ip_to_device(DEVICE_ID, IP_ID)

        assert success is True
        device = fake_nb._devices[DEVICE_ID]
        assert device.get("primary_ip4") == IP_ID

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_verify_device_updates_all_match(self, device_manager, fake_nb):
        fake_nb._devices[DEVICE_ID]["serial"] = "SN-001"

        actual = fake_nb._devices[DEVICE_ID]
        success, diffs = await device_manager.verify_device_updates(
            DEVICE_ID,
            expected_updates={"serial": "SN-001"},
            actual_device=actual,
        )

        assert success is True
        assert diffs == []

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_verify_device_updates_detects_mismatch(self, device_manager, fake_nb):
        fake_nb._devices[DEVICE_ID]["serial"] = "SN-WRONG"

        actual = fake_nb._devices[DEVICE_ID]
        success, diffs = await device_manager.verify_device_updates(
            DEVICE_ID,
            expected_updates={"serial": "SN-001"},
            actual_device=actual,
        )

        assert success is False
        assert len(diffs) >= 1
