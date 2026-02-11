"""
Shared utility for resolving inventory to device lists.

This module provides a common codebase for converting saved inventory configurations
to actual lists of device IDs. This functionality is used across multiple features:

- API endpoints (POST /api/inventory/resolve-devices)
- Celery tasks (backup, jobs, etc.)
- Job templates and execution
- Any feature that needs to convert inventory → device list

The resolver ensures consistent behavior across all parts of the application.
"""

import logging
import asyncio
from typing import Optional, List

logger = logging.getLogger(__name__)


async def resolve_inventory_to_device_ids(
    inventory_name: str, username: str
) -> Optional[List[str]]:
    """
    Resolve a saved inventory name to a list of device IDs.

    This is the primary function for inventory-to-device conversion across the entire
    application. It handles:
    1. Loading inventory from database by name
    2. Converting tree structure to LogicalOperations
    3. Evaluating operations to get matching devices
    4. Returning device UUIDs

    Args:
        inventory_name: Name of the saved inventory to resolve
        username: Username for inventory access control

    Returns:
        List of device UUIDs, or None if inventory not found or has no matching devices

    Example:
        >>> device_ids = await resolve_inventory_to_device_ids("production-routers", "admin")
        >>> print(f"Found {len(device_ids)} devices")
        Found 42 devices

    Used by:
        - POST /api/inventory/resolve-devices (API endpoint)
        - tasks.utils.device_helpers.get_target_devices() (Celery tasks)
        - Job execution workflows
        - Backup operations
    """
    try:
        from inventory_manager import inventory_manager
        from services.inventory.inventory import inventory_service
        from utils.inventory_converter import convert_saved_inventory_to_operations

        # Load inventory from database by name
        inventory = inventory_manager.get_inventory_by_name(inventory_name, username)

        if not inventory:
            logger.warning(
                f"Inventory '{inventory_name}' not found in database for user '{username}'"
            )
            return None

        # Convert tree structure to LogicalOperations (version 2)
        # Uses shared inventory_converter utility
        operations = convert_saved_inventory_to_operations(inventory["conditions"])

        if not operations:
            logger.warning(f"No valid operations for inventory '{inventory_name}'")
            return None

        # Preview inventory to get matching devices
        devices, _ = await inventory_service.preview_inventory(operations)

        # Extract device IDs (UUIDs)
        device_ids = [device.id for device in devices]

        logger.info(
            f"Resolved {len(device_ids)} devices from inventory '{inventory_name}'"
        )
        return device_ids

    except Exception as e:
        logger.error(
            f"Error resolving inventory '{inventory_name}': {e}", exc_info=True
        )
        return None


def resolve_inventory_to_device_ids_sync(
    inventory_name: str, username: str
) -> Optional[List[str]]:
    """
    Synchronous wrapper for resolve_inventory_to_device_ids().

    This function is specifically for use in Celery tasks and other synchronous contexts
    where you can't directly await async functions.

    Args:
        inventory_name: Name of the saved inventory to resolve
        username: Username for inventory access control

    Returns:
        List of device UUIDs, or None if inventory not found or has no matching devices

    Example:
        >>> # In a Celery task
        >>> device_ids = resolve_inventory_to_device_ids_sync("production-routers", "admin")
        >>> if device_ids:
        >>>     backup_devices(device_ids)

    Note:
        This creates a new event loop for the async operation. This is safe in
        Celery tasks which run in separate processes.
    """
    # Create new event loop for async operations
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        return loop.run_until_complete(
            resolve_inventory_to_device_ids(inventory_name, username)
        )
    finally:
        loop.close()
