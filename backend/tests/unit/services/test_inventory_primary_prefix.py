"""
Unit tests for the inventory "Primary Prefix" filter.

Verifies that _query_devices_by_primary_prefix only returns devices whose
primary IPv4 address falls in the given prefix — i.e. only devices listed
under an ip_addresses entry's primary_ip4_for — and that the evaluator
wires the "primary_prefix" field/operator through correctly.
"""

from unittest.mock import AsyncMock, patch

import pytest

from models.inventory import LogicalCondition
from services.inventory.evaluator import InventoryEvaluator
from services.inventory.query_service import InventoryQueryService


def _graphql_response(ip_addresses):
    return {"data": {"ip_addresses": ip_addresses}}


@pytest.mark.unit
@pytest.mark.nautobot
class TestPrimaryPrefixQuery:
    """Test InventoryQueryService._query_devices_by_primary_prefix."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.query_service = InventoryQueryService()

    @pytest.mark.asyncio
    async def test_only_returns_devices_listed_under_primary_ip4_for(
        self, mock_nautobot_service
    ):
        """An address with an empty primary_ip4_for must not surface a device."""
        with patch(
            "service_factory.build_nautobot_service",
            return_value=mock_nautobot_service,
        ):
            mock_nautobot_service.graphql_query = AsyncMock(
                return_value=_graphql_response(
                    [
                        {
                            "address": "192.168.178.1/24",
                            "primary_ip4_for": [{"id": "dev-1", "name": "lab-001"}],
                        },
                        {
                            # Address is in the prefix but not anyone's primary IP
                            "address": "192.168.178.2/24",
                            "primary_ip4_for": [],
                        },
                        {
                            "address": "192.168.178.3/24",
                            "primary_ip4_for": [{"id": "dev-3", "name": "lab-003"}],
                        },
                    ]
                )
            )

            devices = await self.query_service._query_devices_by_primary_prefix(
                "192.168.178.0/30", "within_include"
            )

            device_ids = {device.id for device in devices}
            assert device_ids == {"dev-1", "dev-3"}

    @pytest.mark.asyncio
    async def test_within_include_operator_maps_to_prefix_graphql_arg(
        self, mock_nautobot_service
    ):
        """ip_addresses(...) only accepts `prefix`, not `within_include`."""
        with patch(
            "service_factory.build_nautobot_service",
            return_value=mock_nautobot_service,
        ):
            mock_nautobot_service.graphql_query = AsyncMock(
                return_value=_graphql_response([])
            )

            await self.query_service._query_devices_by_primary_prefix(
                "10.0.0.0/24", "within_include"
            )

            query_arg = mock_nautobot_service.graphql_query.call_args[0][0]
            assert 'prefix: "10.0.0.0/24"' in query_arg
            assert "within_include:" not in query_arg
            assert "within:" not in query_arg

    @pytest.mark.asyncio
    async def test_empty_prefix_returns_empty_list(self):
        devices = await self.query_service._query_devices_by_primary_prefix(
            "", "within"
        )
        assert devices == []


@pytest.mark.unit
@pytest.mark.nautobot
class TestPrimaryPrefixEvaluator:
    """Test InventoryEvaluator._execute_condition wiring for primary_prefix."""

    @pytest.fixture(autouse=True)
    def setup(self):
        self.evaluator = InventoryEvaluator(InventoryQueryService())

    @pytest.mark.asyncio
    async def test_condition_delegates_to_primary_prefix_query(
        self, mock_nautobot_service
    ):
        with patch(
            "service_factory.build_nautobot_service",
            return_value=mock_nautobot_service,
        ):
            mock_nautobot_service.graphql_query = AsyncMock(
                return_value=_graphql_response(
                    [
                        {
                            "address": "192.168.178.1/24",
                            "primary_ip4_for": [{"id": "dev-1", "name": "lab-001"}],
                        }
                    ]
                )
            )

            condition = LogicalCondition(
                field="primary_prefix",
                operator="within_include",
                value="192.168.178.0/30",
            )

            (
                device_ids,
                op_count,
                devices_dict,
            ) = await self.evaluator._execute_condition(condition)

            assert device_ids == {"dev-1"}
            assert op_count == 1
            assert "dev-1" in devices_dict
