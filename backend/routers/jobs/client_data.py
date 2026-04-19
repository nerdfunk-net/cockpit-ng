"""
Get client data task endpoint.

Collects ARP table, MAC address table, and DNS hostnames from network devices.
"""

import logging

from fastapi import APIRouter, Depends

import job_run_manager
from core.auth import require_permission
from core.celery_error_handler import handle_celery_errors
from models.celery import GetClientDataRequest, TaskWithJobResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/celery", tags=["celery-device-tasks"])


@router.post("/tasks/get-client-data", response_model=TaskWithJobResponse)
@handle_celery_errors("get client data")
async def trigger_get_client_data(
    request: GetClientDataRequest,
    current_user: dict = Depends(require_permission("devices", "read")),
):
    from tasks.get_client_data_task import get_client_data_task

    username = current_user.get("username", "unknown")
    device_count = len(request.inventory) if request.inventory else 0

    job_run = job_run_manager.create_job_run(
        job_name="Get Client Data",
        job_type="get_client_data",
        triggered_by="manual",
        target_devices=request.inventory or [],
        executed_by=username,
    )
    job_run_id = job_run.get("id") if job_run else None

    task = get_client_data_task.apply_async(
        kwargs=dict(
            schedule_id=None,
            credential_id=request.credential_id,
            job_parameters={
                "collect_ip_address": request.collect_ip_address,
                "collect_mac_address": request.collect_mac_address,
                "collect_hostname": request.collect_hostname,
                "parallel_tasks": request.parallel_tasks,
            },
            target_devices=request.inventory or [],
            template=None,
            job_run_id=job_run_id,
        ),
        queue="network",
    )

    if job_run_id:
        job_run_manager.mark_started(job_run_id, task.id)

    target_desc = f"{device_count} devices" if device_count else "all devices"
    return TaskWithJobResponse(
        task_id=task.id,
        job_id=str(job_run_id) if job_run_id else None,
        status="queued",
        message=f"Get Client Data task queued for {target_desc}",
    )
