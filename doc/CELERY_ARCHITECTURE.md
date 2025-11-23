# Celery Architecture for Cockpit-NG

## Overview

This document describes the architecture and implementation strategy for integrating Celery with Redis as the task queue system for Cockpit-NG. The goal is to offload long-running tasks from the main FastAPI application to background workers.

## Architecture Principles

### 1. Separation of Concerns

- **Main Application**: FastAPI application handling HTTP requests
- **Celery Workers**: Separate processes handling background tasks
- **Redis**: Message broker and result backend
- **Shared Code**: Business logic and services shared between main app and workers

### 2. Communication Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│                         Cockpit-NG Application                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐              ┌──────────────────┐         │
│  │   FastAPI Main   │              │  Celery Workers  │         │
│  │   Application    │              │   (Separate      │         │
│  │   (Port 8000)    │              │    Processes)    │         │
│  └────────┬─────────┘              └────────┬─────────┘         │
│           │                                  │                   │
│           │  /api/celery/* endpoints        │                   │
│           │  Submit tasks to queue           │                   │
│           │                                  │                   │
│           └──────────┬──────────────────────┘                   │
│                      │                                            │
│                      ▼                                            │
│           ┌─────────────────────┐                                │
│           │    Redis Server     │                                │
│           │  (Message Broker    │                                │
│           │   Result Backend)   │                                │
│           └─────────────────────┘                                │
│                      │                                            │
│                      │                                            │
│  ┌───────────────────┴────────────────────────────────┐         │
│  │          Shared Business Logic Layer                │         │
│  │  (Services, Managers, Database Operations)          │         │
│  │  - services/*.py                                     │         │
│  │  - *_manager.py                                      │         │
│  │  - Direct database access (no HTTP calls)           │         │
│  └─────────────────────────────────────────────────────┘         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Code Organization

```
backend/
├── main.py                      # FastAPI application entry point
├── celery_app.py               # Celery application configuration
├── celery_worker.py            # Celery worker entry point
├── requirements.txt            # Add celery, redis dependencies
│
├── routers/
│   └── celery_api.py           # /api/celery/* endpoints
│
├── tasks/                      # NEW: Celery task definitions
│   ├── __init__.py            # Import all tasks
│   ├── device_tasks.py        # Device onboarding tasks
│   ├── config_tasks.py        # Configuration backup tasks
│   ├── sync_tasks.py          # Nautobot/CheckMK sync tasks
│   └── compliance_tasks.py    # Compliance check tasks
│
├── services/                   # Shared business logic (existing)
│   ├── nautobot.py            # Used by both main app and workers
│   ├── checkmk.py             # Used by both main app and workers
│   ├── netmiko_service.py     # Used by both main app and workers
│   └── ...                    # Other services
│
└── config/                     # Configuration
    └── celery_config.py       # Celery-specific configuration
```

## Implementation Details

### 1. Celery Application Setup

**File**: `backend/celery_app.py`

```python
"""
Celery application configuration.
"""
from celery import Celery
from config import settings

# Create Celery application
celery_app = Celery(
    'cockpit_ng',
    broker=settings.redis_url,           # Redis as message broker
    backend=settings.redis_url,          # Redis as result backend
    include=['tasks']                     # Auto-discover tasks
)

# Celery configuration
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,                # 1 hour max per task
    result_expires=86400,                # Results expire after 24 hours
    worker_prefetch_multiplier=1,        # One task at a time per worker
    worker_max_tasks_per_child=100,      # Restart worker after 100 tasks
)
```

### 2. Celery Worker Entry Point

**File**: `backend/celery_worker.py`

```python
"""
Celery worker entry point.
Run with: celery -A celery_worker worker --loglevel=info
"""
from celery_app import celery_app

# Import all tasks to register them
from tasks import *

if __name__ == '__main__':
    celery_app.start()
```

### 3. Task Definition Pattern

**Example File**: `backend/tasks/device_tasks.py`

```python
"""
Device-related Celery tasks.
"""
from celery import Task
from celery_app import celery_app
from services.netmiko_service import NetmikoService
from services.nautobot import NautobotClient
import logging

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, name='tasks.onboard_device')
def onboard_device(
    self: Task,
    ip_address: str,
    location: str,
    namespace: str,
    role: str,
    status: str,
    **kwargs
) -> dict:
    """
    Onboard a device to Nautobot.

    This task:
    1. Connects to device via SSH (Netmiko)
    2. Collects device information
    3. Creates device in Nautobot
    4. Creates interfaces and IP addresses

    Args:
        self: Task instance (for updating state)
        ip_address: Device IP address
        location: Location ID or name
        namespace: Namespace ID or name
        role: Role ID or name
        status: Status ID or name
        **kwargs: Additional device parameters

    Returns:
        dict: Result with device_id, success status, message
    """
    try:
        # Update task state
        self.update_state(state='PROGRESS', meta={'status': 'Connecting to device'})

        # Use shared services directly (NO HTTP CALLS)
        netmiko = NetmikoService()
        nautobot = NautobotClient()

        # Connect and gather facts
        self.update_state(state='PROGRESS', meta={'status': 'Gathering device information'})
        device_info = netmiko.gather_device_facts(ip_address, **kwargs)

        # Create device in Nautobot
        self.update_state(state='PROGRESS', meta={'status': 'Creating device in Nautobot'})
        device = nautobot.create_device(
            name=device_info['hostname'],
            device_type=device_info['device_type'],
            location=location,
            namespace=namespace,
            role=role,
            status=status
        )

        # Create interfaces
        self.update_state(state='PROGRESS', meta={'status': 'Creating interfaces'})
        for interface in device_info['interfaces']:
            nautobot.create_interface(device['id'], interface)

        return {
            'success': True,
            'device_id': device['id'],
            'device_name': device['name'],
            'message': f"Device {device['name']} onboarded successfully"
        }

    except Exception as e:
        logger.error(f"Failed to onboard device {ip_address}: {e}")
        return {
            'success': False,
            'error': str(e),
            'message': f"Failed to onboard device: {str(e)}"
        }


@celery_app.task(name='tasks.backup_device_config')
def backup_device_config(device_id: str) -> dict:
    """
    Backup device configuration to Git repository.

    Args:
        device_id: Nautobot device ID

    Returns:
        dict: Result with success status and commit hash
    """
    # Implementation using shared services
    pass
```

### 4. API Router for Celery Endpoints

**File**: `backend/routers/celery_api.py`

```python
"""
Celery task management API endpoints.
All Celery-related endpoints are under /api/celery/*
"""
from fastapi import APIRouter, Depends, HTTPException, status
from celery.result import AsyncResult
from core.auth import require_permission
from celery_app import celery_app
from tasks import device_tasks, config_tasks, sync_tasks
from pydantic import BaseModel
from typing import Optional, List
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/celery", tags=["celery"])


# Request/Response Models
class OnboardDeviceRequest(BaseModel):
    ip_address: str
    location: str
    namespace: str
    role: str
    status: str
    platform: Optional[str] = None
    port: int = 22
    timeout: int = 30


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


# Endpoints
@router.post("/tasks/onboard-device", response_model=TaskResponse)
async def submit_onboard_device_task(
    request: OnboardDeviceRequest,
    current_user: dict = Depends(require_permission("devices", "write"))
):
    """
    Submit a device onboarding task to the queue.

    Returns immediately with a task_id that can be used to track progress.
    """
    try:
        # Submit task to Celery queue
        task = device_tasks.onboard_device.delay(
            ip_address=request.ip_address,
            location=request.location,
            namespace=request.namespace,
            role=request.role,
            status=request.status,
            platform=request.platform,
            port=request.port,
            timeout=request.timeout
        )

        return TaskResponse(
            task_id=task.id,
            status='queued',
            message=f"Device onboarding task submitted: {task.id}"
        )

    except Exception as e:
        logger.error(f"Failed to submit onboarding task: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit task: {str(e)}"
        )


@router.get("/tasks/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(
    task_id: str,
    current_user: dict = Depends(require_permission("devices", "read"))
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
    current_user: dict = Depends(require_permission("devices", "write"))
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
    current_user: dict = Depends(require_permission("settings", "read"))
):
    """
    List active Celery workers and their status.
    """
    try:
        inspect = celery_app.control.inspect()
        active = inspect.active()
        stats = inspect.stats()

        return {
            "success": True,
            "workers": {
                "active_tasks": active or {},
                "stats": stats or {}
            }
        }

    except Exception as e:
        logger.error(f"Failed to get worker info: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get worker info: {str(e)}"
        )
```

### 5. Configuration

**Add to `backend/config.py`**:

```python
class Settings(BaseSettings):
    # ... existing settings ...

    # Celery and Redis settings
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = Field(default="redis://localhost:6379/0")
    celery_result_backend: str = Field(default="redis://localhost:6379/0")
    celery_max_workers: int = Field(default=4)
```

### 6. Dependencies

**Add to `backend/requirements.txt`**:

```
celery>=5.4.0
redis>=5.0.0
```

## Running the System

### Development

1. **Start Redis** (if not already running):
   ```bash
   # Using Docker
   docker run -d -p 6379:6379 redis:latest

   # Or using system Redis
   redis-server
   ```

2. **Start Celery Worker**:
   ```bash
   cd backend
   celery -A celery_worker worker --loglevel=info
   ```

3. **Start FastAPI Application**:
   ```bash
   cd backend
   python start.py
   ```

### Production

Use process managers for both:

1. **Celery Worker (systemd service)**:
   ```ini
   [Unit]
   Description=Cockpit-NG Celery Worker
   After=network.target redis.service

   [Service]
   Type=forking
   User=cockpit-ng
   Group=cockpit-ng
   WorkingDirectory=/app/backend
   ExecStart=/app/venv/bin/celery -A celery_worker worker \
             --loglevel=info \
             --concurrency=4 \
             --pidfile=/var/run/celery/worker.pid
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```

2. **FastAPI Application** (existing systemd service)

## Migration Strategy

### Phase 1: Infrastructure Setup
- [ ] Install Redis
- [ ] Create Celery configuration files
- [ ] Set up task directory structure
- [ ] Update dependencies

### Phase 2: Task Migration
Convert existing background jobs to Celery tasks:

1. **Device Onboarding** (`/nautobot/devices/onboard`)
   - Current: APScheduler job
   - New: Celery task `tasks.onboard_device`

2. **Configuration Backup** (`/git/*`)
   - Current: Synchronous operations
   - New: Celery task `tasks.backup_device_config`

3. **Nautobot/CheckMK Sync** (`/nb2cmk/*`)
   - Current: APScheduler background service
   - New: Celery periodic tasks

4. **Compliance Checks** (`/compliance-check/*`)
   - Current: Synchronous multi-device checks
   - New: Celery group tasks

### Phase 3: API Integration
- [ ] Create `/api/celery/*` router
- [ ] Implement task submission endpoints
- [ ] Implement task status endpoints
- [ ] Add task cancellation support

### Phase 4: Frontend Integration
- [ ] Update frontend to submit tasks via `/api/celery/*`
- [ ] Add task status polling
- [ ] Show progress updates in UI
- [ ] Handle task completion/errors

## Key Principles

### ✅ DO

1. **Use shared services directly** in tasks
   ```python
   # GOOD: Direct service usage
   from services.nautobot import NautobotClient
   nautobot = NautobotClient()
   device = nautobot.create_device(...)
   ```

2. **Update task state for progress tracking**
   ```python
   self.update_state(state='PROGRESS', meta={'status': 'Step 1 of 3'})
   ```

3. **Handle exceptions gracefully**
   ```python
   try:
       # Task logic
   except Exception as e:
       logger.error(f"Task failed: {e}")
       return {'success': False, 'error': str(e)}
   ```

4. **Return structured results**
   ```python
   return {
       'success': True,
       'device_id': device_id,
       'message': 'Operation completed'
   }
   ```

### ❌ DON'T

1. **Don't make HTTP calls to the main application**
   ```python
   # BAD: HTTP call to own API
   requests.post('http://localhost:8000/api/devices')

   # GOOD: Use service directly
   from services.nautobot import NautobotClient
   nautobot.create_device(...)
   ```

2. **Don't share database connections**
   - Each task should create its own database connection
   - Use connection pooling in services

3. **Don't store large objects in results**
   - Results are stored in Redis
   - Keep results small and structured

## Monitoring and Debugging

### Celery Flower (Web UI)

```bash
# Install Flower
pip install flower

# Start Flower
celery -A celery_worker flower --port=5555
```

Access at `http://localhost:5555` to monitor:
- Active tasks
- Task history
- Worker status
- Task success/failure rates

### Logging

All tasks should use structured logging:

```python
import logging

logger = logging.getLogger(__name__)

@celery_app.task
def my_task():
    logger.info("Task started", extra={'task_id': self.request.id})
    # ... task logic ...
    logger.info("Task completed", extra={'task_id': self.request.id})
```

## Benefits

1. **Scalability**: Add more workers to handle increased load
2. **Reliability**: Task retries, failure handling, and monitoring
3. **Performance**: Non-blocking API responses
4. **Isolation**: Task failures don't affect main application
5. **Flexibility**: Easy to add new background tasks
6. **Monitoring**: Built-in task tracking and status

## References

- [Celery Documentation](https://docs.celeryq.dev/)
- [Redis Documentation](https://redis.io/docs/)
- [FastAPI Background Tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/)
- [Celery Best Practices](https://docs.celeryq.dev/en/stable/userguide/tasks.html#best-practices)
