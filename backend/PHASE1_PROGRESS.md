# Phase 1 Progress: Split job_tasks.py

**Date Started:** 2025-01-28
**Status:** PARTIAL - Structure created, executors need extraction
**Completion:** 50%

## ✅ Completed

### 1. Directory Structure Created
```
tasks/
├── scheduling/
│   ├── __init__.py                  ✅ Created
│   ├── schedule_checker.py          ✅ Created (110 lines)
│   └── job_dispatcher.py            ✅ Created (120 lines)
├── execution/
│   ├── __init__.py                  ⚠️  Exists (empty)
│   ├── base_executor.py             ✅ Created (65 lines)
│   ├── cache_executor.py            ❌ TODO
│   ├── sync_executor.py             ❌ TODO
│   ├── backup_executor.py           ❌ TODO
│   ├── command_executor.py          ❌ TODO
│   └── compare_executor.py          ❌ TODO
├── legacy/
│   ├── __init__.py                  ⚠️  Exists (empty)
│   ├── cache_tasks.py              ❌ TODO
│   ├── sync_tasks.py               ❌ TODO
│   └── ansible_tasks.py            ❌ TODO
└── utils/
    ├── __init__.py                  ✅ Created
    ├── device_helpers.py            ✅ Created (80 lines)
    └── condition_helpers.py         ✅ Created (85 lines)
```

### 2. Files Created Successfully

**Helper Utilities:**
- ✅ `tasks/utils/device_helpers.py` - Contains `get_target_devices()` function
- ✅ `tasks/utils/condition_helpers.py` - Contains `convert_conditions_to_operations()` function
- ✅ `tasks/utils/__init__.py` - Exports both helper functions

**Scheduling Tasks:**
- ✅ `tasks/scheduling/schedule_checker.py` - Contains `check_job_schedules_task()`
- ✅ `tasks/scheduling/job_dispatcher.py` - Contains `dispatch_job()` task
- ✅ `tasks/scheduling/__init__.py` - Exports both scheduling tasks

**Execution Framework:**
- ✅ `tasks/execution/base_executor.py` - Job type dispatcher/router

### 3. Backup Created
- ✅ `tasks/job_tasks_original.py` - Full backup of original file

## ❌ Remaining Work

### 1. Extract Executor Functions
Need to extract and create the following files from job_tasks_original.py:

#### `tasks/execution/cache_executor.py`
- Function: `_execute_cache_devices` (lines 410-485, ~75 lines)
- Responsibility: Cache devices from Nautobot to Redis
- Dependencies: nautobot_service, cache_service, asyncio

#### `tasks/execution/sync_executor.py`
- Function: `_execute_sync_devices` (lines 488-650, ~162 lines)
- Responsibility: Sync devices from Nautobot to CheckMK
- Dependencies: nb2cmk_service, asyncio

#### `tasks/execution/backup_executor.py`
- Function: `_execute_backup` (lines 651-690, ~40 lines)
- Responsibility: Backup device configurations
- Dependencies: TBD from code

#### `tasks/execution/command_executor.py`
- Function: `_execute_run_commands` (lines 691-730, ~40 lines)
- Responsibility: Execute commands on devices
- Dependencies: TBD from code

#### `tasks/execution/compare_executor.py`
- Function: `_execute_compare_devices` (lines 731-951, ~220 lines)
- Responsibility: Compare device configurations between Nautobot and CheckMK
- Dependencies: nb2cmk_service, asyncio

### 2. Extract Legacy Tasks

#### `tasks/legacy/cache_tasks.py`
- Function: `cache_devices_task` (lines 952-1066, ~115 lines)
- Status: DEPRECATED - legacy task

#### `tasks/legacy/sync_tasks.py`
- Function: `sync_checkmk_task` (lines 1067-1131, ~65 lines)
- Status: DEPRECATED - legacy task

#### `tasks/legacy/ansible_tasks.py`
- Functions:
  - `backup_configs_task` (lines 1132-1197, ~65 lines)
  - `ansible_playbook_task` (lines 1198-1272, ~75 lines)
- Status: DEPRECATED - legacy tasks

### 3. Create __init__.py Files

#### `tasks/execution/__init__.py`
```python
"""Job execution modules."""
from .base_executor import execute_job_type
from .cache_executor import execute_cache_devices
from .sync_executor import execute_sync_devices
from .backup_executor import execute_backup
from .command_executor import execute_run_commands
from .compare_executor import execute_compare_devices

__all__ = [
    'execute_job_type',
    'execute_cache_devices',
    'execute_sync_devices',
    'execute_backup',
    'execute_run_commands',
    'execute_compare_devices',
]
```

#### `tasks/legacy/__init__.py`
```python
"""
DEPRECATED Legacy Tasks
These tasks are maintained for backwards compatibility.
New code should use the job template/schedule system with dispatch_job.
"""
from .cache_tasks import cache_devices_task
from .sync_tasks import sync_checkmk_task
from .ansible_tasks import backup_configs_task, ansible_playbook_task

__all__ = [
    'cache_devices_task',
    'sync_checkmk_task',
    'backup_configs_task',
    'ansible_playbook_task',
]
```

### 4. Update Main tasks/__init__.py

Need to update `/Users/mp/programming/cockpit-ng/backend/tasks/__init__.py` to export all refactored tasks:

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
from .scheduling import check_job_schedules_task, dispatch_job

# Import legacy tasks (for backwards compatibility)
from .legacy import (
    cache_devices_task,
    sync_checkmk_task,
    backup_configs_task,
    ansible_playbook_task
)

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

### 5. Testing Checklist
- [ ] All existing Celery tasks still discoverable
- [ ] Task names remain unchanged (important for existing queued tasks)
- [ ] Imports work correctly from tasks package
- [ ] Beat schedules still trigger correctly
- [ ] Job execution completes successfully for each job type:
  - [ ] cache_devices
  - [ ] sync_devices
  - [ ] backup
  - [ ] run_commands
  - [ ] compare_devices
- [ ] Legacy tasks still function (with deprecation warnings)
- [ ] Test task discovery: `celery -A celery_app inspect registered`
- [ ] Test task execution: Submit and verify each task type

## Next Steps

### Option A: Complete Extraction Manually (Recommended for Safety)
1. Extract each executor function into its respective file
2. Test each executor individually
3. Extract legacy tasks
4. Update __init__.py files
5. Test complete system
6. Remove original job_tasks.py

**Estimated Time:** 4-6 hours

### Option B: Use Original File with Imports (Quick Interim Solution)
1. Keep job_tasks_original.py as is
2. Create thin wrapper files in execution/ that import from original
3. Test that everything works
4. Gradually move functions over time

**Estimated Time:** 1 hour setup, ongoing migration

## Files Ready for Review

These files are complete and can be reviewed/tested:
1. `/Users/mp/programming/cockpit-ng/backend/tasks/utils/device_helpers.py`
2. `/Users/mp/programming/cockpit-ng/backend/tasks/utils/condition_helpers.py`
3. `/Users/mp/programming/cockpit-ng/backend/tasks/utils/__init__.py`
4. `/Users/mp/programming/cockpit-ng/backend/tasks/scheduling/schedule_checker.py`
5. `/Users/mp/programming/cockpit-ng/backend/tasks/scheduling/job_dispatcher.py`
6. `/Users/mp/programming/cockpit-ng/backend/tasks/scheduling/__init__.py`
7. `/Users/mp/programming/cockpit-ng/backend/tasks/execution/base_executor.py`

## Known Issues / Concerns

1. **Import Changes:** The refactored files now use imports like:
   - `from tasks.utils.device_helpers import get_target_devices`
   - `from tasks.execution.base_executor import execute_job_type`

   These need to be tested to ensure they work from within the tasks package.

2. **Circular Imports:** Potential for circular imports between:
   - schedule_checker → job_dispatcher
   - job_dispatcher → execution.base_executor
   - base_executor → individual executors

   Need to verify no circular dependencies exist.

3. **Task Names:** All task names must remain exactly the same:
   - `tasks.check_job_schedules`
   - `tasks.dispatch_job`
   - `tasks.cache_devices` (legacy)
   - `tasks.sync_checkmk` (legacy)
   - `tasks.backup_configs` (legacy)
   - `tasks.ansible_playbook` (legacy)

4. **Async Event Loops:** Several functions create new event loops. Need to ensure:
   - Loops are properly closed
   - No conflicts with existing event loops
   - Works correctly in Celery worker context

## Rollback Plan

If issues arise:
1. Restore from `job_tasks_original.py`
2. Remove new directory structure
3. Update imports to point back to original

Backup location: `/Users/mp/programming/cockpit-ng/backend/tasks/job_tasks_original.py`

## Success Criteria

Phase 1 is complete when:
- ✅ All executor functions extracted to separate files
- ✅ All legacy tasks extracted to legacy/ directory
- ✅ All __init__.py files created and exports working
- ✅ All task names unchanged
- ✅ Task discovery works: `celery -A celery_app inspect registered`
- ✅ All job types execute successfully
- ✅ No regressions in existing functionality
- ✅ Code review passed
- ✅ Documentation updated

---

**Current Status:** Partial completion - framework in place, executors need extraction
**Next Task:** Extract executor functions to individual files
**Blocker:** None - can proceed with extraction
