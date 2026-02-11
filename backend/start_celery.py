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
import shutil
import subprocess
import sys
from pathlib import Path

# Ensure we're in the backend directory
backend_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(backend_dir)

# Add backend directory to Python path
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Import Celery app (after path setup)
from celery_app import celery_app  # noqa: E402
from config import settings  # noqa: E402

# Import worker lifecycle signals (MUST be imported before starting worker)
# This ensures each worker process gets its own isolated database engine
import core.celery_signals  # noqa: E402, F401 - Import for side effects (signal registration)

# Import all tasks to register them
try:
    from tasks import *  # noqa: E402, F403 - intentional for task registration
except ImportError as e:
    print(f"Warning: Could not import tasks: {e}")


def install_certificates():
    """
    Install certificates from config/certs/ to the system CA store.

    This copies all .crt files from config/certs/ to /usr/local/share/ca-certificates/
    and runs update-ca-certificates to update the system trust store.

    Only runs when INSTALL_CERTIFICATE_FILES environment variable is set to 'true'.
    """
    install_certs = os.environ.get("INSTALL_CERTIFICATE_FILES", "false").lower()
    if install_certs != "true":
        return

    print("Installing certificates from config/certs/...")

    config_certs_dir = Path(backend_dir) / ".." / "config" / "certs"
    system_ca_dir = Path("/usr/local/share/ca-certificates")

    if not config_certs_dir.exists():
        print(f"  Certificate directory not found: {config_certs_dir}")
        return

    # Find all .crt files
    cert_files = list(config_certs_dir.glob("*.crt"))
    if not cert_files:
        print("  No .crt files found in config/certs/")
        return

    # Ensure system CA directory exists
    try:
        system_ca_dir.mkdir(parents=True, exist_ok=True)
    except PermissionError:
        print(f"  ERROR: Permission denied creating {system_ca_dir}")
        return

    # Copy certificates
    copied_count = 0
    for cert_file in cert_files:
        try:
            dest_path = system_ca_dir / cert_file.name
            shutil.copy2(cert_file, dest_path)
            print(f"  Copied: {cert_file.name}")
            copied_count += 1
        except PermissionError:
            print(f"  ERROR: Permission denied copying {cert_file.name}")
        except Exception as e:
            print(f"  ERROR: Failed to copy {cert_file.name}: {e}")

    if copied_count == 0:
        print("  No certificates were copied")
        return

    # Run update-ca-certificates
    print("  Running update-ca-certificates...")
    try:
        result = subprocess.run(
            ["update-ca-certificates"],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if result.returncode == 0:
            print(f"  Successfully installed {copied_count} certificate(s)")
            if result.stdout:
                # Print just the summary line
                for line in result.stdout.strip().split("\n"):
                    if line.strip():
                        print(f"    {line}")
        else:
            print(f"  WARNING: update-ca-certificates returned {result.returncode}")
            if result.stderr:
                print(f"    {result.stderr}")
    except FileNotFoundError:
        print("  WARNING: update-ca-certificates not found (not running in Docker?)")
    except subprocess.TimeoutExpired:
        print("  WARNING: update-ca-certificates timed out")
    except Exception as e:
        print(f"  WARNING: Failed to run update-ca-certificates: {e}")


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
    install_certificates()

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
