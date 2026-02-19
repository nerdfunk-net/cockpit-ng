"""
IP Addresses Task for Celery.
Lists or deletes Nautobot IP addresses filtered by an arbitrary field.
"""

import logging
import re
from datetime import date, timedelta
from typing import Any, Dict, Optional

from celery import shared_task

logger = logging.getLogger(__name__)


def resolve_date_template(value: str) -> str:
    """Resolve date templates in filter values.

    Supported templates:
      {today}      → current date as YYYY-MM-DD
      {today-N}    → today minus N days
      {today+N}    → today plus N days

    Any other text is returned unchanged.
    """

    def _replace(m: re.Match) -> str:
        offset_str = m.group(1)  # e.g. "-14", "+7", or None
        today = date.today()
        if not offset_str:
            return today.isoformat()
        days = int(offset_str[1:])
        delta = timedelta(days=days)
        return (today - delta if offset_str[0] == "-" else today + delta).isoformat()

    return re.sub(r"\{today([+-]\d+)?\}", _replace, value)


@shared_task(bind=True, name="tasks.ip_addresses_task")
def ip_addresses_task(
    self,
    action: str,
    filter_field: str,
    filter_value: str,
    filter_type: Optional[str] = None,
    include_null: bool = False,
    executed_by: str = "unknown",
) -> Dict[str, Any]:
    """List or delete Nautobot IP addresses filtered by a dynamic field.

    Args:
        action: 'list' to return matching IPs, 'delete' to delete them
        filter_field: Nautobot field name (e.g. 'cf_last_scan', 'address', 'status')
        filter_value: Value to compare against (e.g. '2026-02-19')
        filter_type: Optional operator suffix (e.g. 'lte', 'lt', 'gte', 'gt', 'contains').
                     If None, equality filter is used.
        include_null: When True, also include/delete IPs where filter_field is null.
                      Defaults to False (null entries excluded).
        executed_by: Username who triggered the task

    Returns:
        For 'list': dict with keys 'success', 'action', 'ip_addresses', 'total', 'include_null'
        For 'delete': dict with keys 'success', 'action', 'total', 'deleted', 'failed', 'include_null'
    """
    from services.nautobot.ip_addresses import IPAddressQueryService

    # Resolve date templates (e.g. {today}, {today-14}, {today+7}) before querying
    filter_value = resolve_date_template(filter_value)

    filter_key = f"{filter_field}__{filter_type}" if filter_type else filter_field

    logger.info(
        "IP addresses task started: action=%s, filter=%s=%s, include_null=%s, executed_by=%s",
        action,
        filter_key,
        filter_value,
        include_null,
        executed_by,
    )

    try:
        service = IPAddressQueryService()

        if action == "list":
            self.update_state(
                state="PROGRESS",
                meta={
                    "status": f"Fetching IP addresses with {filter_key}={filter_value}...",
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

            result = {
                "success": True,
                "action": "list",
                "filter_field": filter_field,
                "filter_type": filter_type,
                "filter_value": filter_value,
                "include_null": include_null,
                "ip_addresses": ip_addresses,
                "total": len(ip_addresses),
            }

        elif action == "delete":
            self.update_state(
                state="PROGRESS",
                meta={
                    "status": f"Fetching IP addresses with {filter_key}={filter_value}...",
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
                self.update_state(
                    state="PROGRESS",
                    meta={
                        "status": f"Deleting IP {idx + 1}/{total}...",
                        "current": idx + 1,
                        "total": total,
                    },
                )

                ip_id = ip.get("id")
                if not ip_id:
                    logger.warning("IP address entry missing id, skipping: %s", ip)
                    failed += 1
                    continue

                if service.delete_ip_address(ip_id):
                    deleted += 1
                else:
                    failed += 1

            result = {
                "success": True,
                "action": "delete",
                "filter_field": filter_field,
                "filter_type": filter_type,
                "filter_value": filter_value,
                "include_null": include_null,
                "total": total,
                "deleted": deleted,
                "failed": failed,
            }

        else:
            result = {
                "success": False,
                "error": f"Unknown action '{action}'. Must be 'list' or 'delete'.",
            }

        logger.info("IP addresses task completed: %s", result)
        return result

    except Exception as e:
        logger.error("IP addresses task failed: %s", e, exc_info=True)
        return {
            "success": False,
            "action": action,
            "error": str(e),
        }
