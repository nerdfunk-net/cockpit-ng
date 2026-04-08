"""
Celery task for exporting Nautobot devices to CSV and writing the result
to a configured Git repository.

Workflow:
1. Fetch device data from Nautobot (reuses helpers from export_devices_task)
2. Generate CSV content
3. Sync (pull) the target Git repository
4. Write the CSV file to the repository
5. Commit and push the change
6. Update the JobRun record
"""

import logging
import os
from datetime import datetime, timezone
from typing import List, Optional

from celery_app import celery_app

logger = logging.getLogger(__name__)


def _run_csv_export(
    task_context,
    device_ids: List[str],
    properties: List[str],
    repo_id: int,
    file_path: str,
    delimiter: str = ",",
    quote_char: str = '"',
    include_headers: bool = True,
    job_run_id: Optional[int] = None,
) -> dict:
    """
    Core CSV export implementation.

    Called both by csv_export_task (as Celery task) and by the job dispatcher
    executor (execute_csv_export) running inside dispatch_job.

    Args:
        task_context: Celery task instance (provides update_state)
        device_ids: List of Nautobot device IDs to export
        properties: List of device properties to include
        repo_id: Git repository ID (category=csv_exports) to write the file to
        file_path: Relative path within the repository (e.g. exports/devices.csv)
        delimiter: CSV field delimiter (default: ",")
        quote_char: CSV quote character (default: '"')
        include_headers: Whether to include a header row (default: True)
        job_run_id: Optional job run ID for status tracking

    Returns:
        dict: Export results
    """
    self = task_context
    try:
        logger.info("=" * 80)
        logger.info("CSV EXPORT TASK STARTED")
        logger.info("=" * 80)
        logger.info("Devices: %s", len(device_ids))
        logger.info("Properties: %s", properties)
        logger.info("Target repo: %s, file: %s", repo_id, file_path)

        self.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": 100, "status": "Initializing CSV export..."},
        )

        if not device_ids:
            return {"success": False, "error": "No devices specified for export"}
        if not properties:
            return {"success": False, "error": "No properties specified for export"}

        # ------------------------------------------------------------------ #
        # STEP 1: Fetch device data from Nautobot
        # ------------------------------------------------------------------ #
        logger.info("-" * 80)
        logger.info("STEP 1: FETCHING %s DEVICES FROM NAUTOBOT", len(device_ids))
        logger.info("-" * 80)

        self.update_state(
            state="PROGRESS",
            meta={
                "current": 10,
                "total": 100,
                "status": f"Fetching {len(device_ids)} devices from Nautobot...",
            },
        )

        # Reuse helpers from export_devices_task (module-level functions)
        from tasks.export_devices_task import (
            _build_graphql_query,
            _filter_device_properties,
            _export_to_csv,
        )
        import asyncio
        import service_factory

        query = _build_graphql_query(properties)
        nautobot_client = service_factory.build_nautobot_service()

        all_devices = []
        batch_size = 100
        total_batches = (len(device_ids) + batch_size - 1) // batch_size

        for batch_idx in range(total_batches):
            start_idx = batch_idx * batch_size
            end_idx = min(start_idx + batch_size, len(device_ids))
            batch_ids = device_ids[start_idx:end_idx]

            self.update_state(
                state="PROGRESS",
                meta={
                    "current": 10 + int((batch_idx / total_batches) * 30),
                    "total": 100,
                    "status": f"Fetching devices batch {batch_idx + 1}/{total_batches}...",
                },
            )

            variables = {"id_filter": batch_ids}
            result = asyncio.run(nautobot_client.graphql_query(query, variables))

            if not result or "data" not in result:
                logger.error("Failed to fetch batch %s", batch_idx + 1)
                continue

            devices = result.get("data", {}).get("devices", [])
            all_devices.extend(devices)
            logger.info("Fetched %s devices from batch %s", len(devices), batch_idx + 1)

        if not all_devices:
            return {
                "success": False,
                "error": "No devices found in Nautobot",
                "requested_count": len(device_ids),
            }

        logger.info("Total devices fetched: %s", len(all_devices))

        # ------------------------------------------------------------------ #
        # STEP 2: Filter and generate CSV
        # ------------------------------------------------------------------ #
        self.update_state(
            state="PROGRESS",
            meta={"current": 45, "total": 100, "status": "Generating CSV content..."},
        )

        if "primary_ip4" in properties:
            all_devices = [
                d
                for d in all_devices
                if d.get("primary_ip4") and d["primary_ip4"].get("address")
            ]

        filtered_devices = _filter_device_properties(all_devices, properties)

        csv_options = {
            "delimiter": delimiter,
            "quoteChar": quote_char,
            "includeHeaders": include_headers,
        }
        csv_content = _export_to_csv(filtered_devices, csv_options)
        logger.info(
            "Generated CSV (%s bytes) for %s devices",
            len(csv_content),
            len(filtered_devices),
        )

        # ------------------------------------------------------------------ #
        # STEP 3: Sync the Git repository (pull latest)
        # ------------------------------------------------------------------ #
        logger.info("-" * 80)
        logger.info("STEP 3: SYNCING GIT REPOSITORY %s", repo_id)
        logger.info("-" * 80)

        self.update_state(
            state="PROGRESS",
            meta={"current": 60, "total": 100, "status": "Syncing Git repository..."},
        )

        from services.settings.git.shared_utils import git_repo_manager
        from services.settings.git.paths import repo_path as get_repo_path

        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            return {"success": False, "error": f"Git repository {repo_id} not found"}

        git_service = service_factory.build_git_service()

        try:
            pull_result = git_service.pull(repository)
            logger.info("Git pull result: %s", pull_result.message)
        except Exception as pull_err:
            logger.warning("Git pull failed (will try to continue): %s", pull_err)

        # ------------------------------------------------------------------ #
        # STEP 4: Write CSV file to repository
        # ------------------------------------------------------------------ #
        self.update_state(
            state="PROGRESS",
            meta={
                "current": 75,
                "total": 100,
                "status": "Writing CSV file to repository...",
            },
        )

        repo_dir = get_repo_path(repository)
        full_file_path = os.path.join(str(repo_dir), file_path.lstrip("/"))

        # Ensure parent directory exists
        os.makedirs(os.path.dirname(full_file_path), exist_ok=True)

        with open(full_file_path, "w", encoding="utf-8") as f:
            f.write(csv_content)

        logger.info("Written CSV to %s", full_file_path)

        # ------------------------------------------------------------------ #
        # STEP 5: Commit and push
        # ------------------------------------------------------------------ #
        self.update_state(
            state="PROGRESS",
            meta={
                "current": 85,
                "total": 100,
                "status": "Committing and pushing to Git...",
            },
        )

        from git import Repo as GitRepo

        git_repo = GitRepo(str(repo_dir))
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        commit_message = f"CSV Export {timestamp}"

        commit_result = git_service.commit_and_push(
            repository=dict(repository),
            message=commit_message,
            repo=git_repo,
            add_all=True,
            branch=repository.get("branch") or "main",
        )

        logger.info("Git commit result: %s", commit_result.message)

        # ------------------------------------------------------------------ #
        # STEP 6: Finalize
        # ------------------------------------------------------------------ #
        self.update_state(
            state="PROGRESS",
            meta={"current": 100, "total": 100, "status": "CSV export completed"},
        )

        result = {
            "success": True,
            "message": f"Exported {len(filtered_devices)} devices to {file_path}",
            "exported_devices": len(filtered_devices),
            "requested_devices": len(device_ids),
            "properties_count": len(properties),
            "file_path": file_path,
            "file_size_bytes": len(csv_content),
            "commit_sha": commit_result.commit_sha[:8]
            if commit_result.commit_sha
            else None,
            "pushed": getattr(commit_result, "pushed", False),
        }

        if job_run_id:
            try:
                import job_run_manager

                job_run_manager.mark_completed(job_run_id, result=result)
                logger.info("Updated job run %s to completed", job_run_id)
            except Exception as job_err:
                logger.warning("Failed to update job run: %s", job_err)

        logger.info("=" * 80)
        logger.info("CSV EXPORT TASK COMPLETED")
        logger.info("=" * 80)

        return result

    except Exception as e:
        logger.error("CSV EXPORT TASK FAILED: %s", e, exc_info=True)

        error_result = {"success": False, "error": str(e)}

        if job_run_id:
            try:
                import job_run_manager

                job_run_manager.mark_failed(job_run_id, str(e))
            except Exception as job_err:
                logger.warning("Failed to update job run to failed: %s", job_err)

        return error_result


@celery_app.task(name="tasks.csv_export", bind=True)
def csv_export_task(
    self,
    device_ids: List[str],
    properties: List[str],
    repo_id: int,
    file_path: str,
    delimiter: str = ",",
    quote_char: str = '"',
    include_headers: bool = True,
    job_run_id: Optional[int] = None,
) -> dict:
    """Celery task wrapper for _run_csv_export."""
    return _run_csv_export(
        self,
        device_ids=device_ids,
        properties=properties,
        repo_id=repo_id,
        file_path=file_path,
        delimiter=delimiter,
        quote_char=quote_char,
        include_headers=include_headers,
        job_run_id=job_run_id,
    )
