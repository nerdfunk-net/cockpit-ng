"""
Executor for the 'CSV Export' (csv_export) job type.
Reads CSV export settings from the job template and delegates to
_run_csv_export (runs synchronously inside the same worker process).
"""

import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


def execute_csv_export(
    schedule_id: Optional[int],
    credential_id: Optional[int],
    job_parameters: Optional[dict],
    target_devices: Optional[list],
    task_context,
    template: Optional[dict] = None,
    job_run_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Execute csv_export job.

    Reads all CSV export settings from the job template and calls
    _run_csv_export to fetch devices, generate CSV, and push to Git.
    """
    from tasks.csv_export_task import _run_csv_export

    if not template:
        return {
            "success": False,
            "error": "No job template provided for csv_export job",
        }

    repo_id = template.get("csv_export_repo_id")
    file_path = template.get("csv_export_file_path") or ""
    properties = template.get("csv_export_properties") or []
    delimiter = template.get("csv_export_delimiter") or ","
    quote_char = template.get("csv_export_quote_char") or '"'
    include_headers = template.get("csv_export_include_headers", True)

    if not repo_id:
        return {
            "success": False,
            "error": "csv_export_repo_id is not configured in the job template",
        }
    if not file_path:
        return {
            "success": False,
            "error": "csv_export_file_path is not configured in the job template",
        }
    if not properties:
        return {
            "success": False,
            "error": "csv_export_properties is not configured in the job template",
        }

    # Resolve device IDs from target_devices, or fetch all from Nautobot
    device_ids = []
    if target_devices:
        for device in target_devices:
            if isinstance(device, dict):
                dev_id = device.get("id") or device.get("device_id")
            else:
                dev_id = str(device)
            if dev_id:
                device_ids.append(dev_id)
    else:
        logger.info("No target devices specified — fetching all devices from Nautobot")
        import asyncio
        import service_factory

        device_query_service = service_factory.build_device_query_service()
        devices_result = asyncio.run(device_query_service.get_devices())
        if devices_result and devices_result.get("devices"):
            device_ids = [d.get("id") for d in devices_result["devices"] if d.get("id")]
            logger.info("Fetched %s devices from Nautobot", len(device_ids))
        else:
            logger.warning("No devices found in Nautobot")

    if not device_ids:
        return {
            "success": False,
            "error": "No target devices resolved for csv_export job",
        }

    logger.info(
        "Executing csv_export job: repo_id=%s, file_path=%s, properties=%s, "
        "delimiter=%r, quote_char=%r, include_headers=%s, device_count=%s",
        repo_id,
        file_path,
        properties,
        delimiter,
        quote_char,
        include_headers,
        len(device_ids),
    )

    return _run_csv_export(
        task_context,
        device_ids=device_ids,
        properties=properties,
        repo_id=repo_id,
        file_path=file_path,
        delimiter=delimiter,
        quote_char=quote_char,
        include_headers=include_headers,
        job_run_id=job_run_id,
    )
