"""
Celery worker entry point for `celery -A celery_worker worker` invocation style.

PREFERRED: Use `python start_celery.py` instead.
  - Auto-detects macOS vs Linux and selects appropriate pool (solo vs prefork)
  - Installs certificates from config/certs/ if INSTALL_CERTIFICATE_FILES=true
  - Loads queue list from database when CELERY_WORKER_QUEUE is not set
  - Handles KeyboardInterrupt cleanly

This file is kept for compatibility with environments that call
`celery -A celery_worker worker` directly (e.g., some Docker setups that
override the pool and queue arguments themselves).
"""

from celery_app import celery_app  # noqa: F401

import core.celery_signals  # noqa: F401 - Import for side effects (signal registration)

try:
    from tasks import *  # noqa: F403 - intentional star import for task registration
except ImportError:
    pass

if __name__ == "__main__":
    celery_app.start()
