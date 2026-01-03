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
