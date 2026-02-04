"""
Scan Prefixes job executor.
Scans network prefixes filtered by custom field value.

Executor for scheduled and manual scan_prefixes jobs.
"""

import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


def execute_scan_prefixes(
    schedule_id: Optional[int],
    credential_id: Optional[int],
    job_parameters: Optional[dict],
    target_devices: Optional[list],
    task_context,
    template: Optional[dict] = None,
    job_run_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Execute scan prefixes job.

    Scans network prefixes from Nautobot filtered by custom field value.

    Args:
        schedule_id: Job schedule ID (if scheduled)
        credential_id: Not used for scan_prefixes
        job_parameters: Additional job parameters
        target_devices: Not used for scan_prefixes
        task_context: Celery task context for progress updates
        template: Job template with scan options

    Returns:
        dict: Scan results with reachable/unreachable hosts
    """
    try:
        logger.info("=" * 80)
        logger.info("SCAN PREFIXES EXECUTOR STARTED")
        logger.info("=" * 80)
        logger.info(f"Schedule ID: {schedule_id}")
        logger.info(f"Template: {template.get('name') if template else 'None'}")

        task_context.update_state(
            state="PROGRESS",
            meta={"current": 0, "total": 100, "status": "Initializing scan..."},
        )

        # Import the internal execution function
        from tasks.scan_prefixes_task import _execute_scan_prefixes

        # Get scan options from template
        if not template:
            return {
                "success": False,
                "error": "No template provided for scan_prefixes job",
            }

        custom_field_name = template.get("scan_custom_field_name")
        custom_field_value = template.get("scan_custom_field_value")
        response_custom_field_name = template.get("scan_response_custom_field_name")
        set_reachable_ip_active = template.get("scan_set_reachable_ip_active", True)

        if not custom_field_name or not custom_field_value:
            return {
                "success": False,
                "error": "Missing custom field name or value in template",
            }

        # Get scan options with defaults
        resolve_dns = template.get("scan_resolve_dns", False)
        ping_count = template.get("scan_ping_count") or 3
        timeout_ms = template.get("scan_timeout_ms") or 500
        retries = template.get("scan_retries") or 3
        interval_ms = template.get("scan_interval_ms") or 10
        scan_max_ips = template.get("scan_max_ips")

        logger.info(f"Scanning prefixes with {custom_field_name}={custom_field_value}")
        logger.info(
            f"Scan options: resolve_dns={resolve_dns}, ping_count={ping_count}, "
            f"timeout={timeout_ms}ms, retries={retries}, interval={interval_ms}ms, max_ips={scan_max_ips}"
        )

        # Execute the scan logic directly (the job_run is already created by dispatcher)
        # Pass task_context=None to prevent creating a duplicate job_run
        # The dispatcher already created the job_run and will handle completion/failure
        # Note: Progress updates will use the task_context at the executor level
        result = _execute_scan_prefixes(
            custom_field_name=custom_field_name,
            custom_field_value=custom_field_value,
            response_custom_field_name=response_custom_field_name,
            set_reachable_ip_active=set_reachable_ip_active,
            resolve_dns=resolve_dns,
            ping_count=ping_count,
            timeout_ms=timeout_ms,
            retries=retries,
            interval_ms=interval_ms,
            executed_by="scheduled" if schedule_id else "manual",
            task_context=None,  # Don't pass context - prevents duplicate job_run creation
            scan_max_ips=scan_max_ips,
            job_run_id=None,
        )

        logger.info("=" * 80)
        logger.info("SCAN PREFIXES EXECUTOR COMPLETED")
        logger.info("=" * 80)

        return result

    except Exception as e:
        logger.error(f"Scan prefixes executor failed: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e),
        }
