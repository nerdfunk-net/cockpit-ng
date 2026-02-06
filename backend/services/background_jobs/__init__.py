"""
Background jobs package for Celery tasks.

This package contains Celery tasks for background processing including:
- Device caching from Nautobot
- Location caching from Nautobot
- CheckMK device management (add/update/sync)
- Periodic data synchronization
"""

from services.background_jobs.device_cache_jobs import (
    cache_all_devices_task,
    cache_single_device_task,
)
from services.background_jobs.location_cache_jobs import cache_all_locations_task
from services.background_jobs.checkmk_device_jobs import (
    add_device_to_checkmk_task,
    update_device_in_checkmk_task,
    sync_devices_to_checkmk_task,
)
from services.background_jobs.diff_viewer_jobs import (
    get_diff_between_nb_checkmk_task,
)

__all__ = [
    "cache_all_devices_task",
    "cache_single_device_task",
    "cache_all_locations_task",
    "add_device_to_checkmk_task",
    "update_device_in_checkmk_task",
    "sync_devices_to_checkmk_task",
    "get_diff_between_nb_checkmk_task",
]
