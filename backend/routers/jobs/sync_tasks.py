"""
Sync / integration task endpoints.

Covers: Nautobot cache warming, CheckMK device ops (add/update/sync),
device comparison, Nautobot↔CheckMK diff, and agent deployment.
All endpoints are under /api/celery/*.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from core.celery_error_handler import handle_celery_errors
from models.celery import (
    SyncDevicesToCheckmkRequest,
    TaskResponse,
    TaskWithJobResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/celery", tags=["celery-sync-tasks"])


# ============================================================================
# Nautobot cache warming
# ============================================================================


@router.post("/tasks/cache-devices", response_model=TaskResponse)
@handle_celery_errors("trigger cache devices task")
async def trigger_cache_devices(
    current_user: dict = Depends(require_permission("settings.celery", "write")),
):
    """
    Manually trigger the cache_all_devices background task.
    This fetches all devices from Nautobot and caches them in Redis.
    """
    from services.background_jobs.device_cache_jobs import cache_all_devices_task

    task = cache_all_devices_task.delay()
    return TaskResponse(
        task_id=task.id,
        status="queued",
        message=f"Device caching task queued: {task.id}",
    )


@router.post("/tasks/cache-locations", response_model=TaskResponse)
@handle_celery_errors("trigger cache locations task")
async def trigger_cache_locations(
    current_user: dict = Depends(require_permission("settings.celery", "write")),
):
    """
    Manually trigger the cache_all_locations background task.
    This fetches all locations from Nautobot and caches them in Redis.
    """
    from services.background_jobs.location_cache_jobs import cache_all_locations_task

    task = cache_all_locations_task.delay()
    return TaskResponse(
        task_id=task.id,
        status="queued",
        message=f"Location caching task queued: {task.id}",
    )


# ============================================================================
# CheckMK device management
# ============================================================================


@router.post("/tasks/add-device-to-checkmk", response_model=TaskResponse)
@handle_celery_errors("add device to CheckMK")
async def trigger_add_device_to_checkmk(
    device_id: str,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
):
    """
    Manually trigger the add_device_to_checkmk background task.
    This adds a device from Nautobot to CheckMK.

    Query Parameters:
        device_id: Nautobot device ID to add to CheckMK
    """
    from services.background_jobs.checkmk_device_jobs import add_device_to_checkmk_task

    task = add_device_to_checkmk_task.delay(device_id)
    return TaskResponse(
        task_id=task.id,
        status="queued",
        message=f"Add device task queued for device {device_id}: {task.id}",
    )


@router.post("/tasks/update-device-in-checkmk", response_model=TaskResponse)
@handle_celery_errors("update device in CheckMK")
async def trigger_update_device_in_checkmk(
    device_id: str,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
):
    """
    Manually trigger the update_device_in_checkmk background task.
    This syncs/updates a device from Nautobot to CheckMK.

    Query Parameters:
        device_id: Nautobot device ID to update in CheckMK
    """
    from services.background_jobs.checkmk_device_jobs import (
        update_device_in_checkmk_task,
    )

    task = update_device_in_checkmk_task.delay(device_id)
    return TaskResponse(
        task_id=task.id,
        status="queued",
        message=f"Update device task queued for device {device_id}: {task.id}",
    )


@router.post("/tasks/sync-devices-to-checkmk", response_model=TaskWithJobResponse)
@handle_celery_errors("sync devices to CheckMK")
async def trigger_sync_devices_to_checkmk(
    request: SyncDevicesToCheckmkRequest,
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
):
    """
    Manually trigger the sync_devices_to_checkmk background task.
    This syncs multiple devices from Nautobot to CheckMK.

    The task is tracked in the NB2CMK job database and can be viewed in the Jobs/Views app.

    Request Body:
        device_ids: List of Nautobot device IDs to sync
        activate_changes_after_sync: Whether to activate CheckMK changes after sync (default: True)

    Returns:
        TaskWithJobResponse with task_id (for Celery) and job_id (for Jobs/Views tracking)
    """
    from services.background_jobs.checkmk_device_jobs import (
        sync_devices_to_checkmk_task,
    )

    if not request.device_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="device_ids list cannot be empty",
        )

    task = sync_devices_to_checkmk_task.delay(
        request.device_ids, request.activate_changes_after_sync
    )
    job_id = f"sync_devices_{task.id}"

    return TaskWithJobResponse(
        task_id=task.id,
        job_id=job_id,
        status="queued",
        message=f"Sync devices task queued for {len(request.device_ids)} devices: {task.id}",
    )


# ============================================================================
# Nautobot ↔ CheckMK comparison / diff
# ============================================================================


@router.post("/tasks/compare-nautobot-and-checkmk", response_model=TaskResponse)
@handle_celery_errors("compare Nautobot and CheckMK")
async def trigger_compare_nautobot_and_checkmk(
    device_ids: list[str] = None,
    current_user: dict = Depends(require_permission("jobs", "read")),
):
    """
    Compare all devices (or specified devices) between Nautobot and CheckMK.

    This task compares device configurations and stores the results in the job
    database for later retrieval and display in the frontend.

    Request Body (optional):
        device_ids: List of Nautobot device IDs to compare. If empty or null, compares all devices.

    Returns:
        TaskResponse with task_id for tracking progress
    """
    from tasks.scheduling.job_dispatcher import dispatch_job

    task = dispatch_job.delay(
        job_name="Device Comparison (Manual)",
        job_type="compare_devices",
        target_devices=device_ids,
        triggered_by="manual",
        executed_by=current_user.get("username", "unknown"),
    )

    device_count_msg = f"{len(device_ids)} devices" if device_ids else "all devices"
    return TaskResponse(
        task_id=task.id,
        status="queued",
        message=f"Device comparison task queued for {device_count_msg}: {task.id}",
    )


@router.post("/tasks/get-diff-between-nb-checkmk", response_model=TaskResponse)
@handle_celery_errors("get diff between Nautobot and CheckMK")
async def trigger_get_diff_between_nb_checkmk(
    current_user: dict = Depends(require_permission("checkmk.devices", "read")),
):
    """
    Compare device inventories between Nautobot and CheckMK.

    This task fetches all devices from both systems and categorizes them into:
    - all_devices: union of both systems
    - nautobot_only: devices only in Nautobot
    - checkmk_only: devices only in CheckMK

    Returns:
        TaskResponse with task_id for tracking progress
    """
    from services.background_jobs import get_diff_between_nb_checkmk_task

    task = get_diff_between_nb_checkmk_task.delay()
    return TaskResponse(
        task_id=task.id,
        status="queued",
        message=f"Diff task queued: {task.id}",
    )
