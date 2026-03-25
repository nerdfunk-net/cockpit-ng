# Refactoring Plan: Celery Worker & Job Management

## Context

This plan addresses issues identified in `doc/JOB_MANAGEMENT_ANALYSIS.md`. Every step is self-contained and can be implemented, tested, and committed independently.

---

## Implementation Order

Steps must be executed in order. Earlier steps reduce noise so later steps are easier to verify.

1. Remove dead code
2. Fix dead arithmetic
3. Fix unused health-check call
4. Fix git_commits placeholder
5. Replace in-memory cache state with Redis
6. Fix cache dispatch (`.apply()` → `.apply_async()` + self-tracking tasks)
7. Clarify legacy entry-point files

---

## Step 1 — Remove `load_queue_configuration()` (dead function)

**File:** `backend/celery_app.py`

**Problem:** `load_queue_configuration()` (lines 22–65) is never called. It was replaced by `get_default_queue_configuration()` at line 119. The function creates confusion about how queue config actually works.

**Change:** Delete lines 22–65 entirely. Update the comment block at lines 111–120.

**Before (lines 22–65):**
```python
def load_queue_configuration():
    """
    Load queue configuration from database settings.
    ...
    """
    try:
        from settings_manager import settings_manager
        ...
        return task_queues
    except Exception as e:
        ...
        return get_default_queue_configuration()
```

**After:** Delete the entire function. The remaining code at line 119 (`task_queues_from_db = get_default_queue_configuration()`) stays unchanged.

Update the comment block above that line from:

```python
# Use static default configuration to avoid database access before forking
# NOTE: Previously this called load_queue_configuration() which accessed the database
# at import time, causing SIGSEGV on macOS when workers forked
#
# Custom queues can be added by super users via:
# 1. Settings UI (for documentation)
# 2. CELERY_WORKER_QUEUE env var (tells worker which queue to listen to)
# 3. Celery auto-creates queues in Redis as needed
task_queues_from_db = get_default_queue_configuration()
```

No behavior change. No tests required.

---

## Step 2 — Remove dead arithmetic in `cleanup_old_runs_hours`

**File:** `backend/job_run_manager.py`, line 259

**Problem:** `hours / 24.0` computes a float and discards it immediately. The comment says "Convert hours to days (fractional)" but the result is never used. The function passes `hours` directly to the repository.

**Before (lines 256–262):**
```python
def cleanup_old_runs_hours(hours: int = 24) -> int:
    """Delete job runs older than specified hours"""
    # Convert hours to days (fractional)
    hours / 24.0
    count = repo.cleanup_old_runs_hours(hours)
    logger.info("Cleaned up %s old job runs (older than %s hours)", count, hours)
    return count
```

**After:**
```python
def cleanup_old_runs_hours(hours: int = 24) -> int:
    """Delete job runs older than specified hours"""
    count = repo.cleanup_old_runs_hours(hours)
    logger.info("Cleaned up %s old job runs (older than %s hours)", count, hours)
    return count
```

No behavior change.

---

## Step 3 — Fix unused `inspect.active()` call in `worker_health_check`

**File:** `backend/tasks/periodic_tasks.py`, lines 29–44

**Problem:** `inspect.active()` is called on line 33 but its return value is discarded. `inspect.stats()` on line 34 is the actual source of `active_workers`. Two separate Celery control commands are issued for every health check (every 5 minutes) when only one is needed.

**Before (lines 29–44):**
```python
try:
    inspect = celery_app.control.inspect()

    # Get active workers
    inspect.active()
    stats = inspect.stats()

    active_workers = len(stats) if stats else 0

    logger.info("Health check: %s workers active", active_workers)

    return {
        "success": True,
        "active_workers": active_workers,
        "message": f"{active_workers} workers active",
    }
```

**After:**
```python
try:
    inspect = celery_app.control.inspect()
    stats = inspect.stats()

    active_workers = len(stats) if stats else 0

    logger.info("Health check: %s workers active", active_workers)

    return {
        "success": True,
        "active_workers": active_workers,
        "message": "%d workers active" % active_workers,
    }
```

Note: The f-string in the return dict is also corrected to a `%` format string for consistency (while not a logger call, it avoids the pattern).

No behavior change.

---

## Step 4 — Fix git_commits cache placeholder

**File:** `backend/tasks/periodic_tasks.py`, lines 113–131

**Problem:** The git_commits block runs every minute and always sets `_last_cache_runs["git_commits"] = now`, even though nothing is dispatched. When the feature is eventually implemented, `_last_cache_runs["git_commits"]` will already have a recent timestamp from the first minute of worker startup — so the task will never be triggered.

**Before (lines 113–131):**
```python
# Check git commits cache (placeholder for future implementation)
git_interval = cache_settings.get("git_commits_cache_interval_minutes", 15)
if git_interval > 0:
    last_run = _last_cache_runs.get("git_commits")
    if (
        last_run is None
        or (now - last_run).total_seconds() >= git_interval * 60
    ):
        # TODO: Dispatch git commits cache task when implemented
        # dispatch_cache_task.delay(
        #     cache_type='git_commits',
        #     task_name='cache_git_commits'
        # )
        _last_cache_runs["git_commits"] = now
        # dispatched.append('git_commits')
        logger.debug(
            "Git commits cache task not yet implemented (interval: %sm)",
            git_interval,
        )
```

**After:** Delete the entire git_commits block. Remove it completely. When the feature is implemented it will be added back correctly. Also remove `git_commits` from the `intervals` dict in the return value.

The return value changes from:
```python
return {
    "success": True,
    "checked_at": now.isoformat(),
    "dispatched": dispatched,
    "intervals": {
        "devices": devices_interval,
        "locations": locations_interval,
        "git_commits": git_interval,
    },
}
```

To:
```python
return {
    "success": True,
    "checked_at": now.isoformat(),
    "dispatched": dispatched,
    "intervals": {
        "devices": devices_interval,
        "locations": locations_interval,
    },
}
```

Also remove the `git_interval` variable declaration (line 114) since it is no longer needed.

---

## Step 5 — Replace in-memory `_last_cache_runs` with Redis-backed tracking

**File:** `backend/tasks/periodic_tasks.py`

**Problem:** `_last_cache_runs: Dict[str, datetime] = {}` (line 15) is a module-level dict that resets every time the worker restarts. After any worker recycle, all cache tasks fire immediately, creating unnecessary load on Nautobot.

**Solution:** Use Redis to persist last-run timestamps. Redis is already available (`settings.redis_url`) and used in `cleanup_celery_data_task` in the same file.

**Redis key pattern:** `cockpit-ng:cache:last_run:{cache_type}` (uses the same prefix as RedBeat: `cockpit-ng:beat:`)

### 5a — Remove the module-level dict

**Before (line 15):**
```python
# Track last run times for cache tasks (in-memory, reset on worker restart)
_last_cache_runs: Dict[str, datetime] = {}
```

**After:** Delete these two lines entirely.

Also remove the `global _last_cache_runs` statement at line 63.

### 5b — Add helper functions for Redis-backed timestamps

Add these two functions immediately after the imports in `periodic_tasks.py`, before any task definitions:

```python
def _get_last_cache_run(cache_type: str) -> Optional[datetime]:
    """Read last run timestamp for a cache type from Redis."""
    try:
        import redis
        from config import settings

        r = redis.from_url(settings.redis_url)
        key = "cockpit-ng:cache:last_run:%s" % cache_type
        value = r.get(key)
        if value:
            return datetime.fromisoformat(value.decode())
        return None
    except Exception as e:
        logger.warning("Failed to read last cache run for %s: %s", cache_type, e)
        return None


def _set_last_cache_run(cache_type: str, ts: datetime) -> None:
    """Write last run timestamp for a cache type to Redis (TTL: 7 days)."""
    try:
        import redis
        from config import settings

        r = redis.from_url(settings.redis_url)
        key = "cockpit-ng:cache:last_run:%s" % cache_type
        r.set(key, ts.isoformat(), ex=604800)  # 7 days TTL
    except Exception as e:
        logger.warning("Failed to write last cache run for %s: %s", cache_type, e)
```

The 7-day TTL prevents stale keys from accumulating while surviving any realistic restart interval.

### 5c — Update `load_cache_schedules_task` to use Redis helpers

Replace all `_last_cache_runs.get(...)` and `_last_cache_runs[...] = now` with helper calls.

**For the devices block (lines 79–89), before:**
```python
last_run = _last_cache_runs.get("devices")
if (
    last_run is None
    or (now - last_run).total_seconds() >= devices_interval * 60
):
    dispatch_cache_task.delay(
        cache_type="devices", task_name="cache_all_devices"
    )
    _last_cache_runs["devices"] = now
    dispatched.append("devices")
    logger.info(
        "Dispatched devices cache task (interval: %sm)", devices_interval
    )
```

**After:**
```python
last_run = _get_last_cache_run("devices")
if (
    last_run is None
    or (now - last_run).total_seconds() >= devices_interval * 60
):
    dispatch_cache_task.delay(
        cache_type="devices", task_name="cache_all_devices"
    )
    _set_last_cache_run("devices", now)
    dispatched.append("devices")
    logger.info(
        "Dispatched devices cache task (interval: %sm)", devices_interval
    )
```

**For the locations block (lines 97–111), before:**
```python
last_run = _last_cache_runs.get("locations")
if (
    last_run is None
    or (now - last_run).total_seconds() >= locations_interval * 60
):
    dispatch_cache_task.delay(
        cache_type="locations", task_name="cache_all_locations"
    )
    _last_cache_runs["locations"] = now
    dispatched.append("locations")
    logger.info(
        "Dispatched locations cache task (interval: %sm)",
        locations_interval,
    )
```

**After:**
```python
last_run = _get_last_cache_run("locations")
if (
    last_run is None
    or (now - last_run).total_seconds() >= locations_interval * 60
):
    dispatch_cache_task.delay(
        cache_type="locations", task_name="cache_all_locations"
    )
    _set_last_cache_run("locations", now)
    dispatched.append("locations")
    logger.info(
        "Dispatched locations cache task (interval: %sm)",
        locations_interval,
    )
```

### 5d — Remove unused imports

After removing `_last_cache_runs`, the `Dict` import from `typing` may become unused. Check the imports block:

**Before (line 10):**
```python
from typing import Dict
```

**After:** Remove `Dict` from the import. If `Optional` is now needed (for the new helper return type), add it:
```python
from typing import Optional
```

---

## Step 6 — Fix cache task dispatch: `.apply()` → `.apply_async()` with self-tracking

This is the most significant change. It replaces the synchronous blocking dispatch pattern with proper async dispatch and moves job-run lifecycle tracking into the cache tasks themselves.

### Overview of the change

**Current flow:**
```
load_cache_schedules_task
    → dispatch_cache_task.delay(cache_type, task_name)     # queued
        → creates JobRun (pending)
        → mark_started(wrapper_task_id)                     # WRONG ID
        → cache_task.apply()                                # BLOCKING — ties up worker
        → mark_completed/mark_failed
```

**Problems:**
- `.apply()` runs the cache task synchronously, blocking the Celery worker for the full cache duration (potentially minutes).
- The `celery_task_id` recorded in the JobRun is the `dispatch_cache_task` wrapper's ID, not the actual cache task's ID. This makes Celery task introspection (`GET /api/celery/tasks/{id}`) return the status of the wrapper, not the real operation.
- The `dispatch_cache_task` wrapper layer adds no value — it is a task whose only job is to run another task synchronously.

**New flow:**
```
load_cache_schedules_task
    → creates JobRun (pending)
    → cache_task.apply_async(kwargs={"job_run_id": id})    # non-blocking, queued
    → mark_started(real_task_id from AsyncResult.id)

    cache_task (runs in worker)
    → does work
    → mark_completed / mark_failed at end
```

### 6a — Add `job_run_id` parameter to `cache_all_devices_task`

**File:** `backend/services/background_jobs/device_cache_jobs.py`

**Before (lines 14–15):**
```python
@shared_task(bind=True, name="cache_all_devices")
def cache_all_devices_task(self) -> Dict[str, Any]:
```

**After:**
```python
@shared_task(bind=True, name="cache_all_devices")
def cache_all_devices_task(self, job_run_id: int = None) -> Dict[str, Any]:
```

At the **end of the success path** (before the final `return` at line 193), add job run completion tracking. The cache task already builds a `result` dict. Add the tracking calls immediately before the final return:

**Before (lines 180–199, the final return block):**
```python
        # Determine final status
        if failed_count == 0:
            status = "completed"
            message = f"Successfully cached all {cached_count} devices"
        elif cached_count == 0:
            status = "failed"
            message = f"Failed to cache any devices ({failed_count} failures)"
        else:
            status = "completed_with_errors"
            message = f"Cached {cached_count} devices with {failed_count} failures"

        logger.info("Task %s: %s", self.request.id, message)

        return {
            "status": status,
            "message": message,
            "cached": cached_count,
            "failed": failed_count,
            "total": total_devices,
        }

    except Exception as e:
        logger.error(
            "Task %s failed with exception: %s", self.request.id, e, exc_info=True
        )
        return {
            "status": "failed",
            "error": str(e),
            "cached": 0,
            "failed": 0,
        }
```

**After:**
```python
        # Determine final status
        if failed_count == 0:
            status = "completed"
            message = "Successfully cached all %d devices" % cached_count
        elif cached_count == 0:
            status = "failed"
            message = "Failed to cache any devices (%d failures)" % failed_count
        else:
            status = "completed_with_errors"
            message = "Cached %d devices with %d failures" % (cached_count, failed_count)

        logger.info("Task %s: %s", self.request.id, message)

        result = {
            "status": status,
            "message": message,
            "cached": cached_count,
            "failed": failed_count,
            "total": total_devices,
        }

        if job_run_id:
            import job_run_manager
            if status == "failed":
                job_run_manager.mark_failed(job_run_id, message)
            else:
                job_run_manager.mark_completed(job_run_id, result=result)

        return result

    except Exception as e:
        error_msg = str(e)
        logger.error(
            "Task %s failed with exception: %s", self.request.id, error_msg, exc_info=True
        )
        result = {
            "status": "failed",
            "error": error_msg,
            "cached": 0,
            "failed": 0,
        }
        if job_run_id:
            import job_run_manager
            job_run_manager.mark_failed(job_run_id, error_msg)
        return result
```

Note: f-strings in the status messages are also replaced with `%` formatting to fix the existing violations.

### 6b — Add `job_run_id` parameter to `cache_all_locations_task`

**File:** `backend/services/background_jobs/location_cache_jobs.py`

**Before (lines 14–15):**
```python
@shared_task(bind=True, name="cache_all_locations")
def cache_all_locations_task(self) -> Dict[str, Any]:
```

**After:**
```python
@shared_task(bind=True, name="cache_all_locations")
def cache_all_locations_task(self, job_run_id: int = None) -> Dict[str, Any]:
```

At the end of the task, before each `return`, add job run tracking. There are two return points: the "no locations" early return and the success return.

**Early return (lines 79–85):**
```python
        if total_locations == 0:
            logger.warning("Task %s: No locations found in Nautobot", self.request.id)
            return {
                "status": "completed",
                "message": "No locations found to cache",
                "cached": 0,
            }
```

**After:**
```python
        if total_locations == 0:
            logger.warning("Task %s: No locations found in Nautobot", self.request.id)
            result = {
                "status": "completed",
                "message": "No locations found to cache",
                "cached": 0,
            }
            if job_run_id:
                import job_run_manager
                job_run_manager.mark_completed(job_run_id, result=result)
            return result
```

**Success return (lines 114–119):**
```python
        return {
            "status": "completed",
            "message": f"Successfully cached {total_locations} locations",
            "cached": total_locations,
            "total": total_locations,
        }
```

**After:**
```python
        result = {
            "status": "completed",
            "message": "Successfully cached %d locations" % total_locations,
            "cached": total_locations,
            "total": total_locations,
        }
        if job_run_id:
            import job_run_manager
            job_run_manager.mark_completed(job_run_id, result=result)
        return result
```

**Exception handler (lines 121–129):**
```python
    except Exception as e:
        logger.error(
            "Task %s failed with exception: %s", self.request.id, e, exc_info=True
        )
        return {
            "status": "failed",
            "error": str(e),
            "cached": 0,
        }
```

**After:**
```python
    except Exception as e:
        error_msg = str(e)
        logger.error(
            "Task %s failed with exception: %s", self.request.id, error_msg, exc_info=True
        )
        result = {
            "status": "failed",
            "error": error_msg,
            "cached": 0,
        }
        if job_run_id:
            import job_run_manager
            job_run_manager.mark_failed(job_run_id, error_msg)
        return result
```

### 6c — Rewrite `dispatch_cache_task` in `periodic_tasks.py`

**File:** `backend/tasks/periodic_tasks.py`

Replace the entire `dispatch_cache_task` function (lines 149–222) with this implementation:

```python
@shared_task(bind=True, name="tasks.dispatch_cache_task")
def dispatch_cache_task(self, cache_type: str, task_name: str) -> dict:
    """
    Create a job run record and dispatch the named cache task asynchronously.

    The cache task itself is responsible for calling mark_completed / mark_failed
    via the job_run_id kwarg passed here.

    Args:
        cache_type: Human-readable type (devices, locations)
        task_name: Celery task name string (cache_all_devices, cache_all_locations)
    """
    try:
        import job_run_manager
        from services.background_jobs import cache_all_devices_task, cache_all_locations_task

        task_map = {
            "cache_all_devices": cache_all_devices_task,
            "cache_all_locations": cache_all_locations_task,
        }

        celery_task = task_map.get(task_name)
        if not celery_task:
            logger.error("Unknown cache task: %s", task_name)
            return {"success": False, "error": "Unknown task: %s" % task_name}

        # Create job run record before dispatching
        job_run = job_run_manager.create_job_run(
            job_name="Cache %s" % cache_type.replace("_", " ").title(),
            job_type="cache_%s" % cache_type,
            triggered_by="system",
        )
        job_run_id = job_run["id"]

        # Dispatch asynchronously — the cache task marks itself completed/failed
        async_result = celery_task.apply_async(kwargs={"job_run_id": job_run_id})

        # Mark started with the REAL task ID
        job_run_manager.mark_started(job_run_id, async_result.id)

        logger.info(
            "Dispatched %s cache task (job_run=%s, celery_task=%s)",
            cache_type,
            job_run_id,
            async_result.id,
        )

        return {
            "success": True,
            "job_run_id": job_run_id,
            "celery_task_id": async_result.id,
        }

    except Exception as e:
        logger.error(
            "Error dispatching cache task %s: %s", cache_type, e, exc_info=True
        )
        return {"success": False, "error": str(e)}
```

**Key differences from the old implementation:**
- Uses `.apply_async(kwargs={"job_run_id": ...})` instead of `.apply()` — non-blocking
- Records `async_result.id` (real task ID) instead of `self.request.id` (wrapper task ID)
- Removes the if/elif ladder that used `.apply()` inline
- No longer calls `mark_completed` or `mark_failed` — the cache task does this

### 6d — Verify `tasks/__init__.py` exports are correct

**File:** `backend/tasks/__init__.py`

`dispatch_cache_task` is already exported. No change needed to `__init__.py`.

Verify that the import at line 69–76 includes both cache tasks (it does — they are imported from `services.background_jobs`). No change required.

---

## Step 7 — Clarify legacy entry-point files

**Files:** `backend/celery_beat.py`, `backend/celery_worker.py`

**Problem:** These two files exist alongside `start_celery.py` and `start_beat.py`. The `start_*.py` files are the correct, feature-complete entry points (platform detection, certificate installation, queue loading). The `celery_*.py` files are thin wrappers for the `celery -A <module>` CLI invocation style, lacking those features.

**Action:** Add a prominent deprecation notice to both files so developers know which to use.

**`backend/celery_beat.py` — replace the entire file with:**
```python
"""
Celery Beat entry point for `celery -A celery_beat beat` invocation style.

PREFERRED: Use `python start_beat.py` instead.
  - Includes proper startup banner
  - Validates schedule count on startup
  - Handles KeyboardInterrupt cleanly

This file is kept for compatibility with environments that call
`celery -A celery_beat beat` directly (e.g., some Docker setups).
"""

from celery_app import celery_app  # noqa: F401

import core.celery_signals  # noqa: F401 - Import for side effects (signal registration)

try:
    from tasks import *  # noqa: F403 - intentional star import for task registration
except ImportError:
    pass

try:
    from beat_schedule import CELERY_BEAT_SCHEDULE  # noqa: F401
except ImportError:
    pass

if __name__ == "__main__":
    celery_app.start()
```

**`backend/celery_worker.py` — replace the entire file with:**
```python
"""
Celery worker entry point for `celery -A celery_worker worker` invocation style.

PREFERRED: Use `python start_celery.py` instead.
  - Auto-detects macOS vs Linux and selects appropriate pool (solo vs prefork)
  - Installs certificates from config/certs/ if INSTALL_CERTIFICATE_FILES=true
  - Loads queue list from database when CELERY_WORKER_QUEUE is not set
  - Handles KeyboardInterrupt cleanly

This file is kept for compatibility with environments that call
`celery -A celery_worker worker` directly (e.g., some Docker setups that
override the pool and queue arguments themselves).
"""

from celery_app import celery_app  # noqa: F401

import core.celery_signals  # noqa: F401 - Import for side effects (signal registration)

try:
    from tasks import *  # noqa: F403 - intentional star import for task registration
except ImportError:
    pass

if __name__ == "__main__":
    celery_app.start()
```

---

## Verification After Each Step

After completing all steps, verify the following:

### Functional verification

1. **Worker starts without SIGSEGV on macOS:**
   ```bash
   cd backend && python start_celery.py
   # Should see: "Using 'solo' pool to avoid asyncio fork() incompatibility"
   # No crash
   ```

2. **Beat starts and schedules are loaded:**
   ```bash
   cd backend && python start_beat.py
   # Should see: "Scheduled Tasks: 6"
   ```

3. **Cache tasks run and create proper job runs:**
   - Trigger `load_cache_schedules_task` (e.g., wait for the beat to fire it, or trigger via the API)
   - Check `GET /api/job-runs?job_type=cache_devices` — should show a job run with `status=running` initially, then `status=completed`
   - The `celery_task_id` on the job run should match an actual Celery task ID (check via `GET /api/celery/tasks/{celery_task_id}`)

4. **Job run state after worker restart:**
   - Start the worker, let it fire at least one cache task
   - Restart the worker
   - Confirm that the cache task does NOT fire immediately again (Redis timestamp prevents it)
   - The next run should happen at the configured interval relative to the last run

5. **No blocking during cache dispatch:**
   - Submit a manual job immediately after a cache task is dispatched
   - The manual job should start within seconds, not wait for the cache task to finish

### Unit test check

Run existing backend tests to confirm no regressions:
```bash
cd backend && python -m pytest tests/ -x -q
```

---

## Summary of Files Changed

| File | Change |
|------|--------|
| `backend/celery_app.py` | Remove `load_queue_configuration()` (dead function) |
| `backend/job_run_manager.py` | Remove dead arithmetic `hours / 24.0` |
| `backend/tasks/periodic_tasks.py` | Remove module-level `_last_cache_runs` dict; add Redis helpers; fix git_commits placeholder; fix `inspect.active()` call; rewrite `dispatch_cache_task` |
| `backend/services/background_jobs/device_cache_jobs.py` | Add `job_run_id` param; call `mark_completed`/`mark_failed` at end |
| `backend/services/background_jobs/location_cache_jobs.py` | Add `job_run_id` param; call `mark_completed`/`mark_failed` at end |
| `backend/celery_beat.py` | Add deprecation notice |
| `backend/celery_worker.py` | Add deprecation notice |

Files **not** changed: `tasks/__init__.py`, `beat_schedule.py`, `celery_signals.py`, `start_celery.py`, `start_beat.py`, all executors, all routers.
