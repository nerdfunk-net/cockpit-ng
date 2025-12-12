# Scheduling Architecture: Celery Beat vs APScheduler

## Quick Answer

**Your system primarily uses Celery Beat** for job scheduling, with minimal legacy APScheduler code remaining.

---

## Architecture Overview

### **Celery Beat** ✅ (Primary Scheduler)

**Purpose**: Distributed, persistent task scheduler for Celery

**Used For**:
- ✅ User-created job schedules (backup, sync, compare, etc.)
- ✅ System maintenance tasks (health checks, cleanup)
- ✅ Cache refresh tasks (devices, locations, git commits)

**How It Works**:
```
Celery Beat Process (separate process)
    ↓
Runs "check-job-schedules" every minute
    ↓
check_job_schedules_task() executes
    ↓
Queries database for due schedules
    ↓
Dispatches job_dispatcher_task() for each due schedule
    ↓
Job executes in Celery Worker
```

---

### **APScheduler** ⚠️ (Legacy, Minimal Use)

**Purpose**: In-process Python job scheduler

**Used For**:
- ⚠️ Device cache prefetch on startup (legacy code)
- ⚠️ Being phased out

**Status**: Legacy code that should be removed in favor of Celery Beat

---

## Detailed Comparison

| Feature | Celery Beat ✅ | APScheduler ⚠️ |
|---------|---------------|----------------|
| **Process Model** | Separate process | In-process (FastAPI) |
| **Persistence** | Database-backed schedules | In-memory (lost on restart) |
| **Distribution** | Multi-worker support | Single process only |
| **Scalability** | Scales horizontally | Limited to one instance |
| **Reliability** | Survives restarts | Lost on restart |
| **Use in System** | Primary scheduler | Legacy only |
| **User Jobs** | ✅ All user schedules | ❌ None |
| **System Tasks** | ✅ Health checks, cleanup | ⚠️ Startup cache only |

---

## Celery Beat Architecture

### Components

```
┌──────────────────────────────────────────────────────────────┐
│                     CELERY BEAT PROCESS                       │
│                  (python start_beat.py)                       │
│                                                               │
│  Reads: beat_schedule.py                                     │
│  ┌────────────────────────────────────────────────────┐     │
│  │ CELERY_BEAT_SCHEDULE = {                           │     │
│  │   "check-job-schedules": {                         │     │
│  │     "task": "tasks.check_job_schedules",           │     │
│  │     "schedule": crontab(minute="*")  # Every min   │     │
│  │   },                                               │     │
│  │   "worker-health-check": {                         │     │
│  │     "schedule": crontab(minute="*/5")  # Every 5m  │     │
│  │   },                                               │     │
│  │   "load-cache-schedules": {                        │     │
│  │     "schedule": crontab(minute="*")    # Every min │     │
│  │   },                                               │     │
│  │   "cleanup-celery-data": {                         │     │
│  │     "schedule": crontab(hour="*/6")    # Every 6h  │     │
│  │   }                                                │     │
│  │ }                                                  │     │
│  └────────────────────────────────────────────────────┘     │
│                                                               │
│  Every minute @ XX:XX:00:                                    │
│    → Sends "tasks.check_job_schedules" to queue             │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                    CELERY WORKER PROCESS                      │
│                                                               │
│  Receives: tasks.check_job_schedules                         │
│  Executes: check_job_schedules_task()                        │
│                                                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │ def check_job_schedules_task():                    │     │
│  │     now = datetime.now(timezone.utc)               │     │
│  │                                                     │     │
│  │     # Query database for due schedules             │     │
│  │     schedules = jobs_manager.list_job_schedules(   │     │
│  │         is_active=True                             │     │
│  │     )                                              │     │
│  │                                                     │     │
│  │     for schedule in schedules:                     │     │
│  │         if schedule.next_run <= now:               │     │
│  │             # Dispatch the job                     │     │
│  │             job_dispatcher_task.delay(             │     │
│  │                 template_id=schedule.template_id,  │     │
│  │                 schedule_id=schedule.id,           │     │
│  │                 credential_id=schedule.credential_id│     │
│  │             )                                      │     │
│  │                                                     │     │
│  │             # Update next run time                 │     │
│  │             calculate_next_run(schedule)           │     │
│  └────────────────────────────────────────────────────┘     │
│                                                               │
│  Result: job_dispatcher_task sent to queue                   │
└───────────────────────────┬───────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                    CELERY WORKER PROCESS                      │
│                                                               │
│  Receives: job_dispatcher_task                               │
│  Executes: Job dispatcher → Executor → Backup/Sync/etc       │
└──────────────────────────────────────────────────────────────┘
```

---

## How User Job Schedules Work

### Database Storage

**Table**: `job_schedules`

```sql
CREATE TABLE job_schedules (
    id INTEGER PRIMARY KEY,
    name TEXT,
    job_template_id INTEGER,
    schedule_type TEXT,  -- "cron", "interval", "once"
    cron_expression TEXT,  -- "0 2 * * *" (daily at 2am)
    next_run TIMESTAMP,  -- Calculated next execution time
    is_active BOOLEAN,
    credential_id INTEGER,
    created_by TEXT
);
```

**Example Record**:
```json
{
  "id": 99,
  "name": "Daily Router Backup",
  "job_template_id": 42,
  "schedule_type": "cron",
  "cron_expression": "0 2 * * *",
  "next_run": "2025-12-13 02:00:00",
  "is_active": true,
  "credential_id": 7,
  "created_by": "admin"
}
```

---

### Complete Flow

```
┌──────────────────────────────────────────────────────┐
│ 1. USER CREATES SCHEDULE                             │
│    POST /api/job-schedules                           │
│    {                                                  │
│      "template_id": 42,  # Backup template           │
│      "cron_expression": "0 2 * * *",  # Daily 2am    │
│      "credential_id": 7                              │
│    }                                                  │
│                                                       │
│    → Stored in job_schedules table                   │
│    → next_run calculated: 2025-12-13 02:00:00        │
└───────────────────────────┬───────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────┐
│ 2. CELERY BEAT - CONTINUOUS MONITORING               │
│    Every minute, Celery Beat triggers:               │
│    "tasks.check_job_schedules"                       │
└───────────────────────────┬───────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────┐
│ 3. CHECK DATABASE (Every Minute)                     │
│    Time: 02:00:15 on 2025-12-13                      │
│                                                       │
│    SQL Query:                                         │
│    SELECT * FROM job_schedules                       │
│    WHERE is_active = true                            │
│      AND next_run <= '2025-12-13 02:00:15'           │
│                                                       │
│    Found: Schedule ID 99                             │
│    - Template: 42 (Backup)                           │
│    - next_run: 02:00:00 (DUE!)                       │
└───────────────────────────┬───────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────┐
│ 4. DISPATCH JOB                                       │
│    job_dispatcher_task.delay(                        │
│        template_id=42,                               │
│        schedule_id=99,                               │
│        credential_id=7,                              │
│        triggered_by="schedule"                       │
│    )                                                  │
└───────────────────────────┬───────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────┐
│ 5. UPDATE NEXT RUN TIME                              │
│    Calculate next run from cron: "0 2 * * *"         │
│    → next_run = 2025-12-14 02:00:00                  │
│                                                       │
│    UPDATE job_schedules                              │
│    SET next_run = '2025-12-14 02:00:00'              │
│    WHERE id = 99                                     │
└───────────────────────────┬───────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────┐
│ 6. JOB EXECUTES                                       │
│    (Continue with backup workflow)                   │
│    - Load template                                    │
│    - Convert inventory to device IDs                 │
│    - Execute backup on devices                       │
└──────────────────────────────────────────────────────┘
```

---

## Key Files

### Celery Beat Configuration

**File**: `/backend/beat_schedule.py`
```python
CELERY_BEAT_SCHEDULE = {
    "check-job-schedules": {
        "task": "tasks.check_job_schedules",
        "schedule": crontab(minute="*"),  # Every minute
        "options": {"expires": 50},
    },
    # ... other system tasks
}
```

### Schedule Checker

**File**: `/backend/tasks/job_tasks.py`
```python
@celery_app.task(name="tasks.check_job_schedules")
def check_job_schedules_task() -> dict:
    """
    Runs every minute via Celery Beat.
    Checks database for due schedules and dispatches them.
    """
    now = datetime.now(timezone.utc)
    schedules = jobs_manager.list_job_schedules(is_active=True)

    for schedule in schedules:
        if schedule.next_run <= now:
            # Dispatch job
            job_dispatcher_task.delay(...)
            # Update next_run
            update_schedule_next_run(schedule)
```

### Startup Script

**File**: `/backend/start_beat.py`
```python
"""
Start Celery Beat scheduler process.
Equivalent to: celery -A celery_beat beat --loglevel=info
"""
```

---

## Why Celery Beat Instead of APScheduler?

### Requirements for Production System

1. **Distributed Execution** ✅
   - Multiple workers can execute jobs
   - Celery Beat: ✅ Sends to worker queue
   - APScheduler: ❌ Runs in same process

2. **Persistent Schedules** ✅
   - Survives application restarts
   - Celery Beat: ✅ Database-backed
   - APScheduler: ❌ In-memory

3. **Scalability** ✅
   - Handle increasing load
   - Celery Beat: ✅ Add more workers
   - APScheduler: ❌ Single process limit

4. **Monitoring & Debugging** ✅
   - Track job execution
   - Celery Beat: ✅ Celery monitoring tools
   - APScheduler: ❌ Limited tooling

5. **Reliability** ✅
   - Ensure jobs execute
   - Celery Beat: ✅ Queue persistence, retries
   - APScheduler: ❌ Lost if process crashes

---

## Running Celery Beat

### Development

```bash
cd backend

# Terminal 1: Start Celery Worker
celery -A celery_app worker --loglevel=info

# Terminal 2: Start Celery Beat
python start_beat.py
# or: celery -A celery_beat beat --loglevel=info

# Terminal 3: Start FastAPI
python start.py
```

### Production

```bash
# Run as systemd services or supervisord
celery -A celery_app worker --loglevel=info &
celery -A celery_beat beat --loglevel=info &
uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## APScheduler Legacy Code (To Be Removed)

### Current Limited Usage

**File**: `/backend/main.py`
```python
# Only used for startup device cache (legacy)
apscheduler_service = APSchedulerService()

@app.on_event("startup")
async def startup():
    # Trigger device cache prefetch
    await apscheduler_service.start_get_all_devices_job(username="system")
```

**Status**: ⚠️ Should be migrated to Celery startup task

---

## Summary

### What Celery Beat Does
- Runs as a separate process
- Reads schedule definitions from `beat_schedule.py`
- Sends periodic tasks to Celery worker queue
- Main task: `check_job_schedules` (every minute)
- This task checks database for due user job schedules
- Dispatches jobs that are due

### What APScheduler Did (Legacy)
- Ran in-process with FastAPI
- Only used for device cache on startup
- Being phased out

### The Confusion
- Both exist in the code
- APScheduler is mostly unused (legacy)
- Celery Beat is the primary scheduler
- User job schedules use Celery Beat exclusively

---

## Related Documentation

- [BACKUP_WORKFLOW.md](BACKUP_WORKFLOW.md) - Complete backup task workflow
- [CUSTOM_FIELD_TYPE_FIX.md](CUSTOM_FIELD_TYPE_FIX.md) - Custom field type handling
- [CLAUDE.md](CLAUDE.md) - Architecture guide

---

**Last Updated**: 2025-12-12
**Version**: 1.0
**Status**: ✅ Documented
