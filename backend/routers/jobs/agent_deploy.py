"""
Agent deployment task endpoint.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from core.celery_error_handler import handle_celery_errors
from models.celery import DeployAgentRequest, TaskResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/celery", tags=["celery-device-tasks"])


@router.post("/tasks/deploy-agent", response_model=TaskResponse)
@handle_celery_errors("deploy agent")
async def trigger_deploy_agent(
    request: DeployAgentRequest,
    current_user: dict = Depends(require_permission("network.templates", "write")),
):
    from tasks.agent_deploy_tasks import deploy_agent_task

    if not request.template_id and not request.template_entries:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either template_id or template_entries is required",
        )

    if not request.agent_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="agent_id is required",
        )

    activate_after_deploy = request.activate_after_deploy
    if activate_after_deploy is None:
        activate_after_deploy = True

    task_kwargs = {
        "agent_id": request.agent_id,
        "activate_after_deploy": activate_after_deploy,
    }

    if request.template_entries:
        task_kwargs["template_entries"] = [
            e.model_dump() for e in request.template_entries
        ]
        task_description = f"{len(request.template_entries)} templates"
    else:
        task_kwargs["template_id"] = request.template_id
        task_kwargs["custom_variables"] = request.custom_variables or {}
        task_kwargs["path"] = request.path
        task_kwargs["inventory_id"] = request.inventory_id
        task_description = f"template {request.template_id}"

    task = deploy_agent_task.delay(**task_kwargs)

    return TaskResponse(
        task_id=task.id,
        status="queued",
        message=f"Agent deployment task queued for {task_description}: {task.id}",
    )
