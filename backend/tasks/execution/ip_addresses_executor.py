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
    mark_status = None
    mark_tag = None
    mark_description = None

    remove_skip_assigned = True

    if template:
        action = template.get("ip_action") or "list"
        filter_field = template.get("ip_filter_field") or ""
        filter_type = template.get("ip_filter_type") or None
        filter_value = template.get("ip_filter_value") or ""
        include_null = template.get("ip_include_null", False)
        mark_status = template.get("ip_mark_status") or None
        mark_tag = template.get("ip_mark_tag") or None
        mark_description = template.get("ip_mark_description") or None
        remove_skip_assigned = template.get("ip_remove_skip_assigned", True)

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
            skipped = 0
            deleted_ips: list = []
            skipped_ips: list = []
            failed_ips: list = []

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
                ip_address = ip.get("address", ip_id)
                if not ip_id:
                    failed += 1
                    failed_ips.append({"address": ip_address, "reason": "missing id"})
                    continue

                # Skip IPs that are assigned to an interface when option is enabled
                if remove_skip_assigned and ip.get("interface_assignments"):
                    assignments = ip["interface_assignments"]
                    logger.info(
                        "Skipping assigned IP %s (interface_assignments=%s)",
                        ip_address,
                        assignments,
                    )
                    skipped += 1
                    skipped_ips.append({
                        "address": ip_address,
                        "id": ip_id,
                        "interface_assignments": [
                            {
                                "id": a.get("id"),
                                "interface": a.get("interface", {}).get("name"),
                                "device": a.get("interface", {}).get("device", {}).get("name"),
                            }
                            for a in assignments
                        ],
                    })
                    continue

                if service.delete_ip_address(ip_id):
                    deleted += 1
                    deleted_ips.append({"address": ip_address, "id": ip_id})
                else:
                    failed += 1
                    failed_ips.append({"address": ip_address, "id": ip_id, "reason": "delete failed"})

            return {
                "success": True,
                "action": action,
                "filter_field": filter_field,
                "filter_type": filter_type,
                "filter_value": filter_value,
                "include_null": include_null,
                "remove_skip_assigned": remove_skip_assigned,
                "total": total,
                "skipped": skipped,
                "deleted": deleted,
                "failed": failed,
                "deleted_ips": deleted_ips,
                "skipped_ips": skipped_ips,
                "failed_ips": failed_ips,
            }

        elif action == "mark":
            if not any([mark_status, mark_tag, mark_description is not None]):
                return {
                    "success": False,
                    "action": action,
                    "error": "At least one of ip_mark_status, ip_mark_tag, or ip_mark_description must be set for the 'mark' action",
                }

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
            updated = 0
            failed = 0

            changes = {}
            if mark_status:
                changes["status"] = mark_status
            if mark_tag:
                changes["tag"] = mark_tag
            if mark_description is not None:
                changes["description"] = mark_description

            logger.info(
                "Marking %d IP addresses with changes: %s",
                total, list(changes.keys()),
            )

            for idx, ip in enumerate(ip_addresses):
                task_context.update_state(
                    state="PROGRESS",
                    meta={
                        "status": f"Marking IP {idx + 1}/{total}...",
                        "current": idx + 1,
                        "total": total,
                    },
                )
                ip_id = ip.get("id")
                if not ip_id:
                    failed += 1
                    continue
                if service.update_ip_address(
                    ip_id,
                    status_id=mark_status,
                    tag_id=mark_tag,
                    description=mark_description,
                ):
                    updated += 1
                else:
                    failed += 1

            return {
                "success": True,
                "action": action,
                "filter_field": filter_field,
                "filter_type": filter_type,
                "filter_value": filter_value,
                "include_null": include_null,
                "changes": changes,
                "total": total,
                "updated": updated,
                "failed": failed,
            }

        else:
            return {
                "success": False,
                "action": action,
                "error": f"Unknown action '{action}'",
            }

    except Exception as e:
        logger.error("ip_addresses executor failed: %s", e, exc_info=True)
        return {"success": False, "action": action, "error": str(e)}
