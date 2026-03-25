#!/usr/bin/env python3
"""
Debug job CLI script.

Creates a debug job run that simply waits `duration` seconds before completing.
Use this to verify that the Job History page auto-refreshes for running jobs
and that the Refresh button works correctly.

Usage:
    python scripts/debug_job.py              # 60-second job
    python scripts/debug_job.py --duration 30
    python scripts/debug_job.py --duration 120

Requirements:
    Run from the /backend directory with the virtual environment active:
        cd backend
        python scripts/debug_job.py
"""

import argparse
import sys
import os

# Allow imports from the backend root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def main():
    parser = argparse.ArgumentParser(
        description="Submit a debug wait job to the Cockpit-NG job queue.",
    )
    parser.add_argument(
        "--duration",
        type=int,
        default=60,
        metavar="SECONDS",
        help="How long the job should wait before completing (default: 60)",
    )
    args = parser.parse_args()

    duration = args.duration
    if duration < 1:
        print("ERROR: --duration must be at least 1 second", file=sys.stderr)
        sys.exit(1)

    print(f"Submitting debug wait job ({duration}s)…")

    # Import after path setup
    try:
        import job_run_manager
        from tasks.test_tasks import debug_wait_task
    except ImportError as exc:
        print(
            f"ERROR: Could not import backend modules: {exc}\n"
            "Make sure you are running from the backend/ directory with the venv active.",
            file=sys.stderr,
        )
        sys.exit(1)

    # Create the job_run record first (status: pending)
    job_run = job_run_manager.create_job_run(
        job_name=f"Debug Wait ({duration}s)",
        job_type="cache_devices",      # use an existing job_type so it appears with a known label
        triggered_by="manual",
    )
    job_run_id = job_run["id"]

    print(f"  job_run record created  → id={job_run_id}")

    # Dispatch the Celery task
    result = debug_wait_task.delay(duration=duration, job_run_id=job_run_id)

    print(f"  Celery task dispatched   → task_id={result.id}")
    print()
    print("Job is now RUNNING. Open the Job History page and verify that:")
    print("  1. The job appears with status 'running' (should update automatically every 3s)")
    print("  2. The Refresh button forces an immediate update")
    print(f"  3. After ~{duration}s the status changes to 'completed'")
    print()
    print(f"Job run ID : {job_run_id}")
    print(f"Celery ID  : {result.id}")


if __name__ == "__main__":
    main()
