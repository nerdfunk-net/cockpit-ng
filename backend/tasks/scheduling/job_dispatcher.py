"""
Main job dispatcher task.
Orchestrates job execution based on job type.

Moved from job_tasks.py to improve code organization.
"""

from celery import shared_task
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="tasks.dispatch_job")
def dispatch_job(
    self,
    schedule_id: Optional[int] = None,
    template_id: Optional[int] = None,
    job_name: str = "unnamed_job",
    job_type: str = None,
    credential_id: Optional[int] = None,
    job_parameters: Optional[Dict[str, Any]] = None,
    triggered_by: str = "schedule",
    executed_by: Optional[str] = None,
    target_devices: Optional[list] = None,
) -> Dict[str, Any]:
    """
    Task: Dispatch and execute a job based on its type.

    This task:
    1. Creates a JobRun record to track execution
    2. Maps job_type to the appropriate Celery task
    3. Executes the task and tracks results
    4. Updates JobRun status on completion/failure

    Args:
        schedule_id: ID of the schedule that triggered this job
        template_id: ID of the job template
        job_name: Human-readable job name
        job_type: Type of job (maps to specific task)
        credential_id: Optional credential ID for authentication
        job_parameters: Additional parameters for the job
        triggered_by: 'schedule' or 'manual'
        executed_by: Username for manual runs
        target_devices: List of target device names

    Returns:
        dict: Job execution results
    """
    import job_run_manager
    import job_template_manager
    from tasks.utils.device_helpers import get_target_devices
    from tasks.execution.base_executor import execute_job_type

    job_run = None
    template = None

    try:
        logger.info(
            f"Dispatching job: {job_name} (type: {job_type}, triggered_by: {triggered_by})"
        )

        # Get template details if needed
        if template_id:
            template = job_template_manager.get_job_template(template_id)
            logger.info(
                f"[DISPATCH] Template ID {template_id} loaded: {template is not None}"
            )
            if template:
                logger.info(f"[DISPATCH] Template name: {template.get('name')}")
                logger.info(
                    f"[DISPATCH] Template activate_changes_after_sync: {template.get('activate_changes_after_sync')}"
                )
                if not target_devices:
                    # Get target devices based on inventory_source
                    target_devices = get_target_devices(template, job_parameters)
        else:
            logger.info("[DISPATCH] No template_id provided")

        # Create job run record
        job_run = job_run_manager.create_job_run(
            job_name=job_name,
            job_type=job_type or "unknown",
            triggered_by=triggered_by,
            job_schedule_id=schedule_id,
            job_template_id=template_id,
            target_devices=target_devices,
            executed_by=executed_by,
        )
        job_run_id = job_run["id"]

        # Mark as started
        job_run_manager.mark_started(job_run_id, self.request.id)

        # Execute the appropriate task based on job_type
        result = execute_job_type(
            job_type=job_type,
            schedule_id=schedule_id,
            credential_id=credential_id,
            job_parameters=job_parameters,
            target_devices=target_devices,
            task_context=self,
            template=template,
            job_run_id=job_run_id,
        )

        # Mark as completed or failed based on result
        # For parallel jobs (status='running'), let the callback handle completion
        result_status = result.get("status")
        if result_status == "running":
            logger.info(
                f"Job {job_name} is running asynchronously - callback will handle completion"
            )
        elif result.get("success") or result_status == "completed":
            job_run_manager.mark_completed(job_run_id, result=result)
            logger.info(f"Job {job_name} completed successfully")
        else:
            error_msg = result.get("error", result.get("message", "Unknown error"))
            job_run_manager.mark_failed(job_run_id, error_msg)
            logger.warning(f"Job {job_name} failed: {error_msg}")

        return result

    except Exception as e:
        error_msg = str(e)
        logger.error(f"Job dispatch failed for {job_name}: {error_msg}", exc_info=True)

        # Update job run if we created one
        if job_run:
            job_run_manager.mark_failed(job_run["id"], error_msg)

        return {
            "success": False,
            "error": error_msg,
            "job_name": job_name,
            "job_type": job_type,
        }
