"""
Job scheduling and management routers.

This package contains routers for:
- Job templates (reusable job configurations)
- Job schedules (scheduled job execution)
- Job runs (execution history and status)
- Celery task queue API
"""

# Import all job routers
from .templates import router as templates_router
from .schedules import router as schedules_router
from .runs import router as runs_router
from .celery_api import router as celery_router

# Export all routers
__all__ = [
    "templates_router",
    "schedules_router",
    "runs_router",
    "celery_router",
]
