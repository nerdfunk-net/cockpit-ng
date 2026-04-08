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
INTERFACE_TYPE = "virtual"
IP_ADDRESS = "192.168.181.254/24"

# The auto-created prefix derived from IP_ADDRESS and /24
AUTO_PREFIX = "192.168.181.0/24"

# IP used for the "no prefix" test (add_prefix=False, parent prefix absent)
IP_ADDRESS_NO_PREFIX = "192.168.182.254/24"
AUTO_PREFIX_NO_PREFIX = "192.168.182.0/24"


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
