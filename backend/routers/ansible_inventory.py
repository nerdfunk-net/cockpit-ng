"""
Ansible Inventory router for building dynamic Ansible inventories.
"""

from __future__ import annotations
import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response

from core.auth import verify_token
from models.ansible_inventory import (
    InventoryPreviewRequest,
    InventoryPreviewResponse,
    InventoryGenerateRequest,
    InventoryGenerateResponse,
    DeviceInfo
)
from services.ansible_inventory import ansible_inventory_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ansible-inventory", tags=["ansible-inventory"])


@router.post("/preview", response_model=InventoryPreviewResponse)
async def preview_inventory(
    request: InventoryPreviewRequest,
    current_user: str = Depends(verify_token)
) -> InventoryPreviewResponse:
    """
    Preview inventory by executing logical operations and returning matching devices.
    """
    try:
        logger.info(f"Preview inventory request received from user: {current_user}")
        logger.info(f"Request operations: {request.operations}")

        if not request.operations:
            logger.info("No operations provided, returning empty result")
            return InventoryPreviewResponse(
                devices=[],
                total_count=0,
                operations_executed=0
            )

        # Log each operation for debugging
        for i, operation in enumerate(request.operations):
            logger.info(f"Operation {i}: type={operation.operation_type}, "
                       f"conditions={len(operation.conditions)}, "
                       f"nested={len(operation.nested_operations)}")
            for j, condition in enumerate(operation.conditions):
                logger.info(f"  Condition {j}: field={condition.field}, "
                           f"operator={condition.operator}, value='{condition.value}'")

        devices, operations_count = await ansible_inventory_service.preview_inventory(request.operations)

        logger.info(f"Preview completed: {len(devices)} devices found, {operations_count} operations executed")

        return InventoryPreviewResponse(
            devices=devices,
            total_count=len(devices),
            operations_executed=operations_count
        )

    except Exception as e:
        logger.error(f"Error previewing inventory: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to preview inventory: {str(e)}"
        )


@router.post("/generate", response_model=InventoryGenerateResponse)
async def generate_inventory(
    request: InventoryGenerateRequest,
    current_user: str = Depends(verify_token)
) -> InventoryGenerateResponse:
    """
    Generate final Ansible inventory using Jinja2 template.
    """
    try:
        if not request.operations:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No logical operations provided"
            )

        if not request.template_name or not request.template_category:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Template name and category are required"
            )

        inventory_content, device_count = await ansible_inventory_service.generate_inventory(
            request.operations,
            request.template_name,
            request.template_category
        )

        return InventoryGenerateResponse(
            inventory_content=inventory_content,
            template_used=f"{request.template_category}/{request.template_name}",
            device_count=device_count
        )

    except Exception as e:
        logger.error(f"Error generating inventory: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate inventory: {str(e)}"
        )


@router.post("/download")
async def download_inventory(
    request: InventoryGenerateRequest,
    current_user: str = Depends(verify_token)
):
    """
    Generate and download Ansible inventory as YAML file.
    """
    try:
        inventory_content, _ = await ansible_inventory_service.generate_inventory(
            request.operations,
            request.template_name,
            request.template_category
        )

        # Return as downloadable file
        return Response(
            content=inventory_content,
            media_type="application/x-yaml",
            headers={"Content-Disposition": "attachment; filename=inventory.yaml"}
        )

    except Exception as e:
        logger.error(f"Error downloading inventory: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to download inventory: {str(e)}"
        )


@router.get("/field-options")
async def get_field_options(current_user: str = Depends(verify_token)) -> dict:
    """
    Get available field options for building logical operations.
    """
    try:
        return {
            "fields": [
                {"value": "name", "label": "Device Name"},
                {"value": "location", "label": "Location"},
                {"value": "role", "label": "Role"},
                {"value": "tag", "label": "Tag"},
                {"value": "device_type", "label": "Device Type"},
                {"value": "manufacturer", "label": "Manufacturer"},
                {"value": "platform", "label": "Platform"},
                {"value": "custom_fields", "label": "Custom Fields..."}
            ],
            "operators": [
                {"value": "equals", "label": "Equals"},
                {"value": "contains", "label": "Contains"}
            ],
            "logical_operations": [
                {"value": "AND", "label": "AND"},
                {"value": "OR", "label": "OR"},
                {"value": "NOT", "label": "NOT"}
            ]
        }

    except Exception as e:
        logger.error(f"Error getting field options: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get field options: {str(e)}"
        )


@router.get("/custom-fields")
async def get_custom_fields(current_user: str = Depends(verify_token)) -> dict:
    """
    Get available custom fields for building logical operations.
    """
    try:
        custom_fields = await ansible_inventory_service.get_custom_fields()
        return {
            "custom_fields": custom_fields
        }

    except Exception as e:
        logger.error(f"Error getting custom fields: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get custom fields: {str(e)}"
        )


@router.get("/field-values/{field_name}")
async def get_field_values(
    field_name: str,
    current_user: str = Depends(verify_token)
) -> dict:
    """
    Get available values for a specific field for dropdown population.
    """
    try:
        field_values = await ansible_inventory_service.get_field_values(field_name)
        return {
            "field": field_name,
            "values": field_values,
            "input_type": "select" if field_values else "text"
        }

    except Exception as e:
        logger.error(f"Error getting field values for '{field_name}': {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get field values: {str(e)}"
        )
