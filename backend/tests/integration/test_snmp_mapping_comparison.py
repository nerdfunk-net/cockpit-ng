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
import asyncio
from unittest.mock import AsyncMock, Mock, patch, MagicMock
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
    NORMALIZED_SNMP_V3_AUTH_PRIVACY,
    NORMALIZED_SNMP_V3_AUTH_NO_PRIVACY,
    NORMALIZED_SNMP_V2_COMMUNITY,
    NAUTOBOT_DEVICE_WITH_SNMP_V3,
    NAUTOBOT_DEVICE_WITH_SNMP_V2,
    NAUTOBOT_DEVICE_WITHOUT_SNMP,
    CHECKMK_HOST_WITH_SNMP_V3_RESPONSE,
    CHECKMK_HOST_WITH_SNMP_V2_RESPONSE,
    create_snmp_mapping_config,
    create_device_with_snmp,
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
    original_load = config_service.load_snmp_mapping

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

        # Should have tag_agent set but no snmp_community
        assert "snmp_community" not in extensions.attributes
        assert extensions.attributes["tag_agent"] == "no-agent"

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
    def setup(self, mock_config_service):
        """Set up test instance."""
        self.service = NautobotToCheckMKService()
        self.config_service = mock_config_service

    async def test_compare_device_with_matching_snmp_v3(
        self, mock_nautobot_service, mock_checkmk_client
    ):
        """Test comparison when Nautobot and CheckMK have matching SNMPv3 config."""
        device_id = "device-uuid-snmp-v3"

        # Mock Nautobot response
        nautobot_response = {
            "data": {"device": NAUTOBOT_DEVICE_WITH_SNMP_V3.copy()}
        }

        # Mock CheckMK response
        checkmk_response = CHECKMK_HOST_WITH_SNMP_V3_RESPONSE.copy()

        with patch("services.nautobot.nautobot_service", mock_nautobot_service), patch(
            "services.checkmk.config.config_service", self.config_service
        ), patch("routers.checkmk.main.get_host") as mock_get_host:

            mock_nautobot_service.graphql_query = AsyncMock(
                return_value=nautobot_response
            )
            mock_get_host.return_value = AsyncMock(data=checkmk_response)

            # Perform comparison
            result = await self.service.compare_device_config(device_id)

            # Verify result
            assert result.result == "equal"  # Configs should match
            assert result.diff == ""
            assert result.normalized_config is not None
            assert result.checkmk_config is not None

    async def test_compare_device_with_different_snmp_community(
        self, mock_nautobot_service
    ):
        """Test comparison when SNMP communities differ."""
        device_id = "device-uuid-snmp-v2"

        # Nautobot has snmpcommunity
        nautobot_device = NAUTOBOT_DEVICE_WITH_SNMP_V2.copy()

        # CheckMK has different community
        checkmk_host = CHECKMK_HOST_WITH_SNMP_V2_RESPONSE.copy()
        checkmk_host["extensions"]["attributes"]["snmp_community"][
            "community"
        ] = "different_community"

        # TODO: Complete test implementation
        # This requires full mock setup similar to above

    # TODO: Add more comparison tests


# ==============================================================================
# Test Class: Configuration Reload Without Worker Restart
# ==============================================================================


@pytest.mark.integration
@pytest.mark.celery
class TestConfigurationReload:
    """Test that config changes are detected without Celery worker restart."""

    def test_config_reload_in_celery_task(self, mock_config_service):
        """Test that Celery tasks reload configuration before execution."""
        # Initial config with SNMPv2
        initial_config = create_snmp_mapping_config("test-snmp", 2, "community1")
        mock_config_service._snmp_mapping = initial_config

        # Simulate task execution with initial config
        config1 = mock_config_service.load_snmp_mapping()
        assert config1["test-snmp"]["version"] == 2
        assert config1["test-snmp"]["community"] == "community1"

        # Modify config (simulating file change)
        new_config = create_snmp_mapping_config("test-snmp", 3, username="newuser")
        mock_config_service._snmp_mapping = new_config

        # Call reload (this is what Celery tasks now do)
        mock_config_service.reload_config()

        # Load again - should get new config
        config2 = mock_config_service.load_snmp_mapping(force_reload=True)
        assert config2["test-snmp"]["version"] == 3
        assert config2["test-snmp"]["username"] == "newuser"


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


@pytest.mark.skip(
    reason="Waiting for actual CheckMK response data from debug logs"
)
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
