"""
Device backup task endpoints.

Covers: backup-devices, device-backup-status.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from core.celery_error_handler import handle_celery_errors
from models.celery import BackupCheckResponse, BackupDevicesRequest, TaskResponse
from services.jobs.backup_status_service import (
    BackupStatusService,
    get_backup_status_service,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/celery", tags=["celery-device-tasks"])


@router.post("/tasks/backup-devices", response_model=TaskResponse)
@handle_celery_errors("backup devices")
async def trigger_backup_devices(
    request: BackupDevicesRequest,
    current_user: dict = Depends(require_permission("jobs", "write")),
):
    from tasks.backup_tasks import backup_devices_task

    if not request.inventory:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="inventory list cannot be empty",
        )

    if not request.config_repository_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="config_repository_id is required",
        )

    task = backup_devices_task.delay(
        inventory=request.inventory,
        config_repository_id=request.config_repository_id,
        credential_id=request.credential_id,
        write_timestamp_to_custom_field=request.write_timestamp_to_custom_field,
        timestamp_custom_field_name=request.timestamp_custom_field_name,
        parallel_tasks=request.parallel_tasks,
    )

    return TaskResponse(
        task_id=task.id,
        status="queued",
        message=f"Backup task queued for {len(request.inventory)} devices: {task.id}",
    )


@router.get("/device-backup-status", response_model=BackupCheckResponse)
async def check_device_backups(
    force_refresh: bool = False,
    _: dict = Depends(require_permission("jobs", "read")),
    service: BackupStatusService = Depends(get_backup_status_service),
):
    return service.get_backup_status(force_refresh)
