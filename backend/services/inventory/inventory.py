"""
Inventory service — thin orchestration facade for inventory operations.

Responsibility breakdown:
  query_service.py     — Nautobot GraphQL device lookups
  evaluator.py         — logical operation execution (AND/OR/NOT)
  metadata_service.py  — custom-field definitions and per-field value lists
  export_service.py    — template rendering and device analysis
  git_storage_service.py — save/list/load inventories in git repos

See: doc/refactoring/REFACTORING_SERVICES.md — Phase 4
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Set

from models.inventory import DeviceInfo, LogicalOperation

from services.inventory.evaluator import InventoryEvaluator
from services.inventory.export_service import InventoryExportService
from services.inventory.git_storage_service import InventoryGitStorage
from services.inventory.metadata_service import InventoryMetadataService
from services.inventory.query_service import InventoryQueryService

if TYPE_CHECKING:
    from services.inventory.persistence_service import InventoryPersistenceService

logger = logging.getLogger(__name__)


class InventoryService:
    """Thin orchestration facade for Ansible inventory operations."""

    def __init__(self, persistence_service: "InventoryPersistenceService" = None, cache_service=None):
        self.query_service = InventoryQueryService(cache_service=cache_service)
        self.evaluator = InventoryEvaluator(self.query_service)
        self.metadata_service = InventoryMetadataService()
        self.export_service = InventoryExportService()
        self.git_storage = InventoryGitStorage()
        self._persistence_service = persistence_service

    # ------------------------------------------------------------------
    # Backwards-compat delegation (used by tests and a few internal callers)
    # ------------------------------------------------------------------

    async def _get_custom_field_types(self) -> Dict[str, str]:
        return await self.query_service._get_custom_field_types()

    # ------------------------------------------------------------------
    # Core inventory operations
    # ------------------------------------------------------------------

    async def preview_inventory(
        self, operations: List[LogicalOperation]
    ) -> tuple[List[DeviceInfo], int]:
        """
        Execute logical operations against Nautobot and return matching devices.

        Returns:
            Tuple of (devices, operations_count)
        """
        try:
            logger.info("Preview inventory called with %s operations", len(operations))

            if not operations:
                logger.info("No operations provided, returning all devices")
                all_devices = await self.query_service._query_all_devices()
                return all_devices, 0

            result_devices: Set[str] = set()
            all_devices_data: Dict[str, DeviceInfo] = {}
            operations_count = 0

            for i, operation in enumerate(operations):
                logger.info(
                    "Processing operation %s: type=%s, conditions=%s, nested=%s",
                    i,
                    operation.operation_type,
                    len(operation.conditions),
                    len(operation.nested_operations),
                )

                (
                    operation_result,
                    op_count,
                    devices_data,
                ) = await self.evaluator._execute_operation(operation)
                operations_count += op_count
                all_devices_data.update(devices_data)

                logger.info(
                    "Operation %s result: %s devices, %s queries",
                    i,
                    len(operation_result),
                    op_count,
                )

                op_type = operation.operation_type.upper()
                if not result_devices:
                    result_devices = set() if op_type == "NOT" else operation_result
                else:
                    if op_type == "NOT":
                        result_devices = result_devices.difference(operation_result)
                    else:
                        result_devices = result_devices.intersection(operation_result)

                logger.info(
                    "Result set size after operation %s: %s", i, len(result_devices)
                )

            result_list = [
                all_devices_data[device_id]
                for device_id in result_devices
                if device_id in all_devices_data
            ]

            logger.info(
                "Preview completed: %s devices found, %s operations executed",
                len(result_list),
                operations_count,
            )
            return result_list, operations_count

        except Exception as e:
            logger.error("Error previewing inventory: %s", e)
            raise

    async def generate_inventory(
        self,
        operations: List[LogicalOperation],
        template_name: str,
        template_category: str,
    ) -> tuple[str, int]:
        """Generate final Ansible inventory by previewing devices and rendering a template."""
        devices, _ = await self.preview_inventory(operations)
        return await self.export_service.render_inventory(
            devices, template_name, template_category
        )

    async def analyze_inventory(
        self, inventory_id: int, username: str
    ) -> Dict[str, Any]:
        """
        Load a saved inventory, apply access control, and analyse its device set.

        Returns aggregated distinct values for locations, tags, custom fields,
        statuses, and roles.
        """
        try:
            logger.info(
                "Analyzing inventory ID %s for user '%s'", inventory_id, username
            )

            from utils.inventory_converter import convert_saved_inventory_to_operations

            # Use injected persistence service or fall back to factory
            if self._persistence_service is not None:
                persistence = self._persistence_service
            else:
                import service_factory

                persistence = service_factory.build_inventory_persistence_service()

            inventory = persistence.get_inventory(inventory_id, username=username)
            if not inventory:
                raise ValueError(f"Inventory with ID {inventory_id} not found")

            conditions = inventory.get("conditions", [])
            if not conditions:
                logger.warning("Inventory %s has no conditions", inventory_id)
                return {
                    "locations": [],
                    "tags": [],
                    "custom_fields": {},
                    "statuses": [],
                    "roles": [],
                    "device_count": 0,
                }

            operations = convert_saved_inventory_to_operations(conditions)
            devices, _ = await self.preview_inventory(operations)
            logger.info("Found %s devices to analyze", len(devices))
            return await self.export_service.analyze_devices(devices)

        except PermissionError as e:
            raise ValueError(str(e))
        except Exception as e:
            logger.error("Error analyzing inventory: %s", e, exc_info=True)
            raise

    # ------------------------------------------------------------------
    # Metadata delegation
    # ------------------------------------------------------------------

    async def get_custom_fields(self) -> List[Dict[str, Any]]:
        return await self.metadata_service.get_custom_fields()

    async def get_field_values(self, field_name: str) -> List[Dict[str, str]]:
        return await self.metadata_service.get_field_values(field_name)

    # ------------------------------------------------------------------
    # Git-backed inventory persistence delegation
    # ------------------------------------------------------------------

    async def save_inventory(
        self,
        name: str,
        description: Optional[str],
        conditions: List[Any],
        repository_id: int,
    ) -> Dict[str, Any]:
        return await self.git_storage.save_inventory(
            name, description, conditions, repository_id
        )

    async def list_inventories(self, repository_id: int) -> List[Any]:
        return await self.git_storage.list_inventories(repository_id)

    async def load_inventory(self, name: str, repository_id: int) -> Optional[Any]:
        return await self.git_storage.load_inventory(name, repository_id)
