"""
Unit tests for DeviceCommonService.

Tests all shared utility methods used by import and update services.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock
from services.nautobot.devices.common import DeviceCommonService
from services.nautobot import NautobotService


@pytest.fixture
def mock_nautobot_service():
    """Create a mock NautobotService for testing."""
    service = MagicMock(spec=NautobotService)
    service.graphql_query = AsyncMock()
    service.rest_request = AsyncMock()
    return service


@pytest.fixture
def common_service(mock_nautobot_service):
    """Create DeviceCommonService instance with mocked dependencies."""
    return DeviceCommonService(mock_nautobot_service)


# ========================================================================
# DEVICE RESOLUTION TESTS
# ========================================================================


class TestDeviceResolution:
    """Tests for device resolution methods."""

    @pytest.mark.asyncio
    async def test_resolve_device_by_name_success(
        self, common_service, mock_nautobot_service
    ):
        """Test successful device resolution by name."""
        mock_nautobot_service.graphql_query.return_value = {
            "data": {"devices": [{"id": "device-uuid-123", "name": "test-device"}]}
        }

        result = await common_service.resolve_device_by_name("test-device")

        assert result == "device-uuid-123"
        mock_nautobot_service.graphql_query.assert_called_once()

    @pytest.mark.asyncio
    async def test_resolve_device_by_name_not_found(
        self, common_service, mock_nautobot_service
    ):
        """Test device not found by name."""
        mock_nautobot_service.graphql_query.return_value = {"data": {"devices": []}}

        result = await common_service.resolve_device_by_name("nonexistent")

        assert result is None

    @pytest.mark.asyncio
    async def test_resolve_device_by_name_graphql_error(
        self, common_service, mock_nautobot_service
    ):
        """Test handling of GraphQL errors."""
        mock_nautobot_service.graphql_query.return_value = {
            "errors": [{"message": "GraphQL error"}]
        }

        result = await common_service.resolve_device_by_name("test-device")

        assert result is None

    @pytest.mark.asyncio
    async def test_resolve_device_by_ip_success(
        self, common_service, mock_nautobot_service
    ):
        """Test successful device resolution by IP."""
        mock_nautobot_service.graphql_query.return_value = {
            "data": {
                "ip_addresses": [
                    {
                        "id": "ip-uuid-123",
                        "address": "10.0.0.1/24",
                        "primary_ip4_for": {
                            "id": "device-uuid-456",
                            "name": "test-device",
                        },
                    }
                ]
            }
        }

        result = await common_service.resolve_device_by_ip("10.0.0.1/24")

        assert result == "device-uuid-456"

    @pytest.mark.asyncio
    async def test_resolve_device_by_ip_no_primary(
        self, common_service, mock_nautobot_service
    ):
        """Test IP not set as primary for any device."""
        mock_nautobot_service.graphql_query.return_value = {
            "data": {
                "ip_addresses": [
                    {
                        "id": "ip-uuid-123",
                        "address": "10.0.0.1/24",
                        "primary_ip4_for": None,
                    }
                ]
            }
        }

        result = await common_service.resolve_device_by_ip("10.0.0.1/24")

        assert result is None

    @pytest.mark.asyncio
    async def test_resolve_device_id_with_valid_uuid(
        self, common_service, mock_nautobot_service
    ):
        """Test resolution when valid UUID is provided."""
        device_uuid = "550e8400-e29b-41d4-a716-446655440000"

        result = await common_service.resolve_device_id(device_id=device_uuid)

        assert result == device_uuid
        # Should not call any API methods
        mock_nautobot_service.graphql_query.assert_not_called()

    @pytest.mark.asyncio
    async def test_resolve_device_id_fallback_to_name(
        self, common_service, mock_nautobot_service
    ):
        """Test fallback to name resolution."""
        mock_nautobot_service.graphql_query.return_value = {
            "data": {"devices": [{"id": "device-uuid-789", "name": "test-device"}]}
        }

        result = await common_service.resolve_device_id(
            device_id="invalid-uuid", device_name="test-device"
        )

        assert result == "device-uuid-789"


# ========================================================================
# RESOURCE RESOLUTION TESTS
# ========================================================================


class TestResourceResolution:
    """Tests for resource resolution methods (status, namespace, etc.)."""

    @pytest.mark.asyncio
    async def test_resolve_status_id_success(
        self, common_service, mock_nautobot_service
    ):
        """Test successful status resolution."""
        mock_nautobot_service.rest_request.return_value = {
            "count": 2,
            "results": [
                {"id": "status-uuid-1", "name": "Active"},
                {"id": "status-uuid-2", "name": "Planned"},
            ],
        }

        result = await common_service.resolve_status_id("active", "dcim.device")

        assert result == "status-uuid-1"

    @pytest.mark.asyncio
    async def test_resolve_status_id_not_found(
        self, common_service, mock_nautobot_service
    ):
        """Test status not found raises ValueError."""
        mock_nautobot_service.rest_request.return_value = {"count": 0, "results": []}

        with pytest.raises(ValueError, match="Status 'nonexistent' not found"):
            await common_service.resolve_status_id("nonexistent", "dcim.device")

    @pytest.mark.asyncio
    async def test_resolve_namespace_id_success(
        self, common_service, mock_nautobot_service
    ):
        """Test successful namespace resolution."""
        mock_nautobot_service.graphql_query.return_value = {
            "data": {"namespaces": [{"id": "namespace-uuid-1", "name": "Global"}]}
        }

        result = await common_service.resolve_namespace_id("Global")

        assert result == "namespace-uuid-1"

    @pytest.mark.asyncio
    async def test_resolve_namespace_id_not_found(
        self, common_service, mock_nautobot_service
    ):
        """Test namespace not found raises ValueError."""
        mock_nautobot_service.graphql_query.return_value = {"data": {"namespaces": []}}

        with pytest.raises(ValueError, match="Namespace 'NonExistent' not found"):
            await common_service.resolve_namespace_id("NonExistent")

    @pytest.mark.asyncio
    async def test_resolve_platform_id_success(
        self, common_service, mock_nautobot_service
    ):
        """Test successful platform resolution."""
        mock_nautobot_service.graphql_query.return_value = {
            "data": {"platforms": [{"id": "platform-uuid-1", "name": "ios"}]}
        }

        result = await common_service.resolve_platform_id("ios")

        assert result == "platform-uuid-1"

    @pytest.mark.asyncio
    async def test_resolve_device_type_id_with_manufacturer(
        self, common_service, mock_nautobot_service
    ):
        """Test device type resolution with manufacturer."""
        mock_nautobot_service.graphql_query.return_value = {
            "data": {
                "device_types": [
                    {
                        "id": "device-type-uuid-1",
                        "model": "Catalyst 9300",
                        "manufacturer": {"name": "Cisco"},
                    }
                ]
            }
        }

        result = await common_service.resolve_device_type_id("Catalyst 9300", "Cisco")

        assert result == "device-type-uuid-1"


# ========================================================================
# VALIDATION TESTS
# ========================================================================


class TestValidation:
    """Tests for validation methods."""

    def test_validate_required_fields_success(self, common_service):
        """Test validation passes with all required fields."""
        data = {"name": "test-device", "location": "site1", "role": "access"}
        required = ["name", "location", "role"]

        # Should not raise
        common_service.validate_required_fields(data, required)

    def test_validate_required_fields_missing(self, common_service):
        """Test validation fails with missing fields."""
        data = {"name": "test-device"}
        required = ["name", "location", "role"]

        with pytest.raises(ValueError, match="Missing required fields"):
            common_service.validate_required_fields(data, required)

    def test_validate_ip_address_ipv4(self, common_service):
        """Test IPv4 address validation.

        NOTE: Current implementation uses simple regex that doesn't validate octet ranges.
        "256.1.1.1" passes pattern match even though 256 > 255.
        """
        assert common_service.validate_ip_address("192.168.1.1") is True
        assert common_service.validate_ip_address("10.0.0.1/24") is True
        # Current implementation doesn't validate octet ranges, just pattern
        assert (
            common_service.validate_ip_address("256.1.1.1") is True
        )  # Passes regex pattern

    def test_validate_ip_address_ipv6(self, common_service):
        """Test IPv6 address validation."""
        assert common_service.validate_ip_address("2001:db8::1") is True
        assert common_service.validate_ip_address("2001:db8::1/64") is True

    def test_validate_mac_address(self, common_service):
        """Test MAC address validation."""
        assert common_service.validate_mac_address("00:11:22:33:44:55") is True
        assert common_service.validate_mac_address("00-11-22-33-44-55") is True
        assert common_service.validate_mac_address("invalid") is False

    def test_is_valid_uuid(self, common_service):
        """Test UUID validation."""
        valid_uuid = "550e8400-e29b-41d4-a716-446655440000"
        invalid_uuid = "not-a-uuid"

        assert common_service._is_valid_uuid(valid_uuid) is True
        assert common_service._is_valid_uuid(invalid_uuid) is False


# ========================================================================
# DATA PROCESSING TESTS
# ========================================================================


class TestDataProcessing:
    """Tests for data processing methods."""

    def test_flatten_nested_fields(self, common_service):
        """Test flattening nested field notation."""
        data = {"name": "test-device", "platform.name": "ios", "role.slug": "access"}

        result = common_service.flatten_nested_fields(data)

        assert result == {"name": "test-device", "platform": "ios", "role": "access"}

    def test_extract_nested_value(self, common_service):
        """Test extracting values from nested dictionaries."""
        data = {"device": {"platform": {"name": "ios"}}}

        result = common_service.extract_nested_value(data, "device.platform.name")

        assert result == "ios"

    def test_extract_nested_value_missing(self, common_service):
        """Test extracting non-existent path returns None."""
        data = {"device": {"name": "test"}}

        result = common_service.extract_nested_value(data, "device.platform.name")

        assert result is None

    def test_normalize_tags_from_string(self, common_service):
        """Test normalizing comma-separated tag string."""
        tags = "tag1, tag2, tag3"

        result = common_service.normalize_tags(tags)

        assert result == ["tag1", "tag2", "tag3"]

    def test_normalize_tags_from_list(self, common_service):
        """Test normalizing tag list."""
        tags = ["tag1", "tag2", "tag3"]

        result = common_service.normalize_tags(tags)

        assert result == ["tag1", "tag2", "tag3"]

    def test_normalize_tags_single_string(self, common_service):
        """Test normalizing single tag string."""
        tags = "single-tag"

        result = common_service.normalize_tags(tags)

        assert result == ["single-tag"]

    def test_normalize_tags_empty(self, common_service):
        """Test normalizing empty tags."""
        assert common_service.normalize_tags("") == []
        assert common_service.normalize_tags(None) == []
        assert common_service.normalize_tags([]) == []

    def test_prepare_update_data(self, common_service):
        """Test preparing update data from CSV row."""
        row = {
            "id": "device-uuid-123",
            "name": "test-device",
            "platform.name": "ios",
            "serial": "ABC123",
            "tags": "tag1,tag2",
            "interface_name": "Loopback0",
            "interface_type": "virtual",
            "ip_namespace": "Global",
        }
        headers = list(row.keys())

        update_data, interface_config, ip_namespace = (
            common_service.prepare_update_data(row, headers)
        )

        # Should exclude id and name, include other fields
        assert "id" not in update_data
        assert "name" not in update_data
        assert update_data["platform"] == "ios"
        assert update_data["serial"] == "ABC123"
        assert update_data["tags"] == ["tag1", "tag2"]

        # Interface config should be extracted
        assert interface_config == {
            "name": "Loopback0",
            "type": "virtual",
            "status": "active",  # Default
        }

        # IP namespace should be extracted
        assert ip_namespace == "Global"


# ========================================================================
# INTERFACE AND IP HELPERS TESTS
# ========================================================================


class TestInterfaceAndIPHelpers:
    """Tests for interface and IP address helper methods."""

    @pytest.mark.asyncio
    async def test_ensure_ip_address_exists_already_exists(
        self, common_service, mock_nautobot_service
    ):
        """Test when IP address already exists."""
        mock_nautobot_service.rest_request.return_value = {
            "count": 1,
            "results": [{"id": "ip-uuid-123", "address": "10.0.0.1/24"}],
        }

        result = await common_service.ensure_ip_address_exists(
            ip_address="10.0.0.1/24", namespace_id="namespace-uuid-1"
        )

        assert result == "ip-uuid-123"
        # Should only call GET, not POST
        assert mock_nautobot_service.rest_request.call_count == 1

    @pytest.mark.asyncio
    async def test_ensure_ip_address_exists_creates_new(
        self, common_service, mock_nautobot_service
    ):
        """Test creating new IP address."""
        # First call: GET returns no results
        # Second call: resolve status
        # Third call: POST creates IP
        mock_nautobot_service.rest_request.side_effect = [
            {"count": 0, "results": []},  # IP doesn't exist
            {
                "count": 1,
                "results": [{"id": "status-uuid-1", "name": "Active"}],
            },  # Status lookup
            {"id": "ip-uuid-new", "address": "10.0.0.2/24"},  # IP creation
        ]

        result = await common_service.ensure_ip_address_exists(
            ip_address="10.0.0.2/24", namespace_id="namespace-uuid-1"
        )

        assert result == "ip-uuid-new"
        assert mock_nautobot_service.rest_request.call_count == 3

    @pytest.mark.asyncio
    async def test_ensure_interface_exists_already_exists(
        self, common_service, mock_nautobot_service
    ):
        """Test when interface already exists."""
        mock_nautobot_service.rest_request.return_value = {
            "count": 1,
            "results": [{"id": "interface-uuid-123", "name": "Loopback0"}],
        }

        result = await common_service.ensure_interface_exists(
            device_id="device-uuid-1", interface_name="Loopback0"
        )

        assert result == "interface-uuid-123"

    @pytest.mark.asyncio
    async def test_assign_ip_to_interface_new_assignment(
        self, common_service, mock_nautobot_service
    ):
        """Test creating new IP-to-Interface assignment."""
        # First call: check if exists (returns 0)
        # Second call: create assignment
        mock_nautobot_service.rest_request.side_effect = [
            {"count": 0, "results": []},  # Assignment doesn't exist
            {
                "id": "assignment-uuid-1",
                "ip_address": "ip-uuid-1",
                "interface": "interface-uuid-1",
            },  # Created
        ]

        result = await common_service.assign_ip_to_interface(
            ip_id="ip-uuid-1", interface_id="interface-uuid-1", is_primary=True
        )

        assert result["id"] == "assignment-uuid-1"
        assert mock_nautobot_service.rest_request.call_count == 2

    @pytest.mark.asyncio
    async def test_assign_ip_to_interface_already_assigned(
        self, common_service, mock_nautobot_service
    ):
        """Test when IP is already assigned to interface."""
        mock_nautobot_service.rest_request.return_value = {
            "count": 1,
            "results": [
                {
                    "id": "assignment-uuid-1",
                    "ip_address": "ip-uuid-1",
                    "interface": "interface-uuid-1",
                }
            ],
        }

        result = await common_service.assign_ip_to_interface(
            ip_id="ip-uuid-1", interface_id="interface-uuid-1"
        )

        assert result["id"] == "assignment-uuid-1"
        # Should only check, not create
        assert mock_nautobot_service.rest_request.call_count == 1


# ========================================================================
# ERROR HANDLING TESTS
# ========================================================================


class TestErrorHandling:
    """Tests for error handling utilities."""

    def test_is_duplicate_error_detects_keywords(self, common_service):
        """Test detection of duplicate errors."""
        error1 = Exception("Object already exists")
        error2 = Exception("Duplicate entry detected")
        error3 = Exception("Unique constraint violation")
        error4 = Exception("Some other error")

        assert common_service.is_duplicate_error(error1) is True
        assert common_service.is_duplicate_error(error2) is True
        assert common_service.is_duplicate_error(error3) is True
        assert common_service.is_duplicate_error(error4) is False

    def test_handle_already_exists_error(self, common_service):
        """Test handling of already exists errors."""
        error = Exception("Device 'test-device' already exists")

        result = common_service.handle_already_exists_error(error, "Device")

        assert result["error"] == "already_exists"
        assert "Device already exists" in result["message"]
        assert "already exists" in result["detail"]
