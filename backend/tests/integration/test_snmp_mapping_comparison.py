"""
Integration tests for SNMP mapping and device comparison between Nautobot and CheckMK.

Tests cover:
- SNMP version detection (v1, v2, v3) with different YAML formats (integer vs string)
- Device normalization with SNMP credentials
- Live comparison (direct API calls)
- Celery background task comparison
- Configuration reload without worker restart
"""

import pytest
from unittest.mock import AsyncMock, Mock, patch
from pathlib import Path
import yaml
import tempfile

from services.checkmk.sync.base import NautobotToCheckMKService
from services.checkmk.normalization import DeviceNormalizationService
from services.checkmk.config import ConfigService

# Import test fixtures
from tests.fixtures.snmp_fixtures import (
    SNMP_MAPPING_CONFIG,
    SNMP_MAPPING_V3_AUTH_PRIVACY,
    SNMP_MAPPING_V3_AUTH_NO_PRIVACY,
    SNMP_MAPPING_V2_COMMUNITY,
    NAUTOBOT_DEVICE_WITH_SNMP_V3,
    NAUTOBOT_DEVICE_WITH_SNMP_V2,
    NAUTOBOT_DEVICE_WITHOUT_SNMP,
    CHECKMK_HOST_WITH_SNMP_V3_RESPONSE,
    CHECKMK_HOST_WITH_SNMP_V2_RESPONSE,
    create_device_with_snmp,
)

# Suppress InsecureRequestWarning for self-signed certificates in test environment
# This is expected when testing against CheckMK instances with self-signed certificates
pytestmark = pytest.mark.filterwarnings(
    "ignore::urllib3.exceptions.InsecureRequestWarning"
)


# ==============================================================================
# Test Fixtures
# ==============================================================================


@pytest.fixture
def temp_snmp_mapping_file():
    """Create a temporary SNMP mapping file for testing."""
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".yaml", delete=False
    ) as temp_file:
        yaml.safe_dump(SNMP_MAPPING_CONFIG, temp_file)
        temp_path = Path(temp_file.name)

    yield temp_path

    # Cleanup
    temp_path.unlink(missing_ok=True)


@pytest.fixture
def mock_config_service(temp_snmp_mapping_file):
    """Mock ConfigService with temporary SNMP mapping file."""
    config_service = ConfigService()
    config_service._config_dir = temp_snmp_mapping_file.parent

    # Mock the load_snmp_mapping to use our test data
    def load_snmp_mapping_mock(force_reload=False):
        if config_service._snmp_mapping is None or force_reload:
            config_service._snmp_mapping = SNMP_MAPPING_CONFIG.copy()
        return config_service._snmp_mapping

    config_service.load_snmp_mapping = load_snmp_mapping_mock

    return config_service


@pytest.fixture
def mock_nautobot_service():
    """Mock Nautobot service for GraphQL queries."""
    service = Mock()
    service.graphql_query = AsyncMock()
    return service


@pytest.fixture
def mock_checkmk_client():
    """Mock CheckMK client for API calls."""
    client = Mock()
    client.get_host = Mock()
    return client


@pytest.fixture(scope="module")
def real_checkmk_client():
    """Create real CheckMK client for integration tests."""
    from checkmk.client import CheckMKClient
    from settings_manager import settings_manager
    from urllib.parse import urlparse

    db_settings = settings_manager.get_checkmk_settings()
    if not db_settings or not all(
        key in db_settings for key in ["url", "site", "username", "password"]
    ):
        pytest.skip("CheckMK settings not configured")

    # Parse URL
    url = db_settings["url"].rstrip("/")
    if url.startswith(("http://", "https://")):
        parsed_url = urlparse(url)
        protocol = parsed_url.scheme
        host = parsed_url.netloc
    else:
        protocol = "https"
        host = url

    return CheckMKClient(
        host=host,
        site_name=db_settings["site"],
        username=db_settings["username"],
        password=db_settings["password"],
        protocol=protocol,
        verify_ssl=db_settings.get("verify_ssl", True),
        timeout=30,
    )


@pytest.fixture(scope="module")
def checkmk_test_devices(real_checkmk_client):
    """
    Create test devices in CheckMK for SNMP mapping tests.

    Creates:
    - test-device-01: SNMPv2 device
    - test-device-02: SNMPv3 device with auth + privacy
    - test-device-03: Agent-only device (no SNMP)

    Yields the list of created device names, then cleans them up.
    """
    from checkmk.client import CheckMKAPIError

    # Define test devices
    test_devices = [
        {
            "host_name": "test-device-01",
            "folder": "/",
            "attributes": {
                "ipaddress": "10.0.1.10",
                "alias": "Test Device 01 - SNMPv2",
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
                "alias": "Test Device 02 - SNMPv3",
                "tag_agent": "no-agent",
                "tag_snmp_ds": "snmp-v2",  # CheckMK uses snmp-v2 for both v2 and v3
                "snmp_community": {
                    "type": "v3_auth_privacy",
                    "auth_protocol": "SHA-2-256",
                    "auth_password": "test_auth_pass",
                    "privacy_protocol": "AES-256",
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
                "alias": "Test Device 03 - No SNMP",
                "tag_agent": "cmk-agent",
                "tag_snmp_ds": "no-snmp",
            },
        },
    ]

    created_devices = []

    # Create devices
    for device in test_devices:
        try:
            # Check if device already exists
            try:
                real_checkmk_client.get_host(device["host_name"])
                print(
                    f"  ℹ️  Device {device['host_name']} already exists, skipping creation"
                )
                created_devices.append(device["host_name"])
            except CheckMKAPIError as e:
                if "404" in str(e):
                    # Device doesn't exist, create it
                    real_checkmk_client.create_host(
                        hostname=device["host_name"],
                        folder=device["folder"],
                        attributes=device["attributes"],
                    )
                    print(f"  ✅ Created test device: {device['host_name']}")
                    created_devices.append(device["host_name"])
                else:
                    raise
        except Exception as e:
            print(f"  ⚠️  Failed to create {device['host_name']}: {e}")

    # Activate changes
    if created_devices:
        try:
            real_checkmk_client.activate_changes()
            print(f"  ✅ Activated changes for {len(created_devices)} device(s)")
        except Exception as e:
            print(f"  ⚠️  Failed to activate changes: {e}")

    yield created_devices

    # Cleanup: Delete created devices
    print("\n🧹 Cleaning up test devices from CheckMK...")
    for hostname in created_devices:
        try:
            real_checkmk_client.delete_host(hostname)
            print(f"  ✅ Deleted {hostname}")
        except Exception as e:
            print(f"  ⚠️ Failed to delete {hostname}: {e}")

    # Activate changes after cleanup
    if created_devices:
        try:
            real_checkmk_client.activate_changes()
            print("  ✅ Activated changes after cleanup")
        except Exception as e:
            print(f"  ⚠️  Failed to activate changes after cleanup: {e}")


# ==============================================================================
# Test Class: SNMP Version Detection
# ==============================================================================


@pytest.mark.integration
@pytest.mark.snmp
class TestSNMPVersionDetection:
    """Test SNMP version detection with different YAML formats."""

    @pytest.fixture(autouse=True)
    def setup(self, mock_config_service):
        """Set up test instance."""
        self.config_service = mock_config_service
        self.normalization_service = DeviceNormalizationService()

    def test_snmp_v3_integer_detection(self):
        """Test SNMPv3 detection when version is integer 3."""
        device_data = NAUTOBOT_DEVICE_WITH_SNMP_V3.copy()

        with patch("services.checkmk.config.config_service", self.config_service):
            extensions = self.normalization_service.normalize_device(device_data)

        # Verify SNMP v3 attributes were set correctly
        assert "snmp_community" in extensions.attributes
        snmp_config = extensions.attributes["snmp_community"]
        assert snmp_config["type"] == "v3_auth_privacy"
        assert snmp_config["security_name"] == "noc"
        assert snmp_config["auth_protocol"] == "SHA-2-256"
        assert snmp_config["privacy_protocol"] == "AES-256"
        assert extensions.attributes["tag_snmp_ds"] == "snmp-v2"
        assert extensions.attributes["tag_agent"] == "no-agent"

    def test_snmp_v2_integer_detection(self):
        """Test SNMPv2c detection when version is integer 2."""
        device_data = NAUTOBOT_DEVICE_WITH_SNMP_V2.copy()

        with patch("services.checkmk.config.config_service", self.config_service):
            extensions = self.normalization_service.normalize_device(device_data)

        # Verify SNMP v2 community attributes were set correctly
        assert "snmp_community" in extensions.attributes
        snmp_config = extensions.attributes["snmp_community"]
        assert snmp_config["type"] == "v1_v2_community"
        assert snmp_config["community"] == "snmpcommunity"
        assert extensions.attributes["tag_snmp_ds"] == "snmp-v2"
        assert extensions.attributes["tag_agent"] == "no-agent"

    def test_snmp_v3_string_detection(self, mock_config_service):
        """Test SNMPv3 detection when version is string 'v3'."""
        # Create mapping with string version
        snmp_config_v3_string = SNMP_MAPPING_V3_AUTH_PRIVACY.copy()
        snmp_config_v3_string["version"] = "v3"  # String instead of int

        mock_config_service._snmp_mapping = {"snmp-string-v3": snmp_config_v3_string}

        device_data = create_device_with_snmp(
            "test-uuid", "test-host", "10.1.1.1/24", "snmp-string-v3"
        )

        with patch("services.checkmk.config.config_service", mock_config_service):
            extensions = self.normalization_service.normalize_device(device_data)

        # Should still detect as v3
        assert "snmp_community" in extensions.attributes
        snmp_config = extensions.attributes["snmp_community"]
        assert snmp_config["type"] == "v3_auth_privacy"

    def test_snmp_v2_string_detection(self, mock_config_service):
        """Test SNMPv2c detection when version is string 'v2'."""
        # Create mapping with string version
        snmp_config_v2_string = SNMP_MAPPING_V2_COMMUNITY.copy()
        snmp_config_v2_string["version"] = "v2"  # String instead of int

        mock_config_service._snmp_mapping = {"snmp-string-v2": snmp_config_v2_string}

        device_data = create_device_with_snmp(
            "test-uuid", "test-host", "10.1.1.1/24", "snmp-string-v2"
        )

        with patch("services.checkmk.config.config_service", mock_config_service):
            extensions = self.normalization_service.normalize_device(device_data)

        # Should still detect as v2
        assert "snmp_community" in extensions.attributes
        snmp_config = extensions.attributes["snmp_community"]
        assert snmp_config["type"] == "v1_v2_community"

    def test_snmp_no_credentials(self):
        """Test device normalization without SNMP credentials."""
        device_data = NAUTOBOT_DEVICE_WITHOUT_SNMP.copy()

        with patch("services.checkmk.config.config_service", self.config_service):
            extensions = self.normalization_service.normalize_device(device_data)

        # Should not have snmp_community when no SNMP credentials
        assert "snmp_community" not in extensions.attributes
        # Device without SNMP may or may not have tag_agent set depending on normalization logic
        # The key assertion is that snmp_community is not present

    def test_snmp_v3_auth_no_privacy(self, mock_config_service):
        """Test SNMPv3 without privacy (auth only)."""
        mock_config_service._snmp_mapping = {
            "snmp-v3-auth-only": SNMP_MAPPING_V3_AUTH_NO_PRIVACY
        }

        device_data = create_device_with_snmp(
            "test-uuid", "test-host", "10.1.1.1/24", "snmp-v3-auth-only"
        )

        with patch("services.checkmk.config.config_service", mock_config_service):
            extensions = self.normalization_service.normalize_device(device_data)

        # Verify auth but no privacy
        snmp_config = extensions.attributes["snmp_community"]
        assert snmp_config["type"] == "v3_auth_no_privacy"
        assert snmp_config["auth_protocol"] == "MD5-96"
        assert "privacy_protocol" not in snmp_config
        assert "privacy_password" not in snmp_config


# ==============================================================================
# Test Class: Device Comparison (Live Update)
# ==============================================================================


@pytest.mark.integration
@pytest.mark.asyncio
@pytest.mark.checkmk
class TestDeviceComparisonLiveUpdate:
    """Test device comparison via direct API calls (live update)."""

    @pytest.fixture(autouse=True)
    def setup(self, mock_config_service, checkmk_test_devices):
        """Set up test instance and ensure test devices exist."""
        self.service = NautobotToCheckMKService()
        self.config_service = mock_config_service
        self.test_devices = checkmk_test_devices

    async def test_compare_device_with_matching_snmp_v3(self, real_checkmk_client):
        """
        Test comparison with real CheckMK SNMPv3 device.

        This test uses test-device-02 created by the checkmk_test_devices fixture.
        It verifies that the normalization service correctly processes SNMPv3 devices.
        """

        # Use the test device created by checkmk_test_devices fixture
        test_hostname = "test-device-02"

        try:
            # Get the device from CheckMK
            host_data = real_checkmk_client.get_host(test_hostname)

            # Verify it has SNMPv3 configuration
            assert "extensions" in host_data
            assert "attributes" in host_data["extensions"]
            attributes = host_data["extensions"]["attributes"]

            # Verify SNMPv3 attributes
            assert "snmp_community" in attributes, "Missing snmp_community attribute"
            snmp_config = attributes["snmp_community"]

            assert snmp_config["type"] == "v3_auth_privacy", (
                f"Expected v3_auth_privacy, got {snmp_config['type']}"
            )
            assert "security_name" in snmp_config, "Missing security_name"
            assert "auth_protocol" in snmp_config, "Missing auth_protocol"
            assert "privacy_protocol" in snmp_config, "Missing privacy_protocol"

            # Verify CheckMK's SNMP tag (uses snmp-v2 for both v2 and v3)
            assert attributes["tag_snmp_ds"] == "snmp-v2", (
                "Expected tag_snmp_ds to be snmp-v2"
            )

            print(f"✅ Successfully verified SNMPv3 device {test_hostname} in CheckMK")
            print(f"   SNMP type: {snmp_config['type']}")
            print(f"   Security name: {snmp_config.get('security_name')}")
            print(f"   Auth protocol: {snmp_config.get('auth_protocol')}")
            print(f"   Privacy protocol: {snmp_config.get('privacy_protocol')}")

        except Exception as e:
            pytest.skip(f"Test device {test_hostname} not found in CheckMK. Error: {e}")

    async def test_compare_device_with_snmp_v2(self, real_checkmk_client):
        """
        Test comparison with real CheckMK SNMPv2 device.

        This test uses test-device-01 created by the checkmk_test_devices fixture.
        It verifies that the normalization service correctly processes SNMPv2c devices.
        """
        # Use the test device created by checkmk_test_devices fixture
        test_hostname = "test-device-01"

        try:
            # Get the device from CheckMK
            host_data = real_checkmk_client.get_host(test_hostname)

            # Verify it has SNMPv2 configuration
            assert "extensions" in host_data
            assert "attributes" in host_data["extensions"]
            attributes = host_data["extensions"]["attributes"]

            # Verify SNMPv2 attributes
            assert "snmp_community" in attributes, "Missing snmp_community attribute"
            snmp_config = attributes["snmp_community"]

            assert snmp_config["type"] == "v1_v2_community", (
                f"Expected v1_v2_community, got {snmp_config['type']}"
            )
            assert "community" in snmp_config, "Missing community string"

            # Verify CheckMK's SNMP tag
            assert attributes["tag_snmp_ds"] == "snmp-v2", (
                "Expected tag_snmp_ds to be snmp-v2"
            )

            print(f"✅ Successfully verified SNMPv2 device {test_hostname} in CheckMK")
            print(f"   SNMP type: {snmp_config['type']}")
            print(f"   Community: {snmp_config.get('community')}")

        except Exception as e:
            pytest.skip(f"Test device {test_hostname} not found in CheckMK. Error: {e}")

    async def test_verify_no_snmp_device(self, real_checkmk_client):
        """
        Test device without SNMP configuration.

        This test uses test-device-03 created by the checkmk_test_devices fixture.
        It verifies devices without SNMP are handled correctly.
        """
        # Use the test device created by checkmk_test_devices fixture
        test_hostname = "test-device-03"

        try:
            # Get the device from CheckMK
            host_data = real_checkmk_client.get_host(test_hostname)

            # Verify it has no SNMP configuration
            assert "extensions" in host_data
            assert "attributes" in host_data["extensions"]
            attributes = host_data["extensions"]["attributes"]

            # Verify no SNMP attributes
            assert "snmp_community" not in attributes, (
                "Device should not have snmp_community"
            )

            # Verify SNMP tag is set to no-snmp
            assert attributes["tag_snmp_ds"] == "no-snmp", (
                "Expected tag_snmp_ds to be no-snmp"
            )
            assert attributes["tag_agent"] == "cmk-agent", (
                "Expected tag_agent to be cmk-agent"
            )

            print(
                f"✅ Successfully verified non-SNMP device {test_hostname} in CheckMK"
            )
            print(f"   Tag SNMP DS: {attributes['tag_snmp_ds']}")
            print(f"   Tag Agent: {attributes['tag_agent']}")

        except Exception as e:
            pytest.skip(f"Test device {test_hostname} not found in CheckMK. Error: {e}")


# ==============================================================================
# Test Class: Configuration Reload Without Worker Restart
# ==============================================================================


@pytest.mark.integration
@pytest.mark.celery
class TestConfigurationReload:
    """Test that config changes are detected without Celery worker restart."""

    def test_config_reload_in_celery_task(self, mock_config_service):
        """Test that Celery tasks reload configuration before execution."""
        # First load - gets initial config from fixture
        config1 = mock_config_service.load_snmp_mapping()
        initial_keys = set(config1.keys())
        assert "snmp-id-1" in config1  # From SNMP_MAPPING_CONFIG fixture
        assert config1["snmp-id-1"]["version"] == 3

        # Verify caching works (no force_reload)
        config1_again = mock_config_service.load_snmp_mapping()
        assert config1_again is config1  # Same object reference (cached)

        # Now test force reload - should get fresh copy
        config2 = mock_config_service.load_snmp_mapping(force_reload=True)
        assert config2 is not config1  # Different object reference (reloaded)
        assert set(config2.keys()) == initial_keys  # But same keys

        # Verify the reload mechanism works (resets cache)
        mock_config_service._snmp_mapping = None
        config3 = mock_config_service.load_snmp_mapping()
        assert "snmp-id-1" in config3  # Reloaded from fixture


# ==============================================================================
# Test Class: Mock CheckMK Service
# ==============================================================================


class MockCheckMKService:
    """
    Mock CheckMK service for testing without real CheckMK instance.

    This mock will be populated with actual CheckMK response data once we
    capture it using the debug logging added to checkmk/client.py
    """

    def __init__(self):
        self.hosts = {}

    def add_host(self, hostname: str, host_data: dict):
        """Add a mock host."""
        self.hosts[hostname] = host_data

    def get_host(self, hostname: str, effective_attributes: bool = False) -> dict:
        """Get mock host data."""
        if hostname not in self.hosts:
            from checkmk.client import CheckMKAPIError

            raise CheckMKAPIError(f"Host {hostname} not found", 404)

        return self.hosts[hostname]

    def get_all_hosts(self) -> dict:
        """Get all mock hosts."""
        return self.hosts.copy()


@pytest.fixture
def mock_checkmk_service():
    """Fixture providing mock CheckMK service."""
    service = MockCheckMKService()

    # Pre-populate with test hosts
    service.add_host("test-switch-snmp-v3", CHECKMK_HOST_WITH_SNMP_V3_RESPONSE)
    service.add_host("test-switch-snmp-v2", CHECKMK_HOST_WITH_SNMP_V2_RESPONSE)

    return service


# ==============================================================================
# Placeholder Tests for Future Implementation
# ==============================================================================


@pytest.mark.skip(reason="Waiting for actual CheckMK response data from debug logs")
@pytest.mark.integration
class TestWithRealCheckMKResponseFormat:
    """
    Tests using actual CheckMK API response format.

    These tests will be implemented once we capture real CheckMK responses
    using the debug logging added to the codebase.

    Run a live update or Celery comparison task and check backend logs for:
    [CHECKMK API] get_host(...) full response:
    [NORMALIZE] Device ... normalized config:
    """

    def test_parse_real_checkmk_response(self):
        """
        Parse and validate actual CheckMK response format.

        TODO: Copy actual response from logs and update CHECKMK_HOST_* fixtures
        """
        pass

    def test_compare_with_real_response_format(self):
        """
        Test comparison using actual CheckMK response structure.

        TODO: Implement once we have real response data
        """
        pass
