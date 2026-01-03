"""
Ansible Inventory - Generate and manage Ansible-specific inventory outputs
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response, status

from models.inventory import (
    InventoryGenerateRequest,
    InventoryGenerateResponse,
    LogicalOperation,
)
from core.auth import require_permission
from services.inventory.inventory import inventory_service

router = APIRouter(prefix="/api/ansible-inventory", tags=["ansible-inventory"])

logger = logging.getLogger(__name__)


@router.post("/generate", response_model=InventoryGenerateResponse)
async def generate_inventory(
    request: InventoryGenerateRequest,
    current_user: dict = Depends(require_permission("general.inventory", "write")),
) -> InventoryGenerateResponse:
    """
    Generate final inventory using Jinja2 template.
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
        ) = await inventory_service.generate_inventory(
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
    current_user: dict = Depends(require_permission("general.inventory", "write")),
):
    """
    Generate and download inventory as YAML file.
    """
    try:
        inventory_content, _ = await inventory_service.generate_inventory(
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


@router.get("/git-repositories")
async def get_git_repositories(
    current_user: dict = Depends(require_permission("general.inventory", "read")),
) -> dict:
    """
    Get active Git repositories for inventory operations.
    """
    try:
        from services.settings.git.shared_utils import git_repo_manager

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
    current_user: dict = Depends(require_permission("general.inventory", "write")),
) -> dict:
    """
    Generate inventory, write to Git repository as inventory.yaml, commit and push.
    """
    try:
        from services.settings.git.shared_utils import git_repo_manager
        from services.settings.git.service import git_service
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
        from models.inventory import LogicalOperation

        operation_objects = [LogicalOperation(**op) for op in operations]

        (
            inventory_content,
            device_count,
        ) = await inventory_service.generate_inventory(
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
