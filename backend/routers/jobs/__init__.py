"""
Job scheduling and management routers.

This package contains routers for:
- Job templates (reusable job configurations)
- Job schedules (scheduled job execution)
- Job runs (execution history and status)
- Celery infrastructure management (celery_admin)
- Device lifecycle tasks (device_tasks)
- Sync/integration tasks (sync_tasks)
- Network scanning tasks (network_tasks)
"""

# Import all job routers
from .templates import router as templates_router
from .schedules import router as schedules_router
from .runs import router as runs_router
from .celery_admin import router as celery_admin_router
from .device_tasks import router as device_tasks_router
from .sync_tasks import router as sync_tasks_router
from .network_tasks import router as network_tasks_router

# Export all routers
__all__ = [
    "templates_router",
    "schedules_router",
    "runs_router",
    "celery_admin_router",
    "device_tasks_router",
    "sync_tasks_router",
    "network_tasks_router",
]
