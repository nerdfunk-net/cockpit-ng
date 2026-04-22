"""
Celery tasks package.

## Two invocation paths

### Path A — direct Celery tasks  (tasks/*.py)
Each file in this package root defines one or more ``@shared_task`` functions
that Celery registers by name.  Callers dispatch them directly:

    onboard_device_task.delay(ip_address=..., location_id=...)
    backup_single_device_task.s(device_id=...).apply_async()

These tasks own the Celery machinery: progress state updates
(``self.update_state``), retries, and chord/group orchestration.  Their
business logic should live in the service layer
(``services/``) — the task itself is a thin wrapper.

### Path B — job-template dispatcher  (tasks/scheduling/ + tasks/execution/)
When a user configures a Job Template and it fires (manually or via schedule),
the call chain is:

    check_job_schedules_task
        → dispatch_job          (tasks/scheduling/job_dispatcher.py)
            → execute_job_type  (tasks/execution/base_executor.py)
                → execute_<name>(tasks/execution/<name>_executor.py)

``dispatch_job`` is the only ``@shared_task`` in this path; executors are
plain functions — no Celery decorators — which makes them easy to unit-test.

## Rule: executors must not reimplement logic that already exists in Path A

When a job type (e.g. ``backup``) also has a standalone Celery task
(``backup_devices_task``), the executor **must** delegate to that task or to
the shared service layer it uses.  Never copy-paste the logic.

Correct patterns:
  - ``csv_export_executor`` → calls ``tasks.csv_export_task._run_csv_export``
  - ``get_client_data_task`` → calls ``tasks.execution.client_data_executor``

## Sub-packages
- scheduling/  schedule polling (check_job_schedules_task) and dispatch_job
- execution/   one executor per job type; routed by base_executor.execute_job_type
- utils/       pure helper functions shared across tasks
"""

# Import scheduling tasks
from .scheduling import check_job_schedules_task, dispatch_job

# Import test tasks
from .test_tasks import test_task, test_progress_task, debug_wait_task

# Import onboard device task
from .onboard_device_task import onboard_device_task

# Import bulk onboard devices task
from .bulk_onboard_task import bulk_onboard_devices_task

# Import export devices task
from .export_devices_task import export_devices_task

# Import update devices tasks
from .update_devices_task import update_devices_task
from .update_devices_from_csv_task import update_devices_from_csv_task

# Import update IP prefixes task
from .update_ip_prefixes_from_csv_task import update_ip_prefixes_from_csv_task

# Import update IP addresses task
from .update_ip_addresses_from_csv_task import update_ip_addresses_from_csv_task

# Import ping network task
from .ping_network_task import ping_network_task

# Import scan prefixes task
from .scan_prefixes_task import scan_prefixes_task

# Import check IP task
from .check_ip_task import check_ip_task

# Import IP addresses task
from .ip_addresses_task import ip_addresses_task

# Import periodic tasks
from .periodic_tasks import (
    worker_health_check,
    load_cache_schedules_task,
    dispatch_cache_task,
    cleanup_celery_data_task,
    cleanup_client_data_task,
    check_stale_jobs_task,
    cleanup_audit_logs_task,
)

# Import backup tasks
from .backup_tasks import backup_single_device_task, finalize_backup_task

# Import agent deploy tasks
from .agent_deploy_tasks import deploy_agent_task

# Import CSV import/update task
from .import_or_update_from_csv_task import import_or_update_from_csv_task

# Import CSV export task
from .csv_export_task import csv_export_task

# Import get client data task
from .get_client_data_task import get_client_data_task

# Import background job tasks (outside tasks package)
from services.background_jobs import (  # noqa: F401
    cache_all_devices_task,
    cache_single_device_task,
    cache_all_locations_task,
    add_device_to_checkmk_task,
    update_device_in_checkmk_task,
    sync_devices_to_checkmk_task,
)

__all__ = [
    # Active tasks
    "check_job_schedules_task",
    "dispatch_job",
    # Backup tasks
    "backup_single_device_task",
    "finalize_backup_task",
    # Agent deploy tasks
    "deploy_agent_task",
    # Test tasks
    "test_task",
    "test_progress_task",
    "debug_wait_task",
    # Device onboarding
    "onboard_device_task",
    "bulk_onboard_devices_task",
    # Device export
    "export_devices_task",
    # Device update
    "update_devices_task",
    "update_devices_from_csv_task",
    # IPAM updates
    "update_ip_prefixes_from_csv_task",
    "update_ip_addresses_from_csv_task",
    # Network tools
    "ping_network_task",
    "scan_prefixes_task",
    "check_ip_task",
    "ip_addresses_task",
    # CSV import/update from git repo
    "import_or_update_from_csv_task",
    # CSV export to git repo
    "csv_export_task",
    # Get client data
    "get_client_data_task",
    # Periodic tasks
    "worker_health_check",
    "load_cache_schedules_task",
    "dispatch_cache_task",
    "cleanup_celery_data_task",
    "cleanup_client_data_task",
    "check_stale_jobs_task",
    "cleanup_audit_logs_task",
]
