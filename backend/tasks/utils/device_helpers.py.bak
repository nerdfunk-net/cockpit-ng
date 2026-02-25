"""
Helper functions for device targeting and filtering.
Moved from job_tasks.py to improve code organization.

This module uses the shared inventory_resolver utility for
converting inventory names to device lists.
"""

import logging
from typing import Optional, List

logger = logging.getLogger(__name__)


def get_target_devices(
    template: dict, job_parameters: Optional[dict] = None
) -> Optional[List]:
    """
    Get target devices based on template's inventory source.

    Uses the shared inventory resolver to convert inventory to device list.

    Args:
        template: Job template configuration
        job_parameters: Additional job parameters

    Returns:
        List of device UUIDs, or None if all devices should be used
    """
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
            from utils.inventory_resolver import resolve_inventory_to_device_ids_sync

            # Note: We need to get the username from the template context
            username = template.get(
                "created_by", "admin"
            )  # Fallback to admin if not specified

            # Use shared inventory resolver (synchronous version for Celery tasks)
            device_ids = resolve_inventory_to_device_ids_sync(inventory_name, username)

            if device_ids is None:
                logger.warning(
                    f"Inventory '{inventory_name}' returned no devices for user '{username}'"
                )
                return None

            logger.info(
                f"Loaded {len(device_ids)} devices from inventory '{inventory_name}'"
            )
            return device_ids

        except Exception as e:
            logger.error(
                f"Error loading inventory '{inventory_name}': {e}", exc_info=True
            )
            return None

    return None
