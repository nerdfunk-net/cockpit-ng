"""
Inventory operations router — preview, field options, resolve, and analyze endpoints.

See: doc/refactoring/REFACTORING_INVENTORY.md — Step 2 / Step 4a
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from dependencies import (
    get_inventory_persistence_service,
    get_inventory_service,
    get_device_query_service,
)
from models.inventory import (
    InventoryPreviewRequest,
    InventoryPreviewResponse,
)
from services.inventory.inventory import InventoryService
from services.inventory.persistence_service import InventoryPersistenceService
from services.nautobot.devices.query import DeviceQueryService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/inventory", tags=["inventory"])


@router.post("/preview", response_model=InventoryPreviewResponse)
async def preview_inventory(
    request: InventoryPreviewRequest,
    current_user: dict = Depends(require_permission("general.inventory", "read")),
    inventory_service: InventoryService = Depends(get_inventory_service),
) -> InventoryPreviewResponse:
    """Preview inventory by executing logical operations and returning matching devices."""
    try:
        logger.debug("Preview inventory request received from user: %s", current_user)
        logger.debug("Request operations: %s", request.operations)

        if not request.operations:
            logger.debug("No operations provided, returning empty result")
            return InventoryPreviewResponse(
                devices=[], total_count=0, operations_executed=0
            )

        for i, operation in enumerate(request.operations):
            logger.debug(
                "Operation %s: type=%s, conditions=%s, nested=%s",
                i,
                operation.operation_type,
                len(operation.conditions),
                len(operation.nested_operations),
            )
            for j, condition in enumerate(operation.conditions):
                logger.debug(
                    "  Condition %s: field=%s, operator=%s, value='%s'",
                    j,
                    condition.field,
                    condition.operator,
                    condition.value,
                )

        devices, operations_count = await inventory_service.preview_inventory(
            request.operations
        )

        logger.debug(
            "Preview completed: %s devices found, %s operations executed",
            len(devices),
            operations_count,
        )

        return InventoryPreviewResponse(
            devices=devices,
            total_count=len(devices),
            operations_executed=operations_count,
        )

    except Exception as e:
        logger.error("Error previewing inventory: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to preview inventory: {str(e)}",
        )


@router.get("/field-options")
async def get_field_options(
    current_user: dict = Depends(require_permission("general.inventory", "read")),
) -> dict:
    """Get available field options for building logical operations."""
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
        logger.error("Error getting field options: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get field options: {str(e)}",
        )


@router.get("/custom-fields")
async def get_custom_fields(
    current_user: dict = Depends(require_permission("general.inventory", "read")),
    inventory_service: InventoryService = Depends(get_inventory_service),
) -> dict:
    """Get available custom fields for building logical operations."""
    try:
        custom_fields = await inventory_service.get_custom_fields()
        return {"custom_fields": custom_fields}

    except Exception as e:
        logger.error("Error getting custom fields: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get custom fields: {str(e)}",
        )


@router.get("/field-values/{field_name}")
async def get_field_values(
    field_name: str,
    current_user: dict = Depends(require_permission("general.inventory", "read")),
    inventory_service: InventoryService = Depends(get_inventory_service),
) -> dict:
    """Get available values for a specific field for dropdown population."""
    try:
        field_values = await inventory_service.get_field_values(field_name)
        return {
            "field": field_name,
            "values": field_values,
            "input_type": "select" if field_values else "text",
        }

    except Exception as e:
        logger.error("Error getting field values for '%s': %s", field_name, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get field values: {str(e)}",
        )


@router.get("/resolve-devices/{inventory_id}")
async def resolve_inventory_to_devices(
    inventory_id: int,
    current_user: dict = Depends(require_permission("general.inventory", "read")),
    inventory_service: InventoryService = Depends(get_inventory_service),
    persistence: InventoryPersistenceService = Depends(get_inventory_persistence_service),
) -> dict:
    """Resolve a saved inventory to a list of device IDs by inventory ID."""
    try:
        username = current_user.get("username")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username not found in token",
            )

        from utils.inventory_converter import convert_saved_inventory_to_operations

        logger.info("Resolving inventory ID %s for user '%s'", inventory_id, username)

        inventory = persistence.get_inventory(inventory_id, username=username)

        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inventory with ID {inventory_id} not found",
            )

        conditions = inventory.get("conditions", [])
        if not conditions:
            logger.warning("Inventory %s has no conditions", inventory_id)
            return {
                "device_ids": [],
                "device_count": 0,
                "inventory_id": inventory_id,
                "inventory_name": inventory.get("name", ""),
            }

        operations = convert_saved_inventory_to_operations(conditions)
        devices, _ = await inventory_service.preview_inventory(operations)
        device_ids = [device.id for device in devices]

        logger.info(
            "Resolved %s devices from inventory ID %s", len(device_ids), inventory_id
        )

        return {
            "device_ids": device_ids,
            "device_count": len(device_ids),
            "inventory_id": inventory_id,
            "inventory_name": inventory.get("name", ""),
        }

    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Error resolving inventory '%s': %s", inventory_id, e, exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to resolve inventory: {str(e)}",
        )


@router.get("/resolve-devices/detailed/{inventory_id}")
async def resolve_inventory_to_devices_detailed(
    inventory_id: int,
    current_user: dict = Depends(require_permission("general.inventory", "read")),
    inventory_service: InventoryService = Depends(get_inventory_service),
    device_query_service: DeviceQueryService = Depends(get_device_query_service),
    persistence: InventoryPersistenceService = Depends(get_inventory_persistence_service),
) -> dict:
    """Resolve a saved inventory to detailed device information by inventory ID."""
    try:
        username = current_user.get("username")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username not found in token",
            )

        from utils.inventory_converter import convert_saved_inventory_to_operations

        logger.info(
            "Resolving detailed inventory ID %s for user '%s'", inventory_id, username
        )

        inventory = persistence.get_inventory(inventory_id, username=username)

        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inventory with ID {inventory_id} not found",
            )

        conditions = inventory.get("conditions", [])
        if not conditions:
            logger.warning("Inventory %s has no conditions", inventory_id)
            return {
                "devices": [],
                "device_details": [],
                "device_count": 0,
                "inventory_id": inventory_id,
                "inventory_name": inventory.get("name", ""),
            }

        operations = convert_saved_inventory_to_operations(conditions)
        devices, _ = await inventory_service.preview_inventory(operations)

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
                    "Error fetching details for device %s (%s): %s",
                    device.id,
                    device.name,
                    e,
                )
                continue

        device_list = []
        for detail in device_details:
            device_entry = {
                "id": detail.get("id"),
                "name": detail.get("name"),
            }
            primary_ip4 = detail.get("primary_ip4")
            if primary_ip4 and isinstance(primary_ip4, dict):
                device_entry["primary_ip4"] = primary_ip4.get("address")
            else:
                device_entry["primary_ip4"] = None
            device_list.append(device_entry)

        logger.info(
            "Resolved %s devices with %s detailed entries from inventory ID %s",
            len(device_list),
            len(device_details),
            inventory_id,
        )

        return {
            "devices": device_list,
            "device_details": device_details,
            "device_count": len(device_list),
            "inventory_id": inventory_id,
            "inventory_name": inventory.get("name", ""),
        }

    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Error resolving detailed inventory %s: %s", inventory_id, e, exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to resolve detailed inventory: {str(e)}",
        )


@router.get("/{inventory_id}/analyze")
async def analyze_inventory(
    inventory_id: int,
    current_user: dict = Depends(require_permission("general.inventory", "read")),
    inventory_service: InventoryService = Depends(get_inventory_service),
) -> dict:
    """Analyze inventory to extract distinct values from all devices."""
    try:
        username = current_user.get("username")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username not found in token",
            )

        logger.info("Analyzing inventory ID %s for user '%s'", inventory_id, username)

        result = await inventory_service.analyze_inventory(inventory_id, username)

        return result

    except ValueError as e:
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
        logger.error("Error analyzing inventory %s: %s", inventory_id, e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze inventory: {str(e)}",
        )
