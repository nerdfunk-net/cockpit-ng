# Celery Architecture for Cockpit-NG

## Overview

This document describes the architecture and implementation strategy for integrating Celery with Redis as the task queue system for Cockpit-NG. The goal is to offload long-running tasks from the main FastAPI application to background workers and handle periodic task scheduling.

**Key Components:**
- **Celery Workers**: Execute background tasks asynchronously
- **Celery Beat**: Schedule and trigger periodic tasks (replaces APScheduler)
- **Redis**: Message broker and result backend
- **FastAPI**: Main application with `/api/celery/*` endpoints

## Request Flow Diagram

This diagram shows the step-by-step flow when a user triggers a background job from the frontend:

```
Frontend                    Backend API                   Redis Broker              Celery Worker
   │                            │                             │                          │
   │ POST /api/celery/tasks/    │                             │                          │
   │      cache-devices         │                             │                          │
   ├───────────────────────────►│                             │                          │
   │                            │                             │                          │
   │                            │ task.delay()                │                          │
   │                            ├────────────────────────────►│                          │
   │                            │                             │ (queue message)          │
   │◄───────────────────────────┤                             │                          │
   │  { task_id, status }       │                             │                          │
   │                            │                             │                          │
   │                            │                             │      pop task            │
   │                            │                             │◄─────────────────────────┤
   │                            │                             │                          │
   │                            │                             │      execute task        │
   │                            │                             │      ──────────────────► │
   │                            │                             │                          │
   │ GET /api/celery/tasks/     │                             │                          │
   │     {task_id}              │                             │                          │
   ├───────────────────────────►│                             │                          │
   │                            │ AsyncResult(task_id)        │                          │
   │                            ├────────────────────────────►│                          │
   │                            │◄────────────────────────────┤                          │
   │◄───────────────────────────┤  { status: PENDING }        │                          │
   │  (poll every 2s)           │                             │                          │
   │                            │                             │                          │
   │                            │                             │      task completes      │
   │                            │                             │      store result        │
   │                            │                             │◄─────────────────────────┤
   │                            │                             │                          │
   │ GET /api/celery/tasks/     │                             │                          │
   │     {task_id}              │                             │                          │
   ├───────────────────────────►│                             │                          │
   │                            │ AsyncResult(task_id)        │                          │
   │                            ├────────────────────────────►│                          │
   │                            │◄────────────────────────────┤                          │
   │◄───────────────────────────┤  { status: SUCCESS,         │                          │
   │                            │    result: {...} }          │                          │
   │                            │                             │                          │
```

### Periodic Task Flow (Celery Beat)

This diagram shows how scheduled tasks are triggered by Celery Beat:

```
Celery Beat                 Redis Broker              Celery Worker              Database
   │                            │                          │                        │
   │  (reads schedule from      │                          │                        │
   │   beat_schedule.py or      │                          │                        │
   │   job_schedules table)     │                          │                        │
   │                            │                          │                        │
   │ Schedule triggers          │                          │                        │
   │ (e.g., every 15 min)       │                          │                        │
   ├───────────────────────────►│                          │                        │
   │  queue task                │                          │                        │
   │                            │      pop task            │                        │
   │                            │◄─────────────────────────┤                        │
   │                            │                          │                        │
   │                            │      dispatch_job()      │                        │
   │                            │      ──────────────────► │                        │
   │                            │                          │                        │
   │                            │                          │ create job_run record  │
   │                            │                          ├───────────────────────►│
   │                            │                          │                        │
   │                            │                          │ execute job task       │
   │                            │                          │ ───────────────────► │
   │                            │                          │                        │
   │                            │                          │ update job_run status  │
   │                            │                          ├───────────────────────►│
   │                            │                          │                        │
   │                            │      store result        │                        │
   │                            │◄─────────────────────────┤                        │
   │                            │                          │                        │
```

### Key API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/celery/tasks/{task_id}` | GET | Poll task status and result |
| `/api/celery/tasks/{task_id}` | DELETE | Cancel a running task |
| `/api/celery/tasks/cache-devices` | POST | Trigger device caching |
| `/api/celery/tasks/cache-locations` | POST | Trigger location caching |
| `/api/celery/tasks/sync-devices-to-checkmk` | POST | Trigger CheckMK sync |
| `/api/celery/workers` | GET | List active workers |
| `/api/celery/schedules` | GET | List periodic schedules |
| `/api/celery/status` | GET | Overall Celery status |

### Task Status Values

| Status | Description |
|--------|-------------|
| `PENDING` | Task is queued, waiting to start |
| `STARTED` | Task has started execution |
| `PROGRESS` | Task is running and has sent progress updates |
| `SUCCESS` | Task completed successfully |
| `FAILURE` | Task failed with error |
| `RETRY` | Task is being retried |
| `REVOKED` | Task was cancelled |

## Architecture Principles

### 1. Separation of Concerns

- **Main Application**: FastAPI application handling HTTP requests
- **Celery Workers**: Separate processes handling background tasks
- **Celery Beat**: Scheduler process for periodic tasks
- **Redis**: Message broker and result backend
- **Shared Code**: Business logic and services shared between main app and workers

### 2. Database Connection Handling (CRITICAL)

**Problem**: When using Celery with PostgreSQL and the prefork pool (default), worker processes fork from a parent process. If SQLAlchemy database connections exist before forking, child processes inherit the same connection file descriptors. PostgreSQL connections have internal state that assumes single-process ownership, leading to:
- `psycopg2.DatabaseError: error with status PGRES_TUPLES_OK and no message from the libpq`
- Connection pool corruption
- Segmentation faults (SIGSEGV) on macOS
- Unpredictable transaction boundaries

**Solution**: Use Celery worker lifecycle signals to ensure each worker process gets its own isolated database engine and connection pool.

**Implementation**: See `backend/core/celery_signals.py`

```python
from celery import signals
from sqlalchemy import create_engine

@signals.worker_init.connect
def init_worker(**kwargs):
    """
    Runs in parent process BEFORE forking.
    Dispose all database connections to ensure clean fork.
    """
    from core import database
    if hasattr(database, 'engine') and database.engine:
        database.engine.dispose()
        database.engine = None

@signals.worker_process_init.connect
def init_worker_process(**kwargs):
    """
    Runs in each child process AFTER forking.
    Create fresh database engine with isolated connection pool.
    """
    from core import database
    from config import settings

    # Dispose inherited connections
    if hasattr(database, 'engine') and database.engine:
        database.engine.dispose()
        database.engine = None

    # Create new engine for this worker process
    database.engine = create_engine(
        settings.database_url,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
        pool_recycle=3600,
    )

    # Recreate session factory
    database.SessionLocal = sessionmaker(bind=database.engine)

@signals.worker_process_shutdown.connect
def shutdown_worker_process(**kwargs):
    """
    Clean up database connections on worker shutdown.
    """
    from core import database
    if hasattr(database, 'engine') and database.engine:
        database.engine.dispose()
```

**Key Rules**:
- ✅ NO database access during module import time in `celery_app.py`
- ✅ Each worker process creates its own engine AFTER forking
- ✅ Parent process disposes all connections BEFORE forking
- ✅ Worker signals are imported in `celery_worker.py` and `start_celery.py`
- ❌ NEVER access database in global scope of Celery configuration

### 3. Queue Configuration

**Architecture**: Hybrid static + dynamic configuration to avoid database access before forking.

**Built-in Queues** (hardcoded in `celery_app.py`):
```python
def get_default_queue_configuration():
    return {
        "default": {"exchange": "default", "routing_key": "default"},
        "backup": {"exchange": "backup", "routing_key": "backup"},
        "network": {"exchange": "network", "routing_key": "network"},
        "heavy": {"exchange": "heavy", "routing_key": "heavy"},
    }
```

**Custom Queues** (super user responsibility):
1. Add queue in Settings UI (for documentation)
2. Configure `CELERY_WORKER_QUEUE=custom_queue` in docker-compose.yml
3. Worker listens to custom queue (Celery auto-creates in Redis)
4. Route tasks manually: `task.apply_async(queue='custom_queue')`

**Why This Approach**:
- ✅ No database access before forking (prevents SIGSEGV)
- ✅ Built-in queues have automatic task routing
- ✅ Super users can add unlimited custom queues via env vars
- ✅ Misconfigurations don't crash the system
- ✅ Settings UI still functional for viewing/managing queues

**Example**: Adding a `monitoring` queue:
```yaml
# docker-compose.yml
cockpit-worker-monitoring:
  environment:
    - CELERY_WORKER_QUEUE=monitoring
```

```python
# Route task to custom queue
monitoring_task.apply_async(args=[...], queue='monitoring')
```

### 4. Communication Pattern

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Cockpit-NG Application                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │   FastAPI Main   │    │  Celery Workers  │    │   Celery Beat    │  │
│  │   Application    │    │   (Separate      │    │   (Scheduler)    │  │
│  │   (Port 8000)    │    │    Processes)    │    │   (Separate      │  │
│  └────────┬─────────┘    └────────┬─────────┘    │    Process)      │  │
│           │                        │              └────────┬─────────┘  │
│           │                        │                       │             │
│           │  /api/celery/*         │                       │             │
│           │  Submit tasks          │                       │ Schedules   │
│           │                        │                       │ periodic    │
│           └───────┬────────────────┘                       │ tasks       │
│                   │                                        │             │
│                   ▼                                        ▼             │
│           ┌──────────────────────────────────────────────────────────┐  │
│           │              Redis Server                                 │  │
│           │  - Message Broker (task queue)                           │  │
│           │  - Result Backend (task results)                         │  │
│           │  - Beat Schedule Store (periodic task schedules)         │  │
│           └──────────────────────────────────────────────────────────┘  │
│                                      │                                   │
│                                      │                                   │
│  ┌───────────────────────────────────┴─────────────────────────────┐   │
│  │              Shared Business Logic Layer                         │   │
│  │  (Services, Managers, Database Operations)                       │   │
│  │  - services/*.py                                                 │   │
│  │  - *_manager.py                                                  │   │
│  │  - Direct database access (no HTTP calls)                       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5. Code Organization

```
backend/
├── main.py                      # FastAPI application entry point
├── celery_app.py               # Celery application configuration
├── celery_worker.py            # Celery worker entry point
├── celery_beat.py              # Celery Beat scheduler entry point
├── beat_schedule.py            # Periodic task schedule definitions
├── requirements.txt            # Add celery, redis, celery-redbeat
│
├── core/
│   ├── database.py             # SQLAlchemy engine and session management
│   └── celery_signals.py       # Worker lifecycle signals (DB connection handling)
│
├── routers/
│   └── celery_api.py           # /api/celery/* endpoints
│
├── tasks/                      # NEW: Celery task definitions
│   ├── __init__.py            # Import all tasks
│   ├── device_tasks.py        # Device onboarding tasks
│   ├── config_tasks.py        # Configuration backup tasks
│   ├── sync_tasks.py          # Nautobot/CheckMK sync tasks (periodic)
│   ├── compliance_tasks.py    # Compliance check tasks
│   └── periodic_tasks.py      # Periodic maintenance tasks
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

### 1. Worker Lifecycle Signals (Database Connection Handling)

**File**: `backend/core/celery_signals.py`

**CRITICAL**: This module MUST be imported before starting any Celery worker to prevent database connection corruption across forked processes.

```python
"""
Celery worker lifecycle signals for proper database connection handling.
Prevents SIGSEGV and PGRES_TUPLES_OK errors when using PostgreSQL with forked workers.
"""
import logging
from celery import signals
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

logger = logging.getLogger(__name__)

@signals.worker_init.connect
def init_worker(**kwargs):
    """
    Called in parent process BEFORE forking workers.
    CRITICAL: Dispose all database connections to ensure clean fork.
    """
    import os
    from core import database

    pid = os.getpid()
    logger.info(f"[Worker Main] Celery worker initialized (parent process PID={pid})")

    # Dispose database engine in parent process before forking
    if hasattr(database, 'engine') and database.engine is not None:
        logger.info("[Worker Main] Disposing database engine before forking")
        database.engine.dispose(close=False)
        database.engine = None

    if hasattr(database, 'SessionLocal') and database.SessionLocal is not None:
        database.SessionLocal.close_all()

@signals.worker_process_init.connect
def init_worker_process(**kwargs):
    """
    Called in each worker process AFTER forking.
    Creates fresh database engine with isolated connection pool.
    """
    import os
    from core import database
    from config import settings

    pid = os.getpid()
    logger.info(f"[Worker Init] Initializing database engine for PID={pid}")

    # Dispose any inherited connections
    if hasattr(database, 'engine') and database.engine is not None:
        database.engine.dispose(close=False)
        database.engine = None

    # Create new engine for this worker process
    database.engine = create_engine(
        settings.database_url,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
        pool_recycle=3600,
        echo=settings.debug,
        pool_timeout=30,
        connect_args={"connect_timeout": 10}
    )

    # Recreate session factory
    database.SessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=database.engine
    )

    logger.info(f"[Worker Init] Database engine initialized for PID={pid}")

@signals.worker_process_shutdown.connect
def shutdown_worker_process(**kwargs):
    """
    Clean up database connections on worker shutdown.
    """
    from core import database
    logger.info("[Worker Shutdown] Cleaning up database connections")
    if hasattr(database, 'engine') and database.engine:
        database.engine.dispose()
```

**Import in worker entry points**:

`backend/celery_worker.py`:
```python
from celery_app import celery_app
import core.celery_signals  # MUST import before starting worker
from tasks import *
```

`backend/start_celery.py`:
```python
from celery_app import celery_app
from config import settings
import core.celery_signals  # MUST import before starting worker
from tasks import *
```

### 2. Celery Application Setup

**File**: `backend/celery_app.py`

**IMPORTANT**: NO database access during module import to prevent connection sharing across forks.

```python
"""
Celery application configuration.
"""
from celery import Celery
from celery.schedules import crontab
from config import settings
import logging

logger = logging.getLogger(__name__)

# Create Celery application
celery_app = Celery(
    'cockpit_ng',
    broker=settings.celery_broker_url,    # Redis as message broker
    backend=settings.celery_result_backend,  # Redis as result backend
    include=['tasks']                      # Auto-discover tasks
)

def get_default_queue_configuration():
    """
    Return default queue configuration WITHOUT database access.

    CRITICAL: No database access here to avoid connection sharing before forking.

    Custom queues can be added by super users:
    1. Add in Settings UI (for documentation)
    2. Set CELERY_WORKER_QUEUE env var in docker-compose.yml
    3. Celery auto-creates queue in Redis
    4. Route tasks: task.apply_async(queue='custom')
    """
    return {
        "default": {"exchange": "default", "routing_key": "default"},
        "backup": {"exchange": "backup", "routing_key": "backup"},
        "network": {"exchange": "network", "routing_key": "network"},
        "heavy": {"exchange": "heavy", "routing_key": "heavy"},
    }

# Use static configuration (no database access before forking)
task_queues = get_default_queue_configuration()

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

    # Queue configuration (static to avoid DB access before forking)
    task_queues=task_queues,

    # Task routing - route specific tasks to dedicated queues
    task_routes={
        "tasks.backup_single_device_task": {"queue": "backup"},
        "tasks.finalize_backup_task": {"queue": "backup"},
        "tasks.ping_network_task": {"queue": "network"},
        "tasks.scan_prefixes_task": {"queue": "network"},
        "tasks.bulk_onboard_devices_task": {"queue": "heavy"},
        "tasks.update_devices_from_csv_task": {"queue": "heavy"},
        "*": {"queue": "default"},  # All other tasks → default
    },

    # Default queue
    task_default_queue="default",

    # Celery Beat settings
    beat_scheduler='redbeat.RedBeatScheduler',  # Use Redis-based scheduler
    redbeat_redis_url=settings.redis_url,       # Redis URL for beat schedule
    redbeat_key_prefix='cockpit-ng:beat:',      # Prefix for beat keys in Redis
)

# Import beat schedule (periodic tasks)
try:
    from beat_schedule import CELERY_BEAT_SCHEDULE
    celery_app.conf.beat_schedule = CELERY_BEAT_SCHEDULE
except ImportError:
    celery_app.conf.beat_schedule = {}
```

### 3. Celery Worker Entry Point

**File**: `backend/celery_worker.py`

```python
"""
Celery worker entry point.
Run with: celery -A celery_worker worker --loglevel=info
"""
from celery_app import celery_app

# CRITICAL: Import worker lifecycle signals BEFORE starting worker
import core.celery_signals  # noqa: F401

# Import all tasks to register them
try:
    from tasks import *  # noqa: F403
except ImportError:
    pass

if __name__ == '__main__':
    celery_app.start()
```

### 4. Celery Beat Scheduler Entry Point

**File**: `backend/celery_beat.py`

```python
"""
Celery Beat scheduler entry point.
Run with: celery -A celery_beat beat --loglevel=info
"""
from celery_app import celery_app

# Import worker lifecycle signals (for database connection handling)
import core.celery_signals  # noqa: F401

# Import all tasks and schedules to register them
try:
    from tasks import *  # noqa: F403
except ImportError:
    pass

try:
    from beat_schedule import CELERY_BEAT_SCHEDULE  # noqa: F401
except ImportError:
    pass

if __name__ == '__main__':
    celery_app.start()
```

### 5. Beat Schedule Configuration

**File**: `backend/beat_schedule.py`

```python
"""
Celery Beat periodic task schedule configuration.
Replaces APScheduler for scheduled tasks.
"""
from celery.schedules import crontab

# Define periodic task schedule
CELERY_BEAT_SCHEDULE = {
    # Nautobot to CheckMK sync - every 15 minutes
    'sync-nautobot-to-checkmk': {
        'task': 'tasks.sync_nautobot_to_checkmk',
        'schedule': crontab(minute='*/15'),  # Every 15 minutes
        'options': {
            'expires': 600,  # Task expires after 10 minutes if not picked up
        }
    },

    # Configuration backup - daily at 2 AM
    'backup-all-configs': {
        'task': 'tasks.backup_all_device_configs',
        'schedule': crontab(hour=2, minute=0),  # Daily at 2:00 AM
        'options': {
            'expires': 3600,
        }
    },

    # Cleanup old task results - daily at 3 AM
    'cleanup-old-results': {
        'task': 'tasks.cleanup_old_task_results',
        'schedule': crontab(hour=3, minute=0),  # Daily at 3:00 AM
        'options': {
            'expires': 3600,
        }
    },

    # Git repository sync - every 30 minutes
    'sync-git-repositories': {
        'task': 'tasks.sync_git_repositories',
        'schedule': crontab(minute='*/30'),  # Every 30 minutes
        'options': {
            'expires': 1200,
        }
    },

    # Cache refresh - configurable interval (default 15 minutes)
    'refresh-nautobot-cache': {
        'task': 'tasks.refresh_nautobot_cache',
        'schedule': crontab(minute='*/15'),  # Every 15 minutes
        'options': {
            'expires': 600,
        }
    },

    # Health check for workers - every 5 minutes
    'worker-health-check': {
        'task': 'tasks.worker_health_check',
        'schedule': crontab(minute='*/5'),  # Every 5 minutes
        'options': {
            'expires': 240,
        }
    },
}

# Schedule examples using different patterns:
#
# Every X minutes:
#   crontab(minute='*/15')
#
# Specific time daily:
#   crontab(hour=2, minute=30)
#
# Multiple times per day:
#   crontab(hour='0,6,12,18', minute=0)
#
# Specific day of week (0=Sunday, 6=Saturday):
#   crontab(hour=0, minute=0, day_of_week=0)
#
# First day of month:
#   crontab(hour=0, minute=0, day_of_month=1)
#
# Using timedelta for simple intervals:
#   from datetime import timedelta
#   schedule = timedelta(minutes=30)
```

### 6. Periodic Task Definitions

**File**: `backend/tasks/periodic_tasks.py`

```python
"""
Periodic tasks executed by Celery Beat.
These tasks run on a schedule defined in beat_schedule.py
"""
from celery_app import celery_app
from services.nb2cmk_background_service import Nb2CmkBackgroundService
from services.git_utils import GitService
from services.cache_service import CacheService
import logging

logger = logging.getLogger(__name__)


@celery_app.task(name='tasks.sync_nautobot_to_checkmk')
def sync_nautobot_to_checkmk() -> dict:
    """
    Periodic task: Sync devices from Nautobot to CheckMK.

    Replaces APScheduler background sync.
    Runs every 15 minutes (configured in beat_schedule.py)

    Returns:
        dict: Sync results with counts
    """
    try:
        logger.info("Starting Nautobot to CheckMK sync")

        # Use shared service directly
        sync_service = Nb2CmkBackgroundService()
        result = sync_service.run_sync()

        logger.info(f"Sync completed: {result}")
        return {
            'success': True,
            'synced': result.get('synced', 0),
            'errors': result.get('errors', 0),
            'message': 'Nautobot to CheckMK sync completed'
        }

    except Exception as e:
        logger.error(f"Sync failed: {e}")
        return {
            'success': False,
            'error': str(e),
            'message': f'Sync failed: {str(e)}'
        }


@celery_app.task(name='tasks.backup_all_device_configs')
def backup_all_device_configs() -> dict:
    """
    Periodic task: Backup all device configurations.

    Runs daily at 2:00 AM (configured in beat_schedule.py)

    Returns:
        dict: Backup results
    """
    try:
        logger.info("Starting device config backups")

        # Implementation here
        # Use services to get all devices and backup configs

        return {
            'success': True,
            'backed_up': 0,
            'message': 'Device backups completed'
        }

    except Exception as e:
        logger.error(f"Backup failed: {e}")
        return {
            'success': False,
            'error': str(e)
        }


@celery_app.task(name='tasks.cleanup_old_task_results')
def cleanup_old_task_results() -> dict:
    """
    Periodic task: Clean up old Celery task results from Redis.

    Runs daily at 3:00 AM (configured in beat_schedule.py)
    Removes task results older than 24 hours.

    Returns:
        dict: Cleanup results
    """
    try:
        logger.info("Cleaning up old task results")

        # Celery automatically expires results based on result_expires config
        # This task can do additional cleanup if needed

        return {
            'success': True,
            'message': 'Cleanup completed'
        }

    except Exception as e:
        logger.error(f"Cleanup failed: {e}")
        return {
            'success': False,
            'error': str(e)
        }


@celery_app.task(name='tasks.sync_git_repositories')
def sync_git_repositories() -> dict:
    """
    Periodic task: Pull latest changes from Git repositories.

    Runs every 30 minutes (configured in beat_schedule.py)

    Returns:
        dict: Sync results
    """
    try:
        logger.info("Syncing Git repositories")

        git_service = GitService()
        # Implementation here

        return {
            'success': True,
            'message': 'Git repositories synced'
        }

    except Exception as e:
        logger.error(f"Git sync failed: {e}")
        return {
            'success': False,
            'error': str(e)
        }


@celery_app.task(name='tasks.refresh_nautobot_cache')
def refresh_nautobot_cache() -> dict:
    """
    Periodic task: Refresh Nautobot data cache.

    Runs every 15 minutes (configured in beat_schedule.py)

    Returns:
        dict: Cache refresh results
    """
    try:
        logger.info("Refreshing Nautobot cache")

        cache_service = CacheService()
        result = cache_service.refresh_all()

        return {
            'success': True,
            'refreshed': result.get('refreshed', 0),
            'message': 'Cache refreshed'
        }

    except Exception as e:
        logger.error(f"Cache refresh failed: {e}")
        return {
            'success': False,
            'error': str(e)
        }


@celery_app.task(name='tasks.worker_health_check')
def worker_health_check() -> dict:
    """
    Periodic task: Health check for Celery workers.

    Runs every 5 minutes (configured in beat_schedule.py)
    Monitors worker health and logs status.

    Returns:
        dict: Health check results
    """
    try:
        inspect = celery_app.control.inspect()

        # Get active workers
        active = inspect.active()
        stats = inspect.stats()

        active_workers = len(stats) if stats else 0

        logger.info(f"Health check: {active_workers} workers active")

        return {
            'success': True,
            'active_workers': active_workers,
            'message': f'{active_workers} workers active'
        }

    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            'success': False,
            'error': str(e)
        }
```

### 6. Task Definition Pattern

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

### 7. API Router for Celery Endpoints

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


@router.get("/schedules")
async def list_schedules(
    current_user: dict = Depends(require_permission("settings", "read"))
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
    current_user: dict = Depends(require_permission("settings", "read"))
):
    """
    Get Celery Beat scheduler status.
    """
    try:
        # Check if beat is running by inspecting Redis
        # Beat stores its heartbeat in Redis with redbeat
        import redis
        from config import settings

        r = redis.from_url(settings.redis_url)
        beat_key = "cockpit-ng:beat:celerybeat-schedule"

        # Check if beat schedule exists in Redis
        exists = r.exists(beat_key)

        return {
            "success": True,
            "beat_running": bool(exists),
            "message": "Beat is running" if exists else "Beat not detected"
        }

    except Exception as e:
        logger.error(f"Failed to get beat status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get beat status: {str(e)}"
        )
```

### 8. Configuration

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

### 9. Dependencies

**Add to `backend/requirements.txt`**:

```
celery>=5.4.0
redis>=5.0.0
celery-redbeat>=2.2.0  # Redis-based Beat scheduler
```

**Why celery-redbeat?**
- Stores beat schedule in Redis (not local file)
- Allows dynamic schedule updates
- Works in distributed/containerized environments
- Multiple beat instances can run (only one active at a time)

## Running the System

### Development

Run all components in separate terminals:

1. **Start Redis** (Terminal 1):
   ```bash
   # Using Docker
   docker run -d -p 6379:6379 redis:latest

   # Or using system Redis
   redis-server
   ```

2. **Start Celery Worker** (Terminal 2):
   ```bash
   cd backend
   celery -A celery_worker worker --loglevel=info
   ```

3. **Start Celery Beat Scheduler** (Terminal 3):
   ```bash
   cd backend
   celery -A celery_beat beat --loglevel=info
   ```

4. **Start FastAPI Application** (Terminal 4):
   ```bash
   cd backend
   python start.py
   ```

**Optional: Start Flower for monitoring** (Terminal 5):
   ```bash
   cd backend
   celery -A celery_worker flower --port=5555
   # Access at http://localhost:5555
   ```

### Production

Use systemd services for all components:

1. **Celery Worker (systemd service)**:

   **File**: `/etc/systemd/system/cockpit-celery-worker.service`
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
             --pidfile=/var/run/celery/worker.pid \
             --logfile=/var/log/celery/worker.log
   Restart=always
   RestartSec=10

   [Install]
   WantedBy=multi-user.target
   ```

2. **Celery Beat (systemd service)**:

   **File**: `/etc/systemd/system/cockpit-celery-beat.service`
   ```ini
   [Unit]
   Description=Cockpit-NG Celery Beat Scheduler
   After=network.target redis.service

   [Service]
   Type=simple
   User=cockpit-ng
   Group=cockpit-ng
   WorkingDirectory=/app/backend
   ExecStart=/app/venv/bin/celery -A celery_beat beat \
             --loglevel=info \
             --pidfile=/var/run/celery/beat.pid \
             --logfile=/var/log/celery/beat.log
   Restart=always
   RestartSec=10

   [Install]
   WantedBy=multi-user.target
   ```

   **Important**: Only run ONE beat instance per environment!

3. **FastAPI Application** (existing systemd service)

**Enable and start services**:
```bash
sudo systemctl daemon-reload
sudo systemctl enable cockpit-celery-worker cockpit-celery-beat
sudo systemctl start cockpit-celery-worker cockpit-celery-beat
sudo systemctl status cockpit-celery-worker cockpit-celery-beat
```

## Migration Strategy

### Phase 1: Infrastructure Setup
- [ ] Install Redis
- [ ] Install Celery and dependencies (`celery`, `redis`, `celery-redbeat`)
- [ ] Create Celery configuration files (`celery_app.py`, `celery_worker.py`, `celery_beat.py`)
- [ ] Create beat schedule file (`beat_schedule.py`)
- [ ] Set up task directory structure (`tasks/`)
- [ ] Update dependencies in requirements.txt

### Phase 2: Task Migration
Convert existing background jobs to Celery tasks:

1. **Device Onboarding** (`/nautobot/devices/onboard`)
   - Current: APScheduler job
   - New: Celery task `tasks.onboard_device`
   - Type: On-demand (triggered by API)

2. **Configuration Backup** (`/git/*`)
   - Current: Synchronous operations
   - New: Celery task `tasks.backup_device_config`
   - Type: On-demand (triggered by API)

3. **Nautobot/CheckMK Sync** (`/nb2cmk/*`)
   - Current: APScheduler background service (`nb2cmk_background_service.py`)
   - New: Celery Beat periodic task `tasks.sync_nautobot_to_checkmk`
   - Schedule: Every 15 minutes (configurable in `beat_schedule.py`)
   - **Action**: Remove APScheduler service, replace with Beat task

4. **Compliance Checks** (`/compliance-check/*`)
   - Current: Synchronous multi-device checks
   - New: Celery group tasks (parallel execution)
   - Type: On-demand (triggered by API)

### Phase 3: API Integration
- [ ] Create `/api/celery/*` router
- [ ] Implement task submission endpoints
- [ ] Implement task status endpoints
- [ ] Add task cancellation support

### Phase 3: Beat Schedule Management
- [ ] Create periodic tasks in `tasks/periodic_tasks.py`
- [ ] Define schedules in `beat_schedule.py`
- [ ] Add Beat monitoring endpoints (`/api/celery/beat/status`, `/api/celery/schedules`)
- [ ] Test Beat scheduler functionality
- [ ] **Remove APScheduler dependencies and code**

### Phase 4: API Integration
- [ ] Create `/api/celery/*` router
- [ ] Implement task submission endpoints
- [ ] Implement task status endpoints
- [ ] Add task cancellation support
- [ ] Add Beat schedule listing endpoints

### Phase 5: Frontend Integration
- [ ] Update frontend to submit tasks via `/api/celery/*`
- [ ] Add task status polling
- [ ] Show progress updates in UI
- [ ] Handle task completion/errors
- [ ] Display Beat schedule status

## Replacing APScheduler with Celery Beat

### Why Replace APScheduler?

**Current Issues with APScheduler:**
- Runs inside FastAPI application (single point of failure)
- No distributed execution support
- Limited monitoring and management
- Schedule stored in memory (lost on restart)
- Cannot scale horizontally

**Benefits of Celery Beat:**
- ✅ Separate process (isolated from main app)
- ✅ Redis-backed schedule (persistent, survives restarts)
- ✅ Dynamic schedule updates (no code changes needed)
- ✅ Built-in monitoring via Flower
- ✅ Distributed-ready (works in containerized environments)
- ✅ Task history and retry support
- ✅ Better error handling and logging

### Migration Mapping

| APScheduler Component | Celery Beat Equivalent |
|----------------------|------------------------|
| `BackgroundScheduler` | `celery beat` process |
| `@scheduler.scheduled_job()` | Beat schedule in `beat_schedule.py` |
| `scheduler.add_job()` | Add entry to `CELERY_BEAT_SCHEDULE` |
| `scheduler.start()` | `celery -A celery_beat beat` |
| Job interval | `crontab()` or `timedelta()` |
| Job execution | Celery worker picks up task |

### Example Migration

**Before (APScheduler):**
```python
# In main.py or separate service file
from apscheduler.schedulers.background import BackgroundScheduler

scheduler = BackgroundScheduler()

def sync_devices():
    # Sync logic here
    pass

scheduler.add_job(
    sync_devices,
    'interval',
    minutes=15,
    id='sync_nautobot_to_checkmk'
)

scheduler.start()
```

**After (Celery Beat):**

1. Define task in `tasks/periodic_tasks.py`:
```python
@celery_app.task(name='tasks.sync_nautobot_to_checkmk')
def sync_nautobot_to_checkmk():
    # Sync logic here (uses shared services)
    pass
```

2. Add schedule in `beat_schedule.py`:
```python
CELERY_BEAT_SCHEDULE = {
    'sync-nautobot-to-checkmk': {
        'task': 'tasks.sync_nautobot_to_checkmk',
        'schedule': crontab(minute='*/15'),
    }
}
```

3. Start Beat scheduler:
```bash
celery -A celery_beat beat --loglevel=info
```

### Monitoring Beat Tasks

**Via Flower:**
```bash
celery -A celery_worker flower
# Navigate to http://localhost:5555/tasks
```

**Via API:**
```bash
# List all schedules
curl http://localhost:8000/api/celery/schedules

# Check beat status
curl http://localhost:8000/api/celery/beat/status

# Check recent task executions
curl http://localhost:8000/api/celery/tasks
```

**Via Logs:**
```bash
# Beat scheduler logs
tail -f /var/log/celery/beat.log

# Worker logs (shows executed periodic tasks)
tail -f /var/log/celery/worker.log
```

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

2. **Don't access database during module import**
   ```python
   # BAD: Database access at module level (before forking)
   from settings_manager import settings_manager
   config = settings_manager.get_celery_settings()  # Accesses DB!

   # GOOD: Static configuration or lazy loading
   def get_config():
       return {"default": {...}}
   ```

3. **Don't share database connections across processes**
   - NEVER create SQLAlchemy engine at module level in celery_app.py
   - ALWAYS use worker signals to create engines after forking
   - Each worker process MUST have its own isolated engine
   - See `core/celery_signals.py` for proper implementation

4. **Don't forget to import celery_signals**
   ```python
   # BAD: Worker starts without signals
   from celery_app import celery_app
   from tasks import *

   # GOOD: Signals imported before worker starts
   from celery_app import celery_app
   import core.celery_signals  # CRITICAL!
   from tasks import *
   ```

5. **Don't store large objects in results**
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

### Celery Workers
1. **Scalability**: Add more workers to handle increased load
2. **Reliability**: Task retries, failure handling, and monitoring
3. **Performance**: Non-blocking API responses
4. **Isolation**: Task failures don't affect main application
5. **Flexibility**: Easy to add new background tasks
6. **Monitoring**: Built-in task tracking and status

### Celery Beat
1. **Persistent Schedules**: Redis-backed, survives restarts
2. **Dynamic Updates**: Modify schedules without code deployment
3. **Distributed Ready**: Works in containerized/cloud environments
4. **Centralized Scheduling**: All periodic tasks in one place
5. **Better Monitoring**: Flower UI shows all scheduled tasks
6. **No Memory Leaks**: Separate process, can restart independently
7. **Timezone Support**: Built-in UTC/local timezone handling

### Overall System
1. **Unified Platform**: Single system for on-demand and periodic tasks
2. **Production Ready**: Battle-tested in large-scale deployments
3. **Rich Ecosystem**: Plugins, monitoring tools, integrations
4. **Active Development**: Regular updates and security patches

## Troubleshooting

### SIGSEGV / PGRES_TUPLES_OK Errors

**Symptoms**:
- Workers crash with `signal 11 (SIGSEGV)`
- `psycopg2.DatabaseError: error with status PGRES_TUPLES_OK and no message from the libpq`
- Workers fail to start: `WorkerLostError('Could not start worker processes')`

**Root Cause**:
Database connections created before worker processes fork. When workers inherit the same PostgreSQL connection file descriptors, the psycopg2 driver state gets corrupted.

**Solution**:
1. ✅ Ensure `core/celery_signals.py` is imported in worker entry points
2. ✅ Verify NO database access in `celery_app.py` during module import
3. ✅ Check logs for `[Worker Init]` messages confirming signal execution
4. ✅ Verify each worker creates its own engine (check PIDs in logs)

**Expected Logs**:
```
[Worker Main] Celery worker initialized (parent process PID=1234)
[Worker Main] Disposing database engine before forking
[Worker Init] Initializing database engine for PID=1235
[Worker Init] Database engine initialized for PID=1235
[Worker Init] Initializing database engine for PID=1236
[Worker Init] Database engine initialized for PID=1236
[Worker Ready] Celery worker is ready to accept tasks
```

**If Still Failing**:
- Check for other modules accessing database at import time
- Verify `core.celery_signals` is imported BEFORE `from tasks import *`
- Ensure PostgreSQL connection parameters are correct
- Try reducing `pool_size` in worker signal (from 5 to 2)

### Queue Configuration Issues

**Symptom**: Worker tries to listen to queue that doesn't exist

**Solution**:
1. Check if queue is defined in `get_default_queue_configuration()` in `celery_app.py`
2. For custom queues: Set `CELERY_WORKER_QUEUE` env var in docker-compose.yml
3. Verify task routing in `task_routes` configuration
4. Check worker logs for queue configuration messages

**Symptom**: Tasks not being processed

**Solution**:
1. Verify worker is listening to the correct queue: Check startup logs for `Queues: ...`
2. Check task is routed to correct queue: See `task_routes` in celery_app.py
3. Verify queue exists in Redis: `redis-cli KEYS *celery*`
4. Check worker is running: `celery -A celery_worker inspect active`

### Connection Pool Exhaustion

**Symptom**: `QueuePool limit of size X overflow Y reached`

**Solution**:
1. Increase `pool_size` in `core/celery_signals.py` (default: 5)
2. Increase `max_overflow` (default: 10)
3. Reduce worker concurrency: `--concurrency=2`
4. Check for connection leaks: Ensure sessions are closed after use

### Worker Not Starting

**Symptom**: Worker starts but immediately exits

**Solution**:
1. Check Redis is running: `redis-cli ping`
2. Verify Redis URL: Check `CELERY_BROKER_URL` env var
3. Check Python path: Worker needs to find all modules
4. Review worker logs for import errors
5. Verify `core.celery_signals` import doesn't have syntax errors

## References

- [Celery Documentation](https://docs.celeryq.dev/)
- [Celery Beat Documentation](https://docs.celeryq.dev/en/stable/userguide/periodic-tasks.html)
- [Celery RedBeat (Redis Beat Scheduler)](https://github.com/sibson/redbeat)
- [Redis Documentation](https://redis.io/docs/)
- [FastAPI Background Tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/)
- [Celery Best Practices](https://docs.celeryq.dev/en/stable/userguide/tasks.html#best-practices)
- [Flower - Celery Monitoring Tool](https://flower.readthedocs.io/)
- [SQLAlchemy Multi-processing Guide](https://docs.sqlalchemy.org/en/20/core/pooling.html#using-connection-pools-with-multiprocessing)
- [Celery Worker Signals](https://docs.celeryq.dev/en/stable/userguide/signals.html#worker-signals)
