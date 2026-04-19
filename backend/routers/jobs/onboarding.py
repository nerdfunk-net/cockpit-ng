"""
Device onboarding task endpoints.

Covers: onboard (single), bulk-onboard (parallel batches).
"""

import logging
import math

from fastapi import APIRouter, Depends

import job_run_manager
from core.auth import require_permission
from core.celery_error_handler import handle_celery_errors
from models.celery import (
    BulkOnboardDevicesRequest,
    OnboardDeviceRequest,
    TaskResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/celery", tags=["celery-device-tasks"])


@router.post("/tasks/onboard-device", response_model=TaskResponse)
@handle_celery_errors("onboard device")
async def trigger_onboard_device(
    request: OnboardDeviceRequest,
    current_user: dict = Depends(require_permission("devices.onboard", "execute")),
):
    from tasks.onboard_device_task import onboard_device_task

    task = onboard_device_task.delay(
        ip_address=request.ip_address,
        location_id=request.location_id,
        role_id=request.role_id,
        namespace_id=request.namespace_id,
        status_id=request.status_id,
        interface_status_id=request.interface_status_id,
        ip_address_status_id=request.ip_address_status_id,
        prefix_status_id=request.prefix_status_id,
        secret_groups_id=request.secret_groups_id,
        platform_id=request.platform_id,
        port=request.port,
        timeout=request.timeout,
        onboarding_timeout=request.onboarding_timeout,
        sync_options=request.sync_options,
        tags=request.tags,
        custom_fields=request.custom_fields,
        username=current_user.get("username"),
        user_id=current_user.get("user_id"),
    )

    return TaskResponse(
        task_id=task.id,
        status="queued",
        message=f"Device onboarding task queued for {request.ip_address}: {task.id}",
    )


@router.post("/tasks/bulk-onboard-devices", response_model=TaskResponse)
@handle_celery_errors("bulk onboard devices")
async def trigger_bulk_onboard_devices(
    request: BulkOnboardDevicesRequest,
    current_user: dict = Depends(require_permission("devices.onboard", "execute")),
):
    from tasks.bulk_onboard_task import bulk_onboard_devices_task

    devices_data = [device.model_dump() for device in request.devices]
    device_count = len(devices_data)
    username = current_user.get("username", "unknown")

    if device_count == 0:
        return TaskResponse(
            task_id="",
            status="error",
            message="No devices provided for bulk onboarding",
        )

    parallel_jobs = max(1, min(request.parallel_jobs or 1, device_count))

    if parallel_jobs == 1:
        task = bulk_onboard_devices_task.delay(
            devices=devices_data,
            default_config=request.default_config,
            username=current_user.get("username"),
            user_id=current_user.get("user_id"),
        )

        ip_addresses = [d.get("ip_address", "unknown") for d in devices_data]
        try:
            job_run = job_run_manager.create_job_run(
                job_name=f"Bulk Onboard {device_count} Devices (CSV)",
                job_type="bulk_onboard",
                triggered_by="manual",
                target_devices=ip_addresses,
                executed_by=username,
            )
            job_run_id = job_run.get("id")
            if job_run_id:
                job_run_manager.mark_started(job_run_id, task.id)
                logger.info(
                    "Created job run %s for bulk onboard task %s", job_run_id, task.id
                )
        except Exception as exc:
            logger.warning("Failed to create job run entry: %s", exc)

        return TaskResponse(
            task_id=task.id,
            status="queued",
            message=f"Bulk onboarding task queued for {device_count} devices: {task.id}",
        )

    # Parallel mode – split into batches
    batch_size = math.ceil(device_count / parallel_jobs)
    task_ids = []

    for batch_num in range(parallel_jobs):
        start_idx = batch_num * batch_size
        end_idx = min(start_idx + batch_size, device_count)
        batch_devices = devices_data[start_idx:end_idx]

        if not batch_devices:
            continue

        task = bulk_onboard_devices_task.delay(
            devices=batch_devices,
            default_config=request.default_config,
            username=current_user.get("username"),
            user_id=current_user.get("user_id"),
        )
        task_ids.append(task.id)

        ip_addresses = [d.get("ip_address", "unknown") for d in batch_devices]
        try:
            job_run = job_run_manager.create_job_run(
                job_name=f"Bulk Onboard Batch {batch_num + 1}/{parallel_jobs} ({len(batch_devices)} devices)",
                job_type="bulk_onboard",
                triggered_by="manual",
                target_devices=ip_addresses,
                executed_by=username,
            )
            job_run_id = job_run.get("id")
            if job_run_id:
                job_run_manager.mark_started(job_run_id, task.id)
                logger.info(
                    "Created job run %s for batch %s task %s",
                    job_run_id,
                    batch_num + 1,
                    task.id,
                )
        except Exception as exc:
            logger.warning(
                "Failed to create job run entry for batch %s: %s", batch_num + 1, exc
            )

    return TaskResponse(
        task_id=",".join(task_ids),
        status="queued",
        message=f"Created {len(task_ids)} parallel jobs for {device_count} devices ({batch_size} devices per job)",
    )
