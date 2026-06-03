"""
Integration tests for the Add Device workflow using frontend form data.

These tests exercise the same backend path triggered by the Add Device page:
  POST /nautobot/add-device
  → DeviceCreationService.create_device_with_interfaces()

Test device data (mirrors the data entered in the frontend form):
  Device Name:        testdevice
  Serial Number:      12345
  Device Role:        Network  (renamed from "network")
  Device Status:      Active
  Location:           City A
  Device Type:        networkA  (manufacturer: NetworkInc)
  Platform:           Cisco IOS

  Interface Name:     Loopback
  Interface Type:     virtual
  Interface Status:   Active
  IP Address:         192.168.181.254/24

Setup:
  1. Configure .env.test with test Nautobot credentials
  2. Load baseline data into Nautobot (baseline.yaml)
  3. Run: pytest -m "integration and nautobot" tests/integration/test_add_device_form_data.py -v
"""

import logging

import pytest

from models.nautobot import AddDeviceRequest, InterfaceData, IpAddressData
from services.nautobot.devices.creation import DeviceCreationService

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEVICE_NAME = "testdevice"
DEVICE_SERIAL = "12345"

MANUFACTURER_NAME = "NetworkInc"
DEVICE_TYPE_MODEL = "networkA"
PLATFORM_NAME = "Cisco IOS"
ROLE_NAME = "Network"
STATUS_NAME = "Active"
LOCATION_NAME = "City A"
NAMESPACE_NAME = "Global"

INTERFACE_NAME = "Loopback"
INTERFACE_NAME_2 = "Loopback2"
INTERFACE_TYPE = "virtual"
IP_ADDRESS = "192.168.181.254/24"
IP_ADDRESS_2 = "192.168.181.253/24"

# The auto-created prefix derived from IP_ADDRESS and /24
AUTO_PREFIX = "192.168.181.0/24"

# IP used for the "no prefix" test (add_prefix=False, parent prefix absent)
IP_ADDRESS_NO_PREFIX = "192.168.182.254/24"
AUTO_PREFIX_NO_PREFIX = "192.168.182.0/24"

# VLAN used in VLAN-mode integration tests
VLAN_100_VID = 100
VLAN_100_NAME = "test-vlan-100"

# Interface property values used in metadata integration tests
IFACE_MAC_ADDRESS = "00:1A:2B:3C:4D:5E"
IFACE_MTU = 1499
IFACE_DESCRIPTION = "pytest description"


# ---------------------------------------------------------------------------
# Helpers – resource resolution and bootstrapping
# ---------------------------------------------------------------------------


async def _resolve_id(nautobot, query: str, path: tuple[str, ...]) -> str:
    """Run a GraphQL query and return the first result's ID at the given path."""
    result = await nautobot.graphql_query(query)
    data = result["data"]
    for key in path:
        data = data[key]
    assert data, f"No results found for query: {query}"
    return data[0]["id"]


async def get_or_create_manufacturer(nautobot, name: str) -> str:
    """Return the ID of the named manufacturer, creating it if absent."""
    query = f"""
    query {{
      manufacturers(name: "{name}") {{
        id
        name
      }}
    }}
    """
    result = await nautobot.graphql_query(query)
    manufacturers = result["data"]["manufacturers"]
    if manufacturers:
        return manufacturers[0]["id"]

    # Create it
    logger.info("Creating manufacturer '%s'", name)
    response = await nautobot.rest_request(
        endpoint="dcim/manufacturers/",
        method="POST",
        data={"name": name},
    )
    manufacturer_id = response["id"]
    logger.info("✓ Created manufacturer '%s' (%s)", name, manufacturer_id)
    return manufacturer_id


async def get_or_create_device_type(
    nautobot, model: str, manufacturer_id: str
) -> tuple[str, bool]:
    """
    Return (device_type_id, was_created) for the named model and manufacturer.
    Creates the device type if it doesn't already exist.
    """
    query = f"""
    query {{
      device_types(model: "{model}") {{
        id
        model
        manufacturer {{
          id
        }}
      }}
    }}
    """
    result = await nautobot.graphql_query(query)
    for dt in result["data"]["device_types"]:
        if dt["manufacturer"]["id"] == manufacturer_id:
            return dt["id"], False

    # Create it
    logger.info("Creating device type '%s' for manufacturer %s", model, manufacturer_id)
    response = await nautobot.rest_request(
        endpoint="dcim/device-types/",
        method="POST",
        data={"model": model, "manufacturer": manufacturer_id},
    )
    device_type_id = response["id"]
    logger.info("✓ Created device type '%s' (%s)", model, device_type_id)
    return device_type_id, True


async def get_form_resource_ids(nautobot) -> dict:
    """
    Resolve all Nautobot UUIDs required by the form test device.

    Looks up:  role, status, location, platform, namespace
    Creates if missing:  manufacturer NetworkInc, device type networkA
    """
    role_id = await _resolve_id(
        nautobot,
        f'query {{ roles(name: "{ROLE_NAME}") {{ id }} }}',
        ("roles",),
    )
    status_id = await _resolve_id(
        nautobot,
        f'query {{ statuses(name: "{STATUS_NAME}") {{ id }} }}',
        ("statuses",),
    )
    location_id = await _resolve_id(
        nautobot,
        f'query {{ locations(name: "{LOCATION_NAME}") {{ id }} }}',
        ("locations",),
    )
    namespace_id = await _resolve_id(
        nautobot,
        f'query {{ namespaces(name: "{NAMESPACE_NAME}") {{ id }} }}',
        ("namespaces",),
    )

    # Platform is optional; resolve only if it exists
    platform_result = await nautobot.graphql_query(
        f'query {{ platforms(name: "{PLATFORM_NAME}") {{ id }} }}'
    )
    platform_id = (
        platform_result["data"]["platforms"][0]["id"]
        if platform_result["data"]["platforms"]
        else None
    )

    manufacturer_id = await get_or_create_manufacturer(nautobot, MANUFACTURER_NAME)
    device_type_id, device_type_created = await get_or_create_device_type(
        nautobot, DEVICE_TYPE_MODEL, manufacturer_id
    )

    return {
        "role_id": role_id,
        "status_id": status_id,
        "location_id": location_id,
        "namespace_id": namespace_id,
        "platform_id": platform_id,
        "manufacturer_id": manufacturer_id,
        "device_type_id": device_type_id,
        "device_type_created": device_type_created,
    }


async def get_or_create_vlan(nautobot, vid: int, name: str, status_id: str) -> tuple[str, bool]:
    """Return (vlan_id, was_created) for the given VID, creating it if absent."""
    query = f"""
    query {{
      vlans(vid: {vid}) {{
        id
        vid
        name
      }}
    }}
    """
    result = await nautobot.graphql_query(query)
    vlans = result["data"]["vlans"]
    if vlans:
        return vlans[0]["id"], False

    logger.info("Creating VLAN %s '%s'", vid, name)
    response = await nautobot.rest_request(
        endpoint="ipam/vlans/",
        method="POST",
        data={"vid": vid, "name": name, "status": status_id},
    )
    vlan_id = response["id"]
    logger.info("✓ Created VLAN %s '%s' (%s)", vid, name, vlan_id)
    return vlan_id, True


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def device_creation_service(real_nautobot_service):
    """DeviceCreationService backed by the real test Nautobot instance."""
    return DeviceCreationService()


@pytest.fixture
async def cleanup_test_device(real_nautobot_service):
    """
    Fixture that collects device IDs created during a test and deletes them
    in teardown, together with any auto-created prefix.
    """
    created_device_ids: list[str] = []
    created_prefix_ids: list[str] = []

    yield created_device_ids, created_prefix_ids

    # Cleanup devices
    for device_id in created_device_ids:
        try:
            await real_nautobot_service.rest_request(
                endpoint=f"dcim/devices/{device_id}/", method="DELETE"
            )
            logger.info("✓ Deleted test device %s", device_id)
        except Exception as exc:
            logger.warning("Could not delete device %s: %s", device_id, exc)

    # Cleanup auto-created prefixes
    for prefix_id in created_prefix_ids:
        try:
            await real_nautobot_service.rest_request(
                endpoint=f"ipam/prefixes/{prefix_id}/", method="DELETE"
            )
            logger.info("✓ Deleted auto-created prefix %s", prefix_id)
        except Exception as exc:
            logger.warning("Could not delete prefix %s: %s", prefix_id, exc)


@pytest.fixture(scope="module")
async def form_resource_ids(real_nautobot_service):
    """
    Module-scoped fixture that resolves (and creates if necessary) all
    Nautobot resources required for the form data test device.

    Manufacturer and device type are cleaned up after the module.
    """
    ids = await get_form_resource_ids(real_nautobot_service)
    yield ids

    # Remove device type and manufacturer only if this test created them
    if ids.get("device_type_created"):
        try:
            await real_nautobot_service.rest_request(
                endpoint=f"dcim/device-types/{ids['device_type_id']}/",
                method="DELETE",
            )
            logger.info("✓ Removed device type '%s'", DEVICE_TYPE_MODEL)
        except Exception as exc:
            logger.warning("Could not remove device type: %s", exc)

        try:
            await real_nautobot_service.rest_request(
                endpoint=f"dcim/manufacturers/{ids['manufacturer_id']}/",
                method="DELETE",
            )
            logger.info("✓ Removed manufacturer '%s'", MANUFACTURER_NAME)
        except Exception as exc:
            logger.warning("Could not remove manufacturer: %s", exc)


@pytest.fixture(scope="module")
async def vlan_100(real_nautobot_service, form_resource_ids):
    """
    Module-scoped fixture that resolves (and creates if necessary) VLAN 100.
    Cleans up only if this fixture created the VLAN.
    """
    vlan_id, was_created = await get_or_create_vlan(
        real_nautobot_service,
        vid=VLAN_100_VID,
        name=VLAN_100_NAME,
        status_id=form_resource_ids["status_id"],
    )
    yield vlan_id

    if was_created:
        try:
            await real_nautobot_service.rest_request(
                endpoint=f"ipam/vlans/{vlan_id}/",
                method="DELETE",
            )
            logger.info("✓ Removed test VLAN %s '%s'", VLAN_100_VID, VLAN_100_NAME)
        except Exception as exc:
            logger.warning("Could not remove test VLAN %s: %s", vlan_id, exc)


# ---------------------------------------------------------------------------
# Test class
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.nautobot
class TestAddDeviceFormData:
    """
    Tests the add-device backend workflow using exactly the data a user would
    enter into the frontend Add Device form.
    """

    # ------------------------------------------------------------------
    # Helper – build the standard form request
    # ------------------------------------------------------------------

    @staticmethod
    def _build_request(ids: dict, *, add_prefix: bool = True) -> AddDeviceRequest:
        return AddDeviceRequest(
            name=DEVICE_NAME,
            serial=DEVICE_SERIAL,
            role=ids["role_id"],
            status=ids["status_id"],
            location=ids["location_id"],
            device_type=ids["device_type_id"],
            platform=ids["platform_id"],
            add_prefix=add_prefix,
            default_prefix_length="/24",
            interfaces=[
                InterfaceData(
                    name=INTERFACE_NAME,
                    type=INTERFACE_TYPE,
                    status=ids["status_id"],
                    ip_addresses=[
                        IpAddressData(
                            address=IP_ADDRESS,
                            namespace=ids["namespace_id"],
                            ip_role=None,
                            is_primary=True,
                        )
                    ],
                )
            ],
        )

    # ------------------------------------------------------------------
    # Tests
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_add_device_with_auto_prefix(
        self,
        real_nautobot_service,
        device_creation_service,
        form_resource_ids,
        cleanup_test_device,
    ):
        """
        Happy path: add the form device with automatic prefix creation.

        Workflow steps verified:
          1. Device created
          2. IP address created
          3. Interface created and IP assigned
          4. Primary IPv4 set
          5. Auto-created prefix exists with correct network
        """
        device_ids, prefix_ids = cleanup_test_device
        request = self._build_request(form_resource_ids, add_prefix=True)

        result = await device_creation_service.create_device_with_interfaces(request)

        # Track for cleanup
        if result.get("device_id"):
            device_ids.append(result["device_id"])

        # --- Top-level success -----------------------------------------------
        assert result["success"] is True, (
            f"Device creation failed: {result.get('message')}"
        )
        assert result["device_id"] is not None, "device_id must be returned"

        # --- Workflow steps ---------------------------------------------------
        ws = result["workflow_status"]
        assert ws["step1_device"]["status"] == "success", ws["step1_device"]
        assert ws["step2_ip_addresses"]["status"] == "success", ws["step2_ip_addresses"]
        assert ws["step3_interfaces"]["status"] == "success", ws["step3_interfaces"]
        assert ws["step4_primary_ip"]["status"] == "success", ws["step4_primary_ip"]

        # --- Summary ----------------------------------------------------------
        summary = result["summary"]
        assert summary["device_created"] is True
        assert summary["interfaces_created"] == 1
        assert summary["ip_addresses_created"] == 1
        assert summary["primary_ipv4_assigned"] is True

        # --- Verify device in Nautobot ----------------------------------------
        query = f"""
        query {{
          device(id: "{result["device_id"]}") {{
            id
            name
            serial
            role {{ name }}
            status {{ name }}
            location {{ name }}
            device_type {{ model }}
            platform {{ name }}
            primary_ip4 {{ address }}
            interfaces {{
              name
              type
              ip_addresses {{ address }}
            }}
          }}
        }}
        """
        raw = await real_nautobot_service.graphql_query(query)
        device = raw["data"]["device"]

        assert device["name"] == DEVICE_NAME
        assert device["serial"] == DEVICE_SERIAL
        assert device["role"]["name"].lower() == ROLE_NAME.lower()
        assert device["status"]["name"] == STATUS_NAME
        assert device["location"]["name"] == LOCATION_NAME
        assert device["device_type"]["model"] == DEVICE_TYPE_MODEL
        if device["platform"]:
            assert device["platform"]["name"] == PLATFORM_NAME
        assert device["primary_ip4"]["address"] == IP_ADDRESS

        ifaces = device["interfaces"]
        assert len(ifaces) == 1, f"Expected 1 interface, got {len(ifaces)}"
        loopback = ifaces[0]
        assert loopback["name"] == INTERFACE_NAME
        assert loopback["type"].lower() == INTERFACE_TYPE.lower()
        assert any(ip["address"] == IP_ADDRESS for ip in loopback["ip_addresses"])

        # --- Verify auto-created prefix ---------------------------------------
        prefix_query = f"""
        query {{
          prefixes(prefix: "{AUTO_PREFIX}") {{
            id
            prefix
            namespace {{ name }}
          }}
        }}
        """
        prefix_result = await real_nautobot_service.graphql_query(prefix_query)
        prefixes = prefix_result["data"]["prefixes"]
        assert len(prefixes) >= 1, f"Expected auto-created prefix {AUTO_PREFIX}"
        prefix_ids.append(prefixes[0]["id"])

        logger.info(
            "✓ testdevice created successfully with Loopback %s and prefix %s",
            IP_ADDRESS,
            AUTO_PREFIX,
        )

    @pytest.mark.asyncio
    async def test_device_name_uniqueness(
        self,
        real_nautobot_service,
        device_creation_service,
        form_resource_ids,
        cleanup_test_device,
    ):
        """
        Creating a second device with the same name should fail.

        This test creates the device itself (and cleans it up), so it is fully
        self-contained and does not depend on any other test's side effects.
        Nautobot enforces unique device names per location, so a duplicate POST
        must not succeed.
        """
        device_ids, prefix_ids = cleanup_test_device

        # --- Create the device once -----------------------------------------------
        request = self._build_request(form_resource_ids, add_prefix=False)
        first = await device_creation_service.create_device_with_interfaces(request)
        assert first["success"] is True, f"Setup failed: {first.get('message')}"
        device_ids.append(first["device_id"])

        # --- Attempt a duplicate, expect rejection ---------------------------------
        with pytest.raises(Exception) as exc_info:
            await device_creation_service.create_device_with_interfaces(request)

        error = str(exc_info.value).lower()
        assert any(
            kw in error for kw in ["already exists", "duplicate", "unique", "name"]
        ), f"Expected 'duplicate' error, got: {exc_info.value}"

        logger.info("✓ Duplicate device name correctly rejected: %s", exc_info.value)

    @pytest.mark.asyncio
    async def test_add_device_interface_metadata(
        self,
        real_nautobot_service,
        device_creation_service,
        form_resource_ids,
        cleanup_test_device,
    ):
        """
        Verify that the Loopback interface is created with type 'virtual'
        and that the IP address 192.168.181.254/24 is assigned to it.
        """
        device_ids, prefix_ids = cleanup_test_device

        # Use a unique name so this test can run independently
        unique_name = f"{DEVICE_NAME}-meta"
        request = AddDeviceRequest(
            name=unique_name,
            serial=f"{DEVICE_SERIAL}-meta",
            role=form_resource_ids["role_id"],
            status=form_resource_ids["status_id"],
            location=form_resource_ids["location_id"],
            device_type=form_resource_ids["device_type_id"],
            platform=form_resource_ids["platform_id"],
            add_prefix=True,
            default_prefix_length="/24",
            interfaces=[
                InterfaceData(
                    name=INTERFACE_NAME,
                    type=INTERFACE_TYPE,
                    status=form_resource_ids["status_id"],
                    ip_addresses=[
                        IpAddressData(
                            address=IP_ADDRESS,
                            namespace=form_resource_ids["namespace_id"],
                            ip_role=None,
                            is_primary=True,
                        )
                    ],
                )
            ],
        )

        result = await device_creation_service.create_device_with_interfaces(request)

        if result.get("device_id"):
            device_ids.append(result["device_id"])

        assert result["success"] is True, (
            f"Expected success, got: {result.get('message')}"
        )

        # Verify interface type via GraphQL
        query = f"""
        query {{
          device(id: "{result["device_id"]}") {{
            interfaces {{
              name
              type
              ip_addresses {{ address }}
            }}
          }}
        }}
        """
        raw = await real_nautobot_service.graphql_query(query)
        ifaces = raw["data"]["device"]["interfaces"]
        assert len(ifaces) == 1
        iface = ifaces[0]

        assert iface["name"] == INTERFACE_NAME
        assert iface["type"].lower() == INTERFACE_TYPE.lower(), (
            f"Expected type '{INTERFACE_TYPE}', got '{iface['type']}'"
        )
        assert any(ip["address"] == IP_ADDRESS for ip in iface["ip_addresses"]), (
            f"IP {IP_ADDRESS} not found on interface. Got: {iface['ip_addresses']}"
        )

        # Track prefix for cleanup
        prefix_query = f"""
        query {{
          prefixes(prefix: "{AUTO_PREFIX}") {{
            id
          }}
        }}
        """
        prefix_result = await real_nautobot_service.graphql_query(prefix_query)
        for p in prefix_result["data"]["prefixes"]:
            prefix_ids.append(p["id"])

        logger.info(
            "✓ Interface '%s' (type=%s) with IP %s confirmed",
            INTERFACE_NAME,
            INTERFACE_TYPE,
            IP_ADDRESS,
        )

    @pytest.mark.asyncio
    async def test_resource_ids_resolved_correctly(
        self,
        real_nautobot_service,
        form_resource_ids,
    ):
        """
        Sanity-check that all required Nautobot resource IDs were resolved.

        This test does not create any devices; it validates the test fixture
        setup so that subsequent tests can rely on valid UUIDs.
        """
        ids = form_resource_ids

        assert ids["role_id"], "role_id must be resolved"
        assert ids["status_id"], "status_id must be resolved"
        assert ids["location_id"], "location_id must be resolved"
        assert ids["namespace_id"], "namespace_id must be resolved"
        assert ids["device_type_id"], "device_type_id must be resolved"
        assert ids["manufacturer_id"], "manufacturer_id must be resolved"
        # platform_id may be None if Cisco IOS isn't in the test Nautobot
        if ids["platform_id"] is None:
            logger.warning(
                "Platform '%s' not found – tests will run without it", PLATFORM_NAME
            )

        logger.info(
            "✓ All resource IDs resolved: %s",
            {k: v for k, v in ids.items() if k != "device_type_created"},
        )

    @pytest.mark.asyncio
    async def test_add_device_without_prefix_fails(
        self,
        real_nautobot_service,
        device_creation_service,
        form_resource_ids,
        cleanup_test_device,
    ):
        """
        Verify that device creation fails when add_prefix=False and the parent
        prefix (192.168.182.0/24) does not exist in Nautobot.

        Expected behaviour:
          - Step 1 (device creation) succeeds.
          - Step 2 (IP address creation) raises an exception because Nautobot
            requires a parent prefix and auto-creation is disabled.
          - The parent prefix is NOT created as a side effect.
          - The orphaned device is cleaned up by the fixture.
        """
        device_ids, prefix_ids = cleanup_test_device

        # Pre-condition: parent prefix must not exist
        pre_check = await real_nautobot_service.graphql_query(
            f'query {{ prefixes(prefix: "{AUTO_PREFIX_NO_PREFIX}") {{ id }} }}'
        )
        assert pre_check["data"]["prefixes"] == [], (
            f"Test requires {AUTO_PREFIX_NO_PREFIX} to be absent from Nautobot"
        )

        request = AddDeviceRequest(
            name=f"{DEVICE_NAME}-no-prefix",
            serial=f"{DEVICE_SERIAL}-no-prefix",
            role=form_resource_ids["role_id"],
            status=form_resource_ids["status_id"],
            location=form_resource_ids["location_id"],
            device_type=form_resource_ids["device_type_id"],
            platform=form_resource_ids["platform_id"],
            add_prefix=False,
            default_prefix_length="/24",
            interfaces=[
                InterfaceData(
                    name=INTERFACE_NAME,
                    type=INTERFACE_TYPE,
                    status=form_resource_ids["status_id"],
                    ip_addresses=[
                        IpAddressData(
                            address=IP_ADDRESS_NO_PREFIX,
                            namespace=form_resource_ids["namespace_id"],
                            ip_role=None,
                            is_primary=True,
                        )
                    ],
                )
            ],
        )

        with pytest.raises(Exception) as exc_info:
            await device_creation_service.create_device_with_interfaces(request)

        error = str(exc_info.value).lower()
        assert any(kw in error for kw in ["prefix", "parent", "network"]), (
            f"Expected prefix-related error, got: {exc_info.value}"
        )

        # Verify the parent prefix was NOT created as a side effect
        post_check = await real_nautobot_service.graphql_query(
            f'query {{ prefixes(prefix: "{AUTO_PREFIX_NO_PREFIX}") {{ id }} }}'
        )
        assert post_check["data"]["prefixes"] == [], (
            f"{AUTO_PREFIX_NO_PREFIX} must not be created when add_prefix=False"
        )

        # The device may have been created (step 1) before IP creation failed;
        # find and track it so the cleanup fixture removes it.
        orphan_check = await real_nautobot_service.graphql_query(
            f'query {{ devices(name: "{DEVICE_NAME}-no-prefix") {{ id }} }}'
        )
        for d in orphan_check["data"]["devices"]:
            device_ids.append(d["id"])
            logger.info("Tracking orphaned device %s for cleanup", d["id"])

        logger.info(
            "✓ Device creation correctly rejected when add_prefix=False and %s is absent",
            AUTO_PREFIX_NO_PREFIX,
        )

    # ------------------------------------------------------------------
    # VLAN mode tests
    # ------------------------------------------------------------------

    @staticmethod
    def _build_vlan_request(ids: dict, suffix: str, **iface_kwargs) -> AddDeviceRequest:
        """Build an AddDeviceRequest with a single interface for VLAN mode tests."""
        return AddDeviceRequest(
            name=f"{DEVICE_NAME}-vlan-{suffix}",
            serial=f"{DEVICE_SERIAL}-vlan-{suffix}",
            role=ids["role_id"],
            status=ids["status_id"],
            location=ids["location_id"],
            device_type=ids["device_type_id"],
            platform=ids["platform_id"],
            add_prefix=False,
            default_prefix_length="/24",
            interfaces=[
                InterfaceData(
                    name=INTERFACE_NAME,
                    type=INTERFACE_TYPE,
                    status=ids["status_id"],
                    **iface_kwargs,
                )
            ],
        )

    @staticmethod
    def _normalize_mode(mode: str | None) -> str | None:
        """Normalize Nautobot mode enum (e.g. 'TAGGED_ALL') to API slug ('tagged-all')."""
        if mode is None:
            return None
        return mode.lower().replace("_", "-")

    @staticmethod
    async def _fetch_interface(nautobot, device_id: str) -> dict:
        """Return the first interface dict for the given device, including VLAN fields."""
        query = f"""
        query {{
          device(id: "{device_id}") {{
            interfaces {{
              name
              mode
              mac_address
              mtu
              description
              untagged_vlan {{ id vid }}
              tagged_vlans {{ id vid }}
            }}
          }}
        }}
        """
        raw = await nautobot.graphql_query(query)
        ifaces = raw["data"]["device"]["interfaces"]
        assert ifaces, "Expected at least one interface on the device"
        return ifaces[0]

    @pytest.mark.asyncio
    async def test_interface_vlan_mode_none(
        self,
        real_nautobot_service,
        device_creation_service,
        form_resource_ids,
        cleanup_test_device,
    ):
        """
        Interface with mode='none' must be created without a VLAN mode set.

        Covers the fix: the backend must not forward the UI sentinel 'none'
        to Nautobot (which rejects it as an invalid choice).
        """
        device_ids, _ = cleanup_test_device
        request = self._build_vlan_request(form_resource_ids, "none", mode="none")

        result = await device_creation_service.create_device_with_interfaces(request)
        if result.get("device_id"):
            device_ids.append(result["device_id"])

        assert result["success"] is True, f"Device creation failed: {result.get('message')}"

        iface = await self._fetch_interface(real_nautobot_service, result["device_id"])
        mode_value = self._normalize_mode(iface.get("mode"))
        assert mode_value is None or mode_value == "", (
            f"Expected no mode, got '{mode_value}'"
        )
        assert iface.get("untagged_vlan") is None
        assert iface.get("tagged_vlans") == []

        logger.info("✓ Interface created with no VLAN mode")

    @pytest.mark.asyncio
    async def test_interface_vlan_mode_access_with_untagged_vlan(
        self,
        real_nautobot_service,
        device_creation_service,
        form_resource_ids,
        vlan_100,
        cleanup_test_device,
    ):
        """
        Interface with mode='access' and untagged_vlan set to VLAN 100 must
        have both persisted in Nautobot.

        Covers the fix: untagged_vlan must be sent to Nautobot as {"id": uuid}.
        """
        device_ids, _ = cleanup_test_device
        request = self._build_vlan_request(
            form_resource_ids,
            "access",
            mode="access",
            untagged_vlan=vlan_100,
        )

        result = await device_creation_service.create_device_with_interfaces(request)
        if result.get("device_id"):
            device_ids.append(result["device_id"])

        assert result["success"] is True, f"Device creation failed: {result.get('message')}"

        iface = await self._fetch_interface(real_nautobot_service, result["device_id"])
        mode_value = self._normalize_mode(iface.get("mode"))
        assert mode_value == "access", f"Expected mode 'access', got '{mode_value}'"
        assert iface.get("untagged_vlan") is not None, "untagged_vlan must be set"
        assert iface["untagged_vlan"]["vid"] == VLAN_100_VID, (
            f"Expected VID {VLAN_100_VID}, got {iface['untagged_vlan']['vid']}"
        )
        assert iface.get("tagged_vlans") == []

        logger.info("✓ Interface created with mode=access and untagged VLAN %s", VLAN_100_VID)

    @pytest.mark.asyncio
    async def test_interface_vlan_mode_tagged_with_vlans(
        self,
        real_nautobot_service,
        device_creation_service,
        form_resource_ids,
        vlan_100,
        cleanup_test_device,
    ):
        """
        Interface with mode='tagged', untagged_vlan=100, and tagged_vlans=[100]
        must have all three persisted in Nautobot.

        Covers the fix: tagged_vlans must be sent as [{"id": uuid}].
        """
        device_ids, _ = cleanup_test_device
        request = self._build_vlan_request(
            form_resource_ids,
            "tagged",
            mode="tagged",
            untagged_vlan=vlan_100,
            tagged_vlans=[vlan_100],
        )

        result = await device_creation_service.create_device_with_interfaces(request)
        if result.get("device_id"):
            device_ids.append(result["device_id"])

        assert result["success"] is True, f"Device creation failed: {result.get('message')}"

        iface = await self._fetch_interface(real_nautobot_service, result["device_id"])
        mode_value = self._normalize_mode(iface.get("mode"))
        assert mode_value == "tagged", f"Expected mode 'tagged', got '{mode_value}'"
        assert iface.get("untagged_vlan") is not None, "untagged_vlan must be set"
        assert iface["untagged_vlan"]["vid"] == VLAN_100_VID
        tagged_vids = [v["vid"] for v in (iface.get("tagged_vlans") or [])]
        assert VLAN_100_VID in tagged_vids, (
            f"Expected VID {VLAN_100_VID} in tagged_vlans, got {tagged_vids}"
        )

        logger.info(
            "✓ Interface created with mode=tagged, untagged VLAN %s, tagged VLANs %s",
            VLAN_100_VID,
            tagged_vids,
        )

    @pytest.mark.asyncio
    async def test_interface_vlan_mode_tagged_all_with_untagged_vlan(
        self,
        real_nautobot_service,
        device_creation_service,
        form_resource_ids,
        vlan_100,
        cleanup_test_device,
    ):
        """
        Interface with mode='tagged-all' and untagged_vlan=100 must have
        both persisted in Nautobot. No explicit tagged_vlans list is sent
        since 'tagged-all' implicitly includes every VLAN.
        """
        device_ids, _ = cleanup_test_device
        request = self._build_vlan_request(
            form_resource_ids,
            "tagged-all",
            mode="tagged-all",
            untagged_vlan=vlan_100,
        )

        result = await device_creation_service.create_device_with_interfaces(request)
        if result.get("device_id"):
            device_ids.append(result["device_id"])

        assert result["success"] is True, f"Device creation failed: {result.get('message')}"

        iface = await self._fetch_interface(real_nautobot_service, result["device_id"])
        mode_value = self._normalize_mode(iface.get("mode"))
        assert mode_value == "tagged-all", f"Expected mode 'tagged-all', got '{mode_value}'"
        assert iface.get("untagged_vlan") is not None, "untagged_vlan must be set"
        assert iface["untagged_vlan"]["vid"] == VLAN_100_VID, (
            f"Expected VID {VLAN_100_VID}, got {iface['untagged_vlan']['vid']}"
        )

        logger.info("✓ Interface created with mode=tagged-all and untagged VLAN %s", VLAN_100_VID)

    # ------------------------------------------------------------------
    # Interface metadata tests (MAC address, MTU, description)
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_interface_mac_address(
        self,
        real_nautobot_service,
        device_creation_service,
        form_resource_ids,
        cleanup_test_device,
    ):
        """
        MAC address set on an interface must be persisted in Nautobot.
        """
        device_ids, _ = cleanup_test_device
        request = self._build_vlan_request(
            form_resource_ids,
            "mac",
            mac_address=IFACE_MAC_ADDRESS,
        )

        result = await device_creation_service.create_device_with_interfaces(request)
        if result.get("device_id"):
            device_ids.append(result["device_id"])

        assert result["success"] is True, f"Device creation failed: {result.get('message')}"

        iface = await self._fetch_interface(real_nautobot_service, result["device_id"])
        stored = iface.get("mac_address")
        assert stored is not None, "mac_address must be set on the interface"
        assert stored.upper() == IFACE_MAC_ADDRESS.upper(), (
            f"Expected MAC '{IFACE_MAC_ADDRESS}', got '{stored}'"
        )

        logger.info("✓ Interface MAC address '%s' persisted correctly", stored)

    @pytest.mark.asyncio
    async def test_interface_mtu(
        self,
        real_nautobot_service,
        device_creation_service,
        form_resource_ids,
        cleanup_test_device,
    ):
        """
        MTU set on an interface must be persisted in Nautobot.
        """
        device_ids, _ = cleanup_test_device
        request = self._build_vlan_request(
            form_resource_ids,
            "mtu",
            mtu=IFACE_MTU,
        )

        result = await device_creation_service.create_device_with_interfaces(request)
        if result.get("device_id"):
            device_ids.append(result["device_id"])

        assert result["success"] is True, f"Device creation failed: {result.get('message')}"

        iface = await self._fetch_interface(real_nautobot_service, result["device_id"])
        assert iface.get("mtu") == IFACE_MTU, (
            f"Expected MTU {IFACE_MTU}, got {iface.get('mtu')}"
        )

        logger.info("✓ Interface MTU %s persisted correctly", IFACE_MTU)

    @pytest.mark.asyncio
    async def test_interface_description(
        self,
        real_nautobot_service,
        device_creation_service,
        form_resource_ids,
        cleanup_test_device,
    ):
        """
        Description set on an interface must be persisted in Nautobot.
        """
        device_ids, _ = cleanup_test_device
        request = self._build_vlan_request(
            form_resource_ids,
            "desc",
            description=IFACE_DESCRIPTION,
        )

        result = await device_creation_service.create_device_with_interfaces(request)
        if result.get("device_id"):
            device_ids.append(result["device_id"])

        assert result["success"] is True, f"Device creation failed: {result.get('message')}"

        iface = await self._fetch_interface(real_nautobot_service, result["device_id"])
        assert iface.get("description") == IFACE_DESCRIPTION, (
            f"Expected description '{IFACE_DESCRIPTION}', got '{iface.get('description')}'"
        )

        logger.info("✓ Interface description '%s' persisted correctly", IFACE_DESCRIPTION)

    @pytest.mark.asyncio
    async def test_add_device_with_two_interfaces(
        self,
        real_nautobot_service,
        device_creation_service,
        form_resource_ids,
        cleanup_test_device,
    ):
        """
        A device with two interfaces must have both created in Nautobot, each
        with its own IP address assigned.

        Interface 1: Loopback  – 192.168.181.254/24 (primary IPv4)
        Interface 2: Loopback2 – 192.168.181.253/24
        Both IPs share the same /24 prefix; auto-prefix creation is enabled.
        """
        device_ids, prefix_ids = cleanup_test_device
        ids = form_resource_ids

        request = AddDeviceRequest(
            name=f"{DEVICE_NAME}-two-ifaces",
            serial=f"{DEVICE_SERIAL}-two-ifaces",
            role=ids["role_id"],
            status=ids["status_id"],
            location=ids["location_id"],
            device_type=ids["device_type_id"],
            platform=ids["platform_id"],
            add_prefix=True,
            default_prefix_length="/24",
            interfaces=[
                InterfaceData(
                    name=INTERFACE_NAME,
                    type=INTERFACE_TYPE,
                    status=ids["status_id"],
                    ip_addresses=[
                        IpAddressData(
                            address=IP_ADDRESS,
                            namespace=ids["namespace_id"],
                            ip_role=None,
                            is_primary=True,
                        )
                    ],
                ),
                InterfaceData(
                    name=INTERFACE_NAME_2,
                    type=INTERFACE_TYPE,
                    status=ids["status_id"],
                    ip_addresses=[
                        IpAddressData(
                            address=IP_ADDRESS_2,
                            namespace=ids["namespace_id"],
                            ip_role=None,
                            is_primary=False,
                        )
                    ],
                ),
            ],
        )

        result = await device_creation_service.create_device_with_interfaces(request)
        if result.get("device_id"):
            device_ids.append(result["device_id"])

        assert result["success"] is True, f"Device creation failed: {result.get('message')}"

        summary = result["summary"]
        assert summary["interfaces_created"] == 2, (
            f"Expected 2 interfaces created, got {summary['interfaces_created']}"
        )
        assert summary["ip_addresses_created"] == 2, (
            f"Expected 2 IP addresses created, got {summary['ip_addresses_created']}"
        )

        # Verify both interfaces exist in Nautobot with their IPs
        query = f"""
        query {{
          device(id: "{result["device_id"]}") {{
            interfaces {{
              name
              type
              ip_addresses {{ address }}
            }}
          }}
        }}
        """
        raw = await real_nautobot_service.graphql_query(query)
        ifaces = raw["data"]["device"]["interfaces"]
        assert len(ifaces) == 2, f"Expected 2 interfaces in Nautobot, got {len(ifaces)}"

        by_name = {i["name"]: i for i in ifaces}
        assert INTERFACE_NAME in by_name, f"'{INTERFACE_NAME}' not found in {list(by_name)}"
        assert INTERFACE_NAME_2 in by_name, f"'{INTERFACE_NAME_2}' not found in {list(by_name)}"

        assert any(ip["address"] == IP_ADDRESS for ip in by_name[INTERFACE_NAME]["ip_addresses"]), (
            f"{IP_ADDRESS} not assigned to {INTERFACE_NAME}"
        )
        assert any(ip["address"] == IP_ADDRESS_2 for ip in by_name[INTERFACE_NAME_2]["ip_addresses"]), (
            f"{IP_ADDRESS_2} not assigned to {INTERFACE_NAME_2}"
        )

        # Track the shared prefix for cleanup
        prefix_result = await real_nautobot_service.graphql_query(
            f'query {{ prefixes(prefix: "{AUTO_PREFIX}") {{ id }} }}'
        )
        for p in prefix_result["data"]["prefixes"]:
            if p["id"] not in prefix_ids:
                prefix_ids.append(p["id"])

        logger.info(
            "✓ Device created with two interfaces: %s (%s) and %s (%s)",
            INTERFACE_NAME, IP_ADDRESS, INTERFACE_NAME_2, IP_ADDRESS_2,
        )
