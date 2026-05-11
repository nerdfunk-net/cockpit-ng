"""Unit tests for Nautobot resolvers using FakeNautobotService.

Tests DeviceResolver, MetadataResolver, and NetworkResolver in isolation.
"""

import pytest

from services.nautobot.resolvers.device_resolver import DeviceResolver
from services.nautobot.resolvers.metadata_resolver import MetadataResolver
from services.nautobot.resolvers.network_resolver import NetworkResolver
from tests.mocks import (
    FakeNautobotService,
    STATUS_ACTIVE_ID,
    PLATFORM_IOS_ID,
    ROLE_NETWORK_ID,
    LOC_CITYA_ID,
    NS_GLOBAL_ID,
    DT_NETWORKA_ID,
)

# Pre-seeded device and IP for lookup tests
DEVICE_ID = "cc000000-0000-0000-0003-000000000001"
IP_ID = "cc000000-0000-0000-0001-000000000001"
IFACE_ID = "cc000000-0000-0000-0002-000000000001"


@pytest.fixture
def fake_nb() -> FakeNautobotService:
    fake = FakeNautobotService()
    fake.seed_ip(IP_ID, {"address": "10.0.1.1/32", "namespace_id": NS_GLOBAL_ID})
    fake.seed_interface(
        IFACE_ID,
        {
            "name": "Loopback0",
            "device_id": DEVICE_ID,
            "ip_addresses": [{"id": IP_ID, "address": "10.0.1.1/32"}],
        },
    )
    fake.seed_device(
        DEVICE_ID,
        {
            "name": "router-alpha",
            "primary_ip4": {"id": IP_ID, "address": "10.0.1.1/32"},
            "interfaces": [{"id": IFACE_ID, "name": "Loopback0"}],
        },
    )
    return fake


# ── DeviceResolver ──────────────────────────────────────────────────────────────


class TestDeviceResolver:
    @pytest.fixture
    def resolver(self, fake_nb) -> DeviceResolver:
        return DeviceResolver(fake_nb)

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_resolve_by_name_found(self, resolver):
        result = await resolver.resolve_device_by_name("router-alpha")
        assert result == DEVICE_ID

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_resolve_by_name_not_found(self, resolver):
        result = await resolver.resolve_device_by_name("does-not-exist")
        assert result is None

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_resolve_by_ip_found(self, resolver):
        result = await resolver.resolve_device_by_ip("10.0.1.1/32")
        assert result == DEVICE_ID

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_resolve_by_ip_not_found(self, resolver):
        result = await resolver.resolve_device_by_ip("192.168.99.1")
        assert result is None

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_resolve_device_id_prefers_valid_uuid(self, resolver):
        result = await resolver.resolve_device_id(device_id=DEVICE_ID)
        assert result == DEVICE_ID

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_resolve_device_id_falls_back_to_name(self, resolver):
        result = await resolver.resolve_device_id(device_name="router-alpha")
        assert result == DEVICE_ID

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_resolve_device_id_falls_back_to_ip(self, resolver):
        result = await resolver.resolve_device_id(ip_address="10.0.1.1/32")
        assert result == DEVICE_ID

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_resolve_device_id_returns_none_when_nothing_matches(self, resolver):
        result = await resolver.resolve_device_id(device_name="ghost")
        assert result is None

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_resolve_by_name_contains(self, resolver):
        result = await resolver.resolve_device_by_name_contains("alpha")
        assert result == DEVICE_ID

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_resolve_by_name_starts_with(self, resolver):
        result = await resolver.resolve_device_by_name_starts_with("router")
        assert result == DEVICE_ID

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_resolve_device_type_id_found(self, resolver):
        result = await resolver.resolve_device_type_id("networkA")
        assert result == DT_NETWORKA_ID

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_resolve_device_type_id_not_found(self, resolver):
        result = await resolver.resolve_device_type_id("ghost-type")
        assert result is None

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_get_device_type_display(self, resolver):
        result = await resolver.get_device_type_display(DT_NETWORKA_ID)
        assert result == "Cisco networkA"

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_find_interface_with_ip(self, resolver):
        result = await resolver.find_interface_with_ip("router-alpha", "10.0.1.1/32")
        assert result is not None
        iface_id, iface_name = result
        assert iface_id == IFACE_ID
        assert iface_name == "Loopback0"

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_find_interface_with_ip_not_found(self, resolver):
        result = await resolver.find_interface_with_ip("router-alpha", "1.2.3.4")
        assert result is None


# ── MetadataResolver ────────────────────────────────────────────────────────────


class TestMetadataResolver:
    @pytest.fixture
    def resolver(self, fake_nb) -> MetadataResolver:
        return MetadataResolver(fake_nb)

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_resolve_status_id_by_name(self, resolver):
        result = await resolver.resolve_status_id("Active", "dcim.device")
        assert result == STATUS_ACTIVE_ID

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_resolve_status_id_case_insensitive(self, resolver):
        result = await resolver.resolve_status_id("active", "dcim.device")
        assert result == STATUS_ACTIVE_ID

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_resolve_status_id_passthrough_uuid(self, resolver):
        result = await resolver.resolve_status_id(STATUS_ACTIVE_ID, "dcim.device")
        assert result == STATUS_ACTIVE_ID

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_resolve_status_id_not_found_raises(self, resolver):
        with pytest.raises(ValueError):
            await resolver.resolve_status_id("NonExistentStatus", "dcim.device")

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_resolve_role_id_found(self, resolver):
        result = await resolver.resolve_role_id("Network")
        assert result == ROLE_NETWORK_ID

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_resolve_role_id_not_found(self, resolver):
        result = await resolver.resolve_role_id("UnknownRole")
        assert result is None

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_resolve_platform_id_found(self, resolver):
        result = await resolver.resolve_platform_id("cisco_ios")
        assert result == PLATFORM_IOS_ID

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_resolve_platform_id_not_found(self, resolver):
        result = await resolver.resolve_platform_id("unknown_os")
        assert result is None

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_get_platform_name_found(self, resolver):
        result = await resolver.get_platform_name(PLATFORM_IOS_ID)
        assert result == "cisco_ios"

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_resolve_location_id_found(self, resolver):
        result = await resolver.resolve_location_id("City A")
        assert result == LOC_CITYA_ID

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_resolve_location_id_not_found(self, resolver):
        result = await resolver.resolve_location_id("Atlantis")
        assert result is None

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_resolve_rack_id_not_found_returns_none(self, resolver):
        result = await resolver.resolve_rack_id("Rack-01")
        assert result is None


# ── NetworkResolver ─────────────────────────────────────────────────────────────


class TestNetworkResolver:
    @pytest.fixture
    def resolver(self, fake_nb) -> NetworkResolver:
        return NetworkResolver(fake_nb)

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_resolve_namespace_id_found(self, resolver):
        result = await resolver.resolve_namespace_id("Global")
        assert result == NS_GLOBAL_ID

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_resolve_namespace_id_passthrough_uuid(self, resolver):
        result = await resolver.resolve_namespace_id(NS_GLOBAL_ID)
        assert result == NS_GLOBAL_ID

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_resolve_namespace_id_not_found_raises(self, resolver):
        with pytest.raises(ValueError):
            await resolver.resolve_namespace_id("NonExistentNamespace")

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_resolve_ip_address_found(self, resolver):
        result = await resolver.resolve_ip_address("10.0.1.1/32", NS_GLOBAL_ID)
        assert result == IP_ID

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_resolve_ip_address_not_found(self, resolver):
        result = await resolver.resolve_ip_address("1.2.3.4/32", NS_GLOBAL_ID)
        assert result is None

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_resolve_interface_by_name_found(self, resolver):
        result = await resolver.resolve_interface_by_name(DEVICE_ID, "Loopback0")
        assert result == IFACE_ID

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_resolve_interface_by_name_not_found(self, resolver):
        result = await resolver.resolve_interface_by_name(
            DEVICE_ID, "GigabitEthernet9/0"
        )
        assert result is None

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_resolve_prefix_found(self, resolver, fake_nb):
        prefix_id = "dd000000-0000-0000-0001-000000000001"
        fake_nb._prefixes[prefix_id] = {
            "id": prefix_id,
            "prefix": "10.0.0.0/24",
            "namespace": NS_GLOBAL_ID,
        }
        result = await resolver.resolve_prefix("10.0.0.0/24", NS_GLOBAL_ID)
        assert result == prefix_id

    @pytest.mark.asyncio
    @pytest.mark.unit
    async def test_resolve_prefix_not_found(self, resolver):
        result = await resolver.resolve_prefix("172.16.99.0/24", NS_GLOBAL_ID)
        assert result is None
