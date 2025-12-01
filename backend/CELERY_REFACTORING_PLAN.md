# Celery Backend Refactoring Plan

**Date:** 2025-01-28
**Status:** Planning Phase
**Priority:** High

## Executive Summary

The current Celery implementation has a critical maintainability issue: `tasks/job_tasks.py` is 1,283 lines long with 15 different functions mixing multiple responsibilities. This plan outlines a phased refactoring approach to improve code organization, maintainability, and scalability.

## Current Issues

### Critical
- ❌ **`tasks/job_tasks.py` is too large** (1,283 lines, 9 tasks + 6 helpers)
- ❌ **Mixed responsibilities** (scheduling, dispatching, execution all in one file)
- ❌ **Duplicate job systems** (APScheduler + Celery Beat both active)

### Medium
- ⚠️ **Inconsistent task decorators** (`@shared_task` vs `@celery_app.task`)
- ⚠️ **Repetitive error handling** (15 endpoints with identical try/except)
- ⚠️ **No clear legacy vs current code separation**

### Low
- 🔵 Missing retry logic on some tasks
- 🔵 Limited observability/monitoring
- 🔵 No task timeout configuration per job type

## Refactoring Phases

---

## Phase 1: Split job_tasks.py (HIGH PRIORITY)

**Goal:** Break down the monolithic 1,283-line file into focused, maintainable modules

**Estimated Effort:** 8-12 hours
**Risk Level:** Medium (requires careful testing)

### Current Structure
```
tasks/job_tasks.py (1,283 lines)
├── check_job_schedules_task         # 100 lines
├── dispatch_job                     # 100 lines
├── _get_target_devices              # 70 lines
├── _convert_conditions_to_operations # 75 lines
├── _execute_job_type                # 40 lines
├── _execute_cache_devices           # 130 lines
├── _execute_sync_devices            # 160 lines
├── _execute_backup                  # 40 lines
├── _execute_run_commands            # 40 lines
├── _execute_compare_devices         # 220 lines
├── cache_devices_task (legacy)      # 115 lines
├── sync_checkmk_task (legacy)       # 65 lines
├── backup_configs_task (legacy)     # 65 lines
├── ansible_playbook_task (legacy)   # 75 lines
└── get_task_for_job                 # 10 lines
```

### Target Structure
```
tasks/
├── __init__.py                      # Export all tasks
├── scheduling/
│   ├── __init__.py
│   ├── schedule_checker.py          # check_job_schedules_task (~100 lines)
│   └── job_dispatcher.py            # dispatch_job + helpers (~200 lines)
├── execution/
│   ├── __init__.py
│   ├── base_executor.py             # _execute_job_type dispatcher (~80 lines)
│   ├── cache_executor.py            # _execute_cache_devices (~150 lines)
│   ├── sync_executor.py             # _execute_sync_devices (~180 lines)
│   ├── backup_executor.py           # _execute_backup (~60 lines)
│   ├── command_executor.py          # _execute_run_commands (~60 lines)
│   └── compare_executor.py          # _execute_compare_devices (~240 lines)
├── legacy/
│   ├── __init__.py
│   ├── cache_tasks.py              # cache_devices_task (~120 lines)
│   ├── sync_tasks.py               # sync_checkmk_task (~70 lines)
│   └── ansible_tasks.py            # backup_configs_task + ansible_playbook_task (~150 lines)
├── utils/
│   ├── __init__.py
│   ├── device_helpers.py           # _get_target_devices (~80 lines)
│   └── condition_helpers.py        # _convert_conditions_to_operations (~80 lines)
└── test_tasks.py                   # Keep as-is
```

### Implementation Steps

#### Step 1.1: Create directory structure
```bash
cd /Users/mp/programming/cockpit-ng/backend/tasks
mkdir -p scheduling execution legacy utils
touch scheduling/__init__.py execution/__init__.py legacy/__init__.py utils/__init__.py
```

#### Step 1.2: Move helper functions first (low risk)
**File:** `tasks/utils/device_helpers.py`
```python
"""Helper functions for device targeting and filtering."""
from typing import Optional, List, Dict, Any

def get_target_devices(template: dict, job_parameters: Optional[dict] = None) -> Optional[List]:
    """
    Determine target devices based on template configuration and parameters.
    Moved from job_tasks.py::_get_target_devices
    """
    # Move code from _get_target_devices here
    pass
```

**File:** `tasks/utils/condition_helpers.py`
```python
"""Helper functions for condition conversion and filtering."""
from typing import List, Dict, Any

def convert_conditions_to_operations(conditions: List) -> List:
    """
    Convert filter conditions to GraphQL operations.
    Moved from job_tasks.py::_convert_conditions_to_operations
    """
    # Move code from _convert_conditions_to_operations here
    pass
```

#### Step 1.3: Move scheduling tasks
**File:** `tasks/scheduling/schedule_checker.py`
```python
"""
Periodic task to check for due job schedules.
Runs every minute via Celery Beat.
"""
from celery_app import celery_app
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

@celery_app.task(name='tasks.check_job_schedules')
def check_job_schedules_task() -> dict:
    """
    Periodic Task: Check for due job schedules and dispatch them.
    Moved from job_tasks.py::check_job_schedules_task
    """
    # Move implementation here
    pass
```

**File:** `tasks/scheduling/job_dispatcher.py`
```python
"""
Main job dispatcher task.
Orchestrates job execution based on job type.
"""
from celery_app import celery_app
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

@celery_app.task(name='tasks.dispatch_job', bind=True)
def dispatch_job(
    self,
    schedule_id: Optional[int] = None,
    template_id: Optional[int] = None,
    job_name: str = "unnamed-job",
    job_type: str = "cache_devices",
    credential_id: Optional[int] = None,
    job_parameters: Optional[Dict[str, Any]] = None,
    triggered_by: str = "manual"
) -> Dict[str, Any]:
    """
    Main job dispatcher.
    Moved from job_tasks.py::dispatch_job
    """
    # Move implementation here
    pass
```

#### Step 1.4: Move executor functions
**File:** `tasks/execution/base_executor.py`
```python
"""
Base executor and job type dispatcher.
Routes job execution to appropriate executor.
"""
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

def execute_job_type(
    job_type: str,
    job_run_id: int,
    job_parameters: dict,
    task_instance
) -> Dict[str, Any]:
    """
    Route job execution to appropriate executor.
    Moved from job_tasks.py::_execute_job_type
    """
    from .cache_executor import execute_cache_devices
    from .sync_executor import execute_sync_devices
    from .backup_executor import execute_backup
    from .command_executor import execute_run_commands
    from .compare_executor import execute_compare_devices

    executors = {
        'cache_devices': execute_cache_devices,
        'sync_checkmk': execute_sync_devices,
        'backup': execute_backup,
        'run_commands': execute_run_commands,
        'compare_devices': execute_compare_devices,
    }

    executor = executors.get(job_type)
    if not executor:
        raise ValueError(f"Unknown job type: {job_type}")

    return executor(job_run_id, job_parameters, task_instance)
```

**File:** `tasks/execution/cache_executor.py`
```python
"""Cache devices job executor."""
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

def execute_cache_devices(
    job_run_id: int,
    job_parameters: dict,
    task_instance
) -> Dict[str, Any]:
    """
    Execute cache devices job.
    Moved from job_tasks.py::_execute_cache_devices
    """
    # Move implementation here
    pass
```

**File:** `tasks/execution/sync_executor.py`
```python
"""Sync devices to CheckMK job executor."""
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

def execute_sync_devices(
    job_run_id: int,
    job_parameters: dict,
    task_instance
) -> Dict[str, Any]:
    """
    Execute sync devices to CheckMK job.
    Moved from job_tasks.py::_execute_sync_devices
    """
    # Move implementation here
    pass
```

**File:** `tasks/execution/backup_executor.py`
```python
"""Backup configurations job executor."""
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

def execute_backup(
    job_run_id: int,
    job_parameters: dict,
    task_instance
) -> Dict[str, Any]:
    """
    Execute backup configurations job.
    Moved from job_tasks.py::_execute_backup
    """
    # Move implementation here
    pass
```

**File:** `tasks/execution/command_executor.py`
```python
"""Run commands job executor."""
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

def execute_run_commands(
    job_run_id: int,
    job_parameters: dict,
    task_instance
) -> Dict[str, Any]:
    """
    Execute run commands job.
    Moved from job_tasks.py::_execute_run_commands
    """
    # Move implementation here
    pass
```

**File:** `tasks/execution/compare_executor.py`
```python
"""Compare devices job executor."""
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

def execute_compare_devices(
    job_run_id: int,
    job_parameters: dict,
    task_instance
) -> Dict[str, Any]:
    """
    Execute compare devices job.
    Moved from job_tasks.py::_execute_compare_devices
    """
    # Move implementation here
    pass
```

#### Step 1.5: Move legacy tasks
**File:** `tasks/legacy/cache_tasks.py`
```python
"""
Legacy cache devices task.
DEPRECATED: Use new job system (dispatch_job with job_type='cache_devices')
Will be removed in future version.
"""
from celery_app import celery_app
import logging

logger = logging.getLogger(__name__)

@celery_app.task(name='tasks.cache_devices', bind=True)
def cache_devices_task(self, job_schedule_id: Optional[int] = None) -> dict:
    """
    DEPRECATED: Legacy cache devices task.
    Moved from job_tasks.py::cache_devices_task
    """
    logger.warning(
        "Using deprecated cache_devices_task. "
        "Please migrate to new job system with dispatch_job"
    )
    # Move implementation here
    pass
```

**File:** `tasks/legacy/sync_tasks.py`
```python
"""
Legacy sync CheckMK task.
DEPRECATED: Use new job system (dispatch_job with job_type='sync_checkmk')
"""
from celery_app import celery_app
import logging

logger = logging.getLogger(__name__)

@celery_app.task(name='tasks.sync_checkmk', bind=True)
def sync_checkmk_task(self, job_schedule_id: Optional[int] = None) -> dict:
    """DEPRECATED: Legacy sync CheckMK task."""
    logger.warning("Using deprecated sync_checkmk_task")
    # Move implementation here
    pass
```

**File:** `tasks/legacy/ansible_tasks.py`
```python
"""
Legacy Ansible tasks.
DEPRECATED: Use new job system
"""
from celery_app import celery_app
import logging

logger = logging.getLogger(__name__)

@celery_app.task(name='tasks.backup_configs', bind=True)
def backup_configs_task(self, job_schedule_id: Optional[int] = None) -> dict:
    """DEPRECATED: Legacy backup configs task."""
    logger.warning("Using deprecated backup_configs_task")
    # Move implementation here
    pass

@celery_app.task(name='tasks.ansible_playbook', bind=True)
def ansible_playbook_task(self, playbook_path: str, inventory: str, **kwargs) -> dict:
    """DEPRECATED: Legacy Ansible playbook task."""
    logger.warning("Using deprecated ansible_playbook_task")
    # Move implementation here
    pass
```

#### Step 1.6: Update main tasks/__init__.py
```python
"""
Celery tasks package.
Tasks are organized by function:
- scheduling: Schedule checking and job dispatching
- execution: Job type executors
- legacy: Deprecated tasks (will be removed)
- utils: Helper functions
"""

# Import scheduling tasks
from .scheduling.schedule_checker import check_job_schedules_task
from .scheduling.job_dispatcher import dispatch_job

# Import legacy tasks (for backwards compatibility)
from .legacy.cache_tasks import cache_devices_task
from .legacy.sync_tasks import sync_checkmk_task
from .legacy.ansible_tasks import backup_configs_task, ansible_playbook_task

# Import test tasks
from .test_tasks import test_task, test_progress_task

# Import periodic tasks
from .periodic_tasks import (
    cleanup_old_job_runs,
    update_job_schedules,
    health_check_task
)

__all__ = [
    # Active tasks
    'check_job_schedules_task',
    'dispatch_job',

    # Legacy tasks (deprecated)
    'cache_devices_task',
    'sync_checkmk_task',
    'backup_configs_task',
    'ansible_playbook_task',

    # Test tasks
    'test_task',
    'test_progress_task',

    # Periodic tasks
    'cleanup_old_job_runs',
    'update_job_schedules',
    'health_check_task',
]
```

#### Step 1.7: Testing checklist
- [ ] All existing Celery tasks still discoverable
- [ ] Task names remain unchanged (important for existing queued tasks)
- [ ] Imports work correctly from tasks package
- [ ] Beat schedules still trigger correctly
- [ ] Job execution completes successfully for each job type
- [ ] Legacy tasks still function (with deprecation warnings)
- [ ] Test tasks pass: `celery -A celery_app inspect registered`

---

## Phase 2: Standardize Task Decorators (HIGH PRIORITY)

**Goal:** Use consistent task decorator across all tasks
**Estimated Effort:** 2-4 hours
**Risk Level:** Low

### Current State
```python
# Mixed usage:
# tasks/job_tasks.py
@celery_app.task(name='tasks.dispatch_job', bind=True)

# services/background_jobs/checkmk_device_jobs.py
@shared_task(bind=True, name="add_device_to_checkmk")
```

### Decision: Use `@shared_task` (Recommended)

**Rationale:**
- More portable across different Celery apps
- Standard in modern Celery applications
- Already used in `services/background_jobs/`
- Easier to test (doesn't require app instance)

### Implementation Steps

#### Step 2.1: Update all tasks in tasks/ directory
**Before:**
```python
from celery_app import celery_app

@celery_app.task(name='tasks.dispatch_job', bind=True)
def dispatch_job(self, ...):
    pass
```

**After:**
```python
from celery import shared_task

@shared_task(bind=True, name='tasks.dispatch_job')
def dispatch_job(self, ...):
    pass
```

#### Step 2.2: Update files to convert
- [ ] `tasks/scheduling/schedule_checker.py`
- [ ] `tasks/scheduling/job_dispatcher.py`
- [ ] `tasks/legacy/cache_tasks.py`
- [ ] `tasks/legacy/sync_tasks.py`
- [ ] `tasks/legacy/ansible_tasks.py`
- [ ] `tasks/periodic_tasks.py`
- [ ] `tasks/test_tasks.py`

#### Step 2.3: Testing
- [ ] Verify task registration: `celery -A celery_app inspect registered`
- [ ] Test task execution: Submit and verify each task type
- [ ] Check task names in Celery Flower/monitoring
- [ ] Verify Beat schedules still trigger

---

## Phase 3: Centralize Error Handling (MEDIUM PRIORITY)

**Goal:** Reduce repetitive error handling in API endpoints
**Estimated Effort:** 4-6 hours
**Risk Level:** Low

### Current Problem
15 endpoints in `routers/celery_api.py` have identical error handling:
```python
try:
    # logic
except Exception as e:
    logger.error(f"Failed to {operation}: {e}")
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"Failed to {operation}: {str(e)}"
    )
```

### Solution: Create error handling decorator

#### Step 3.1: Create core/celery_error_handler.py
```python
"""
Centralized error handling for Celery API endpoints.
Provides consistent error logging and HTTP exception raising.
"""
from functools import wraps
from fastapi import HTTPException, status
import logging

logger = logging.getLogger(__name__)

def handle_celery_errors(operation: str):
    """
    Decorator for consistent Celery API error handling.

    Args:
        operation: Human-readable description of the operation
                  (e.g., "get task status", "submit test task")

    Usage:
        @router.get("/tasks/{task_id}")
        @handle_celery_errors("get task status")
        async def get_task_status(task_id: str):
            # No try/except needed
            return result
    """
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except HTTPException:
                # Re-raise HTTP exceptions as-is
                raise
            except Exception as e:
                logger.error(f"Failed to {operation}: {e}", exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to {operation}: {str(e)}"
                )

        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Failed to {operation}: {e}", exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to {operation}: {str(e)}"
                )

        # Return appropriate wrapper based on whether function is async
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator
```

#### Step 3.2: Update celery_api.py endpoints

**Before:**
```python
@router.get("/tasks/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(
    task_id: str,
    current_user: dict = Depends(require_permission("settings.celery", "read"))
):
    try:
        result = AsyncResult(task_id, app=celery_app)

        response = TaskStatusResponse(
            task_id=task_id,
            status=result.state
        )
        # ... more logic
        return response

    except Exception as e:
        logger.error(f"Failed to get task status for {task_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get task status: {str(e)}"
        )
```

**After:**
```python
from core.celery_error_handler import handle_celery_errors

@router.get("/tasks/{task_id}", response_model=TaskStatusResponse)
@handle_celery_errors("get task status")
async def get_task_status(
    task_id: str,
    current_user: dict = Depends(require_permission("settings.celery", "read"))
):
    result = AsyncResult(task_id, app=celery_app)

    response = TaskStatusResponse(
        task_id=task_id,
        status=result.state
    )
    # ... more logic
    return response
```

#### Step 3.3: Apply to all celery_api.py endpoints
- [ ] `submit_test_task` - "submit test task"
- [ ] `submit_progress_test_task` - "submit progress test task"
- [ ] `get_task_status` - "get task status"
- [ ] `cancel_task` - "cancel task"
- [ ] `list_workers` - "list workers"
- [ ] `list_schedules` - "list schedules"
- [ ] `beat_status` - "get beat status"
- [ ] `celery_status` - "get celery status"
- [ ] `get_celery_config` - "get celery config"
- [ ] `trigger_cache_devices` - "trigger cache devices task"
- [ ] `trigger_cache_locations` - "trigger cache locations task"
- [ ] `trigger_add_device_to_checkmk` - "add device to CheckMK"
- [ ] `trigger_update_device_in_checkmk` - "update device in CheckMK"
- [ ] `trigger_sync_devices_to_checkmk` - "sync devices to CheckMK"
- [ ] `trigger_compare_nautobot_and_checkmk` - "compare Nautobot and CheckMK"

#### Step 3.4: Testing
- [ ] All endpoints return appropriate errors
- [ ] Errors are logged with stack traces
- [ ] HTTP status codes correct (500 for server errors)
- [ ] Error messages are user-friendly

---

## Phase 4: Consolidate Job Systems (LOW PRIORITY)

**Goal:** Decide on single job execution system
**Estimated Effort:** 16-24 hours (if migrating)
**Risk Level:** High (affects existing jobs)

### Current Situation
Two parallel systems exist:

**APScheduler System:**
- Located in: `routers/jobs.py`, `services/apscheduler_job_service.py`
- Uses: In-memory Python scheduler
- Database: SQLite (`apscheduler_job_repository.py`)
- Size: ~20KB of code

**Celery Beat System:**
- Located in: `routers/job_schedules.py`, `tasks/job_tasks.py`
- Uses: Redis-backed distributed scheduler
- Database: SQLite (`job_schedule_repository.py`)
- Size: ~56KB of code (with job_tasks.py)

### Decision Required

#### Option A: Keep Both (Status Quo)
**Pros:**
- No migration needed
- Each optimized for different use cases
- Lower risk

**Cons:**
- Code duplication
- Confusion about which to use
- Double maintenance burden

**When to use:**
- APScheduler: Simple, single-server recurring tasks
- Celery: Complex, distributed, long-running jobs

#### Option B: Migrate to Celery Only (RECOMMENDED)
**Pros:**
- Single job system
- Better scalability
- Distributed execution
- Better monitoring (Flower)
- Task queuing

**Cons:**
- Requires Redis
- Migration effort
- More complex deployment

**Migration Steps:**
1. Audit all APScheduler jobs currently in use
2. Create equivalent Celery Beat schedules
3. Migrate job templates to Celery format
4. Test in parallel for 1-2 weeks
5. Deprecate APScheduler endpoints
6. Remove APScheduler code

#### Option C: Keep APScheduler Only
**Pros:**
- Simpler infrastructure (no Redis)
- Lighter weight
- Sufficient for single-server deployments

**Cons:**
- Limited scalability
- No distributed execution
- Less mature task monitoring

**Not recommended** if you plan to scale beyond single server.

### Recommendation: Option B (Celery Only)

**Phased Migration:**
1. **Week 1-2:** Document all existing APScheduler jobs
2. **Week 3-4:** Create Celery equivalents and test
3. **Week 5-6:** Run both systems in parallel
4. **Week 7:** Deprecate APScheduler (warning messages)
5. **Week 8+:** Remove APScheduler code

---

## Phase 5: Additional Improvements (OPTIONAL)

### 5.1: Add Task Retry Logic
```python
@shared_task(
    bind=True,
    name='tasks.dispatch_job',
    autoretry_for=(NetworkError, DatabaseError),
    retry_kwargs={'max_retries': 3},
    retry_backoff=True,
    retry_backoff_max=600,
    retry_jitter=True
)
def dispatch_job(self, ...):
    pass
```

### 5.2: Add Per-Job Timeouts
```python
# tasks/execution/cache_executor.py
@shared_task(
    bind=True,
    name='cache_devices',
    time_limit=3600,  # 1 hour hard limit
    soft_time_limit=3300  # 55 min soft limit
)
def cache_devices_task(self, ...):
    pass
```

### 5.3: Improve Observability
- Add structured logging (JSON format)
- Send task metrics to monitoring system
- Create Grafana dashboards for task execution
- Set up alerts for failed tasks

### 5.4: Add Task Result Persistence
```python
# Store detailed results in database for later analysis
@shared_task(bind=True)
def dispatch_job(self, ...):
    result = execute_job(...)

    # Store in job_runs table
    job_run_manager.update_job_run(
        job_run_id,
        status='completed',
        result=result,
        completed_at=datetime.utcnow()
    )

    return result
```

---

## Implementation Timeline

### Sprint 1 (Week 1-2): Phase 1 - Split job_tasks.py
**Effort:** 12-16 hours
- Day 1-2: Create directory structure, move helpers
- Day 3-4: Move scheduling tasks
- Day 5-7: Move executor functions
- Day 8-9: Move legacy tasks, update __init__.py
- Day 10: Testing and validation

**Deliverables:**
- ✅ New directory structure in place
- ✅ All tasks functioning from new locations
- ✅ No regression in existing functionality
- ✅ Documentation updated

### Sprint 2 (Week 3): Phase 2 & 3 - Standardize & Error Handling
**Effort:** 6-8 hours
- Day 1-2: Update task decorators to @shared_task
- Day 3: Create error handling decorator
- Day 4-5: Update celery_api.py endpoints

**Deliverables:**
- ✅ Consistent task decorator usage
- ✅ Centralized error handling
- ✅ Reduced code duplication

### Sprint 3 (Week 4-6): Phase 4 - Job System Consolidation (Optional)
**Effort:** 16-24 hours
- Week 4: Analysis and decision
- Week 5: Migration if proceeding
- Week 6: Parallel testing

**Deliverables:**
- ✅ Decision documented
- ✅ Migration plan if Option B chosen
- ✅ Testing results

---

## Success Metrics

### Code Quality
- [ ] No files > 500 lines in tasks/ directory
- [ ] Each module has single, clear responsibility
- [ ] Code duplication reduced by >60%
- [ ] Test coverage increased to >80%

### Performance
- [ ] Task execution time unchanged or improved
- [ ] No increase in task failure rate
- [ ] Celery worker memory usage stable

### Maintainability
- [ ] New job types can be added in <1 hour
- [ ] Clear separation of concerns
- [ ] Comprehensive documentation
- [ ] Easy to onboard new developers

---

## Risk Mitigation

### Risk: Breaking existing scheduled jobs
**Mitigation:**
- Maintain task names unchanged
- Test in development environment first
- Deploy during low-usage window
- Have rollback plan ready

### Risk: Import errors after restructuring
**Mitigation:**
- Keep backward-compatible imports in __init__.py
- Comprehensive import testing
- Use absolute imports, not relative

### Risk: Lost task state during migration
**Mitigation:**
- Don't delete old code until new code proven stable
- Monitor Celery task queue during transition
- Ability to route to old task if needed

---

## Testing Strategy

### Unit Tests
- Test each executor function independently
- Mock external dependencies (Nautobot, CheckMK)
- Verify error handling in each module

### Integration Tests
- End-to-end job execution for each job type
- Schedule trigger testing
- Task state transitions

### Performance Tests
- Compare task execution time before/after
- Monitor memory usage
- Check for resource leaks

### Regression Tests
- All existing jobs must continue working
- Scheduled jobs trigger correctly
- API endpoints return same responses

---

## Rollback Plan

If critical issues discovered after Phase 1 deployment:

1. **Immediate:**
   - Revert to backup of job_tasks.py (keep backup for 2 weeks)
   - Restart Celery workers
   - Verify task registration

2. **Communication:**
   - Notify team of rollback
   - Document issues encountered
   - Schedule post-mortem

3. **Recovery:**
   - Fix issues in development
   - Re-test thoroughly
   - Deploy fix when stable

---

## Documentation Updates Needed

### Code Documentation
- [ ] Add docstrings to all new modules
- [ ] Update tasks/__init__.py with module descriptions
- [ ] Add type hints to all functions
- [ ] Create architecture diagram of new structure

### User Documentation
- [ ] Update CLAUDE.md with new task structure
- [ ] Document which tasks are legacy vs current
- [ ] Add migration guide for developers
- [ ] Update API documentation

### Operations Documentation
- [ ] Update deployment instructions
- [ ] Document Celery worker configuration
- [ ] Add monitoring and troubleshooting guide
- [ ] Create runbook for common issues

---

## Next Steps

1. **Review this plan** with team
2. **Get approval** for Phase 1 & 2 (high priority)
3. **Decide on Phase 4** (job system consolidation)
4. **Schedule implementation** in upcoming sprints
5. **Set up feature branch** for refactoring work
6. **Begin Phase 1** implementation

---

## Questions to Answer

Before starting implementation:

- [ ] Which job system should we standardize on? (APScheduler vs Celery)
- [ ] Are there any scheduled jobs we can't afford to have fail during migration?
- [ ] What's our testing environment for Celery? (separate Redis instance?)
- [ ] Who will review the refactored code?
- [ ] What's the deployment schedule? (maintenance window needed?)
- [ ] Do we have monitoring in place for Celery tasks?

---

## Appendix: File Size Comparison

### Before Refactoring
```
tasks/job_tasks.py:              1,283 lines (TOO LARGE)
routers/celery_api.py:             584 lines (manageable)
Total Celery-related code:      ~2,500 lines
```

### After Phase 1
```
tasks/
├── scheduling/
│   ├── schedule_checker.py:      ~100 lines ✅
│   └── job_dispatcher.py:        ~200 lines ✅
├── execution/
│   ├── base_executor.py:          ~80 lines ✅
│   ├── cache_executor.py:        ~150 lines ✅
│   ├── sync_executor.py:         ~180 lines ✅
│   ├── backup_executor.py:        ~60 lines ✅
│   ├── command_executor.py:       ~60 lines ✅
│   └── compare_executor.py:      ~240 lines ✅
├── legacy/
│   ├── cache_tasks.py:           ~120 lines ✅
│   ├── sync_tasks.py:             ~70 lines ✅
│   └── ansible_tasks.py:         ~150 lines ✅
└── utils/
    ├── device_helpers.py:         ~80 lines ✅
    └── condition_helpers.py:      ~80 lines ✅

Largest file:                      ~240 lines ✅
Average file size:                 ~120 lines ✅
Total lines:                     ~1,570 lines (includes new organization overhead)
```

---

**Document Version:** 1.0
**Last Updated:** 2025-01-28
**Owner:** Backend Team
**Status:** Awaiting Approval
