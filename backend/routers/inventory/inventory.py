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


@router.post("/resolve-devices")
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
        POST /api/inventory/resolve-devices?inventory_id=42

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

        if not inventory_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="inventory_id is required",
            )

        # Load inventory by ID
        from inventory_manager import inventory_manager
        from utils.inventory_converter import convert_saved_inventory_to_operations
        from services.inventory.inventory import inventory_service

        logger.info(
            f"Resolving inventory ID {inventory_id} for user '{username}'"
        )

        inventory = inventory_manager.get_inventory(inventory_id)

        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inventory with ID {inventory_id} not found",
            )

        # Check access control - user can only access their own private inventories
        if inventory.get("scope") == "private" and inventory.get("created_by") != username:
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
        logger.error(
            f"Error resolving inventory '{inventory_name}': {e}", exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to resolve inventory: {str(e)}",
        )
