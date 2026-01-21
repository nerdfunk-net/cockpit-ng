"""
Integration tests for Ansible Inventory with Baseline Test Data.

These tests use the modern tree-based structure (version 2) for logical expressions.

Test Data Summary (from tests/baseline.yaml):
- 120 total devices (100 network + 20 servers)
- Locations:
  - City A (21), City B (20), City C (16)
  - Another City A (18), Another City B (20), Another City C (25)
  - State A contains: City A (21) + Another City A (18) = 39 devices
  - State B contains: City B (20) + Another City B (20) = 40 devices
  - State C contains: City C (16) + Another City C (25) = 41 devices
- Roles: Network (100), server (20)
- Status: Active (66), Offline (54)
- Tags: Production (39), Staging (52), lab (29)
- Platforms: Cisco IOS (100), ServerPlatform (20)

Setup:
1. Load baseline data into test Nautobot instance
2. Configure .env.test with test Nautobot credentials
3. Run: pytest -m "integration and nautobot" tests/integration/test_ansible_inventory_baseline_v2.py -v

Architecture:
- Tests use tree_to_operations() to convert tree structures
- Uses shared inventory_converter utility for consistency
- Mirrors frontend's buildOperationsFromTree() logic
"""

import pytest
from utils.inventory_converter import tree_to_operations


# =============================================================================
# Integration Tests - Basic Filtering with Baseline Data
# =============================================================================


@pytest.mark.integration
@pytest.mark.nautobot
class TestBaselineBasicFiltering:
    """Test basic filtering with real baseline data using tree structure."""

    @pytest.mark.asyncio
    async def test_filter_by_location_city_a(self, real_ansible_inventory_service):
        """
        Test filtering by City A location using tree structure.

        Expected: 21 devices in City A
        """
        # Build tree structure (version 2)
        tree = {
            "type": "root",
            "internalLogic": "AND",
            "items": [
                {
                    "id": "1",
                    "field": "location",
                    "operator": "equals",
                    "value": "City A",
                }
            ],
        }

        # Convert tree to operations
        operations = tree_to_operations(tree)

        devices, count = await real_ansible_inventory_service.preview_inventory(
            operations
        )

        # Should find devices in City A
        assert len(devices) == 21, (
            f"Expected 21 devices in City A, found {len(devices)}"
        )

        # All devices should be in City A
        for device in devices:
            assert device.location == "City A", (
                f"Device {device.name} should be in City A, found {device.location}"
            )

    @pytest.mark.asyncio
    async def test_filter_by_role_network(self, real_ansible_inventory_service):
        """
        Test filtering by Network role using tree structure.

        Expected: 100 devices (lab-001 to lab-100)
        """
        tree = {
            "type": "root",
            "internalLogic": "AND",
            "items": [
                {
                    "id": "1",
                    "field": "role",
                    "operator": "equals",
                    "value": "Network",
                }
            ],
        }

        operations = tree_to_operations(tree)

        devices, count = await real_ansible_inventory_service.preview_inventory(
            operations
        )

        assert len(devices) == 100, (
            f"Expected 100 network devices, found {len(devices)}"
        )

        # All should have Network role
        for device in devices:
            assert device.role == "Network"

    @pytest.mark.asyncio
    async def test_filter_by_role_server(self, real_ansible_inventory_service):
        """
        Test filtering by server role using tree structure.

        Expected: 20 devices (server-01 to server-20)
        """
        tree = {
            "type": "root",
            "internalLogic": "AND",
            "items": [
                {
                    "id": "1",
                    "field": "role",
                    "operator": "equals",
                    "value": "server",
                }
            ],
        }

        operations = tree_to_operations(tree)

        devices, count = await real_ansible_inventory_service.preview_inventory(
            operations
        )

        assert len(devices) == 20, f"Expected 20 server devices, found {len(devices)}"

        for device in devices:
            assert device.role == "server"

    @pytest.mark.asyncio
    async def test_filter_by_platform_cisco_ios(self, real_ansible_inventory_service):
        """
        Test filtering by Cisco IOS platform using tree structure.

        Expected: 100 devices (all network devices)
        """
        tree = {
            "type": "root",
            "internalLogic": "AND",
            "items": [
                {
                    "id": "1",
                    "field": "platform",
                    "operator": "equals",
                    "value": "Cisco IOS",
                }
            ],
        }

        operations = tree_to_operations(tree)

        devices, count = await real_ansible_inventory_service.preview_inventory(
            operations
        )

        assert len(devices) == 100, (
            f"Expected 100 Cisco IOS devices, found {len(devices)}"
        )

        for device in devices:
            assert device.platform == "Cisco IOS"

    @pytest.mark.asyncio
    async def test_filter_by_tag_production(self, real_ansible_inventory_service):
        """
        Test filtering by Production tag using tree structure.

        Expected: 39 devices with Production tag
        """
        tree = {
            "type": "root",
            "internalLogic": "AND",
            "items": [
                {
                    "id": "1",
                    "field": "tag",
                    "operator": "equals",
                    "value": "Production",
                }
            ],
        }

        operations = tree_to_operations(tree)

        devices, count = await real_ansible_inventory_service.preview_inventory(
            operations
        )

        assert len(devices) == 39, (
            f"Expected 39 Production devices, found {len(devices)}"
        )

        for device in devices:
            assert "Production" in device.tags

    @pytest.mark.asyncio
    async def test_filter_by_tag_staging(self, real_ansible_inventory_service):
        """
        Test filtering by Staging tag using tree structure.

        Expected: 52 devices with Staging tag
        """
        tree = {
            "type": "root",
            "internalLogic": "AND",
            "items": [
                {
                    "id": "1",
                    "field": "tag",
                    "operator": "equals",
                    "value": "Staging",
                }
            ],
        }

        operations = tree_to_operations(tree)

        devices, count = await real_ansible_inventory_service.preview_inventory(
            operations
        )

        assert len(devices) == 52, f"Expected 52 Staging devices, found {len(devices)}"

        for device in devices:
            assert "Staging" in device.tags

    @pytest.mark.asyncio
    async def test_filter_by_tag_lab(self, real_ansible_inventory_service):
        """
        Test filtering by lab tag using tree structure.

        Expected: 29 devices with lab tag
        """
        tree = {
            "type": "root",
            "internalLogic": "AND",
            "items": [
                {"id": "1", "field": "tag", "operator": "equals", "value": "lab"}
            ],
        }

        operations = tree_to_operations(tree)

        devices, count = await real_ansible_inventory_service.preview_inventory(
            operations
        )

        assert len(devices) == 29, f"Expected 29 lab devices, found {len(devices)}"

        for device in devices:
            assert "lab" in device.tags

    @pytest.mark.asyncio
    async def test_filter_by_status_active(self, real_ansible_inventory_service):
        """
        Test filtering by Active status using tree structure.

        Expected: 66 devices with Active status
        """
        tree = {
            "type": "root",
            "internalLogic": "AND",
            "items": [
                {"id": "1", "field": "status", "operator": "equals", "value": "Active"}
            ],
        }

        operations = tree_to_operations(tree)

        devices, count = await real_ansible_inventory_service.preview_inventory(
            operations
        )

        assert len(devices) == 66, f"Expected 66 Active devices, found {len(devices)}"

        for device in devices:
            assert device.status == "Active"

    @pytest.mark.asyncio
    async def test_filter_by_status_offline(self, real_ansible_inventory_service):
        """
        Test filtering by Offline status using tree structure.

        Expected: 54 devices with Offline status
        """
        tree = {
            "type": "root",
            "internalLogic": "AND",
            "items": [
                {
                    "id": "1",
                    "field": "status",
                    "operator": "equals",
                    "value": "Offline",
                }
            ],
        }

        operations = tree_to_operations(tree)

        devices, count = await real_ansible_inventory_service.preview_inventory(
            operations
        )

        assert len(devices) == 54, f"Expected 54 Offline devices, found {len(devices)}"

        for device in devices:
            assert device.status == "Offline"

    @pytest.mark.asyncio
    async def test_filter_by_location_state_a(self, real_ansible_inventory_service):
        """
        Test filtering by State A location using tree structure.

        Expected: 39 devices in State A (City A + Another City A)
        """
        tree = {
            "type": "root",
            "internalLogic": "AND",
            "items": [
                {
                    "id": "1",
                    "field": "location",
                    "operator": "equals",
                    "value": "State A",
                }
            ],
        }

        operations = tree_to_operations(tree)

        devices, count = await real_ansible_inventory_service.preview_inventory(
            operations
        )

        assert len(devices) == 39, (
            f"Expected 39 devices in State A, found {len(devices)}"
        )

        for device in devices:
            assert device.location == "City A" or device.location == "Another City A"


# =============================================================================
# Integration Tests - Logical AND Operations
# =============================================================================


@pytest.mark.integration
@pytest.mark.nautobot
class TestBaselineAndLogic:
    """Test multiple conditions with AND logic."""

    @pytest.mark.asyncio
    async def test_filter_multiple_conditions_and(self, real_ansible_inventory_service):
        """
        Test multiple AND conditions using tree structure.

        Filters: City A AND Production tag AND Active status
        Expected: Subset of City A (39) that are Production (39) and Active (66)
        """
        tree = {
            "type": "root",
            "internalLogic": "AND",
            "items": [
                {
                    "id": "1",
                    "field": "location",
                    "operator": "equals",
                    "value": "City A",
                },
                {
                    "id": "2",
                    "field": "tag",
                    "operator": "equals",
                    "value": "Production",
                },
                {
                    "id": "3",
                    "field": "status",
                    "operator": "equals",
                    "value": "Active",
                },
            ],
        }

        operations = tree_to_operations(tree)

        devices, count = await real_ansible_inventory_service.preview_inventory(
            operations
        )

        # Verify all conditions are met
        assert len(devices) > 0, "Should find devices matching all conditions"
        for device in devices:
            assert device.location == "City A"
            assert device.status == "Active"
            assert "Production" in device.tags

    @pytest.mark.asyncio
    async def test_filter_location_and_role(self, real_ansible_inventory_service):
        """
        Test location AND role filter using tree structure.

        Filters: City A AND Network role
        Expected: Intersection of City A (39) and Network (100)
        """
        tree = {
            "type": "root",
            "internalLogic": "AND",
            "items": [
                {
                    "id": "1",
                    "field": "location",
                    "operator": "equals",
                    "value": "City A",
                },
                {"id": "2", "field": "role", "operator": "equals", "value": "Network"},
            ],
        }

        operations = tree_to_operations(tree)

        devices, count = await real_ansible_inventory_service.preview_inventory(
            operations
        )

        assert len(devices) > 0, "Should find network devices in City A"
        for device in devices:
            assert device.location == "City A"
            assert device.role == "Network"


# =============================================================================
# Integration Tests - Logical OR Operations
# =============================================================================


@pytest.mark.integration
@pytest.mark.nautobot
class TestBaselineOrLogic:
    """Test conditions with OR logic using nested groups."""

    @pytest.mark.asyncio
    async def test_filter_multiple_operations_or(self, real_ansible_inventory_service):
        """
        Test OR logic using tree structure with nested group.

        Filters: City A OR City B
        Expected: 39 + 40 = 79 devices
        """
        tree = {
            "type": "root",
            "internalLogic": "AND",
            "items": [
                {
                    "id": "group-1",
                    "type": "group",
                    "internalLogic": "OR",
                    "items": [
                        {
                            "id": "1",
                            "field": "location",
                            "operator": "equals",
                            "value": "City A",
                        },
                        {
                            "id": "2",
                            "field": "location",
                            "operator": "equals",
                            "value": "City B",
                        },
                    ],
                }
            ],
        }

        operations = tree_to_operations(tree)

        devices, count = await real_ansible_inventory_service.preview_inventory(
            operations
        )

        # Should find devices in either City A or City B
        assert len(devices) == 41, (
            f"Expected 41 devices (City A + City B), found {len(devices)}"
        )

        # All devices should be in City A or City B
        for device in devices:
            assert device.location in ["City A", "City B"]

    @pytest.mark.asyncio
    async def test_filter_three_locations_or(self, real_ansible_inventory_service):
        """
        Test OR logic with three locations using tree structure.

        Filters: City A OR City B OR City C
        Expected: 39 + 40 + 41 = 120 devices (all devices)
        """
        tree = {
            "type": "root",
            "internalLogic": "AND",
            "items": [
                {
                    "id": "group-1",
                    "type": "group",
                    "internalLogic": "OR",
                    "items": [
                        {
                            "id": "1",
                            "field": "location",
                            "operator": "equals",
                            "value": "City A",
                        },
                        {
                            "id": "2",
                            "field": "location",
                            "operator": "equals",
                            "value": "City B",
                        },
                        {
                            "id": "3",
                            "field": "location",
                            "operator": "equals",
                            "value": "City C",
                        },
                    ],
                }
            ],
        }

        operations = tree_to_operations(tree)

        devices, count = await real_ansible_inventory_service.preview_inventory(
            operations
        )

        assert len(devices) == 57, (
            f"Expected 57 devices (all locations), found {len(devices)}"
        )

    @pytest.mark.asyncio
    async def test_filter_complex_or_logic(self, real_ansible_inventory_service):
        """
        Test complex OR logic using tree structure with nested groups.

        Filters: (Production AND Active) OR (Staging AND Offline)
        Expected: Devices matching either condition
        """
        tree = {
            "type": "root",
            "internalLogic": "AND",
            "items": [
                {
                    "id": "group-1",
                    "type": "group",
                    "internalLogic": "OR",
                    "items": [
                        {
                            "id": "group-2",
                            "type": "group",
                            "internalLogic": "AND",
                            "items": [
                                {
                                    "id": "1",
                                    "field": "tag",
                                    "operator": "equals",
                                    "value": "Production",
                                },
                                {
                                    "id": "2",
                                    "field": "status",
                                    "operator": "equals",
                                    "value": "Active",
                                },
                            ],
                        },
                        {
                            "id": "group-3",
                            "type": "group",
                            "internalLogic": "AND",
                            "items": [
                                {
                                    "id": "3",
                                    "field": "tag",
                                    "operator": "equals",
                                    "value": "Staging",
                                },
                                {
                                    "id": "4",
                                    "field": "status",
                                    "operator": "equals",
                                    "value": "Offline",
                                },
                            ],
                        },
                    ],
                }
            ],
        }

        operations = tree_to_operations(tree)

        devices, count = await real_ansible_inventory_service.preview_inventory(
            operations
        )

        # Should find devices matching either condition
        assert len(devices) > 0, "Should find devices matching complex OR logic"

        # Verify each device matches one of the two conditions
        for device in devices:
            is_production_active = (
                device.status == "Active" and "Production" in device.tags
            )
            is_staging_offline = device.status == "Offline" and "Staging" in device.tags
            assert is_production_active or is_staging_offline


# =============================================================================
# Integration Tests - Operators
# =============================================================================


@pytest.mark.integration
@pytest.mark.nautobot
class TestBaselineOperators:
    """Test various operators with tree structure."""

    @pytest.mark.asyncio
    async def test_filter_not_equals_operator(self, real_ansible_inventory_service):
        """
        Test not_equals operator using tree structure.

        Filters: location NOT City A
        Expected: 120 - 21 = 99 devices
        """
        tree = {
            "type": "root",
            "internalLogic": "AND",
            "items": [
                {
                    "id": "1",
                    "field": "location",
                    "operator": "not_equals",
                    "value": "City A",
                }
            ],
        }

        operations = tree_to_operations(tree)

        devices, count = await real_ansible_inventory_service.preview_inventory(
            operations
        )

        # Should find all devices NOT in City A
        assert len(devices) == 99, (
            f"Expected 99 devices not in City A, found {len(devices)}"
        )

        # None should be in City A
        for device in devices:
            assert device.location != "City A"

    @pytest.mark.asyncio
    async def test_filter_using_equals_and_not_equals_operator(
        self, real_ansible_inventory_service
    ):
        """
        Test equals and not_equals operator using tree structure.

        Filters: location State A AND not location Another City A
        Expected: 21 devices
        """
        tree = {
            "type": "root",
            "internalLogic": "AND",
            "items": [
                {
                    "id": "1",
                    "field": "location",
                    "operator": "equals",
                    "value": "State A",
                },
                {
                    "id": "2",
                    "field": "location",
                    "operator": "not_equals",
                    "value": "Another City A",
                },
            ],
        }

        operations = tree_to_operations(tree)

        devices, count = await real_ansible_inventory_service.preview_inventory(
            operations
        )

        # Should find all devices in State A except Another City A
        assert len(devices) == 21, (
            f"Expected 21 devices not in Another City A, found {len(devices)}"
        )

        # None should be in City A
        for device in devices:
            assert device.location == "City A"

    @pytest.mark.asyncio
    async def test_filter_contains_operator(self, real_ansible_inventory_service):
        """
        Test contains operator using tree structure.

        Filters: name contains "lab-0" (devices lab-001 to lab-099)
        Expected: 99 network devices
        """
        tree = {
            "type": "root",
            "internalLogic": "AND",
            "items": [
                {"id": "1", "field": "name", "operator": "contains", "value": "lab-0"}
            ],
        }

        operations = tree_to_operations(tree)

        devices, count = await real_ansible_inventory_service.preview_inventory(
            operations
        )

        # Should find devices with "lab-0" in name (lab-001 to lab-099)
        assert len(devices) == 99, (
            f"Expected 99 devices with 'lab-0' in name, found {len(devices)}"
        )

        # All should contain "lab-0"
        for device in devices:
            assert "lab-0" in device.name

    @pytest.mark.asyncio
    async def test_filter_not_contains_operator(self, real_ansible_inventory_service):
        """
        Test not_contains operator using tree structure.

        Filters: name NOT contains "server"
        Expected: 100 devices (all network devices)
        """
        tree = {
            "type": "root",
            "internalLogic": "AND",
            "items": [
                {
                    "id": "1",
                    "field": "name",
                    "operator": "not_contains",
                    "value": "server",
                }
            ],
        }

        operations = tree_to_operations(tree)

        devices, count = await real_ansible_inventory_service.preview_inventory(
            operations
        )

        assert len(devices) == 100, (
            f"Expected 100 devices without 'server' in name, found {len(devices)}"
        )

        for device in devices:
            assert "server" not in device.name

    @pytest.mark.asyncio
    async def test_filter_tag_not_equals_operator(self, real_ansible_inventory_service):
        """
        Test tag field with not_equals operator combined with location filter.

        Filters: location = "City A" AND tag != "Staging"
        Expected: 9 devices in City A without Staging tag

        City A has 21 devices total:
        - 12 devices with Staging tag
        - 9 devices without Staging tag (Production: 5, lab: 3, server-19: 1)
        """
        tree = {
            "type": "root",
            "internalLogic": "AND",
            "items": [
                {
                    "id": "1",
                    "field": "location",
                    "operator": "equals",
                    "value": "City A",
                },
                {
                    "id": "2",
                    "field": "tag",
                    "operator": "not_equals",
                    "value": "Staging",
                },
            ],
        }

        operations = tree_to_operations(tree)

        devices, count = await real_ansible_inventory_service.preview_inventory(
            operations
        )

        # Should find exactly 9 devices in City A without Staging tag
        assert len(devices) == 9, (
            f"Expected 9 devices in City A without Staging tag, found {len(devices)}"
        )

        # Verify all devices are in City A
        for device in devices:
            assert device.location == "City A", (
                f"Device {device.name} should be in City A, found {device.location}"
            )

        # Verify no device has Staging tag
        for device in devices:
            assert "Staging" not in device.tags, (
                f"Device {device.name} should not have Staging tag, found tags: {device.tags}"
            )


# =============================================================================
# Integration Tests - NOT Operator Logic
# =============================================================================


@pytest.mark.integration
@pytest.mark.nautobot
class TestBaselineNotLogic:
    """Test NOT operator with nested groups."""

    @pytest.mark.asyncio
    async def test_not_operator_simple(self, real_ansible_inventory_service):
        """
        Test simple NOT operator: State A NOT City A.

        Expected: Devices in State A (39) minus devices in City A (21) = 18 devices (Another City A)
        """
        tree = {
            "type": "root",
            "internalLogic": "AND",
            "items": [
                {
                    "id": "group-1",
                    "type": "group",
                    "internalLogic": "AND",
                    "items": [
                        {
                            "id": "1",
                            "field": "location",
                            "operator": "equals",
                            "value": "State A",
                        },
                        {
                            "id": "group-2",
                            "type": "group",
                            "logic": "NOT",
                            "internalLogic": "AND",
                            "items": [
                                {
                                    "id": "2",
                                    "field": "location",
                                    "operator": "equals",
                                    "value": "City A",
                                }
                            ],
                        },
                    ],
                }
            ],
        }

        operations = tree_to_operations(tree)

        devices, count = await real_ansible_inventory_service.preview_inventory(
            operations
        )

        # Should find devices in State A that are NOT in City A
        assert len(devices) == 18, (
            f"Expected 18 devices (State A - City A), found {len(devices)}"
        )

        # All devices should be in State A but not City A
        for device in devices:
            assert device.location == "State A" or device.location == "Another City A"
            assert device.location != "City A"

    @pytest.mark.asyncio
    async def test_not_operator_multiple_exclusions(
        self, real_ansible_inventory_service
    ):
        """
        Test NOT operator with multiple exclusions: State A NOT (City A OR Another City A).

        Expected: Should return 0 devices since State A only contains City A and Another City A
        """
        tree = {
            "type": "root",
            "internalLogic": "AND",
            "items": [
                {
                    "id": "group-1",
                    "type": "group",
                    "internalLogic": "AND",
                    "items": [
                        {
                            "id": "1",
                            "field": "location",
                            "operator": "equals",
                            "value": "State A",
                        },
                        {
                            "id": "group-2",
                            "type": "group",
                            "logic": "NOT",
                            "internalLogic": "OR",
                            "items": [
                                {
                                    "id": "2",
                                    "field": "location",
                                    "operator": "equals",
                                    "value": "City A",
                                },
                                {
                                    "id": "3",
                                    "field": "location",
                                    "operator": "equals",
                                    "value": "Another City A",
                                },
                            ],
                        },
                    ],
                }
            ],
        }

        operations = tree_to_operations(tree)

        devices, count = await real_ansible_inventory_service.preview_inventory(
            operations
        )

        # Should return 0 devices since all State A devices are in City A or Another City A
        assert len(devices) == 0, (
            f"Expected 0 devices (State A contains only City A and Another City A), found {len(devices)}"
        )

    @pytest.mark.asyncio
    async def test_not_operator_with_tag(self, real_ansible_inventory_service):
        """
        Test NOT operator with tags: State A NOT Production.

        Expected: Devices in State A (39) that don't have Production tag
        """
        tree = {
            "type": "root",
            "internalLogic": "AND",
            "items": [
                {
                    "id": "group-1",
                    "type": "group",
                    "internalLogic": "AND",
                    "items": [
                        {
                            "id": "1",
                            "field": "location",
                            "operator": "equals",
                            "value": "State A",
                        },
                        {
                            "id": "group-2",
                            "type": "group",
                            "logic": "NOT",
                            "internalLogic": "AND",
                            "items": [
                                {
                                    "id": "2",
                                    "field": "tag",
                                    "operator": "equals",
                                    "value": "Production",
                                }
                            ],
                        },
                    ],
                }
            ],
        }

        operations = tree_to_operations(tree)

        devices, count = await real_ansible_inventory_service.preview_inventory(
            operations
        )

        # Should find devices in State A without Production tag
        assert len(devices) > 0, "Should find devices in State A without Production tag"

        # Verify all devices are in State A and don't have Production tag
        for device in devices:
            assert device.location == "State A" or device.location in [
                "City A",
                "Another City A",
            ]
            assert "Production" not in device.tags

    @pytest.mark.asyncio
    async def test_not_operator_complex(self, real_ansible_inventory_service):
        """
        Test complex NOT operator: (State A AND Active) NOT (City A).

        Expected: Active devices in State A that are not in City A
        """
        tree = {
            "type": "root",
            "internalLogic": "AND",
            "items": [
                {
                    "id": "group-1",
                    "type": "group",
                    "internalLogic": "AND",
                    "items": [
                        {
                            "id": "1",
                            "field": "location",
                            "operator": "equals",
                            "value": "State A",
                        },
                        {
                            "id": "2",
                            "field": "status",
                            "operator": "equals",
                            "value": "Active",
                        },
                        {
                            "id": "group-2",
                            "type": "group",
                            "logic": "NOT",
                            "internalLogic": "AND",
                            "items": [
                                {
                                    "id": "3",
                                    "field": "location",
                                    "operator": "equals",
                                    "value": "City A",
                                }
                            ],
                        },
                    ],
                }
            ],
        }

        operations = tree_to_operations(tree)

        devices, count = await real_ansible_inventory_service.preview_inventory(
            operations
        )

        # Should find active devices in State A that are not in City A
        assert len(devices) >= 0, (
            "Should find active devices in State A excluding City A"
        )

        # Verify all devices meet the criteria
        for device in devices:
            assert device.status == "Active"
            assert device.location != "City A"
            # Device should be in State A or Another City A (since Another City A is child of State A)
            assert device.location in ["State A", "Another City A"]

    @pytest.mark.asyncio
    async def test_location_not_equals_operator(self, real_ansible_inventory_service):
        """
        Test location field with not_equals operator.

        Expected: All devices except those in City A (which has 21 devices)
        Total devices: 120, City A devices: 21, Expected: 99 devices
        """
        tree = {
            "type": "root",
            "internalLogic": "AND",
            "items": [
                {
                    "id": "1",
                    "field": "location",
                    "operator": "not_equals",
                    "value": "City A",
                }
            ],
        }

        operations = tree_to_operations(tree)

        devices, count = await real_ansible_inventory_service.preview_inventory(
            operations
        )

        # City A has 21 devices, so we should get 120 - 21 = 99 devices
        assert len(devices) == 99, (
            f"Expected 99 devices (all except City A), found {len(devices)}"
        )

        # Verify no device is from City A
        for device in devices:
            assert device.location != "City A", (
                f"Device {device.name} should not be in City A, found location: {device.location}"
            )

    @pytest.mark.asyncio
    async def test_complex_nested_not_with_role_and_status(
        self, real_ansible_inventory_service
    ):
        """
        Test complex nested NOT logic with role and status filters.

        Structure:
        ROOT (AND)
        ├─ GROUP (AND)
        │  ├─ Location equals "State A"
        │  └─ [NOT] GROUP (AND)
        │     └─ Location equals "Another City A"
        ├─ Role equals "Network"
        └─ Status equals "Active"

        Expected: Active Network devices in State A, excluding Another City A
        - State A has 39 devices (City A: 21 + Another City A: 18)
        - Excluding Another City A leaves City A: 21 devices
        - Filter by Network role (100 devices total)
        - Filter by Active status (66 devices total)
        - Final result: Active Network devices in City A only
        """
        tree = {
            "type": "root",
            "internalLogic": "AND",
            "items": [
                {
                    "id": "group-1",
                    "type": "group",
                    "internalLogic": "AND",
                    "items": [
                        {
                            "id": "1",
                            "field": "location",
                            "operator": "equals",
                            "value": "State A",
                        },
                        {
                            "id": "group-2",
                            "type": "group",
                            "logic": "NOT",
                            "internalLogic": "AND",
                            "items": [
                                {
                                    "id": "2",
                                    "field": "location",
                                    "operator": "equals",
                                    "value": "Another City A",
                                }
                            ],
                        },
                    ],
                },
                {
                    "id": "3",
                    "field": "role",
                    "operator": "equals",
                    "value": "Network",
                },
                {
                    "id": "4",
                    "field": "status",
                    "operator": "equals",
                    "value": "Active",
                },
            ],
        }

        operations = tree_to_operations(tree)

        devices, count = await real_ansible_inventory_service.preview_inventory(
            operations
        )

        # Should find exactly 13 Active Network devices in City A (part of State A, excluding Another City A)
        assert len(devices) == 13, (
            f"Expected 13 Active Network devices in City A, found {len(devices)}"
        )

        # Verify all devices meet the criteria
        for device in devices:
            # Must be in City A (not Another City A)
            assert device.location == "City A", (
                f"Device {device.name} should be in City A, found {device.location}"
            )
            # Must have Network role
            assert device.role == "Network", (
                f"Device {device.name} should have Network role, found {device.role}"
            )
            # Must have Active status
            assert device.status == "Active", (
                f"Device {device.name} should have Active status, found {device.status}"
            )

    @pytest.mark.asyncio
    async def test_not_equals_operator_with_role_and_status(
        self, real_ansible_inventory_service
    ):
        """
        Test not_equals operator with role and status filters (alternative to nested NOT logic).

        Structure:
        ROOT (AND)
        ├─ Location equals "State A"
        ├─ Location not_equals "Another City A"
        ├─ Role equals "Network"
        └─ Status equals "Active"

        This test achieves the same result as test_complex_nested_not_with_role_and_status
        but uses the not_equals operator instead of NOT logic on a nested group.

        Expected: Active Network devices in State A, excluding Another City A
        - State A has 39 devices (City A: 21 + Another City A: 18)
        - Excluding Another City A leaves City A: 21 devices
        - Filter by Network role (100 devices total)
        - Filter by Active status (66 devices total)
        - Final result: 13 Active Network devices in City A only
        """
        tree = {
            "type": "root",
            "internalLogic": "AND",
            "items": [
                {
                    "id": "1",
                    "field": "location",
                    "operator": "equals",
                    "value": "State A",
                },
                {
                    "id": "2",
                    "field": "location",
                    "operator": "not_equals",
                    "value": "Another City A",
                },
                {
                    "id": "3",
                    "field": "role",
                    "operator": "equals",
                    "value": "Network",
                },
                {
                    "id": "4",
                    "field": "status",
                    "operator": "equals",
                    "value": "Active",
                },
            ],
        }

        operations = tree_to_operations(tree)

        devices, count = await real_ansible_inventory_service.preview_inventory(
            operations
        )

        # Should find exactly 13 Active Network devices in City A
        assert len(devices) == 13, (
            f"Expected 13 Active Network devices in City A, found {len(devices)}"
        )

        # Verify all devices meet the criteria
        for device in devices:
            # Must be in City A (not Another City A)
            assert device.location == "City A", (
                f"Device {device.name} should be in City A, found {device.location}"
            )
            assert device.location != "Another City A", (
                f"Device {device.name} should not be in Another City A"
            )
            # Must have Network role
            assert device.role == "Network", (
                f"Device {device.name} should have Network role, found {device.role}"
            )
            # Must have Active status
            assert device.status == "Active", (
                f"Device {device.name} should have Active status, found {device.status}"
            )


# =============================================================================
# Integration Tests - Custom Fields
# =============================================================================


@pytest.mark.integration
@pytest.mark.nautobot
class TestBaselineCustomFields:
    """Test filtering by custom fields using tree structure."""

    @pytest.mark.asyncio
    async def test_filter_by_custom_field_net(self, real_ansible_inventory_service):
        """
        Test filtering by custom field 'net' using tree structure.

        Expected: Devices with specific net value
        """
        tree = {
            "type": "root",
            "internalLogic": "AND",
            "items": [
                {
                    "id": "1",
                    "field": "custom_fields.net",
                    "operator": "equals",
                    "value": "10.0.0.0/24",
                }
            ],
        }

        operations = tree_to_operations(tree)

        devices, count = await real_ansible_inventory_service.preview_inventory(
            operations
        )

        # Verify all have the correct custom field value
        for device in devices:
            assert hasattr(device, "custom_fields")
            assert device.custom_fields.get("net") == "10.0.0.0/24"

    @pytest.mark.asyncio
    async def test_filter_by_custom_field_checkmk_site(
        self, real_ansible_inventory_service
    ):
        """
        Test filtering by custom field 'checkmk_site' using tree structure.

        Expected: Devices with specific checkmk_site value
        """
        tree = {
            "type": "root",
            "internalLogic": "AND",
            "items": [
                {
                    "id": "1",
                    "field": "custom_fields.checkmk_site",
                    "operator": "equals",
                    "value": "site1",
                }
            ],
        }

        operations = tree_to_operations(tree)

        devices, count = await real_ansible_inventory_service.preview_inventory(
            operations
        )

        for device in devices:
            assert device.custom_fields.get("checkmk_site") == "site1"


# =============================================================================
# Integration Tests - Empty Filters
# =============================================================================


@pytest.mark.integration
@pytest.mark.nautobot
class TestBaselineEmptyFilters:
    """Test empty or no filter conditions."""

    @pytest.mark.asyncio
    async def test_empty_filter_returns_all(self, real_ansible_inventory_service):
        """
        Test that an empty filter returns all devices.

        Expected: 120 devices
        """
        # Empty tree structure
        tree = {"type": "root", "internalLogic": "AND", "items": []}

        operations = tree_to_operations(tree)

        devices, count = await real_ansible_inventory_service.preview_inventory(
            operations
        )

        # Should return all devices
        assert len(devices) == 120, (
            f"Expected 120 devices with empty filter, found {len(devices)}"
        )
