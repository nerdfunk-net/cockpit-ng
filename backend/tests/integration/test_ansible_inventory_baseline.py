"""
Integration tests for Ansible Inventory with Baseline Test Data.

These tests are specifically designed for the baseline data in:
contributing-data/tests_baseline/baseline.yaml

Test Data Summary:
- 120 total devices (100 network + 20 servers)
- Locations: City A (58), City B (62)
- Roles: Network (100), server (20)
- Tags: Production (79), Staging (41)
- Platforms: Cisco IOS (100), ServerPlatform (20)

See tests/BASELINE_TEST_DATA.md for complete details.

Setup:
1. Load baseline data into test Nautobot instance
2. Configure .env.test with test Nautobot credentials
3. Run: pytest -m "integration and nautobot" -v

Skipping:
- Tests auto-skip if .env.test not configured
"""

import pytest
from models.ansible_inventory import LogicalOperation, LogicalCondition


# =============================================================================
# Integration Tests - Basic Filtering with Baseline Data
# =============================================================================

@pytest.mark.integration
@pytest.mark.nautobot
class TestBaselineBasicFiltering:
    """Test basic filtering with real baseline data."""

    @pytest.mark.asyncio
    async def test_filter_by_location_city_a(self, real_ansible_inventory_service):
        """
        Test filtering by City A location.

        Expected: 58 devices (49 network + 9 servers)
        """
        operations = [
            LogicalOperation(
                operation_type="AND",
                conditions=[
                    LogicalCondition(
                        field="location",
                        operator="equals",
                        value="City A"
                    )
                ]
            )
        ]

        devices, count = await real_ansible_inventory_service.preview_inventory(operations)

        # Should find devices in City A
        assert len(devices) == 58, f"Expected 58 devices in City A, found {len(devices)}"

        # All devices should be in City A
        for device in devices:
            # DeviceInfo.location is a string, not an object
            assert device.location == "City A", f"Device {device.name} should be in City A, found {device.location}"

    @pytest.mark.asyncio
    async def test_filter_by_location_city_b(self, real_ansible_inventory_service):
        """
        Test filtering by City B location.

        Expected: 62 devices (51 network + 11 servers)
        """
        operations = [
            LogicalOperation(
                operation_type="AND",
                conditions=[
                    LogicalCondition(
                        field="location",
                        operator="equals",
                        value="City B"
                    )
                ]
            )
        ]

        devices, count = await real_ansible_inventory_service.preview_inventory(operations)

        # Should find devices in City B
        assert len(devices) == 62, f"Expected 62 devices in City B, found {len(devices)}"

    @pytest.mark.asyncio
    async def test_filter_by_role_network(self, real_ansible_inventory_service):
        """
        Test filtering by Network role.

        Expected: 100 devices (lab-01 to lab-100)
        """
        operations = [
            LogicalOperation(
                operation_type="AND",
                conditions=[
                    LogicalCondition(
                        field="role",
                        operator="equals",
                        value="Network"  # Note: capital N
                    )
                ]
            )
        ]

        devices, count = await real_ansible_inventory_service.preview_inventory(operations)

        assert len(devices) == 100, f"Expected 100 network devices, found {len(devices)}"

        # All should have Network role
        for device in devices:
            assert device.role == "Network"

    @pytest.mark.asyncio
    async def test_filter_by_role_server(self, real_ansible_inventory_service):
        """
        Test filtering by server role.

        Expected: 20 devices (server-01 to server-20)
        """
        operations = [
            LogicalOperation(
                operation_type="AND",
                conditions=[
                    LogicalCondition(
                        field="role",
                        operator="equals",
                        value="server"  # lowercase s
                    )
                ]
            )
        ]

        devices, count = await real_ansible_inventory_service.preview_inventory(operations)

        assert len(devices) == 20, f"Expected 20 server devices, found {len(devices)}"

    @pytest.mark.asyncio
    async def test_filter_by_platform_cisco_ios(self, real_ansible_inventory_service):
        """
        Test filtering by Cisco IOS platform.

        Expected: 100 devices (all network devices)
        """
        operations = [
            LogicalOperation(
                operation_type="AND",
                conditions=[
                    LogicalCondition(
                        field="platform",
                        operator="equals",
                        value="Cisco IOS"  # Note: with space
                    )
                ]
            )
        ]

        devices, count = await real_ansible_inventory_service.preview_inventory(operations)

        assert len(devices) == 100, f"Expected 100 Cisco IOS devices, found {len(devices)}"

    @pytest.mark.asyncio
    async def test_filter_by_tag_production(self, real_ansible_inventory_service):
        """
        Test filtering by Production tag.

        Expected: 89 devices (all network lab-01 to lab-79 + all servers 01-10)
        """
        operations = [
            LogicalOperation(
                operation_type="AND",
                conditions=[
                    LogicalCondition(
                        field="tag",
                        operator="equals",
                        value="Production"
                    )
                ]
            )
        ]

        devices, count = await real_ansible_inventory_service.preview_inventory(operations)

        assert len(devices) == 89, f"Expected 89 Production devices, found {len(devices)}"

    @pytest.mark.asyncio
    async def test_filter_by_tag_staging(self, real_ansible_inventory_service):
        """
        Test filtering by Staging tag.

        Expected: 31 devices (lab-80 to lab-100 + server-11 to server-20)
        """
        operations = [
            LogicalOperation(
                operation_type="AND",
                conditions=[
                    LogicalCondition(
                        field="tag",
                        operator="equals",
                        value="Staging"
                    )
                ]
            )
        ]

        devices, count = await real_ansible_inventory_service.preview_inventory(operations)

        assert len(devices) == 31, f"Expected 31 Staging devices, found {len(devices)}"


# =============================================================================
# Integration Tests - Logical AND Operations
# =============================================================================

@pytest.mark.integration
@pytest.mark.nautobot
class TestBaselineLogicalAND:
    """Test AND operations with baseline data."""

    @pytest.mark.asyncio
    async def test_and_city_a_network_role(self, real_ansible_inventory_service):
        """
        Test: City A AND Network role

        Expected: 49 devices (City A + Network + Production)
        """
        operations = [
            LogicalOperation(
                operation_type="AND",
                conditions=[
                    LogicalCondition(field="location", operator="equals", value="City A"),
                    LogicalCondition(field="role", operator="equals", value="Network"),
                ]
            )
        ]

        devices, count = await real_ansible_inventory_service.preview_inventory(operations)

        assert len(devices) == 49, f"Expected 49 devices, found {len(devices)}"
        assert count == 2, "Should have queried 2 conditions"

        # Verify all devices match both conditions
        for device in devices:
            # Check location
            assert device.location == "City A"

            # Check role
            assert device.role == "Network"

    @pytest.mark.asyncio
    async def test_and_city_a_server_role(self, real_ansible_inventory_service):
        """
        Test: City A AND server role

        Expected: 9 devices (server-01 to server-09)
        """
        operations = [
            LogicalOperation(
                operation_type="AND",
                conditions=[
                    LogicalCondition(field="location", operator="equals", value="City A"),
                    LogicalCondition(field="role", operator="equals", value="server"),
                ]
            )
        ]

        devices, count = await real_ansible_inventory_service.preview_inventory(operations)

        assert len(devices) == 9, f"Expected 9 devices, found {len(devices)}"

    @pytest.mark.asyncio
    async def test_and_city_b_production(self, real_ansible_inventory_service):
        """
        Test: City B AND Production tag

        Expected: 31 devices (lab-50 to lab-79: 30 network + server-10: 1 server)
        """
        operations = [
            LogicalOperation(
                operation_type="AND",
                conditions=[
                    LogicalCondition(field="location", operator="equals", value="City B"),
                    LogicalCondition(field="tag", operator="equals", value="Production"),
                ]
            )
        ]

        devices, count = await real_ansible_inventory_service.preview_inventory(operations)

        assert len(devices) == 31, f"Expected 31 devices, found {len(devices)}"

    @pytest.mark.asyncio
    async def test_and_city_b_staging(self, real_ansible_inventory_service):
        """
        Test: City B AND Staging tag

        Expected: 31 devices (lab-80 to lab-100 + server-11 to server-20)
        """
        operations = [
            LogicalOperation(
                operation_type="AND",
                conditions=[
                    LogicalCondition(field="location", operator="equals", value="City B"),
                    LogicalCondition(field="tag", operator="equals", value="Staging"),
                ]
            )
        ]

        devices, count = await real_ansible_inventory_service.preview_inventory(operations)

        assert len(devices) == 31, f"Expected 31 devices, found {len(devices)}"

    @pytest.mark.asyncio
    async def test_and_network_production(self, real_ansible_inventory_service):
        """
        Test: Network role AND Production tag

        Expected: 79 devices (lab-01 to lab-79)
        """
        operations = [
            LogicalOperation(
                operation_type="AND",
                conditions=[
                    LogicalCondition(field="role", operator="equals", value="Network"),
                    LogicalCondition(field="tag", operator="equals", value="Production"),
                ]
            )
        ]

        devices, count = await real_ansible_inventory_service.preview_inventory(operations)

        assert len(devices) == 79, f"Expected 79 devices, found {len(devices)}"

    @pytest.mark.asyncio
    async def test_and_network_staging(self, real_ansible_inventory_service):
        """
        Test: Network role AND Staging tag

        Expected: 21 devices (lab-80 to lab-100)
        """
        operations = [
            LogicalOperation(
                operation_type="AND",
                conditions=[
                    LogicalCondition(field="role", operator="equals", value="Network"),
                    LogicalCondition(field="tag", operator="equals", value="Staging"),
                ]
            )
        ]

        devices, count = await real_ansible_inventory_service.preview_inventory(operations)

        assert len(devices) == 21, f"Expected 21 devices, found {len(devices)}"


# =============================================================================
# Integration Tests - Logical OR Operations
# =============================================================================

@pytest.mark.integration
@pytest.mark.nautobot
class TestBaselineLogicalOR:
    """Test OR operations with baseline data."""

    @pytest.mark.asyncio
    async def test_or_city_a_city_b(self, real_ansible_inventory_service):
        """
        Test: City A OR City B

        Expected: 120 devices (all devices)
        """
        operations = [
            LogicalOperation(
                operation_type="OR",
                conditions=[
                    LogicalCondition(field="location", operator="equals", value="City A"),
                    LogicalCondition(field="location", operator="equals", value="City B"),
                ]
            )
        ]

        devices, count = await real_ansible_inventory_service.preview_inventory(operations)

        assert len(devices) >= 120, f"Expected at least 120 devices, found {len(devices)}"
        assert count == 2, "Should have queried 2 conditions"

    @pytest.mark.asyncio
    async def test_or_production_staging(self, real_ansible_inventory_service):
        """
        Test: Production OR Staging

        Expected: 120 devices (all devices have one of these tags)
        """
        operations = [
            LogicalOperation(
                operation_type="OR",
                conditions=[
                    LogicalCondition(field="tag", operator="equals", value="Production"),
                    LogicalCondition(field="tag", operator="equals", value="Staging"),
                ]
            )
        ]

        devices, count = await real_ansible_inventory_service.preview_inventory(operations)

        assert len(devices) >= 120, f"Expected at least 120 devices, found {len(devices)}"

    @pytest.mark.asyncio
    async def test_or_network_server(self, real_ansible_inventory_service):
        """
        Test: Network role OR server role

        Expected: 120 devices (100 network + 20 servers)
        """
        operations = [
            LogicalOperation(
                operation_type="OR",
                conditions=[
                    LogicalCondition(field="role", operator="equals", value="Network"),
                    LogicalCondition(field="role", operator="equals", value="server"),
                ]
            )
        ]

        devices, count = await real_ansible_inventory_service.preview_inventory(operations)

        assert len(devices) >= 120, f"Expected at least 120 devices, found {len(devices)}"


# =============================================================================
# Integration Tests - String Operators
# =============================================================================

@pytest.mark.integration
@pytest.mark.nautobot
class TestBaselineStringOperators:
    """Test string operators with baseline data."""

    @pytest.mark.asyncio
    async def test_name_contains_lab(self, real_ansible_inventory_service):
        """
        Test: name contains "lab"

        Expected: 100 devices (lab-01 to lab-100)
        """
        operations = [
            LogicalOperation(
                operation_type="AND",
                conditions=[
                    LogicalCondition(field="name", operator="contains", value="lab")
                ]
            )
        ]

        devices, count = await real_ansible_inventory_service.preview_inventory(operations)

        assert len(devices) == 100, f"Expected 100 lab devices, found {len(devices)}"

        # All should contain "lab" in name
        for device in devices:
            assert "lab" in device.name.lower()

    @pytest.mark.asyncio
    async def test_name_contains_server(self, real_ansible_inventory_service):
        """
        Test: name contains "server"

        Expected: 20 devices (server-01 to server-20)
        """
        operations = [
            LogicalOperation(
                operation_type="AND",
                conditions=[
                    LogicalCondition(field="name", operator="contains", value="server")
                ]
            )
        ]

        devices, count = await real_ansible_inventory_service.preview_inventory(operations)

        assert len(devices) == 20, f"Expected 20 server devices, found {len(devices)}"

    @pytest.mark.asyncio
    async def test_name_equals_specific_device(self, real_ansible_inventory_service):
        """
        Test: name equals "lab-01"

        Expected: 1 device
        """
        operations = [
            LogicalOperation(
                operation_type="AND",
                conditions=[
                    LogicalCondition(field="name", operator="equals", value="lab-01")
                ]
            )
        ]

        devices, count = await real_ansible_inventory_service.preview_inventory(operations)

        assert len(devices) == 1, f"Expected 1 device, found {len(devices)}"
        if devices:
            assert devices[0].name == "lab-01"


# =============================================================================
# Integration Tests - Complex Scenarios
# =============================================================================

@pytest.mark.integration
@pytest.mark.nautobot
class TestBaselineComplexScenarios:
    """Test complex multi-condition scenarios."""

    @pytest.mark.asyncio
    async def test_three_way_and(self, real_ansible_inventory_service):
        """
        Test: City A AND Network role AND Production tag

        Expected: 49 devices (City A + Network + Production)
        """
        operations = [
            LogicalOperation(
                operation_type="AND",
                conditions=[
                    LogicalCondition(field="location", operator="equals", value="City A"),
                    LogicalCondition(field="role", operator="equals", value="Network"),
                    LogicalCondition(field="tag", operator="equals", value="Production"),
                ]
            )
        ]

        devices, count = await real_ansible_inventory_service.preview_inventory(operations)

        assert len(devices) == 49, f"Expected 49 devices, found {len(devices)}"
        assert count == 3, "Should have queried 3 conditions"

    @pytest.mark.asyncio
    async def test_mixed_and_or_operations(self, real_ansible_inventory_service):
        """
        Test: Multiple operations with different logic types

        This tests how the service combines multiple LogicalOperation blocks.
        Each operation block is executed separately and results are combined.
        """
        operations = [
            # First operation: City A AND Network  
            LogicalOperation(
                operation_type="AND",
                conditions=[
                    LogicalCondition(field="location", operator="equals", value="City A"),
                    LogicalCondition(field="role", operator="equals", value="Network"),
                ]
            ),
        ]

        devices, count = await real_ansible_inventory_service.preview_inventory(operations)

        # First operation should return City A network devices
        assert len(devices) == 49, f"Expected 49 devices, found {len(devices)}"
        assert count == 2


# =============================================================================
# Integration Tests - Special Filters
# =============================================================================

@pytest.mark.integration
@pytest.mark.nautobot
class TestBaselineSpecialFilters:
    """Test special filters with baseline data."""

    @pytest.mark.asyncio
    async def test_has_primary_ip_true(self, real_ansible_inventory_service):
        """
        Test: has_primary_ip = true

        Expected: 120 devices (all baseline devices have primary IPs)
        """
        operations = [
            LogicalOperation(
                operation_type="AND",
                conditions=[
                    LogicalCondition(field="has_primary", operator="equals", value="true")
                ]
            )
        ]

        devices, count = await real_ansible_inventory_service.preview_inventory(operations)

        assert len(devices) == 120, f"Expected 120 devices with IPs, found {len(devices)}"

    @pytest.mark.asyncio
    async def test_has_primary_ip_false(self, real_ansible_inventory_service):
        """
        Test: has_primary_ip = false

        Expected: 0 devices (all baseline devices have primary IPs)
        """
        operations = [
            LogicalOperation(
                operation_type="AND",
                conditions=[
                    LogicalCondition(field="has_primary", operator="equals", value="false")
                ]
            )
        ]

        devices, count = await real_ansible_inventory_service.preview_inventory(operations)

        assert len(devices) == 0, f"Expected 0 devices without IPs, found {len(devices)}"


# =============================================================================
# Integration Tests - Edge Cases
# =============================================================================

@pytest.mark.integration
@pytest.mark.nautobot
class TestBaselineEdgeCases:
    """Test edge cases with baseline data."""

    @pytest.mark.asyncio
    async def test_nonexistent_location(self, real_ansible_inventory_service):
        """Test filtering by location that doesn't exist."""
        operations = [
            LogicalOperation(
                operation_type="AND",
                conditions=[
                    LogicalCondition(field="location", operator="equals", value="City Z")
                ]
            )
        ]

        devices, count = await real_ansible_inventory_service.preview_inventory(operations)

        assert len(devices) == 0, "Should find no devices in non-existent location"

    @pytest.mark.asyncio
    async def test_contradictory_and_conditions(self, real_ansible_inventory_service):
        """
        Test: location=City A AND location=City B (impossible)

        Expected: 0 devices
        """
        operations = [
            LogicalOperation(
                operation_type="AND",
                conditions=[
                    LogicalCondition(field="location", operator="equals", value="City A"),
                    LogicalCondition(field="location", operator="equals", value="City B"),
                ]
            )
        ]

        devices, count = await real_ansible_inventory_service.preview_inventory(operations)

        assert len(devices) == 0, "Should find no devices matching contradictory conditions"

    @pytest.mark.asyncio
    async def test_empty_operations_list(self, real_ansible_inventory_service):
        """Test with empty operations list."""
        operations = []

        devices, count = await real_ansible_inventory_service.preview_inventory(operations)

        assert devices == []
        assert count == 0
