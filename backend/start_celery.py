#!/usr/bin/env python
"""
Start script for Celery worker.

This script starts the Celery worker process with proper configuration.
Equivalent to: celery -A celery_worker worker --loglevel=info

Usage:
    python start_celery.py
"""

import os
import sys

# Ensure we're in the backend directory
backend_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(backend_dir)

# Add backend directory to Python path
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Import Celery app
from celery_app import celery_app
from config import settings

# Import all tasks to register them
try:
    from tasks import *
except ImportError as e:
    print(f"Warning: Could not import tasks: {e}")

def main():
    """Start the Celery worker."""
    print("=" * 70)
    print("Starting Cockpit-NG Celery Worker")
    print("=" * 70)
    print(f"Broker: {settings.celery_broker_url}")
    print(f"Backend: {settings.celery_result_backend}")
    print(f"Max Workers: {settings.celery_max_workers}")
    print(f"Log Level: INFO")
    print("=" * 70)
    print()

    # Start worker using argv
    argv = [
        'worker',
        '--loglevel=INFO',
        f'--concurrency={settings.celery_max_workers}',
        '--prefetch-multiplier=1',
        '--max-tasks-per-child=100',
    ]

    celery_app.worker_main(argv)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\nShutting down Celery worker...")
        sys.exit(0)
    except Exception as e:
        print(f"Error starting Celery worker: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
