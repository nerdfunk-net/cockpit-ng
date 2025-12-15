"""
Scan Prefixes Task for Celery
Fetches prefixes from Nautobot with specific custom field values and scans them using fping.
"""

from celery import shared_task
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

import job_run_manager
from services.nautobot import NautobotService
from tasks.ping_network_task import _fping_networks, _resolve_dns, _condense_ip_ranges

logger = logging.getLogger(__name__)


def _fetch_prefixes_by_custom_field(
    custom_field_name: str, custom_field_value: str
) -> List[str]:
    """
    Fetch prefixes from Nautobot filtered by custom field value using GraphQL.

    Args:
        custom_field_name: Name of the custom field (e.g., 'scan_prefix')
        custom_field_value: Value to filter by (e.g., 'true')

    Returns:
        List of CIDR prefixes (e.g., ['192.168.1.0/24', '10.0.0.0/24'])
    """
    nautobot_service = NautobotService()

    # Build GraphQL query with custom field filter
    # The custom field name in GraphQL uses 'cf_' prefix
    query = f"""
    query {{
      prefixes(cf_{custom_field_name}: {custom_field_value}) {{
        prefix
        cf_{custom_field_name}
      }}
    }}
    """

    try:
        logger.info(f"Fetching prefixes with {custom_field_name}={custom_field_value}")
        result = nautobot_service._sync_graphql_query(query)

        if not result or "data" not in result:
            logger.error("Failed to fetch prefixes from Nautobot")
            return []

        prefixes_data = result.get("data", {}).get("prefixes", [])

        # Extract prefix CIDR strings
        prefixes = [p.get("prefix") for p in prefixes_data if p.get("prefix")]

        logger.info(f"Found {len(prefixes)} prefixes to scan")
        return prefixes

    except Exception as e:
        logger.error(f"Error fetching prefixes from Nautobot: {e}", exc_info=True)
        return []


def _update_ip_in_nautobot(
    ip_address: str,
    prefix_cidr: str,
    response_custom_field_name: str,
    dns_name: Optional[str] = None,
) -> bool:
    """
    Update or create IP address in Nautobot with scan date using REST API.

    Args:
        ip_address: IP address to update/create (e.g., '192.168.1.1')
        prefix_cidr: Parent prefix CIDR (e.g., '192.168.1.0/24')
        response_custom_field_name: Custom field name to write scan date
        dns_name: Optional DNS name from reverse lookup

    Returns:
        bool: True if successful, False otherwise
    """
    import requests
    from services.nautobot import nautobot_service

    current_date = datetime.now().strftime("%Y-%m-%d")

    try:
        config = nautobot_service._get_config()
        if not config["url"] or not config["token"]:
            logger.error("Nautobot URL and token must be configured")
            return False

        base_url = config["url"].rstrip("/")
        headers = {
            "Authorization": f"Token {config['token']}",
            "Content-Type": "application/json",
        }

        # Step 1: Check if IP address exists
        response = requests.get(
            f"{base_url}/api/ipam/ip-addresses/",
            headers=headers,
            params={"address": ip_address},
        )
        response.raise_for_status()

        results = response.json().get("results", [])

        if results:
            # IP exists, update it
            ip_id = results[0].get("id")

            # Custom fields nested without cf_ prefix for REST API PATCH
            update_data = {"custom_fields": {response_custom_field_name: current_date}}

            response = requests.patch(
                f"{base_url}/api/ipam/ip-addresses/{ip_id}/",
                headers=headers,
                json=update_data,
            )

            if not response.ok:
                logger.error(f"Failed to update IP. Status: {response.status_code}")
                logger.error(f"Response body: {response.text}")

            response.raise_for_status()

            # Verify the update
            updated_ip = response.json()
            updated_cf_value = updated_ip.get("custom_fields", {}).get(
                response_custom_field_name
            )
            logger.debug(
                f"Updated IP {ip_address} with custom field {response_custom_field_name}={updated_cf_value}"
            )
            return True

        else:
            # IP doesn't exist, create it
            logger.debug(f"Creating new IP {ip_address} in prefix {prefix_cidr}")

            # First, get the prefix ID
            response = requests.get(
                f"{base_url}/api/ipam/prefixes/",
                headers=headers,
                params={"prefix": prefix_cidr},
            )
            response.raise_for_status()

            prefixes = response.json().get("results", [])
            if not prefixes:
                logger.error(f"Prefix {prefix_cidr} not found in Nautobot")
                return False

            prefix_id = prefixes[0].get("id")

            # Get the "Active" status ID
            response = requests.get(
                f"{base_url}/api/extras/statuses/",
                headers=headers,
                params={"name": "Active"},
            )
            response.raise_for_status()

            statuses = response.json().get("results", [])
            if not statuses:
                logger.error("Active status not found in Nautobot")
                return False

            status_id = statuses[0].get("id")

            # Create new IP address with custom fields nested
            create_data = {
                "address": ip_address,
                "status": {"id": status_id},
                "parent": {"id": prefix_id},
                "custom_fields": {response_custom_field_name: current_date},
            }

            if dns_name:
                create_data["dns_name"] = dns_name

            logger.debug(
                f"Creating IP with custom field '{response_custom_field_name}' = '{current_date}'"
            )
            logger.debug(f"Create data: {create_data}")

            response = requests.post(
                f"{base_url}/api/ipam/ip-addresses/",
                headers=headers,
                json=create_data,
            )

            if not response.ok:
                logger.error(f"Failed to create IP. Status: {response.status_code}")
                logger.error(f"Response body: {response.text}")

            response.raise_for_status()

            # Verify the creation
            created_ip = response.json()
            created_cf_value = created_ip.get("custom_fields", {}).get(
                response_custom_field_name
            )
            logger.debug(
                f"Created IP {ip_address} with custom field {response_custom_field_name}={created_cf_value}"
            )
            return True

    except Exception as e:
        logger.error(f"Error updating IP {ip_address} in Nautobot: {e}", exc_info=True)
        return False


def _update_prefix_last_scan(
    prefix_cidr: str,
) -> bool:
    """
    Update prefix's last_scan custom field with current date using REST API.

    Args:
        prefix_cidr: Prefix CIDR (e.g., '192.168.1.0/24')

    Returns:
        bool: True if successful, False otherwise
    """
    import requests
    from services.nautobot import nautobot_service

    current_date = datetime.now().strftime("%Y-%m-%d")

    try:
        config = nautobot_service._get_config()
        if not config["url"] or not config["token"]:
            logger.error("Nautobot URL and token must be configured")
            return False

        base_url = config["url"].rstrip("/")
        headers = {
            "Authorization": f"Token {config['token']}",
            "Content-Type": "application/json",
        }

        # Get prefix
        response = requests.get(
            f"{base_url}/api/ipam/prefixes/",
            headers=headers,
            params={"prefix": prefix_cidr},
        )
        response.raise_for_status()

        prefixes = response.json().get("results", [])
        if not prefixes:
            logger.error(f"Prefix {prefix_cidr} not found")
            return False

        prefix_id = prefixes[0].get("id")

        # Update last_scan custom field
        update_data = {"custom_fields": {"last_scan": current_date}}

        response = requests.patch(
            f"{base_url}/api/ipam/prefixes/{prefix_id}/",
            headers=headers,
            json=update_data,
        )
        response.raise_for_status()
        logger.debug(f"Updated prefix {prefix_cidr} last_scan to {current_date}")
        return True

    except Exception as e:
        logger.error(f"Error updating prefix {prefix_cidr}: {e}", exc_info=True)
        return False


def _execute_scan_prefixes(
    custom_field_name: str,
    custom_field_value: str,
    response_custom_field_name: Optional[str] = None,
    resolve_dns: bool = False,
    ping_count: int = 3,
    timeout_ms: int = 500,
    retries: int = 3,
    interval_ms: int = 10,
    executed_by: str = "unknown",
    task_context=None,
    job_run_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Execute scan prefixes logic (internal function).

    This function:
    1. Queries Nautobot for prefixes with specific custom field value
    2. Expands prefixes to IP addresses
    3. Pings all IPs using fping
    4. Optionally resolves DNS names
    5. Returns results per prefix

    Args:
        custom_field_name: Name of custom field on ipam.prefix (without 'cf_' prefix)
        custom_field_value: Value to filter prefixes by
        resolve_dns: Whether to resolve DNS names for reachable IPs
        ping_count: Number of pings per host (default: 3)
        timeout_ms: Individual target timeout in ms (default: 500)
        retries: Number of retries (default: 3)
        interval_ms: Interval between packets in ms (default: 10)
        executed_by: Username who triggered the task
        task_context: Celery task context for state updates (optional)
        job_run_id: Existing job run ID (optional, will create if not provided)

    Returns:
        dict: Results with reachable/unreachable IPs per prefix
    """
    created_job_run = False

    try:
        # Job run management:
        # Only create job run if called directly as Celery task (not from executor/dispatcher)
        # When task_context is provided AND job_run_id is None, we create our own job run
        # Executors should pass task_context=None to avoid creating duplicate job runs
        if job_run_id is None and task_context:
            # Direct Celery task call (e.g., from API endpoint)
            job_run = job_run_manager.create_job_run(
                job_name=f"Scan Prefixes ({custom_field_name}={custom_field_value})",
                job_type="scan_prefixes",
                triggered_by="manual",
                executed_by=executed_by,
                target_devices=None,
            )
            job_run_id = job_run["id"]
            created_job_run = True

            # Mark job as started with our task ID
            job_run_manager.mark_started(job_run_id, task_context.request.id)

        logger.info(
            f"Scan prefixes task started: custom_field={custom_field_name}, value={custom_field_value}"
        )

        # Step 1: Fetch prefixes from Nautobot
        if task_context:
            task_context.update_state(
                state="PROGRESS",
                meta={
                    "status": f"Fetching prefixes with {custom_field_name}={custom_field_value}...",
                    "current": 0,
                    "total": 1,
                },
            )

        cidrs = _fetch_prefixes_by_custom_field(custom_field_name, custom_field_value)

        if not cidrs:
            result = {
                "success": True,
                "message": f"No prefixes found with {custom_field_name}={custom_field_value}",
                "prefixes": [],
                "total_prefixes": 0,
                "total_ips_scanned": 0,
                "total_reachable": 0,
                "total_unreachable": 0,
            }

            if created_job_run:
                job_run_manager.mark_completed(job_run_id, result=result)
            return result

        # Step 2: Expand prefixes to IP lists
        from tasks.ping_network_task import _expand_cidr_to_ips

        all_ips: List[str] = []
        prefix_ips: Dict[str, List[str]] = {}

        if task_context:
            task_context.update_state(
                state="PROGRESS",
                meta={
                    "status": "Expanding prefixes to IP addresses...",
                    "current": 0,
                    "total": len(cidrs),
                },
            )

        for idx, cidr in enumerate(cidrs):
            try:
                cidr_ips = _expand_cidr_to_ips(cidr)
                all_ips.extend(cidr_ips)
                prefix_ips[cidr] = cidr_ips
                logger.debug(f"Expanded {cidr} to {len(cidr_ips)} IPs")
            except Exception as e:
                logger.error(f"Failed to expand prefix {cidr}: {e}")
                prefix_ips[cidr] = []

        # Step 3: Ping all IPs using fping
        if task_context:
            task_context.update_state(
                state="PROGRESS",
                meta={
                    "status": f"Pinging {len(all_ips)} IP addresses...",
                    "current": 0,
                    "total": len(all_ips),
                },
            )

        alive_ips = _fping_networks(
            all_ips,
            count=ping_count,
            timeout=timeout_ms,
            retry=retries,
            interval=interval_ms,
        )
        logger.info(
            f"fping found {len(alive_ips)} alive hosts out of {len(all_ips)} targets"
        )

        # Step 4: Process results per prefix
        prefix_results: List[Dict[str, Any]] = []

        for idx, (cidr, cidr_ips) in enumerate(prefix_ips.items()):
            if task_context:
                task_context.update_state(
                    state="PROGRESS",
                    meta={
                        "status": f"Processing prefix {idx + 1}/{len(cidrs)}...",
                        "current": idx + 1,
                        "total": len(cidrs),
                    },
                )

            reachable: List[Dict[str, str]] = []
            unreachable: List[str] = []

            for ip in cidr_ips:
                if ip in alive_ips:
                    ip_data = {"ip": ip}
                    hostname = None

                    if resolve_dns:
                        hostname = _resolve_dns(ip)
                        if hostname:
                            ip_data["hostname"] = hostname

                    reachable.append(ip_data)

                    # Update Nautobot if response custom field is specified
                    if response_custom_field_name:
                        try:
                            _update_ip_in_nautobot(
                                ip_address=ip,
                                prefix_cidr=cidr,
                                response_custom_field_name=response_custom_field_name,
                                dns_name=hostname,
                            )
                        except Exception as e:
                            logger.error(f"Failed to update IP {ip} in Nautobot: {e}")
                else:
                    unreachable.append(ip)

            # Condense unreachable ranges
            unreachable_condensed = _condense_ip_ranges(unreachable)

            # Update prefix last_scan custom field if response field is specified
            if response_custom_field_name:
                try:
                    _update_prefix_last_scan(cidr)
                except Exception as e:
                    logger.error(f"Failed to update prefix {cidr} last_scan: {e}")

            prefix_results.append(
                {
                    "prefix": cidr,
                    "total_ips": len(cidr_ips),
                    "reachable_count": len(reachable),
                    "unreachable_count": len(unreachable),
                    "reachable": reachable,
                    "unreachable": unreachable_condensed,
                }
            )

        result = {
            "success": True,
            "custom_field_name": custom_field_name,
            "custom_field_value": custom_field_value,
            "prefixes": prefix_results,
            "total_prefixes": len(cidrs),
            "total_ips_scanned": len(all_ips),
            "total_reachable": len(alive_ips),
            "total_unreachable": len(all_ips) - len(alive_ips),
            "resolve_dns": resolve_dns,
        }

        # Mark job as completed if we created it
        if created_job_run and job_run_id:
            job_run_manager.mark_completed(job_run_id, result=result)

        logger.info(
            f"Scan prefixes task completed: {len(alive_ips)}/{len(all_ips)} reachable"
        )
        return result

    except Exception as e:
        logger.error(f"Scan prefixes task failed: {e}", exc_info=True)

        # Mark job as failed if we created it
        if created_job_run and job_run_id:
            job_run_manager.mark_failed(job_run_id, error_message=str(e))

        return {
            "success": False,
            "error": str(e),
            "prefixes": [],
        }


@shared_task(bind=True, name="tasks.scan_prefixes_task")
def scan_prefixes_task(
    self,
    custom_field_name: str,
    custom_field_value: str,
    response_custom_field_name: Optional[str] = None,
    resolve_dns: bool = False,
    ping_count: int = 3,
    timeout_ms: int = 500,
    retries: int = 3,
    interval_ms: int = 10,
    executed_by: str = "unknown",
) -> Dict[str, Any]:
    """
    Celery task wrapper for scan prefixes.

    This is the actual Celery task that gets called via .delay()
    It delegates to _execute_scan_prefixes with the task context.
    """
    return _execute_scan_prefixes(
        custom_field_name=custom_field_name,
        custom_field_value=custom_field_value,
        response_custom_field_name=response_custom_field_name,
        resolve_dns=resolve_dns,
        ping_count=ping_count,
        timeout_ms=timeout_ms,
        retries=retries,
        interval_ms=interval_ms,
        executed_by=executed_by,
        task_context=self,
        job_run_id=None,
    )
