# Job Management System Analysis

## Overview

This document analyzes the Celery-based job management system in the cockpit-ng backend. The system manages background job execution for network operations, device management, caching, sync, and infrastructure maintenance.

---

## Architecture Summary

The job management system consists of five layers:

```
Beat Scheduler (beat_schedule.py)
        │
        ▼
Schedule Checker (tasks/scheduling/schedule_checker.py)  ← every minute
        │
        ▼
Job Dispatcher (tasks/scheduling/job_dispatcher.py)      ← tasks.dispatch_job
        │
        ▼
Type Executor (tasks/execution/base_executor.py)         ← routes by job_type
        │
        ▼
Specific Executor (tasks/execution/*.py)                 ← backup, sync, csv, etc.
```

Separately, background jobs (caching, CheckMK sync) live in `services/background_jobs/` and are dispatched via `tasks/periodic_tasks.py`.

---

## Structure Assessment

### What Works Well

**Task organization is clear.** The directory layout separates concerns reasonably:
- `tasks/scheduling/` — schedule checking and dispatch
- `tasks/execution/` — one executor per job type
- `tasks/` — individual task files per operation
- `services/background_jobs/` — system-internal cache and sync jobs
- `beat_schedule.py` — static beat schedule

**`base_executor.py` is a clean dispatch table.** The dict-based `job_executors` mapping at `tasks/execution/base_executor.py:54` is the right pattern. Adding a new job type means adding one entry to this dict and creating one executor function.

**`celery_signals.py` is excellent.** The database connection lifecycle management (`worker_process_init`, `worker_process_shutdown`, `worker_init`) is correctly implemented and well-documented. This is non-trivial code that is done right.

**Platform-aware pool selection** in `start_celery.py:76–95` solves the macOS asyncio+fork incompatibility cleanly and automatically.

**`celery_app.py` correctly avoids DB access at import time.** The comment at line 111–118 explains why `get_default_queue_configuration()` is called instead of `load_queue_configuration()`. This is an important correctness decision, well-documented.

**Queue routing is sensible.** Four queues (default, backup, network, heavy) with explicit task routing at `celery_app.py:163–183` matches the operational model.

---

## Issues Found

### Issue 1: `dispatch_cache_task` uses `.apply()` — synchronous execution inside a Celery task

**File:** `tasks/periodic_tasks.py:178,187`

```python
async_result = cache_all_devices_task.apply()  # synchronous!
```

`.apply()` executes the task synchronously in the current process. This blocks the worker for the full duration of the cache task (potentially minutes). The correct Celery pattern is `.delay()` or `.apply_async()`, both of which dispatch to the queue and return immediately.

This also means the `dispatch_cache_task` and the underlying cache task run **in the same worker process sequentially**, defeating the purpose of having a dispatcher layer. The `bind=True` on `dispatch_cache_task` and the `job_run_manager.mark_started(job_run_id, self.request.id)` at line 170 records the **dispatcher's** task ID, not the cache task's ID—so Celery task tracking is incorrect.

**Recommendation:** Use `.apply_async()` and track the returned `AsyncResult.id` as the `celery_task_id` in the job run record.

---

### Issue 2: In-memory `_last_cache_runs` state

**File:** `tasks/periodic_tasks.py:15`

```python
_last_cache_runs: Dict[str, datetime] = {}
```

This module-level dict resets every time the worker restarts. After a restart, all cache types appear as "never run" and all three cache tasks fire immediately. While cache tasks are idempotent (safe to run twice), this still creates unnecessary load on Nautobot and Redis after every deploy or worker recycle.

There are two clean alternatives:
1. Store last run timestamps in Redis (already available, used for result backend).
2. Store last run timestamps in the `job_runs` table (query most recent completed run per job type).

---

### Issue 3: `dispatch_cache_task` is a dispatcher-inside-a-task antipattern

**File:** `tasks/periodic_tasks.py:149–222`

The pattern is: `load_cache_schedules_task` dispatches `dispatch_cache_task`, which runs the actual cache task synchronously. This adds unnecessary indirection. The result is two JobRun records per cache operation (one for `dispatch_cache_task`, one for the cache task—if it were async), and the job run tracking is attached to the wrapper, not the real task.

The simpler pattern: `load_cache_schedules_task` dispatches the cache tasks directly with `.apply_async()` and records the returned task IDs directly.

---

### Issue 4: Git commits cache placeholder is unreachable code

**File:** `tasks/periodic_tasks.py:113–131`

The git commits cache block updates `_last_cache_runs["git_commits"]` but never dispatches anything. This means the "last run" time for git_commits is always being updated, which will **prevent the task from ever running** once it is implemented (because `last_run` is not `None` from the first minute onwards).

```python
# This runs every minute and marks git_commits as "already ran":
_last_cache_runs["git_commits"] = now
# dispatched.append('git_commits')  # commented out
```

When the git commits cache is eventually implemented, the `_last_cache_runs["git_commits"] = now` on line 126 will need to be removed or moved inside the actual dispatch block.

---

### Issue 5: `worker_health_check` calls `inspect.active()` result is discarded

**File:** `tasks/periodic_tasks.py:33`

```python
inspect.active()   # result discarded
stats = inspect.stats()
```

`inspect.active()` is called but its return value is not used. This is an unnecessary network call to all workers on every health check (every 5 minutes). Either use `inspect.active()` for the health check, or use `inspect.stats()`—not both.

---

### Issue 6: Imports inside task bodies

**Files:** `tasks/scheduling/schedule_checker.py:32–34`, `tasks/scheduling/job_dispatcher.py:51–54`, `tasks/periodic_tasks.py:66,159,239,295`

Celery tasks frequently defer imports to inside the function body:

```python
@shared_task(...)
def check_job_schedules_task():
    import jobs_manager
    import job_template_manager
    from .job_dispatcher import dispatch_job
    ...
```

This pattern is used to avoid circular imports and to defer module loading until task execution. The intent is correct, but it has two downsides:
1. Import errors surface at runtime, not at startup.
2. The cost of the import is paid on every task invocation (mitigated somewhat by Python's module cache).

Where the deferred import is solely to avoid circular imports (not for any platform/timing reason), the code should be restructured to break the circular dependency instead.

---

### Issue 7: `debug_wait_task` is in `__all__` — a test artifact in production exports

**File:** `tasks/__init__.py:87–89`

`debug_wait_task` is exported in `__all__` alongside production tasks. It is only used in `scripts/debug_job.py`. This is harmless but is noise in the public task interface.

---

### Issue 8: `celery_beat.py` and `celery_worker.py` are redundant entry points

**Files:** `backend/celery_beat.py`, `backend/celery_worker.py`

These two files exist alongside `start_celery.py` and `start_beat.py`. The `start_*.py` files are the well-documented, feature-complete entry points with platform detection, certificate installation, and queue loading. The `celery_*.py` files use star imports and lack these features:

```python
# celery_worker.py
from tasks import *  # noqa
```

If these are only needed for legacy `celery -A celery_worker worker` invocations, that should be documented. Otherwise they are confusing duplicates.

---

### Issue 9: `tasks.backup_devices` in task routes does not exist

**File:** `celery_app.py:167`

```python
"tasks.backup_devices": {"queue": "backup"},
```

There is no task named `tasks.backup_devices`. The backup tasks are named `tasks.backup_single_device_task` and `tasks.finalize_backup_task` (both already routed at lines 165–166). This stale route entry is dead config.

---

### Issue 10: `load_queue_configuration()` in `celery_app.py` is dead code

**File:** `celery_app.py:22–65`

`load_queue_configuration()` is defined but never called. The comment at line 111 explains why: it was deliberately replaced with the static `get_default_queue_configuration()`. The function still reads from the database and has error handling, but it is not invoked anywhere in the codebase.

This should either be removed or moved to `start_celery.py` where it could optionally be called at worker startup (after fork, safe to access DB). As written, it is dead code that creates confusion about how queue configuration actually works.

---

### Issue 11: `celery_app.py:11` — top-level `logger.info` at module import time

**File:** `celery_app.py:11`

```python
logger.info("Celery broker configured (Redis)")
```

This fires every time the module is imported, including during web server startup, tests, and any code that imports from this module. Log noise at import time is generally undesirable.

---

### Issue 12: `check_stale_jobs_task` hardcodes timeout thresholds

**File:** `tasks/periodic_tasks.py:371,404`

```python
if running_duration > 7200:  # 2 hours
if pending_duration > 3600:  # 1 hour
```

These thresholds are magic numbers with no corresponding configuration. Since the job system already reads settings from the database (`cleanup_age_hours`, `devices_cache_interval_minutes`), these should follow the same pattern.

---

## Dead Code

| Location | Item | Assessment |
|----------|------|------------|
| `celery_app.py:22–65` | `load_queue_configuration()` function | **Dead** — never called, replaced by static config |
| `celery_app.py:167` | `"tasks.backup_devices"` route | **Dead** — task does not exist |
| `tasks/periodic_tasks.py:113–131` | git_commits cache block | **Partially dead** — runs but does nothing; breaks future implementation |
| `celery_beat.py` / `celery_worker.py` | Alternative entry points | **Likely dead** — superseded by `start_*.py` |

---

## Best Practices Compliance

| Practice | Status | Notes |
|----------|--------|-------|
| `@shared_task` instead of `@app.task` | ✅ | All tasks use `@shared_task` |
| No DB access at import time | ✅ | Deliberately avoided in `celery_app.py` |
| Worker lifecycle DB handling | ✅ | Excellent — `celery_signals.py` |
| Task serialization | ✅ | JSON serializer configured |
| Result expiry | ✅ | `result_expires=86400` |
| Task time limit | ✅ | `task_time_limit=3600` |
| Stale job detection | ✅ | `check_stale_jobs_task` every 10 min |
| `task_acks_late=True` | ✅ | Correct for at-least-once delivery |
| No blocking calls inside tasks | ❌ | `.apply()` in `dispatch_cache_task` |
| Correct task ID tracking | ❌ | `dispatch_cache_task` records wrapper ID, not actual task ID |
| No in-process shared state | ❌ | `_last_cache_runs` dict is shared state |
| No dead code in task routes | ❌ | `tasks.backup_devices` route |
| No unused functions | ❌ | `load_queue_configuration()` |
| f-strings in logging | ❌ | Multiple `f"..."` strings in log calls (CLAUDE.md prohibits this) |

---

## f-string Logging Violations

CLAUDE.md specifies: **do not use f-strings in logging**. The following are violations:

- `start_celery.py:129,135,158,186` — `print(f"...")` and logging
- `tasks/periodic_tasks.py:43` — `f"{active_workers} workers active"` in return dict (acceptable, not a log call)
- `tasks/scheduling/job_dispatcher.py:100` — `f"Error dispatching schedule {schedule.get('id')}: {str(e)}"` used as string then logged at line 101

The policy applies to `logger.*()` calls. The violations are in `logger.error()`, `logger.info()`, etc. These should use `%s` format strings instead.

---

## Summary of Recommendations

### High Priority (correctness/reliability)

1. **Fix `dispatch_cache_task`** — replace `.apply()` with `.apply_async()`, track the real task ID, remove the wrapper layer.
2. **Fix git_commits placeholder** — remove the `_last_cache_runs["git_commits"] = now` update until the feature is implemented; otherwise it will silently suppress the feature on implementation.
3. **Remove dead task route** — `"tasks.backup_devices"` in `celery_app.py:167`.

### Medium Priority (maintainability)

4. **Remove `load_queue_configuration()`** from `celery_app.py` or move to `start_celery.py` where DB access is appropriate.
5. **Replace `_last_cache_runs`** with Redis-backed last-run tracking to survive worker restarts.
6. **Clarify or remove** `celery_beat.py` and `celery_worker.py` — document their purpose or delete them.
7. **Fix `worker_health_check`** — remove the unused `inspect.active()` call.

### Low Priority (polish)

8. **Move stale job thresholds** (2h running, 1h pending) to database-backed settings.
9. **Fix f-string logging violations** per CLAUDE.md conventions.
10. **Remove `debug_wait_task`** from `__all__`.

---

## File Reference

| File | Purpose |
|------|---------|
| `backend/celery_app.py` | Celery app config, queue definitions, task routing |
| `backend/beat_schedule.py` | Beat periodic schedule (system tasks only) |
| `backend/start_celery.py` | Worker entry point with platform detection |
| `backend/start_beat.py` | Beat entry point |
| `backend/core/celery_signals.py` | DB connection lifecycle per worker process |
| `backend/tasks/__init__.py` | Task registry (imports all tasks for registration) |
| `backend/tasks/scheduling/schedule_checker.py` | Polls schedules, dispatches due jobs |
| `backend/tasks/scheduling/job_dispatcher.py` | `dispatch_job` — creates JobRun, delegates to executor |
| `backend/tasks/execution/base_executor.py` | Routes `job_type` to specific executor |
| `backend/tasks/execution/*.py` | One executor per job type |
| `backend/tasks/periodic_tasks.py` | System maintenance + cache dispatch |
| `backend/services/background_jobs/` | Cache + CheckMK background tasks |
