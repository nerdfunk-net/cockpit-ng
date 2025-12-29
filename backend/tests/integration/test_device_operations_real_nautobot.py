"""
Integration tests for device operations with real Nautobot instance.

Tests the following operations:
1. Add Device - Create a new device with interfaces
2. Bulk Edit - Update device serial number
3. Bulk Edit - Update primary IPv4 (create new interface)
4. Bulk Edit - Update primary IPv4 (update existing interface)

These tests make real API calls to a test Nautobot instance.
They require:
- Test Nautobot instance configured in .env.test
- Baseline test data loaded (from contributing-data/tests_baseline/baseline.yaml)
"""

import pytest
import logging
from typing import Dict
from services.nautobot import NautobotService
from services.nautobot.devices.creation import DeviceCreationService
from services.nautobot.devices.update import DeviceUpdateService
from models.nautobot import AddDeviceRequest, InterfaceData

logger = logging.getLogger(__name__)


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture(scope="module")
def device_creation_service(real_nautobot_service):
    """Device creation service for integration tests."""
    return DeviceCreationService()


@pytest.fixture(scope="module")
def device_update_service(real_nautobot_service):
    """Device update service for integration tests."""
    return DeviceUpdateService(real_nautobot_service)


@pytest.fixture
async def test_device_ids(real_nautobot_service):
    """
    Fixture that provides device IDs for testing and cleans them up after tests.

    Returns a dictionary with device IDs that are created during tests.
    These devices will be deleted in the cleanup phase.
    """
    created_device_ids = []

    yield created_device_ids

    # Cleanup: Delete all created devices
    for device_id in created_device_ids:
        try:
            logger.info(f"Cleaning up test device: {device_id}")
            await real_nautobot_service.rest_request(
                endpoint=f"dcim/devices/{device_id}/", method="DELETE"
            )
            logger.info(f"✓ Successfully deleted test device: {device_id}")
        except Exception as e:
            logger.warning(f"Failed to cleanup device {device_id}: {e}")


@pytest.fixture
async def baseline_device_ids(real_nautobot_service):
    """
    Get IDs for baseline test devices that we'll modify and restore.

    We'll use:
    - lab-100: Last network device (City B, Staging)
    - server-20: Last server device (City B, Staging)
    """
    device_ids = {}

    # Get lab-100
    query = """
    query {
      devices(name: "lab-100") {
        id
        name
        primary_ip4 {
          id
          address
        }
      }
    }
    """
    result = await real_nautobot_service.graphql_query(query)
    if result.get("data", {}).get("devices"):
        device = result["data"]["devices"][0]
        device_ids["lab-100"] = {
            "id": device["id"],
            "name": device["name"],
            "original_primary_ip4": device.get("primary_ip4", {}).get("address")
            if device.get("primary_ip4")
            else None,
            "original_primary_ip4_id": device.get("primary_ip4", {}).get("id")
            if device.get("primary_ip4")
            else None,
        }

    # Get server-20
    query = """
    query {
      devices(name: "server-20") {
        id
        name
        serial
        primary_ip4 {
          id
          address
        }
      }
    }
    """
    result = await real_nautobot_service.graphql_query(query)
    if result.get("data", {}).get("devices"):
        device = result["data"]["devices"][0]
        device_ids["server-20"] = {
            "id": device["id"],
            "name": device["name"],
            "original_serial": device.get("serial"),
            "original_primary_ip4": device.get("primary_ip4", {}).get("address")
            if device.get("primary_ip4")
            else None,
            "original_primary_ip4_id": device.get("primary_ip4", {}).get("id")
            if device.get("primary_ip4")
            else None,
        }

    yield device_ids

    # Restore original values after tests
    for device_name, device_info in device_ids.items():
        try:
            logger.info(f"Restoring baseline device: {device_name}")

            # Prepare restore data
            restore_data = {}

            # Restore serial if we have it
            if "original_serial" in device_info and device_info["original_serial"]:
                restore_data["serial"] = device_info["original_serial"]

            # Restore primary_ip4 if we have it
            if device_info.get("original_primary_ip4_id"):
                restore_data["primary_ip4"] = device_info["original_primary_ip4_id"]

            if restore_data:
                await real_nautobot_service.rest_request(
                    endpoint=f"dcim/devices/{device_info['id']}/",
                    method="PATCH",
                    data=restore_data,
                )
                logger.info(f"✓ Successfully restored {device_name}")
        except Exception as e:
            logger.warning(f"Failed to restore {device_name}: {e}")


async def get_required_ids(nautobot: NautobotService) -> Dict[str, str]:
    """
    Get required resource IDs for device creation.

    Returns dict with:
    - location_id: City A location ID
    - role_id: Network role ID
    - device_type_id: Cisco IOS device type ID
    - platform_id: Cisco IOS platform ID
    - status_id: Active status ID
    - namespace_id: Global namespace ID
    """
    # Get City A location
    location_query = """
    query {
      locations(name: "City A") {
        id
        name
      }
    }
    """
    result = await nautobot.graphql_query(location_query)
    location_id = result["data"]["locations"][0]["id"]

    # Get Network role
    role_query = """
    query {
      roles(name: "Network") {
        id
        name
      }
    }
    """
    result = await nautobot.graphql_query(role_query)
    role_id = result["data"]["roles"][0]["id"]

    # Get device type (using first available in baseline)
    device_type_query = """
    query {
      device_types(limit: 1) {
        id
        model
      }
    }
    """
    result = await nautobot.graphql_query(device_type_query)
    device_type_id = result["data"]["device_types"][0]["id"]

    # Get Cisco IOS platform
    platform_query = """
    query {
      platforms(name: "Cisco IOS") {
        id
        name
      }
    }
    """
    result = await nautobot.graphql_query(platform_query)
    platform_id = (
        result["data"]["platforms"][0]["id"] if result["data"]["platforms"] else None
    )

    # Get Active status
    status_query = """
    query {
      statuses(name: "Active") {
        id
        name
      }
    }
    """
    result = await nautobot.graphql_query(status_query)
    status_id = result["data"]["statuses"][0]["id"]

    # Get Global namespace
    namespace_query = """
    query {
      namespaces(name: "Global") {
        id
        name
      }
    }
    """
    result = await nautobot.graphql_query(namespace_query)
    namespace_id = result["data"]["namespaces"][0]["id"]

    return {
        "location_id": location_id,
        "role_id": role_id,
        "device_type_id": device_type_id,
        "platform_id": platform_id,
        "status_id": status_id,
        "namespace_id": namespace_id,
    }


# =============================================================================
# Integration Tests - Add Device
# =============================================================================


@pytest.mark.integration
@pytest.mark.nautobot
class TestAddDevice:
    """Test adding a new device to Nautobot."""

    @pytest.mark.asyncio
    async def test_add_device_with_interfaces(
        self, real_nautobot_service, device_creation_service, test_device_ids
    ):
        """
        Test adding a new device with multiple interfaces.

        This tests the /add-device endpoint which:
        1. Creates the device
        2. Creates IP addresses
        3. Creates interfaces and assigns IPs
        4. Sets primary IPv4
        """
        # Get required IDs from baseline data
        ids = await get_required_ids(real_nautobot_service)

        # Create device request with interface using baseline prefix (192.168.178.0/24)
        # Using IP 192.168.178.128+ to avoid conflicts with baseline devices
        request = AddDeviceRequest(
            name="test-device-001",
            role=ids["role_id"],
            status=ids["status_id"],
            location=ids["location_id"],
            device_type=ids["device_type_id"],
            platform=ids["platform_id"],
            serial="TEST-SN-001",
            asset_tag="TEST-ASSET-001",
            interfaces=[
                InterfaceData(
                    name="GigabitEthernet0/0",
                    type="1000base-t",
                    status=ids["status_id"],
                    ip_address="192.168.178.128/24",
                    namespace=ids["namespace_id"],
                    is_primary_ipv4=True,
                    description="Management interface",
                ),
            ],
        )

        # Create the device
        result = await device_creation_service.create_device_with_interfaces(request)

        # Track for cleanup
        if result.get("device_id"):
            test_device_ids.append(result["device_id"])

        # Verify success
        assert result["success"] is True, (
            f"Device creation failed: {result.get('message')}"
        )
        assert result["device_id"] is not None

        # Verify workflow steps
        workflow_status = result["workflow_status"]
        assert workflow_status["step1_device"]["status"] == "success"
        assert workflow_status["step2_ip_addresses"]["status"] == "success"
        assert workflow_status["step3_interfaces"]["status"] == "success"
        assert workflow_status["step4_primary_ip"]["status"] == "success"

        # Verify summary
        summary = result["summary"]
        assert summary["device_created"] is True
        assert summary["interfaces_created"] == 1
        assert summary["ip_addresses_created"] == 1
        assert summary["primary_ipv4_assigned"] is True

        # Verify device exists in Nautobot
        device_query = f"""
        query {{
          device(id: "{result["device_id"]}") {{
            id
            name
            serial
            asset_tag
            primary_ip4 {{
              address
            }}
            interfaces {{
              name
              type
              ip_addresses {{
                address
              }}
            }}
          }}
        }}
        """
        device_result = await real_nautobot_service.graphql_query(device_query)
        device = device_result["data"]["device"]

        assert device["name"] == "test-device-001"
        assert device["serial"] == "TEST-SN-001"
        assert device["asset_tag"] == "TEST-ASSET-001"
        assert device["primary_ip4"]["address"] == "192.168.178.128/24"
        assert len(device["interfaces"]) == 1
        assert device["interfaces"][0]["name"] == "GigabitEthernet0/0"

        logger.info("✓ Device added successfully with interface and IP")

    @pytest.mark.asyncio
    async def test_add_device_with_auto_prefix_creation(
        self, real_nautobot_service, device_creation_service, test_device_ids
    ):
        """
        Test adding a new device with automatic prefix creation enabled.

        This tests the add_prefix feature which:
        1. Creates the device
        2. Automatically creates parent prefix if it doesn't exist
        3. Creates IP addresses
        4. Creates interfaces and assigns IPs
        5. Sets primary IPv4

        Uses a non-existent prefix (10.99.99.0/24) to ensure it gets created.
        """
        # Get required IDs from baseline data
        ids = await get_required_ids(real_nautobot_service)

        # Create device request with IP in non-existent prefix
        # Using 10.99.99.0/24 which should not exist in baseline
        request = AddDeviceRequest(
            name="test-device-auto-prefix",
            role=ids["role_id"],
            status=ids["status_id"],
            location=ids["location_id"],
            device_type=ids["device_type_id"],
            platform=ids["platform_id"],
            serial="TEST-AUTO-PREFIX-001",
            add_prefix=True,  # Enable automatic prefix creation
            default_prefix_length="/24",
            interfaces=[
                InterfaceData(
                    name="GigabitEthernet0/0",
                    type="1000base-t",
                    status=ids["status_id"],
                    ip_address="10.99.99.10/24",  # IP in non-existent prefix
                    namespace=ids["namespace_id"],
                    is_primary_ipv4=True,
                ),
            ],
        )

        # Create the device
        result = await device_creation_service.create_device_with_interfaces(request)

        # Track for cleanup
        if result.get("device_id"):
            test_device_ids.append(result["device_id"])

        # Verify success
        assert result["success"] is True, (
            f"Device creation failed: {result.get('message')}"
        )
        assert result["device_id"] is not None

        # Verify prefix was created in Nautobot
        prefix_query = """
        query {
          prefixes(prefix: "10.99.99.0/24") {
            id
            prefix
            description
            namespace {
              name
            }
          }
        }
        """
        prefix_result = await real_nautobot_service.graphql_query(prefix_query)
        prefixes = prefix_result["data"]["prefixes"]

        assert len(prefixes) == 1, "Prefix should have been auto-created"
        prefix = prefixes[0]
        assert prefix["prefix"] == "10.99.99.0/24"
        assert "Auto-created" in prefix["description"]
        assert prefix["namespace"]["name"] == "Global"

        # Verify device was created with the IP
        device_query = f"""
        query {{
          device(id: "{result["device_id"]}") {{
            id
            name
            primary_ip4 {{
              address
            }}
          }}
        }}
        """
        device_result = await real_nautobot_service.graphql_query(device_query)
        device = device_result["data"]["device"]

        assert device["name"] == "test-device-auto-prefix"
        assert device["primary_ip4"]["address"] == "10.99.99.10/24"

        logger.info("✓ Device added successfully with automatic prefix creation")

        # Cleanup: Delete the auto-created prefix
        try:
            prefix_id = prefixes[0]["id"]
            await real_nautobot_service.rest_request(
                endpoint=f"ipam/prefixes/{prefix_id}/", method="DELETE"
            )
            logger.info("✓ Cleaned up auto-created prefix")
        except Exception as e:
            logger.warning(f"Failed to cleanup prefix: {e}")

    @pytest.mark.asyncio
    async def test_add_device_without_prefix_creation_fails(
        self, real_nautobot_service, device_creation_service, test_device_ids
    ):
        """
        Test that adding a device without automatic prefix creation fails
        when the parent prefix doesn't exist.

        This tests that add_prefix=False prevents automatic prefix creation,
        and the IP address creation fails due to missing parent prefix.

        Uses a non-existent prefix (10.98.98.0/24) to ensure failure.
        """
        # Get required IDs from baseline data
        ids = await get_required_ids(real_nautobot_service)

        # Verify prefix doesn't exist
        prefix_query = """
        query {
          prefixes(prefix: "10.98.98.0/24") {
            id
          }
        }
        """
        prefix_result = await real_nautobot_service.graphql_query(prefix_query)
        prefixes = prefix_result["data"]["prefixes"]
        assert len(prefixes) == 0, "Test requires non-existent prefix"

        # Create device request with IP in non-existent prefix
        request = AddDeviceRequest(
            name="test-device-no-prefix",
            role=ids["role_id"],
            status=ids["status_id"],
            location=ids["location_id"],
            device_type=ids["device_type_id"],
            platform=ids["platform_id"],
            serial="TEST-NO-PREFIX-001",
            add_prefix=False,  # Disable automatic prefix creation
            default_prefix_length="/24",
            interfaces=[
                InterfaceData(
                    name="GigabitEthernet0/0",
                    type="1000base-t",
                    status=ids["status_id"],
                    ip_address="10.98.98.10/24",  # IP in non-existent prefix
                    namespace=ids["namespace_id"],
                    is_primary_ipv4=True,
                ),
            ],
        )

        # Create the device - should fail at IP creation step
        result = await device_creation_service.create_device_with_interfaces(request)

        # Track device for cleanup (it may be created even if IP fails)
        if result.get("device_id"):
            test_device_ids.append(result["device_id"])

        # Verify the workflow status
        workflow_status = result["workflow_status"]

        # Device should be created successfully
        assert workflow_status["step1_device"]["status"] == "success"

        # IP address creation should fail
        assert workflow_status["step2_ip_addresses"]["status"] in [
            "failed",
            "partial",
        ], "IP creation should fail without parent prefix"

        # Check that error mentions missing prefix
        if workflow_status["step2_ip_addresses"]["errors"]:
            error_messages = [
                err["error"] for err in workflow_status["step2_ip_addresses"]["errors"]
            ]
            error_str = " ".join(error_messages).lower()
            # Nautobot typically returns error about missing parent prefix
            assert any(
                keyword in error_str for keyword in ["prefix", "parent", "network"]
            ), "Error should mention missing prefix"

        # Verify prefix was NOT created
        prefix_result = await real_nautobot_service.graphql_query(prefix_query)
        prefixes = prefix_result["data"]["prefixes"]
        assert len(prefixes) == 0, (
            "Prefix should not have been created when add_prefix=False"
        )

        logger.info(
            "✓ Device creation correctly failed without prefix when add_prefix=False"
        )


# =============================================================================
# Integration Tests - Bulk Edit (Update Devices)
# =============================================================================


@pytest.mark.integration
@pytest.mark.nautobot
class TestBulkEdit:
    """Test bulk editing/updating devices in Nautobot."""

    @pytest.mark.asyncio
    async def test_update_device_serial_number(
        self, real_nautobot_service, device_update_service, baseline_device_ids
    ):
        """
        Test updating a device's serial number.

        Uses baseline device server-20 and modifies its serial number.
        The serial number will be restored in cleanup.
        """
        device_info = baseline_device_ids["server-20"]

        # Update the serial number
        result = await device_update_service.update_device(
            device_identifier={"id": device_info["id"]},
            update_data={"serial": "INTEGRATION-TEST-SERIAL-001"},
        )

        # Verify success
        assert result["success"] is True, (
            f"Serial update failed: {result.get('message')}"
        )
        assert "serial" in result["updated_fields"]

        # Verify changes
        assert (
            result["details"]["changes"]["serial"]["from"]
            == device_info["original_serial"]
        )
        assert (
            result["details"]["changes"]["serial"]["to"]
            == "INTEGRATION-TEST-SERIAL-001"
        )

        # Verify device in Nautobot
        device_query = f"""
        query {{
          device(id: "{device_info["id"]}") {{
            serial
          }}
        }}
        """
        device_result = await real_nautobot_service.graphql_query(device_query)
        assert (
            device_result["data"]["device"]["serial"] == "INTEGRATION-TEST-SERIAL-001"
        )

        logger.info("✓ Serial number updated successfully")

    @pytest.mark.asyncio
    async def test_update_primary_ip_create_new_interface(
        self, real_nautobot_service, device_update_service, baseline_device_ids
    ):
        """
        Test updating primary IPv4 by creating a NEW interface.

        This tests the behavior when mgmt_interface_create_on_ip_change=True.
        A new interface will be created with the new IP address.

        Uses baseline device lab-100.
        """
        device_info = baseline_device_ids["lab-100"]
        await get_required_ids(real_nautobot_service)

        # Update primary IP with new interface creation
        # Use baseline prefix 192.168.178.x (IP 129 to avoid conflicts)
        new_ip = "192.168.178.129/24"

        result = await device_update_service.update_device(
            device_identifier={"id": device_info["id"]},
            update_data={
                "primary_ip4": new_ip,
                "ip_namespace": "Global",  # Use namespace NAME, not ID
            },
            interface_config={
                "name": "Loopback100",
                "type": "virtual",
                "status": "active",  # Use status NAME, not UUID (backend will resolve it)
                "mgmt_interface_create_on_ip_change": True,  # CREATE NEW
            },
        )

        # Verify success
        assert result["success"] is True, f"IP update failed: {result.get('message')}"
        assert "primary_ip4" in result["updated_fields"]

        # Verify device has new primary IP
        device_query = f"""
        query {{
          device(id: "{device_info["id"]}") {{
            primary_ip4 {{
              address
            }}
            interfaces(name: "Loopback100") {{
              name
              type
              ip_addresses {{
                address
              }}
            }}
          }}
        }}
        """
        device_result = await real_nautobot_service.graphql_query(device_query)
        device = device_result["data"]["device"]

        # Verify primary IP changed
        assert device["primary_ip4"]["address"] == new_ip

        # Verify new interface was created
        assert len(device["interfaces"]) == 1
        interface = device["interfaces"][0]
        assert interface["name"] == "Loopback100"
        assert interface["type"] == "VIRTUAL"
        assert any(ip["address"] == new_ip for ip in interface["ip_addresses"])

        logger.info("✓ Primary IP updated with new interface created")

    @pytest.mark.asyncio
    async def test_update_primary_ip_update_existing_interface(
        self, real_nautobot_service, device_update_service, baseline_device_ids
    ):
        """
        Test updating primary IPv4 by updating the EXISTING interface.

        This tests the behavior when mgmt_interface_create_on_ip_change=False.
        The existing interface's IP address will be updated instead of creating new.

        Uses baseline device server-20.
        """
        device_info = baseline_device_ids["server-20"]
        await get_required_ids(real_nautobot_service)

        # First, ensure device has a primary IP with an interface
        # (baseline devices should already have this)
        assert device_info["original_primary_ip4"] is not None, (
            "Baseline device should have primary IP"
        )

        # Get the current interface name by finding interface with primary IP
        # We'll get all interfaces and find the one with the primary IP
        device_query = f"""
        query {{
          device(id: "{device_info["id"]}") {{
            interfaces {{
              name
              ip_addresses {{
                address
              }}
            }}
          }}
        }}
        """
        device_result = await real_nautobot_service.graphql_query(device_query)
        all_interfaces = device_result["data"]["device"]["interfaces"]

        # Find interface with primary IP
        original_interface_name = None
        for iface in all_interfaces:
            for ip in iface.get("ip_addresses", []):
                if ip["address"] == device_info["original_primary_ip4"]:
                    original_interface_name = iface["name"]
                    break
            if original_interface_name:
                break

        if not original_interface_name:
            pytest.skip(
                f"Device {device_info['name']} doesn't have interface with primary IP, skipping test"
            )

        # Update primary IP WITHOUT creating new interface
        # Use baseline prefix 192.168.178.x (IP 130 to avoid conflicts)
        new_ip = "192.168.178.130/24"

        result = await device_update_service.update_device(
            device_identifier={"id": device_info["id"]},
            update_data={
                "primary_ip4": new_ip,
                "ip_namespace": "Global",  # Use namespace NAME, not ID
            },
            interface_config={
                "mgmt_interface_create_on_ip_change": False,  # UPDATE EXISTING
            },
        )

        # Verify success
        assert result["success"] is True, f"IP update failed: {result.get('message')}"
        assert "primary_ip4" in result["updated_fields"]

        # Verify device has new primary IP
        device_query = f"""
        query {{
          device(id: "{device_info["id"]}") {{
            primary_ip4 {{
              address
            }}
            interfaces(name: "{original_interface_name}") {{
              name
              ip_addresses {{
                address
              }}
            }}
          }}
        }}
        """
        device_result = await real_nautobot_service.graphql_query(device_query)
        device = device_result["data"]["device"]

        # Verify primary IP changed
        assert device["primary_ip4"]["address"] == new_ip

        # Verify interface still exists with updated IP
        assert len(device["interfaces"]) == 1
        interface = device["interfaces"][0]
        assert interface["name"] == original_interface_name
        assert any(ip["address"] == new_ip for ip in interface["ip_addresses"])

        logger.info("✓ Primary IP updated on existing interface")


# =============================================================================
# Integration Tests - Edge Cases
# =============================================================================


@pytest.mark.integration
@pytest.mark.nautobot
class TestDeviceOperationsEdgeCases:
    """Test edge cases and error handling for device operations."""

    @pytest.mark.asyncio
    async def test_update_nonexistent_device(self, device_update_service):
        """
        Test that updating a non-existent device fails gracefully.
        """
        # Try to update device that doesn't exist
        result = await device_update_service.update_device(
            device_identifier={"id": "00000000-0000-0000-0000-000000000000"},
            update_data={"serial": "SHOULD-FAIL"},
        )

        # Verify failure
        assert result["success"] is False
        assert (
            "not found" in result["message"].lower()
            or "failed" in result["message"].lower()
        )

        logger.info("✓ Non-existent device update rejected as expected")
