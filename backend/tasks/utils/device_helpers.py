"""
Helper functions for device targeting and filtering.
Moved from job_tasks.py to improve code organization.

This module uses the shared inventory_converter utility for
evaluating tree-based logical expressions (version 2).
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

    Uses the shared inventory converter to evaluate tree-based
    logical expressions from saved inventories.

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
        # Get devices from stored inventory (database)
        inventory_name = template.get("inventory_name")

        if not inventory_name:
            logger.warning("Inventory source selected but no inventory name provided")
            return None

        try:
            from inventory_manager import inventory_manager
            from services.network.automation.ansible_inventory import ansible_inventory_service

            # Load inventory from database by name
            # Note: We need to get the username from the template context
            username = template.get(
                "created_by", "admin"
            )  # Fallback to admin if not specified

            inventory = inventory_manager.get_inventory_by_name(
                inventory_name, username
            )

            if not inventory:
                logger.warning(
                    f"Inventory '{inventory_name}' not found in database for user '{username}'"
                )
                return None

            # Create new event loop for async operations
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            try:
                # Convert tree structure to LogicalOperations (version 2)
                # Uses shared inventory_converter utility
                operations = convert_conditions_to_operations(inventory["conditions"])

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
