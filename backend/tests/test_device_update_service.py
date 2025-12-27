"""
Unit tests for DeviceUpdateService.

Tests device update workflow including resolution, validation, and property updates.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from services.device_update_service import DeviceUpdateService
from services.nautobot import NautobotService
from services.device_common_service import DeviceCommonService


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
    service.resolve_device_id = AsyncMock(return_value="device-uuid-123")
    service.resolve_status_id = AsyncMock(return_value="status-uuid")
    service.resolve_platform_id = AsyncMock(return_value="platform-uuid")
    service.resolve_role_id = AsyncMock(return_value="role-uuid")
    service.resolve_location_id = AsyncMock(return_value="location-uuid")
    service.resolve_device_type_id = AsyncMock(return_value="device-type-uuid")
    service.ensure_interface_with_ip = AsyncMock(return_value="ip-uuid-123")
    # Validation methods
    service._is_valid_uuid = MagicMock(return_value=False)
    service.normalize_tags = MagicMock(side_effect=lambda x: x if isinstance(x, list) else [x])
    return service


@pytest.fixture
def update_service(mock_nautobot_service, mock_common_service):
    """Create DeviceUpdateService instance with mocked dependencies."""
    service = DeviceUpdateService(mock_nautobot_service)
    service.common = mock_common_service  # Override with mock
    return service


# ========================================================================
# DEVICE RESOLUTION TESTS
# ========================================================================


class TestDeviceResolution:
    """Tests for _resolve_device_id method."""

    @pytest.mark.asyncio
    async def test_resolve_device_by_id(
        self, update_service, mock_nautobot_service, mock_common_service
    ):
        """Test device resolution when UUID is provided."""
        device_identifier = {
            "id": "device-uuid-123",
            "name": "test-device"
        }

        mock_nautobot_service.rest_request.return_value = {
            "id": "device-uuid-123",
            "name": "test-device"
        }

        device_id, device_name = await update_service._resolve_device_id(device_identifier)

        assert device_id == "device-uuid-123"
        assert device_name == "test-device"

    @pytest.mark.asyncio
    async def test_resolve_device_by_name(
        self, update_service, mock_nautobot_service, mock_common_service
    ):
        """Test device resolution by name only."""
        device_identifier = {
            "name": "test-device"
        }

        mock_nautobot_service.rest_request.return_value = {
            "id": "device-uuid-456",
            "name": "test-device"
        }

        device_id, device_name = await update_service._resolve_device_id(device_identifier)

        assert device_id == "device-uuid-123"  # From mock
        assert device_name == "test-device"

        # Should call common service to resolve
        mock_common_service.resolve_device_id.assert_called_once()

    @pytest.mark.asyncio
    async def test_resolve_device_by_ip(
        self, update_service, mock_nautobot_service, mock_common_service
    ):
        """Test device resolution by IP address."""
        device_identifier = {
            "ip_address": "10.0.0.1"
        }

        mock_nautobot_service.rest_request.return_value = {
            "id": "device-uuid-789",
            "name": "device-from-ip"
        }

        device_id, device_name = await update_service._resolve_device_id(device_identifier)

        assert device_id == "device-uuid-123"  # From mock
        assert device_name == "device-from-ip"

    @pytest.mark.asyncio
    async def test_resolve_device_no_identifier(
        self, update_service, mock_common_service
    ):
        """Test error when no identifier provided."""
        device_identifier = {}

        with pytest.raises(ValueError, match="must include at least one of"):
            await update_service._resolve_device_id(device_identifier)

    @pytest.mark.asyncio
    async def test_resolve_device_not_found(
        self, update_service, mock_common_service
    ):
        """Test when device cannot be resolved."""
        device_identifier = {"name": "nonexistent"}

        mock_common_service.resolve_device_id.return_value = None

        device_id, device_name = await update_service._resolve_device_id(device_identifier)

        assert device_id is None
        assert device_name is None


# ========================================================================
# VALIDATION TESTS
# ========================================================================


class TestValidation:
    """Tests for validate_update_data method."""

    @pytest.mark.asyncio
    async def test_validate_update_data_simple_fields(
        self, update_service, mock_common_service
    ):
        """Test validation of simple string fields."""
        update_data = {
            "serial": "ABC123",
            "asset_tag": "TAG456",
            "description": "Test device"
        }

        validated, ip_namespace = await update_service.validate_update_data(
            device_id="device-uuid-1",
            update_data=update_data
        )

        assert validated["serial"] == "ABC123"
        assert validated["asset_tag"] == "TAG456"
        assert validated["description"] == "Test device"
        assert ip_namespace is None

    @pytest.mark.asyncio
    async def test_validate_update_data_with_resolution(
        self, update_service, mock_common_service
    ):
        """Test validation with name-to-UUID resolution."""
        update_data = {
            "status": "active",
            "platform": "ios",
            "role": "access-switch",
        }

        validated, ip_namespace = await update_service.validate_update_data(
            device_id="device-uuid-1",
            update_data=update_data
        )

        # Should resolve names to UUIDs
        assert validated["status"] == "status-uuid"
        assert validated["platform"] == "platform-uuid"
        assert validated["role"] == "role-uuid"

        # Verify resolution methods were called
        mock_common_service.resolve_status_id.assert_called_with("active", "dcim.device")
        mock_common_service.resolve_platform_id.assert_called_with("ios")
        mock_common_service.resolve_role_id.assert_called_with("access-switch")

    @pytest.mark.asyncio
    async def test_validate_update_data_nested_fields(
        self, update_service, mock_common_service
    ):
        """Test validation handles nested field notation."""
        update_data = {
            "platform.name": "ios",  # Should flatten to "platform"
            "role.slug": "access-switch",  # Should flatten to "role"
        }

        validated, ip_namespace = await update_service.validate_update_data(
            device_id="device-uuid-1",
            update_data=update_data
        )

        # Should have flattened fields
        assert "platform" in validated
        assert "role" in validated
        assert "platform.name" not in validated
        assert "role.slug" not in validated

    @pytest.mark.asyncio
    async def test_validate_update_data_tags(
        self, update_service, mock_common_service
    ):
        """Test tag normalization."""
        update_data = {
            "tags": "production,core,switch"  # Comma-separated string
        }

        validated, ip_namespace = await update_service.validate_update_data(
            device_id="device-uuid-1",
            update_data=update_data
        )

        # Should normalize to list
        mock_common_service.normalize_tags.assert_called_with("production,core,switch")

    @pytest.mark.asyncio
    async def test_validate_update_data_skip_empty(
        self, update_service, mock_common_service
    ):
        """Test that empty values are skipped."""
        update_data = {
            "serial": "ABC123",
            "asset_tag": "",  # Empty string
            "description": None,  # None
        }

        validated, ip_namespace = await update_service.validate_update_data(
            device_id="device-uuid-1",
            update_data=update_data
        )

        # Should only include non-empty values
        assert "serial" in validated
        assert "asset_tag" not in validated
        assert "description" not in validated

    @pytest.mark.asyncio
    async def test_validate_update_data_with_ip_namespace(
        self, update_service, mock_common_service
    ):
        """Test IP namespace extraction."""
        update_data = {
            "primary_ip4": "10.0.0.1/32",
            "ip_namespace": "Production"
        }

        validated, ip_namespace = await update_service.validate_update_data(
            device_id="device-uuid-1",
            update_data=update_data
        )

        # primary_ip4 should be in validated data
        assert validated["primary_ip4"] == "10.0.0.1/32"
        # ip_namespace should be extracted separately
        assert ip_namespace == "Production"
        assert "ip_namespace" not in validated

    @pytest.mark.asyncio
    async def test_validate_update_data_with_uuids(
        self, update_service, mock_common_service
    ):
        """Test validation when UUIDs are provided instead of names."""
        mock_common_service._is_valid_uuid.return_value = True

        update_data = {
            "status": "550e8400-e29b-41d4-a716-446655440001",
            "platform": "550e8400-e29b-41d4-a716-446655440002",
        }

        validated, ip_namespace = await update_service.validate_update_data(
            device_id="device-uuid-1",
            update_data=update_data
        )

        # Should use UUIDs directly without resolution
        assert validated["status"] == "550e8400-e29b-41d4-a716-446655440001"
        assert validated["platform"] == "550e8400-e29b-41d4-a716-446655440002"

        # Resolution methods should not be called
        mock_common_service.resolve_status_id.assert_not_called()
        mock_common_service.resolve_platform_id.assert_not_called()


# ========================================================================
# UPDATE PROPERTIES TESTS
# ========================================================================


class TestUpdateProperties:
    """Tests for _update_device_properties method."""

    @pytest.mark.asyncio
    async def test_update_device_properties_simple(
        self, update_service, mock_nautobot_service, mock_common_service
    ):
        """Test simple property updates."""
        validated_data = {
            "serial": "ABC123",
            "asset_tag": "TAG456",
            "status": "status-uuid",
        }

        mock_nautobot_service.rest_request.return_value = {
            "id": "device-uuid-1",
            "serial": "ABC123",
            "asset_tag": "TAG456",
            "status": {"id": "status-uuid"},
        }

        updated_fields = await update_service._update_device_properties(
            device_id="device-uuid-1",
            validated_data=validated_data
        )

        assert "serial" in updated_fields
        assert "asset_tag" in updated_fields
        assert "status" in updated_fields

        # Should call PATCH
        mock_nautobot_service.rest_request.assert_called_once()
        call_args = mock_nautobot_service.rest_request.call_args
        assert call_args[1]["method"] == "PATCH"
        assert call_args[1]["endpoint"] == "dcim/devices/device-uuid-1/"

    @pytest.mark.asyncio
    async def test_update_device_properties_with_primary_ip4(
        self, update_service, mock_nautobot_service, mock_common_service
    ):
        """Test update with primary_ip4 (requires interface creation)."""
        validated_data = {
            "primary_ip4": "10.0.0.1/32",
            "serial": "ABC123",
        }

        interface_config = {
            "name": "Loopback0",
            "type": "virtual",
            "status": "active",
        }

        mock_nautobot_service.rest_request.return_value = {
            "id": "device-uuid-1",
            "primary_ip4": {"id": "ip-uuid-123"},
            "serial": "ABC123",
        }

        updated_fields = await update_service._update_device_properties(
            device_id="device-uuid-1",
            validated_data=validated_data,
            interface_config=interface_config,
            ip_namespace="Global"
        )

        # Should call ensure_interface_with_ip
        mock_common_service.ensure_interface_with_ip.assert_called_once_with(
            device_id="device-uuid-1",
            ip_address="10.0.0.1/32",
            interface_name="Loopback0",
            interface_type="virtual",
            interface_status="active",
            ip_namespace="Global"
        )

        # Should update primary_ip4 with IP UUID
        call_args = mock_nautobot_service.rest_request.call_args
        assert call_args[1]["data"]["primary_ip4"] == "ip-uuid-123"

    @pytest.mark.asyncio
    async def test_update_device_properties_primary_ip4_default_interface(
        self, update_service, mock_nautobot_service, mock_common_service
    ):
        """Test primary_ip4 update with default interface config."""
        validated_data = {
            "primary_ip4": "10.0.0.1/32",
        }

        mock_nautobot_service.rest_request.return_value = {
            "id": "device-uuid-1",
            "primary_ip4": {"id": "ip-uuid-123"},
        }

        await update_service._update_device_properties(
            device_id="device-uuid-1",
            validated_data=validated_data,
            interface_config=None,  # No config provided
            ip_namespace=None  # No namespace provided
        )

        # Should use defaults: Loopback, virtual, active, Global
        mock_common_service.ensure_interface_with_ip.assert_called_once()
        call_args = mock_common_service.ensure_interface_with_ip.call_args
        assert call_args[1]["interface_name"] == "Loopback"
        assert call_args[1]["interface_type"] == "virtual"
        assert call_args[1]["interface_status"] == "active"
        assert call_args[1]["ip_namespace"] == "Global"

    @pytest.mark.asyncio
    async def test_update_device_properties_primary_ip4_verification_fails(
        self, update_service, mock_nautobot_service, mock_common_service
    ):
        """Test error when primary_ip4 verification fails."""
        validated_data = {
            "primary_ip4": "10.0.0.1/32",
        }

        # Return different IP than expected
        mock_nautobot_service.rest_request.return_value = {
            "id": "device-uuid-1",
            "primary_ip4": {"id": "wrong-ip-uuid"},  # Not the expected ip-uuid-123
        }

        with pytest.raises(ValueError, match="primary_ip4 mismatch"):
            await update_service._update_device_properties(
                device_id="device-uuid-1",
                validated_data=validated_data
            )


# ========================================================================
# VERIFICATION TESTS
# ========================================================================


class TestVerification:
    """Tests for _verify_updates method."""

    @pytest.mark.asyncio
    async def test_verify_updates_all_match(self, update_service):
        """Test verification when all updates match."""
        expected_updates = {
            "serial": "ABC123",
            "asset_tag": "TAG456",
            "status": "status-uuid",
        }

        actual_device = {
            "id": "device-uuid-1",
            "serial": "ABC123",
            "asset_tag": "TAG456",
            "status": {"id": "status-uuid"},  # Nested object
        }

        result = await update_service._verify_updates(
            device_id="device-uuid-1",
            expected_updates=expected_updates,
            actual_device=actual_device
        )

        assert result is True

    @pytest.mark.asyncio
    async def test_verify_updates_mismatch(self, update_service):
        """Test verification when updates don't match."""
        expected_updates = {
            "serial": "ABC123",
            "asset_tag": "TAG456",
        }

        actual_device = {
            "id": "device-uuid-1",
            "serial": "ABC123",
            "asset_tag": "DIFFERENT",  # Mismatch
        }

        result = await update_service._verify_updates(
            device_id="device-uuid-1",
            expected_updates=expected_updates,
            actual_device=actual_device
        )

        assert result is False

    @pytest.mark.asyncio
    async def test_verify_updates_skip_special_fields(self, update_service):
        """Test that special fields are skipped in verification."""
        expected_updates = {
            "serial": "ABC123",
            "tags": ["production", "core"],  # Special field
            "custom_fields": {"key": "value"},  # Special field
        }

        actual_device = {
            "id": "device-uuid-1",
            "serial": "ABC123",
            # tags and custom_fields can be different, won't affect verification
        }

        result = await update_service._verify_updates(
            device_id="device-uuid-1",
            expected_updates=expected_updates,
            actual_device=actual_device
        )

        # Should pass because special fields are skipped
        assert result is True


# ========================================================================
# INTEGRATION TESTS
# ========================================================================


class TestUpdateDeviceIntegration:
    """Integration tests for complete update_device workflow."""

    @pytest.mark.asyncio
    async def test_update_device_full_workflow(
        self, update_service, mock_nautobot_service, mock_common_service
    ):
        """Test complete device update workflow."""
        device_identifier = {"name": "test-device"}

        update_data = {
            "serial": "NEW-SERIAL",
            "status": "active",
            "platform": "ios",
        }

        # Mock GET calls (before and after)
        mock_nautobot_service.rest_request.side_effect = [
            {"id": "device-uuid-1", "name": "test-device", "serial": "OLD-SERIAL"},  # GET before
            {"id": "device-uuid-1", "name": "test-device", "serial": "NEW-SERIAL", "status": {"id": "status-uuid"}, "platform": {"id": "platform-uuid"}},  # PATCH
            {"id": "device-uuid-1", "name": "test-device", "serial": "NEW-SERIAL", "status": {"id": "status-uuid"}, "platform": {"id": "platform-uuid"}},  # GET after
        ]

        result = await update_service.update_device(
            device_identifier=device_identifier,
            update_data=update_data
        )

        assert result["success"] is True
        assert result["device_id"] == "device-uuid-123"  # From mock
        assert result["device_name"] == "test-device"
        assert "serial" in result["updated_fields"]
        assert "status" in result["updated_fields"]
        assert "platform" in result["updated_fields"]
        assert len(result["warnings"]) == 0

    @pytest.mark.asyncio
    async def test_update_device_not_found(
        self, update_service, mock_common_service
    ):
        """Test update when device not found."""
        device_identifier = {"name": "nonexistent"}

        update_data = {"serial": "ABC123"}

        mock_common_service.resolve_device_id.return_value = None

        result = await update_service.update_device(
            device_identifier=device_identifier,
            update_data=update_data,
            create_if_missing=False
        )

        assert result["success"] is False
        assert "not found" in result["message"].lower()

    @pytest.mark.asyncio
    async def test_update_device_no_fields_to_update(
        self, update_service, mock_nautobot_service, mock_common_service
    ):
        """Test update when no valid fields to update."""
        device_identifier = {"id": "device-uuid-1"}

        update_data = {
            "empty_field": "",  # Will be filtered out
            "none_field": None,  # Will be filtered out
        }

        mock_nautobot_service.rest_request.return_value = {
            "id": "device-uuid-1",
            "name": "test-device"
        }

        result = await update_service.update_device(
            device_identifier=device_identifier,
            update_data=update_data
        )

        assert result["success"] is True
        assert len(result["updated_fields"]) == 0
        assert "no fields to update" in result["message"].lower()
        assert len(result["warnings"]) > 0

    @pytest.mark.asyncio
    async def test_update_device_with_primary_ip4(
        self, update_service, mock_nautobot_service, mock_common_service
    ):
        """Test update including primary_ip4."""
        device_identifier = {"id": "device-uuid-1"}

        update_data = {
            "primary_ip4": "10.0.0.1/32",
            "serial": "ABC123",
        }

        interface_config = {
            "name": "Loopback0",
            "type": "virtual",
            "status": "active",
        }

        mock_nautobot_service.rest_request.side_effect = [
            {"id": "device-uuid-1", "name": "test-device"},  # GET before
            {"id": "device-uuid-1", "primary_ip4": {"id": "ip-uuid-123"}, "serial": "ABC123"},  # PATCH
            {"id": "device-uuid-1", "primary_ip4": {"id": "ip-uuid-123"}, "serial": "ABC123"},  # GET after
        ]

        result = await update_service.update_device(
            device_identifier=device_identifier,
            update_data=update_data,
            interface_config=interface_config
        )

        assert result["success"] is True
        assert "primary_ip4" in result["updated_fields"]
        assert "serial" in result["updated_fields"]

        # Should have called ensure_interface_with_ip
        mock_common_service.ensure_interface_with_ip.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_device_verification_warning(
        self, update_service, mock_nautobot_service, mock_common_service
    ):
        """Test update with verification warning."""
        device_identifier = {"id": "device-uuid-1"}

        update_data = {"serial": "NEW-SERIAL"}

        mock_nautobot_service.rest_request.side_effect = [
            {"id": "device-uuid-1", "name": "test-device", "serial": "OLD"},  # GET before
            {"id": "device-uuid-1", "serial": "NEW-SERIAL"},  # PATCH returns correct
            {"id": "device-uuid-1", "serial": "UNEXPECTED"},  # GET after returns different
        ]

        result = await update_service.update_device(
            device_identifier=device_identifier,
            update_data=update_data
        )

        assert result["success"] is True  # Still succeeds
        assert len(result["warnings"]) > 0  # But has warning
        assert any("may not have been applied" in w for w in result["warnings"])
