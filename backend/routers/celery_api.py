"""
Celery task management API endpoints.
All Celery-related endpoints are under /api/celery/*
"""
from fastapi import APIRouter, Depends, HTTPException, status
from celery.result import AsyncResult
from core.auth import require_permission
from celery_app import celery_app
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging
import redis

from config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/celery", tags=["celery"])


# Request/Response Models
class TestTaskRequest(BaseModel):
    message: str = "Hello from Celery!"


class ProgressTaskRequest(BaseModel):
    duration: int = 10


class TaskResponse(BaseModel):
    task_id: str
    status: str
    message: str


class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    result: Optional[dict] = None
    error: Optional[str] = None
    progress: Optional[dict] = None


# Test endpoint (no auth required for testing)
@router.post("/test", response_model=TaskResponse)
async def submit_test_task(request: TestTaskRequest):
    """
    Submit a test task to verify Celery is working.
    No authentication required for testing.
    """
    try:
        from tasks import test_tasks

        # Submit task to Celery queue
        task = test_tasks.test_task.delay(message=request.message)

        return TaskResponse(
            task_id=task.id,
            status='queued',
            message=f"Test task submitted: {task.id}"
        )

    except Exception as e:
        logger.error(f"Failed to submit test task: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit task: {str(e)}"
        )


@router.post("/test/progress", response_model=TaskResponse)
async def submit_progress_test_task(request: ProgressTaskRequest):
    """
    Submit a test task that reports progress.
    No authentication required for testing.
    """
    try:
        from tasks import test_tasks

        # Submit task to Celery queue
        task = test_tasks.test_progress_task.delay(duration=request.duration)

        return TaskResponse(
            task_id=task.id,
            status='queued',
            message=f"Progress test task submitted: {task.id}"
        )

    except Exception as e:
        logger.error(f"Failed to submit progress test task: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit task: {str(e)}"
        )


@router.get("/tasks/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(
    task_id: str,
    current_user: dict = Depends(require_permission("settings.celery", "read"))
):
    """
    Get the status and result of a Celery task.

    Status can be: PENDING, STARTED, PROGRESS, SUCCESS, FAILURE, RETRY, REVOKED
    """
    try:
        result = AsyncResult(task_id, app=celery_app)

        response = TaskStatusResponse(
            task_id=task_id,
            status=result.state
        )

        if result.state == 'PENDING':
            response.progress = {'status': 'Task is queued and waiting to start'}

        elif result.state == 'PROGRESS':
            # Task is running and has sent progress updates
            response.progress = result.info

        elif result.state == 'SUCCESS':
            # Task completed successfully
            response.result = result.result

        elif result.state == 'FAILURE':
            # Task failed
            response.error = str(result.info)

        return response

    except Exception as e:
        logger.error(f"Failed to get task status for {task_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get task status: {str(e)}"
        )


@router.delete("/tasks/{task_id}")
async def cancel_task(
    task_id: str,
    current_user: dict = Depends(require_permission("settings.celery", "write"))
):
    """
    Cancel a running or queued task.
    """
    try:
        result = AsyncResult(task_id, app=celery_app)
        result.revoke(terminate=True)

        return {
            "success": True,
            "message": f"Task {task_id} cancelled"
        }

    except Exception as e:
        logger.error(f"Failed to cancel task {task_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel task: {str(e)}"
        )


@router.get("/workers")
async def list_workers(
    current_user: dict = Depends(require_permission("settings.celery", "read"))
):
    """
    List active Celery workers and their status.
    """
    try:
        inspect = celery_app.control.inspect()
        active = inspect.active()
        stats = inspect.stats()
        registered = inspect.registered()

        return {
            "success": True,
            "workers": {
                "active_tasks": active or {},
                "stats": stats or {},
                "registered_tasks": registered or {}
            }
        }

    except Exception as e:
        logger.error(f"Failed to get worker info: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get worker info: {str(e)}"
        )


@router.get("/schedules")
async def list_schedules(
    current_user: dict = Depends(require_permission("settings.celery", "read"))
):
    """
    List all periodic task schedules configured in Celery Beat.
    """
    try:
        # Get beat schedule from celery_app config
        beat_schedule = celery_app.conf.beat_schedule or {}

        schedules = []
        for name, config in beat_schedule.items():
            schedules.append({
                "name": name,
                "task": config.get("task"),
                "schedule": str(config.get("schedule")),
                "options": config.get("options", {}),
            })

        return {
            "success": True,
            "schedules": schedules
        }

    except Exception as e:
        logger.error(f"Failed to get schedules: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get schedules: {str(e)}"
        )


@router.get("/beat/status")
async def beat_status(
    current_user: dict = Depends(require_permission("settings.celery", "read"))
):
    """
    Get Celery Beat scheduler status.
    """
    try:
        # Check if beat is running by inspecting Redis
        # RedBeat stores lock and schedule keys when running
        r = redis.from_url(settings.redis_url)

        # Check for the lock key that beat holds when running
        beat_lock_key = "cockpit-ng:beat::lock"
        lock_exists = r.exists(beat_lock_key)

        # Also check for schedule key
        beat_schedule_key = "cockpit-ng:beat::schedule"
        schedule_exists = r.exists(beat_schedule_key)

        # Beat is running if either key exists (lock is most reliable)
        beat_running = bool(lock_exists or schedule_exists)

        return {
            "success": True,
            "beat_running": beat_running,
            "message": "Beat is running" if beat_running else "Beat not detected"
        }

    except Exception as e:
        logger.error(f"Failed to get beat status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get beat status: {str(e)}"
        )


@router.get("/status")
async def celery_status(
    current_user: dict = Depends(require_permission("settings.celery", "read"))
):
    """
    Get overall Celery system status.
    """
    try:
        inspect = celery_app.control.inspect()
        stats = inspect.stats()
        active = inspect.active()

        # Count active workers
        worker_count = len(stats) if stats else 0

        # Count active tasks
        task_count = 0
        if active:
            for worker_tasks in active.values():
                task_count += len(worker_tasks)

        # Check Redis connection
        try:
            r = redis.from_url(settings.redis_url)
            r.ping()
            redis_connected = True
        except:
            redis_connected = False

        # Check Beat status
        try:
            r = redis.from_url(settings.redis_url)
            # Check for the lock key that beat holds when running
            beat_lock_key = "cockpit-ng:beat::lock"
            beat_running = bool(r.exists(beat_lock_key))
        except:
            beat_running = False

        return {
            "success": True,
            "status": {
                "redis_connected": redis_connected,
                "worker_count": worker_count,
                "active_tasks": task_count,
                "beat_running": beat_running,
            }
        }

    except Exception as e:
        logger.error(f"Failed to get celery status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get celery status: {str(e)}"
        )


@router.get("/config")
async def get_celery_config(
    current_user: dict = Depends(require_permission("settings.celery", "read"))
):
    """
    Get current Celery configuration (read-only).
    Configuration is set via environment variables and cannot be changed at runtime.
    """
    try:
        import os

        # Get Redis configuration (mask password for security)
        redis_host = os.getenv("COCKPIT_REDIS_HOST", "localhost")
        redis_port = os.getenv("COCKPIT_REDIS_PORT", "6379")
        redis_password = os.getenv("COCKPIT_REDIS_PASSWORD", "")
        has_password = bool(redis_password)

        # Get Celery configuration from celery_app
        conf = celery_app.conf

        return {
            "success": True,
            "config": {
                # Redis Configuration
                "redis": {
                    "host": redis_host,
                    "port": redis_port,
                    "has_password": has_password,
                    "database": "0"
                },
                # Worker Configuration
                "worker": {
                    "max_concurrency": settings.celery_max_workers,
                    "prefetch_multiplier": conf.worker_prefetch_multiplier,
                    "max_tasks_per_child": conf.worker_max_tasks_per_child,
                },
                # Task Configuration
                "task": {
                    "time_limit": conf.task_time_limit,
                    "serializer": conf.task_serializer,
                    "track_started": conf.task_track_started,
                },
                # Result Configuration
                "result": {
                    "expires": conf.result_expires,
                    "serializer": conf.result_serializer,
                },
                # Beat Configuration
                "beat": {
                    "scheduler": conf.beat_scheduler,
                    "schedule_count": len(conf.beat_schedule) if conf.beat_schedule else 0,
                },
                # General
                "timezone": conf.timezone,
                "enable_utc": conf.enable_utc,
            }
        }

    except Exception as e:
        logger.error(f"Failed to get celery config: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get celery config: {str(e)}"
        )
