#!/usr/bin/env python
"""
Start script for Celery Beat scheduler.

This script starts the Celery Beat scheduler process with proper configuration.
Equivalent to: celery -A celery_beat beat --loglevel=info

Usage:
    python start_beat.py

IMPORTANT: Only run ONE Beat scheduler instance per environment!
"""

import os
import sys

# Ensure we're in the backend directory
backend_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(backend_dir)

# Add backend directory to Python path
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Import Celery app (after path setup)
from celery_app import celery_app  # noqa: E402
from config import settings  # noqa: E402

# Import beat schedule
try:
    from beat_schedule import CELERY_BEAT_SCHEDULE  # noqa: E402

    schedule_count = len(CELERY_BEAT_SCHEDULE)
except ImportError:
    schedule_count = 0
    print("Warning: Could not import beat_schedule")


def main():
    """Start the Celery Beat scheduler."""
    print("=" * 70)
    print("Starting Cockpit-NG Celery Beat Scheduler")
    print("=" * 70)
    print(f"Broker: {settings.celery_broker_url}")
    print(f"Backend: {settings.celery_result_backend}")
    print("Scheduler: RedBeat (Redis-based)")
    print(f"Scheduled Tasks: {schedule_count}")
    print("Log Level: INFO")
    print("=" * 70)
    print()
    print("⚠️  IMPORTANT: Only run ONE Beat instance per environment!")
    print()

    # Start beat scheduler using argv
    argv = [
        "beat",
        "--loglevel=INFO",
    ]

    celery_app.start(argv)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nShutting down Celery Beat scheduler...")
        sys.exit(0)
    except Exception as e:
        print(f"Error starting Celery Beat: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
