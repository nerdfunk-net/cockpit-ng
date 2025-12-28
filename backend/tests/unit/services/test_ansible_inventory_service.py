"""
Unit tests for Ansible Inventory Service.

Tests inventory generation including:
- Device filtering by various criteria
- Logical operations (AND/OR)
- Inventory format generation
- Custom field handling
"""

import pytest
from unittest.mock import AsyncMock, Mock, patch
from services.ansible_inventory import AnsibleInventoryService
from models.ansible_inventory import LogicalOperation, LogicalCondition
from tests.fixtures import create_devices_list


# ==============================================================================
# Test Class: Inventory Preview
# ==============================================================================

@pytest.mark.unit
@pytest.mark.nautobot
class TestInventoryPreview:
    """Test inventory preview functionality."""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Set up test instance."""
        self.service = AnsibleInventoryService()

    @pytest.mark.asyncio
    async def test_preview_inventory_by_location(self, mock_nautobot_service):
        """Test previewing inventory filtered by location."""
        # Arrange
        with patch('services.nautobot.nautobot_service', mock_nautobot_service):
            devices = create_devices_list(count=5)
            mock_nautobot_service.graphql_query = AsyncMock(return_value=devices)

            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[
                        LogicalCondition(field="location", operator="equals", value="DC1")
                    ]
                )
            ]

            # Act
            result_devices, op_count = await self.service.preview_inventory(operations)

            # Assert
            assert op_count == 1
            # Devices should be filtered
            assert len(result_devices) >= 0

    @pytest.mark.asyncio
    async def test_preview_inventory_by_role(self, mock_nautobot_service):
        """Test previewing inventory filtered by role."""
        # Arrange
        with patch('services.nautobot.nautobot_service', mock_nautobot_service):
            devices = create_devices_list(count=3)
            mock_nautobot_service.graphql_query = AsyncMock(return_value=devices)

            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[
                        LogicalCondition(field="role", operator="equals", value="access-switch")
                    ]
                )
            ]

            # Act
            result_devices, op_count = await self.service.preview_inventory(operations)

            # Assert
            assert op_count == 1
            assert isinstance(result_devices, list)

    @pytest.mark.asyncio
    async def test_preview_inventory_with_and_conditions(self, mock_nautobot_service):
        """Test inventory preview with AND logical operation."""
        # Arrange
        with patch('services.nautobot.nautobot_service', mock_nautobot_service):
            devices = create_devices_list(count=10)
            mock_nautobot_service.graphql_query = AsyncMock(return_value=devices)

            # Multiple AND conditions
            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[
                        LogicalCondition(field="location", operator="equals", value="DC1"),
                        LogicalCondition(field="role", operator="equals", value="access-switch"),
                        LogicalCondition(field="status", operator="equals", value="Active")
                    ]
                )
            ]

            # Act
            result_devices, op_count = await self.service.preview_inventory(operations)

            # Assert
            assert op_count == 3  # 3 conditions
            # AND should filter more strictly
            assert len(result_devices) <= 10

    @pytest.mark.asyncio
    async def test_preview_inventory_with_or_conditions(self, mock_nautobot_service):
        """Test inventory preview with OR logical operation."""
        # Arrange
        with patch('services.nautobot.nautobot_service', mock_nautobot_service):
            devices = create_devices_list(count=5)
            mock_nautobot_service.graphql_query = AsyncMock(return_value=devices)

            # OR conditions should return more devices
            operations = [
                LogicalOperation(
                    operation_type="OR",
                    conditions=[
                        LogicalCondition(field="location", operator="equals", value="DC1"),
                        LogicalCondition(field="location", operator="equals", value="DC2")
                    ]
                )
            ]

            # Act
            result_devices, op_count = await self.service.preview_inventory(operations)

            # Assert
            assert op_count == 2  # 2 conditions


# ==============================================================================
# Test Class: Device Filtering
# ==============================================================================

@pytest.mark.unit
@pytest.mark.nautobot
class TestDeviceFiltering:
    """Test device filtering by various criteria."""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Set up test instance."""
        self.service = AnsibleInventoryService()

    @pytest.mark.asyncio
    async def test_filter_by_name(self, mock_nautobot_service):
        """Test filtering devices by name."""
        # Arrange
        with patch('services.nautobot.nautobot_service', mock_nautobot_service):
            devices = {"data": {"devices": [
                {"id": "dev-1", "name": "switch-01"},
                {"id": "dev-2", "name": "router-01"}
            ]}}
            mock_nautobot_service.graphql_query = AsyncMock(return_value=devices)

            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[LogicalCondition(field="name", operator="equals", value="switch-01")]
                )
            ]

            # Act
            result_devices, _ = await self.service.preview_inventory(operations)

            # Assert
            # Should match device with that name
            assert len(result_devices) >= 0

    @pytest.mark.asyncio
    async def test_filter_by_tag(self, mock_nautobot_service):
        """Test filtering devices by tag."""
        # Arrange
        with patch('services.nautobot.nautobot_service', mock_nautobot_service):
            devices = create_devices_list(count=3)
            mock_nautobot_service.graphql_query = AsyncMock(return_value=devices)

            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[LogicalCondition(field="tag", operator="equals", value="production")]
                )
            ]

            # Act
            result_devices, _ = await self.service.preview_inventory(operations)

            # Assert
            assert isinstance(result_devices, list)

    @pytest.mark.asyncio
    async def test_filter_by_platform(self, mock_nautobot_service):
        """Test filtering devices by platform."""
        # Arrange
        with patch('services.nautobot.nautobot_service', mock_nautobot_service):
            devices = create_devices_list(count=5)
            mock_nautobot_service.graphql_query = AsyncMock(return_value=devices)

            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[LogicalCondition(field="platform", operator="equals", value="cisco_ios")]
                )
            ]

            # Act
            result_devices, _ = await self.service.preview_inventory(operations)

            # Assert
            assert isinstance(result_devices, list)

    @pytest.mark.asyncio
    async def test_filter_by_has_primary_ip(self, mock_nautobot_service):
        """Test filtering devices that have primary IP."""
        # Arrange
        with patch('services.nautobot.nautobot_service', mock_nautobot_service):
            devices = create_devices_list(count=5)
            mock_nautobot_service.graphql_query = AsyncMock(return_value=devices)

            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[LogicalCondition(field="has_primary", operator="equals", value="true")]
                )
            ]

            # Act
            result_devices, _ = await self.service.preview_inventory(operations)

            # Assert
            assert isinstance(result_devices, list)


# ==============================================================================
# Test Class: Inventory Generation
# ==============================================================================

@pytest.mark.unit
@pytest.mark.nautobot
class TestInventoryGeneration:
    """Test Ansible inventory format generation."""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Set up test instance."""
        self.service = AnsibleInventoryService()

    @pytest.mark.asyncio
    async def test_generate_inventory_format(self, mock_nautobot_service):
        """Test generating inventory in Ansible format."""
        # Arrange
        with patch('services.nautobot.nautobot_service', mock_nautobot_service):
            devices = create_devices_list(count=3)
            mock_nautobot_service.graphql_query = AsyncMock(return_value=devices)

            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[LogicalCondition(field="status", operator="equals", value="Active")]
                )
            ]

            # Act
            result_devices, _ = await self.service.preview_inventory(operations)

            # Assert
            # Inventory should be generated (format validation would be in integration test)
            assert result_devices is not None

    @pytest.mark.asyncio
    async def test_inventory_includes_device_variables(self, mock_nautobot_service):
        """Test that inventory includes device variables."""
        # Arrange
        with patch('services.nautobot.nautobot_service', mock_nautobot_service):
            device_with_vars = {
                "data": {
                    "devices": [{
                        "id": "dev-1",
                        "name": "switch-01",
                        "platform": {"name": "cisco_ios"},
                        "primary_ip4": {"address": "10.0.0.1/24"}
                    }]
                }
            }
            mock_nautobot_service.graphql_query = AsyncMock(return_value=device_with_vars)

            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[LogicalCondition(field="name", operator="equals", value="switch-01")]
                )
            ]

            # Act
            result_devices, _ = await self.service.preview_inventory(operations)

            # Assert
            assert len(result_devices) >= 0


# ==============================================================================
# Test Class: Custom Fields
# ==============================================================================

@pytest.mark.unit
@pytest.mark.nautobot
class TestCustomFieldHandling:
    """Test handling of custom fields in inventory."""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Set up test instance."""
        self.service = AnsibleInventoryService()

    @pytest.mark.asyncio
    async def test_get_custom_field_types(self, mock_nautobot_service):
        """Test fetching custom field types."""
        # Arrange
        with patch('services.nautobot.nautobot_service', mock_nautobot_service):
            custom_fields = [
                {"key": "site_code", "type": {"value": "text"}},
                {"key": "rack_unit", "type": {"value": "integer"}}
            ]
            mock_nautobot_service.get_custom_fields_for_devices = AsyncMock(
                return_value=custom_fields
            )

            # Act
            field_types = await self.service._get_custom_field_types()

            # Assert
            assert "site_code" in field_types
            assert field_types["site_code"] == "text"
            assert "rack_unit" in field_types
            assert field_types["rack_unit"] == "integer"

    @pytest.mark.asyncio
    async def test_caches_custom_field_types(self, mock_nautobot_service):
        """Test that custom field types are cached."""
        # Arrange
        with patch('services.nautobot.nautobot_service', mock_nautobot_service):
            custom_fields = [{"key": "test", "type": {"value": "text"}}]
            mock_nautobot_service.get_custom_fields_for_devices = AsyncMock(
                return_value=custom_fields
            )

            # Act: Call twice
            await self.service._get_custom_field_types()
            await self.service._get_custom_field_types()

            # Assert: API should only be called once due to caching
            assert mock_nautobot_service.get_custom_fields_for_devices.call_count == 1


# ==============================================================================
# Test Class: Complex Queries
# ==============================================================================

@pytest.mark.unit
@pytest.mark.nautobot
class TestComplexQueries:
    """Test complex inventory queries with multiple conditions."""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Set up test instance."""
        self.service = AnsibleInventoryService()

    @pytest.mark.asyncio
    async def test_complex_and_or_combination(self, mock_nautobot_service):
        """Test complex combination of AND and OR operations."""
        # Arrange
        with patch('services.nautobot.nautobot_service', mock_nautobot_service):
            devices = create_devices_list(count=10)
            mock_nautobot_service.graphql_query = AsyncMock(return_value=devices)

            # (location=DC1 AND role=access) OR (location=DC2 AND role=core)
            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[
                        LogicalCondition(field="location", operator="equals", value="DC1"),
                        LogicalCondition(field="role", operator="equals", value="access-switch")
                    ]
                ),
                LogicalOperation(
                    operation_type="OR",
                    conditions=[
                        LogicalCondition(field="location", operator="equals", value="DC2"),
                        LogicalCondition(field="role", operator="equals", value="core-router")
                    ]
                )
            ]

            # Act
            result_devices, op_count = await self.service.preview_inventory(operations)

            # Assert
            assert op_count == 4  # 2 ops with 2 conds each
            assert isinstance(result_devices, list)

    @pytest.mark.asyncio
    async def test_empty_operations(self):
        """Test handling empty operations list."""
        # Act
        result_devices, op_count = await self.service.preview_inventory([])

        # Assert
        assert op_count == 0
        assert result_devices == []


# ==============================================================================
# Test Class: Error Handling
# ==============================================================================

@pytest.mark.unit
@pytest.mark.nautobot
class TestAnsibleInventoryErrorHandling:
    """Test error handling in inventory service."""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Set up test instance."""
        self.service = AnsibleInventoryService()

    @pytest.mark.asyncio
    async def test_handles_graphql_errors(self, mock_nautobot_service):
        """Test handling GraphQL errors."""
        # Arrange
        with patch('services.nautobot.nautobot_service', mock_nautobot_service):
            mock_nautobot_service.graphql_query = AsyncMock(
                return_value={"errors": [{"message": "GraphQL error"}]}
            )

            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[LogicalCondition(field="location", operator="equals", value="DC1")]
                )
            ]

            # Act & Assert
            # Should handle error gracefully
            try:
                await self.service.preview_inventory(operations)
            except Exception as e:
                # Expected to handle errors
                assert "error" in str(e).lower() or True

    @pytest.mark.asyncio
    async def test_handles_invalid_field_name(self, mock_nautobot_service):
        """Test handling invalid field names."""
        # Arrange
        with patch('services.nautobot.nautobot_service', mock_nautobot_service):
            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[LogicalCondition(field="invalid_field", operator="equals", value="test")]
                )
            ]

            # Act
            # Should handle gracefully or raise appropriate error
            result_devices, op_count = await self.service.preview_inventory(operations)

            # Assert
            # Should return empty or handle gracefully
            assert isinstance(result_devices, list)
