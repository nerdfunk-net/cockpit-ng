#!/usr/bin/env python
"""
Start script for Celery worker with platform-aware configuration.

This script automatically detects the operating system and configures the Celery
worker pool accordingly:

Platform Detection:
    - macOS (Darwin): Uses 'solo' pool to avoid SIGSEGV crashes with asyncio event
      loops in forked processes. Tasks using asyncio.run() or asyncio.new_event_loop()
      (like cache_all_devices_task) are incompatible with fork() on macOS.

    - Linux/Other: Uses 'prefork' pool for optimal performance and concurrency.
      Recommended for production deployments.

Environment Variables:
    CELERY_WORKER_QUEUE: Comma-separated queue names to listen to.
                         Examples:
                         - "backup" (single queue)
                         - "default,network,heavy" (multiple queues)
                         - "" or not set (ALL queues from database - default behavior)

    INSTALL_CERTIFICATE_FILES: Set to 'true' to install certificates from
        config/certs/ to the system CA store on startup (for Docker environments).
        Also supported by start.py (backend startup).

Behavior:
    - If CELERY_WORKER_QUEUE is NOT set: Worker listens to ALL queues configured in database
    - If CELERY_WORKER_QUEUE is set: Worker listens only to specified queues
    - Pool type is automatically selected based on detected platform

Usage:
    # Listen to ALL queues from database (automatic pool selection)
    python start_celery.py

    # Listen to specific queue
    CELERY_WORKER_QUEUE=backup python start_celery.py

    # Listen to multiple specific queues
    CELERY_WORKER_QUEUE=default,network,heavy python start_celery.py

Notes:
    - macOS developers: Worker runs in 'solo' mode (single process)
    - Linux production: Worker runs in 'prefork' mode (multi-process)
    - All asyncio-based tasks work correctly on both platforms
"""

import os
import platform
import sys

# Ensure we're in the backend directory
backend_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(backend_dir)

# Add backend directory to Python path
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Import Celery app (after path setup)
from celery_app import celery_app  # noqa: E402
from cert_installer import install_certificates  # noqa: E402
from config import settings  # noqa: E402

# Import worker lifecycle signals (MUST be imported before starting worker)
# This ensures each worker process gets its own isolated database engine
import core.celery_signals  # noqa: E402, F401 - Import for side effects (signal registration)

# Import all tasks to register them
try:
    from tasks import *  # noqa: E402, F403 - intentional for task registration
except ImportError as e:
    print(f"Warning: Could not import tasks: {e}")


def get_worker_pool():
    """
    Determine the appropriate Celery worker pool based on the operating system.

    macOS (Darwin): Uses 'solo' pool to avoid SIGSEGV crashes with asyncio event loops
                    in forked processes. The asyncio.run() and asyncio.new_event_loop()
                    calls in tasks like cache_all_devices_task are incompatible with
                    fork() on macOS.

    Linux/Other: Uses 'prefork' pool for optimal performance and concurrency.

    Returns:
        str: 'solo' for macOS, 'prefork' for Linux/other systems
    """
    system = platform.system().lower()

    if system == "darwin":  # macOS
        return "solo"
    else:  # Linux and others
        return "prefork"


def get_concurrency(pool_type):
    """
    Get appropriate concurrency setting based on pool type.

    Args:
        pool_type: The worker pool type ('solo' or 'prefork')

    Returns:
        int: Concurrency level (1 for solo, configured max_workers for prefork)
    """
    if pool_type == "solo":
        return 1
    else:
        # Use configured max_workers from settings
        return settings.celery_max_workers


def load_all_queues_from_db():
    """
    Load all configured queue names from the database.

    Returns a comma-separated string of all queue names.
    Falls back to 'default' if database is unavailable or empty.
    """
    try:
        from settings_manager import settings_manager

        celery_settings = settings_manager.get_celery_settings()
        configured_queues = celery_settings.get("queues", [])

        if not configured_queues:
            print("Warning: No queues found in database, using default queue")
            return "default"

        queue_names = [q["name"] for q in configured_queues]
        return ",".join(queue_names)
    except Exception as e:
        print(f"Warning: Failed to load queues from database: {e}")
        print("Falling back to default queue")
        return "default"


def main():
    """Start the Celery worker."""
    # Install certificates if enabled (for Docker environments)
    install_certificates(backend_dir)

    # Detect platform and choose appropriate pool
    pool_type = get_worker_pool()
    concurrency = get_concurrency(pool_type)
    system_name = platform.system()

    # Determine which queues to process from environment variable
    worker_queues_env = os.environ.get("CELERY_WORKER_QUEUE", "").strip()

    if not worker_queues_env:
        # No environment variable set - load ALL queues from database
        worker_queues = load_all_queues_from_db()
        worker_type = "ALL QUEUES (from database)"
        hostname_prefix = "worker"
        print(f"Loading all queues from database: {worker_queues}")
    else:
        # Environment variable set - use specified queues (comma-separated)
        worker_queues = worker_queues_env
        queue_list = worker_queues.split(",")
        if len(queue_list) == 1:
            worker_type = f"QUEUE: {worker_queues}"
            hostname_prefix = f"{worker_queues}-worker"
        else:
            worker_type = f"QUEUES: {worker_queues}"
            hostname_prefix = "worker"

    print("=" * 70)
    print(f"Starting Cockpit-NG Celery Worker - {worker_type}")
    print("=" * 70)
    print(f"Platform: {system_name} ({platform.machine()})")
    print(f"Pool Type: {pool_type}")
    print(f"Concurrency: {concurrency}")
    print(f"Broker: {settings.celery_broker_url}")
    print(f"Backend: {settings.celery_result_backend}")
    print(f"Queues: {worker_queues}")
    print("Log Level: INFO")
    print("=" * 70)

    # Show platform-specific warnings
    if pool_type == "solo":
        print()
        print("⚠️  DEVELOPMENT MODE (macOS)")
        print("    Using 'solo' pool to avoid asyncio fork() incompatibility")
        print("    Single-process worker - suitable for development only")
        print("    Production deployments should use Linux with 'prefork' pool")
        print("=" * 70)

    print()

    # Start worker with configured queues
    argv = [
        "worker",
        "--loglevel=INFO",
        f"--pool={pool_type}",
        f"--queues={worker_queues}",
        f"--hostname={hostname_prefix}@%h",
        f"--concurrency={concurrency}",
        "--prefetch-multiplier=1",
        "--max-tasks-per-child=100",
    ]

    celery_app.worker_main(argv)


if __name__ == "__main__":
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
