"""
Celery task management API endpoints.
All Celery-related endpoints are under /api/celery/*
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from celery.result import AsyncResult
from kombu import Queue
from core.auth import require_permission
from core.celery_error_handler import handle_celery_errors
from celery_app import celery_app
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging
import redis
import os

import job_run_manager
from config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/celery", tags=["celery"])


# Request/Response Models
class TestTaskRequest(BaseModel):
    message: str = "Hello from Celery!"


class ProgressTaskRequest(BaseModel):
    duration: int = 10


class OnboardDeviceRequest(BaseModel):
    ip_address: str
    location_id: str
    role_id: str
    namespace_id: str
    status_id: str
    interface_status_id: str
    ip_address_status_id: str
    prefix_status_id: str
    secret_groups_id: str
    platform_id: str
    port: int = 22
    timeout: int = 30
    onboarding_timeout: int = 120
    sync_options: List[str] = ["cables", "software", "vlans", "vrfs"]
    tags: Optional[List[str]] = None
    custom_fields: Optional[Dict[str, str]] = None


class BulkOnboardDeviceConfig(BaseModel):
    """Configuration for a single device in bulk onboarding."""

    ip_address: str
    location_id: Optional[str] = None
    namespace_id: Optional[str] = None
    role_id: Optional[str] = None
    status_id: Optional[str] = None
    interface_status_id: Optional[str] = None
    ip_address_status_id: Optional[str] = None
    prefix_status_id: Optional[str] = None
    secret_groups_id: Optional[str] = None
    platform_id: Optional[str] = None
    port: Optional[int] = None
    timeout: Optional[int] = None
    tags: Optional[List[str]] = None
    custom_fields: Optional[Dict[str, str]] = None


class BulkOnboardDevicesRequest(BaseModel):
    """Request model for bulk device onboarding from CSV."""

    devices: List[BulkOnboardDeviceConfig]
    default_config: Dict  # Default values for missing device-specific fields
    parallel_jobs: Optional[int] = (
        1  # Number of parallel jobs to create (default: 1 = sequential)
    )


class SyncDevicesToCheckmkRequest(BaseModel):
    device_ids: List[str]
    activate_changes_after_sync: bool = True


class TaskResponse(BaseModel):
    task_id: str
    status: str
    message: str


class TaskWithJobResponse(BaseModel):
    """Response model for tasks that are tracked in the job database."""

    task_id: str
    job_id: Optional[str] = None  # Job ID for tracking in Jobs/Views
    status: str
    message: str


class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    result: Optional[dict] = None
    error: Optional[str] = None
    progress: Optional[dict] = None


class DeviceBackupStatus(BaseModel):
    device_id: str
    device_name: str
    last_backup_success: bool
    last_backup_time: Optional[str] = None
    total_successful_backups: int
    total_failed_backups: int
    last_error: Optional[str] = None


class BackupCheckResponse(BaseModel):
    total_devices: int
    devices_with_successful_backup: int
    devices_with_failed_backup: int
    devices_never_backed_up: int
    devices: List[DeviceBackupStatus]


# Test endpoint (no auth required for testing)
@router.post("/test", response_model=TaskResponse)
@handle_celery_errors("submit test task")
async def submit_test_task(request: TestTaskRequest):
    """
    Submit a test task to verify Celery is working.
    No authentication required for testing.
    """
    from tasks import test_tasks

    # Submit task to Celery queue
    task = test_tasks.test_task.delay(message=request.message)

    return TaskResponse(
        task_id=task.id, status="queued", message=f"Test task submitted: {task.id}"
    )


@router.post("/test/progress", response_model=TaskResponse)
@handle_celery_errors("submit progress test task")
async def submit_progress_test_task(request: ProgressTaskRequest):
    """
    Submit a test task that reports progress.
    No authentication required for testing.
    """
    from tasks import test_tasks

    # Submit task to Celery queue
    task = test_tasks.test_progress_task.delay(duration=request.duration)

    return TaskResponse(
        task_id=task.id,
        status="queued",
        message=f"Progress test task submitted: {task.id}",
    )


@router.post("/tasks/onboard-device", response_model=TaskResponse)
@handle_celery_errors("onboard device")
async def trigger_onboard_device(
    request: OnboardDeviceRequest,
    current_user: dict = Depends(require_permission("devices.onboard", "execute")),
):
    """
    Onboard a device to Nautobot with tags and custom fields using Celery.

    This endpoint triggers a background task that:
    1. Calls Nautobot onboarding job
    2. Waits for job completion (configurable timeout)
    3. Retrieves the device UUID from the IP address
    4. Updates the device with tags and custom fields

    Request Body:
        ip_address: Device IP address
        location_id: Nautobot location ID
        role_id: Nautobot role ID
        namespace_id: Nautobot namespace ID
        status_id: Device status ID
        interface_status_id: Interface status ID
        ip_address_status_id: IP address status ID
        prefix_status_id: Prefix status ID
        secret_groups_id: Secret group ID
        platform_id: Platform ID or "detect"
        port: SSH port (default: 22)
        timeout: SSH connection timeout (default: 30)
        onboarding_timeout: Max time to wait for onboarding job (default: 120, recommended for auto-detect)
        sync_options: List of sync options (cables, software, vlans, vrfs)
        tags: List of tag IDs to apply (optional)
        custom_fields: Dict of custom field key-value pairs (optional)

    Returns:
        TaskResponse with task_id for tracking progress via /tasks/{task_id}
    """
    from tasks.onboard_device_task import onboard_device_task

    # Submit task to Celery queue
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
    """
    Bulk onboard multiple devices from CSV data using one or more Celery tasks.

    This endpoint triggers background task(s) that process multiple devices.
    If parallel_jobs > 1, devices are split into batches and processed concurrently.

    Request Body:
        devices: List of device configurations, each containing:
            - ip_address: Device IP address (required)
            - location_id, namespace_id, role_id, etc. (optional, uses defaults if missing)
            - tags: List of tag IDs (optional)
            - custom_fields: Dict of custom field values (optional)
        default_config: Default configuration to use when device-specific values are missing:
            - location_id, namespace_id, role_id, status_id, etc.
            - onboarding_timeout: Max wait time for each device (default: 120s)
            - sync_options: List of sync options
        parallel_jobs: Number of parallel jobs to create (default: 1)

    Returns:
        TaskResponse with task_id(s) for tracking progress via /tasks/{task_id}
    """
    from tasks.bulk_onboard_task import bulk_onboard_devices_task
    import math

    # Convert device configs to dicts
    devices_data = [device.model_dump() for device in request.devices]
    device_count = len(devices_data)

    if device_count == 0:
        return TaskResponse(
            task_id="",
            status="error",
            message="No devices provided for bulk onboarding",
        )

    # Get username from authenticated user
    username = current_user.get("username", "unknown")

    # Determine number of parallel jobs (clamp to reasonable range)
    parallel_jobs = max(1, min(request.parallel_jobs or 1, device_count))

    # Single job mode (original behavior)
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
                    f"Created job run {job_run_id} for bulk onboard task {task.id}"
                )
        except Exception as e:
            logger.warning(f"Failed to create job run entry: {e}")

        return TaskResponse(
            task_id=task.id,
            status="queued",
            message=f"Bulk onboarding task queued for {device_count} devices: {task.id}",
        )

    # Parallel jobs mode - split devices into batches
    batch_size = math.ceil(device_count / parallel_jobs)
    task_ids = []

    for batch_num in range(parallel_jobs):
        start_idx = batch_num * batch_size
        end_idx = min(start_idx + batch_size, device_count)
        batch_devices = devices_data[start_idx:end_idx]

        if not batch_devices:
            continue

        # Create task for this batch
        task = bulk_onboard_devices_task.delay(
            devices=batch_devices,
            default_config=request.default_config,
            username=current_user.get("username"),
            user_id=current_user.get("user_id"),
        )
        task_ids.append(task.id)

        # Create job run entry for this batch
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
                    f"Created job run {job_run_id} for batch {batch_num + 1} task {task.id}"
                )
        except Exception as e:
            logger.warning(
                f"Failed to create job run entry for batch {batch_num + 1}: {e}"
            )

    return TaskResponse(
        task_id=",".join(task_ids),  # Return comma-separated task IDs
        status="queued",
        message=f"Created {len(task_ids)} parallel jobs for {device_count} devices ({batch_size} devices per job)",
    )


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
        # Task is running and has sent progress updates
        response.progress = result.info

    elif result.state == "SUCCESS":
        # Task completed successfully
        response.result = result.result

    elif result.state == "FAILURE":
        # Task failed
        response.error = str(result.info)

    return response


@router.delete("/tasks/{task_id}")
@handle_celery_errors("cancel task")
async def cancel_task(
    task_id: str,
    current_user: dict = Depends(require_permission("settings.celery", "write")),
):
    """
    Cancel a running or queued task.
    """
    result = AsyncResult(task_id, app=celery_app)
    result.revoke(terminate=True)

    return {"success": True, "message": f"Task {task_id} cancelled"}


@router.get("/workers")
@handle_celery_errors("list workers")
async def list_workers(
    current_user: dict = Depends(require_permission("settings.celery", "read")),
):
    """
    List active Celery workers and their status, including queue assignments.
    """
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
    inspect = celery_app.control.inspect()
    active_queues = inspect.active_queues()
    active_tasks = inspect.active()

    # Get queue configuration from celery_app
    task_queues = celery_app.conf.task_queues or {}
    task_routes = celery_app.conf.task_routes or {}

    # Connect to Redis to get queue lengths
    try:
        redis_client = redis.Redis.from_url(settings.redis_url)

        # Build queue metrics
        queues = []
        for queue_name in task_queues.keys():
            # Get pending tasks count from Redis list
            pending_count = redis_client.llen(queue_name)

            # Count active tasks in this queue
            active_count = 0
            workers_consuming = []

            if active_queues:
                for worker_name, worker_queues in active_queues.items():
                    for queue_info in worker_queues:
                        if queue_info.get("name") == queue_name:
                            workers_consuming.append(worker_name)

            if active_tasks:
                for worker_name, tasks in active_tasks.items():
                    # Check if this worker consumes from this queue
                    if worker_name in workers_consuming:
                        active_count += len(tasks)

            # Find tasks routed to this queue
            routed_tasks = []
            for task_pattern, route_config in task_routes.items():
                if route_config.get("queue") == queue_name:
                    routed_tasks.append(task_pattern)

            queues.append(
                {
                    "name": queue_name,
                    "pending_tasks": pending_count,
                    "active_tasks": active_count,
                    "workers_consuming": workers_consuming,
                    "worker_count": len(workers_consuming),
                    "routed_tasks": routed_tasks,
                    "exchange": task_queues[queue_name].get("exchange"),
                    "routing_key": task_queues[queue_name].get("routing_key"),
                }
            )

        redis_client.close()

        return {
            "success": True,
            "queues": queues,
            "total_queues": len(queues),
        }

    except Exception as e:
        logger.error(f"Error fetching queue metrics: {e}")
        return {
            "success": False,
            "error": str(e),
            "queues": [],
            "total_queues": 0,
        }


@router.delete("/queues/{queue_name}/purge")
@handle_celery_errors("purge queue")
async def purge_queue(
    queue_name: str,
    current_user: dict = Depends(require_permission("settings.celery", "write")),
):
    """
    Purge all pending tasks from a specific queue.

    This removes only queued (pending) tasks, not currently running tasks.
    Purged tasks cannot be recovered.

    Args:
        queue_name: Name of the queue to purge (e.g., 'default', 'backup', 'network', 'heavy')

    Returns:
        Success status, queue name, and number of purged tasks

    Raises:
        HTTPException 404: Queue not found
        HTTPException 500: Failed to purge queue
    """
    try:
        # Verify queue exists
        task_queues = celery_app.conf.task_queues or {}
        if queue_name not in task_queues.keys():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Queue '{queue_name}' not found",
            )

        # Use broker_connection to purge the queue directly
        with celery_app.connection_or_acquire() as conn:
            # Get the queue configuration and create a Queue object
            queue_config = task_queues[queue_name]
            queue_obj = Queue(
                name=queue_name,
                exchange=queue_config.get("exchange", queue_name),
                routing_key=queue_config.get("routing_key", queue_name),
            )
            # Purge it
            purged_count = queue_obj(conn.channel()).purge()

        logger.info(
            f"Purged {purged_count} task(s) from queue '{queue_name}' by user {current_user.get('username')}"
        )

        return {
            "success": True,
            "queue": queue_name,
            "purged_tasks": purged_count or 0,
            "message": f"Purged {purged_count or 0} pending task(s) from queue '{queue_name}'",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error purging queue {queue_name}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to purge queue: {str(e)}",
        )


@router.delete("/queues/purge-all")
@handle_celery_errors("purge all queues")
async def purge_all_queues(
    current_user: dict = Depends(require_permission("settings.celery", "write")),
):
    """
    Purge all pending tasks from all queues.

    This removes all queued (pending) tasks from every queue, not currently running tasks.
    Purged tasks cannot be recovered.

    Returns:
        Success status, list of purged queues with counts, and total purged tasks

    Raises:
        HTTPException 500: Failed to purge queues
    """
    try:
        # Get all queue configurations
        task_queues = celery_app.conf.task_queues or {}

        purged_queues = []
        total_purged = 0

        # Purge each queue
        with celery_app.connection_or_acquire() as conn:
            for queue_name in task_queues.keys():
                try:
                    queue_config = task_queues[queue_name]
                    queue_obj = Queue(
                        name=queue_name,
                        exchange=queue_config.get("exchange", queue_name),
                        routing_key=queue_config.get("routing_key", queue_name),
                    )
                    purged_count = queue_obj(conn.channel()).purge()

                    purged_queues.append(
                        {"queue": queue_name, "purged_tasks": purged_count or 0}
                    )
                    total_purged += purged_count or 0

                    logger.info(
                        f"Purged {purged_count} task(s) from queue '{queue_name}'"
                    )
                except Exception as e:
                    logger.error(f"Error purging queue {queue_name}: {e}")
                    purged_queues.append(
                        {"queue": queue_name, "purged_tasks": 0, "error": str(e)}
                    )

        logger.info(
            f"Purged total of {total_purged} task(s) from all queues by user {current_user.get('username')}"
        )

        return {
            "success": True,
            "total_purged": total_purged,
            "queues": purged_queues,
            "message": f"Purged {total_purged} pending task(s) from {len(purged_queues)} queue(s)",
        }

    except Exception as e:
        logger.error(f"Error purging all queues: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to purge all queues: {str(e)}",
        )


@router.get("/schedules")
@handle_celery_errors("list schedules")
async def list_schedules(
    current_user: dict = Depends(require_permission("settings.celery", "read")),
):
    """
    List all periodic task schedules configured in Celery Beat.
    """
    # Get beat schedule from celery_app config
    beat_schedule = celery_app.conf.beat_schedule or {}

    schedules = []
    for name, config in beat_schedule.items():
        schedules.append(
            {
                "name": name,
                "task": config.get("task"),
                "schedule": str(config.get("schedule")),
                "options": config.get("options", {}),
            }
        )

    return {"success": True, "schedules": schedules}


@router.get("/beat/status")
@handle_celery_errors("get beat status")
async def beat_status(
    current_user: dict = Depends(require_permission("settings.celery", "read")),
):
    """
    Get Celery Beat scheduler status.
    """
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
        "message": "Beat is running" if beat_running else "Beat not detected",
    }


@router.get("/status")
@handle_celery_errors("get celery status")
async def celery_status(
    current_user: dict = Depends(require_permission("settings.celery", "read")),
):
    """
    Get overall Celery system status.
    """
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
    except Exception:
        redis_connected = False

    # Check Beat status
    try:
        r = redis.from_url(settings.redis_url)
        # Check for the lock key that beat holds when running
        beat_lock_key = "cockpit-ng:beat::lock"
        beat_running = bool(r.exists(beat_lock_key))
    except Exception:
        beat_running = False

    return {
        "success": True,
        "status": {
            "redis_connected": redis_connected,
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
                "database": "0",
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
        },
    }


# Background job task endpoints
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

    # Trigger the task asynchronously
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

    # Trigger the task asynchronously
    task = cache_all_locations_task.delay()

    return TaskResponse(
        task_id=task.id,
        status="queued",
        message=f"Location caching task queued: {task.id}",
    )


# CheckMK device management task endpoints
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

    # Trigger the task asynchronously
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

    # Trigger the task asynchronously
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

    The task is tracked in the NB2CMK job database and can be viewed
    in the Jobs/Views app.

    Request Body:
        device_ids: List of Nautobot device IDs to sync
        activate_changes_after_sync: Whether to activate CheckMK changes after sync completes (default: True)

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

    # Trigger the task asynchronously with activate_changes_after_sync parameter
    task = sync_devices_to_checkmk_task.delay(
        request.device_ids, request.activate_changes_after_sync
    )

    # Generate job_id that will be used by the task
    job_id = f"sync_devices_{task.id}"

    return TaskWithJobResponse(
        task_id=task.id,
        job_id=job_id,
        status="queued",
        message=f"Sync devices task queued for {len(request.device_ids)} devices: {task.id}",
    )


@router.post("/tasks/compare-nautobot-and-checkmk", response_model=TaskResponse)
@handle_celery_errors("compare Nautobot and CheckMK")
async def trigger_compare_nautobot_and_checkmk(
    device_ids: list[str] = None,
    current_user: dict = Depends(require_permission("jobs", "read")),
):
    """
    Compare all devices (or specified devices) between Nautobot and CheckMK.

    This task compares device configurations and stores the results in the job database
    for later retrieval and display in the frontend.

    Request Body (optional):
        device_ids: List of Nautobot device IDs to compare. If empty or null, compares all devices.

    Returns:
        TaskResponse with task_id for tracking progress
    """
    from tasks.scheduling.job_dispatcher import dispatch_job

    # Use the unified dispatch_job to ensure consistency with scheduled jobs
    # This uses the refactored execution path in tasks/execution/compare_executor.py
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


# Backup request model
class BackupDevicesRequest(BaseModel):
    inventory: List[str]
    config_repository_id: Optional[int] = None
    credential_id: Optional[int] = None
    write_timestamp_to_custom_field: Optional[bool] = False
    timestamp_custom_field_name: Optional[str] = None
    parallel_tasks: int = 1


class DeployTemplateEntryRequest(BaseModel):
    """A single template entry in a multi-template deployment request."""

    template_id: int
    inventory_id: Optional[int] = None
    path: Optional[str] = None
    custom_variables: Optional[Dict[str, Any]] = None


class DeployAgentRequest(BaseModel):
    """Request model for agent deployment to git."""

    template_id: Optional[int] = None  # Legacy single-template field
    custom_variables: Optional[Dict[str, Any]] = None
    agent_id: str
    path: Optional[str] = None
    inventory_id: Optional[int] = None
    activate_after_deploy: Optional[bool] = None  # If None, read from template
    template_entries: Optional[list[DeployTemplateEntryRequest]] = None  # Multi-template entries


@router.post("/tasks/backup-devices", response_model=TaskResponse)
@handle_celery_errors("backup devices")
async def trigger_backup_devices(
    request: BackupDevicesRequest,
    current_user: dict = Depends(require_permission("jobs", "write")),
):
    """
    Backup device configurations to Git repository.

    This task:
    1. Converts inventory to device list
    2. Checks/clones/pulls Git repository
    3. Connects to each device via Netmiko
    4. Executes 'show running-config' and 'show startup-config'
    5. Saves configs to Git repository
    6. Commits and pushes changes

    Request Body:
        inventory: List of device IDs to backup
        config_repository_id: ID of Git repository for configs (category=device_configs)
        credential_id: Optional ID of credential for device authentication

    Returns:
        TaskResponse with task_id for tracking progress
    """
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

    # Trigger the task asynchronously
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


@router.post("/tasks/deploy-agent", response_model=TaskResponse)
@handle_celery_errors("deploy agent")
async def trigger_deploy_agent(
    request: DeployAgentRequest,
    current_user: dict = Depends(require_permission("network.templates", "write")),
):
    """
    Deploy agent configuration to Git repository.

    This task:
    1. Loads template and agent configuration
    2. Renders the template with variables and inventory context
    3. Opens/clones the Git repository
    4. Writes rendered configuration to file
    5. Commits and pushes changes to Git
    6. Optionally activates agent (docker restart via cockpit agent)

    Request Body:
        template_id: ID of template to render
        custom_variables: User-provided custom variables (optional)
        agent_id: Agent ID for deployment configuration
        path: Deployment file path (optional, uses template default)
        inventory_id: Inventory ID for rendering (optional, uses template default)
        activate_after_deploy: Whether to activate agent after deployment (optional, reads from template if not provided)

    Returns:
        TaskResponse with task_id for tracking progress
    """
    from tasks.agent_deploy_tasks import deploy_agent_task

    # Validate: either template_id or template_entries must be provided
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

    # Determine activate_after_deploy setting
    # If not explicitly provided in request, default to True
    activate_after_deploy = request.activate_after_deploy
    if activate_after_deploy is None:
        activate_after_deploy = True

    # Build task kwargs
    task_kwargs = {
        "agent_id": request.agent_id,
        "activate_after_deploy": activate_after_deploy,
    }

    if request.template_entries:
        # Multi-template deployment
        task_kwargs["template_entries"] = [
            e.model_dump() for e in request.template_entries
        ]
        task_description = f"{len(request.template_entries)} templates"
    else:
        # Legacy single-template deployment
        task_kwargs["template_id"] = request.template_id
        task_kwargs["custom_variables"] = request.custom_variables or {}
        task_kwargs["path"] = request.path
        task_kwargs["inventory_id"] = request.inventory_id
        task_description = f"template {request.template_id}"

    # Trigger the task asynchronously
    task = deploy_agent_task.delay(**task_kwargs)

    return TaskResponse(
        task_id=task.id,
        status="queued",
        message=f"Agent deployment task queued for {task_description}: {task.id}",
    )


# ============================================================================
# Export Devices Endpoints
# ============================================================================


class ExportDevicesRequest(BaseModel):
    device_ids: List[str]
    properties: List[str]
    export_format: str = "yaml"  # "yaml" or "csv"
    csv_options: Optional[Dict[str, str]] = None


class UpdateDevicesRequest(BaseModel):
    """Request model for updating devices from CSV."""

    csv_content: str
    csv_options: Optional[Dict[str, str]] = None
    dry_run: bool = False


class UpdateIPPrefixesRequest(BaseModel):
    """Request model for updating IP prefixes from CSV."""

    csv_content: str
    csv_options: Optional[Dict[str, str]] = None
    dry_run: bool = False
    ignore_uuid: bool = True  # Default: use prefix+namespace lookup instead of UUID
    tags_mode: str = "replace"  # How to handle tags: "replace" or "merge"
    column_mapping: Optional[Dict[str, str]] = (
        None  # Maps lookup fields to CSV column names
    )
    selected_columns: Optional[List[str]] = (
        None  # List of CSV columns to update (if None, all non-excluded columns are updated)
    )


class UpdateIPAddressesRequest(BaseModel):
    """Request model for updating IP addresses from CSV."""

    csv_content: str
    csv_options: Optional[Dict[str, str]] = None
    dry_run: bool = False
    ignore_uuid: bool = True  # Default: use address+namespace lookup instead of UUID
    tags_mode: str = "replace"  # How to handle tags: "replace" or "merge"
    column_mapping: Optional[Dict[str, str]] = (
        None  # Maps lookup fields to CSV column names
    )
    selected_columns: Optional[List[str]] = (
        None  # List of CSV columns to update (if None, all non-excluded columns are updated)
    )


class ImportDevicesRequest(BaseModel):
    """Request model for importing devices from CSV."""

    csv_content: str
    csv_options: Optional[Dict[str, str]] = None
    import_options: Optional[Dict[str, Any]] = None


class UpdateDevicesJSONRequest(BaseModel):
    """Request model for updating devices from JSON list."""

    devices: List[Dict[str, Any]]
    dry_run: bool = False


class PreviewExportRequest(BaseModel):
    """Request model for previewing export data."""

    device_ids: List[str]
    properties: List[str]
    max_devices: int = 5
    export_format: str = "yaml"  # "yaml" or "csv"
    csv_options: Optional[Dict[str, str]] = None


class PreviewExportResponse(BaseModel):
    """Response model for preview data."""

    success: bool
    preview_content: str  # The actual CSV/YAML preview content
    total_devices: int
    previewed_devices: int
    message: Optional[str] = None


@router.post("/preview-export-devices", response_model=PreviewExportResponse)
async def preview_export_devices(
    request: PreviewExportRequest,
    current_user: dict = Depends(require_permission("nautobot.export", "read")),
):
    """
    Preview export data by fetching full device information from Nautobot.

    This endpoint fetches complete device data for a limited number of devices
    (default 5) to provide an accurate preview of what will be exported.

    Unlike the preview dialog's limited DeviceInfo, this fetches all fields
    from Nautobot using the same GraphQL query as the actual export.

    Request Body:
        device_ids: List of Nautobot device IDs
        properties: List of properties to include in preview
        max_devices: Maximum number of devices to preview (default: 5)

    Returns:
        PreviewExportResponse with full device data for preview
    """
    from services.nautobot import NautobotService
    from tasks.export_devices_task import (
        _build_graphql_query,
        _filter_device_properties,
        _export_to_yaml,
        _export_to_csv,
    )

    try:
        if not request.device_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="device_ids list cannot be empty",
            )

        if not request.properties:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="properties list cannot be empty",
            )

        # Limit to first N devices for preview
        preview_device_ids = request.device_ids[: request.max_devices]

        # Build GraphQL query with all requested properties
        query = _build_graphql_query(request.properties)

        # Fetch device data from Nautobot
        nautobot_service = NautobotService()
        variables = {"id_filter": preview_device_ids}
        result = nautobot_service._sync_graphql_query(query, variables)

        if not result or "data" not in result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch device data from Nautobot",
            )

        devices = result.get("data", {}).get("devices", [])

        if not devices:
            return PreviewExportResponse(
                success=True,
                preview_content="",
                total_devices=len(request.device_ids),
                previewed_devices=0,
                message="No devices found in Nautobot",
            )

        # Apply same filtering as export task
        # If primary_ip4 is requested, exclude devices without it
        if "primary_ip4" in request.properties:
            devices = [
                device
                for device in devices
                if device.get("primary_ip4") and device["primary_ip4"].get("address")
            ]

        # Filter to requested properties
        filtered_devices = _filter_device_properties(devices, request.properties)

        # Generate preview content using the same export functions
        export_format = request.export_format.strip().rstrip("_")
        if export_format == "yaml":
            preview_content = _export_to_yaml(filtered_devices)
        elif export_format == "csv":
            csv_options = request.csv_options or {}
            preview_content = _export_to_csv(filtered_devices, csv_options)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported export format: {export_format}",
            )

        # Add note about additional devices if truncated
        if len(request.device_ids) > request.max_devices:
            additional_count = len(request.device_ids) - len(filtered_devices)
            if export_format == "csv":
                preview_content += f"\n# ... and {additional_count} more device(s)"
            else:
                preview_content += f"\n# ... and {additional_count} more device(s)"

        return PreviewExportResponse(
            success=True,
            preview_content=preview_content,
            total_devices=len(request.device_ids),
            previewed_devices=len(filtered_devices),
            message=f"Successfully previewed {len(filtered_devices)} of {len(request.device_ids)} devices",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error previewing export: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to preview export: {str(e)}",
        )


@router.post("/tasks/export-devices", response_model=TaskWithJobResponse)
@handle_celery_errors("export devices")
async def trigger_export_devices(
    request: ExportDevicesRequest,
    current_user: dict = Depends(require_permission("nautobot.export", "execute")),
):
    """
    Export Nautobot device data to YAML or CSV format.

    This endpoint triggers a background task that:
    1. Fetches device data from Nautobot using GraphQL
    2. Filters to selected properties
    3. Exports to specified format (YAML or CSV)
    4. Stores the exported file for download

    The task is tracked in the job database and can be viewed in the Jobs/Views app.
    Once complete, the exported file can be downloaded via the download endpoint.

    Request Body:
        device_ids: List of Nautobot device IDs to export
        properties: List of properties to include (e.g., name, asset_tag, primary_ip4)
        export_format: Export format ("yaml" or "csv", default: "yaml")
        csv_options: Optional CSV formatting options:
            - delimiter: Field delimiter (default: ",")
            - quoteChar: Quote character (default: '"')
            - includeHeaders: Include header row (default: True)

    Returns:
        TaskWithJobResponse with task_id (for Celery) and job_id (for Jobs/Views tracking)
    """
    from tasks.export_devices_task import export_devices_task

    if not request.device_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="device_ids list cannot be empty",
        )

    if not request.properties:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="properties list cannot be empty",
        )

    if request.export_format not in ["yaml", "csv"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid export_format: {request.export_format}. Must be 'yaml' or 'csv'",
        )

    # Convert csv_options to proper format
    csv_options = None
    if request.csv_options:
        csv_options = {
            "delimiter": request.csv_options.get("delimiter", ","),
            "quoteChar": request.csv_options.get("quoteChar", '"'),
            "includeHeaders": request.csv_options.get("includeHeaders", "true").lower()
            == "true",
        }

    # Trigger the task asynchronously
    task = export_devices_task.delay(
        device_ids=request.device_ids,
        properties=request.properties,
        export_format=request.export_format,
        csv_options=csv_options,
    )

    # Create job run record for tracking in Jobs/View
    import job_run_manager

    job_run = job_run_manager.create_job_run(
        job_name=f"Export {len(request.device_ids)} devices to {request.export_format.upper()}",
        job_type="export_devices",
        triggered_by="manual",
        target_devices=request.device_ids,
        executed_by=current_user.get("username"),
    )

    # Mark as started with Celery task ID
    job_run_manager.mark_started(job_run["id"], task.id)

    return TaskWithJobResponse(
        task_id=task.id,
        job_id=str(job_run["id"]),
        status="queued",
        message=f"Export task queued for {len(request.device_ids)} devices with {len(request.properties)} properties: {task.id}",
    )


@router.get("/tasks/export-devices/{task_id}/download")
@handle_celery_errors("download export file")
async def download_export_file(
    task_id: str,
    current_user: dict = Depends(require_permission("nautobot.export", "read")),
):
    """
    Download the exported device file for a completed export task.

    This endpoint retrieves the file generated by a completed export_devices task.
    The file path is stored in the task result.

    Path Parameters:
        task_id: Celery task ID from the export task

    Returns:
        FileResponse: The exported file (YAML or CSV)

    Raises:
        404: Task not found or not completed
        404: Export file not found
    """
    # Get task result
    result = AsyncResult(task_id, app=celery_app)

    if result.state != "SUCCESS":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} is not completed. Current status: {result.state}",
        )

    task_result = result.result
    if not task_result or not task_result.get("success"):
        error_msg = (
            task_result.get("error", "Unknown error")
            if task_result
            else "No result available"
        )
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Export task failed: {error_msg}",
        )

    file_path = task_result.get("file_path")
    if not file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Export file path not found in task result",
        )

    logger.info(f"Download endpoint - checking file: {file_path}")
    logger.info(f"  - File exists: {os.path.exists(file_path)}")
    logger.info(f"  - Current working directory: {os.getcwd()}")
    logger.info(f"  - Absolute path: {os.path.abspath(file_path)}")

    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Export file not found at path: {file_path}",
        )

    filename = task_result.get("filename", os.path.basename(file_path))
    export_format = task_result.get("export_format", "yaml")

    logger.info("Download endpoint - RAW values from task_result:")
    logger.info(f"  - filename: '{filename}'")
    logger.info(f"  - export_format: '{export_format}'")
    logger.info(f"  - file_path: '{file_path}'")

    # Sanitize export_format and filename (remove trailing underscores)
    export_format = export_format.strip().rstrip("_")
    filename = filename.strip().rstrip("_")

    logger.info("Download endpoint - SANITIZED values:")
    logger.info(f"  - filename: '{filename}'")
    logger.info(f"  - export_format: '{export_format}'")

    # Determine media type
    media_type = "application/x-yaml" if export_format == "yaml" else "text/csv"

    logger.info("Download endpoint - FileResponse parameters:")
    logger.info(f"  - path: '{file_path}'")
    logger.info(f"  - filename: '{filename}'")
    logger.info(f"  - media_type: '{media_type}'")

    # Create FileResponse with manually set Content-Disposition header to avoid filename issues
    response = FileResponse(
        path=file_path,
        media_type=media_type,
    )
    # Manually set Content-Disposition header to ensure correct filename
    # Don't quote the filename - browsers interpret quotes differently (Safari includes them in filename)
    response.headers["Content-Disposition"] = f"attachment; filename={filename}"

    logger.info(
        f"Download endpoint - Content-Disposition header: {response.headers['Content-Disposition']}"
    )

    return response


@router.post("/tasks/update-devices-from-csv", response_model=TaskWithJobResponse)
@handle_celery_errors("update devices from CSV")
async def trigger_update_devices_from_csv(
    request: UpdateDevicesRequest,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
):
    """
    Update Nautobot devices from CSV data.

    This endpoint triggers a background task that:
    1. Parses the CSV content
    2. For each device row, updates the device in Nautobot
    3. Tracks successes and failures
    4. Returns summary of operations

    The task is tracked in the job database and can be viewed in the Jobs/Views app.

    Request Body:
        csv_content: CSV file content as string
        csv_options: Optional CSV parsing options:
            - delimiter: Field delimiter (default: ",")
            - quoteChar: Quote character (default: '"')
        dry_run: If True, validate without making changes (default: False)

    Returns:
        TaskWithJobResponse with task_id (for Celery) and job_id (for Jobs/Views tracking)
    """
    from tasks.update_devices_from_csv_task import update_devices_from_csv_task

    if not request.csv_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="csv_content cannot be empty",
        )

    # Convert csv_options to proper format
    csv_options = None
    if request.csv_options:
        csv_options = {
            "delimiter": request.csv_options.get("delimiter", ","),
            "quoteChar": request.csv_options.get("quoteChar", '"'),
        }

    # Trigger the task asynchronously
    task = update_devices_from_csv_task.delay(
        csv_content=request.csv_content,
        csv_options=csv_options,
        dry_run=request.dry_run,
    )

    # Create job run record for tracking in Jobs/View
    import job_run_manager

    job_name = f"Update devices from CSV{'(DRY RUN)' if request.dry_run else ''}"
    job_run = job_run_manager.create_job_run(
        job_name=job_name,
        job_type="update_devices_from_csv",
        triggered_by="manual",
        executed_by=current_user.get("username"),
    )

    # Mark as started with Celery task ID
    job_run_manager.mark_started(job_run["id"], task.id)

    return TaskWithJobResponse(
        task_id=task.id,
        job_id=str(job_run["id"]),
        status="queued",
        message=f"Update devices task queued{' (dry run mode)' if request.dry_run else ''}: {task.id}",
    )


@router.post("/tasks/update-ip-prefixes-from-csv", response_model=TaskWithJobResponse)
@handle_celery_errors("update IP prefixes from CSV")
async def trigger_update_ip_prefixes_from_csv(
    request: UpdateIPPrefixesRequest,
    current_user: dict = Depends(require_permission("nautobot.locations", "write")),
):
    """
    Update Nautobot IP prefixes from CSV data.

    This endpoint triggers a background task that:
    1. Parses the CSV content
    2. For each prefix row:
       - Extracts prefix and namespace (defaults to "Global")
       - Queries Nautobot to find the prefix by prefix+namespace combination
       - Updates the prefix with CSV data
    3. Tracks successes and failures
    4. Returns summary of operations

    The task is tracked in the job database and can be viewed in the Jobs/Views app.

    Strategy:
    - Primary identifier: prefix (e.g., "192.168.178.0/24") + namespace__name
    - If namespace__name is not in CSV, defaults to "Global"
    - Queries Nautobot to find the prefix UUID, then updates it

    Request Body:
        csv_content: CSV file content as string
        csv_options: Optional CSV parsing options:
            - delimiter: Field delimiter (default: ",")
            - quoteChar: Quote character (default: '"')
        dry_run: If True, validate without making changes (default: False)
        ignore_uuid: If True, use prefix+namespace lookup; if False, use UUID (default: True)
        tags_mode: How to handle tags - "replace" or "merge" (default: "replace")
        column_mapping: Maps lookup field names to CSV column names (optional)
            - Example: {"prefix": "network", "namespace__name": "ns_name", "namespace": "namespace"}
            - If not provided, uses default column names (prefix, namespace__name, namespace)

    Returns:
        TaskWithJobResponse with task_id (for Celery) and job_id (for Jobs/Views tracking)

    Required CSV Columns (default names or mapped via column_mapping):
        - prefix: The IP prefix (e.g., "192.168.178.0/24") - REQUIRED
        - namespace__name: Namespace name (optional, defaults to "Global")
        - namespace: Namespace (optional alternative to namespace__name)
        - Other fields: Any updatable prefix fields (description, status, etc.)

    Example CSV (default column names):
        prefix,namespace__name,description,status__name
        192.168.1.0/24,Global,Production Network,Active
        10.0.0.0/8,Internal,Internal Network,Reserved

    Example CSV (custom column names with mapping):
        network,ns_name,desc,status
        192.168.1.0/24,Global,Production Network,Active

        With column_mapping: {"prefix": "network", "namespace__name": "ns_name"}
    """
    from tasks.update_ip_prefixes_from_csv_task import update_ip_prefixes_from_csv_task
    import logging

    logger = logging.getLogger(__name__)
    logger.info("=" * 80)
    logger.info("RECEIVED UPDATE IP PREFIXES REQUEST")
    logger.info("=" * 80)
    logger.info(f"  - dry_run: {request.dry_run}")
    logger.info(f"  - ignore_uuid: {request.ignore_uuid}")
    logger.info(f"  - tags_mode: {request.tags_mode}")
    logger.info(f"  - column_mapping: {request.column_mapping}")
    logger.info(f"  - selected_columns: {request.selected_columns}")
    logger.info(f"  - csv_options: {request.csv_options}")

    if not request.csv_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="csv_content cannot be empty",
        )

    # Convert csv_options to proper format
    csv_options = None
    if request.csv_options:
        csv_options = {
            "delimiter": request.csv_options.get("delimiter", ","),
            "quoteChar": request.csv_options.get("quoteChar", '"'),
        }

    # Trigger the task asynchronously
    task = update_ip_prefixes_from_csv_task.delay(
        csv_content=request.csv_content,
        csv_options=csv_options,
        dry_run=request.dry_run,
        ignore_uuid=request.ignore_uuid,
        tags_mode=request.tags_mode,
        column_mapping=request.column_mapping,
        selected_columns=request.selected_columns,
    )

    # Create job run record for tracking in Jobs/View
    import job_run_manager

    job_name = f"Update IP Prefixes from CSV{' (DRY RUN)' if request.dry_run else ''}"
    job_run = job_run_manager.create_job_run(
        job_name=job_name,
        job_type="update_ip_prefixes_from_csv",
        triggered_by="manual",
        executed_by=current_user.get("username"),
    )

    # Mark as started with Celery task ID
    job_run_manager.mark_started(job_run["id"], task.id)

    return TaskWithJobResponse(
        task_id=task.id,
        job_id=str(job_run["id"]),
        status="queued",
        message=f"Update IP prefixes task queued{' (dry run mode)' if request.dry_run else ''}: {task.id}",
    )


@router.post("/tasks/update-ip-addresses-from-csv", response_model=TaskWithJobResponse)
@handle_celery_errors("update IP addresses from CSV")
async def trigger_update_ip_addresses_from_csv(
    request: UpdateIPAddressesRequest,
    current_user: dict = Depends(require_permission("nautobot.locations", "write")),
):
    """
    Update Nautobot IP addresses from CSV data.

    This endpoint triggers a background task that:
    1. Parses the CSV content
    2. For each IP address row:
       - Extracts address and namespace
       - Queries Nautobot to find the IP address by address+namespace combination
       - Updates the IP address with CSV data
    3. Tracks successes and failures
    4. Returns summary of operations

    The task is tracked in the job database and can be viewed in the Jobs/Views app.

    Strategy:
    - Primary identifier: address (e.g., "192.168.1.1/24") + parent__namespace__name
    - If parent__namespace__name is not in CSV, defaults to "Global"
    - Queries Nautobot to find the IP address UUID, then updates it

    Request Body:
        csv_content: CSV file content as string
        csv_options: Optional CSV parsing options
        dry_run: If True, validate without making changes (default: False)
        ignore_uuid: If True, use address+namespace lookup; if False, use UUID (default: True)
        tags_mode: How to handle tags - "replace" or "merge" (default: "replace")
        column_mapping: Maps lookup field names to CSV column names (optional)
        selected_columns: List of CSV columns to update (optional)

    Returns:
        TaskWithJobResponse with task_id (for Celery) and job_id (for Jobs/Views tracking)

    Required CSV Columns:
        - address: The IP address (e.g., "192.168.1.1/24") - REQUIRED
        - parent__namespace__name: Namespace name (optional, defaults to "Global")
        - Other fields: Any updatable IP address fields (description, status, dns_name, etc.)
    """
    from tasks.update_ip_addresses_from_csv_task import (
        update_ip_addresses_from_csv_task,
    )
    import logging

    logger = logging.getLogger(__name__)
    logger.info("=" * 80)
    logger.info("RECEIVED UPDATE IP ADDRESSES REQUEST")
    logger.info("=" * 80)
    logger.info(f"  - dry_run: {request.dry_run}")
    logger.info(f"  - ignore_uuid: {request.ignore_uuid}")
    logger.info(f"  - tags_mode: {request.tags_mode}")
    logger.info(f"  - column_mapping: {request.column_mapping}")
    logger.info(f"  - selected_columns: {request.selected_columns}")

    if not request.csv_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="csv_content cannot be empty",
        )

    # Convert csv_options to proper format
    csv_options = None
    if request.csv_options:
        csv_options = {
            "delimiter": request.csv_options.get("delimiter", ","),
            "quoteChar": request.csv_options.get("quoteChar", '"'),
        }

    # Trigger the task asynchronously
    task = update_ip_addresses_from_csv_task.delay(
        csv_content=request.csv_content,
        csv_options=csv_options,
        dry_run=request.dry_run,
        ignore_uuid=request.ignore_uuid,
        tags_mode=request.tags_mode,
        column_mapping=request.column_mapping,
        selected_columns=request.selected_columns,
    )

    # Create job run record for tracking in Jobs/View
    import job_run_manager

    job_name = f"Update IP Addresses from CSV{' (DRY RUN)' if request.dry_run else ''}"
    job_run = job_run_manager.create_job_run(
        job_name=job_name,
        job_type="update_ip_addresses_from_csv",
        triggered_by="manual",
        executed_by=current_user.get("username"),
    )

    # Mark as started with Celery task ID
    job_run_manager.mark_started(job_run["id"], task.id)

    return TaskWithJobResponse(
        task_id=task.id,
        job_id=str(job_run["id"]),
        status="queued",
        message=f"Update IP addresses task queued{' (dry run mode)' if request.dry_run else ''}: {task.id}",
    )


@router.post("/tasks/update-devices", response_model=TaskWithJobResponse)
@handle_celery_errors("update devices")
async def trigger_update_devices(
    request: UpdateDevicesJSONRequest,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
):
    """
    Update Nautobot devices from JSON list.

    This endpoint triggers a background task that:
    1. Receives a list of device update objects
    2. For each device, updates the device in Nautobot
    3. Tracks successes and failures
    4. Returns summary of operations

    The task is tracked in the job database and can be viewed in the Jobs/Views app.

    Request Body:
        devices: List of device update objects. Each object should contain:
            - Device identifier (one or more of):
                - id: Device UUID
                - name: Device name
                - ip_address: Device IP address
            - Update data (any device fields to update)
            - Optional interface configuration (for primary_ip4)

        dry_run: If True, validate without making changes (default: False)

    Example request:
        {
            "devices": [
                {
                    "id": "device-uuid",
                    "name": "switch-01",
                    "primary_ip4": "10.0.0.1/24",
                    "mgmt_interface_name": "eth0",
                    "mgmt_interface_type": "1000base-t",
                    "mgmt_interface_status": "active",
                    "namespace": "namespace-uuid",
                    "role": "role-uuid"
                }
            ],
            "dry_run": false
        }

    Returns:
        TaskWithJobResponse with task_id (for Celery) and job_id (for Jobs/Views tracking)
    """
    from tasks.update_devices_task import update_devices_task

    if not request.devices:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="devices list cannot be empty",
        )

    # Trigger the task asynchronously
    task = update_devices_task.delay(
        devices=request.devices,
        dry_run=request.dry_run,
        username=current_user.get("username"),
        user_id=current_user.get("user_id"),
    )

    # Create job run record for tracking in Jobs/View
    import job_run_manager

    job_name = f"Update devices{' (DRY RUN)' if request.dry_run else ''}"
    job_run = job_run_manager.create_job_run(
        job_name=job_name,
        job_type="update_devices",
        triggered_by="manual",
        executed_by=current_user.get("username"),
    )

    # Mark as started with Celery task ID
    job_run_manager.mark_started(job_run["id"], task.id)

    return TaskWithJobResponse(
        task_id=task.id,
        job_id=str(job_run["id"]),
        status="queued",
        message=f"Update devices task queued ({len(request.devices)} device(s)){' (dry run mode)' if request.dry_run else ''}: {task.id}",
    )


@router.post("/tasks/import-devices-from-csv", response_model=TaskWithJobResponse)
@handle_celery_errors("import devices from CSV")
async def trigger_import_devices_from_csv(
    request: ImportDevicesRequest,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
):
    """
    Import new Nautobot devices from CSV data.

    This endpoint triggers a background task that:
    1. Parses the CSV content
    2. For each device row, creates a new device in Nautobot
    3. Optionally creates interfaces and assigns IP addresses
    4. Tracks successes and failures
    5. Returns summary of operations

    The task is tracked in the job database and can be viewed in the Jobs/Views app.

    Request Body:
        csv_content: CSV file content as string
        csv_options: Optional CSV parsing options:
            - delimiter: Field delimiter (default: ",")
            - quoteChar: Quote character (default: '"')
        import_options: Optional import behavior options:
            - skip_duplicates: If True, skip devices that already exist (default: False)
            - create_interfaces: If True, create interfaces from CSV (default: True)

    Returns:
        TaskWithJobResponse with task_id (for Celery) and job_id (for Jobs/Views tracking)
    """
    from tasks.import_devices_task import import_devices_from_csv_task

    if not request.csv_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="csv_content cannot be empty",
        )

    # Convert csv_options to proper format
    csv_options = None
    if request.csv_options:
        csv_options = {
            "delimiter": request.csv_options.get("delimiter", ","),
            "quoteChar": request.csv_options.get("quoteChar", '"'),
        }

    # Convert import_options to proper format
    import_options = None
    if request.import_options:
        import_options = {
            "skip_duplicates": request.import_options.get("skip_duplicates", False),
            "create_interfaces": request.import_options.get("create_interfaces", True),
        }

    # Trigger the task asynchronously
    task = import_devices_from_csv_task.delay(
        csv_content=request.csv_content,
        csv_options=csv_options,
        import_options=import_options,
    )

    # Create job run record for tracking in Jobs/View
    import job_run_manager

    skip_duplicates = (
        import_options.get("skip_duplicates", False) if import_options else False
    )
    job_name = (
        f"Import devices from CSV{' (skip duplicates)' if skip_duplicates else ''}"
    )
    job_run = job_run_manager.create_job_run(
        job_name=job_name,
        job_type="import_devices_from_csv",
        triggered_by="manual",
        executed_by=current_user.get("username"),
    )

    # Mark as started with Celery task ID
    job_run_manager.mark_started(job_run["id"], task.id)

    return TaskWithJobResponse(
        task_id=task.id,
        job_id=str(job_run["id"]),
        status="queued",
        message=f"Import devices task queued{' (skip duplicates mode)' if skip_duplicates else ''}: {task.id}",
    )


# ============================================================================
# Celery Settings Endpoints
# ============================================================================


class CeleryQueue(BaseModel):
    """
    Celery queue configuration.

    Fields:
        name: Queue name (e.g., "default", "backup", "network", "heavy")
        description: Human-readable description of queue purpose
        built_in: True for hardcoded queues (cannot be deleted), False for custom queues
    """

    name: str
    description: str = ""
    built_in: bool = False  # Built-in queues are hardcoded in celery_app.py


class CelerySettingsRequest(BaseModel):
    max_workers: Optional[int] = None
    cleanup_enabled: Optional[bool] = None
    cleanup_interval_hours: Optional[int] = None
    cleanup_age_hours: Optional[int] = None
    result_expires_hours: Optional[int] = None
    queues: Optional[List[CeleryQueue]] = None


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

    # Get current settings and merge with updates
    current = settings_manager.get_celery_settings()
    updates = request.model_dump(exclude_unset=True)

    # Validate queue changes: Ensure built-in queues are not removed
    if "queues" in updates:
        built_in_queue_names = {"default", "backup", "network", "heavy"}
        updated_queue_names = {q["name"] for q in updates["queues"]}

        missing_built_ins = built_in_queue_names - updated_queue_names
        if missing_built_ins:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot remove built-in queues: {', '.join(missing_built_ins)}. "
                f"Built-in queues (default, backup, network, heavy) are required.",
            )

        # Ensure built_in flag is set correctly for built-in queues
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

    # Get updated settings
    updated = settings_manager.get_celery_settings()

    return {
        "success": True,
        "settings": updated,
        "message": "Celery settings updated. Worker restart required for max_workers changes.",
    }


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
async def get_cleanup_stats(
    current_user: dict = Depends(require_permission("settings.celery", "read")),
):
    """
    Get statistics about data that would be cleaned up.
    """
    from settings_manager import settings_manager
    from datetime import datetime, timezone, timedelta

    celery_settings = settings_manager.get_celery_settings()
    cleanup_age_hours = celery_settings.get("cleanup_age_hours", 24)
    cutoff_time = datetime.now(timezone.utc) - timedelta(hours=cleanup_age_hours)

    # Count old task results in Redis
    r = redis.from_url(settings.redis_url)

    # Count celery task result keys
    result_keys = list(r.scan_iter("celery-task-meta-*"))
    old_results = 0

    for key in result_keys:
        try:
            # Try to get the result and check its timestamp
            # This is approximate as we can't easily get the task completion time
            old_results += 1  # Count all for now
        except Exception:
            pass

    return {
        "success": True,
        "stats": {
            "cleanup_age_hours": cleanup_age_hours,
            "cutoff_time": cutoff_time.isoformat(),
            "total_result_keys": len(result_keys),
            "message": f"Cleanup will remove task results older than {cleanup_age_hours} hours",
        },
    }


# ============================================================================
# Ping Network Task Endpoint
# ============================================================================


class PingNetworkRequest(BaseModel):
    cidrs: List[str]
    resolve_dns: bool = False
    count: int = 3
    timeout: int = 500
    retry: int = 3
    interval: int = 10


@router.post("/tasks/ping-network", response_model=TaskWithJobResponse)
@handle_celery_errors("ping network")
async def trigger_ping_network(
    request: PingNetworkRequest,
    current_user: dict = Depends(require_permission("network.ping", "execute")),
):
    """
    Ping CIDR network ranges and optionally resolve DNS names.

    This endpoint triggers a background task that:
    1. Expands CIDR networks to individual IP addresses
    2. Pings all IPs using fping for efficiency
    3. Optionally resolves DNS names for reachable hosts
    4. Condenses unreachable IP ranges for compact display

    The task is tracked in the job database and can be viewed in the Jobs/Views app.

    Request Body:
        cidrs: List of CIDR networks to ping (e.g., ['192.168.1.0/24'])
        resolve_dns: Whether to resolve DNS names for reachable IPs (default: False)

    Returns:
        TaskWithJobResponse with task_id (for Celery) and job_id (for Jobs/Views tracking)
    """
    from tasks.ping_network_task import ping_network_task

    if not request.cidrs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="cidrs list cannot be empty",
        )

    # Validate CIDR formats
    for cidr in request.cidrs:
        try:
            import ipaddress

            network = ipaddress.ip_network(cidr, strict=False)
            # Enforce /19 minimum (as specified)
            if network.prefixlen < 19:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"CIDR network too large (minimum /19): {cidr}",
                )
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid CIDR format: {cidr}",
            )

    # Trigger the task asynchronously
    task = ping_network_task.delay(
        cidrs=request.cidrs,
        resolve_dns=request.resolve_dns,
        executed_by=current_user.get("username", "unknown"),
        count=request.count,
        timeout=request.timeout,
        retry=request.retry,
        interval=request.interval,
    )

    # Generate job_id that will be used by the task
    job_id = f"ping_network_{task.id}"

    return TaskWithJobResponse(
        task_id=task.id,
        job_id=job_id,
        status="queued",
        message=f"Ping network task queued for {len(request.cidrs)} network(s): {task.id}",
    )


class ScanPrefixesRequest(BaseModel):
    custom_field_name: str
    custom_field_value: str
    response_custom_field_name: Optional[str] = None
    resolve_dns: bool = False
    ping_count: int = 3
    timeout_ms: int = 500
    retries: int = 3
    interval_ms: int = 10


@router.post("/tasks/scan-prefixes", response_model=TaskWithJobResponse)
@handle_celery_errors("scan prefixes")
async def trigger_scan_prefixes(
    request: ScanPrefixesRequest,
    current_user: dict = Depends(require_permission("network.scan", "execute")),
):
    """
    Scan network prefixes from Nautobot filtered by custom field value.

    This endpoint triggers a background task that:
    1. Queries Nautobot for prefixes with specific custom field value using GraphQL
    2. Expands prefixes to individual IP addresses
    3. Pings all IPs using fping for efficiency
    4. Optionally resolves DNS names for reachable hosts
    5. Condenses unreachable IP ranges for compact display

    The task is tracked in the job database and can be viewed in the Jobs/Views app.

    Request Body:
        custom_field_name: Name of custom field on ipam.prefix (without 'cf_' prefix)
        custom_field_value: Value to filter prefixes by (e.g., 'true')
        resolve_dns: Whether to resolve DNS names for reachable IPs (default: False)
        ping_count: Number of pings per host (default: 3, range: 1-10)
        timeout_ms: Individual target timeout in ms (default: 500, range: 100-30000)
        retries: Number of retries (default: 3, range: 0-5)
        interval_ms: Interval between packets in ms (default: 10, range: 0-10000)

    Returns:
        TaskWithJobResponse with task_id (for Celery) and job_id (for Jobs/Views tracking)
    """
    from tasks.scan_prefixes_task import scan_prefixes_task

    if not request.custom_field_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="custom_field_name cannot be empty",
        )

    if not request.custom_field_value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="custom_field_value cannot be empty",
        )

    # Trigger the task asynchronously
    task = scan_prefixes_task.delay(
        custom_field_name=request.custom_field_name,
        custom_field_value=request.custom_field_value,
        response_custom_field_name=request.response_custom_field_name,
        resolve_dns=request.resolve_dns,
        ping_count=request.ping_count,
        timeout_ms=request.timeout_ms,
        retries=request.retries,
        interval_ms=request.interval_ms,
        executed_by=current_user.get("username", "unknown"),
    )

    # Generate job_id that will be used by the task
    job_id = f"scan_prefixes_{task.id}"

    return TaskWithJobResponse(
        task_id=task.id,
        job_id=job_id,
        status="queued",
        message=f"Scan prefixes task queued (field: {request.custom_field_name}={request.custom_field_value}): {task.id}",
    )


@router.get("/device-backup-status", response_model=BackupCheckResponse)
async def check_device_backups(
    force_refresh: bool = False,
    current_user: dict = Depends(require_permission("jobs", "read")),
):
    """
    Analyze device-level backup status with caching.

    This endpoint provides critical operational visibility by analyzing
    which specific devices have successful backups and which don't.

    Unlike aggregate statistics, this tracks the last backup status per device,
    ensuring no device falls through the cracks.

    Args:
        force_refresh: If True, bypass cache and recalculate

    Returns:
        - Total devices that have been backed up
        - Devices with successful last backup
        - Devices with failed last backup
        - Detailed per-device backup history

    Cache: Results are cached for 5 minutes to improve dashboard performance
    """
    import json
    from core.database import get_db_session
    from sqlalchemy import text

    CACHE_KEY = "backup_check_devices"
    CACHE_DURATION_SECONDS = 300  # 5 minutes

    # Try to get from cache first
    if not force_refresh:
        try:
            r = redis.Redis.from_url(settings.redis_url, decode_responses=True)
            cached = r.get(CACHE_KEY)
            if cached:
                logger.info("Returning cached device backup status")
                return BackupCheckResponse(**json.loads(cached))
        except Exception as e:
            logger.warning(f"Cache read failed, proceeding with fresh data: {e}")

    session = get_db_session()

    try:
        # Get all backup job results
        backup_jobs = session.execute(
            text("""
            SELECT
                result,
                completed_at,
                status
            FROM job_runs
            WHERE job_type = 'backup'
                AND status IN ('completed', 'failed')
            ORDER BY completed_at DESC
        """)
        ).fetchall()

        # Track device backup status
        device_status = {}  # device_id -> DeviceBackupStatus data

        for row in backup_jobs:
            result_json = row[0]
            completed_at = row[1]
            row[2]

            if not result_json:
                continue

            try:
                result = json.loads(result_json)

                # Process successful backups
                backed_up_devices = result.get("backed_up_devices", [])
                for device in backed_up_devices:
                    device_id = device.get("device_id")
                    device_name = device.get("device_name", device_id)

                    if device_id not in device_status:
                        device_status[device_id] = {
                            "device_id": device_id,
                            "device_name": device_name,
                            "last_backup_success": True,
                            "last_backup_time": completed_at.isoformat()
                            if completed_at
                            else None,
                            "total_successful_backups": 1,
                            "total_failed_backups": 0,
                            "last_error": None,
                        }
                    else:
                        # Only update if this is more recent than what we have
                        if not device_status[device_id].get("last_backup_time") or (
                            completed_at
                            and completed_at.isoformat()
                            > device_status[device_id]["last_backup_time"]
                        ):
                            device_status[device_id]["last_backup_success"] = True
                            device_status[device_id]["last_backup_time"] = (
                                completed_at.isoformat() if completed_at else None
                            )
                            device_status[device_id]["last_error"] = None
                        device_status[device_id]["total_successful_backups"] += 1

                # Process failed backups
                failed_devices = result.get("failed_devices", [])
                for device in failed_devices:
                    device_id = device.get("device_id")
                    device_name = device.get("device_name", device_id)
                    error = device.get("error", "Unknown error")

                    if device_id not in device_status:
                        device_status[device_id] = {
                            "device_id": device_id,
                            "device_name": device_name,
                            "last_backup_success": False,
                            "last_backup_time": completed_at.isoformat()
                            if completed_at
                            else None,
                            "total_successful_backups": 0,
                            "total_failed_backups": 1,
                            "last_error": error,
                        }
                    else:
                        # Only update if this is more recent than what we have
                        if not device_status[device_id].get("last_backup_time") or (
                            completed_at
                            and completed_at.isoformat()
                            > device_status[device_id]["last_backup_time"]
                        ):
                            device_status[device_id]["last_backup_success"] = False
                            device_status[device_id]["last_backup_time"] = (
                                completed_at.isoformat() if completed_at else None
                            )
                            device_status[device_id]["last_error"] = error
                        device_status[device_id]["total_failed_backups"] += 1

            except (json.JSONDecodeError, KeyError, AttributeError) as e:
                logger.warning(f"Failed to parse backup job result: {e}")
                continue

        # Calculate summary statistics
        devices_list = list(device_status.values())
        devices_with_success = sum(1 for d in devices_list if d["last_backup_success"])
        devices_with_failure = sum(
            1 for d in devices_list if not d["last_backup_success"]
        )

        response = BackupCheckResponse(
            total_devices=len(devices_list),
            devices_with_successful_backup=devices_with_success,
            devices_with_failed_backup=devices_with_failure,
            devices_never_backed_up=0,  # Would need Nautobot integration to calculate this
            devices=devices_list,
        )

        # Cache the result
        try:
            r = redis.Redis.from_url(settings.redis_url, decode_responses=True)
            r.setex(CACHE_KEY, CACHE_DURATION_SECONDS, response.model_dump_json())
            logger.info(
                f"Cached device backup status for {CACHE_DURATION_SECONDS} seconds"
            )
        except Exception as e:
            logger.warning(f"Failed to cache device backup status: {e}")

        return response

    finally:
        session.close()


@router.post("/tasks/check-ip", response_model=TaskResponse)
async def check_ip_task_endpoint(
    csv_file: UploadFile = File(...),
    delimiter: str = Form(","),
    quote_char: str = Form('"'),
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """
    Compare CSV device list with Nautobot devices.

    Uploads a CSV file containing device information and compares it with
    devices in Nautobot to check for IP address matches and name consistency.

    Required CSV columns: ip_address, name
    """
    try:
        logger.info(
            f"Received check IP request with delimiter='{delimiter}', quote_char='{quote_char}'"
        )

        # Validate file type
        if not csv_file.filename or not csv_file.filename.endswith(".csv"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File must be a CSV file",
            )

        # Read CSV content
        csv_content = await csv_file.read()
        csv_string = csv_content.decode("utf-8")

        # Validate CSV has content
        if not csv_string.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="CSV file is empty"
            )

        # Submit Celery task
        task = celery_app.send_task(
            "tasks.check_ip_task.check_ip_task",
            args=[csv_string, delimiter, quote_char],
        )

        # Register job in job system
        job_run = job_run_manager.create_job_run(
            job_name="Check IP Addresses",
            job_type="check_ip",
            triggered_by="manual",
            executed_by=current_user["username"],
        )

        if job_run:
            job_run_manager.mark_started(job_run["id"], task.id)

        logger.info(f"Started check IP task {task.id} for file {csv_file.filename}")

        return TaskResponse(
            task_id=task.id,
            status="started",
            message=f"IP check task started for {csv_file.filename}",
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting check IP task: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start check IP task: {str(e)}",
        )
