"""
DEPRECATED Legacy task.
Use new job system (dispatch_job) instead.
Will be removed in future version.
"""

from celery import shared_task
import logging
from typing import Optional

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="tasks.backup_configs")
def backup_configs_task(
    self,
    job_schedule_id: Optional[int] = None,
    credential_id: Optional[int] = None,
    devices: Optional[list] = None,
) -> dict:
    """
    Task: Backup device configurations.

    This task connects to network devices and backs up their configurations.
    Can use private credentials when provided.

    Args:
        job_schedule_id: Optional ID of the job schedule that triggered this task
        credential_id: Optional credential ID to use for authentication
        devices: Optional list of specific devices to backup

    Returns:
        dict: Task execution results
    """
    try:
        logger.info(
            f"Starting backup_configs task (job_schedule_id: {job_schedule_id}, credential_id: {credential_id})"
        )

        self.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": 100, "status": "Initializing backup..."},
        )

        # This is a placeholder for the actual backup implementation
        # You would integrate with your existing backup functionality here

        self.update_state(
            state="PROGRESS",
            meta={
                "current": 50,
                "total": 100,
                "status": "Backing up configurations...",
            },
        )

        # Simulate backup process
        import time

        time.sleep(2)

        self.update_state(
            state="PROGRESS", meta={"current": 100, "total": 100, "status": "Complete"}
        )

        device_count = len(devices) if devices else 0

        logger.info(f"Backup task completed for {device_count} devices")

        return {
            "success": True,
            "devices_backed_up": device_count,
            "message": f"Backed up {device_count} device configurations",
            "job_schedule_id": job_schedule_id,
        }

    except Exception as e:
        logger.error(f"backup_configs task failed: {e}", exc_info=True)
        return {"success": False, "error": str(e), "job_schedule_id": job_schedule_id}


@shared_task(bind=True, name="tasks.ansible_playbook")
def ansible_playbook_task(
    self,
    job_schedule_id: Optional[int] = None,
    credential_id: Optional[int] = None,
    playbook: Optional[str] = None,
    **kwargs,
) -> dict:
    """
    Task: Run Ansible playbook.

    This task executes an Ansible playbook on target devices.
    Can use private credentials when provided.

    Args:
        job_schedule_id: Optional ID of the job schedule that triggered this task
        credential_id: Optional credential ID to use for authentication
        playbook: Playbook to execute
        **kwargs: Additional playbook parameters

    Returns:
        dict: Task execution results
    """
    try:
        logger.info(
            f"Starting ansible_playbook task (job_schedule_id: {job_schedule_id}, playbook: {playbook})"
        )

        self.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": 100, "status": "Initializing Ansible..."},
        )

        # This is a placeholder for the actual Ansible implementation
        # You would integrate with your existing Ansible functionality here

        self.update_state(
            state="PROGRESS",
            meta={"current": 50, "total": 100, "status": "Running playbook..."},
        )

        # Simulate playbook execution
        import time

        time.sleep(3)

        self.update_state(
            state="PROGRESS", meta={"current": 100, "total": 100, "status": "Complete"}
        )

        logger.info(f"Ansible playbook task completed: {playbook}")

        return {
            "success": True,
            "playbook": playbook,
            "message": f"Ansible playbook {playbook} executed successfully",
            "job_schedule_id": job_schedule_id,
        }

    except Exception as e:
        logger.error(f"ansible_playbook task failed: {e}", exc_info=True)
        return {"success": False, "error": str(e), "job_schedule_id": job_schedule_id}
