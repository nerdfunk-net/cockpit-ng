"""
Celery tasks module.
Import all task modules here to register them with Celery.
"""

# Import task modules here
# from . import device_tasks
# from . import config_tasks
# from . import sync_tasks
# from . import compliance_tasks
from . import periodic_tasks
from . import test_tasks
from . import job_tasks

# Import background job tasks (outside tasks package)
from services.background_jobs import (  # noqa: F401
    cache_all_devices_task,
    cache_single_device_task,
    cache_all_locations_task,
    add_device_to_checkmk_task,
    update_device_in_checkmk_task,
    sync_devices_to_checkmk_task,
)

__all__ = ['periodic_tasks', 'test_tasks', 'job_tasks']
