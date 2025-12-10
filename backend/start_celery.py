#!/usr/bin/env python
"""
Start script for Celery worker.

This script starts the Celery worker process with proper configuration.
Equivalent to: celery -A celery_worker worker --loglevel=info

Environment Variables:
    INSTALL_CERTIFICATE_FILES: Set to 'true' to install certificates from
        config/certs/ to the system CA store on startup (for Docker environments).

Usage:
    python start_celery.py
"""

import glob
import os
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


def main():
    """Start the Celery worker."""
    # Install certificates if enabled (for Docker environments)
    install_certificates()

    print("=" * 70)
    print("Starting Cockpit-NG Celery Worker")
    print("=" * 70)
    print(f"Broker: {settings.celery_broker_url}")
    print(f"Backend: {settings.celery_result_backend}")
    print(f"Max Workers: {settings.celery_max_workers}")
    print("Log Level: INFO")
    print("=" * 70)
    print()

    # Start worker using argv
    argv = [
        "worker",
        "--loglevel=INFO",
        f"--concurrency={settings.celery_max_workers}",
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
