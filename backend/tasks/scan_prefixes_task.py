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
    set_active: bool = True,
) -> bool:
    """
    Update or create IP address in Nautobot with scan date using REST API.

    Args:
        ip_address: IP address to update/create (e.g., '192.168.1.1')
        prefix_cidr: Parent prefix CIDR (e.g., '192.168.1.0/24')
        response_custom_field_name: Custom field name to write scan date
        dns_name: Optional DNS name from reverse lookup
        set_active: Whether to set IP status to Active (default: True)

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

            # If set_active is True, update status to Active
            if set_active:
                # Get the "Active" status ID
                status_response = requests.get(
                    f"{base_url}/api/extras/statuses/",
                    headers=headers,
                    params={"name": "Active"},
                )
                status_response.raise_for_status()
                statuses = status_response.json().get("results", [])
                if statuses:
                    status_id = statuses[0].get("id")
                    update_data["status"] = status_id

            response = requests.patch(
                f"{base_url}/api/ipam/ip-addresses/{ip_id}/",
                headers=headers,
                json=update_data,
            )

            if not response.ok:
                logger.error(f"Failed to update IP {ip_address}. Status: {response.status_code}, Response: {response.text}")

            response.raise_for_status()

            # Log what was updated
            log_msg = f"Updated IP {ip_address} - {response_custom_field_name}={current_date}"
            if set_active:
                log_msg += ", status=Active"
            logger.info(log_msg)
            return True

        else:
            # IP doesn't exist, create it
            # Find the best parent prefix by containment
            response = requests.get(
                f"{base_url}/api/ipam/prefixes/",
                headers=headers,
                params={"contains": ip_address},
            )
            response.raise_for_status()

            prefixes = response.json().get("results", [])
            
            if not prefixes:
                logger.error(f"No parent prefix found for IP {ip_address} in Nautobot")
                return False

            # Nautobot usually returns sorted results, but to be sure, we pick the most specific one (longest prefix length)
            # The 'prefix' field is a string like "192.168.1.0/24"
            def get_prefix_len(p):
                try:
                    return int(p.get("prefix", "").split("/")[1])
                except (ValueError, IndexError, AttributeError):
                    return 0

            # Sort by prefix length descending (longest match)
            prefixes.sort(key=get_prefix_len, reverse=True)

            best_prefix = prefixes[0]
            prefix_id = best_prefix.get("id")

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

            # Extract prefix length from parent prefix (e.g., "192.168.178.0/24" -> "24")
            parent_prefix_cidr = best_prefix.get("prefix", "")
            prefix_length = parent_prefix_cidr.split("/")[1] if "/" in parent_prefix_cidr else "32"
            
            # Create IP address WITH netmask (e.g., "192.168.178.1/24")
            ip_with_netmask = f"{ip_address}/{prefix_length}"

            # Create new IP address with custom fields nested
            create_data = {
                "address": ip_with_netmask,
                "status": {"id": status_id},
                "parent": {"id": prefix_id},
                "custom_fields": {response_custom_field_name: current_date},
            }

            if dns_name:
                create_data["dns_name"] = dns_name

            response = requests.post(
                f"{base_url}/api/ipam/ip-addresses/",
                headers=headers,
                json=create_data,
            )

            if not response.ok:
                logger.error(f"Failed to create IP {ip_address}. Status: {response.status_code}, Response: {response.text}")

            response.raise_for_status()

            logger.info(f"Created IP {ip_address} - {response_custom_field_name}={current_date}, status=Active")
            return True

    except Exception as e:
        logger.error(f"Error processing IP {ip_address} in Nautobot: {e}", exc_info=True)
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
            # Fallback for split subnets: find containing prefix
            logger.debug(f"Prefix {prefix_cidr} not found, searching by containment")
            # Use the network address of the CIDR
            network_addr = prefix_cidr.split("/")[0]
            response = requests.get(
                f"{base_url}/api/ipam/prefixes/",
                headers=headers,
                params={"contains": network_addr},
            )
            response.raise_for_status()
            prefixes = response.json().get("results", [])

            if not prefixes:
                logger.warning(f"No parent prefix found for {prefix_cidr}")
                return False

            # Pick most specific
            def get_prefix_len(p):
                try:
                    return int(p.get("prefix", "").split("/")[1])
                except (ValueError, IndexError, AttributeError):
                    return 0

            prefixes.sort(key=get_prefix_len, reverse=True)

        best_prefix = prefixes[0]
        prefix_id = best_prefix.get("id")
        logger.debug(
            f"Updating last_scan for prefix: {best_prefix.get('prefix')} (ID: {prefix_id})"
        )

        # Update last_scan custom field
        update_data = {"custom_fields": {"last_scan": current_date}}

        response = requests.patch(
            f"{base_url}/api/ipam/prefixes/{prefix_id}/",
            headers=headers,
            json=update_data,
        )
        response.raise_for_status()
        return True

    except Exception as e:
        logger.error(f"Error updating prefix {prefix_cidr}: {e}", exc_info=True)
        return False


def _execute_scan_prefixes(
    custom_field_name: str,
    custom_field_value: str,
    response_custom_field_name: Optional[str] = None,
    set_reachable_ip_active: bool = True,
    resolve_dns: bool = False,
    ping_count: int = 3,
    timeout_ms: int = 500,
    retries: int = 3,
    interval_ms: int = 10,
    executed_by: str = "unknown",
    task_context=None,
    scan_max_ips: Optional[int] = None,
    explicit_prefixes: Optional[List[str]] = None,
    job_run_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Execute scan prefixes logic (internal function).

    This function:
    1. Determines prefixes to scan:
       - Uses 'explicit_prefixes' if provided (Execution Mode)
       - Fetches from Nautobot using custom field if not (Discovery Mode)
    2. Checks if total IPs exceed scan_max_ips:
       - If yes, splits into sub-tasks and returns summary (Parent Task)
    3. If no or within limit, performs scan:
       - Expands to IPs
       - Pings IPs
       - Updates results

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
        scan_max_ips: Maximum number of IPs to scan per job (optional)
        explicit_prefixes: List of CIDRs to scan directly (bypasses fetch)
        job_run_id: Existing job run ID (optional, will create if not provided)

    Returns:
        dict: Results
    """
    created_job_run = False

    try:
        # Job run management:
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
            f"Scan prefixes task started: custom_field={custom_field_name}, value={custom_field_value}, max_ips={scan_max_ips}"
        )

        # Step 1: Determine prefixes
        cidrs = []
        if explicit_prefixes:
            cidrs = explicit_prefixes
            logger.info(f"Using {len(cidrs)} explicit prefixes provided")
        else:
            if task_context:
                task_context.update_state(
                    state="PROGRESS",
                    meta={
                        "status": f"Fetching prefixes with {custom_field_name}={custom_field_value}...",
                        "current": 0,
                        "total": 1,
                    },
                )
            cidrs = _fetch_prefixes_by_custom_field(
                custom_field_name, custom_field_value
            )

        if not cidrs:
            result = {
                "success": True,
                "message": "No prefixes found to scan",
                "prefixes": [],
                "total_prefixes": 0,
                "total_ips_scanned": 0,
                "total_reachable": 0,
                "total_unreachable": 0,
            }

            if created_job_run:
                job_run_manager.mark_completed(job_run_id, result=result)
            return result

        # Step 2: Check IP count and split if needed
        from tasks.ping_network_task import _expand_cidr_to_ips
        import ipaddress

        total_ips_count = 0
        prefix_ip_counts = {}

        for cidr in cidrs:
            try:
                # Quick count without expanding fully if possible, but _expand handles exclusion/network addr
                # so safer to rely on library or simple math: 2^(32-prefix_len) - 2
                # For accuracy with fping task logic, we'll estimate or just use quick math
                net = ipaddress.ip_network(cidr, strict=False)
                count = (
                    net.num_addresses - 2 if net.prefixlen < 31 else net.num_addresses
                )  # rough est
                if count < 0:
                    count = 0
                prefix_ip_counts[cidr] = count
                total_ips_count += count
            except Exception:
                prefix_ip_counts[cidr] = 0

        # Store original prefixes before any splitting (for accurate tracking)
        original_cidrs = cidrs.copy()

        # If strict splitting, check total
        if scan_max_ips and total_ips_count > scan_max_ips:
            # Check for large prefixes that need splitting themselves
            # To handle large single prefixes, we will split them into smaller subnets
            # until they fit within scan_max_ips or we reach a reasonable limit (/30)

            final_cidrs = []

            for cidr in cidrs:
                count = prefix_ip_counts.get(cidr, 0)
                if count > scan_max_ips:
                    # Split this prefix
                    try:
                        net = ipaddress.ip_network(cidr, strict=False)
                        # Calculate target prefix length
                        # We want subnets small enough to fit in scan_max_ips
                        # e.g. if max=100, we need /26 (64) or /25 (128 - wait, 128 > 100)
                        # So we need net count <= max_ips

                        current_subnets = [net]

                        # Iteratively split until all chunks are small enough
                        # This avoids calculating optimal prefix math and handles varying sizes
                        while any(
                            sn.num_addresses > scan_max_ips for sn in current_subnets
                        ):
                            next_subnets = []
                            for sn in current_subnets:
                                if sn.num_addresses > scan_max_ips:
                                    if sn.prefixlen >= 30:  # Don't split /30 or smaller
                                        next_subnets.append(sn)
                                    else:
                                        next_subnets.extend(
                                            list(sn.subnets(prefixlen_diff=1))
                                        )
                                else:
                                    next_subnets.append(sn)
                            current_subnets = next_subnets

                            # Safety break
                            if len(current_subnets) > 1000:
                                logger.warning(
                                    f"Prefix splitting generated too many subnets for {cidr}, stopping split."
                                )
                                break

                        final_cidrs.extend([str(sn) for sn in current_subnets])

                    except (ValueError, TypeError) as e:
                        logger.error(f"Failed to split large prefix {cidr}: {e}")
                        final_cidrs.append(cidr)
                else:
                    final_cidrs.append(cidr)

            # Replaced original cidrs with potentially split ones
            cidrs = final_cidrs

            # Recalculate counts for batching
            prefix_ip_counts = {}
            for cidr in cidrs:
                try:
                    net = ipaddress.ip_network(cidr, strict=False)
                    # Simple count
                    prefix_ip_counts[cidr] = net.num_addresses
                except (ValueError, TypeError):
                    prefix_ip_counts[cidr] = 0

            logger.info(
                f"Total IPs ({total_ips_count}) exceeds max ({scan_max_ips}). Splitting job."
            )

            if task_context:
                task_context.update_state(
                    state="PROGRESS",
                    meta={
                        "status": f"Splitting job: {total_ips_count} IPs > {scan_max_ips} max...",
                        "current": 0,
                        "total": 1,
                    },
                )

            # Group prefixes into batches
            batches = []
            current_batch = []
            current_batch_count = 0

            for cidr in cidrs:
                count = prefix_ip_counts.get(cidr, 0)

                # Check directly if adding this limit exceeds max (should verify single items fit now)
                if current_batch and (current_batch_count + count > scan_max_ips):
                    batches.append(current_batch)
                    current_batch = []
                    current_batch_count = 0

                current_batch.append(cidr)
                current_batch_count += count

            if current_batch:
                batches.append(current_batch)

            logger.info(f"Split {len(cidrs)} prefixes into {len(batches)} sub-tasks")

            # Spawn sub-tasks
            sub_task_ids = []
            for i, batch in enumerate(batches):
                sub_task = scan_prefixes_task.delay(
                    custom_field_name=custom_field_name,
                    custom_field_value=custom_field_value,
                    response_custom_field_name=response_custom_field_name,
                    resolve_dns=resolve_dns,
                    ping_count=ping_count,
                    timeout_ms=timeout_ms,
                    retries=retries,
                    interval_ms=interval_ms,
                    executed_by=executed_by,
                    scan_max_ips=scan_max_ips,  # Pass recursive limit
                    explicit_prefixes=batch,
                )
                sub_task_ids.append(sub_task.id)
                logger.info(
                    f"Spawned sub-task {sub_task.id} for batch {i + 1}/{len(batches)}"
                )

            result = {
                "success": True,
                "message": f"Job split into {len(batches)} sub-tasks due to IP limit",
                "total_prefixes": len(original_cidrs),
                "prefixes": original_cidrs,  # Store ORIGINAL prefixes (before splitting) for accurate tracking
                "total_ips_to_scan": total_ips_count,
                "split_into_batches": len(batches),
                "sub_task_ids": sub_task_ids,
            }

            if created_job_run:
                job_run_manager.mark_completed(job_run_id, result=result)

            return result

        # Step 3: Normal Execution (Expand & Scan)
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
                logger.info(f"Scanning network: {cidr}")
                cidr_ips = _expand_cidr_to_ips(cidr)
                all_ips.extend(cidr_ips)
                prefix_ips[cidr] = cidr_ips
                logger.debug(f"Expanded {cidr} to {len(cidr_ips)} IPs")
            except Exception as e:
                logger.error(f"Failed to expand prefix {cidr}: {e}")
                prefix_ips[cidr] = []

        # Step 4: Ping
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

        # Step 5: Process results
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

                    # Update Nautobot
                    if response_custom_field_name:
                        try:
                            _update_ip_in_nautobot(
                                ip_address=ip,
                                prefix_cidr=cidr,
                                response_custom_field_name=response_custom_field_name,
                                dns_name=hostname,
                                set_active=set_reachable_ip_active,
                            )
                        except Exception as e:
                            logger.error(f"Failed to update IP {ip} in Nautobot: {e}")
                else:
                    unreachable.append(ip)

            # Condense unreachable ranges
            unreachable_condensed = _condense_ip_ranges(unreachable)

            # Update prefix last_scan
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

        # Mark job as completed
        if created_job_run and job_run_id:
            job_run_manager.mark_completed(job_run_id, result=result)

        logger.info(
            f"Scan prefixes task completed: {len(alive_ips)}/{len(all_ips)} reachable"
        )
        return result

    except Exception as e:
        logger.error(f"Scan prefixes task failed: {e}", exc_info=True)

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
    set_reachable_ip_active: bool = True,
    resolve_dns: bool = False,
    ping_count: int = 3,
    timeout_ms: int = 500,
    retries: int = 3,
    interval_ms: int = 10,
    executed_by: str = "unknown",
    scan_max_ips: Optional[int] = None,
    explicit_prefixes: Optional[List[str]] = None,
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
        set_reachable_ip_active=set_reachable_ip_active,
        resolve_dns=resolve_dns,
        ping_count=ping_count,
        timeout_ms=timeout_ms,
        retries=retries,
        interval_ms=interval_ms,
        executed_by=executed_by,
        task_context=self,
        job_run_id=None,
        scan_max_ips=scan_max_ips,
        explicit_prefixes=explicit_prefixes,
    )
