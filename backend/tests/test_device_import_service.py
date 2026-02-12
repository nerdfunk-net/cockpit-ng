"""
Unit tests for DeviceImportService.

Tests device import workflow including validation, creation, and interface handling.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock
from services.nautobot.devices.import_service import DeviceImportService
from services.nautobot.devices.types import InterfaceUpdateResult
from services.nautobot import NautobotService
from services.nautobot.devices.common import DeviceCommonService
from services.nautobot.devices.interface_workflow import InterfaceManagerService


@pytest.fixture
def mock_nautobot_service():
    """Create a mock NautobotService for testing."""
    service = MagicMock(spec=NautobotService)
    service.graphql_query = AsyncMock()
    service.rest_request = AsyncMock()
    return service


@pytest.fixture
def mock_common_service():
    """Create a mock DeviceCommonService for testing."""
    service = MagicMock(spec=DeviceCommonService)
    # Resolution methods
    service.resolve_device_type_id = AsyncMock(return_value="device-type-uuid")
    service.resolve_role_id = AsyncMock(return_value="role-uuid")
    service.resolve_location_id = AsyncMock(return_value="location-uuid")
    service.resolve_status_id = AsyncMock(return_value="status-uuid")
    service.resolve_platform_id = AsyncMock(return_value="platform-uuid")
    service.resolve_namespace_id = AsyncMock(return_value="namespace-uuid")
    service.resolve_device_by_name = AsyncMock(return_value="existing-device-uuid")
    # Validation methods
    service.validate_required_fields = MagicMock()
    service._is_valid_uuid = MagicMock(return_value=False)
    service.normalize_tags = MagicMock(
        side_effect=lambda x: x if isinstance(x, list) else [x]
    )
    # Interface/IP helpers
    service.ensure_ip_address_exists = AsyncMock(return_value="ip-uuid-123")
    service.assign_ip_to_interface = AsyncMock()
    # Error handling
    service.is_duplicate_error = MagicMock(return_value=False)
    return service


@pytest.fixture
def mock_interface_manager():
    """Create a mock InterfaceManagerService for testing."""
    service = MagicMock(spec=InterfaceManagerService)
    service.update_device_interfaces = AsyncMock(
        return_value=InterfaceUpdateResult(
            interfaces_created=1,
            interfaces_updated=0,
            interfaces_failed=0,
            ip_addresses_created=1,
            primary_ip4_id="ip-uuid-123",
            warnings=[],
        )
    )
    return service


@pytest.fixture
def import_service(mock_nautobot_service, mock_common_service, mock_interface_manager):
    """Create DeviceImportService instance with mocked dependencies."""
    service = DeviceImportService(mock_nautobot_service)
    service.common = mock_common_service  # Override with mock
    service.interface_manager = mock_interface_manager  # Override with mock
    return service


# ========================================================================
# VALIDATION TESTS
# ========================================================================


class TestValidation:
    """Tests for validate_import_data method."""

    @pytest.mark.asyncio
    async def test_validate_import_data_success(
        self, import_service, mock_common_service
    ):
        """Test successful validation with all required fields."""
        device_data = {
            "name": "test-device",
            "device_type": "Catalyst 9300",
            "role": "access-switch",
            "location": "Site-A",
            "status": "active",
            "platform": "ios",
            "serial": "ABC123",
            "tags": ["production", "core"],
        }

        result = await import_service.validate_import_data(device_data)

        assert result["name"] == "test-device"
        assert result["device_type"] == "device-type-uuid"
        assert result["role"] == "role-uuid"
        assert result["location"] == "location-uuid"
        assert result["status"] == "status-uuid"
        assert result["platform"] == "platform-uuid"
        assert result["serial"] == "ABC123"
        assert result["tags"] == ["production", "core"]

    @pytest.mark.asyncio
    async def test_validate_import_data_missing_required(
        self, import_service, mock_common_service
    ):
        """Test validation fails with missing required field."""
        device_data = {
            "name": "test-device",
            # Missing: device_type, role, location
        }

        mock_common_service.validate_required_fields.side_effect = ValueError(
            "Missing required fields: device_type, role, location"
        )

        with pytest.raises(ValueError, match="Missing required fields"):
            await import_service.validate_import_data(device_data)

    @pytest.mark.asyncio
    async def test_validate_import_data_with_uuids(
        self, import_service, mock_common_service
    ):
        """Test validation with UUIDs instead of names."""
        mock_common_service._is_valid_uuid.return_value = True

        device_data = {
            "name": "test-device",
            "device_type": "550e8400-e29b-41d4-a716-446655440001",
            "role": "550e8400-e29b-41d4-a716-446655440002",
            "location": "550e8400-e29b-41d4-a716-446655440003",
        }

        result = await import_service.validate_import_data(device_data)

        # Should use provided UUIDs directly without resolution
        assert result["device_type"] == "550e8400-e29b-41d4-a716-446655440001"
        assert result["role"] == "550e8400-e29b-41d4-a716-446655440002"
        assert result["location"] == "550e8400-e29b-41d4-a716-446655440003"

        # Resolution methods should not be called
        mock_common_service.resolve_device_type_id.assert_not_called()
        mock_common_service.resolve_role_id.assert_not_called()
        mock_common_service.resolve_location_id.assert_not_called()

    @pytest.mark.asyncio
    async def test_validate_import_data_default_status(
        self, import_service, mock_common_service
    ):
        """Test status defaults to 'active' if not provided."""
        device_data = {
            "name": "test-device",
            "device_type": "Catalyst 9300",
            "role": "access-switch",
            "location": "Site-A",
            # No status provided
        }

        result = await import_service.validate_import_data(device_data)

        # Should resolve "active" status
        mock_common_service.resolve_status_id.assert_called_with(
            "active", "dcim.device"
        )
        assert result["status"] == "status-uuid"

    @pytest.mark.asyncio
    async def test_validate_import_data_platform_not_found(
        self, import_service, mock_common_service
    ):
        """Test validation continues if optional platform not found."""
        mock_common_service.resolve_platform_id.return_value = None

        device_data = {
            "name": "test-device",
            "device_type": "Catalyst 9300",
            "role": "access-switch",
            "location": "Site-A",
            "platform": "nonexistent-platform",
        }

        result = await import_service.validate_import_data(device_data)

        # Should succeed but platform not included
        assert "platform" not in result
        assert result["name"] == "test-device"


# ========================================================================
# DEVICE CREATION TESTS
# ========================================================================


class TestDeviceCreation:
    """Tests for _create_device method."""

    @pytest.mark.asyncio
    async def test_create_device_success(self, import_service, mock_nautobot_service):
        """Test successful device creation."""
        validated_data = {
            "name": "test-device",
            "device_type": "device-type-uuid",
            "role": "role-uuid",
            "location": "location-uuid",
            "status": "status-uuid",
        }

        mock_nautobot_service.rest_request.return_value = {
            "id": "new-device-uuid",
            "name": "test-device",
        }

        device_id, device_response, was_created = await import_service._create_device(
            validated_data, skip_if_exists=False
        )

        assert device_id == "new-device-uuid"
        assert device_response["name"] == "test-device"
        assert was_created is True

        # Should call POST to create device
        mock_nautobot_service.rest_request.assert_called_once_with(
            endpoint="dcim/devices/",
            method="POST",
            data=validated_data,
        )

    @pytest.mark.asyncio
    async def test_create_device_already_exists_skip(
        self, import_service, mock_nautobot_service, mock_common_service
    ):
        """Test device already exists with skip_if_exists=True."""
        validated_data = {
            "name": "test-device",
            "device_type": "device-type-uuid",
            "role": "role-uuid",
            "location": "location-uuid",
            "status": "status-uuid",
        }

        # First call: POST fails with duplicate error
        # Second call: GET returns existing device
        mock_nautobot_service.rest_request.side_effect = [
            Exception("Device with this name already exists"),  # POST fails
            {"id": "existing-device-uuid", "name": "test-device"},  # GET succeeds
        ]

        mock_common_service.is_duplicate_error.return_value = True

        device_id, device_response, was_created = await import_service._create_device(
            validated_data, skip_if_exists=True
        )

        assert device_id == "existing-device-uuid"
        assert was_created is False

        # Should call resolve to find existing device
        mock_common_service.resolve_device_by_name.assert_called_once_with(
            "test-device"
        )

    @pytest.mark.asyncio
    async def test_create_device_already_exists_no_skip(
        self, import_service, mock_nautobot_service, mock_common_service
    ):
        """Test device already exists with skip_if_exists=False raises error."""
        validated_data = {
            "name": "test-device",
            "device_type": "device-type-uuid",
            "role": "role-uuid",
            "location": "location-uuid",
            "status": "status-uuid",
        }

        mock_nautobot_service.rest_request.side_effect = Exception(
            "Device with this name already exists"
        )
        mock_common_service.is_duplicate_error.return_value = True

        with pytest.raises(Exception, match="already exists"):
            await import_service._create_device(validated_data, skip_if_exists=False)

    @pytest.mark.asyncio
    async def test_create_device_no_id_returned(
        self, import_service, mock_nautobot_service
    ):
        """Test error when no device ID returned."""
        validated_data = {"name": "test-device"}

        mock_nautobot_service.rest_request.return_value = {}  # No 'id' field

        with pytest.raises(Exception, match="No device ID returned"):
            await import_service._create_device(validated_data, skip_if_exists=False)


# ========================================================================
# INTERFACE CREATION TESTS
# ========================================================================


class TestInterfaceCreation:
    """Tests for _create_device_interfaces method."""

    @pytest.mark.asyncio
    async def test_create_interfaces_success(
        self, import_service, mock_interface_manager
    ):
        """Test successful interface creation via InterfaceManagerService."""
        interface_config = [
            {
                "name": "Loopback0",
                "type": "virtual",
                "status": "active",
                "ip_address": "10.0.0.1/32",
                "namespace": "Global",
                "is_primary_ipv4": True,
            }
        ]

        # Mock is already configured in fixture with 1 interface created, 1 IP, primary_ip4_id

        created_interfaces, primary_ip = await import_service._create_device_interfaces(
            device_id="device-uuid-1",
            interface_config=interface_config,
            device_name="test-device",
        )

        # Verify InterfaceManagerService was called with normalized config
        mock_interface_manager.update_device_interfaces.assert_called_once()
        call_kwargs = mock_interface_manager.update_device_interfaces.call_args[1]
        assert call_kwargs["device_id"] == "device-uuid-1"
        assert len(call_kwargs["interfaces"]) == 1
        # Verify ip_address was converted to ip_addresses array
        assert "ip_addresses" in call_kwargs["interfaces"][0]

        # Verify return values match InterfaceUpdateResult
        assert len(created_interfaces) == 1
        assert created_interfaces[0]["success"] is True
        assert created_interfaces[0]["ip_assigned"] is True
        assert primary_ip == "ip-uuid-123"

    @pytest.mark.asyncio
    async def test_create_interfaces_with_lag(
        self, import_service, mock_interface_manager
    ):
        """Test interface creation with LAG dependency passes config to InterfaceManagerService."""
        interface_config = [
            {
                "id": "lag-1",  # Frontend ID
                "name": "Port-Channel1",
                "type": "lag",
                "status": "active",
            },
            {
                "name": "GigabitEthernet1",
                "type": "1000base-t",
                "status": "active",
                "lag": "lag-1",  # References LAG by frontend ID
            },
        ]

        # Configure mock to return 2 interfaces created
        mock_interface_manager.update_device_interfaces.return_value = (
            InterfaceUpdateResult(
                interfaces_created=2,
                interfaces_updated=0,
                interfaces_failed=0,
                ip_addresses_created=0,
                primary_ip4_id=None,
                warnings=[],
            )
        )

        created_interfaces, primary_ip = await import_service._create_device_interfaces(
            device_id="device-uuid-1",
            interface_config=interface_config,
            device_name="test-device",
        )

        # Verify InterfaceManagerService was called with both interfaces
        mock_interface_manager.update_device_interfaces.assert_called_once()
        call_kwargs = mock_interface_manager.update_device_interfaces.call_args[1]
        assert len(call_kwargs["interfaces"]) == 2
        # LAG reference should be preserved for InterfaceManagerService to handle
        assert call_kwargs["interfaces"][1].get("lag") == "lag-1"

        # Verify result reflects 2 successful interfaces
        assert len(created_interfaces) == 2
        assert all(iface["success"] is True for iface in created_interfaces)

    @pytest.mark.asyncio
    async def test_create_interfaces_missing_name(
        self, import_service, mock_interface_manager
    ):
        """Test interface creation with missing name reports failure from InterfaceManagerService."""
        interface_config = [
            {
                # Missing "name"
                "type": "virtual",
                "status": "active",
            }
        ]

        # Mock InterfaceManagerService returning a failure with warning
        mock_interface_manager.update_device_interfaces.return_value = (
            InterfaceUpdateResult(
                interfaces_created=0,
                interfaces_updated=0,
                interfaces_failed=1,
                ip_addresses_created=0,
                primary_ip4_id=None,
                warnings=["Interface creation Failed: Missing interface name"],
            )
        )

        created_interfaces, primary_ip = await import_service._create_device_interfaces(
            device_id="device-uuid-1",
            interface_config=interface_config,
            device_name="test-device",
        )

        # Verify failure is reported
        assert len(created_interfaces) == 1
        assert created_interfaces[0]["success"] is False
        assert "Failed" in created_interfaces[0]["error"]

    @pytest.mark.asyncio
    async def test_create_interfaces_ip_assignment_fails(
        self, import_service, mock_interface_manager
    ):
        """Test interface creation succeeds but IP assignment fails."""
        interface_config = [
            {
                "name": "Loopback0",
                "type": "virtual",
                "status": "active",
                "ip_address": "10.0.0.1/32",
                "namespace": "Global",
            }
        ]

        # Mock InterfaceManagerService: interface created but IP assignment failed
        mock_interface_manager.update_device_interfaces.return_value = (
            InterfaceUpdateResult(
                interfaces_created=1,
                interfaces_updated=0,
                interfaces_failed=0,
                ip_addresses_created=0,  # IP creation failed
                primary_ip4_id=None,
                warnings=["IP assignment failed for Loopback0"],
            )
        )

        created_interfaces, primary_ip = await import_service._create_device_interfaces(
            device_id="device-uuid-1",
            interface_config=interface_config,
            device_name="test-device",
        )

        assert len(created_interfaces) == 1
        assert created_interfaces[0]["success"] is True  # Interface created
        assert created_interfaces[0]["ip_assigned"] is False  # But IP not assigned
        assert primary_ip is None

    @pytest.mark.asyncio
    async def test_create_interfaces_primary_ipv4_selection(
        self, import_service, mock_interface_manager
    ):
        """Test primary IPv4 selection is returned from InterfaceManagerService."""
        interface_config = [
            {
                "name": "Loopback0",
                "type": "virtual",
                "status": "active",
                "ip_address": "10.0.0.1/32",
                "namespace": "Global",
                # No is_primary_ipv4 flag
            },
            {
                "name": "Loopback1",
                "type": "virtual",
                "status": "active",
                "ip_address": "10.0.0.2/32",
                "namespace": "Global",
                "is_primary_ipv4": True,  # Explicitly marked as primary
            },
        ]

        # Mock InterfaceManagerService returning the primary IP from marked interface
        mock_interface_manager.update_device_interfaces.return_value = (
            InterfaceUpdateResult(
                interfaces_created=2,
                interfaces_updated=0,
                interfaces_failed=0,
                ip_addresses_created=2,
                primary_ip4_id="ip-uuid-2",  # The marked primary IP
                warnings=[],
            )
        )

        created_interfaces, primary_ip = await import_service._create_device_interfaces(
            device_id="device-uuid-1",
            interface_config=interface_config,
            device_name="test-device",
        )

        # Verify is_primary flag is converted and passed to InterfaceManagerService
        call_kwargs = mock_interface_manager.update_device_interfaces.call_args[1]
        # Second interface should have is_primary in its ip_addresses
        loopback1_config = call_kwargs["interfaces"][1]
        assert loopback1_config["ip_addresses"][0]["is_primary"] is True

        # Second IP should be primary (explicitly marked)
        assert primary_ip == "ip-uuid-2"


# ========================================================================
# INTEGRATION TESTS
# ========================================================================


class TestImportDeviceIntegration:
    """Integration tests for complete import_device workflow."""

    @pytest.mark.asyncio
    async def test_import_device_full_workflow(
        self, import_service, mock_nautobot_service, mock_interface_manager
    ):
        """Test complete device import workflow."""
        device_data = {
            "name": "test-device",
            "device_type": "Catalyst 9300",
            "role": "access-switch",
            "location": "Site-A",
            "status": "active",
            "serial": "ABC123",
        }

        interface_config = [
            {
                "name": "Loopback0",
                "type": "virtual",
                "status": "active",
                "ip_address": "10.0.0.1/32",
                "namespace": "Global",
                "is_primary_ipv4": True,
            }
        ]

        # Mock device creation and primary IP assignment via rest_request
        # Interface creation is handled by mock_interface_manager (from fixture)
        mock_nautobot_service.rest_request.side_effect = [
            {"id": "device-uuid-123", "name": "test-device"},  # Device creation
            {
                "id": "device-uuid-123",
                "primary_ip4": "ip-uuid-123",
            },  # Primary IP assignment
        ]

        result = await import_service.import_device(
            device_data=device_data,
            interface_config=interface_config,
            skip_if_exists=False,
        )

        assert result["success"] is True
        assert result["device_id"] == "device-uuid-123"
        assert result["device_name"] == "test-device"
        assert result["created"] is True
        assert len(result["warnings"]) == 0
        assert result["details"]["primary_ip"] == "ip-uuid-123"

        # Verify InterfaceManagerService was called
        mock_interface_manager.update_device_interfaces.assert_called_once()

    @pytest.mark.asyncio
    async def test_import_device_already_exists_skip(
        self, import_service, mock_nautobot_service, mock_common_service
    ):
        """Test import with skip_if_exists when device exists."""
        device_data = {
            "name": "test-device",
            "device_type": "Catalyst 9300",
            "role": "access-switch",
            "location": "Site-A",
        }

        # Device creation fails (already exists)
        mock_nautobot_service.rest_request.side_effect = [
            Exception("Device already exists"),  # POST fails
            {"id": "existing-device-uuid", "name": "test-device"},  # GET succeeds
        ]

        mock_common_service.is_duplicate_error.return_value = True

        result = await import_service.import_device(
            device_data=device_data,
            interface_config=None,
            skip_if_exists=True,
        )

        assert result["success"] is True
        assert result["device_id"] == "existing-device-uuid"
        assert result["created"] is False
        assert "already exists" in result["message"]
        assert len(result["warnings"]) > 0

    @pytest.mark.asyncio
    async def test_import_device_validation_fails(
        self, import_service, mock_common_service
    ):
        """Test import fails gracefully on validation error."""
        device_data = {
            "name": "test-device",
            # Missing required fields
        }

        mock_common_service.validate_required_fields.side_effect = ValueError(
            "Missing required fields: device_type, role, location"
        )

        result = await import_service.import_device(
            device_data=device_data,
            interface_config=None,
            skip_if_exists=False,
        )

        assert result["success"] is False
        assert "Missing required fields" in result["message"]
        assert result["device_id"] is None

    @pytest.mark.asyncio
    async def test_import_device_no_interfaces(
        self, import_service, mock_nautobot_service, mock_common_service
    ):
        """Test import device without interfaces."""
        device_data = {
            "name": "test-device",
            "device_type": "Catalyst 9300",
            "role": "access-switch",
            "location": "Site-A",
        }

        mock_nautobot_service.rest_request.return_value = {
            "id": "device-uuid-123",
            "name": "test-device",
        }

        result = await import_service.import_device(
            device_data=device_data,
            interface_config=None,  # No interfaces
            skip_if_exists=False,
        )

        assert result["success"] is True
        assert result["device_id"] == "device-uuid-123"
        assert len(result["details"]["interfaces"]) == 0
        assert result["details"]["primary_ip"] is None
