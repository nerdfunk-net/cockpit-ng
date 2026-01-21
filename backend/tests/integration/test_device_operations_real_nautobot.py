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
from models.nautobot import AddDeviceRequest, InterfaceData, IpAddressData

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
                    ip_addresses=[
                        IpAddressData(
                            address="192.168.178.128/24",
                            namespace=ids["namespace_id"],
                            is_primary=True,
                        )
                    ],
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
                    ip_addresses=[
                        IpAddressData(
                            address="10.99.99.10/24",  # IP in non-existent prefix
                            namespace=ids["namespace_id"],
                            is_primary=True,
                        )
                    ],
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
        Test that adding a device without automatic prefix creation raises an exception
        when the parent prefix doesn't exist.

        This tests that add_prefix=False prevents automatic prefix creation,
        and an exception is raised when trying to create an IP without a parent prefix.

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

        # Generate unique device name using timestamp to avoid collisions
        import time

        unique_suffix = (
            int(time.time() * 1000) % 1000000
        )  # Use milliseconds for uniqueness
        device_name = f"test-device-no-prefix-{unique_suffix}"

        # Clean up any existing device with this name (from failed previous runs)
        try:
            cleanup_query = f"""
            query {{
              devices(name: "{device_name}") {{
                id
              }}
            }}
            """
            cleanup_result = await real_nautobot_service.graphql_query(cleanup_query)
            existing_devices = cleanup_result.get("data", {}).get("devices", [])
            for device in existing_devices:
                logger.info(
                    f"Cleaning up existing device {device['id']} from previous test run"
                )
                await real_nautobot_service.rest_request(
                    endpoint=f"dcim/devices/{device['id']}/", method="DELETE"
                )
        except Exception as e:
            logger.warning(f"Could not cleanup existing device: {e}")

        # Create device request with IP in non-existent prefix
        request = AddDeviceRequest(
            name=device_name,
            role=ids["role_id"],
            status=ids["status_id"],
            location=ids["location_id"],
            device_type=ids["device_type_id"],
            platform=ids["platform_id"],
            serial=f"TEST-NO-PREFIX-{unique_suffix}",
            add_prefix=False,  # Disable automatic prefix creation
            default_prefix_length="/24",
            interfaces=[
                InterfaceData(
                    name="GigabitEthernet0/0",
                    type="1000base-t",
                    status=ids["status_id"],
                    ip_addresses=[
                        IpAddressData(
                            address="10.98.98.10/24",  # IP in non-existent prefix
                            namespace=ids["namespace_id"],
                            is_primary=True,
                        )
                    ],
                ),
            ],
        )

        # Device creation should raise an exception when IP creation fails due to missing prefix
        with pytest.raises(Exception) as exc_info:
            await device_creation_service.create_device_with_interfaces(request)

        # Verify the exception message mentions the missing prefix
        error_message = str(exc_info.value).lower()
        assert any(
            keyword in error_message for keyword in ["prefix", "parent", "network"]
        ), f"Error should mention missing prefix. Got: {exc_info.value}"

        # Verify the exception mentions that automatic prefix creation is disabled
        assert any(
            keyword in error_message
            for keyword in [
                "create the parent prefix manually",
                "enable automatic prefix creation",
            ]
        ), (
            f"Error should mention manual prefix creation or enabling automatic creation. Got: {exc_info.value}"
        )

        # Verify prefix was NOT created
        prefix_result = await real_nautobot_service.graphql_query(prefix_query)
        prefixes = prefix_result["data"]["prefixes"]
        assert len(prefixes) == 0, (
            "Prefix should not have been created when add_prefix=False"
        )

        # Note: The device may have been created before the IP creation failed.
        # We need to find and clean it up manually since the normal fixture won't track it.
        try:
            device_query = f"""
            query {{
              devices(name: "{device_name}") {{
                id
              }}
            }}
            """
            device_result = await real_nautobot_service.graphql_query(device_query)
            devices = device_result.get("data", {}).get("devices", [])
            if devices:
                device_id = devices[0]["id"]
                test_device_ids.append(device_id)  # Track for cleanup
                logger.info(
                    f"Device {device_id} was created before IP failure, will be cleaned up"
                )
        except Exception as e:
            logger.warning(f"Could not check for orphaned device: {e}")

        logger.info(
            "✓ Device creation correctly raised exception when add_prefix=False and parent prefix missing"
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

    @pytest.mark.asyncio
    async def test_update_primary_ip_using_existing_unassigned_ip(
        self, real_nautobot_service, device_update_service, baseline_device_ids
    ):
        """
        Test updating primary IPv4 using an EXISTING but UNASSIGNED IP address.

        This tests the "Use Assigned IP address if IP exists and is not assigned" feature.

        Steps:
        1. Create a new IP address that is not assigned to any device
        2. Update a device's primary IP to use this existing unassigned IP
        3. Verify the IP is now assigned to the device as primary IP

        Uses baseline device lab-100.
        """
        device_info = baseline_device_ids["lab-100"]
        ids = await get_required_ids(real_nautobot_service)

        # Step 1: Create a new unassigned IP address (or reuse if exists)
        # Use baseline prefix 192.168.178.x (IP 131 to avoid conflicts)
        existing_unassigned_ip = "192.168.178.131/24"

        # First, check if IP already exists
        check_ip_query = """
        query {
          ip_addresses(address: ["192.168.178.131/24"]) {
            id
            address
            interfaces {
              id
            }
          }
        }
        """
        check_result = await real_nautobot_service.graphql_query(check_ip_query)

        existing_ips = check_result.get("data", {}).get("ip_addresses", [])

        if existing_ips:
            # IP exists - check if it's unassigned
            existing_ip = existing_ips[0]
            created_ip_id = existing_ip["id"]

            if existing_ip.get("interfaces"):
                # IP is assigned to interface, delete it and recreate
                logger.info(
                    f"IP {existing_unassigned_ip} exists and is assigned, deleting it"
                )
                await real_nautobot_service.rest_request(
                    endpoint=f"ipam/ip-addresses/{created_ip_id}/", method="DELETE"
                )
                # Now create a fresh one
                create_ip_payload = {
                    "address": existing_unassigned_ip,
                    "status": ids["status_id"],
                    "namespace": ids["namespace_id"],
                    "type": "host",
                }

                logger.info(f"Creating unassigned IP: {existing_unassigned_ip}")
                ip_create_result = await real_nautobot_service.rest_request(
                    endpoint="ipam/ip-addresses/", method="POST", data=create_ip_payload
                )
                created_ip_id = ip_create_result["id"]
            else:
                # IP exists and is unassigned, perfect - use it
                logger.info(f"Using existing unassigned IP: {existing_unassigned_ip}")
        else:
            # IP doesn't exist, create it
            create_ip_payload = {
                "address": existing_unassigned_ip,
                "status": ids["status_id"],
                "namespace": ids["namespace_id"],
                "type": "host",
            }

            logger.info(f"Creating unassigned IP: {existing_unassigned_ip}")
            ip_create_result = await real_nautobot_service.rest_request(
                endpoint="ipam/ip-addresses/", method="POST", data=create_ip_payload
            )
            created_ip_id = ip_create_result["id"]

        logger.info(f"✓ Unassigned IP ready with ID: {created_ip_id}")

        # Verify IP exists and is not assigned
        ip_query = f"""
        query {{
          ip_address(id: "{created_ip_id}") {{
            id
            address
            interfaces {{
              id
            }}
          }}
        }}
        """
        ip_result = await real_nautobot_service.graphql_query(ip_query)
        ip_data = ip_result["data"]["ip_address"]
        assert ip_data["address"] == existing_unassigned_ip
        assert (
            ip_data.get("interfaces") is None or len(ip_data.get("interfaces", [])) == 0
        ), "IP should not be assigned yet"

        # Step 2: Update device to use this existing unassigned IP
        logger.info(
            f"Updating device {device_info['name']} to use existing unassigned IP"
        )
        result = await device_update_service.update_device(
            device_identifier={"id": device_info["id"]},
            update_data={
                "primary_ip4": existing_unassigned_ip,
                "ip_namespace": "Global",
            },
            interface_config={
                "name": "Loopback131",
                "type": "virtual",
                "status": "active",
                "mgmt_interface_create_on_ip_change": True,
            },
        )

        # Verify success
        assert result["success"] is True, f"IP update failed: {result.get('message')}"
        assert "primary_ip4" in result["updated_fields"]

        # Step 3: Verify the existing IP is now assigned to the device
        device_query = f"""
        query {{
          device(id: "{device_info["id"]}") {{
            primary_ip4 {{
              id
              address
            }}
            interfaces(name: "Loopback131") {{
              name
              type
              ip_addresses {{
                id
                address
              }}
            }}
          }}
        }}
        """
        device_result = await real_nautobot_service.graphql_query(device_query)
        device = device_result["data"]["device"]

        # Verify primary IP is set to the existing unassigned IP
        assert device["primary_ip4"]["address"] == existing_unassigned_ip
        assert device["primary_ip4"]["id"] == created_ip_id, (
            "Should use the existing IP, not create a new one"
        )

        # Verify interface was created and has the IP
        assert len(device["interfaces"]) == 1
        interface = device["interfaces"][0]
        assert interface["name"] == "Loopback131"
        assert interface["type"] == "VIRTUAL"

        # Verify the IP is assigned to the interface
        ip_addresses = [ip["address"] for ip in interface["ip_addresses"]]
        assert existing_unassigned_ip in ip_addresses

        # Verify the IP is no longer unassigned
        ip_check_query = f"""
        query {{
          ip_address(id: "{created_ip_id}") {{
            interfaces {{
              id
              name
              device {{
                id
                name
              }}
            }}
          }}
        }}
        """
        ip_check_result = await real_nautobot_service.graphql_query(ip_check_query)
        ip_check_data = ip_check_result["data"]["ip_address"]

        assert (
            ip_check_data.get("interfaces") is not None
            and len(ip_check_data["interfaces"]) > 0
        ), "IP should now be assigned to interface"
        interface_data = ip_check_data["interfaces"][0]
        assert interface_data["name"] == "Loopback131"
        assert interface_data["device"]["id"] == device_info["id"]

        logger.info("✓ Existing unassigned IP successfully assigned to device")


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


# =============================================================================
# Integration Tests - Add Device with Tags and Custom Fields
# =============================================================================


@pytest.mark.integration
@pytest.mark.nautobot
class TestAddDeviceWithTagsAndCustomFields:
    """Test adding devices with tags and custom fields."""

    @pytest.mark.asyncio
    async def test_add_device_with_tags(
        self, real_nautobot_service, device_creation_service, test_device_ids
    ):
        """
        Test adding a device with tags.

        This tests that tags are properly assigned when creating a device.
        Uses baseline tags: Production, Staging, lab
        """
        # Get required IDs
        ids = await get_required_ids(real_nautobot_service)

        # Get tag IDs from baseline
        tag_query = """
        query {
          tags(name: ["Production", "Staging"]) {
            id
            name
          }
        }
        """
        tag_result = await real_nautobot_service.graphql_query(tag_query)
        tags = tag_result["data"]["tags"]
        tag_ids = [tag["id"] for tag in tags]

        assert len(tag_ids) >= 2, "Need at least 2 tags for testing"

        # Create device with tags
        request = AddDeviceRequest(
            name="test-device-with-tags",
            role=ids["role_id"],
            status=ids["status_id"],
            location=ids["location_id"],
            device_type=ids["device_type_id"],
            platform=ids["platform_id"],
            serial="TEST-TAGS-001",
            tags=tag_ids,  # Assign multiple tags
            interfaces=[
                InterfaceData(
                    name="GigabitEthernet0/0",
                    type="1000base-t",
                    status=ids["status_id"],
                    ip_addresses=[
                        IpAddressData(
                            address="192.168.178.140/24",
                            namespace=ids["namespace_id"],
                            is_primary=True,
                        )
                    ],
                ),
            ],
        )

        # Create the device
        result = await device_creation_service.create_device_with_interfaces(request)

        # Track for cleanup
        if result.get("device_id"):
            test_device_ids.append(result["device_id"])

        # Verify success
        assert result["success"] is True

        # Verify device has tags
        device_query = f"""
        query {{
          device(id: "{result["device_id"]}") {{
            id
            name
            tags {{
              id
              name
            }}
          }}
        }}
        """
        device_result = await real_nautobot_service.graphql_query(device_query)
        device = device_result["data"]["device"]

        # Verify tags were assigned
        device_tag_ids = [tag["id"] for tag in device["tags"]]
        for tag_id in tag_ids:
            assert tag_id in device_tag_ids, (
                f"Tag {tag_id} should be assigned to device"
            )

        logger.info(f"✓ Device created with {len(device['tags'])} tags")

    @pytest.mark.asyncio
    async def test_add_device_with_custom_fields(
        self, real_nautobot_service, device_creation_service, test_device_ids
    ):
        """
        Test adding a device with custom fields.

        This tests that custom fields are properly set when creating a device.
        Uses custom fields from baseline: net, checkmk_site

        Note: The 'net' custom field has allowed choices: netA, netB, lab
        """
        # Get required IDs
        ids = await get_required_ids(real_nautobot_service)

        # Create device with custom fields (using valid choices)
        request = AddDeviceRequest(
            name="test-device-with-custom-fields",
            role=ids["role_id"],
            status=ids["status_id"],
            location=ids["location_id"],
            device_type=ids["device_type_id"],
            platform=ids["platform_id"],
            serial="TEST-CF-001",
            custom_fields={
                "net": "netA",  # Valid choice from baseline: netA, netB, lab
                "checkmk_site": "siteA",  # Valid choice from baseline: siteA, siteB, siteC
            },
            interfaces=[
                InterfaceData(
                    name="GigabitEthernet0/0",
                    type="1000base-t",
                    status=ids["status_id"],
                    ip_addresses=[
                        IpAddressData(
                            address="192.168.178.141/24",
                            namespace=ids["namespace_id"],
                            is_primary=True,
                        )
                    ],
                ),
            ],
        )

        # Create the device
        result = await device_creation_service.create_device_with_interfaces(request)

        # Track for cleanup
        if result.get("device_id"):
            test_device_ids.append(result["device_id"])

        # Verify success
        assert result["success"] is True

        # Verify device has custom fields
        device_query = f"""
        query {{
          device(id: "{result["device_id"]}") {{
            id
            name
            _custom_field_data
          }}
        }}
        """
        device_result = await real_nautobot_service.graphql_query(device_query)
        device = device_result["data"]["device"]

        # Verify custom fields were set
        custom_fields = device.get("_custom_field_data", {})
        assert custom_fields.get("net") == "netA"
        assert custom_fields.get("checkmk_site") == "siteA"

        logger.info("✓ Device created with custom fields")

    @pytest.mark.asyncio
    async def test_add_device_with_tags_and_custom_fields(
        self, real_nautobot_service, device_creation_service, test_device_ids
    ):
        """
        Test adding a device with both tags AND custom fields.

        This tests the combination of tags, custom fields, and asset_tag.
        """
        # Get required IDs
        ids = await get_required_ids(real_nautobot_service)

        # Get tag IDs
        tag_query = """
        query {
          tags(name: "Production") {
            id
            name
          }
        }
        """
        tag_result = await real_nautobot_service.graphql_query(tag_query)
        production_tag_id = tag_result["data"]["tags"][0]["id"]

        # Create device with both tags and custom fields
        request = AddDeviceRequest(
            name="test-device-full-metadata",
            role=ids["role_id"],
            status=ids["status_id"],
            location=ids["location_id"],
            device_type=ids["device_type_id"],
            platform=ids["platform_id"],
            serial="TEST-FULL-001",
            asset_tag="ASSET-FULL-001",
            tags=[production_tag_id],
            custom_fields={
                "net": "netB",  # Valid choice from baseline: netA, netB, lab
                "checkmk_site": "siteB",  # Valid choice from baseline: siteA, siteB, siteC
            },
            interfaces=[
                InterfaceData(
                    name="GigabitEthernet0/0",
                    type="1000base-t",
                    status=ids["status_id"],
                    ip_addresses=[
                        IpAddressData(
                            address="192.168.178.142/24",
                            namespace=ids["namespace_id"],
                            is_primary=True,
                        )
                    ],
                    description="Production management interface",
                ),
            ],
        )

        # Create the device
        result = await device_creation_service.create_device_with_interfaces(request)

        # Track for cleanup
        if result.get("device_id"):
            test_device_ids.append(result["device_id"])

        # Verify success
        assert result["success"] is True

        # Verify all metadata
        device_query = f"""
        query {{
          device(id: "{result["device_id"]}") {{
            id
            name
            serial
            asset_tag
            tags {{
              id
              name
            }}
            _custom_field_data
          }}
        }}
        """
        device_result = await real_nautobot_service.graphql_query(device_query)
        device = device_result["data"]["device"]

        # Verify basic fields
        assert device["serial"] == "TEST-FULL-001"
        assert device["asset_tag"] == "ASSET-FULL-001"

        # Verify tags
        assert len(device["tags"]) >= 1
        assert any(tag["name"] == "Production" for tag in device["tags"])

        # Verify custom fields
        custom_fields = device.get("_custom_field_data", {})
        assert custom_fields.get("net") == "netB"
        assert custom_fields.get("checkmk_site") == "siteB"

        logger.info(
            "✓ Device created with full metadata (tags + custom fields + asset_tag)"
        )


# =============================================================================
# Integration Tests - Add Device with Multiple Interfaces
# =============================================================================


@pytest.mark.integration
@pytest.mark.nautobot
class TestAddDeviceWithMultipleInterfaces:
    """Test adding devices with multiple interfaces and advanced interface configurations."""

    @pytest.mark.asyncio
    async def test_add_device_with_multiple_interfaces(
        self, real_nautobot_service, device_creation_service, test_device_ids
    ):
        """
        Test adding a device with multiple interfaces.

        This tests creating a device with:
        - Management interface (with IP)
        - Data interface (with IP)
        - Loopback interface (with IP)
        """
        # Get required IDs
        ids = await get_required_ids(real_nautobot_service)

        # Create device with 3 interfaces
        request = AddDeviceRequest(
            name="test-device-multi-interface",
            role=ids["role_id"],
            status=ids["status_id"],
            location=ids["location_id"],
            device_type=ids["device_type_id"],
            platform=ids["platform_id"],
            serial="TEST-MULTI-IF-001",
            interfaces=[
                InterfaceData(
                    name="GigabitEthernet0/0",
                    type="1000base-t",
                    status=ids["status_id"],
                    ip_addresses=[
                        IpAddressData(
                            address="192.168.178.150/24",
                            namespace=ids["namespace_id"],
                            is_primary=True,
                        )
                    ],
                    description="Management interface",
                    mgmt_only=True,
                ),
                InterfaceData(
                    name="GigabitEthernet0/1",
                    type="1000base-t",
                    status=ids["status_id"],
                    ip_addresses=[
                        IpAddressData(
                            address="192.168.178.151/24",
                            namespace=ids["namespace_id"],
                        )
                    ],
                    description="Data interface",
                ),
                InterfaceData(
                    name="Loopback0",
                    type="virtual",
                    status=ids["status_id"],
                    ip_addresses=[
                        IpAddressData(
                            address="10.255.255.1/32",
                            namespace=ids["namespace_id"],
                        )
                    ],
                    description="Loopback interface",
                ),
            ],
        )

        # Create the device
        result = await device_creation_service.create_device_with_interfaces(request)

        # Track for cleanup
        if result.get("device_id"):
            test_device_ids.append(result["device_id"])

        # Verify success
        assert result["success"] is True

        # Verify summary
        summary = result["summary"]
        assert summary["interfaces_created"] == 3
        assert summary["ip_addresses_created"] == 3

        # Verify all interfaces exist
        device_query = f"""
        query {{
          device(id: "{result["device_id"]}") {{
            id
            name
            primary_ip4 {{
              address
            }}
            interfaces {{
              name
              type
              description
              mgmt_only
              ip_addresses {{
                address
              }}
            }}
          }}
        }}
        """
        device_result = await real_nautobot_service.graphql_query(device_query)
        device = device_result["data"]["device"]

        # Verify primary IP
        assert device["primary_ip4"]["address"] == "192.168.178.150/24"

        # Verify all 3 interfaces
        assert len(device["interfaces"]) == 3

        # Find and verify each interface
        interface_names = [iface["name"] for iface in device["interfaces"]]
        assert "GigabitEthernet0/0" in interface_names
        assert "GigabitEthernet0/1" in interface_names
        assert "Loopback0" in interface_names

        # Verify mgmt_only flag on management interface
        mgmt_interface = next(
            iface
            for iface in device["interfaces"]
            if iface["name"] == "GigabitEthernet0/0"
        )
        assert mgmt_interface["mgmt_only"] is True

        logger.info("✓ Device created with 3 interfaces")

    @pytest.mark.asyncio
    async def test_add_device_with_interface_advanced_properties(
        self, real_nautobot_service, device_creation_service, test_device_ids
    ):
        """
        Test adding a device with advanced interface properties.

        This tests interface properties like:
        - MAC address
        - MTU
        - Enabled/disabled state
        - Description
        """
        # Get required IDs
        ids = await get_required_ids(real_nautobot_service)

        # Create device with advanced interface config
        request = AddDeviceRequest(
            name="test-device-adv-interface",
            role=ids["role_id"],
            status=ids["status_id"],
            location=ids["location_id"],
            device_type=ids["device_type_id"],
            platform=ids["platform_id"],
            serial="TEST-ADV-IF-001",
            interfaces=[
                InterfaceData(
                    name="GigabitEthernet0/0",
                    type="1000base-t",
                    status=ids["status_id"],
                    ip_addresses=[
                        IpAddressData(
                            address="192.168.178.160/24",
                            namespace=ids["namespace_id"],
                            is_primary=True,
                        )
                    ],
                    description="Management with custom MAC and MTU",
                    mac_address="00:1A:2B:3C:4D:5E",
                    mtu=9000,  # Jumbo frames
                    enabled=True,
                    mgmt_only=True,
                ),
            ],
        )

        # Create the device
        result = await device_creation_service.create_device_with_interfaces(request)

        # Track for cleanup
        if result.get("device_id"):
            test_device_ids.append(result["device_id"])

        # Verify success
        assert result["success"] is True

        # Verify interface properties
        device_query = f"""
        query {{
          device(id: "{result["device_id"]}") {{
            interfaces(name: "GigabitEthernet0/0") {{
              name
              mac_address
              mtu
              enabled
              description
              mgmt_only
            }}
          }}
        }}
        """
        device_result = await real_nautobot_service.graphql_query(device_query)
        interface = device_result["data"]["device"]["interfaces"][0]

        # Verify advanced properties
        assert interface["mac_address"] == "00:1A:2B:3C:4D:5E"
        assert interface["mtu"] == 9000
        assert interface["enabled"] is True
        assert "custom MAC and MTU" in interface["description"]
        assert interface["mgmt_only"] is True

        logger.info("✓ Device created with advanced interface properties")


# =============================================================================
# Integration Tests - Add Device with Different Locations and Roles
# =============================================================================


@pytest.mark.integration
@pytest.mark.nautobot
class TestAddDeviceWithDifferentLocationsAndRoles:
    """Test adding devices with different locations and roles."""

    @pytest.mark.asyncio
    async def test_add_device_in_different_location(
        self, real_nautobot_service, device_creation_service, test_device_ids
    ):
        """
        Test adding devices in different locations.

        This creates devices in City B instead of the default City A.
        """
        # Get City B location
        location_query = """
        query {
          locations(name: "City B") {
            id
            name
          }
        }
        """
        result = await real_nautobot_service.graphql_query(location_query)
        city_b_id = result["data"]["locations"][0]["id"]

        # Get other required IDs
        ids = await get_required_ids(real_nautobot_service)

        # Create device in City B
        request = AddDeviceRequest(
            name="test-device-city-b",
            role=ids["role_id"],
            status=ids["status_id"],
            location=city_b_id,  # City B instead of City A
            device_type=ids["device_type_id"],
            platform=ids["platform_id"],
            serial="TEST-CITY-B-001",
            interfaces=[
                InterfaceData(
                    name="GigabitEthernet0/0",
                    type="1000base-t",
                    status=ids["status_id"],
                    ip_addresses=[
                        IpAddressData(
                            address="192.168.178.170/24",
                            namespace=ids["namespace_id"],
                            is_primary=True,
                        )
                    ],
                ),
            ],
        )

        # Create the device
        result = await device_creation_service.create_device_with_interfaces(request)

        # Track for cleanup
        if result.get("device_id"):
            test_device_ids.append(result["device_id"])

        # Verify success
        assert result["success"] is True

        # Verify location
        device_query = f"""
        query {{
          device(id: "{result["device_id"]}") {{
            name
            location {{
              id
              name
            }}
          }}
        }}
        """
        device_result = await real_nautobot_service.graphql_query(device_query)
        device = device_result["data"]["device"]

        assert device["location"]["id"] == city_b_id
        assert device["location"]["name"] == "City B"

        logger.info("✓ Device created in City B location")

    @pytest.mark.asyncio
    async def test_add_device_with_different_role(
        self, real_nautobot_service, device_creation_service, test_device_ids
    ):
        """
        Test adding a device with server role instead of network role.

        Uses baseline server role from the test data.
        """
        # Get server role
        role_query = """
        query {
          roles(name: "server") {
            id
            name
          }
        }
        """
        result = await real_nautobot_service.graphql_query(role_query)

        if not result["data"]["roles"]:
            pytest.skip("Server role not available in test environment")

        server_role_id = result["data"]["roles"][0]["id"]

        # Get other required IDs
        ids = await get_required_ids(real_nautobot_service)

        # Create server device
        request = AddDeviceRequest(
            name="test-server-001",
            role=server_role_id,  # Server role instead of Network
            status=ids["status_id"],
            location=ids["location_id"],
            device_type=ids["device_type_id"],
            serial="TEST-SERVER-001",
            interfaces=[
                InterfaceData(
                    name="eth0",
                    type="1000base-t",
                    status=ids["status_id"],
                    ip_addresses=[
                        IpAddressData(
                            address="192.168.178.180/24",
                            namespace=ids["namespace_id"],
                            is_primary=True,
                        )
                    ],
                    description="Primary network interface",
                ),
            ],
        )

        # Create the device
        result = await device_creation_service.create_device_with_interfaces(request)

        # Track for cleanup
        if result.get("device_id"):
            test_device_ids.append(result["device_id"])

        # Verify success
        assert result["success"] is True

        # Verify role
        device_query = f"""
        query {{
          device(id: "{result["device_id"]}") {{
            name
            role {{
              id
              name
            }}
          }}
        }}
        """
        device_result = await real_nautobot_service.graphql_query(device_query)
        device = device_result["data"]["device"]

        assert device["role"]["id"] == server_role_id
        assert device["role"]["name"] == "server"

        logger.info("✓ Server device created with server role")
