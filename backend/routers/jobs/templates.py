"""
Job Templates Router
API endpoints for managing job templates
"""

from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional
from core.auth import verify_token
import rbac_manager
import job_template_manager
from models.job_templates import (
    JobTemplateCreate,
    JobTemplateUpdate,
    JobTemplateResponse,
    JobTemplateListResponse,
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/job-templates", tags=["job-templates"])


@router.post("", response_model=JobTemplateResponse)
async def create_job_template(
    template_data: JobTemplateCreate, current_user: dict = Depends(verify_token)
):
    """
    Create a new job template

    - Global templates require 'jobs:write' permission
    - Private templates can be created by any authenticated user
    """
    try:
        # Check permissions for global templates
        if template_data.is_global:
            has_permission = rbac_manager.has_permission(
                current_user["user_id"], "jobs", "write"
            )
            if not has_permission and current_user.get("role") != "admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Permission denied: jobs:write required for global templates",
                )

        # Create the template
        template = job_template_manager.create_job_template(
            name=template_data.name,
            job_type=template_data.job_type,
            user_id=current_user["user_id"],
            created_by=current_user["username"],
            description=template_data.description,
            config_repository_id=template_data.config_repository_id,
            inventory_source=template_data.inventory_source,
            inventory_repository_id=template_data.inventory_repository_id,
            inventory_name=template_data.inventory_name,
            command_template_name=template_data.command_template_name,
            backup_running_config_path=template_data.backup_running_config_path,
            backup_startup_config_path=template_data.backup_startup_config_path,
            write_timestamp_to_custom_field=template_data.write_timestamp_to_custom_field,
            timestamp_custom_field_name=template_data.timestamp_custom_field_name,
            activate_changes_after_sync=template_data.activate_changes_after_sync,
            scan_resolve_dns=template_data.scan_resolve_dns,
            scan_ping_count=template_data.scan_ping_count,
            scan_timeout_ms=template_data.scan_timeout_ms,
            scan_retries=template_data.scan_retries,
            scan_interval_ms=template_data.scan_interval_ms,
            scan_custom_field_name=template_data.scan_custom_field_name,
            scan_custom_field_value=template_data.scan_custom_field_value,
            scan_response_custom_field_name=template_data.scan_response_custom_field_name,
            scan_set_reachable_ip_active=template_data.scan_set_reachable_ip_active,
            scan_max_ips=template_data.scan_max_ips,
            parallel_tasks=template_data.parallel_tasks,
            deploy_template_id=template_data.deploy_template_id,
            deploy_agent_id=template_data.deploy_agent_id,
            deploy_path=template_data.deploy_path,
            deploy_custom_variables=template_data.deploy_custom_variables,
            activate_after_deploy=template_data.activate_after_deploy,
            deploy_templates=[e.model_dump() for e in template_data.deploy_templates] if template_data.deploy_templates else None,
            is_global=template_data.is_global,
        )

        return JobTemplateResponse(**template)

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating job template: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create job template: {str(e)}",
        )


@router.get("", response_model=JobTemplateListResponse)
async def list_job_templates(
    job_type: Optional[str] = None, current_user: dict = Depends(verify_token)
):
    """
    List all job templates accessible to the current user

    Returns:
    - Global templates (visible to all)
    - User's private templates
    """
    try:
        templates = job_template_manager.get_user_job_templates(
            current_user["user_id"], job_type
        )

        return JobTemplateListResponse(
            templates=[JobTemplateResponse(**t) for t in templates],
            total=len(templates),
        )

    except Exception as e:
        logger.error(f"Error listing job templates: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list job templates: {str(e)}",
        )


@router.get("/types")
async def get_job_types(current_user: dict = Depends(verify_token)):
    """Get available job types"""
    return job_template_manager.get_job_types()


@router.get("/{template_id}", response_model=JobTemplateResponse)
async def get_job_template(
    template_id: int, current_user: dict = Depends(verify_token)
):
    """Get a specific job template by ID"""
    try:
        template = job_template_manager.get_job_template(template_id)

        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Job template not found"
            )

        # Check access - user must own private template or it must be global
        if (
            not template.get("is_global")
            and template.get("user_id") != current_user["user_id"]
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only view your own private templates",
            )

        return JobTemplateResponse(**template)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting job template: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get job template: {str(e)}",
        )


@router.put("/{template_id}", response_model=JobTemplateResponse)
async def update_job_template(
    template_id: int,
    update_data: JobTemplateUpdate,
    current_user: dict = Depends(verify_token),
):
    """Update a job template"""
    try:
        template = job_template_manager.get_job_template(template_id)

        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Job template not found"
            )

        # Check permissions
        if template.get("is_global"):
            has_permission = rbac_manager.has_permission(
                current_user["user_id"], "jobs", "write"
            )
            if not has_permission and current_user.get("role") != "admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Permission denied: jobs:write required for global templates",
                )
        else:
            if template.get("user_id") != current_user["user_id"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You can only edit your own private templates",
                )

        # Update the template
        updated_template = job_template_manager.update_job_template(
            template_id=template_id,
            name=update_data.name,
            description=update_data.description,
            config_repository_id=update_data.config_repository_id,
            inventory_source=update_data.inventory_source,
            inventory_repository_id=update_data.inventory_repository_id,
            inventory_name=update_data.inventory_name,
            command_template_name=update_data.command_template_name,
            backup_running_config_path=update_data.backup_running_config_path,
            backup_startup_config_path=update_data.backup_startup_config_path,
            write_timestamp_to_custom_field=update_data.write_timestamp_to_custom_field,
            timestamp_custom_field_name=update_data.timestamp_custom_field_name,
            activate_changes_after_sync=update_data.activate_changes_after_sync,
            scan_resolve_dns=update_data.scan_resolve_dns,
            scan_ping_count=update_data.scan_ping_count,
            scan_timeout_ms=update_data.scan_timeout_ms,
            scan_retries=update_data.scan_retries,
            scan_interval_ms=update_data.scan_interval_ms,
            scan_custom_field_name=update_data.scan_custom_field_name,
            scan_custom_field_value=update_data.scan_custom_field_value,
            scan_response_custom_field_name=update_data.scan_response_custom_field_name,
            scan_set_reachable_ip_active=update_data.scan_set_reachable_ip_active,
            scan_max_ips=update_data.scan_max_ips,
            parallel_tasks=update_data.parallel_tasks,
            deploy_template_id=update_data.deploy_template_id,
            deploy_agent_id=update_data.deploy_agent_id,
            deploy_path=update_data.deploy_path,
            deploy_custom_variables=update_data.deploy_custom_variables,
            activate_after_deploy=update_data.activate_after_deploy,
            deploy_templates=[e.model_dump() for e in update_data.deploy_templates] if update_data.deploy_templates else None,
            is_global=update_data.is_global,
            user_id=current_user["user_id"],
        )

        if not updated_template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Job template not found"
            )

        return JobTemplateResponse(**updated_template)

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating job template: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update job template: {str(e)}",
        )


@router.delete("/{template_id}")
async def delete_job_template(
    template_id: int, current_user: dict = Depends(verify_token)
):
    """Delete a job template"""
    try:
        template = job_template_manager.get_job_template(template_id)

        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Job template not found"
            )

        # Check permissions
        if template.get("is_global"):
            has_permission = rbac_manager.has_permission(
                current_user["user_id"], "jobs", "write"
            )
            if not has_permission and current_user.get("role") != "admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Permission denied: jobs:write required for global templates",
                )
        else:
            if template.get("user_id") != current_user["user_id"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You can only delete your own private templates",
                )

        deleted = job_template_manager.delete_job_template(template_id)

        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Job template not found"
            )

        return {"message": "Job template deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting job template: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete job template: {str(e)}",
        )
