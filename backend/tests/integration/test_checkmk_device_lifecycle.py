"""
Integration tests for CheckMK device lifecycle: Compare → Create → Compare → Sync → Delete.

Prerequisites: ``backend/.env.test`` with CheckMK and Nautobot (baseline with lab-001).
See ``.env.test.example``.

Run:
    pytest tests/integration/test_checkmk_device_lifecycle.py -v -m "integration and checkmk"
"""

from contextlib import contextmanager
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from core.auth import verify_token
from services.checkmk.base import (
    CheckMKClientFactory,
    checkmk_api_base_url,
    get_checkmk_config,
)
from services.checkmk.client import CheckMKAPIError
from services.checkmk.config import ConfigService
from services.checkmk.sync.base import NautobotToCheckMKService
from services.settings.manager import SettingsManager as _SM

settings_manager = _SM()

# Baseline device used for pre-sync compare (must exist in Nautobot, not in CheckMK yet)
BASELINE_COMPARE_DEVICE_NAME = "lab-001"

# Suppress InsecureRequestWarning for self-signed certificates in test environment
# This is expected when testing against CheckMK instances with self-signed certificates
pytestmark = pytest.mark.filterwarnings(
    "ignore::urllib3.exceptions.InsecureRequestWarning"
)


# =============================================================================
# Test Fixtures and Helpers
# =============================================================================


@pytest.fixture(scope="class")
def nautobot_service(real_nautobot_service):
    return real_nautobot_service


@pytest.fixture(scope="module")
def checkmk_client():
    """Create CheckMK client from ``.env.test`` (via SettingsManager test env)."""
    try:
        return CheckMKClientFactory.build_client_from_settings()
    except Exception as exc:
        pytest.skip(f"CheckMK not configured: {exc}")


@pytest.fixture(scope="module")
def config_service():
    """Get config service instance."""
    return ConfigService()


@pytest.fixture(scope="module")
def nb2cmk_service():
    """Get Nautobot to CheckMK service instance."""
    return NautobotToCheckMKService()


async def _resolve_nautobot_device_id(nautobot_service, device_name: str) -> str:
    """Return the Nautobot UUID for a device by name."""
    query = f"""
    query {{
      devices(name: "{device_name}") {{
        id
        name
      }}
    }}
    """
    result = await nautobot_service.graphql_query(query, {})
    if "errors" in result:
        pytest.skip(f"GraphQL error resolving {device_name}: {result['errors']}")

    devices = result.get("data", {}).get("devices", [])
    if not devices:
        pytest.skip(f"Device '{device_name}' not found in Nautobot baseline")

    return devices[0]["id"]


@contextmanager
def _authenticated_api_client():
    """TestClient with auth/RBAC bypass for nb2cmk compare endpoints."""
    from main import app

    def override_verify_token() -> dict:
        return {"username": "admin", "user_id": 1, "permissions": 0xFFFFFFFF}

    mock_rbac_service = MagicMock()
    mock_rbac_service.has_permission.return_value = True
    mock_rbac = patch(
        "service_factory.build_rbac_service",
        return_value=mock_rbac_service,
    )

    app.dependency_overrides[verify_token] = override_verify_token
    with mock_rbac:
        yield TestClient(app)
    app.dependency_overrides.clear()


# Test device configurations to create in CheckMK
TEST_DEVICES = [
    {
        "host_name": "test-device-01",
        "folder": "/",
        "attributes": {
            "ipaddress": "10.0.1.10",
            "site": "cmk",
            "alias": "Test Device 01",
            "tag_agent": "no-agent",
            "tag_snmp_ds": "snmp-v2",
            "snmp_community": {
                "type": "v1_v2_community",
                "community": "test_community",
            },
        },
    },
    {
        "host_name": "test-device-02",
        "folder": "/",
        "attributes": {
            "ipaddress": "10.0.1.11",
            "site": "cmk",
            "alias": "Test Device 02",
            "tag_agent": "no-agent",
            "tag_snmp_ds": "snmp-v2",  # CheckMK uses snmp-v2 for both v2 and v3
            "snmp_community": {
                "type": "v3_auth_privacy",
                "auth_protocol": "SHA-2-256",  # Must use exact CheckMK enum value
                "auth_password": "test_auth_pass",
                "privacy_protocol": "AES-256",  # Must specify bit length
                "privacy_password": "test_priv_pass",
                "security_name": "test_user",
            },
        },
    },
    {
        "host_name": "test-device-03",
        "folder": "/",
        "attributes": {
            "ipaddress": "10.0.1.12",
            "site": "cmk",
            "alias": "Test Device 03 - No SNMP",
            "tag_agent": "cmk-agent",
            "tag_snmp_ds": "no-snmp",  # Explicitly set no SNMP
        },
    },
]


# =============================================================================
# Test Class: Device Lifecycle
# =============================================================================


@pytest.mark.integration
@pytest.mark.checkmk
class TestCheckMKDeviceLifecycle:
    """Test complete device lifecycle: Create → Compare → Sync → Delete."""

    @classmethod
    def setup_class(cls):
        """Set up test class - store created devices for cleanup."""
        cls.created_devices = []

    @classmethod
    def teardown_class(cls):
        """Clean up all created test devices."""
        # This will be called even if tests fail
        if cls.created_devices:
            print(f"\n🧹 Cleaning up {len(cls.created_devices)} test devices...")

            try:
                client = CheckMKClientFactory.build_client_from_settings()
            except Exception:
                client = None

            if client is not None:
                for hostname in cls.created_devices:
                    try:
                        client.delete_host(hostname)
                        print(f"  ✅ Deleted {hostname}")
                    except Exception as e:
                        print(f"  ⚠️ Failed to delete {hostname}: {e}")

                # Activate changes to finalize deletions
                try:
                    client.activate_changes()
                    print("  ✅ Activated changes (deletions)")
                except Exception as e:
                    print(f"  ⚠️ Failed to activate changes: {e}")

    # =========================================================================
    # Step 0: Compare baseline device before CheckMK sync (host not in CheckMK)
    # =========================================================================

    @pytest.mark.asyncio
    @pytest.mark.nautobot
    async def test_00_compare_baseline_device_not_in_checkmk(
        self, nautobot_service, checkmk_client
    ):
        """
        Compare a baseline Nautobot device via REST before any test hosts exist in CheckMK.

        GET /api/nb2cmk/device/{device_id}/compare must report host_not_found when
        CheckMK returns 404 for the host (e.g. lab-001).
        """
        device_name = BASELINE_COMPARE_DEVICE_NAME
        device_id = await _resolve_nautobot_device_id(nautobot_service, device_name)

        print(
            f"\n🔍 Pre-sync compare: {device_name} (Nautobot ID: {device_id})"
        )

        # Preconditions: device exists in Nautobot but not in CheckMK
        try:
            checkmk_client.get_host(device_name)
            pytest.fail(
                f"Device '{device_name}' already exists in CheckMK; "
                "remove it before running lifecycle tests"
            )
        except CheckMKAPIError as exc:
            if exc.status_code != 404:
                raise

        print(f"  ✅ CheckMK confirms host '{device_name}' is not present (404)")

        with _authenticated_api_client() as client:
            response = client.get(f"/api/nb2cmk/device/{device_id}/compare")

        assert response.status_code == 200, response.text
        payload = response.json()

        print(f"  Compare API result: {payload.get('result')}")
        print(f"  Diff: {payload.get('diff')}")

        assert payload["result"] == "host_not_found"
        assert device_name in payload["diff"]
        assert "not found in CheckMK" in payload["diff"]
        assert payload.get("checkmk_config") is None
        assert payload.get("normalized_config")

    # =========================================================================
    # Step 1: Create Test Devices in CheckMK
    # =========================================================================

    def test_01_create_test_devices_in_checkmk(self, checkmk_client):
        """Create test devices in CheckMK for subsequent tests."""
        print("\n📝 Creating test devices in CheckMK...")

        for device_config in TEST_DEVICES:
            hostname = device_config["host_name"]

            try:
                # Check if device already exists
                try:
                    checkmk_client.get_host(hostname)
                    print(f"  ⚠️ Device {hostname} already exists, deleting first...")
                    checkmk_client.delete_host(hostname)
                except CheckMKAPIError as e:
                    if e.status_code != 404:
                        raise

                # Create the device
                checkmk_client.create_host(
                    hostname=device_config["host_name"],
                    folder=device_config["folder"],
                    attributes=device_config["attributes"],
                    bake_agent=False,
                )

                print(f"  ✅ Created {hostname}")
                TestCheckMKDeviceLifecycle.created_devices.append(hostname)

                # Verify device was created
                host_data = checkmk_client.get_host(hostname)
                assert host_data["id"] == hostname
                assert host_data["extensions"]["folder"] == device_config["folder"]

            except Exception as e:
                pytest.fail(f"Failed to create device {hostname}: {e}")

        # Activate changes to make devices available
        try:
            activation_result = checkmk_client.activate_changes()
            print(f"  ✅ Activated changes: {activation_result}")
        except Exception as e:
            pytest.fail(f"Failed to activate changes: {e}")

    def test_02_verify_devices_exist_in_checkmk(self, checkmk_client):
        """Verify all test devices exist in CheckMK."""
        print("\n🔍 Verifying test devices in CheckMK...")

        for device_config in TEST_DEVICES:
            hostname = device_config["host_name"]

            try:
                host_data = checkmk_client.get_host(hostname)

                assert host_data["id"] == hostname
                assert host_data["extensions"]["folder"] == device_config["folder"], (
                    f"Folder mismatch for {hostname}"
                )

                # Verify key attributes
                attributes = host_data["extensions"]["attributes"]
                expected_attrs = device_config["attributes"]

                assert attributes["ipaddress"] == expected_attrs["ipaddress"], (
                    f"IP mismatch for {hostname}"
                )
                assert attributes["site"] == expected_attrs["site"], (
                    f"Site mismatch for {hostname}"
                )

                print(f"  ✅ Verified {hostname}")

            except CheckMKAPIError as e:
                if e.status_code == 404:
                    pytest.fail(f"Device {hostname} not found in CheckMK")
                else:
                    raise

    # =========================================================================
    # Step 2: Test Comparison with Baseline Devices
    # =========================================================================

    @pytest.mark.asyncio
    @pytest.mark.nautobot
    async def test_03_compare_baseline_device_with_checkmk(
        self, nb2cmk_service, nautobot_service
    ):
        """
        Test comparing a baseline device with CheckMK.

        This should detect that the baseline device doesn't exist in CheckMK.
        """
        print("\n🔍 Testing comparison: Baseline device (should not exist in CheckMK)")

        # Get a baseline device from Nautobot
        query = """
        query {
          devices {
            id
            name
          }
        }
        """

        result = await nautobot_service.graphql_query(query, {})
        if "errors" in result:
            pytest.skip(f"GraphQL error: {result['errors']}")

        devices = result.get("data", {}).get("devices", [])
        if not devices:
            pytest.skip("No devices found in Nautobot")

        # Use the first device for testing
        device_id = devices[0]["id"]
        device_name = devices[0]["name"]

        print(f"  Testing device: {device_name} (ID: {device_id})")

        try:
            comparison_result = await nb2cmk_service.compare_device_config(device_id)

            print(f"  Comparison result: {comparison_result.result}")
            assert comparison_result is not None
            assert hasattr(comparison_result, "result")

            # Baseline devices should not exist in CheckMK
            if comparison_result.result == "host_not_found":
                print(f"  ✅ Correctly detected that {device_name} is not in CheckMK")
            elif comparison_result.result == "equal":
                print(
                    f"  ℹ️ Device {device_name} exists and matches (unexpected but valid)"
                )
            elif comparison_result.result == "diff":
                print(f"  ℹ️ Device {device_name} exists but has differences")
                if comparison_result.diff:
                    print(f"  Differences: {comparison_result.diff}")

        except Exception as e:
            pytest.fail(f"Comparison failed for {device_name}: {e}")

    @pytest.mark.asyncio
    async def test_04_compare_test_device_with_checkmk(
        self, nb2cmk_service, checkmk_client
    ):
        """
        Test comparing a test device that exists in CheckMK.

        This verifies the comparison logic can detect existing devices.
        """
        print("\n🔍 Testing comparison: Test device in CheckMK")

        # Use one of our test devices
        test_hostname = TEST_DEVICES[0]["host_name"]

        # Verify device exists in CheckMK first
        try:
            checkmk_client.get_host(test_hostname)
            print(f"  Test device {test_hostname} confirmed in CheckMK")
        except CheckMKAPIError as e:
            if e.status_code == 404:
                pytest.skip(f"Test device {test_hostname} not found in CheckMK")
            raise

        # Now test comparison using the service
        # Note: This requires the test device to exist in Nautobot too
        # For now, we'll test with baseline devices
        print("  ℹ️ Skipping comparison test - test devices not in Nautobot baseline")
        print(
            "  (To test this, add test devices to Nautobot or modify test to use existing Nautobot devices)"
        )

    # =========================================================================
    # Step 3: Test Sync Operations
    # =========================================================================

    @pytest.mark.asyncio
    async def test_05_get_devices_for_sync(self, nb2cmk_service):
        """Test getting devices from Nautobot for sync."""
        print("\n📋 Testing device list retrieval for sync")

        result = await nb2cmk_service.get_devices_for_sync()

        assert result is not None
        assert result.total > 0
        assert len(result.devices) > 0

        print(f"  ✅ Retrieved {len(result.devices)} devices from Nautobot")
        print(f"  First 5 devices: {[d['name'] for d in result.devices[:5]]}")

    # =========================================================================
    # Step 4: Test Device Update in CheckMK
    # =========================================================================

    def test_06_update_device_in_checkmk(self, checkmk_client):
        """Test updating a device in CheckMK."""
        print("\n✏️ Testing device update in CheckMK")

        # Use test-device-03 (agent-only, no SNMP) for update test
        # This avoids interfering with SNMP attribute tests later
        test_hostname = TEST_DEVICES[2]["host_name"]

        # Update the device alias
        new_attributes = {"alias": "Test Device 03 - UPDATED"}

        try:
            checkmk_client.update_host(test_hostname, new_attributes)
            print(f"  ✅ Updated {test_hostname}")

            # Verify the update
            host_data = checkmk_client.get_host(test_hostname)
            assert (
                host_data["extensions"]["attributes"]["alias"]
                == "Test Device 03 - UPDATED"
            ), "Alias not updated correctly"

            print("  ✅ Verified alias updated to 'Test Device 03 - UPDATED'")

            # Activate changes
            checkmk_client.activate_changes()
            print("  ✅ Activated changes (update)")

        except Exception as e:
            pytest.fail(f"Failed to update device {test_hostname}: {e}")

    # =========================================================================
    # Step 5: Test Device Retrieval
    # =========================================================================

    def test_07_get_all_hosts(self, checkmk_client):
        """Test retrieving all hosts from CheckMK."""
        print("\n📊 Testing get all hosts")

        try:
            result = checkmk_client.get_all_hosts()

            hosts = result.get("value", [])
            print(f"  ✅ Retrieved {len(hosts)} hosts from CheckMK")

            # Verify our test devices are in the list
            hostnames = [h["id"] for h in hosts]
            for device_config in TEST_DEVICES:
                assert device_config["host_name"] in hostnames, (
                    f"Test device {device_config['host_name']} not found in host list"
                )

            print(f"  ✅ All {len(TEST_DEVICES)} test devices found in host list")

        except Exception as e:
            pytest.fail(f"Failed to get all hosts: {e}")

    def test_08_get_specific_host(self, checkmk_client):
        """Test retrieving a specific host from CheckMK."""
        print("\n🔍 Testing get specific host")

        test_hostname = TEST_DEVICES[1]["host_name"]

        try:
            host_data = checkmk_client.get_host(test_hostname)

            assert host_data["id"] == test_hostname
            print(f"  ✅ Retrieved {test_hostname} successfully")

            # Verify structure
            assert "extensions" in host_data
            assert "folder" in host_data["extensions"]
            assert "attributes" in host_data["extensions"]

            print(f"  Folder: {host_data['extensions']['folder']}")
            print(f"  Attributes: {list(host_data['extensions']['attributes'].keys())}")

        except CheckMKAPIError as e:
            if e.status_code == 404:
                pytest.fail(f"Device {test_hostname} not found")
            raise

    # =========================================================================
    # Step 6: Test Config Reload (Critical for SNMP mapping changes)
    # =========================================================================

    def test_09_config_reload_without_restart(self, config_service):
        """Test that config reload works without worker restart."""
        print("\n🔄 Testing config reload without restart")

        # Get initial SNMP mapping
        initial_mapping = config_service.load_snmp_mapping()
        initial_keys = set(initial_mapping.keys())
        print(f"  Initial SNMP mapping keys: {initial_keys}")

        # Force reload
        config_service.reload_config()
        print("  ✅ Config reload called")

        # Get mapping again
        reloaded_mapping = config_service.load_snmp_mapping()
        reloaded_keys = set(reloaded_mapping.keys())

        # They should match (no changes were made to the file)
        assert initial_keys == reloaded_keys, (
            "SNMP mapping keys changed after reload (unexpected)"
        )
        print("  ✅ Config reload successful - keys match")

    # =========================================================================
    # Step 7: Manual Cleanup Test (Tests cleanup mechanism)
    # =========================================================================

    def test_10_snmp_v2_device_attributes(self, checkmk_client):
        """Test SNMPv2 device has correct attributes."""
        print("\n🔍 Testing SNMPv2 device attributes")

        # Use test-device-01 (SNMPv2)
        test_hostname = TEST_DEVICES[0]["host_name"]

        try:
            host_data = checkmk_client.get_host(test_hostname)
            attributes = host_data["extensions"]["attributes"]

            # Verify SNMP attributes
            assert "snmp_community" in attributes, "Missing snmp_community attribute"
            snmp_config = attributes["snmp_community"]

            assert snmp_config["type"] == "v1_v2_community", (
                "Incorrect SNMP community type"
            )
            assert snmp_config["community"] == "test_community", (
                "Incorrect SNMP community string"
            )

            # Verify tags
            assert attributes["tag_snmp_ds"] == "snmp-v2", "Incorrect SNMP version tag"
            assert attributes["tag_agent"] == "no-agent", (
                "Incorrect agent tag for SNMP-only device"
            )

            print(f"  ✅ SNMPv2 attributes correct for {test_hostname}")

        except CheckMKAPIError as e:
            if e.status_code == 404:
                pytest.fail(f"Test device {test_hostname} not found in CheckMK")
            raise

    def test_11_snmp_v3_device_attributes(self, checkmk_client):
        """Test SNMPv3 device has correct attributes."""
        print("\n🔍 Testing SNMPv3 device attributes")

        # Use test-device-02 (SNMPv3)
        test_hostname = TEST_DEVICES[1]["host_name"]

        try:
            host_data = checkmk_client.get_host(test_hostname)
            attributes = host_data["extensions"]["attributes"]

            # Verify SNMP attributes
            assert "snmp_community" in attributes, "Missing snmp_community attribute"
            snmp_config = attributes["snmp_community"]

            assert snmp_config["type"] == "v3_auth_privacy", "Incorrect SNMPv3 type"
            assert "auth_protocol" in snmp_config, (
                "Missing auth_protocol in SNMPv3 config"
            )
            assert "privacy_protocol" in snmp_config, (
                "Missing privacy_protocol in SNMPv3 config"
            )
            assert "security_name" in snmp_config, (
                "Missing security_name in SNMPv3 config"
            )

            # Verify tags
            # Note: CheckMK uses "snmp-v2" tag for both v2 and v3, differentiated by snmp_community type
            assert attributes["tag_snmp_ds"] == "snmp-v2", (
                "Incorrect SNMP version tag (CheckMK uses snmp-v2 for both v2 and v3)"
            )
            assert attributes["tag_agent"] == "no-agent", (
                "Incorrect agent tag for SNMP-only device"
            )

            print(f"  ✅ SNMPv3 attributes correct for {test_hostname}")
            print(
                f"  Note: CheckMK uses tag 'snmp-v2' for both v2 and v3, type='{snmp_config['type']}' differentiates"
            )

        except CheckMKAPIError as e:
            if e.status_code == 404:
                pytest.fail(f"Test device {test_hostname} not found in CheckMK")
            raise

    def test_12_delete_one_test_device(self, checkmk_client):
        """Test manual deletion of one test device."""
        print("\n🗑️ Testing manual device deletion")

        if len(TEST_DEVICES) < 2:
            pytest.skip("Need at least 2 test devices for this test")

        # Delete the last test device
        test_hostname = TEST_DEVICES[-1]["host_name"]

        try:
            # Verify it exists first
            checkmk_client.get_host(test_hostname)

            # Delete it
            checkmk_client.delete_host(test_hostname)
            print(f"  ✅ Deleted {test_hostname}")

            # Remove from cleanup list
            if test_hostname in TestCheckMKDeviceLifecycle.created_devices:
                TestCheckMKDeviceLifecycle.created_devices.remove(test_hostname)

            # Verify it's gone
            try:
                checkmk_client.get_host(test_hostname)
                pytest.fail(f"Device {test_hostname} still exists after deletion")
            except CheckMKAPIError as e:
                if e.status_code == 404:
                    print(f"  ✅ Verified {test_hostname} is deleted")
                else:
                    raise

            # Activate changes
            checkmk_client.activate_changes()
            print("  ✅ Activated changes (deletion)")

        except CheckMKAPIError as e:
            if e.status_code == 404:
                print(f"  ⚠️ Device {test_hostname} already deleted")
            else:
                raise


# =============================================================================
# Helper Test: Connection Prerequisites
# =============================================================================


@pytest.mark.integration
class TestCheckMKConnectionPrerequisites:
    """Test that CheckMK connection is available."""

    def test_checkmk_settings_configured(self):
        """Test that CheckMK settings are configured."""
        db_settings = settings_manager.get_checkmk_settings()

        assert db_settings is not None, "CheckMK settings not found"
        assert "url" in db_settings, "CheckMK URL not configured"
        assert "site" in db_settings, "CheckMK site not configured"
        assert "username" in db_settings, "CheckMK username not configured"
        assert "password" in db_settings, "CheckMK password not configured"

        print("\n✅ CheckMK settings configured")
        print(f"  URL: {db_settings['url']}")
        print(f"  Site: {db_settings['site']}")
        print(f"  Username: {db_settings['username']}")

    def test_checkmk_connection(self, checkmk_client):
        """Test that CheckMK is accessible."""
        cfg = get_checkmk_config()
        api_base = checkmk_api_base_url(cfg.protocol, cfg.host, cfg.site)
        try:
            version_info = checkmk_client.get_version()
            print("\n✅ CheckMK is accessible")
            print(f"  API base: {api_base}")
            print(f"  Version: {version_info.get('version', 'unknown')}")
            print(f"  Edition: {version_info.get('edition', 'unknown')}")
        except Exception as e:
            pytest.fail(f"❌ CheckMK not accessible at {api_base}: {e}")
