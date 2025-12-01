"""Celery Beat scheduler entry point.
Run with: celery -A celery_beat beat --loglevel=info
"""

from celery_app import celery_app

# Import all tasks and schedules to register them
try:
    from tasks import *  # noqa: F403 - intentional star import for task registration
except ImportError:
    # tasks module not yet created, will be added later
    pass

try:
    from beat_schedule import CELERY_BEAT_SCHEDULE  # noqa: F401 - imported for side effects
except ImportError:
    # beat_schedule.py not yet created, will be added later
    pass

if __name__ == "__main__":
    celery_app.start()
