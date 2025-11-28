# Scan & Add Migration to Celery

**Date:** 2025-11-28
**Status:** Planning
**Related:** CONSOLIDATE_TO_CELERY.md

---

## Executive Summary

The Scan & Add feature currently uses an **in-memory async job system** (NOT APScheduler). It uses `asyncio.create_task()` to run background scans and stores job state in a Python dictionary (`self._jobs`) with a 24-hour TTL.

**Key Finding:** This is NOT using APScheduler - it's a custom in-memory job system. The migration approach is different from what was expected.

---

## Current Architecture Analysis

### How Scan & Add Works Today

```
Frontend                    Backend API                   Scan Service
   │                            │                             │
   │ POST /api/scan/start       │                             │
   ├───────────────────────────►│                             │
   │                            │ scan_service.start_job()    │
   │                            ├────────────────────────────►│
   │                            │                             │
   │                            │   asyncio.create_task(      │
   │                            │     self._run_scan(...)     │
   │                            │   )                         │
   │                            │                             │
   │◄───────────────────────────┤                             │
   │  { job_id, state }         │                             │
   │                            │                             │
   │ GET /api/scan/{id}/status  │                             │
   ├───────────────────────────►│  scan_service.get_job()     │
   │                            ├────────────────────────────►│
   │                            │◄────────────────────────────┤
   │◄───────────────────────────┤  { progress, results }      │
   │  (poll every 2s)           │                             │
```

### Current Components

| Component | File | Purpose |
|-----------|------|---------|
| Router | `routers/scan_and_add.py` | API endpoints for scan operations |
| Service | `services/scan_service.py` | In-memory job management, scan execution |
| Frontend | `components/scan-and-add/scan-and-add-page.tsx` | Wizard UI with polling |

### Current Job Storage

```python
# services/scan_service.py
class ScanService:
    def __init__(self) -> None:
        self._jobs: Dict[str, ScanJob] = {}  # In-memory storage

    async def start_job(...) -> ScanJob:
        job = ScanJob(...)
        self._jobs[job.job_id] = job
        asyncio.create_task(self._run_scan(job, targets, ...))
        return job
```

**Limitations:**
- Jobs lost on server restart
- No horizontal scaling (in-memory)
- No job history persistence
- No worker distribution

---

## Migration Options

### Option A: Keep Current System (Minimal Change) ⭐ RECOMMENDED

**Rationale:** The current system works well for its use case:
- Network scans are interactive (user waits for results)
- Scans typically complete in 1-5 minutes
- Results are used immediately for device onboarding
- No need for persistence beyond the session

**Changes needed:**
- ✅ None - system already works independently from APScheduler
- ✅ Consider adding optional Redis-based job storage for HA deployments

**Risk:** Very Low

### Option B: Partial Migration (Hybrid)

Keep the frontend/API unchanged, but optionally use Celery for:
- Long-running scans (large networks)
- Persistent job history
- Distributed scanning

**Changes needed:**
1. Create `tasks/scan_tasks.py` with Celery task
2. Add toggle in scan_service to use Celery for large scans
3. Keep in-memory for small scans (fast response)

### Option C: Full Migration to Celery

Convert entire scan system to use Celery.

**Changes needed:**
1. Create `services/background_jobs/network_scan_jobs.py`
2. Create `tasks/scan_tasks.py`
3. Update `routers/scan_and_add.py` to trigger Celery tasks
4. Update frontend to poll Celery task status
5. Migrate job storage to database

**Risk:** Medium (significant code changes)

---

## Recommendation: Option A (Keep Current)

The Scan & Add feature is **NOT using APScheduler** - it uses asyncio for background task execution. This is a valid pattern for:

1. **Interactive operations** - User waits for scan results
2. **Short-lived jobs** - Scans complete in minutes, not hours
3. **Immediate results** - Results are used right after scan completes
4. **Stateless operation** - No need to persist scan jobs long-term

### Why This Works

```python
# Current approach - Simple and effective
asyncio.create_task(self._run_scan(job, targets, parser_template_ids))
```

- FastAPI runs on asyncio event loop
- Background tasks run concurrently with request handling
- No external dependencies (Redis, Celery)
- Simple deployment

### When to Consider Migration

Consider migrating to Celery only if:
- [ ] Need to scan networks larger than /22 (1024+ hosts)
- [ ] Need distributed scanning across multiple workers
- [ ] Need persistent scan job history
- [ ] Need to survive server restarts mid-scan
- [ ] Need scan scheduling (run scans at specific times)

---

## Current Status: No Migration Needed ✅

The Scan & Add feature:
1. ✅ Does NOT use APScheduler
2. ✅ Works independently with asyncio
3. ✅ Has appropriate 24-hour TTL for job cleanup
4. ✅ Handles concurrency properly (semaphore with MAX_CONCURRENCY=10)
5. ✅ Frontend polling works correctly

**Action:** Document this finding and close the investigation.

---

## Optional Future Enhancement

If HA/persistence is needed later, create a simple Redis-backed job store:

```python
# services/scan_service.py (future enhancement)
class ScanService:
    def __init__(self, use_redis: bool = False) -> None:
        if use_redis:
            self._jobs = RedisJobStore()  # Implement if needed
        else:
            self._jobs: Dict[str, ScanJob] = {}
```

This would allow:
- Job survival across restarts
- Shared state for multiple API workers
- Without the complexity of full Celery migration

---

## Summary

| Aspect | Current State | Recommendation |
|--------|---------------|----------------|
| Job System | asyncio.create_task() | Keep as-is ✅ |
| Storage | In-memory dict | Keep as-is ✅ |
| Polling | Frontend polls every 2s | Keep as-is ✅ |
| Persistence | 24h TTL, lost on restart | Acceptable for use case |
| APScheduler | NOT USED | No migration needed |

**Conclusion:** The Scan & Add feature was never using APScheduler. It uses Python's asyncio for background task execution, which is appropriate for its interactive, short-lived scan operations. No migration is required.
