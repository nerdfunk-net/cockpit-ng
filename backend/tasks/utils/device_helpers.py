"""
Helper functions for device targeting and filtering.
Moved from job_tasks.py to improve code organization.
"""

import logging
from typing import Optional, List
import asyncio

logger = logging.getLogger(__name__)


def get_target_devices(
    template: dict, job_parameters: Optional[dict] = None
) -> Optional[List]:
    """
    Get target devices based on template's inventory source.

    Args:
        template: Job template configuration
        job_parameters: Additional job parameters

    Returns:
        List of device UUIDs, or None if all devices should be used
    """
    from .condition_helpers import convert_conditions_to_operations

    inventory_source = template.get("inventory_source", "all")

    if inventory_source == "all":
        # Return None to indicate all devices
        return None
    elif inventory_source == "inventory":
        # Get devices from stored inventory
        inventory_name = template.get("inventory_name")
        inventory_repo_id = template.get("inventory_repository_id")

        if not inventory_name or not inventory_repo_id:
            logger.warning(
                "Inventory source selected but no inventory name or repository ID provided"
            )
            return None

        try:
            from services.ansible_inventory import ansible_inventory_service

            # Create new event loop for async operations
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            try:
                # Load the saved inventory from git repository
                saved_inventory = loop.run_until_complete(
                    ansible_inventory_service.load_inventory(
                        inventory_name, inventory_repo_id
                    )
                )

                if not saved_inventory:
                    logger.warning(
                        f"Inventory '{inventory_name}' not found in repository {inventory_repo_id}"
                    )
                    return None

                # Convert SavedInventoryConditions to LogicalOperations
                operations = convert_conditions_to_operations(
                    saved_inventory.conditions
                )

                if not operations:
                    logger.warning(
                        f"No valid operations for inventory '{inventory_name}'"
                    )
                    return None

                # Preview inventory to get matching devices
                devices, _ = loop.run_until_complete(
                    ansible_inventory_service.preview_inventory(operations)
                )

                # Extract device IDs (UUIDs)
                device_ids = [device.id for device in devices]

                logger.info(
                    f"Loaded {len(device_ids)} devices from inventory '{inventory_name}'"
                )
                return device_ids

            finally:
                loop.close()

        except Exception as e:
            logger.error(
                f"Error loading inventory '{inventory_name}': {e}", exc_info=True
            )
            return None

    return None
