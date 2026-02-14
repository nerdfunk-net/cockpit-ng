"""
Base executor and job type dispatcher.
Routes job execution to appropriate executor based on job type.

Moved from job_tasks.py to improve code organization.
"""

import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


def execute_job_type(
    job_type: str,
    schedule_id: Optional[int],
    credential_id: Optional[int],
    job_parameters: Optional[dict],
    target_devices: Optional[list],
    task_context,
    template: Optional[dict] = None,
    job_run_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Execute the appropriate job based on job type.

    Routes the job execution to the correct executor function.

    Args:
        job_type: Type of job to execute
        schedule_id: ID of schedule if triggered by schedule
        credential_id: ID of credential for authentication
        job_parameters: Additional job parameters
        target_devices: List of target device UUIDs
        task_context: Celery task context (self)
        template: Job template configuration (for settings like activate_changes_after_sync)
        job_run_id: Job run ID for result tracking

    Returns:
        dict: Execution results
    """
    from .cache_executor import execute_cache_devices
    from .sync_executor import execute_sync_devices
    from .backup_executor import execute_backup
    from .command_executor import execute_run_commands
    from .compare_executor import execute_compare_devices
    from .scan_prefixes_executor import execute_scan_prefixes
    from .deploy_agent_executor import execute_deploy_agent

    # Map job_type to execution function
    job_executors = {
        "cache_devices": execute_cache_devices,
        "sync_devices": execute_sync_devices,
        "backup": execute_backup,
        "run_commands": execute_run_commands,
        "compare_devices": execute_compare_devices,
        "scan_prefixes": execute_scan_prefixes,
        "deploy_agent": execute_deploy_agent,
    }

    executor = job_executors.get(job_type)
    if not executor:
        return {"success": False, "error": f"Unknown job type: {job_type}"}

    return executor(
        schedule_id=schedule_id,
        credential_id=credential_id,
        job_parameters=job_parameters,
        target_devices=target_devices,
        task_context=task_context,
        template=template,
        job_run_id=job_run_id,
    )
