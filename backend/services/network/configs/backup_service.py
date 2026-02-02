"""
Backup service for managing device configuration backups.
"""

import logging
from typing import List
from sqlalchemy.orm import Session

from repositories.backup_repository import BackupRepository

logger = logging.getLogger(__name__)


class BackupService:
    """Service for managing device configuration backups."""

    def __init__(self):
        self.repository = BackupRepository()

    async def get_devices_for_backup(
        self, db: Session, filters: dict, pagination: dict, sorting: dict
    ) -> dict:
        """
        Get devices with backup status and filtering.

        Args:
            db: Database session
            filters: Filter parameters (name, role, location, etc.)
            pagination: Pagination parameters (limit, offset)
            sorting: Sorting parameters (column, order)

        Returns:
            Dict with devices, total count, and pagination info
        """
        try:
            devices, total = await self.repository.get_devices_for_backup(
                db,
                name=filters.get("name"),
                role=filters.get("role"),
                location=filters.get("location"),
                device_type=filters.get("device_type"),
                status=filters.get("status"),
                last_backup_before=filters.get("last_backup_date"),
                last_backup_comparison=filters.get("date_comparison"),
                sort_by=sorting.get("column"),
                sort_order=sorting.get("order", "asc"),
                limit=pagination.get("limit", 50),
                offset=pagination.get("offset", 0),
            )

            return {
                "devices": devices,
                "total": total,
                "limit": pagination.get("limit", 50),
                "offset": pagination.get("offset", 0),
            }

        except Exception as e:
            logger.error(f"Error getting devices for backup: {e}", exc_info=True)
            raise

    async def trigger_device_backup(
        self, db: Session, device_id: str, user_id: int
    ) -> dict:
        """
        Trigger backup job for a single device.

        Uses existing job template system to create and execute a backup job.

        Args:
            db: Database session
            device_id: Device ID to backup
            user_id: User triggering the backup

        Returns:
            Dict with task_id and status
        """
        try:
            # Import here to avoid circular dependency
            from tasks.job_tasks import get_task_for_job
            import job_run_manager

            # Get or create default backup job template
            # For now, use a simple backup task
            task_func = get_task_for_job("backup")

            if not task_func:
                raise ValueError("Backup task not found")

            # Trigger the Celery task
            task = task_func.apply_async(
                kwargs={"device_ids": [device_id]}, queue="default"
            )

            # Record the job run
            job_run_manager.create_job_run(
                task_id=task.id,
                job_type="backup",
                triggered_by="manual",
                user_id=user_id,
            )

            return {"task_id": task.id, "status": "queued", "device_id": device_id}

        except Exception as e:
            logger.error(f"Error triggering device backup: {e}", exc_info=True)
            raise

    async def trigger_bulk_backup(
        self, db: Session, device_ids: List[str], user_id: int
    ) -> dict:
        """
        Trigger backup job for multiple devices.

        Args:
            db: Database session
            device_ids: List of device IDs to backup
            user_id: User triggering the backup

        Returns:
            Dict with task_id, status, and device count
        """
        try:
            from tasks.job_tasks import get_task_for_job
            import job_run_manager

            task_func = get_task_for_job("backup")

            if not task_func:
                raise ValueError("Backup task not found")

            # Trigger the Celery task
            task = task_func.apply_async(
                kwargs={"device_ids": device_ids}, queue="default"
            )

            # Record the job run
            job_run_manager.create_job_run(
                task_id=task.id,
                job_type="backup",
                triggered_by="manual",
                user_id=user_id,
            )

            return {
                "task_id": task.id,
                "status": "queued",
                "device_count": len(device_ids),
            }

        except Exception as e:
            logger.error(f"Error triggering bulk backup: {e}", exc_info=True)
            raise

    async def get_backup_history(
        self, db: Session, device_id: str, limit: int = 50
    ) -> List[dict]:
        """
        Get backup history from Git repository.

        Args:
            db: Database session
            device_id: Device ID to get history for
            limit: Maximum number of history entries

        Returns:
            List of backup history entries
        """
        try:
            return self.repository.get_backup_history(db, device_id, limit)
        except Exception as e:
            logger.error(f"Error getting backup history: {e}", exc_info=True)
            return []

    async def download_backup(
        self, db: Session, device_id: str, backup_id: str
    ) -> bytes:
        """
        Download a specific backup file from Git repository.

        Args:
            db: Database session
            device_id: Device ID
            backup_id: Backup commit hash

        Returns:
            Backup file content as bytes
        """
        try:
            from services.settings.git.shared_utils import (
                get_git_repositories_by_category,
            )
            import git

            repos = get_git_repositories_by_category("device_configs")
            if not repos:
                raise ValueError("No device config repository found")

            repo = repos[0]
            git_repo = git.Repo(repo.working_dir)

            # Get the commit
            commit = git_repo.commit(backup_id)

            # Find file for this device in the commit
            for item in commit.tree.traverse():
                if device_id in item.path and item.type == "blob":
                    return item.data_stream.read()

            raise ValueError(f"Backup not found for device {device_id}")

        except Exception as e:
            logger.error(f"Error downloading backup: {e}", exc_info=True)
            raise

    async def restore_backup(
        self, db: Session, device_id: str, backup_id: str, user_id: int
    ) -> dict:
        """
        Trigger restore job for a backup.

        Args:
            db: Database session
            device_id: Device ID
            backup_id: Backup commit hash to restore
            user_id: User triggering the restore

        Returns:
            Dict with task_id and status
        """
        try:
            # This would trigger a job to restore the configuration
            # For now, return a placeholder
            return {
                "task_id": "placeholder",
                "status": "not_implemented",
                "message": "Restore functionality not yet implemented",
            }

        except Exception as e:
            logger.error(f"Error triggering restore: {e}", exc_info=True)
            raise
