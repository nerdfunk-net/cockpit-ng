"""
Celery infrastructure management endpoints.

Covers: task status/cancel, workers, queues, schedules, beat status,
system status, configuration (read-only), settings CRUD, and cleanup.
All endpoints are under /api/celery/*.
"""

import logging
import os

from celery.result import AsyncResult
from fastapi import APIRouter, Depends, HTTPException, status

from celery_app import celery_app
from core.auth import require_permission, verify_token
from core.celery_error_handler import handle_celery_errors
from models.celery import (
    CelerySettingsRequest,
    ProgressTaskRequest,
    TaskResponse,
    TaskStatusResponse,
    TestTaskRequest,
)
from services.celery import (
    get_beat_status,
    get_cleanup_stats,
    get_queue_metrics,
    is_redis_connected,
    purge_all_queues,
    purge_queue,
)
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/celery", tags=["celery"])


# ============================================================================
# Test endpoints
# ============================================================================


@router.post("/test", response_model=TaskResponse)
@handle_celery_errors("submit test task")
async def submit_test_task(
    request: TestTaskRequest,
    _: dict = Depends(verify_token),
):
    """Submit a test task to verify Celery is working. Requires authentication."""
    from tasks import test_tasks

    task = test_tasks.test_task.delay(message=request.message)
    return TaskResponse(
        task_id=task.id, status="queued", message=f"Test task submitted: {task.id}"
    )


@router.post("/test/progress", response_model=TaskResponse)
@handle_celery_errors("submit progress test task")
async def submit_progress_test_task(
    request: ProgressTaskRequest,
    _: dict = Depends(verify_token),
):
    """Submit a test task that reports progress. Requires authentication."""
    from tasks import test_tasks

    task = test_tasks.test_progress_task.delay(duration=request.duration)
    return TaskResponse(
        task_id=task.id,
        status="queued",
        message=f"Progress test task submitted: {task.id}",
    )


# ============================================================================
# Task status & management
# ============================================================================


@router.get("/tasks/{task_id}", response_model=TaskStatusResponse)
@handle_celery_errors("get task status")
async def get_task_status(
    task_id: str,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """
    Get the status and result of a Celery task.

    Status can be: PENDING, STARTED, PROGRESS, SUCCESS, FAILURE, RETRY, REVOKED
    """
    result = AsyncResult(task_id, app=celery_app)
    response = TaskStatusResponse(task_id=task_id, status=result.state)

    if result.state == "PENDING":
        response.progress = {"status": "Task is queued and waiting to start"}
    elif result.state == "PROGRESS":
        response.progress = result.info
    elif result.state == "SUCCESS":
        response.result = result.result
    elif result.state == "FAILURE":
        response.error = str(result.info)

    return response


@router.delete("/tasks/{task_id}")
@handle_celery_errors("cancel task")
async def cancel_task(
    task_id: str,
    current_user: dict = Depends(require_permission("settings.celery", "write")),
):
    """Cancel a running or queued task."""
    result = AsyncResult(task_id, app=celery_app)
    result.revoke(terminate=True)
    return {"success": True, "message": f"Task {task_id} cancelled"}


# ============================================================================
# Worker monitoring
# ============================================================================


@router.get("/workers")
@handle_celery_errors("list workers")
async def list_workers(
    current_user: dict = Depends(require_permission("settings.celery", "read")),
):
    """List active Celery workers and their status, including queue assignments."""
    inspect = celery_app.control.inspect()
    active = inspect.active()
    stats = inspect.stats()
    registered = inspect.registered()
    active_queues = inspect.active_queues()

    return {
        "success": True,
        "workers": {
            "active_tasks": active or {},
            "stats": stats or {},
            "registered_tasks": registered or {},
            "active_queues": active_queues or {},
        },
    }


# ============================================================================
# Queue management
# ============================================================================


@router.get("/queues")
@handle_celery_errors("list queues")
async def list_queues(
    current_user: dict = Depends(require_permission("settings.celery", "read")),
):
    """
    List all Celery queues with their metrics and worker assignments.

    Returns information about:
    - Queue names and configuration
    - Pending tasks in each queue
    - Active tasks per queue
    - Which workers are consuming from each queue
    - Task routing configuration
    """
    return get_queue_metrics()


@router.delete("/queues/purge-all")
@handle_celery_errors("purge all queues")
async def purge_all_queues_endpoint(
    current_user: dict = Depends(require_permission("settings.celery", "write")),
):
    """
    Purge all pending tasks from all queues.

    This removes all queued (pending) tasks from every queue, not currently
    running tasks. Purged tasks cannot be recovered.
    """
    try:
        return purge_all_queues(username=current_user.get("username", "unknown"))
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        )


@router.delete("/queues/{queue_name}/purge")
@handle_celery_errors("purge queue")
async def purge_queue_endpoint(
    queue_name: str,
    current_user: dict = Depends(require_permission("settings.celery", "write")),
):
    """
    Purge all pending tasks from a specific queue.

    This removes only queued (pending) tasks, not currently running tasks.
    Purged tasks cannot be recovered.

    Args:
        queue_name: Name of the queue to purge (e.g., 'default', 'backup', 'network', 'heavy')
    """
    try:
        return purge_queue(queue_name, username=current_user.get("username", "unknown"))
    except KeyError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)
        )


# ============================================================================
# Schedules, Beat & overall status
# ============================================================================


@router.get("/schedules")
@handle_celery_errors("list schedules")
async def list_schedules(
    current_user: dict = Depends(require_permission("settings.celery", "read")),
):
    """List all periodic task schedules configured in Celery Beat."""
    beat_schedule = celery_app.conf.beat_schedule or {}
    schedules = [
        {
            "name": name,
            "task": config.get("task"),
            "schedule": str(config.get("schedule")),
            "options": config.get("options", {}),
        }
        for name, config in beat_schedule.items()
    ]
    return {"success": True, "schedules": schedules}


@router.get("/beat/status")
@handle_celery_errors("get beat status")
async def beat_status(
    current_user: dict = Depends(require_permission("settings.celery", "read")),
):
    """Get Celery Beat scheduler status."""
    return {"success": True, **get_beat_status()}


@router.get("/status")
@handle_celery_errors("get celery status")
async def celery_status(
    current_user: dict = Depends(require_permission("settings.celery", "read")),
):
    """Get overall Celery system status."""
    inspect = celery_app.control.inspect()
    stats = inspect.stats()
    active = inspect.active()

    worker_count = len(stats) if stats else 0
    task_count = sum(len(tasks) for tasks in active.values()) if active else 0
    redis_ok = is_redis_connected()
    beat_running = get_beat_status()["beat_running"]

    return {
        "success": True,
        "status": {
            "redis_connected": redis_ok,
            "worker_count": worker_count,
            "active_tasks": task_count,
            "beat_running": beat_running,
        },
    }


@router.get("/config")
@handle_celery_errors("get celery config")
async def get_celery_config(
    current_user: dict = Depends(require_permission("settings.celery", "read")),
):
    """
    Get current Celery configuration (read-only).
    Configuration is set via environment variables and cannot be changed at runtime.
    """
    redis_host = os.getenv("COCKPIT_REDIS_HOST", "localhost")
    redis_port = os.getenv("COCKPIT_REDIS_PORT", "6379")
    redis_password = os.getenv("COCKPIT_REDIS_PASSWORD", "")
    has_password = bool(redis_password)

    conf = celery_app.conf

    return {
        "success": True,
        "config": {
            "redis": {
                "host": redis_host,
                "port": redis_port,
                "has_password": has_password,
                "database": "0",
            },
            "worker": {
                "max_concurrency": settings.celery_max_workers,
                "prefetch_multiplier": conf.worker_prefetch_multiplier,
                "max_tasks_per_child": conf.worker_max_tasks_per_child,
            },
            "task": {
                "time_limit": conf.task_time_limit,
                "serializer": conf.task_serializer,
                "track_started": conf.task_track_started,
            },
            "result": {
                "expires": conf.result_expires,
                "serializer": conf.result_serializer,
            },
            "beat": {
                "scheduler": conf.beat_scheduler,
                "schedule_count": len(conf.beat_schedule) if conf.beat_schedule else 0,
            },
            "timezone": conf.timezone,
            "enable_utc": conf.enable_utc,
        },
    }


# ============================================================================
# Settings CRUD
# ============================================================================


@router.get("/settings")
@handle_celery_errors("get celery settings")
async def get_celery_settings(
    current_user: dict = Depends(require_permission("settings.celery", "read")),
):
    """
    Get current Celery settings from database.

    Queue System:
    - Built-in queues (built_in=true): Hardcoded in celery_app.py, have automatic task routing
    - Custom queues (built_in=false): Must be configured via CELERY_WORKER_QUEUE env var
    - See CELERY_ARCHITECTURE.md for details on adding custom queues
    """
    from settings_manager import settings_manager

    celery_settings = settings_manager.get_celery_settings()
    return {"success": True, "settings": celery_settings}


@router.put("/settings")
@handle_celery_errors("update celery settings")
async def update_celery_settings(
    request: CelerySettingsRequest,
    current_user: dict = Depends(require_permission("settings.celery", "write")),
):
    """
    Update Celery settings.

    Queue Management:
    - Built-in queues (default, backup, network, heavy) cannot be removed
    - Custom queues can be added/removed freely
    - Workers must be restarted to recognize queue changes
    - Set CELERY_WORKER_QUEUE env var to use custom queues

    Note: max_workers changes require restarting the Celery worker to take effect.
    """
    from settings_manager import settings_manager

    current = settings_manager.get_celery_settings()
    updates = request.model_dump(exclude_unset=True)

    # Validate queue changes: built-in queues must not be removed
    if "queues" in updates:
        built_in_queue_names = {"default", "backup", "network", "heavy"}
        updated_queue_names = {q["name"] for q in updates["queues"]}
        missing_built_ins = built_in_queue_names - updated_queue_names
        if missing_built_ins:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Cannot remove built-in queues: {', '.join(missing_built_ins)}. "
                    "Built-in queues (default, backup, network, heavy) are required."
                ),
            )
        for queue in updates["queues"]:
            if queue["name"] in built_in_queue_names:
                queue["built_in"] = True
            elif "built_in" not in queue:
                queue["built_in"] = False

    merged = {**current, **updates}
    success = settings_manager.update_celery_settings(merged)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update Celery settings",
        )

    updated = settings_manager.get_celery_settings()
    return {
        "success": True,
        "settings": updated,
        "message": "Celery settings updated. Worker restart required for max_workers changes.",
    }


# ============================================================================
# Cleanup
# ============================================================================


@router.post("/cleanup", response_model=TaskResponse)
@handle_celery_errors("trigger cleanup task")
async def trigger_cleanup(
    current_user: dict = Depends(require_permission("settings.celery", "write")),
):
    """
    Manually trigger the Celery cleanup task.

    This removes old task results and logs based on the configured cleanup_age_hours.
    """
    from tasks.periodic_tasks import cleanup_celery_data_task

    task = cleanup_celery_data_task.delay()
    return TaskResponse(
        task_id=task.id, status="queued", message=f"Cleanup task triggered: {task.id}"
    )


@router.get("/cleanup/stats")
@handle_celery_errors("get cleanup stats")
async def get_cleanup_stats_endpoint(
    current_user: dict = Depends(require_permission("settings.celery", "read")),
):
    """Get statistics about data that would be cleaned up."""
    stats = get_cleanup_stats()
    return {"success": True, "stats": stats}
