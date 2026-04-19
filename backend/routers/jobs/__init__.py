"""
Job scheduling and management routers.

This package contains routers for:
- Job templates (reusable job configurations)
- Job schedules (scheduled job execution)
- Job runs (execution history and status)
- Celery infrastructure management (celery_admin)
- Device onboarding tasks (onboarding)
- Device backup tasks (device_backup)
- Agent deployment tasks (agent_deploy)
- Device export tasks (export)
- Device import/update tasks (import_update)
- Check IP tasks (check_ip)
- Client data collection tasks (client_data)
- Sync/integration tasks (sync_tasks)
- Network scanning tasks (network_tasks)
"""

from .templates import router as templates_router
from .schedules import router as schedules_router
from .runs import router as runs_router
from .celery_admin import router as celery_admin_router
from .onboarding import router as onboarding_router
from .device_backup import router as device_backup_router
from .agent_deploy import router as agent_deploy_router
from .export import router as export_router
from .import_update import router as import_update_router
from .check_ip import router as check_ip_router
from .client_data import router as client_data_router
from .sync_tasks import router as sync_tasks_router
from .network_tasks import router as network_tasks_router

__all__ = [
    "templates_router",
    "schedules_router",
    "runs_router",
    "celery_admin_router",
    "onboarding_router",
    "device_backup_router",
    "agent_deploy_router",
    "export_router",
    "import_update_router",
    "check_ip_router",
    "client_data_router",
    "sync_tasks_router",
    "network_tasks_router",
]
