"""
Celery Beat entry point for `celery -A celery_beat beat` invocation style.

PREFERRED: Use `python start_beat.py` instead.
  - Includes proper startup banner
  - Validates schedule count on startup
  - Handles KeyboardInterrupt cleanly

This file is kept for compatibility with environments that call
`celery -A celery_beat beat` directly (e.g., some Docker setups).
"""

from celery_app import celery_app  # noqa: F401

import core.celery_signals  # noqa: F401 - Import for side effects (signal registration)

try:
    from tasks import *  # noqa: F403 - intentional star import for task registration
except ImportError:
    pass

try:
    from beat_schedule import CELERY_BEAT_SCHEDULE  # noqa: F401
except ImportError:
    pass

if __name__ == "__main__":
    celery_app.start()
