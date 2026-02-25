# Plan: Resolving the Dual Celery Task Registration Problem

## Problem Statement

A Celery-based job execution system accumulates a critical dual-registration bug over time.
A legacy monolith (e.g. `job_tasks.py`) registers Celery tasks via `@celery_app.task` under
the same names as a newer modular structure that uses `@shared_task`. Which implementation
wins depends on Python import order — a fragile, invisible contract.

Symptoms:
- Routers import directly from the monolith, triggering its `@celery_app.task` decorators
- The decorators overwrite the `@shared_task` registrations from the modular structure
- The modular executor only handles a subset of job types, so if it wins the registration race,
  all other job types fail with "Unknown job type"
- Schedule execute endpoints use a legacy `get_task_for_job()` lookup that returns `None` for
  all modern job types, silently breaking manual execution

---

## Goal

Promote the modular structure (`scheduling/`, `execution/`) as the sole source of truth.
Delete the monolith entirely. No duplicate registrations. All routers import from the
top-level `tasks` package.

---

## Target Architecture

```
backend/tasks/
├── __init__.py                    # Re-exports dispatch_job, check_job_schedules_task
├── scheduling/                    # SOLE Celery task entry points
│   ├── schedule_checker.py        # @shared_task("tasks.check_job_schedules")
│   └── job_dispatcher.py          # @shared_task("tasks.dispatch_job")
├── execution/                     # All job type executors
│   ├── __init__.py
│   ├── base_executor.py           # Routes all job types via dict dispatch
│   ├── check_queues_executor.py
│   ├── run_commands_executor.py   # Extracted from monolith
│   └── backup_executor.py        # Extracted from monolith
└── utils/
# job_tasks.py                    ← DELETED
```

---

## Step-by-Step Implementation

### Step 1 — Audit the monolith

Before touching anything, identify all components in the monolith:

1. **Celery task registrations** — any `@celery_app.task` or `@shared_task` decorators.
   These are the duplicate registrations that must be removed.

2. **Executor functions** — functions that do actual work (e.g. `_execute_run_commands`,
   `_execute_backup`). These need to be extracted into `execution/`.

3. **Helper functions** — utilities called by the executor functions (check if they already
   exist in `tasks/utils/`; if so, the monolith is already dead code).

4. **Legacy task mapping** — a dict or function like `JOB_TASK_MAPPING` / `get_task_for_job()`
   that maps job identifiers to old task functions. This is the root cause of broken manual
   execution and must be replaced.

5. **Router imports** — grep for `from tasks.job_tasks import` across all routers.
   Each import needs to be updated before the file can be deleted.

```bash
grep -rn "job_tasks" backend/ --include="*.py"
```

---

### Step 2 — Verify the modular scheduler is complete

Check that `scheduling/job_dispatcher.py` already:

- Uses `@shared_task(bind=True, name="tasks.dispatch_job")`
- Accepts `job_type`, `template_id`, `schedule_id`, `credential_id`, `job_parameters`,
  `triggered_by`, `executed_by` as parameters
- Calls `execute_job_type()` from `tasks.execution.base_executor`
- Passes `job_run_id` through to the executor
- Resolves target devices via a helper (not inline asyncio)

If any of these are missing, fix them before proceeding. The dispatcher is the authoritative
entry point — it must be complete before the monolith is removed.

Check that `tasks/__init__.py` re-exports from `scheduling/`:

```python
from .scheduling import check_job_schedules_task, dispatch_job
```

If it doesn't, add it now. This is what routers will import from.

---

### Step 3 — Extract executor functions from the monolith

For each executor function in the monolith, create a file in `tasks/execution/`:

**Naming convention:**
- Monolith: `_execute_run_commands(...)` (private, underscore prefix)
- New file: `tasks/execution/run_commands_executor.py`
- Public function: `execute_run_commands(...)` (no underscore)

**Signature pattern** (add `job_run_id` if not already present):
```python
def execute_run_commands(
    schedule_id: Optional[int],
    credential_id: Optional[int],
    job_parameters: Optional[dict],
    target_devices: Optional[list],
    task_context,
    template: Optional[dict] = None,
    job_run_id: Optional[int] = None,
) -> Dict[str, Any]:
```

**Rules during extraction:**
- Copy the function body verbatim — do not refactor logic during a structural move
- Keep all imports as absolute paths (they work unchanged in the new location)
- Fix any f-string logging violations (`logger.info(f"...")` → `logger.info("...", var)`)
  since these violate style guides and are easy to fix during the move
- Do NOT fix asyncio anti-patterns (manual `event_loop` creation) — that's a separate task

**For removed integrations** (e.g. CheckMK services that no longer exist), do not create
a real executor file. Instead, add inline stubs directly in `base_executor.py` (see Step 4).

---

### Step 4 — Update `base_executor.py` to route all job types

Replace the partial job type mapping with a complete one. For any job type whose integration
has been removed, add an inline stub rather than a separate file:

```python
from .check_queues_executor import execute_check_queues
from .run_commands_executor import execute_run_commands
from .backup_executor import execute_backup

def _stub_sync_devices(schedule_id, credential_id, job_parameters,
                       target_devices, task_context, template=None, job_run_id=None):
    logger.warning("execute_job_type: sync_devices is not available (integration removed)")
    return {"success": False, "error": "sync_devices is not available in this version"}

def _stub_compare_devices(schedule_id, credential_id, job_parameters,
                          target_devices, task_context, template=None, job_run_id=None):
    logger.warning("execute_job_type: compare_devices is not available (integration removed)")
    return {"success": False, "error": "compare_devices is not available in this version"}

job_executors = {
    "check_queues":   execute_check_queues,
    "run_commands":   execute_run_commands,
    "backup":         execute_backup,
    "sync_devices":   _stub_sync_devices,
    "compare_devices": _stub_compare_devices,
}
```

The function should return `{"success": False, "error": "Unknown job type: {job_type}"}` for
anything not in the dict — not raise an exception.

---

### Step 5 — Update `tasks/execution/__init__.py`

Export all executors so they are importable as `from tasks.execution import execute_run_commands`:

```python
from .base_executor import execute_job_type
from .check_queues_executor import execute_check_queues
from .run_commands_executor import execute_run_commands
from .backup_executor import execute_backup

__all__ = [
    "execute_job_type",
    "execute_check_queues",
    "execute_run_commands",
    "execute_backup",
]
```

---

### Step 6 — Update router imports

For every router that imports from the monolith, change it to import from the `tasks` package:

```python
# Before
from tasks.job_tasks import dispatch_job

# After
from tasks import dispatch_job
```

The `.delay()` call at the call site is unchanged.

Common locations to check:
- `routers/jobs/celery_api.py` — any endpoint that manually triggers a job
- `routers/jobs/runs.py` — manual execution endpoint
- `routers/jobs/schedules.py` — schedule execute endpoint (see Step 7)

---

### Step 7 — Fix broken schedule execute endpoints

The schedule execute endpoint is typically broken in a subtle way: it calls
`get_task_for_job(job.get("job_identifier"))` which returns `None` for modern job types
because the identifier strings never match the legacy `JOB_TASK_MAPPING` keys.

Replace the entire legacy dispatch block with a direct call to `dispatch_job.delay()`,
mirroring the pattern already used in the manual runs endpoint:

```python
# Resolve the template — required to know the job_type
import job_template_manager
from tasks import dispatch_job

template_id = job.get("job_template_id")
if not template_id:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Schedule has no associated template. Please edit the schedule and select a job template.",
    )

template = job_template_manager.get_job_template(template_id)
if not template:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Template {template_id} not found",
    )

# Merge parameters: schedule base + optional request overrides
job_parameters = job.get("job_parameters") or {}
if execution_request.override_parameters:
    job_parameters.update(execution_request.override_parameters)

celery_task = dispatch_job.delay(
    schedule_id=execution_request.job_schedule_id,
    template_id=template_id,
    job_name=job.get("job_identifier", f"manual-{execution_request.job_schedule_id}"),
    job_type=template.get("job_type"),
    credential_id=job.get("credential_id"),
    job_parameters=job_parameters if job_parameters else None,
    triggered_by="manual",
    executed_by=current_user.get("username", "unknown"),
)

logger.info(
    "Job execution started: %s (Celery task ID: %s) by user %s",
    job.get("job_identifier"),
    celery_task.id,
    current_user["username"],
)

return {
    "message": "Job execution started",
    "job_id": execution_request.job_schedule_id,
    "job_name": job.get("job_identifier"),
    "celery_task_id": celery_task.id,
    "status": "queued",
}
```

**Note:** Remove any manual `update_job_run_times()` calls here. The dispatcher already
creates a `JobRun` record with accurate timestamps. Manually updating `last_run` on the
schedule for manual executions is redundant.

---

### Step 8 — Delete the monolith

Only after all import changes are in place and verified:

```bash
rm backend/tasks/job_tasks.py
```

This removes:
- Duplicate Celery task registrations
- The legacy `JOB_TASK_MAPPING` / `get_task_for_job()` mechanism
- Dead code for removed integrations

**Do this last.** Deleting first and fixing imports second causes confusion because Python
will raise `ModuleNotFoundError` on startup, hiding which files still have stale imports.

---

## Verification

### 1. Confirm no remaining references
```bash
grep -rn "from tasks.job_tasks\|import job_tasks" backend/ --include="*.py"
# Expected: 0 matches
```

### 2. Syntax check each new file
```bash
cd backend
python -c "from tasks.execution.run_commands_executor import execute_run_commands; print('OK')"
python -c "from tasks.execution.backup_executor import execute_backup; print('OK')"
python -c "from tasks.execution.base_executor import execute_job_type; print('OK')"
```

### 3. Full task import chain (simulates Celery worker startup)
```bash
python -c "from tasks import dispatch_job, check_job_schedules_task; print('OK')"
```

### 4. Router import verification
```bash
python -c "from routers.jobs.celery_api import router; print('OK')"
python -c "from routers.jobs.runs import router; print('OK')"
python -c "from routers.jobs.schedules import router; print('OK')"
```

### 5. Celery worker — confirm single registration
Start the worker and look for duplicate task name warnings:
```bash
celery -A celery_app worker --loglevel=info 2>&1 | grep "tasks.dispatch_job"
# Should appear exactly once
```

### 6. End-to-end smoke tests
1. Trigger a job via the API → confirm a task ID is returned
2. Poll task status → confirm it completes without "Unknown job type" error
3. Click "Execute Now" on a schedule in the UI → confirm a `JobRun` record is created
4. Check Celery worker logs → confirm only ONE registration for each task name

---

## Files Summary

| File | Action |
|------|--------|
| `tasks/execution/{type}_executor.py` | CREATE — one file per job type, extracted from monolith |
| `tasks/execution/base_executor.py` | MODIFY — register all job types + inline stubs for removed ones |
| `tasks/execution/__init__.py` | MODIFY — export new executors |
| `tasks/scheduling/job_dispatcher.py` | VERIFY — should already be correct |
| `tasks/scheduling/schedule_checker.py` | VERIFY — should already be correct |
| `tasks/__init__.py` | VERIFY — should already re-export from `scheduling/` |
| `routers/jobs/celery_api.py` | MODIFY — change import to `from tasks import dispatch_job` |
| `routers/jobs/runs.py` | MODIFY — change import to `from tasks import dispatch_job` |
| `routers/jobs/schedules.py` | MODIFY — rewrite execute endpoint, remove legacy task lookup |
| `tasks/job_tasks.py` | DELETE — do this last |

---

## Out of Scope / Follow-Up

These issues are pre-existing and should be fixed in a separate pass:

- **F-string logging violations** — `logger.info(f"...")` should use `logger.info("...", var)`.
  Most linters and style guides flag this because f-strings always evaluate even when the log
  level is suppressed.
- **Asyncio anti-pattern** — manual `asyncio.new_event_loop()` creation in sync Celery tasks.
  The structural migration preserves this as-is to reduce risk. A follow-up should replace it
  with a proper sync wrapper (see existing `resolve_inventory_to_device_ids_sync()` as a model).
- **Dead unreachable code** — any code after `return` in a `try` block (e.g. the legacy
  compare executor that had `if not device_ids:` after an unconditional `return`).
