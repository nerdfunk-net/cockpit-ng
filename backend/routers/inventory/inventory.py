"""
Inventory router for building dynamic device inventories.
"""

from __future__ import annotations
import logging
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from models.inventory import (
    InventoryPreviewRequest,
    InventoryPreviewResponse,
)
from services.inventory.inventory import inventory_service
from services.nautobot.devices.query import device_query_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/inventory", tags=["inventory"])


@router.post("/preview", response_model=InventoryPreviewResponse)
async def preview_inventory(
    request: InventoryPreviewRequest,
    current_user: dict = Depends(require_permission("general.inventory", "read")),
) -> InventoryPreviewResponse:
    """
    Preview inventory by executing logical operations and returning matching devices.
    """
    try:
        logger.debug(f"Preview inventory request received from user: {current_user}")
        logger.debug(f"Request operations: {request.operations}")

        if not request.operations:
            logger.debug("No operations provided, returning empty result")
            return InventoryPreviewResponse(
                devices=[], total_count=0, operations_executed=0
            )

        # Log each operation for debugging
        for i, operation in enumerate(request.operations):
            logger.debug(
                f"Operation {i}: type={operation.operation_type}, "
                f"conditions={len(operation.conditions)}, "
                f"nested={len(operation.nested_operations)}"
            )
            for j, condition in enumerate(operation.conditions):
                logger.debug(
                    f"  Condition {j}: field={condition.field}, "
                    f"operator={condition.operator}, value='{condition.value}'"
                )

        devices, operations_count = await inventory_service.preview_inventory(
            request.operations
        )

        logger.debug(
            f"Preview completed: {len(devices)} devices found, {operations_count} operations executed"
        )

        return InventoryPreviewResponse(
            devices=devices,
            total_count=len(devices),
            operations_executed=operations_count,
        )

    except Exception as e:
        logger.error(f"Error previewing inventory: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to preview inventory: {str(e)}",
        )


@router.get("/field-options")
async def get_field_options(
    current_user: dict = Depends(require_permission("general.inventory", "read")),
) -> dict:
    """
    Get available field options for building logical operations.
    """
    try:
        return {
            "fields": [
                {"value": "name", "label": "Device Name"},
                {"value": "location", "label": "Location"},
                {"value": "role", "label": "Role"},
                {"value": "status", "label": "Status"},
                {"value": "tag", "label": "Tag"},
                {"value": "device_type", "label": "Device Type"},
                {"value": "manufacturer", "label": "Manufacturer"},
                {"value": "platform", "label": "Platform"},
                {"value": "has_primary", "label": "Has Primary"},
                {"value": "custom_fields", "label": "Custom Fields..."},
            ],
            "operators": [
                {"value": "equals", "label": "Equals"},
                {"value": "not_equals", "label": "Not Equals"},
                {"value": "contains", "label": "Contains"},
                {"value": "not_contains", "label": "Not Contains"},
            ],
            "logical_operations": [
                {"value": "AND", "label": "AND"},
                {"value": "OR", "label": "OR"},
                {"value": "NOT", "label": "NOT"},
            ],
        }

    except Exception as e:
        logger.error(f"Error getting field options: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get field options: {str(e)}",
        )


@router.get("/custom-fields")
async def get_custom_fields(
    current_user: dict = Depends(require_permission("general.inventory", "read")),
) -> dict:
    """
    Get available custom fields for building logical operations.
    """
    try:
        custom_fields = await inventory_service.get_custom_fields()
        return {"custom_fields": custom_fields}

    except Exception as e:
        logger.error(f"Error getting custom fields: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get custom fields: {str(e)}",
        )


@router.get("/field-values/{field_name}")
async def get_field_values(
    field_name: str,
    current_user: dict = Depends(require_permission("general.inventory", "read")),
) -> dict:
    """
    Get available values for a specific field for dropdown population.
    """
    try:
        field_values = await inventory_service.get_field_values(field_name)
        return {
            "field": field_name,
            "values": field_values,
            "input_type": "select" if field_values else "text",
        }

    except Exception as e:
        logger.error(f"Error getting field values for '{field_name}': {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get field values: {str(e)}",
        )


@router.get("/resolve-devices/{inventory_id}")
async def resolve_inventory_to_devices(
    inventory_id: int,
    current_user: dict = Depends(require_permission("general.inventory", "read")),
) -> dict:
    """
    Resolve a saved inventory to a list of device IDs by inventory ID.

    This endpoint converts an inventory ID to the actual list of matching device IDs.
    Using ID instead of name ensures uniqueness and avoids ambiguity with private inventories.

    This is commonly needed by:
    - Template editor (agent templates with inventory selection)
    - Backup operations (before triggering backup tasks)
    - Job execution (before running jobs against inventory)
    - Any feature that needs to convert inventory → device list

    Args:
        inventory_id: ID of the saved inventory
        current_user: Authenticated user (injected)

    Returns:
        Dict containing:
        - device_ids: List of device UUIDs
        - device_count: Number of matching devices
        - inventory_id: ID of the inventory that was resolved
        - inventory_name: Name of the inventory

    Example:
        GET /api/inventory/resolve-devices/42

        Response:
        {
            "device_ids": ["uuid1", "uuid2", ...],
            "device_count": 3,
            "inventory_id": 42,
            "inventory_name": "production-routers"
        }
    """
    try:
        username = current_user.get("username")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username not found in token",
            )

        # Load inventory by ID
        from inventory_manager import inventory_manager
        from utils.inventory_converter import convert_saved_inventory_to_operations
        from services.inventory.inventory import inventory_service

        logger.info(f"Resolving inventory ID {inventory_id} for user '{username}'")

        inventory = inventory_manager.get_inventory(inventory_id)

        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inventory with ID {inventory_id} not found",
            )

        # Check access control - user can only access their own private inventories
        if (
            inventory.get("scope") == "private"
            and inventory.get("created_by") != username
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied to private inventory {inventory_id}",
            )

        # Convert stored conditions to LogicalOperations
        conditions = inventory.get("conditions", [])
        if not conditions:
            logger.warning(f"Inventory {inventory_id} has no conditions")
            return {
                "device_ids": [],
                "device_count": 0,
                "inventory_id": inventory_id,
                "inventory_name": inventory.get("name", ""),
            }

        operations = convert_saved_inventory_to_operations(conditions)

        # Execute operations to get matching devices
        devices, _ = await inventory_service.preview_inventory(operations)
        device_ids = [device.id for device in devices]

        logger.info(
            f"Resolved {len(device_ids)} devices from inventory ID {inventory_id}"
        )

        return {
            "device_ids": device_ids,
            "device_count": len(device_ids),
            "inventory_id": inventory_id,
            "inventory_name": inventory.get("name", ""),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resolving inventory '{inventory_id}': {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to resolve inventory: {str(e)}",
        )


@router.get("/resolve-devices/detailed/{inventory_id}")
async def resolve_inventory_to_devices_detailed(
    inventory_id: int,
    current_user: dict = Depends(require_permission("general.inventory", "read")),
) -> dict:
    """
    Resolve a saved inventory to detailed device information by inventory ID.

    This endpoint converts an inventory ID to a list of devices with their
    detailed information fetched from Nautobot.

    Args:
        inventory_id: ID of the saved inventory
        current_user: Authenticated user (injected)

    Returns:
        Dict containing:
        - devices: List of dicts with device UUID and name
        - device_details: List of detailed device information
        - device_count: Number of matching devices
        - inventory_id: ID of the inventory that was resolved
        - inventory_name: Name of the inventory

    Example:
        GET /api/inventory/resolve-devices/detailed/42

        Response:
        {
            "devices": [{"id": "uuid1", "name": "device1"}, ...],
            "device_details": [{...}, ...],
            "device_count": 3,
            "inventory_id": 42,
            "inventory_name": "production-routers"
        }
    """
    try:
        username = current_user.get("username")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username not found in token",
            )

        # Load inventory by ID
        from inventory_manager import inventory_manager
        from utils.inventory_converter import convert_saved_inventory_to_operations

        logger.info(
            f"Resolving detailed inventory ID {inventory_id} for user '{username}'"
        )

        inventory = inventory_manager.get_inventory(inventory_id)

        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inventory with ID {inventory_id} not found",
            )

        # Check access control - user can only access their own private inventories
        if (
            inventory.get("scope") == "private"
            and inventory.get("created_by") != username
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied to private inventory {inventory_id}",
            )

        # Convert stored conditions to LogicalOperations
        conditions = inventory.get("conditions", [])
        if not conditions:
            logger.warning(f"Inventory {inventory_id} has no conditions")
            return {
                "devices": [],
                "device_details": [],
                "device_count": 0,
                "inventory_id": inventory_id,
                "inventory_name": inventory.get("name", ""),
            }

        operations = convert_saved_inventory_to_operations(conditions)

        # Execute operations to get matching devices
        devices, _ = await inventory_service.preview_inventory(operations)

        # Fetch detailed information for each device
        device_details = []
        for device in devices:
            try:
                detail = await device_query_service.get_device_details(
                    device_id=device.id,
                    use_cache=True,
                )
                device_details.append(detail)
            except Exception as e:
                logger.error(
                    f"Error fetching details for device {device.id} ({device.name}): {e}"
                )
                # Continue with remaining devices even if one fails
                continue

        # Build simplified device list with UUID, name, and primary IP
        device_list = []
        for detail in device_details:
            device_entry = {
                "id": detail.get("id"),
                "name": detail.get("name"),
            }
            # Add primary_ip4 if available
            primary_ip4 = detail.get("primary_ip4")
            if primary_ip4 and isinstance(primary_ip4, dict):
                device_entry["primary_ip4"] = primary_ip4.get("address")
            else:
                device_entry["primary_ip4"] = None

            device_list.append(device_entry)

        logger.info(
            f"Resolved {len(device_list)} devices with {len(device_details)} "
            f"detailed entries from inventory ID {inventory_id}"
        )

        return {
            "devices": device_list,
            "device_details": device_details,
            "device_count": len(device_list),
            "inventory_id": inventory_id,
            "inventory_name": inventory.get("name", ""),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error resolving detailed inventory {inventory_id}: {e}", exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to resolve detailed inventory: {str(e)}",
        )


@router.get("/{inventory_id}/analyze")
async def analyze_inventory(
    inventory_id: int,
    current_user: dict = Depends(require_permission("general.inventory", "read")),
) -> dict:
    """
    Analyze inventory to extract distinct values from all devices.

    This endpoint loads a saved inventory, retrieves all matching devices,
    fetches detailed information for each device, and extracts distinct
    values for:
    - Locations
    - Tags
    - Custom Fields (returns a dict with field names as keys)
    - Statuses
    - Roles

    Args:
        inventory_id: ID of the saved inventory to analyze
        current_user: Authenticated user (injected)

    Returns:
        Dict containing distinct lists of values for each category:
        {
            "locations": ["Berlin", "Munich"],
            "tags": ["production", "core"],
            "custom_fields": {
                "net": ["net1", "net2"],
                "environment": ["prod", "dev"]
            },
            "statuses": ["active", "planned"],
            "roles": ["router", "switch"],
            "device_count": 10
        }

    Example:
        GET /api/inventory/42/analyze

        Response:
        {
            "locations": ["Berlin", "Munich"],
            "tags": ["production"],
            "custom_fields": {"net": ["net1", "net2"]},
            "statuses": ["active"],
            "roles": ["router"],
            "device_count": 5
        }
    """
    try:
        username = current_user.get("username")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username not found in token",
            )

        logger.info(f"Analyzing inventory ID {inventory_id} for user '{username}'")

        # Call the inventory service to perform analysis
        result = await inventory_service.analyze_inventory(inventory_id, username)

        return result

    except ValueError as e:
        # Handle specific errors from the service
        error_msg = str(e)
        if "not found" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=error_msg,
            )
        elif "Access denied" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=error_msg,
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_msg,
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error analyzing inventory {inventory_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze inventory: {str(e)}",
        )

