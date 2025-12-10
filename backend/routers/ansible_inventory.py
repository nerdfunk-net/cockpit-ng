"""
Ansible Inventory router for building dynamic Ansible inventories.
"""

from __future__ import annotations
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response

from core.auth import require_permission
from models.ansible_inventory import (
    InventoryPreviewRequest,
    InventoryPreviewResponse,
    InventoryGenerateRequest,
    InventoryGenerateResponse,
)
from services.ansible_inventory import ansible_inventory_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/ansible-inventory", tags=["ansible-inventory"])


@router.post("/preview", response_model=InventoryPreviewResponse)
async def preview_inventory(
    request: InventoryPreviewRequest,
    current_user: dict = Depends(require_permission("network.inventory", "read")),
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

        devices, operations_count = await ansible_inventory_service.preview_inventory(
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


@router.post("/generate", response_model=InventoryGenerateResponse)
async def generate_inventory(
    request: InventoryGenerateRequest,
    current_user: dict = Depends(require_permission("network.inventory", "write")),
) -> InventoryGenerateResponse:
    """
    Generate final Ansible inventory using Jinja2 template.
    """
    try:
        if not request.operations:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No logical operations provided",
            )

        if not request.template_name or not request.template_category:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Template name and category are required",
            )

        (
            inventory_content,
            device_count,
        ) = await ansible_inventory_service.generate_inventory(
            request.operations, request.template_name, request.template_category
        )

        return InventoryGenerateResponse(
            inventory_content=inventory_content,
            template_used=f"{request.template_category}/{request.template_name}",
            device_count=device_count,
        )

    except Exception as e:
        logger.error(f"Error generating inventory: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate inventory: {str(e)}",
        )


@router.post("/download")
async def download_inventory(
    request: InventoryGenerateRequest,
    current_user: dict = Depends(require_permission("network.inventory", "write")),
):
    """
    Generate and download Ansible inventory as YAML file.
    """
    try:
        inventory_content, _ = await ansible_inventory_service.generate_inventory(
            request.operations, request.template_name, request.template_category
        )

        # Return as downloadable file
        return Response(
            content=inventory_content,
            media_type="application/x-yaml",
            headers={"Content-Disposition": "attachment; filename=inventory.yaml"},
        )

    except Exception as e:
        logger.error(f"Error downloading inventory: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to download inventory: {str(e)}",
        )


@router.get("/field-options")
async def get_field_options(
    current_user: dict = Depends(require_permission("network.inventory", "read")),
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
                {"value": "tag", "label": "Tag"},
                {"value": "device_type", "label": "Device Type"},
                {"value": "manufacturer", "label": "Manufacturer"},
                {"value": "platform", "label": "Platform"},
                {"value": "custom_fields", "label": "Custom Fields..."},
            ],
            "operators": [
                {"value": "equals", "label": "Equals"},
                {"value": "contains", "label": "Contains"},
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
    current_user: dict = Depends(require_permission("network.inventory", "read")),
) -> dict:
    """
    Get available custom fields for building logical operations.
    """
    try:
        custom_fields = await ansible_inventory_service.get_custom_fields()
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
    current_user: dict = Depends(require_permission("network.inventory", "read")),
) -> dict:
    """
    Get available values for a specific field for dropdown population.
    """
    try:
        field_values = await ansible_inventory_service.get_field_values(field_name)
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


@router.get("/git-repositories")
async def get_git_repositories(
    current_user: dict = Depends(require_permission("network.inventory", "read")),
) -> dict:
    """
    Get active Git repositories for inventory operations.
    """
    try:
        from services.git_shared_utils import git_repo_manager

        repositories = git_repo_manager.get_repositories(active_only=True)

        # Convert to simple list format for dropdown
        repo_list = [
            {
                "id": repo["id"],
                "name": repo["name"],
                "url": repo["url"],
                "branch": repo["branch"],
            }
            for repo in repositories
        ]

        return {"repositories": repo_list, "total": len(repo_list)}

    except Exception as e:
        logger.error(f"Error getting Git repositories: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get Git repositories: {str(e)}",
        )


@router.post("/push-to-git")
async def push_to_git(
    request: dict,
    current_user: dict = Depends(require_permission("network.inventory", "write")),
) -> dict:
    """
    Generate inventory, write to Git repository as inventory.yaml, commit and push.
    """
    try:
        from services.git_shared_utils import git_repo_manager
        from services.git_service import git_service
        from pathlib import Path

        # Validate request
        operations = request.get("operations", [])
        template_name = request.get("template_name")
        template_category = request.get("template_category")
        repo_id = request.get("repository_id")

        if not operations:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No logical operations provided",
            )

        if not template_name or not template_category:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Template name and category are required",
            )

        if not repo_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Git repository ID is required",
            )

        # Get repository configuration
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Git repository with ID {repo_id} not found",
            )

        # Generate inventory content
        logger.info(
            f"Generating inventory for Git push to repository: {repository['name']}"
        )

        # Convert operations to the expected format
        from models.ansible_inventory import LogicalOperation

        operation_objects = [LogicalOperation(**op) for op in operations]

        (
            inventory_content,
            device_count,
        ) = await ansible_inventory_service.generate_inventory(
            operation_objects, template_name, template_category
        )

        # Build commit message from logical operations
        commit_message = build_commit_message(operations, device_count)

        # Open or clone repository using git_service
        logger.info(f"Opening/cloning Git repository: {repository['name']}")
        logger.info(f"  - Auth type: {repository.get('auth_type', 'token')}")
        repo = git_service.open_or_clone(repository)

        # Write inventory to file
        inventory_file = Path(repo.working_dir) / "inventory.yaml"
        logger.info(f"Writing inventory to {inventory_file}")
        inventory_file.write_text(inventory_content)

        # Use git_service for commit and push (supports SSH keys and tokens)
        logger.info(
            f"Committing and pushing to branch: {repository.get('branch', 'main')}"
        )
        result = git_service.commit_and_push(
            repository=repository,
            message=commit_message,
            files=["inventory.yaml"],
            repo=repo,
            branch=repository.get("branch", "main"),
        )

        if not result.success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to commit/push to Git: {result.message}",
            )

        logger.info(
            f"Successfully pushed inventory to Git repository: {repository['name']}"
        )

        return {
            "success": True,
            "message": f"Inventory successfully pushed to {repository['name']}",
            "repository": repository["name"],
            "branch": repository.get("branch", "main"),
            "file": "inventory.yaml",
            "device_count": device_count,
            "commit_message": commit_message,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error pushing inventory to Git: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to push inventory to Git: {str(e)}",
        )


def build_commit_message(operations: list, device_count: int) -> str:
    """
    Build a descriptive commit message based on logical operations.
    """
    if not operations:
        return f"Update inventory ({device_count} devices)"

    # Extract conditions from operations
    conditions = []
    for op in operations:
        op_type = op.get("operation_type", "AND")
        for condition in op.get("conditions", []):
            field = condition.get("field", "")
            operator = condition.get("operator", "equals")
            value = condition.get("value", "")

            if op_type == "NOT":
                conditions.append(f"NOT {field}={value}")
            elif operator == "contains":
                conditions.append(f"{field} contains '{value}'")
            else:
                conditions.append(f"{field}={value}")

    if conditions:
        condition_str = ", ".join(conditions[:3])  # Limit to first 3 conditions
        if len(conditions) > 3:
            condition_str += f", +{len(conditions) - 3} more"
        return f"Update inventory: {condition_str} ({device_count} devices)"

    return f"Update inventory ({device_count} devices)"
