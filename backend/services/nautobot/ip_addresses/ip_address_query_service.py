"""
IP Address Query Service for Nautobot.

Provides listing and deletion of IP addresses filtered by arbitrary Nautobot fields,
including custom fields like cf_last_scan.
"""

import logging
import re
from datetime import date, timedelta
from typing import Any, Dict, List, Optional

from services.nautobot import NautobotService

logger = logging.getLogger(__name__)


def _resolve_date_template(value: str) -> str:
    """Resolve {today}, {today-N}, {today+N} to YYYY-MM-DD at call time."""

    def _replace(m: re.Match) -> str:
        offset_str = m.group(1)
        today = date.today()
        if not offset_str:
            return today.isoformat()
        days = int(offset_str[1:])
        delta = timedelta(days=days)
        return (today - delta if offset_str[0] == "-" else today + delta).isoformat()

    return re.sub(r"\{today([+-]\d+)?\}", _replace, value)


class IPAddressQueryService:
    """Service for querying and managing IP addresses in Nautobot."""

    def __init__(self):
        self.nautobot = NautobotService()

    def _build_filter_key(self, filter_field: str, filter_type: Optional[str]) -> str:
        """Construct GraphQL filter argument key.

        Args:
            filter_field: Nautobot field name (e.g. 'cf_last_scan', 'address')
            filter_type: Optional operator suffix (e.g. 'lte', 'lt', 'gte', 'gt', 'contains').
                         If None, equality filter is used.

        Returns:
            GraphQL filter key (e.g. 'cf_last_scan__lte' or 'cf_last_scan')
        """
        if filter_type:
            return f"{filter_field}__{filter_type}"
        return filter_field

    def _build_selection_fields(self, filter_field: str) -> str:
        """Return extra fields to include in the GraphQL selection set."""
        return filter_field if filter_field.startswith("cf_") else ""

    def _run_graphql(self, query: str, description: str) -> List[Dict[str, Any]]:
        """Execute a GraphQL query and return the ip_addresses list."""
        try:
            result = self.nautobot._sync_graphql_query(query)
        except Exception as e:
            logger.error("Error during '%s': %s", description, e, exc_info=True)
            return []

        if not result or "data" not in result:
            logger.error("Unexpected response during '%s'", description)
            return []

        return result.get("data") and result["data"].get("ip_addresses") or []

    def list_ip_addresses(
        self,
        filter_field: str,
        filter_value: str,
        filter_type: Optional[str] = None,
        include_null: bool = False,
    ) -> List[Dict[str, Any]]:
        """List IP addresses using a dynamic GraphQL filter.

        Args:
            filter_field: Nautobot field name (e.g. 'cf_last_scan', 'address', 'status')
            filter_value: Value to compare against (e.g. '2026-02-19')
            filter_type: Optional operator suffix (e.g. 'lte', None for equality)
            include_null: When True, also include IP addresses where filter_field is null
                          (i.e. never had a value set). Defaults to False.

        Returns:
            List of IP address dicts with id, address, mask_length, ip_version,
            description, dns_name, and the filter_field value if it is a custom field.
        """
        # Resolve date templates before querying (e.g. {today-14} → 2026-02-05)
        filter_value = _resolve_date_template(filter_value)

        filter_key = self._build_filter_key(filter_field, filter_type)
        extra_field = self._build_selection_fields(filter_field)

        # Primary query: IPs that match the given filter
        primary_query = f"""
        {{
          ip_addresses({filter_key}: "{filter_value}") {{
            id
            address
            mask_length
            ip_version
            description
            dns_name
            {extra_field}
            interface_assignments {{
              id
              interface {{
                id
                name
              }}
            }}
          }}
        }}
        """
        logger.info("Fetching IP addresses with filter %s=%s", filter_key, filter_value)
        ip_addresses = self._run_graphql(
            primary_query, f"filter {filter_key}={filter_value}"
        )
        logger.info("Found %d IP addresses matching filter (before null filtering)", len(ip_addresses))

        if not include_null:
            # Nautobot passes null values through range/comparison filters (Django ORM behavior).
            # Strip them out explicitly when the caller wants only entries with an actual value.
            before = len(ip_addresses)
            ip_addresses = [ip for ip in ip_addresses if ip.get(filter_field) is not None]
            removed = before - len(ip_addresses)
            if removed:
                logger.info(
                    "Excluded %d IP addresses with null %s (include_null=False)",
                    removed,
                    filter_field,
                )

        logger.info("Found %d IP addresses after null filtering", len(ip_addresses))

        if include_null:
            # Secondary query: IPs where the field has never been set (null)
            null_key = f"{filter_field}__isnull"
            null_query = f"""
            {{
              ip_addresses({null_key}: true) {{
                id
                address
                mask_length
                ip_version
                description
                dns_name
                {extra_field}
                interface_assignments {{
                  id
                  interface {{
                    id
                    name
                  }}
                }}
              }}
            }}
            """
            logger.info("Fetching IP addresses with %s=null", filter_field)
            null_addresses = self._run_graphql(null_query, f"{filter_field} is null")
            logger.info("Found %d IP addresses with null %s", len(null_addresses), filter_field)

            # Merge, deduplicating by id
            seen_ids = {ip["id"] for ip in ip_addresses if ip.get("id")}
            for ip in null_addresses:
                if ip.get("id") and ip["id"] not in seen_ids:
                    ip_addresses.append(ip)
                    seen_ids.add(ip["id"])

        return ip_addresses

    def update_ip_address(
        self,
        ip_id: str,
        status_id: Optional[str] = None,
        tag_id: Optional[str] = None,
        description: Optional[str] = None,
    ) -> bool:
        """Update status, tag and/or description of a single IP address via REST PATCH.

        Args:
            ip_id:       UUID of the IP address to update.
            status_id:   Nautobot status UUID to apply.  None means no change.
            tag_id:      Nautobot tag UUID to add.        None means no change.
            description: New description text.            None means no change.

        Returns:
            True if update was successful, False otherwise.
        """
        patch: Dict[str, Any] = {}

        if status_id:
            # Nautobot REST API accepts the status UUID as a plain string
            patch["status"] = status_id

        if tag_id:
            # Nautobot REST API accepts tags as a list of {"id": uuid} objects
            patch["tags"] = [{"id": tag_id}]

        if description is not None:
            patch["description"] = description

        if not patch:
            logger.warning("update_ip_address called with nothing to update for %s", ip_id)
            return True  # nothing to do, not an error

        try:
            self.nautobot._sync_rest_request(
                endpoint=f"ipam/ip-addresses/{ip_id}/",
                method="PATCH",
                data=patch,
            )
            logger.info("Updated IP address %s: %s", ip_id, list(patch.keys()))
            return True
        except Exception as e:
            logger.error("Failed to update IP address %s: %s", ip_id, e)
            return False

    def delete_ip_address(self, ip_id: str) -> bool:
        """Delete a single IP address by UUID via REST API.

        Args:
            ip_id: UUID of the IP address to delete

        Returns:
            True if deletion was successful, False otherwise
        """
        try:
            self.nautobot._sync_rest_request(
                endpoint=f"ipam/ip-addresses/{ip_id}/",
                method="DELETE",
            )
            logger.info("Deleted IP address %s", ip_id)
            return True
        except Exception as e:
            logger.error("Failed to delete IP address %s: %s", ip_id, e)
            return False

    def delete_ip_addresses_by_filter(
        self,
        filter_field: str,
        filter_value: str,
        filter_type: Optional[str] = None,
        include_null: bool = False,
    ) -> Dict[str, Any]:
        """List then delete all IP addresses matching the given filter.

        Args:
            filter_field: Nautobot field name (e.g. 'cf_last_scan')
            filter_value: Value to compare against (e.g. '2026-02-19')
            filter_type: Optional operator suffix (e.g. 'lte', None for equality)
            include_null: When True, also delete IP addresses where filter_field is null.

        Returns:
            Summary dict with keys: total, deleted, failed
        """
        ip_addresses = self.list_ip_addresses(
            filter_field, filter_value, filter_type, include_null=include_null
        )
        deleted = 0
        failed = 0
        for ip in ip_addresses:
            ip_id = ip.get("id")
            if not ip_id:
                logger.warning("IP address entry missing id, skipping: %s", ip)
                failed += 1
                continue
            if self.delete_ip_address(ip_id):
                deleted += 1
            else:
                failed += 1

        return {
            "total": len(ip_addresses),
            "deleted": deleted,
            "failed": failed,
        }
