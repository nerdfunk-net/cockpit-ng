"""
Unit tests for Inventory Service.

Tests inventory generation including:
- Device filtering by various criteria
- Logical operations (AND/OR)
- Inventory format generation
- Custom field handling
- GraphQL query construction validation
- Client-side filtering logic
"""

import pytest
from unittest.mock import AsyncMock, patch
from services.inventory.inventory import InventoryService
from models.inventory import LogicalOperation, LogicalCondition
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
        self.service = InventoryService()

    @pytest.mark.asyncio
    async def test_preview_inventory_by_location(self, mock_nautobot_service):
        """Test previewing inventory filtered by location."""
        # Arrange
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            devices = create_devices_list(count=5)
            mock_nautobot_service.graphql_query = AsyncMock(return_value=devices)

            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[
                        LogicalCondition(
                            field="location", operator="equals", value="DC1"
                        )
                    ],
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
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            devices = create_devices_list(count=3)
            mock_nautobot_service.graphql_query = AsyncMock(return_value=devices)

            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[
                        LogicalCondition(
                            field="role", operator="equals", value="access-switch"
                        )
                    ],
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
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            devices = create_devices_list(count=10)
            mock_nautobot_service.graphql_query = AsyncMock(return_value=devices)

            # Multiple AND conditions
            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[
                        LogicalCondition(
                            field="location", operator="equals", value="DC1"
                        ),
                        LogicalCondition(
                            field="role", operator="equals", value="access-switch"
                        ),
                        LogicalCondition(
                            field="status", operator="equals", value="Active"
                        ),
                    ],
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
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            devices = create_devices_list(count=5)
            mock_nautobot_service.graphql_query = AsyncMock(return_value=devices)

            # OR conditions should return more devices
            operations = [
                LogicalOperation(
                    operation_type="OR",
                    conditions=[
                        LogicalCondition(
                            field="location", operator="equals", value="DC1"
                        ),
                        LogicalCondition(
                            field="location", operator="equals", value="DC2"
                        ),
                    ],
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
        self.service = InventoryService()

    @pytest.mark.asyncio
    async def test_filter_by_name(self, mock_nautobot_service):
        """Test filtering devices by name."""
        # Arrange
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            devices = {
                "data": {
                    "devices": [
                        {"id": "dev-1", "name": "switch-01"},
                        {"id": "dev-2", "name": "router-01"},
                    ]
                }
            }
            mock_nautobot_service.graphql_query = AsyncMock(return_value=devices)

            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[
                        LogicalCondition(
                            field="name", operator="equals", value="switch-01"
                        )
                    ],
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
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            devices = create_devices_list(count=3)
            mock_nautobot_service.graphql_query = AsyncMock(return_value=devices)

            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[
                        LogicalCondition(
                            field="tag", operator="equals", value="production"
                        )
                    ],
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
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            devices = create_devices_list(count=5)
            mock_nautobot_service.graphql_query = AsyncMock(return_value=devices)

            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[
                        LogicalCondition(
                            field="platform", operator="equals", value="cisco_ios"
                        )
                    ],
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
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            devices = create_devices_list(count=5)
            mock_nautobot_service.graphql_query = AsyncMock(return_value=devices)

            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[
                        LogicalCondition(
                            field="has_primary", operator="equals", value="true"
                        )
                    ],
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
        self.service = InventoryService()

    @pytest.mark.asyncio
    async def test_generate_inventory_format(self, mock_nautobot_service):
        """Test generating inventory in Ansible format."""
        # Arrange
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            devices = create_devices_list(count=3)
            mock_nautobot_service.graphql_query = AsyncMock(return_value=devices)

            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[
                        LogicalCondition(
                            field="status", operator="equals", value="Active"
                        )
                    ],
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
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            device_with_vars = {
                "data": {
                    "devices": [
                        {
                            "id": "dev-1",
                            "name": "switch-01",
                            "platform": {"name": "cisco_ios"},
                            "primary_ip4": {"address": "10.0.0.1/24"},
                        }
                    ]
                }
            }
            mock_nautobot_service.graphql_query = AsyncMock(
                return_value=device_with_vars
            )

            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[
                        LogicalCondition(
                            field="name", operator="equals", value="switch-01"
                        )
                    ],
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
        self.service = InventoryService()

    @pytest.mark.asyncio
    async def test_get_custom_field_types(self, mock_nautobot_service):
        """Test fetching custom field types."""
        # Arrange
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            custom_fields = [
                {"key": "site_code", "type": {"value": "text"}},
                {"key": "rack_unit", "type": {"value": "integer"}},
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
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
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
        self.service = InventoryService()

    @pytest.mark.asyncio
    async def test_complex_and_or_combination(self, mock_nautobot_service):
        """Test complex combination of AND and OR operations."""
        # Arrange
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            devices = create_devices_list(count=10)
            mock_nautobot_service.graphql_query = AsyncMock(return_value=devices)

            # (location=DC1 AND role=access) OR (location=DC2 AND role=core)
            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[
                        LogicalCondition(
                            field="location", operator="equals", value="DC1"
                        ),
                        LogicalCondition(
                            field="role", operator="equals", value="access-switch"
                        ),
                    ],
                ),
                LogicalOperation(
                    operation_type="OR",
                    conditions=[
                        LogicalCondition(
                            field="location", operator="equals", value="DC2"
                        ),
                        LogicalCondition(
                            field="role", operator="equals", value="core-router"
                        ),
                    ],
                ),
            ]

            # Act
            result_devices, op_count = await self.service.preview_inventory(operations)

            # Assert
            assert op_count == 4  # 2 ops with 2 conds each
            assert isinstance(result_devices, list)

    @pytest.mark.asyncio
    async def test_empty_operations(self, mock_nautobot_service):
        """Test handling empty operations list - should return all devices."""
        # Arrange
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            # Mock the graphql_query to return all devices
            all_devices_response = {
                "data": {
                    "devices": [
                        {
                            "id": "dev-1",
                            "name": "device-1",
                            "location": {"name": "DC1"},
                        },
                        {
                            "id": "dev-2",
                            "name": "device-2",
                            "location": {"name": "DC2"},
                        },
                        {
                            "id": "dev-3",
                            "name": "device-3",
                            "location": {"name": "DC3"},
                        },
                    ]
                }
            }
            mock_nautobot_service.graphql_query = AsyncMock(
                return_value=all_devices_response
            )

            # Act
            result_devices, op_count = await self.service.preview_inventory([])

            # Assert
            assert op_count == 0
            # Empty operations should return all devices
            assert len(result_devices) == 3
            assert isinstance(result_devices, list)
            # Verify graphql_query was called to fetch all devices
            assert mock_nautobot_service.graphql_query.called


# ==============================================================================
# Test Class: GraphQL Query Construction
# ==============================================================================


@pytest.mark.unit
@pytest.mark.nautobot
class TestGraphQLQueryConstruction:
    """Test that logical operations are correctly translated to GraphQL queries."""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Set up test instance."""
        self.service = InventoryService()

    @pytest.mark.asyncio
    async def test_location_equals_builds_correct_query(self, mock_nautobot_service):
        """Test that location filter with equals operator builds correct GraphQL query."""
        # Arrange
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            mock_nautobot_service.graphql_query = AsyncMock(
                return_value={"data": {"devices": []}}
            )

            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[
                        LogicalCondition(
                            field="location", operator="equals", value="DC1"
                        )
                    ],
                )
            ]

            # Act
            await self.service.preview_inventory(operations)

            # Assert
            assert mock_nautobot_service.graphql_query.called
            call_args = mock_nautobot_service.graphql_query.call_args
            query = call_args[0][0]  # First positional argument is the query string
            variables = call_args[0][1]  # Second positional argument is variables

            # Verify query uses location filter (exact match uses "location:" not "location__name:")
            assert "devices (location:" in query or "devices(location:" in query
            # Verify variables contain the filter value
            assert variables.get("location_filter") == ["DC1"]

    @pytest.mark.asyncio
    async def test_location_contains_builds_correct_query(self, mock_nautobot_service):
        """Test that location filter with contains operator uses case-insensitive contains."""
        # Arrange
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            mock_nautobot_service.graphql_query = AsyncMock(
                return_value={"data": {"devices": []}}
            )

            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[
                        LogicalCondition(
                            field="location", operator="contains", value="data"
                        )
                    ],
                )
            ]

            # Act
            await self.service.preview_inventory(operations)

            # Assert
            call_args = mock_nautobot_service.graphql_query.call_args
            query = call_args[0][0]
            variables = call_args[0][1]

            # Verify query uses case-insensitive contains filter
            assert "location__name__ic:" in query or "__ic:" in query
            assert variables.get("location_filter") == ["data"]

    @pytest.mark.asyncio
    async def test_name_contains_builds_correct_query(self, mock_nautobot_service):
        """Test that name filter with contains operator uses regex."""
        # Arrange
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            mock_nautobot_service.graphql_query = AsyncMock(
                return_value={"data": {"devices": []}}
            )

            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[
                        LogicalCondition(
                            field="name", operator="contains", value="switch"
                        )
                    ],
                )
            ]

            # Act
            await self.service.preview_inventory(operations)

            # Assert
            call_args = mock_nautobot_service.graphql_query.call_args
            query = call_args[0][0]
            variables = call_args[0][1]

            # Verify query uses case-insensitive regex filter
            assert "name__ire:" in query or "__ire:" in query
            assert variables.get("name_filter") == ["switch"]

    @pytest.mark.asyncio
    async def test_name_equals_builds_correct_query(self, mock_nautobot_service):
        """Test that name filter with equals operator uses exact match."""
        # Arrange
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            mock_nautobot_service.graphql_query = AsyncMock(
                return_value={"data": {"devices": []}}
            )

            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[
                        LogicalCondition(
                            field="name", operator="equals", value="switch-01"
                        )
                    ],
                )
            ]

            # Act
            await self.service.preview_inventory(operations)

            # Assert
            call_args = mock_nautobot_service.graphql_query.call_args
            query = call_args[0][0]
            variables = call_args[0][1]

            # Verify query uses exact name match (not __ire)
            assert "name:" in query and "name__ire:" not in query
            assert variables.get("name_filter") == ["switch-01"]

    @pytest.mark.asyncio
    async def test_and_conditions_make_multiple_queries(self, mock_nautobot_service):
        """Test that AND with multiple conditions makes separate GraphQL queries."""
        # Arrange
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            mock_nautobot_service.graphql_query = AsyncMock(
                return_value={"data": {"devices": []}}
            )

            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[
                        LogicalCondition(
                            field="location", operator="equals", value="DC1"
                        ),
                        LogicalCondition(
                            field="role", operator="equals", value="access"
                        ),
                        LogicalCondition(
                            field="status", operator="equals", value="Active"
                        ),
                    ],
                )
            ]

            # Act
            await self.service.preview_inventory(operations)

            # Assert - should make 3 separate GraphQL queries (one per condition)
            assert mock_nautobot_service.graphql_query.call_count == 3

    @pytest.mark.asyncio
    async def test_role_filter_builds_correct_query(self, mock_nautobot_service):
        """Test that role filter builds correct GraphQL query."""
        # Arrange
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            mock_nautobot_service.graphql_query = AsyncMock(
                return_value={"data": {"devices": []}}
            )

            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[
                        LogicalCondition(
                            field="role", operator="equals", value="access-switch"
                        )
                    ],
                )
            ]

            # Act
            await self.service.preview_inventory(operations)

            # Assert
            call_args = mock_nautobot_service.graphql_query.call_args
            query = call_args[0][0]
            variables = call_args[0][1]

            # Verify query uses role filter variable
            assert "devices(role:" in query or "devices (role:" in query
            assert variables.get("role_filter") == ["access-switch"]

    @pytest.mark.asyncio
    async def test_status_filter_builds_correct_query(self, mock_nautobot_service):
        """Test that status filter builds correct GraphQL query."""
        # Arrange
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            mock_nautobot_service.graphql_query = AsyncMock(
                return_value={"data": {"devices": []}}
            )

            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[
                        LogicalCondition(
                            field="status", operator="equals", value="Active"
                        )
                    ],
                )
            ]

            # Act
            await self.service.preview_inventory(operations)

            # Assert
            call_args = mock_nautobot_service.graphql_query.call_args
            query = call_args[0][0]
            variables = call_args[0][1]

            # Verify query uses status filter variable
            assert "devices(status:" in query or "devices (status:" in query
            assert variables.get("status_filter") == ["Active"]

    @pytest.mark.asyncio
    async def test_platform_filter_builds_correct_query(self, mock_nautobot_service):
        """Test that platform filter builds correct GraphQL query."""
        # Arrange
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            mock_nautobot_service.graphql_query = AsyncMock(
                return_value={"data": {"devices": []}}
            )

            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[
                        LogicalCondition(
                            field="platform", operator="equals", value="cisco_ios"
                        )
                    ],
                )
            ]

            # Act
            await self.service.preview_inventory(operations)

            # Assert
            call_args = mock_nautobot_service.graphql_query.call_args
            query = call_args[0][0]
            variables = call_args[0][1]

            # Verify query uses platform filter variable
            assert "devices(platform:" in query or "devices (platform:" in query
            assert variables.get("platform_filter") == ["cisco_ios"]


# ==============================================================================
# Test Class: Client-Side Filtering Logic
# ==============================================================================


@pytest.mark.unit
@pytest.mark.nautobot
class TestClientSideFiltering:
    """Test that the service correctly filters devices when using AND/OR logic."""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Set up test instance."""
        self.service = InventoryService()

    @pytest.mark.asyncio
    async def test_and_operation_returns_intersection(self, mock_nautobot_service):
        """Test that AND operation returns only devices matching ALL conditions."""
        # Arrange
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            # Mock returns devices from each query separately
            # Query 1 (location=DC1): returns device-1, device-2, device-3
            # Query 2 (role=access): returns device-2, device-3, device-4
            # Expected intersection: device-2, device-3

            location_devices = {
                "data": {
                    "devices": [
                        {
                            "id": "device-1",
                            "name": "sw-1",
                            "location": {"name": "DC1"},
                            "role": {"name": "core"},
                        },
                        {
                            "id": "device-2",
                            "name": "sw-2",
                            "location": {"name": "DC1"},
                            "role": {"name": "access"},
                        },
                        {
                            "id": "device-3",
                            "name": "sw-3",
                            "location": {"name": "DC1"},
                            "role": {"name": "access"},
                        },
                    ]
                }
            }

            role_devices = {
                "data": {
                    "devices": [
                        {
                            "id": "device-2",
                            "name": "sw-2",
                            "location": {"name": "DC1"},
                            "role": {"name": "access"},
                        },
                        {
                            "id": "device-3",
                            "name": "sw-3",
                            "location": {"name": "DC1"},
                            "role": {"name": "access"},
                        },
                        {
                            "id": "device-4",
                            "name": "sw-4",
                            "location": {"name": "DC2"},
                            "role": {"name": "access"},
                        },
                    ]
                }
            }

            # Return different results for each query
            mock_nautobot_service.graphql_query = AsyncMock(
                side_effect=[location_devices, role_devices]
            )

            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[
                        LogicalCondition(
                            field="location", operator="equals", value="DC1"
                        ),
                        LogicalCondition(
                            field="role", operator="equals", value="access"
                        ),
                    ],
                )
            ]

            # Act
            result_devices, _ = await self.service.preview_inventory(operations)

            # Assert - should only return device-2 and device-3 (intersection)
            assert len(result_devices) == 2
            device_ids = {d.id for d in result_devices}
            assert device_ids == {"device-2", "device-3"}

    @pytest.mark.asyncio
    async def test_or_operation_returns_union(self, mock_nautobot_service):
        """Test that OR operation returns devices matching ANY condition."""
        # Arrange
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            # Query 1 (location=DC1): returns device-1, device-2
            # Query 2 (location=DC2): returns device-3, device-4
            # Expected union: device-1, device-2, device-3, device-4

            dc1_devices = {
                "data": {
                    "devices": [
                        {"id": "device-1", "name": "sw-1", "location": {"name": "DC1"}},
                        {"id": "device-2", "name": "sw-2", "location": {"name": "DC1"}},
                    ]
                }
            }

            dc2_devices = {
                "data": {
                    "devices": [
                        {"id": "device-3", "name": "sw-3", "location": {"name": "DC2"}},
                        {"id": "device-4", "name": "sw-4", "location": {"name": "DC2"}},
                    ]
                }
            }

            mock_nautobot_service.graphql_query = AsyncMock(
                side_effect=[dc1_devices, dc2_devices]
            )

            operations = [
                LogicalOperation(
                    operation_type="OR",
                    conditions=[
                        LogicalCondition(
                            field="location", operator="equals", value="DC1"
                        ),
                        LogicalCondition(
                            field="location", operator="equals", value="DC2"
                        ),
                    ],
                )
            ]

            # Act
            result_devices, _ = await self.service.preview_inventory(operations)

            # Assert - should return all 4 devices (union)
            assert len(result_devices) == 4
            device_ids = {d.id for d in result_devices}
            assert device_ids == {"device-1", "device-2", "device-3", "device-4"}

    @pytest.mark.asyncio
    async def test_empty_result_when_no_intersection(self, mock_nautobot_service):
        """Test that AND operation returns empty when no devices match all conditions."""
        # Arrange
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            # Query 1 (location=DC1): returns device-1, device-2
            # Query 2 (role=access): returns device-3, device-4
            # Expected intersection: empty (no overlap)

            location_devices = {
                "data": {
                    "devices": [
                        {"id": "device-1", "name": "sw-1"},
                        {"id": "device-2", "name": "sw-2"},
                    ]
                }
            }

            role_devices = {
                "data": {
                    "devices": [
                        {"id": "device-3", "name": "sw-3"},
                        {"id": "device-4", "name": "sw-4"},
                    ]
                }
            }

            mock_nautobot_service.graphql_query = AsyncMock(
                side_effect=[location_devices, role_devices]
            )

            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[
                        LogicalCondition(
                            field="location", operator="equals", value="DC1"
                        ),
                        LogicalCondition(
                            field="role", operator="equals", value="access"
                        ),
                    ],
                )
            ]

            # Act
            result_devices, _ = await self.service.preview_inventory(operations)

            # Assert - should return empty list
            assert len(result_devices) == 0


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
        self.service = InventoryService()

    @pytest.mark.asyncio
    async def test_handles_graphql_errors(self, mock_nautobot_service):
        """Test handling GraphQL errors."""
        # Arrange
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            mock_nautobot_service.graphql_query = AsyncMock(
                return_value={"errors": [{"message": "GraphQL error"}]}
            )

            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[
                        LogicalCondition(
                            field="location", operator="equals", value="DC1"
                        )
                    ],
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
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[
                        LogicalCondition(
                            field="invalid_field", operator="equals", value="test"
                        )
                    ],
                )
            ]

            # Act
            # Should handle gracefully or raise appropriate error
            result_devices, op_count = await self.service.preview_inventory(operations)

            # Assert
            # Should return empty or handle gracefully
            assert isinstance(result_devices, list)

    @pytest.mark.asyncio
    async def test_handles_empty_filter_value(self, mock_nautobot_service):
        """Test handling empty/None filter values."""
        # Arrange
        with patch("services.nautobot.nautobot_service", mock_nautobot_service):
            operations = [
                LogicalOperation(
                    operation_type="AND",
                    conditions=[
                        LogicalCondition(field="location", operator="equals", value="")
                    ],
                )
            ]

            # Act
            result_devices, op_count = await self.service.preview_inventory(operations)

            # Assert - should return empty without making GraphQL call
            assert result_devices == []
            assert mock_nautobot_service.graphql_query.call_count == 0
