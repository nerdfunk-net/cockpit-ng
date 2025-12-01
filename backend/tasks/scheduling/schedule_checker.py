"""
Periodic task to check for due job schedules.
Runs every minute via Celery Beat.

Moved from job_tasks.py to improve code organization.
"""

from celery import shared_task
import logging
from datetime import datetime, timezone
from typing import Dict, Any

logger = logging.getLogger(__name__)


@shared_task(name="tasks.check_job_schedules")
def check_job_schedules_task() -> Dict[str, Any]:
    """
    Periodic Task: Check for due job schedules and dispatch them.

    Runs every minute via Celery Beat. Finds schedules that:
    1. Are active
    2. Have next_run <= now
    3. Haven't been run yet for this scheduled time

    Returns:
        dict: Summary of dispatched jobs
    """
    try:
        logger.debug("Checking for due job schedules...")

        import jobs_manager
        import job_template_manager
        from .job_dispatcher import dispatch_job

        now = datetime.now(timezone.utc)
        dispatched = []
        errors = []

        # Get all active schedules
        schedules = jobs_manager.list_job_schedules(is_active=True)

        for schedule in schedules:
            try:
                # Check if schedule is due
                next_run = schedule.get("next_run")
                if not next_run:
                    continue

                # Parse next_run if it's a string
                if isinstance(next_run, str):
                    next_run = datetime.fromisoformat(next_run.replace("Z", "+00:00"))

                # Check if due (allow 30 second grace period)
                if next_run > now:
                    continue

                # Get the template for this schedule
                template_id = schedule.get("job_template_id")
                if not template_id:
                    logger.warning(
                        f"Schedule {schedule['id']} has no template_id, skipping"
                    )
                    continue

                template = job_template_manager.get_job_template(template_id)
                if not template:
                    logger.warning(
                        f"Template {template_id} not found for schedule {schedule['id']}"
                    )
                    continue

                # Dispatch the job
                dispatch_job.delay(
                    schedule_id=schedule["id"],
                    template_id=template_id,
                    job_name=schedule.get(
                        "job_identifier", f"schedule-{schedule['id']}"
                    ),
                    job_type=template.get("job_type"),
                    credential_id=schedule.get("credential_id"),
                    job_parameters=schedule.get("job_parameters"),
                    triggered_by="schedule",
                )

                dispatched.append(
                    {
                        "schedule_id": schedule["id"],
                        "job_name": schedule.get("job_identifier"),
                        "job_type": template.get("job_type"),
                    }
                )

                # Update next_run for the schedule
                jobs_manager.calculate_and_update_next_run(schedule["id"])

            except Exception as e:
                error_msg = f"Error dispatching schedule {schedule.get('id')}: {str(e)}"
                logger.error(error_msg, exc_info=True)
                errors.append(error_msg)

        if dispatched:
            logger.info(
                f"Dispatched {len(dispatched)} jobs: {[d['job_name'] for d in dispatched]}"
            )

        return {
            "success": True,
            "checked_at": now.isoformat(),
            "dispatched_count": len(dispatched),
            "dispatched": dispatched,
            "errors": errors,
        }

    except Exception as e:
        logger.error(f"check_job_schedules task failed: {e}", exc_info=True)
        return {"success": False, "error": str(e)}
