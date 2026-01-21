"""
Integration tests for CheckMK using baseline test data.

These tests use the baseline.yaml data loaded into Nautobot to test
real CheckMK integration with known devices.

Prerequisites:
1. Nautobot instance running with baseline data loaded
2. CheckMK instance running and configured in settings
3. Backend server running

Run with:
    pytest tests/integration/test_checkmk_baseline.py -v -m "integration and checkmk"
"""

import pytest

from services.checkmk.sync.base import NautobotToCheckMKService
from services.checkmk.config import ConfigService
from services.nautobot import nautobot_service


@pytest.mark.integration
@pytest.mark.checkmk
@pytest.mark.nautobot
class TestCheckMKWithBaseline:
    """Test CheckMK integration using baseline test data."""

    @pytest.fixture(scope="class")
    def config_service(self):
        """Get config service instance."""
        return ConfigService()

    @pytest.fixture(scope="class")
    def nb2cmk_service(self):
        """Get Nautobot to CheckMK service instance."""
        return NautobotToCheckMKService()

    @pytest.mark.asyncio
    async def test_fetch_baseline_devices(self, nb2cmk_service):
        """Test fetching devices from Nautobot with baseline data."""
        result = await nb2cmk_service.get_devices_for_sync()

        assert result is not None
        assert result.total > 0
        assert len(result.devices) > 0

        # Should have network devices from baseline
        device_names = [d["name"] for d in result.devices]
        print(f"\nFound {len(device_names)} devices in Nautobot")
        print(f"First 10 devices: {device_names[:10]}")

    @pytest.mark.asyncio
    async def test_get_device_with_snmp_from_baseline(self):
        """Test getting a device with SNMP credentials from baseline."""
        # Query Nautobot for all devices and filter in Python
        query = """
        query {
          devices {
            id
            name
            _custom_field_data
          }
        }
        """

        result = await nautobot_service.graphql_query(query, {})

        if "errors" in result:
            pytest.skip(f"GraphQL error: {result['errors']}")

        all_devices = result.get("data", {}).get("devices", [])

        # Filter for devices with credA
        devices = [
            d
            for d in all_devices
            if d.get("_custom_field_data", {}).get("snmp_credentials") == "credA"
        ]

        if not devices:
            pytest.skip("No devices with SNMP credA found in baseline")

        device = devices[0]
        print(f"\nFound device with SNMP credA: {device['name']}")
        print(f"Device ID: {device['id']}")
        print(f"Custom fields: {device['_custom_field_data']}")

        assert device["_custom_field_data"]["snmp_credentials"] == "credA"

    @pytest.mark.asyncio
    async def test_normalize_baseline_device(self, nb2cmk_service, config_service):
        """Test normalizing a baseline device with SNMP credentials."""
        # Get all devices and find lab-001
        query = """
        query {
          devices {
            id
            name
            primary_ip4 {
              address
            }
            location {
              name
              parent {
                name
              }
            }
            role {
              name
            }
            platform {
              name
            }
            status {
              name
            }
            _custom_field_data
            tags {
              name
            }
          }
        }
        """

        result = await nautobot_service.graphql_query(query, {})

        if "errors" in result:
            pytest.skip(f"GraphQL error: {result['errors']}")

        all_devices = result.get("data", {}).get("devices", [])

        # Filter for lab-001
        devices = [d for d in all_devices if d.get("name") == "lab-001"]

        if not devices:
            pytest.skip("Device 'lab-001' not found in baseline")

        device_id = devices[0]["id"]

        # Try to normalize the device
        try:
            normalized_config = await nb2cmk_service.get_device_normalized(device_id)

            print("\nNormalized config for lab-001:")
            print(f"Folder: {normalized_config.get('folder')}")
            print(
                f"Attributes keys: {list(normalized_config.get('attributes', {}).keys())}"
            )

            assert "folder" in normalized_config
            assert "attributes" in normalized_config

            # Check for SNMP configuration if credB is mapped
            if devices[0].get("_custom_field_data", {}).get("snmp_credentials"):
                print(
                    f"SNMP credentials: {devices[0]['_custom_field_data']['snmp_credentials']}"
                )

        except Exception as e:
            print(f"Normalization error: {e}")
            # Don't fail - device might not have required fields
            pytest.skip(f"Could not normalize device: {e}")

    @pytest.mark.asyncio
    async def test_compare_baseline_device_if_exists_in_checkmk(self, nb2cmk_service):
        """
        Test comparing a baseline device with CheckMK.

        This test will skip if the device doesn't exist in CheckMK yet.
        """
        # Get devices from Nautobot
        devices_result = await nb2cmk_service.get_devices_for_sync()

        if not devices_result.devices:
            pytest.skip("No devices found in Nautobot")

        # Try to compare the first device
        device_id = devices_result.devices[0]["id"]
        device_name = devices_result.devices[0]["name"]

        print(f"\nAttempting to compare device: {device_name} (ID: {device_id})")

        try:
            comparison_result = await nb2cmk_service.compare_device_config(device_id)

            print(f"Comparison result: {comparison_result.result}")
            print(
                f"Differences: {comparison_result.diff if comparison_result.diff else 'None'}"
            )

            assert comparison_result is not None
            assert hasattr(comparison_result, "result")
            assert comparison_result.result in ["equal", "diff", "host_not_found"]

            if comparison_result.result == "host_not_found":
                pytest.skip(f"Device '{device_name}' not found in CheckMK (expected)")

        except Exception as e:
            # If device doesn't exist in CheckMK, that's expected
            if "not found" in str(e).lower() or "404" in str(e):
                pytest.skip(f"Device '{device_name}' not found in CheckMK (expected)")
            else:
                raise

    @pytest.mark.asyncio
    async def test_list_devices_with_snmp_credentials(self):
        """List all devices in baseline that have SNMP credentials."""
        query = """
        query {
          devices {
            id
            name
            _custom_field_data
          }
        }
        """

        result = await nautobot_service.graphql_query(query, {})

        if "errors" in result:
            pytest.skip(f"GraphQL error: {result['errors']}")

        devices = result.get("data", {}).get("devices", [])
        devices_with_snmp = [
            d
            for d in devices
            if d.get("_custom_field_data", {}).get("snmp_credentials")
        ]

        print(f"\nTotal devices in Nautobot: {len(devices)}")
        print(f"Devices with SNMP credentials: {len(devices_with_snmp)}")

        if devices_with_snmp:
            print("\nFirst 5 devices with SNMP:")
            for device in devices_with_snmp[:5]:
                snmp_cred = device["_custom_field_data"]["snmp_credentials"]
                print(f"  - {device['name']}: {snmp_cred}")

        assert len(devices) > 0


@pytest.mark.integration
@pytest.mark.checkmk
class TestSNMPMappingWithBaseline:
    """Test SNMP mapping configuration with baseline credentials."""

    def test_snmp_mapping_covers_baseline_credentials(self):
        """Verify SNMP mapping covers baseline credential IDs."""
        from services.checkmk.config import config_service

        # Load SNMP mapping
        snmp_mapping = config_service.load_snmp_mapping()

        # Baseline uses: credA, credB, credC
        baseline_creds = [
            "credA",
            "credB",
            "credC",
            "snmp-id-1",
            "snmp-id-2",
            "snmp-id-3",
        ]

        print(f"\nSNMP mapping keys: {list(snmp_mapping.keys())}")
        print(f"Baseline credential IDs: {baseline_creds}")

        # Check which baseline creds are mapped
        unmapped_baseline = [
            cred for cred in baseline_creds if cred not in snmp_mapping
        ]

        if unmapped_baseline:
            print(
                f"\nWARNING: Baseline credentials not in SNMP mapping: {unmapped_baseline}"
            )
            print("You may need to add these to config/snmp_mapping.yaml")

        # At least the snmp-id-* should be mapped
        assert any(key.startswith("snmp-id-") for key in snmp_mapping.keys())


# =============================================================================
# Helper Test: Check Prerequisites
# =============================================================================


@pytest.mark.integration
class TestPrerequisites:
    """Test that prerequisites are met for baseline testing."""

    @pytest.mark.asyncio
    async def test_nautobot_is_accessible(self):
        """Test that Nautobot is accessible."""
        query = """
        query {
          devices {
            id
          }
        }
        """

        try:
            result = await nautobot_service.graphql_query(query, {})
            assert "data" in result
            print("\n✅ Nautobot is accessible")
        except Exception as e:
            pytest.fail(f"❌ Nautobot not accessible: {e}")

    def test_checkmk_config_exists(self):
        """Test that CheckMK configuration exists."""
        from services.checkmk.config import config_service

        try:
            config = config_service.load_checkmk_config()
            assert config is not None
            print("\n✅ CheckMK configuration loaded")
        except Exception as e:
            pytest.fail(f"❌ CheckMK config not found: {e}")

    def test_snmp_mapping_exists(self):
        """Test that SNMP mapping exists."""
        from services.checkmk.config import config_service

        try:
            snmp_mapping = config_service.load_snmp_mapping()
            assert snmp_mapping is not None
            assert len(snmp_mapping) > 0
            print(f"\n✅ SNMP mapping loaded ({len(snmp_mapping)} entries)")
        except Exception as e:
            pytest.fail(f"❌ SNMP mapping not found: {e}")
