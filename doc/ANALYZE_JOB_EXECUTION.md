# Job Execution Architecture Analysis

> Analysis date: 2026-02-25
> Scope: `backend/tasks/`, Celery configuration, job routers, job managers

---

## Executive Summary

The job execution system has a **dual-implementation problem**: an older monolithic
module (`job_tasks.py`, 1 736 lines) coexists alongside a newer modular structure
(`tasks/scheduling/`, `tasks/execution/`). Both register Celery tasks under
**identical names**, creating a race condition where the last module imported wins.
The active code path currently runs through the monolith; the modular structure is
partially dead code.

**Severity breakdown:**

| Severity | Count | Issues |
|----------|-------|--------|
| Critical | 2 | Duplicate Celery task registration, unreachable job types |
| High | 3 | Dead legacy tasks, orphaned dispatch path, stale helper duplication |
| Medium | 4 | Missing `job_run_id` propagation, `asyncio` anti-patterns, scaffold code, inconsistent logging |
| Low | 3 | f-strings in logging, inconsistent decorator usage, code style |

---

## Architecture Overview

### Current Module Layout

```
backend/tasks/
├── __init__.py                    # Imports from scheduling/ (the "new" modules)
├── job_tasks.py                   # 1 736 lines — the ACTIVE monolith
├── scheduling/
│   ├── __init__.py
│   ├── schedule_checker.py        # DEAD — duplicate of job_tasks.py:19-119
│   └── job_dispatcher.py          # DEAD — duplicate of job_tasks.py:127-235
├── execution/
│   ├── __init__.py
│   ├── base_executor.py           # Only routes check_queues (after recent cleanup)
│   └── check_queues_executor.py   # DEAD — duplicate of job_tasks.py:370-556
├── utils/
│   ├── device_helpers.py          # DEAD — newer version of job_tasks.py:238-328
│   └── condition_helpers.py       # Shared utility (used by device_helpers.py)
├── periodic_tasks.py              # Active — system maintenance tasks
└── test_tasks.py                  # Active — test/demo tasks
```

### Execution Flow (as it actually runs today)

```
                      ┌──────────────────┐
                      │   Celery Beat     │
                      │ (every 1 minute)  │
                      └────────┬─────────┘
                               │
              invokes "tasks.check_job_schedules"
                               │
                               ▼
             ┌──────────────────────────────────┐
             │ job_tasks.py:check_job_schedules  │ ◄── WINNER (loaded via celery_app.task)
             │ + scheduling/schedule_checker.py  │ ◄── LOSER  (loaded via shared_task)
             └────────────────┬─────────────────┘
                              │
                    dispatch_job.delay()
                              │
                              ▼
             ┌──────────────────────────────────┐
             │ job_tasks.py:dispatch_job          │ ◄── What routers actually import
             │ + scheduling/job_dispatcher.py     │ ◄── What tasks/__init__.py imports
             └────────────────┬─────────────────┘
                              │
                   _execute_job_type()
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                  │
      sync_devices       backup          check_queues
      (stub)        (placeholder)    (full implementation)
      run_commands   compare_devices
      (full impl)   (stub)
```

### Two API Entry Points

| Entry Point | File | Imports From |
|---|---|---|
| Manual schedule execution | `routers/jobs/runs.py:619` | `tasks.job_tasks.dispatch_job` |
| Check-queues trigger | `routers/jobs/celery_api.py:552` | `tasks.job_tasks.dispatch_job` |
| Legacy schedule execute | `routers/jobs/schedules.py:276` | `tasks.job_tasks.get_task_for_job` |

All three import from `job_tasks.py`, **never** from `tasks.scheduling`.

---

## Critical Issues

### 1. Duplicate Celery Task Registration

**Two different functions are registered under each of these task names:**

| Task Name | Location A (active) | Location B (dead) |
|---|---|---|
| `tasks.check_job_schedules` | `job_tasks.py:19` via `@celery_app.task` | `scheduling/schedule_checker.py:16` via `@shared_task` |
| `tasks.dispatch_job` | `job_tasks.py:127` via `@celery_app.task` | `scheduling/job_dispatcher.py:15` via `@shared_task` |

**Why this is dangerous:** Celery resolves tasks by name at runtime. When the worker
boots and imports both modules, the last import overwrites the first in the task
registry. Which one "wins" depends on Python's import order — an implicit, fragile
contract. Today it works because `job_tasks.py` is imported first via
`celery_app.py`'s `include=["tasks"]`, and `tasks/__init__.py` subsequently imports
from `scheduling/`. But a refactor, a new import, or a Celery version upgrade could
silently flip which implementation runs.

**Impact:** If the scheduling module's `dispatch_job` wins, jobs would route through
`base_executor.py`, which only knows about `check_queues` (after the recent cleanup).
Every other job type would fail with `"Unknown job type"`.

### 2. Unreachable Job Types via Modular Path

The `tasks/scheduling/job_dispatcher.py` dispatcher calls
`tasks.execution.base_executor.execute_job_type()`, which after the recent cleanup
of executor files only handles `check_queues`. If this path ever becomes active
(see issue #1), the following job types would be broken:

- `sync_devices`
- `backup`
- `run_commands`
- `compare_devices`

There is no fallback to `job_tasks.py`'s private executors from this code path.

---

## High-Severity Issues

### 3. Dead Legacy Tasks in job_tasks.py

Lines 1402–1735 contain four Celery tasks that are **never called**:

| Task | Line | State |
|---|---|---|
| `tasks.cache_devices` | 1407 | Placeholder with real GraphQL query |
| `tasks.sync_checkmk` | 1520 | Returns error immediately (service removed) |
| `tasks.backup_configs` | 1584 | Placeholder with `time.sleep(2)` |
| `tasks.ansible_playbook` | 1652 | Placeholder with `time.sleep(3)` |

These are only referenced through `JOB_TASK_MAPPING` and `get_task_for_job()`,
which is called from `routers/jobs/schedules.py:276` — a **legacy execution path**
that uses a different dispatch model (directly calling task functions by
`job_identifier` name, not by `job_type`). This path never creates a `JobRun` record,
so executions are invisible in the Jobs View UI.

### 4. Orphaned scheduling/ Module

The entire `tasks/scheduling/` module is dead code:
- `tasks/__init__.py` imports `dispatch_job` and `check_job_schedules_task` from it
- But no router or beat schedule uses these imports — they all import from
  `tasks.job_tasks` directly
- The `tasks/__init__.py` exports serve no consumer

### 5. Helper Function Duplication

Two implementations of target device resolution exist:

| Location | Style | Used By |
|---|---|---|
| `job_tasks.py:238` `_get_target_devices()` | Manual `asyncio.new_event_loop()` | `job_tasks.py:dispatch_job` |
| `tasks/utils/device_helpers.py:15` `get_target_devices()` | Uses `resolve_inventory_to_device_ids_sync()` | `scheduling/job_dispatcher.py` (dead) |

The `device_helpers.py` version is cleaner (uses a shared sync utility), but it is
only used by the dead dispatcher.

---

## Medium-Severity Issues

### 6. Missing `job_run_id` in job_tasks.py Dispatch

The `dispatch_job` in `job_tasks.py` creates a `job_run_id` at line 191 but **never
passes it** to `_execute_job_type()`:

```python
# Line 197 — job_run_id is NOT passed
result = _execute_job_type(
    job_type=job_type,
    schedule_id=schedule_id,
    credential_id=credential_id,
    job_parameters=job_parameters,
    target_devices=target_devices,
    task_context=self,
    template=template,
    # job_run_id is missing!
)
```

And `_execute_job_type()` at line 331 does not accept `job_run_id` either. This means
individual executors (like the backup executor's chord pattern) cannot reference their
own job run record. The `scheduling/job_dispatcher.py` version does pass `job_run_id`
correctly.

### 7. asyncio Anti-Pattern in Celery Workers

Multiple executor functions create throw-away event loops:

```python
loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)
try:
    result = loop.run_until_complete(some_async_call())
finally:
    loop.close()
```

This pattern appears in:
- `_get_target_devices()` (line 287)
- `_execute_run_commands()` (line 838)
- `cache_devices_task()` (line 1438)
- Several others

**Problems:**
- Creating/destroying event loops is expensive
- `set_event_loop()` mutates global state — not safe if Celery uses threads
- The `device_helpers.py` version already solves this with
  `resolve_inventory_to_device_ids_sync()` — a proper sync wrapper

### 8. Duplicate check_queues Implementation

The `check_queues` executor exists in two places with near-identical code:
- `job_tasks.py:370-556` (`_execute_check_queues`)
- `tasks/execution/check_queues_executor.py:12-205` (`execute_check_queues`)

Both are functionally equivalent. The `job_tasks.py` version is the one actually
executed (via `_execute_job_type` dispatch). The `execution/` version is only
reachable through the dead `base_executor.py` path.

### 9. Inconsistent Logging Practices

The codebase mixes multiple logging styles:

```python
# f-string in logging (violates CLAUDE.md rule)
logger.info(f"Dispatching job: {job_name} (type: {job_type})")

# Correct lazy formatting
logger.info("check_queues: checking %d specified NiFi instance(s)", len(instances))

# Excessive debug logging left in production
logger.info("[ACTIVATION DEBUG] Template provided: %s", template is not None)
logger.info("=" * 80)
logger.info("BACKUP EXECUTOR STARTED")
logger.info("=" * 80)
```

---

## Low-Severity Issues

### 10. Inconsistent Celery Decorator Usage

`job_tasks.py` uses `@celery_app.task(...)` (app-bound decorator), while
`scheduling/` and `periodic_tasks.py` use `@shared_task(...)` (app-agnostic).
Both work, but mixing them in the same project creates confusion about which
Celery app instance owns which task.

### 11. Stub Executors Still Dispatched

`_execute_backup()` (line 608) contains a `time.sleep(2)` placeholder, yet it is
registered in the `job_executors` dict and can be dispatched. If a user creates a
backup job template and triggers it, they get a fake "success" result.

Similarly, `_execute_sync_devices()` and `_execute_compare_devices()` return immediate
errors ("service removed") — correct behavior, but they should not appear as available
job types in the UI.

### 12. `get_task_for_job()` Maps to Wrong Tasks

The `JOB_TASK_MAPPING` at line 1717 maps legacy identifiers (`cache_devices`,
`sync_checkmk`, `backup_configs`, `ansible_playbook`) to the legacy placeholder
tasks. The `schedules.py` router uses this to execute jobs — but these identifiers
don't match the modern `job_type` values (`backup`, `sync_devices`, `run_commands`,
etc.), so this path would return `None` for any modern job type and raise a 400 error.

---

## Recommended Refactoring

### Option A: Consolidate into job_tasks.py (Minimal Change)

Keep the monolith as the single source of truth. Remove the dead modular structure.

1. **Delete** `tasks/scheduling/schedule_checker.py` and `tasks/scheduling/job_dispatcher.py`
2. **Delete** `tasks/execution/check_queues_executor.py` and `tasks/execution/base_executor.py`
3. **Update** `tasks/__init__.py` to import from `job_tasks.py`
4. **Delete** `tasks/utils/device_helpers.py` (dead code)
5. **Remove** the four legacy tasks and `JOB_TASK_MAPPING`/`get_task_for_job()`
6. **Update** `routers/jobs/schedules.py` to not use `get_task_for_job()`
7. **Pass** `job_run_id` through to `_execute_job_type()`

**Pros:** Quick, low risk, matches current reality.
**Cons:** `job_tasks.py` stays at 1 000+ lines, executors are not independently testable.

### Option B: Complete Modular Migration (Recommended)

Make the modular structure the single source of truth. Gut `job_tasks.py`.

1. **Move** all active executor functions from `job_tasks.py` into `tasks/execution/`:
   - `_execute_check_queues` → `check_queues_executor.py` (already exists — deduplicate)
   - `_execute_run_commands` → `run_commands_executor.py`
   - `_execute_backup` → keep as stub or implement
   - `_execute_sync_devices` → keep as stub or remove
   - `_execute_compare_devices` → keep as stub or remove
2. **Register** all executors in `base_executor.py`
3. **Delete** `check_job_schedules_task` and `dispatch_job` from `job_tasks.py`
4. **Keep** `scheduling/schedule_checker.py` and `scheduling/job_dispatcher.py` as the sole task definitions
5. **Update** all router imports to use `tasks.scheduling` (or just `tasks`)
6. **Replace** `_get_target_devices()` with `tasks.utils.device_helpers.get_target_devices()`
7. **Delete** the four legacy tasks, `JOB_TASK_MAPPING`, and `get_task_for_job()`
8. **Delete** or gut `job_tasks.py` entirely

**Pros:** Clean separation, each executor is testable, no duplicate registrations.
**Cons:** More files to change, requires careful testing.

### Immediate Actions (Regardless of Option)

These are safe to do now with minimal risk:

1. **Delete the four dead legacy tasks** (lines 1402–1735 in `job_tasks.py`) and
   `JOB_TASK_MAPPING`/`get_task_for_job()`. They are unreachable through any modern
   code path. Update `routers/jobs/schedules.py` accordingly.

2. **Add `job_run_id`** to `_execute_job_type()` parameter list and pass it through
   from `dispatch_job()`. The backup chord pattern needs this.

3. **Fix f-strings in logging** — replace `logger.info(f"...")` with
   `logger.info("...", arg)` throughout `job_tasks.py`.

4. **Remove debug logging** — strip `[ACTIVATION DEBUG]`, `"=" * 80` banners, and
   similar verbose markers from production code.

---

## File-by-File Status

| File | Lines | Status | Action |
|---|---|---|---|
| `tasks/job_tasks.py` | 1 736 | Active monolith with dead code | Clean up or migrate |
| `tasks/scheduling/schedule_checker.py` | 118 | Dead duplicate | Delete (Option A) or promote (Option B) |
| `tasks/scheduling/job_dispatcher.py` | 141 | Dead duplicate | Delete (Option A) or promote (Option B) |
| `tasks/execution/base_executor.py` | 55 | Only routes check_queues | Delete (Option A) or expand (Option B) |
| `tasks/execution/check_queues_executor.py` | 206 | Dead duplicate | Delete (Option A) or keep as sole impl (Option B) |
| `tasks/utils/device_helpers.py` | 72 | Dead (cleaner impl) | Delete (Option A) or promote (Option B) |
| `tasks/utils/condition_helpers.py` | ~50 | Used by device_helpers | Keep |
| `tasks/periodic_tasks.py` | ~330 | Active, clean | Keep |
| `tasks/test_tasks.py` | ~60 | Active, clean | Keep |

---

## Appendix: Task Registry Audit

### Active Tasks (in use)

| Task Name | File | Trigger |
|---|---|---|
| `tasks.check_job_schedules` | `job_tasks.py:19` | Beat schedule (every 1 min) |
| `tasks.dispatch_job` | `job_tasks.py:127` | Schedule checker + routers |
| `tasks.worker_health_check` | `periodic_tasks.py:18` | Beat schedule (every 5 min) |
| `tasks.load_cache_schedules` | `periodic_tasks.py:51` | Beat schedule (every 1 min) |
| `tasks.dispatch_cache_task` | `periodic_tasks.py:91` | `load_cache_schedules` |
| `tasks.cleanup_celery_data` | `periodic_tasks.py:145` | Beat schedule (every 6 hours) |
| `tasks.check_stale_jobs` | `periodic_tasks.py:239` | Beat schedule (every 10 min) |
| `tasks.test_task` | `test_tasks.py:12` | Manual (via API) |
| `tasks.test_progress_task` | `test_tasks.py:34` | Manual (via API) |

### Dead Tasks (registered but unreachable)

| Task Name | File | Reason |
|---|---|---|
| `tasks.check_job_schedules` | `scheduling/schedule_checker.py:16` | Duplicate, overwritten |
| `tasks.dispatch_job` | `scheduling/job_dispatcher.py:15` | Duplicate, overwritten |
| `tasks.cache_devices` | `job_tasks.py:1407` | Only in `JOB_TASK_MAPPING`, never matched |
| `tasks.sync_checkmk` | `job_tasks.py:1520` | Only in `JOB_TASK_MAPPING`, returns error |
| `tasks.backup_configs` | `job_tasks.py:1584` | Only in `JOB_TASK_MAPPING`, placeholder |
| `tasks.ansible_playbook` | `job_tasks.py:1652` | Only in `JOB_TASK_MAPPING`, placeholder |

### Queue Routing (celery_app.py)

| Pattern | Queue |
|---|---|
| `tasks.backup_single_device_task` | `backup` |
| `tasks.finalize_backup_task` | `backup` |
| `tasks.backup_devices` | `backup` |
| `tasks.ping_network_task` | `network` |
| `tasks.scan_prefixes_task` | `network` |
| `tasks.check_ip_task` | `network` |
| `tasks.bulk_onboard_devices_task` | `heavy` |
| `tasks.update_devices_from_csv_task` | `heavy` |
| `tasks.update_ip_prefixes_from_csv_task` | `heavy` |
| `tasks.export_devices_task` | `heavy` |
| `*` (everything else) | `default` |

Note: `tasks.dispatch_job` and all job type executors run on the `default` queue.
There is no dedicated queue for long-running job executions.
