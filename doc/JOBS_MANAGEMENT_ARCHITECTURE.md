# Jobs Management Architecture

## Overview

The Jobs Management system provides a comprehensive framework for defining, scheduling, and executing automation tasks across the infrastructure. It consists of three main components:

1. **Job Templates** - Reusable job definitions with configuration and parameters
2. **Job Schedules** - Time-based triggers for automatic job execution
3. **Job Runs** - Historical execution records with status and results

The system uses a **dispatcher pattern** where jobs are queued via Celery, dispatched by a central orchestrator, and executed by specialized handlers based on job type.

---

## Architecture Diagram

```
┌───────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (Next.js/React)                         │
│                                                                           │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐     │
│  │  Job Templates   │  │  Job Scheduler   │  │  Job Runs/History    │     │
│  │  Page            │  │  Page            │  │  Page                │     │
│  │                  │  │                  │  │                      │     │
│  │  - Create/Edit   │  │  - Create/Edit   │  │  - View runs         │     │
│  │  - Configure     │  │  - Set schedule  │  │  - Filter/search     │     │
│  │  - Delete        │  │  - Enable/disable│  │  - View logs         │     │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────┬───────────┘     │
│           │                     │                       │                 │
└───────────┼─────────────────────┼───────────────────────┼─────────────────┘
            │                     │                       │
            ▼                     ▼                       ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                          BACKEND (FastAPI)                                │
│                                                                           │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐     │
│  │  Templates       │  │  Schedules       │  │  Runs                │     │
│  │  Router          │  │  Router          │  │  Router              │     │
│  │                  │  │                  │  │                      │     │
│  │  /api/job-       │  │  /api/job-       │  │  /api/job-runs       │     │
│  │  templates       │  │  schedules       │  │                      │     │
│  │                  │  │                  │  │  - List runs         │     │
│  │  - CRUD ops      │  │  - CRUD ops      │  │  - Get details       │     │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────┬───────────┘     │
│           │                     │                       │                 │
│           ▼                     ▼                       │                 │
│  ┌──────────────────┐  ┌──────────────────┐             │                 │
│  │  job_template_   │  │  jobs_manager.py │             │                 │
│  │  manager.py      │  │                  │             │                 │
│  │                  │  │  - Calculate     │             │                 │
│  │  - Validate      │  │    next_run      │             │                 │
│  │  - Store config  │  │  - Manage state  │             │                 │
│  └──────────────────┘  └────────┬─────────┘             │                 │
│                                 │                       │                 │
│           ┌─────────────────────┘                       │                 │
│           │                                             │                 │
│           ▼                                             ▼                 │
│  ┌──────────────────────────────────────────────────────────────────┐     │
│  │                    PostgreSQL Database                           │     │
│  │                                                                  │     │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │     │
│  │  │ job_templates   │  │ job_schedules   │  │ job_runs        │   │     │
│  │  │                 │  │                 │  │                 │   │     │
│  │  │ - id            │  │ - id            │  │ - id            │   │     │
│  │  │ - name          │  │ - template_id   │  │ - template_id   │   │     │
│  │  │ - job_type      │  │ - cron/interval │  │ - schedule_id   │   │     │
│  │  │ - config params │  │ - next_run      │  │ - status        │   │     │
│  │  │ - user_id       │  │ - is_active     │  │ - celery_task_id│   │     │
│  │  │ - is_global     │  │ - user_id       │  │ - result        │   │     │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘   │     │
│  └──────────────────────────────────────────────────────────────────┘     │
│                                                                           │
└───────────────────────────────────────────┬───────────────────────────────┘
                                            │
                    ┌───────────────────────┴───────────────────────┐
                    │                                               │
                    ▼                                               ▼
┌─────────────────────────────────────────┐    ┌────────────────────────────────┐
│       CELERY BEAT (Scheduler)           │    │    CELERY WORKERS (Executors)  │
│                                         │    │                                │
│  ┌──────────────────────────────────┐   │    │  ┌──────────────────────────┐  │
│  │  beat_schedule.py                │   │    │  │  Job Dispatcher          │  │
│  │                                  │   │    │  │                          │  │
│  │  "check-job-schedules":          │   │    │  │  tasks/scheduling/       │  │
│  │    task: check_job_schedules     │   │    │  │  job_dispatcher.py       │  │
│  │    schedule: every 1 minute      │   │    │  │                          │  │
│  └────────────┬─────────────────────┘   │    │  │  @shared_task            │  │
│               │                         │    │  │  dispatch_job()          │  │
│               │                         │    │  │                          │  │
│               ▼                         │    │  │  1. Create job_run       │  │
│  ┌──────────────────────────────────┐   │    │  │  2. Route to executor    │  │
│  │  Schedule Checker                │   │    │  │  3. Track progress       │  │
│  │                                  │   │    │  │  4. Update status        │  │
│  │  tasks/scheduling/               │   │    │  └────────────┬─────────────┘  │
│  │  schedule_checker.py             │   │    │               │                │
│  │                                  │   │    │               ▼                │
│  │  @shared_task                    │   │    │  ┌──────────────────────────┐  │
│  │  check_job_schedules_task()      │   │    │  │  Base Executor           │  │
│  │                                  │   │    │  │                          │  │
│  │  - Query due schedules           │   │    │  │  tasks/execution/        │  │
│  │  - Call dispatch_job.delay()     │─────────▶ │  base_executor.py        │  │
│  │  - Update next_run               │   │    │  │                          │  │
│  └──────────────────────────────────┘   │    │  │  execute_job_type()      │  │
│                                         │    │  │                          │  │
└─────────────────────────────────────────┘    │  │  Routes to:              │  │
│                                              │  └────────────┬─────────────┘  │
│                                              │               │                │
│                   ┌──────────────────────────┼───────────────┼────────────────┤
│                   │                          │               │                │
│     ┌─────────────┼──────────────┬───────────┼──────┬────────┼──────────┐     │
│     │             │              │           │      │        │          │     │
│     ▼             ▼              ▼           ▼      ▼        ▼          ▼     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────┐ ┌────────┐  ┌────────┐     │
│  │ Backup  │  │  Sync   │  │ Compare │  │  Run   │ │ Scan   │  │ Cache  │     │
│  │ Executor│  │ Executor│  │ Executor│  │Commands│ │Prefixes│  │Executor│     │
│  │         │  │         │  │         │  │Executor│ │Executor│  │        │     │
│  │ backup_ │  │ sync_   │  │ compare_│  │command_│ │scan_   │  │cache_  │     │
│  │executor │  │executor │  │executor │  │executor│ │prefixes│  │executor│     │
│  │.py      │  │.py      │  │.py      │  │.py     │ │_exec.py│  │.py     │     │
│  └─────────┘  └─────────┘  └─────────┘  └────────┘ └────────┘  └────────┘     │
│                                                                               │
│  Each executor implements job-specific logic:                                 │
│  - Device targeting                                                           │
│  - Configuration loading                                                      │
│  - Progress reporting                                                         │
│  - Result storage                                                             │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Job Templates

### What is a Job Template?

A **Job Template** is a reusable configuration blueprint that defines:
- **What** to do (job type)
- **Where** to do it (inventory/device targeting)
- **How** to do it (parameters, settings, credentials)

Templates separate job configuration from execution, allowing:
- Consistent job definitions across schedules
- Easy modification of job parameters
- Sharing templates across users (global vs private)

### Supported Job Types

The system supports **5 job types**, each with specialized executors:

#### 1. **Backup** (`backup`)
Backup device configurations to Git repository.

**Configuration Parameters:**
- `config_repository_id` - Git repo for storing configs
- `backup_running_config_path` - Path template for running-config (supports variables like `{device_name}`, `{location.name}`)
- `backup_startup_config_path` - Path template for startup-config
- `write_timestamp_to_custom_field` - Write backup timestamp to Nautobot custom field
- `timestamp_custom_field_name` - Custom field name for timestamp
- `parallel_tasks` - Number of parallel backup tasks

**Workflow:**
1. Resolve inventory to device list
2. For each device: SSH connection → execute `show running-config` and `show startup-config`
3. Save configs to Git repository using path templates
4. Commit and push changes
5. Optionally update Nautobot custom field with timestamp

**Executor:** `tasks/execution/backup_executor.py`

#### 2. **Compare Devices** (`compare_devices`)
Compare device configurations between Nautobot and CheckMK.

**Configuration Parameters:**
- `inventory_source` - Target "all" devices or specific inventory
- `inventory_name` - Stored inventory name (if not "all")

**Workflow:**
1. Resolve target devices
2. For each device: Normalize Nautobot data → Fetch CheckMK config → Compare
3. Store comparison results in `nb2cmk_jobs` and `nb2cmk_results` tables
4. Return job_id for viewing in Sync Devices app

**Executor:** `tasks/execution/compare_executor.py`

See [CHECKMK_UPDATE_ARCHITECTURE.md](./CHECKMK_UPDATE_ARCHITECTURE.md) for detailed comparison logic.

#### 3. **Run Commands** (`run_commands`)
Execute CLI commands on devices using stored templates.

**Configuration Parameters:**
- `command_template_name` - Name of command template from Git repo
- `inventory_source` - Target "all" or specific inventory
- `parallel_tasks` - Number of parallel command executions

**Workflow:**
1. Load command template from Git repository
2. Resolve inventory to device list
3. For each device: SSH connection → Execute commands from template
4. Collect and store command output
5. Return aggregated results

**Executor:** `tasks/execution/command_executor.py`

#### 4. **Sync Devices** (`sync_devices`)
Synchronize devices from Nautobot to CheckMK.

**Configuration Parameters:**
- `activate_changes_after_sync` - Auto-activate CheckMK after sync
- `inventory_source` - Target "all" or specific inventory

**Workflow:**
1. Resolve target devices
2. For each device: Normalize Nautobot data → Update/create host in CheckMK
3. Optionally trigger CheckMK activation
4. Store results in job_runs table

**Executor:** `tasks/execution/sync_executor.py`

#### 5. **Scan Prefixes** (`scan_prefixes`)
Scan network prefixes for active hosts and update Nautobot.

**Configuration Parameters:**
- `scan_resolve_dns` - Resolve DNS names
- `scan_ping_count` - Number of ping attempts (1-10)
- `scan_timeout_ms` - Timeout in milliseconds
- `scan_retries` - Retry attempts (0-5)
- `scan_interval_ms` - Interval between scans
- `scan_custom_field_name` - Custom field to filter prefixes
- `scan_custom_field_value` - Value to match
- `scan_response_custom_field_name` - Field to store scan results
- `scan_max_ips` - Maximum IPs to scan

**Workflow:**
1. Query Nautobot for prefixes (optionally filtered by custom field)
2. For each prefix: Scan all IPs using ping/DNS
3. Detect active hosts
4. Update Nautobot with scan results
5. Optionally write results to custom field

**Executor:** `tasks/execution/scan_prefixes_executor.py`

### Template Storage

**Database Table:** `job_templates`

**Key Fields:**
```python
{
    "id": 1,
    "name": "Daily Config Backup",
    "job_type": "backup",
    "description": "Backup all device configs nightly",
    "user_id": 5,               # Owner (null for global)
    "is_global": false,         # Visible to all users?
    "config_repository_id": 3,  # Git repo for configs
    "inventory_source": "all",  # "all" or "inventory"
    "inventory_name": null,     # Inventory name if source="inventory"
    "backup_running_config_path": "backups/{device_name}/running-config.txt",
    "backup_startup_config_path": "backups/{device_name}/startup-config.txt",
    "parallel_tasks": 5,
    "created_at": "2026-01-01T00:00:00Z",
    "created_by": "admin"
}
```

### Template Management

**Manager:** `job_template_manager.py`

**Key Functions:**
- `create_job_template()` - Create new template with validation
- `get_job_template(template_id)` - Retrieve by ID
- `get_user_job_templates(user_id, job_type)` - List user's templates + global
- `update_job_template()` - Modify existing template
- `delete_job_template()` - Remove template
- `get_job_types()` - List available job types with descriptions

**REST API:** `routers/jobs/templates.py`

**Endpoints:**
- `POST /api/job-templates` - Create template
- `GET /api/job-templates` - List templates (user's + global)
- `GET /api/job-templates/{id}` - Get specific template
- `PUT /api/job-templates/{id}` - Update template
- `DELETE /api/job-templates/{id}` - Delete template
- `GET /api/job-templates/types` - Get available job types

---

## 2. Job Schedules

### What is a Job Schedule?

A **Job Schedule** defines **when** to execute a job template:
- **Time-based triggers** (cron expressions, intervals, specific times)
- **Active/inactive** state for enabling/disabling
- **Next run calculation** for predictable execution

### Schedule Types

The system supports **3 schedule types**:

#### 1. **Cron Expression** (`cron`)
Unix cron format for complex schedules.

**Examples:**
```
"0 2 * * *"        # Daily at 2:00 AM
"*/15 * * * *"     # Every 15 minutes
"0 0 * * 0"        # Weekly on Sunday at midnight
"0 0 1 * *"        # Monthly on the 1st at midnight
```

**Implementation:**
```python
from croniter import croniter
from datetime import datetime

cron = croniter("0 2 * * *", datetime.now())
next_run = cron.get_next(datetime)
```

#### 2. **Interval** (`interval`)
Simple repeating interval in minutes.

**Examples:**
- `30` - Every 30 minutes
- `60` - Every hour
- `1440` - Daily (24 hours)

**Implementation:**
```python
from datetime import timedelta

next_run = datetime.now() + timedelta(minutes=interval_minutes)
```

#### 3. **Time of Day** (`time`)
Run at specific time daily.

**Parameters:**
- `start_time` - Time in "HH:MM" format (e.g., "02:30")
- `start_date` - Optional start date

**Example:**
```python
start_time = "02:30"
start_date = "2026-01-01"
# Runs daily at 2:30 AM starting from Jan 1, 2026
```

**Implementation:**
```python
from datetime import datetime, time

today = datetime.now().date()
scheduled_time = time(hour=2, minute=30)
next_run = datetime.combine(today, scheduled_time)
if next_run <= datetime.now():
    next_run = datetime.combine(today + timedelta(days=1), scheduled_time)
```

### Schedule Storage

**Database Table:** `job_schedules`

**Key Fields:**
```python
{
    "id": 1,
    "job_identifier": "nightly-backup",
    "job_template_id": 5,
    "schedule_type": "cron",
    "cron_expression": "0 2 * * *",
    "interval_minutes": null,
    "start_time": null,
    "start_date": null,
    "next_run": "2026-01-04T02:00:00Z",
    "last_run": "2026-01-03T02:00:00Z",
    "is_active": true,
    "is_global": true,
    "user_id": null,
    "credential_id": 2,
    "job_parameters": {"key": "value"},
    "created_at": "2026-01-01T00:00:00Z"
}
```

### Schedule Management

**Manager:** `jobs_manager.py`

**Key Functions:**
- `create_job_schedule()` - Create new schedule with next_run calculation
- `get_job_schedule(job_id)` - Retrieve by ID
- `list_job_schedules(user_id, is_active)` - List schedules
- `update_job_schedule()` - Modify schedule (recalculates next_run if timing changes)
- `calculate_next_run(schedule)` - Calculate next execution time
- `calculate_and_update_next_run(job_id)` - Update next_run after execution
- `delete_job_schedule()` - Remove schedule

**REST API:** `routers/jobs/schedules.py`

**Endpoints:**
- `POST /api/job-schedules` - Create schedule
- `GET /api/job-schedules` - List schedules (user's + global)
- `GET /api/job-schedules/{id}` - Get specific schedule
- `PUT /api/job-schedules/{id}` - Update schedule
- `DELETE /api/job-schedules/{id}` - Delete schedule
- `POST /api/job-schedules/{id}/execute` - Manual execution
- `POST /api/job-schedules/{id}/toggle` - Enable/disable

---

## 3. The Scheduler (Celery Beat)

### How the Scheduler Works

The scheduler uses **Celery Beat** - a periodic task scheduler that runs alongside Celery workers.

### Beat Schedule Configuration

**File:** `beat_schedule.py`

```python
CELERY_BEAT_SCHEDULE = {
    # Job schedule checker - THE HEART OF THE SCHEDULER
    "check-job-schedules": {
        "task": "tasks.check_job_schedules",
        "schedule": crontab(minute="*"),  # Every minute
        "options": {
            "expires": 50,  # Task expires after 50 seconds
        },
    },
    # Other system tasks...
    "worker-health-check": {
        "task": "tasks.worker_health_check",
        "schedule": crontab(minute="*/5"),  # Every 5 minutes
    },
    # ...
}
```

### Schedule Checker Task

**File:** `tasks/scheduling/schedule_checker.py`

The `check_job_schedules_task()` is the **central scheduler** that:

1. **Runs every minute** (triggered by Celery Beat)
2. **Queries active schedules** from database
3. **Checks due jobs** (where `next_run <= now`)
4. **Dispatches due jobs** to Celery queue
5. **Updates next_run** for executed schedules

**Flow Diagram:**

```
Every 1 minute (Celery Beat trigger)
    ↓
check_job_schedules_task()
    ↓
Query: SELECT * FROM job_schedules WHERE is_active = true
    ↓
For each schedule:
    ↓
    next_run <= now?
        ↓ YES
        Load job template (get job_type, config)
        ↓
        Dispatch: dispatch_job.delay(
            schedule_id=schedule.id,
            template_id=template.id,
            job_type=template.job_type,
            ...
        )
        ↓
        Update: next_run = calculate_next_run(schedule)
        ↓
    NO → Skip
    ↓
Return summary: {
    "dispatched_count": 3,
    "dispatched": [
        {"schedule_id": 1, "job_name": "nightly-backup"},
        {"schedule_id": 5, "job_name": "compare-devices"},
        ...
    ]
}
```

**Key Implementation:**

```python
@shared_task(name="tasks.check_job_schedules")
def check_job_schedules_task() -> Dict[str, Any]:
    """Check for due job schedules and dispatch them."""
    now = datetime.now(timezone.utc)
    schedules = jobs_manager.list_job_schedules(is_active=True)
    
    for schedule in schedules:
        next_run = schedule.get("next_run")
        if not next_run or next_run > now:
            continue  # Not due yet
        
        template = job_template_manager.get_job_template(
            schedule["job_template_id"]
        )
        
        # Dispatch job to Celery queue
        dispatch_job.delay(
            schedule_id=schedule["id"],
            template_id=template["id"],
            job_name=schedule["job_identifier"],
            job_type=template["job_type"],
            triggered_by="schedule"
        )
        
        # Update next run time
        jobs_manager.calculate_and_update_next_run(schedule["id"])
```

### Why This Approach?

**Advantages:**
- ✅ **Database-driven** - No code changes needed for new schedules
- ✅ **Flexible** - Supports any schedule type (cron, interval, time)
- ✅ **Scalable** - Single checker handles all schedules
- ✅ **Resilient** - Missed runs can be handled with grace period
- ✅ **User-friendly** - Users create schedules via UI, not code

**Alternative Approaches (Not Used):**
- ❌ Dynamic Celery Beat schedule manipulation (complex, unreliable)
- ❌ Separate beat entry per job (requires celery restart)
- ❌ External scheduler like cron (loses integration)

---

## 4. Job Execution Workflow

### Complete Execution Flow

```
┌────────────────────────────────────────────────────────────────┐
│ TRIGGER: Schedule, Manual, or API                              │
└───────────────────────┬────────────────────────────────────────┘
                        │
        ┌───────────────┴──────────────┐
        │                              │
        ▼ (Scheduled)                  ▼ (Manual/API)
┌──────────────────┐          ┌──────────────────────┐
│ Celery Beat      │          │ Frontend/API         │
│ (every minute)   │          │ User triggers job    │
│                  │          │                      │
│ check_job_       │          │ POST /api/celery/    │
│ schedules_task() │          │ tasks/...            │
└────────┬─────────┘          └──────────┬───────────┘
         │                               │
         │  dispatch_job.delay()         │  dispatch_job.delay()
         └───────────┬───────────────────┘
                     │
                     ▼
         ┌─────────────────────────────────────────┐
         │  CELERY QUEUE                           │
         │  Task queued with parameters:           │
         │  - schedule_id (if scheduled)           │
         │  - template_id                          │
         │  - job_name                             │
         │  - job_type                             │
         │  - target_devices                       │
         │  - triggered_by ("schedule" or "manual")│
         └─────────────────┬───────────────────────┘
                           │
                           ▼
         ┌─────────────────────────────────────────┐
         │  CELERY WORKER picks up task            │
         │                                         │
         │  tasks/scheduling/job_dispatcher.py     │
         │  @shared_task dispatch_job()            │
         └─────────────────┬───────────────────────┘
                           │
                           ▼
         ┌─────────────────────────────────────────┐
         │  STEP 1: Load Template                  │
         │  job_template_manager.get_job_template()│
         │  - Get full configuration               │
         │  - Load inventory settings              │
         │  - Get parameters                       │
         └─────────────────┬───────────────────────┘
                           │
                           ▼
         ┌─────────────────────────────────────────┐
         │  STEP 2: Create Job Run Record          │
         │  job_run_manager.create_job_run()       │
         │  - status: "pending"                    │
         │  - job_run_id generated                 │
         │  - Insert into job_runs table           │
         └─────────────────┬───────────────────────┘
                           │
                           ▼
         ┌─────────────────────────────────────────┐
         │  STEP 3: Mark Job as Started            │
         │  job_run_manager.mark_started()         │
         │  - status: "running"                    │
         │  - started_at: now()                    │
         │  - celery_task_id: task.request.id      │
         └─────────────────┬───────────────────────┘
                           │
                           ▼
         ┌─────────────────────────────────────────┐
         │  STEP 4: Route to Job Type Executor     │
         │  tasks/execution/base_executor.py       │
         │  execute_job_type(job_type, ...)        │
         │                                         │
         │  Job Type Router:                       │
         │  - backup → execute_backup()            │
         │  - sync_devices → execute_sync_devices()│
         │  - compare_devices → execute_compare()  │
         │  - run_commands → execute_commands()    │
         │  - scan_prefixes → execute_scan()       │
         └─────────────────┬───────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │  Backup  │   │   Sync   │   │ Compare  │  ... (other executors)
    │ Executor │   │ Executor │   │ Executor │
    └────┬─────┘   └────┬─────┘   └────┬─────┘
         │              │              │
         │              │              │
         └──────────────┴──────────────┘
                        │
                        ▼
         ┌─────────────────────────────────────────┐
         │  Executor Runs Job-Specific Logic       │
         │                                         │
         │  1. Resolve target devices              │
         │  2. Load configuration/credentials      │
         │  3. For each device/target:             │
         │     a. Perform operation                │
         │     b. Update progress                  │
         │        task_context.update_state(       │
         │          state="PROGRESS",              │
         │          meta={                         │
         │            "current": i,                │
         │            "total": total,              │
         │            "status": "Processing..."    │
         │          }                              │
         │        )                                │
         │  4. Collect results                     │
         │  5. Return result dict                  │
         └─────────────────┬───────────────────────┘
                           │
                           ▼
         ┌─────────────────────────────────────────┐
         │  STEP 5: Mark Job as Completed/Failed   │
         │  job_run_manager.mark_completed() OR    │
         │  job_run_manager.mark_failed()          │
         │                                         │
         │  - status: "completed" or "failed"      │
         │  - completed_at: now()                  │
         │  - result: JSON result                  │
         │  - error_message: error (if failed)     │
         └─────────────────┬───────────────────────┘
                           │
                           ▼
         ┌─────────────────────────────────────────┐
         │  Job Run stored in database             │
         │  Available for viewing in Jobs/Views    │
         └─────────────────────────────────────────┘
```

### Dispatcher Implementation

**File:** `tasks/scheduling/job_dispatcher.py`

```python
@shared_task(bind=True, name="tasks.dispatch_job")
def dispatch_job(
    self,
    schedule_id: Optional[int] = None,
    template_id: Optional[int] = None,
    job_name: str = "unnamed_job",
    job_type: str = None,
    target_devices: Optional[list] = None,
    triggered_by: str = "schedule",
    ...
) -> Dict[str, Any]:
    """
    Dispatch and execute a job based on its type.
    
    This is the CENTRAL ORCHESTRATOR for all job executions.
    """
    # Get template details
    template = job_template_manager.get_job_template(template_id)
    
    # Resolve target devices from template inventory settings
    if not target_devices:
        target_devices = get_target_devices(template, job_parameters)
    
    # Create job run record
    job_run = job_run_manager.create_job_run(
        job_name=job_name,
        job_type=job_type,
        triggered_by=triggered_by,
        job_schedule_id=schedule_id,
        job_template_id=template_id,
        target_devices=target_devices,
    )
    job_run_id = job_run["id"]
    
    # Mark as started
    job_run_manager.mark_started(job_run_id, self.request.id)
    
    # Execute the job via base executor
    result = execute_job_type(
        job_type=job_type,
        schedule_id=schedule_id,
        credential_id=credential_id,
        job_parameters=job_parameters,
        target_devices=target_devices,
        task_context=self,  # Pass Celery task context
        template=template,
        job_run_id=job_run_id,
    )
    
    # Mark as completed or failed
    if result.get("success"):
        job_run_manager.mark_completed(job_run_id, result)
    else:
        job_run_manager.mark_failed(job_run_id, result.get("error"))
    
    return result
```

### Executor Pattern

**File:** `tasks/execution/base_executor.py`

```python
def execute_job_type(
    job_type: str,
    task_context,
    target_devices: Optional[list],
    template: Optional[dict],
    ...
) -> Dict[str, Any]:
    """
    Route job execution to the appropriate executor.
    
    This function maps job_type to executor function.
    """
    job_executors = {
        "backup": execute_backup,
        "sync_devices": execute_sync_devices,
        "compare_devices": execute_compare_devices,
        "run_commands": execute_run_commands,
        "scan_prefixes": execute_scan_prefixes,
    }
    
    executor = job_executors.get(job_type)
    if not executor:
        return {"success": False, "error": f"Unknown job type: {job_type}"}
    
    return executor(
        target_devices=target_devices,
        task_context=task_context,
        template=template,
        ...
    )
```

Each executor follows the same pattern:

```python
def execute_<job_type>(
    target_devices: Optional[list],
    task_context,
    template: dict,
    ...
) -> Dict[str, Any]:
    """Execute specific job type."""
    try:
        # Initialize
        task_context.update_state(
            state="PROGRESS",
            meta={"status": "Initializing..."}
        )
        
        # Process targets
        for i, target in enumerate(target_devices):
            # Update progress
            task_context.update_state(
                state="PROGRESS",
                meta={
                    "current": i + 1,
                    "total": len(target_devices),
                    "status": f"Processing {target}..."
                }
            )
            
            # Perform operation
            result = perform_operation(target)
            
        # Return results
        return {
            "success": True,
            "total": len(target_devices),
            "completed": completed_count,
            "failed": failed_count,
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}
```

---

## 5. Job Runs (Execution History)

### What is a Job Run?

A **Job Run** is a historical record of a job execution, containing:
- **Status** - pending, running, completed, failed
- **Timing** - queued, started, completed timestamps
- **Results** - Success/failure details, error messages
- **Context** - What triggered it, which template/schedule

### Job Run Storage

**Database Table:** `job_runs`

**Key Fields:**
```python
{
    "id": 123,
    "job_schedule_id": 5,        # Schedule that triggered (null if manual)
    "job_template_id": 8,        # Template used
    "job_name": "nightly-backup",
    "job_type": "backup",
    "status": "completed",       # pending, running, completed, failed
    "triggered_by": "schedule",  # "schedule" or "manual"
    "executed_by": "admin",      # Username (for manual runs)
    "target_devices": ["uuid1", "uuid2"],  # JSON array
    "celery_task_id": "abc-123-def",
    "queued_at": "2026-01-03T02:00:00Z",
    "started_at": "2026-01-03T02:00:05Z",
    "completed_at": "2026-01-03T02:15:30Z",
    "duration_seconds": 925,
    "result": {              # JSON result
        "success": true,
        "total": 50,
        "completed": 48,
        "failed": 2
    },
    "error_message": null    # Error details if failed
}
```

### Job Run Management

**Manager:** `job_run_manager.py`

**Key Functions:**
- `create_job_run()` - Create initial record with status "pending"
- `get_job_run(run_id)` - Retrieve by ID
- `get_job_run_by_celery_id(task_id)` - Lookup by Celery task ID
- `list_job_runs(page, filters)` - Paginated list with filters
- `mark_started(run_id, celery_task_id)` - Update to "running" status
- `mark_completed(run_id, result)` - Update to "completed" with results
- `mark_failed(run_id, error)` - Update to "failed" with error
- `get_recent_runs()` - Recent runs for dashboard
- `get_distinct_templates()` - Get template list for filters

**REST API:** `routers/jobs/runs.py`

**Endpoints:**
- `GET /api/job-runs` - List runs with pagination and filters
  - Query params: `page`, `page_size`, `status`, `job_type`, `triggered_by`, `schedule_id`, `template_id`
  - Supports comma-separated multi-values: `?status=completed,failed&job_type=backup,sync_devices`
- `GET /api/job-runs/{id}` - Get specific run details
- `GET /api/job-runs/recent` - Recent runs (simplified for dashboard)
- `GET /api/job-runs/templates` - Distinct templates (for filter dropdown)
- `GET /api/job-runs/dashboard/compare-devices` - Compare devices dashboard data

### Status Transitions

```
pending → running → completed
                 ↘ failed
```

**State Diagram:**

```
┌─────────┐
│ PENDING │  Initial state when job is queued
└────┬────┘
     │ mark_started()
     ▼
┌─────────┐
│ RUNNING │  Job is actively executing
└────┬────┘
     │
     ├─────→ mark_completed() ─────→ ┌───────────┐
     │                               │ COMPLETED │
     │                               └───────────┘
     │
     └─────→ mark_failed() ────────→ ┌─────────┐
                                     │ FAILED  │
                                     └─────────┘
```

---

## 6. Permissions and Security

### Permission Model

Jobs use a **dual-ownership model**:

1. **Global Jobs/Templates/Schedules** - Visible and usable by all users
   - Requires `jobs:write` permission to create/modify
   - Admins have full access

2. **Private Jobs/Templates/Schedules** - Owned by specific user
   - Only owner can see and modify
   - Any authenticated user can create private items

### Permission Checks

**Templates:**
```python
# Creating global template
if template_data.is_global:
    if not rbac_manager.has_permission(user_id, "jobs", "write"):
        raise HTTPException(403, "Permission denied")
```

**Schedules:**
```python
# Viewing schedules
schedules = jobs_manager.get_user_job_schedules(user_id)
# Returns: user's private schedules + all global schedules
```

**Job Runs:**
```python
# Viewing runs - requires jobs:read permission
@router.get("/api/job-runs")
async def list_runs(
    current_user: dict = Depends(require_permission("jobs", "read"))
):
    # All users with jobs:read can view all runs
```

---

## 7. Configuration Examples

### Example 1: Nightly Config Backup

**Job Template:**
```json
{
  "name": "Nightly Config Backup",
  "job_type": "backup",
  "description": "Backup all device configs to Git",
  "config_repository_id": 3,
  "inventory_source": "all",
  "backup_running_config_path": "backups/{location.name}/{device_name}/running-config.txt",
  "backup_startup_config_path": "backups/{location.name}/{device_name}/startup-config.txt",
  "write_timestamp_to_custom_field": true,
  "timestamp_custom_field_name": "last_backup",
  "parallel_tasks": 10,
  "is_global": true
}
```

**Job Schedule:**
```json
{
  "job_identifier": "nightly-backup",
  "job_template_id": 5,
  "schedule_type": "cron",
  "cron_expression": "0 2 * * *",
  "is_active": true,
  "is_global": true
}
```

**Result:**
- Runs every night at 2:00 AM
- Backs up all devices in parallel (10 at a time)
- Organizes configs by location/device
- Updates Nautobot custom field "last_backup"

### Example 2: Hourly Device Comparison

**Job Template:**
```json
{
  "name": "Compare All Devices",
  "job_type": "compare_devices",
  "description": "Compare Nautobot vs CheckMK hourly",
  "inventory_source": "all",
  "is_global": true
}
```

**Job Schedule:**
```json
{
  "job_identifier": "hourly-compare",
  "job_template_id": 8,
  "schedule_type": "interval",
  "interval_minutes": 60,
  "is_active": true,
  "is_global": true
}
```

**Result:**
- Runs every hour
- Compares all devices
- Stores results in `nb2cmk_jobs` table
- Viewable in Sync Devices app

### Example 3: Morning Sync with Activation

**Job Template:**
```json
{
  "name": "Morning Device Sync",
  "job_type": "sync_devices",
  "description": "Sync devices and activate CheckMK",
  "inventory_source": "inventory",
  "inventory_repository_id": 2,
  "inventory_name": "production_devices",
  "activate_changes_after_sync": true,
  "is_global": true
}
```

**Job Schedule:**
```json
{
  "job_identifier": "morning-sync",
  "job_template_id": 12,
  "schedule_type": "time",
  "start_time": "07:00",
  "is_active": true,
  "is_global": true
}
```

**Result:**
- Runs daily at 7:00 AM
- Syncs only devices from "production_devices" inventory
- Auto-activates CheckMK changes after sync

---

## 8. Monitoring and Troubleshooting

### Monitoring Job Health

**System Health Tasks:**

1. **Worker Health Check** - `tasks/periodic_tasks.py::worker_health_check()`
   - Runs every 5 minutes
   - Checks worker connectivity
   - Logs worker status

2. **Schedule Checker** - `tasks/scheduling/schedule_checker.py::check_job_schedules_task()`
   - Runs every minute
   - Returns dispatch summary
   - Logs errors for failed dispatches

### Viewing Job Status

**Frontend Pages:**

1. **Job Templates** - `/jobs/templates`
   - View all templates
   - Create/edit/delete templates
   - See which schedules use each template

2. **Job Scheduler** - `/jobs/scheduler`
   - View all schedules
   - Enable/disable schedules
   - Manual execution
   - Next run times

3. **Job Runs** - `/jobs/views`
   - Paginated run history
   - Filter by status, type, trigger
   - View run details and logs
   - Duration statistics

### Common Issues

**Issue 1: Schedule Not Running**

**Symptoms:** Schedule is active but next_run doesn't update

**Diagnosis:**
```bash
# Check if Celery Beat is running
ps aux | grep celery | grep beat

# Check schedule in database
psql -d cockpit -c "SELECT id, job_identifier, next_run, is_active FROM job_schedules WHERE id = 5;"

# Check recent beat logs
tail -f logs/celery_beat.log | grep "check-job-schedules"
```

**Solutions:**
- Ensure Celery Beat process is running
- Check `is_active` is true
- Verify `next_run` is in the past
- Check for beat scheduler errors in logs

**Issue 2: Job Fails Immediately**

**Symptoms:** Job status goes to "failed" quickly

**Diagnosis:**
```bash
# Check job run details
curl http://localhost:8000/api/job-runs/123

# Check Celery worker logs
tail -f logs/celery_worker.log | grep "dispatch_job"

# Check for missing template
psql -d cockpit -c "SELECT * FROM job_templates WHERE id = 8;"
```

**Solutions:**
- Verify template exists and is valid
- Check template configuration (e.g., valid repository IDs)
- Ensure credentials are configured
- Check executor logs for specific errors

**Issue 3: Jobs Queued But Not Executing**

**Symptoms:** Status stuck on "pending"

**Diagnosis:**
```bash
# Check if workers are running
celery -A celery_app inspect active

# Check queue depth
celery -A celery_app inspect reserved

# Check for worker failures
tail -f logs/celery_worker.log
```

**Solutions:**
- Start Celery workers if not running
- Check Redis connectivity
- Increase worker concurrency if overloaded
- Check for task timeout issues

---

## 9. Extension Points

### Adding a New Job Type

To add a new job type (e.g., "deploy_configs"):

**Step 1:** Add to job types list

`job_template_manager.py`:
```python
def get_job_types():
    return [
        # ...existing types...
        {
            "value": "deploy_configs",
            "label": "Deploy Configs",
            "description": "Deploy configurations to devices",
        },
    ]
```

**Step 2:** Create executor

`tasks/execution/deploy_executor.py`:
```python
def execute_deploy_configs(
    target_devices: Optional[list],
    task_context,
    template: dict,
    ...
) -> Dict[str, Any]:
    """Execute config deployment."""
    # Implementation here
    return {"success": True, ...}
```

**Step 3:** Register in base executor

`tasks/execution/base_executor.py`:
```python
from .deploy_executor import execute_deploy_configs

job_executors = {
    # ...existing executors...
    "deploy_configs": execute_deploy_configs,
}
```

**Step 4:** Add template fields (if needed)

`models/job_templates.py`:
```python
class JobTemplateBase(BaseModel):
    # ...existing fields...
    deploy_config_path: Optional[str] = Field(None, ...)
```

**Step 5:** Update frontend

Add to frontend job type selection and configuration forms.

### Custom Schedule Types

To add custom schedule logic, modify:

`jobs_manager.py::calculate_next_run()`:
```python
def calculate_next_run(schedule: Dict[str, Any]) -> Optional[datetime]:
    schedule_type = schedule.get("schedule_type")
    
    if schedule_type == "custom_type":
        # Custom calculation logic
        return custom_next_run_calculation(schedule)
    
    # ...existing logic...
```

---

## 10. Summary

### Key Components

| Component | Purpose | Storage | Management |
|-----------|---------|---------|------------|
| **Job Templates** | Reusable job configurations | `job_templates` table | `job_template_manager.py` |
| **Job Schedules** | Time-based execution triggers | `job_schedules` table | `jobs_manager.py` |
| **Job Runs** | Execution history | `job_runs` table | `job_run_manager.py` |
| **Scheduler** | Periodic schedule checker | Celery Beat + Redis | `schedule_checker.py` |
| **Dispatcher** | Job orchestration | Celery workers | `job_dispatcher.py` |
| **Executors** | Job-specific logic | N/A | `tasks/execution/*.py` |

### Workflow Summary

```
Template Created
    ↓
Schedule Created (references template)
    ↓
Celery Beat runs check_job_schedules_task() every minute
    ↓
Schedule is due? → dispatch_job.delay()
    ↓
Job Dispatcher creates job_run record
    ↓
Base Executor routes to job-type executor
    ↓
Executor performs operations, updates progress
    ↓
Job Run updated with results
    ↓
Available for viewing in Jobs/Views
```

### Design Principles

1. **Separation of Concerns**
   - Templates define WHAT
   - Schedules define WHEN
   - Executors define HOW
   - Dispatchers define WHO/WHERE

2. **Database-Driven**
   - All configuration in PostgreSQL
   - No code changes for new jobs/schedules
   - Dynamic at runtime

3. **Extensible**
   - New job types via new executors
   - Custom schedule logic via calculation functions
   - Plugin-like architecture

4. **Observable**
   - All runs tracked in database
   - Progress reporting via Celery state
   - Comprehensive logging

5. **Resilient**
   - Missed schedules handled gracefully
   - Failed jobs don't affect others
   - Worker failures isolated

### Best Practices

**For Users:**
- Create templates first, then schedules
- Use global templates for shared jobs
- Test with manual execution before scheduling
- Monitor job runs regularly

**For Developers:**
- Follow executor pattern for new job types
- Update progress frequently in long-running jobs
- Return structured results (success, counts, errors)
- Log extensively for troubleshooting

**For Administrators:**
- Monitor Celery Beat and worker health
- Set appropriate worker concurrency
- Configure Redis persistence
- Regularly review failed jobs

---

## Conclusion

The Jobs Management system provides a **powerful, flexible, and scalable** framework for automation. Its architecture enables:

- **Easy Configuration** - Users create jobs via UI, no code changes
- **Reliable Scheduling** - Database-driven scheduler with predictable execution
- **Extensible Design** - New job types added via modular executors
- **Complete Observability** - Full execution history and progress tracking
- **User Isolation** - Global vs private jobs with permission controls

The **dispatcher pattern** ensures consistent job execution across all job types, while **specialized executors** handle job-specific logic. This separation makes the system maintainable and allows independent evolution of scheduling and execution concerns.
