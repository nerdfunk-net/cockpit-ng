"""
Celery tasks package.
Tasks are organized by function:
- scheduling: Schedule checking and job dispatching
- execution: Job type executors
- utils: Helper functions
"""

# Import scheduling tasks
from .scheduling import check_job_schedules_task, dispatch_job

# Import test tasks
from .test_tasks import test_task, test_progress_task

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

# Import periodic tasks
from .periodic_tasks import (
    worker_health_check,
    load_cache_schedules_task,
    dispatch_cache_task,
    cleanup_celery_data_task,
)

# Import backup tasks
from .backup_tasks import backup_single_device_task, finalize_backup_task

# Import agent deploy tasks
from .agent_deploy_tasks import deploy_agent_task

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
    # Periodic tasks
    "worker_health_check",
    "load_cache_schedules_task",
    "dispatch_cache_task",
    "cleanup_celery_data_task",
]
