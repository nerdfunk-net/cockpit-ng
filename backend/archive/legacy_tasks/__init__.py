"""
DEPRECATED Legacy Tasks
These tasks are maintained for backwards compatibility.
New code should use the job template/schedule system with dispatch_job.
"""

from .cache_tasks import cache_devices_task
from .sync_tasks import sync_checkmk_task
from .ansible_tasks import backup_configs_task, ansible_playbook_task

__all__ = [
    "cache_devices_task",
    "sync_checkmk_task",
    "backup_configs_task",
    "ansible_playbook_task",
]
