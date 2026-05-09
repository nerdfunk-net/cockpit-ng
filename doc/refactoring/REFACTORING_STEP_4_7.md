# Refactoring Step 4.7 — Jobs Trio: `jobs_manager.py` + `job_template_manager.py` + `job_run_manager.py`

**Priority:** 4 — Manager Migration  
**Risk:** High (40+ callers, task infrastructure)  
**Estimated effort:** 2–3 days  
**Prerequisites:** None strictly required, but do this last — it has the most callers  
**Independent of:** Steps 4.1–4.6 (do those first to reduce total manager count)  

---

## Goal

Migrate three interdependent managers together:
- `backend/jobs_manager.py` (416 lines) → `backend/services/jobs/job_schedule_service.py`
- `backend/job_template_manager.py` (669 lines) → `backend/services/jobs/job_template_service.py`
- `backend/job_run_manager.py` (400 lines) → `backend/services/jobs/job_run_service.py`

These are coupled:
- `job_run_manager.py` imports both `jobs_manager` and `job_template_manager` (top-level)
- `jobs_manager.py` imports `job_template_manager` (top-level, `from job_template_manager import get_job_template`)
- `job_run_manager._model_to_dict()` calls `jobs_manager.get_job_schedule()` and `job_template_manager.get_job_template()` to enrich run dicts with names

Migrating all three together eliminates the circular dependency issue.

---

## Callers — `job_run_manager`

This is the most-imported manager in the codebase (40+ sites).

```bash
grep -rn "import job_run_manager\|from job_run_manager" backend/ --include="*.py" | grep -v __pycache__
```

**Routers (top-level imports):**
- `routers/jobs/onboarding.py`
- `routers/jobs/import_update.py`
- `routers/jobs/check_ip.py`
- `routers/jobs/client_data.py`
- `routers/jobs/export.py`
- `routers/jobs/runs.py` (also lazy imports `jobs_manager`, `job_template_manager`)

**Tasks (lazy imports inside functions):**
- `tasks/import_devices_task.py` × 2
- `tasks/update_devices_from_csv_task.py` × 2
- `tasks/update_devices_task.py` × 2
- `tasks/csv_export_task.py` × 2
- `tasks/check_ip_task.py` (top-level)
- `tasks/ping_network_task.py` (top-level)
- `tasks/test_tasks.py`
- `tasks/update_ip_addresses_from_csv_task.py` × 2
- `tasks/bulk_onboard_task.py`
- `tasks/export_devices_task.py` × 2
- `tasks/backup_tasks.py`
- `tasks/periodic_tasks.py` × 3
- `tasks/scheduling/job_dispatcher.py` (also imports `job_template_manager`)
- `tasks/execution/backup_executor.py` (also imports `jobs_manager`, `job_template_manager`)
- `tasks/execution/deploy_agent_executor.py` (also imports `jobs_manager`, `job_template_manager`)

**Services (lazy imports):**
- `services/background_jobs/device_cache_jobs.py` × 2
- `services/background_jobs/location_cache_jobs.py` × 3
- `services/background_jobs/checkmk_device_jobs.py` × 2
- `services/nautobot/imports/prefix_update_service.py` × 2
- `services/nautobot/imports/csv_import_service.py` × 2
- `services/network/scanning/prefix_scan_service.py` × 2
- `services/templates/render_orchestrator.py`

**Other:**
- `scripts/debug/debug_job.py`
- `main.py` (lazy, cleans up stale job runs on startup)

---

## Callers — `jobs_manager` (job schedules)

```bash
grep -rn "import jobs_manager\|from jobs_manager" backend/ --include="*.py" | grep -v __pycache__
```

- `routers/jobs/schedules.py` (top-level + lazy)
- `routers/jobs/runs.py` (lazy)
- `tasks/scheduling/schedule_checker.py` (lazy)
- `tasks/execution/backup_executor.py` (lazy)
- `tasks/execution/deploy_agent_executor.py` (lazy)

---

## Callers — `job_template_manager`

```bash
grep -rn "import job_template_manager\|from job_template_manager" backend/ --include="*.py" | grep -v __pycache__
```

- `routers/jobs/templates.py` (top-level)
- `routers/jobs/runs.py` (lazy)
- `routers/jobs/schedules.py` (lazy)
- `tasks/scheduling/schedule_checker.py` (lazy)
- `tasks/scheduling/job_dispatcher.py` (lazy)
- `tasks/execution/backup_executor.py` (lazy)
- `tasks/execution/deploy_agent_executor.py` (lazy)

---

## Design: Dependency Injection Between Services

The key design decision: `job_run_manager._model_to_dict()` calls `jobs_manager.get_job_schedule()` and `job_template_manager.get_job_template()` to add `schedule_name` and `template_name` to each run dict.

In the new design, `JobRunService` receives the other two services via constructor injection:

```python
class JobRunService:
    def __init__(
        self,
        schedule_service: "JobScheduleService",
        template_service: "JobTemplateService",
    ) -> None:
        ...
```

The factory function wires them together:
```python
def build_job_run_service():
    return JobRunService(
        schedule_service=build_job_schedule_service(),
        template_service=build_job_template_service(),
    )
```

---

## New Files

### `backend/services/jobs/__init__.py`

Empty or with exports.

### `backend/services/jobs/job_template_service.py`

Direct conversion of `job_template_manager.py` to a class.

```python
"""Job template service — CRUD for job_templates table."""

from __future__ import annotations
import json
import logging
from typing import Any, Dict, List, Optional

from repositories.jobs.job_template_repository import JobTemplateRepository

logger = logging.getLogger(__name__)


class JobTemplateService:
    def __init__(self) -> None:
        self._repo = JobTemplateRepository()

    def create_job_template(
        self,
        name: str,
        job_type: str,
        user_id: int,
        created_by: str,
        # ... all the same parameters as job_template_manager.create_job_template() ...
        **kwargs,
    ) -> Dict[str, Any]:
        # Identical implementation to job_template_manager.create_job_template()
        ...

    def get_job_template(self, template_id: int) -> Optional[Dict[str, Any]]:
        ...

    def get_job_template_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        ...

    def list_job_templates(
        self,
        user_id: Optional[int] = None,
        job_type: Optional[str] = None,
        include_global: bool = True,
    ) -> List[Dict[str, Any]]:
        ...

    def update_job_template(self, template_id: int, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        ...

    def delete_job_template(self, template_id: int) -> bool:
        ...

    def _to_dict(self, template) -> Dict[str, Any]:
        ...
```

**Implementation note:** Read `job_template_manager.py` fully before implementing — it has many fields (scan parameters, deploy parameters, backup parameters, etc.) that must be preserved exactly in `_to_dict`.

---

### `backend/services/jobs/job_schedule_service.py`

Direct conversion of `jobs_manager.py` to a class.

```python
"""Job schedule service — CRUD and scheduling logic for job_schedules table."""

from __future__ import annotations
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, TYPE_CHECKING

from croniter import croniter
from repositories.jobs.job_schedule_repository import JobScheduleRepository

if TYPE_CHECKING:
    from services.jobs.job_template_service import JobTemplateService

logger = logging.getLogger(__name__)


class JobScheduleService:
    def __init__(self, template_service: "JobTemplateService") -> None:
        self._repo = JobScheduleRepository()
        self._template_service = template_service

    def create_job_schedule(self, ...) -> Dict[str, Any]:
        ...

    def get_job_schedule(self, job_id: int) -> Optional[Dict[str, Any]]:
        ...

    def list_job_schedules(self, ...) -> List[Dict[str, Any]]:
        ...

    def update_job_schedule(self, job_id: int, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        ...

    def delete_job_schedule(self, job_id: int) -> bool:
        ...

    def get_active_schedules(self) -> List[Dict[str, Any]]:
        ...

    def get_due_schedules(self) -> List[Dict[str, Any]]:
        ...

    def update_next_run(self, job_id: int, next_run: Optional[datetime] = None) -> bool:
        ...

    @staticmethod
    def calculate_next_run(schedule: Dict[str, Any]) -> Optional[datetime]:
        # Same logic as jobs_manager.calculate_next_run()
        ...

    def _to_dict(self, schedule) -> Dict[str, Any]:
        ...
```

---

### `backend/services/jobs/job_run_service.py`

Direct conversion of `job_run_manager.py` to a class.

```python
"""Job run service — tracking and lifecycle for Celery task runs."""

from __future__ import annotations
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, TYPE_CHECKING

from repositories.jobs.job_run_repository import job_run_repository as repo

if TYPE_CHECKING:
    from services.jobs.job_schedule_service import JobScheduleService
    from services.jobs.job_template_service import JobTemplateService

logger = logging.getLogger(__name__)


class JobRunService:
    def __init__(
        self,
        schedule_service: "JobScheduleService",
        template_service: "JobTemplateService",
    ) -> None:
        self._repo = repo
        self._schedule_service = schedule_service
        self._template_service = template_service

    def create_job_run(
        self,
        job_name: str,
        job_type: str,
        triggered_by: str = "schedule",
        job_schedule_id: Optional[int] = None,
        job_template_id: Optional[int] = None,
        target_devices: Optional[List[str]] = None,
        executed_by: Optional[str] = None,
    ) -> Dict[str, Any]:
        ...

    def get_job_run(self, run_id: int) -> Optional[Dict[str, Any]]:
        ...

    def get_job_run_by_celery_id(self, celery_task_id: str) -> Optional[Dict[str, Any]]:
        ...

    def get_job_runs_by_celery_ids(self, celery_task_ids: List[str]) -> List[Dict[str, Any]]:
        ...

    def list_job_runs(self, page: int = 1, page_size: int = 25, **filters) -> Dict[str, Any]:
        ...

    def mark_started(self, run_id: int, celery_task_id: str) -> Optional[Dict[str, Any]]:
        ...

    def mark_completed(self, run_id: int, result: Optional[Dict] = None) -> Optional[Dict[str, Any]]:
        ...

    def mark_failed(self, run_id: int, error_message: str) -> Optional[Dict[str, Any]]:
        ...

    def mark_cancelled(self, run_id: int) -> Optional[Dict[str, Any]]:
        ...

    def get_dashboard_stats(self) -> Dict[str, Any]:
        # Contains raw SQL — preserve exactly as in job_run_manager.get_dashboard_stats()
        ...

    def cleanup_old_runs(self, days: int = 30) -> int:
        ...

    def clear_filtered_runs(self, **filters) -> int:
        ...

    def _to_dict(self, job_run_data) -> Dict[str, Any]:
        # Enriches with schedule_name and template_name using injected services
        # Replace jobs_manager.get_job_schedule() → self._schedule_service.get_job_schedule()
        # Replace job_template_manager.get_job_template() → self._template_service.get_job_template()
        ...
```

---

## `service_factory.py` Additions

```python
def build_job_template_service():
    """Create a fresh JobTemplateService instance."""
    from services.jobs.job_template_service import JobTemplateService
    return JobTemplateService()


def build_job_schedule_service():
    """Create a fresh JobScheduleService instance (with JobTemplateService injected)."""
    from services.jobs.job_schedule_service import JobScheduleService
    return JobScheduleService(template_service=build_job_template_service())


def build_job_run_service():
    """Create a fresh JobRunService instance (with schedule and template services injected)."""
    from services.jobs.job_run_service import JobRunService
    return JobRunService(
        schedule_service=build_job_schedule_service(),
        template_service=build_job_template_service(),
    )
```

---

## `dependencies.py` Additions

```python
def get_job_template_service():
    """Provide a JobTemplateService instance."""
    return service_factory.build_job_template_service()


def get_job_schedule_service():
    """Provide a JobScheduleService instance."""
    return service_factory.build_job_schedule_service()


def get_job_run_service():
    """Provide a JobRunService instance."""
    return service_factory.build_job_run_service()
```

---

## Caller Updates — Strategy

Given the scale (40+ callers), the migration strategy is:

### A. Routers (use `Depends()`)

**`routers/jobs/runs.py`:**
```python
# Before:
import job_run_manager

# After:
from dependencies import get_job_run_service
from services.jobs.job_run_service import JobRunService

# Each endpoint becomes:
async def list_runs(
    job_run_service: JobRunService = Depends(get_job_run_service),
    ...
):
    return job_run_service.list_job_runs(...)
```

Apply the same pattern to all 6 job routers.

### B. Tasks (use `service_factory` directly)

For every Celery task that does:
```python
import job_run_manager
job_run_manager.create_job_run(...)
job_run_manager.mark_started(...)
job_run_manager.mark_completed(...)
job_run_manager.mark_failed(...)
```

Replace with:
```python
import service_factory
_jrs = service_factory.build_job_run_service()
_jrs.create_job_run(...)
_jrs.mark_started(...)
_jrs.mark_completed(...)
_jrs.mark_failed(...)
```

Or create a helper at the top of each task file:
```python
def _job_run_service():
    import service_factory
    return service_factory.build_job_run_service()
```

The lazy-import-per-call pattern is already established in the tasks (to avoid circular imports at module load time), so this pattern is consistent.

### C. Services (use `service_factory` directly)

Same as tasks:
```python
import service_factory
job_run_manager = service_factory.build_job_run_service()
```

### D. `tasks/scheduling/schedule_checker.py` and `job_dispatcher.py`

These import both `jobs_manager` and `job_template_manager`. Replace both:
```python
import service_factory
jobs_manager = service_factory.build_job_schedule_service()
job_template_manager = service_factory.build_job_template_service()
```

### E. `main.py` startup

```python
# Before:
import jobs_manager
jobs_manager.cleanup_stale_runs()  # or similar

# After:
import service_factory
service_factory.build_job_run_service().cleanup_stale_runs()
```

---

## Phased Approach (Recommended for High Risk)

Given 40+ callers, implement in phases within this step to limit blast radius:

**Phase 1 — Create new services, keep old managers**
- Create all 3 new service files
- Add factory functions
- Run backend to verify import succeeds
- No callers changed yet

**Phase 2 — Update routers (6 files)**
- Routers use `Depends()`, lowest risk
- Verify all job router endpoints work end-to-end

**Phase 3 — Update tasks (20+ files)**
- Change all lazy `import job_run_manager` to `service_factory.build_job_run_service()`
- Test by triggering several job types

**Phase 4 — Update services (10 files)**
- Change background_jobs, nautobot imports, network scanning
- Test background jobs

**Phase 5 — Delete old managers**
- Remove `job_run_manager.py`, `jobs_manager.py`, `job_template_manager.py`
- Run full grep to verify 0 references remain

---

## `services/jobs/` Directory

Ensure the directory and `__init__.py` exist:
```bash
mkdir -p backend/services/jobs
touch backend/services/jobs/__init__.py
```

Note: `backend/services/jobs/` may already exist (since the audit report referenced it). Verify:
```bash
ls backend/services/jobs/
```

---

## Key Implementation Details

### `job_run_manager.get_dashboard_stats()` — Raw SQL

This method uses `sqlalchemy.text()` with raw SQL. Preserve it exactly:
```python
def get_dashboard_stats(self) -> Dict[str, Any]:
    from core.database import get_db_session
    from sqlalchemy import text
    session = get_db_session()
    try:
        job_stats = session.execute(text("""
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                   SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                   SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running
            FROM job_runs
        """)).fetchone()
        # ... (full implementation preserved)
    finally:
        session.close()
```

### `jobs_manager.calculate_next_run()` — Complex Cron Logic

`jobs_manager.py` contains scheduling logic using `croniter`. This must be preserved exactly — do not simplify. Copy the function body into `JobScheduleService.calculate_next_run()` as a static or class method.

### Module-Level Repository Singleton in `job_run_manager.py`

```python
from repositories.jobs.job_run_repository import job_run_repository as repo
```

`job_run_repository` is already a module-level singleton. In the new service, store it as `self._repo = repo` — same as the original.

---

## Steps

1. Check if `backend/services/jobs/` exists; create with `__init__.py` if not.
2. Read all 3 manager files completely before writing new services.
3. Phase 1: Create `job_template_service.py`, `job_schedule_service.py`, `job_run_service.py`.
4. Add 3 factory functions to `service_factory.py`.
5. Add 3 `get_*` functions to `dependencies.py`.
6. Phase 2: Update 6 router files to use `Depends()`.
7. Phase 3: Update 20+ task files (lazy imports).
8. Phase 4: Update 10 service files (lazy imports).
9. Phase 5: Update `main.py`.
10. Verify with grep that all old manager names are gone.
11. Delete `job_run_manager.py`, `jobs_manager.py`, `job_template_manager.py`.

---

## Verification Checklist

- [ ] `grep -rn "import job_run_manager\|from job_run_manager" backend/` → 0 results
- [ ] `grep -rn "import jobs_manager\|from jobs_manager" backend/` → 0 results
- [ ] `grep -rn "import job_template_manager\|from job_template_manager" backend/` → 0 results
- [ ] All 3 manager files deleted
- [ ] `services/jobs/job_run_service.py` exists
- [ ] `services/jobs/job_schedule_service.py` exists
- [ ] `services/jobs/job_template_service.py` exists
- [ ] Backend starts: `python -c "import main"`
- [ ] Job run creation works (trigger a job, verify it appears in runs list)
- [ ] Job schedule CRUD works
- [ ] Job template CRUD works
- [ ] Dashboard stats endpoint returns correct data
- [ ] Celery tasks complete and update job run status correctly
- [ ] Schedule checker fires scheduled jobs correctly
