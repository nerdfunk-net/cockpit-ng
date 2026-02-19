"""
Executor for the 'Maintain IP-Addresses' (ip_addresses) job type.
Lists or removes Nautobot IP addresses filtered by a configured field.
"""

import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


def execute_ip_addresses(
    schedule_id: Optional[int],
    credential_id: Optional[int],
    job_parameters: Optional[dict],
    target_devices: Optional[list],
    task_context,
    template: Optional[dict] = None,
    job_run_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Execute ip_addresses job (Maintain IP-Addresses).

    Reads all settings from the job template and calls IPAddressQueryService
    to list or remove matching Nautobot IP addresses.
    """
    from services.nautobot.ip_addresses import IPAddressQueryService

    action = "list"
    filter_field = ""
    filter_type = None
    filter_value = ""
    include_null = False

    if template:
        action = template.get("ip_action") or "list"
        filter_field = template.get("ip_filter_field") or ""
        filter_type = template.get("ip_filter_type") or None
        filter_value = template.get("ip_filter_value") or ""
        include_null = template.get("ip_include_null", False)

    if not filter_field or not filter_value:
        return {
            "success": False,
            "error": "ip_filter_field and ip_filter_value must be configured in the job template",
        }

    filter_key = f"{filter_field}__{filter_type}" if filter_type else filter_field
    logger.info(
        "Executing ip_addresses job: action=%s, filter=%s=%s, include_null=%s",
        action, filter_key, filter_value, include_null,
    )

    try:
        service = IPAddressQueryService()

        if action == "list":
            task_context.update_state(
                state="PROGRESS",
                meta={
                    "status": f"Fetching IPs where {filter_key}={filter_value}...",
                    "current": 0,
                    "total": 1,
                },
            )
            ip_addresses = service.list_ip_addresses(
                filter_field=filter_field,
                filter_value=filter_value,
                filter_type=filter_type,
                include_null=include_null,
            )
            return {
                "success": True,
                "action": action,
                "filter_field": filter_field,
                "filter_type": filter_type,
                "filter_value": filter_value,
                "include_null": include_null,
                "ip_addresses": ip_addresses,
                "total": len(ip_addresses),
            }

        elif action == "remove":
            task_context.update_state(
                state="PROGRESS",
                meta={
                    "status": f"Fetching IPs where {filter_key}={filter_value}...",
                    "current": 0,
                    "total": 1,
                },
            )
            ip_addresses = service.list_ip_addresses(
                filter_field=filter_field,
                filter_value=filter_value,
                filter_type=filter_type,
                include_null=include_null,
            )
            total = len(ip_addresses)
            deleted = 0
            failed = 0

            for idx, ip in enumerate(ip_addresses):
                task_context.update_state(
                    state="PROGRESS",
                    meta={
                        "status": f"Deleting IP {idx + 1}/{total}...",
                        "current": idx + 1,
                        "total": total,
                    },
                )
                ip_id = ip.get("id")
                if not ip_id:
                    failed += 1
                    continue
                if service.delete_ip_address(ip_id):
                    deleted += 1
                else:
                    failed += 1

            return {
                "success": True,
                "action": action,
                "filter_field": filter_field,
                "filter_type": filter_type,
                "filter_value": filter_value,
                "include_null": include_null,
                "total": total,
                "deleted": deleted,
                "failed": failed,
            }

        else:
            # "mark" and any future actions
            return {
                "success": False,
                "action": action,
                "error": f"Action '{action}' is not yet implemented",
            }

    except Exception as e:
        logger.error("ip_addresses executor failed: %s", e, exc_info=True)
        return {"success": False, "action": action, "error": str(e)}
