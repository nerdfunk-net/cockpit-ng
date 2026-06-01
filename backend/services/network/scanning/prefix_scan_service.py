"""Business logic for scanning IP prefixes discovered via Nautobot custom fields."""

from __future__ import annotations

import asyncio
import ipaddress
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests

logger = logging.getLogger(__name__)


class PrefixScanService:
    """Orchestrates prefix discovery, IP scanning, and Nautobot result updates."""

    def execute(
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
        task_context=None,
        scan_max_ips: Optional[int] = None,
        explicit_prefixes: Optional[List[str]] = None,
        job_run_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Entry point. Replaces _execute_scan_prefixes() in the task file.

        Determines prefixes to scan, splits into sub-tasks if needed, or runs
        the full fping/DNS/Nautobot update cycle.
        """
        import service_factory

        _jrs = service_factory.build_job_run_service()

        created_job_run = False

        try:
            if job_run_id is None and task_context:
                job_run = _jrs.create_job_run(
                    job_name="Scan Prefixes (%s=%s)" % (custom_field_name, custom_field_value),
                    job_type="scan_prefixes",
                    triggered_by="manual",
                    executed_by=executed_by,
                    target_devices=None,
                )
                job_run_id = job_run["id"]
                created_job_run = True
                _jrs.mark_started(job_run_id, task_context.request.id)

            logger.info(
                "Scan prefixes task started: custom_field=%s, value=%s, max_ips=%s",
                custom_field_name,
                custom_field_value,
                scan_max_ips,
            )

            cidrs = []
            if explicit_prefixes:
                cidrs = explicit_prefixes
                logger.info("Using %s explicit prefixes provided", len(cidrs))
            else:
                if task_context:
                    task_context.update_state(
                        state="PROGRESS",
                        meta={
                            "status": "Fetching prefixes with %s=%s..." % (custom_field_name, custom_field_value),
                            "current": 0,
                            "total": 1,
                        },
                    )
                cidrs = self._fetch_prefixes_by_custom_field(custom_field_name, custom_field_value)

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
                    _jrs.mark_completed(job_run_id, result=result)
                return result

            from tasks.ping_network_task import _expand_cidr_to_ips

            total_ips_count = 0
            prefix_ip_counts = {}

            for cidr in cidrs:
                try:
                    net = ipaddress.ip_network(cidr, strict=False)
                    count = net.num_addresses - 2 if net.prefixlen < 31 else net.num_addresses
                    if count < 0:
                        count = 0
                    prefix_ip_counts[cidr] = count
                    total_ips_count += count
                except Exception:
                    prefix_ip_counts[cidr] = 0

            original_cidrs = cidrs.copy()

            if scan_max_ips and total_ips_count > scan_max_ips:
                final_cidrs = []

                for cidr in cidrs:
                    count = prefix_ip_counts.get(cidr, 0)
                    if count > scan_max_ips:
                        try:
                            net = ipaddress.ip_network(cidr, strict=False)
                            current_subnets = [net]

                            while any(sn.num_addresses > scan_max_ips for sn in current_subnets):
                                next_subnets = []
                                for sn in current_subnets:
                                    if sn.num_addresses > scan_max_ips:
                                        if sn.prefixlen >= 30:
                                            next_subnets.append(sn)
                                        else:
                                            next_subnets.extend(list(sn.subnets(prefixlen_diff=1)))
                                    else:
                                        next_subnets.append(sn)
                                current_subnets = next_subnets

                                if len(current_subnets) > 1000:
                                    logger.warning(
                                        "Prefix splitting generated too many subnets for %s, stopping split.",
                                        cidr,
                                    )
                                    break

                            final_cidrs.extend([str(sn) for sn in current_subnets])

                        except (ValueError, TypeError) as e:
                            logger.error("Failed to split large prefix %s: %s", cidr, e)
                            final_cidrs.append(cidr)
                    else:
                        final_cidrs.append(cidr)

                cidrs = final_cidrs

                prefix_ip_counts = {}
                for cidr in cidrs:
                    try:
                        net = ipaddress.ip_network(cidr, strict=False)
                        prefix_ip_counts[cidr] = net.num_addresses
                    except (ValueError, TypeError):
                        prefix_ip_counts[cidr] = 0

                logger.info(
                    "Total IPs (%s) exceeds max (%s). Splitting job.",
                    total_ips_count,
                    scan_max_ips,
                )

                if task_context:
                    task_context.update_state(
                        state="PROGRESS",
                        meta={
                            "status": "Splitting job: %s IPs > %s max..." % (total_ips_count, scan_max_ips),
                            "current": 0,
                            "total": 1,
                        },
                    )

                batches = []
                current_batch = []
                current_batch_count = 0

                for cidr in cidrs:
                    count = prefix_ip_counts.get(cidr, 0)

                    if current_batch and (current_batch_count + count > scan_max_ips):
                        batches.append(current_batch)
                        current_batch = []
                        current_batch_count = 0

                    current_batch.append(cidr)
                    current_batch_count += count

                if current_batch:
                    batches.append(current_batch)

                logger.info("Split %s prefixes into %s sub-tasks", len(cidrs), len(batches))

                sub_task_ids = []
                from tasks.scan_prefixes_task import scan_prefixes_task

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
                        scan_max_ips=scan_max_ips,
                        explicit_prefixes=batch,
                    )
                    sub_task_ids.append(sub_task.id)
                    logger.info(
                        "Spawned sub-task %s for batch %s/%s",
                        sub_task.id,
                        i + 1,
                        len(batches),
                    )

                result = {
                    "success": True,
                    "message": "Job split into %s sub-tasks due to IP limit" % len(batches),
                    "total_prefixes": len(original_cidrs),
                    "prefixes": original_cidrs,
                    "total_ips_to_scan": total_ips_count,
                    "split_into_batches": len(batches),
                    "sub_task_ids": sub_task_ids,
                }

                if created_job_run:
                    _jrs.mark_completed(job_run_id, result=result)

                return result

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

            for _idx, cidr in enumerate(cidrs):
                try:
                    logger.info("Scanning network: %s", cidr)
                    cidr_ips = _expand_cidr_to_ips(cidr)
                    all_ips.extend(cidr_ips)
                    prefix_ips[cidr] = cidr_ips
                    logger.debug("Expanded %s to %s IPs", cidr, len(cidr_ips))
                except Exception as e:
                    logger.error("Failed to expand prefix %s: %s", cidr, e)
                    prefix_ips[cidr] = []

            if task_context:
                task_context.update_state(
                    state="PROGRESS",
                    meta={
                        "status": "Pinging %s IP addresses..." % len(all_ips),
                        "current": 0,
                        "total": len(all_ips),
                    },
                )

            from tasks.ping_network_task import (
                _condense_ip_ranges,
                _fping_networks,
                _resolve_dns,
            )

            alive_ips = _fping_networks(
                all_ips,
                count=ping_count,
                timeout=timeout_ms,
                retry=retries,
                interval=interval_ms,
            )
            logger.info(
                "fping found %s alive hosts out of %s targets",
                len(alive_ips),
                len(all_ips),
            )

            prefix_results: List[Dict[str, Any]] = []

            for idx, (cidr, cidr_ips) in enumerate(prefix_ips.items()):
                if task_context:
                    task_context.update_state(
                        state="PROGRESS",
                        meta={
                            "status": "Processing prefix %s/%s..." % (idx + 1, len(cidrs)),
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

                        if response_custom_field_name:
                            try:
                                self._update_ip_in_nautobot(
                                    ip_address=ip,
                                    prefix_cidr=cidr,
                                    response_custom_field_name=response_custom_field_name,
                                    dns_name=hostname,
                                    set_active=set_reachable_ip_active,
                                )
                            except Exception as e:
                                logger.error("Failed to update IP %s in Nautobot: %s", ip, e)
                    else:
                        unreachable.append(ip)

                unreachable_condensed = _condense_ip_ranges(unreachable)

                if response_custom_field_name:
                    try:
                        self._update_prefix_last_scan(cidr)
                    except Exception as e:
                        logger.error("Failed to update prefix %s last_scan: %s", cidr, e)

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

            if created_job_run and job_run_id:
                _jrs.mark_completed(job_run_id, result=result)

            logger.info(
                "Scan prefixes task completed: %s/%s reachable",
                len(alive_ips),
                len(all_ips),
            )
            return result

        except Exception as e:
            logger.error("Scan prefixes task failed: %s", e, exc_info=True)

            if created_job_run and job_run_id:
                _jrs.mark_failed(job_run_id, error_message=str(e))

            return {
                "success": False,
                "error": str(e),
                "prefixes": [],
            }

    def _fetch_prefixes_by_custom_field(
        self,
        custom_field_name: str,
        custom_field_value: str,
    ) -> List[str]:
        """GraphQL query: return list of CIDR strings matching custom field."""
        import service_factory

        nautobot_service = service_factory.build_nautobot_service()

        query = f"""
    query {{
      prefixes(cf_{custom_field_name}: {custom_field_value}) {{
        prefix
        cf_{custom_field_name}
      }}
    }}
    """

        try:
            logger.info("Fetching prefixes with %s=%s", custom_field_name, custom_field_value)
            result = asyncio.run(nautobot_service.graphql_query(query))

            if not result or "data" not in result:
                logger.error("Failed to fetch prefixes from Nautobot")
                return []

            prefixes_data = result.get("data", {}).get("prefixes", [])
            prefixes = [p.get("prefix") for p in prefixes_data if p.get("prefix")]

            logger.info("Found %s prefixes to scan", len(prefixes))
            return prefixes

        except Exception as e:
            logger.error("Error fetching prefixes from Nautobot: %s", e, exc_info=True)
            return []

    def _update_ip_in_nautobot(
        self,
        ip_address: str,
        prefix_cidr: str,
        response_custom_field_name: str,
        dns_name: Optional[str] = None,
        set_active: bool = True,
    ) -> bool:
        """Create or update an IP address record via Nautobot REST API."""
        import service_factory

        nautobot_service = service_factory.build_nautobot_service()

        current_date = datetime.now().strftime("%Y-%m-%d")

        try:
            config = nautobot_service._get_config()
            if not config["url"] or not config["token"]:
                logger.error("Nautobot URL and token must be configured")
                return False

            base_url = config["url"].rstrip("/")
            headers = {
                "Authorization": "Token %s" % config["token"],
                "Content-Type": "application/json",
            }

            response = requests.get(
                "%s/api/ipam/ip-addresses/" % base_url,
                headers=headers,
                params={"address": ip_address},
            )
            response.raise_for_status()

            results = response.json().get("results", [])

            if results:
                ip_id = results[0].get("id")
                update_data = {"custom_fields": {response_custom_field_name: current_date}}

                if set_active:
                    status_response = requests.get(
                        "%s/api/extras/statuses/" % base_url,
                        headers=headers,
                        params={"name": "Active"},
                    )
                    status_response.raise_for_status()
                    statuses = status_response.json().get("results", [])
                    if statuses:
                        status_id = statuses[0].get("id")
                        update_data["status"] = status_id

                response = requests.patch(
                    "%s/api/ipam/ip-addresses/%s/" % (base_url, ip_id),
                    headers=headers,
                    json=update_data,
                )

                if not response.ok:
                    logger.error(
                        "Failed to update IP %s. Status: %s, Response: %s",
                        ip_address,
                        response.status_code,
                        response.text,
                    )

                response.raise_for_status()

                log_msg = "Updated IP %s - %s=%s" % (
                    ip_address,
                    response_custom_field_name,
                    current_date,
                )
                if set_active:
                    log_msg += ", status=Active"
                logger.info(log_msg)
                return True

            else:
                response = requests.get(
                    "%s/api/ipam/prefixes/" % base_url,
                    headers=headers,
                    params={"contains": ip_address},
                )
                response.raise_for_status()

                prefixes = response.json().get("results", [])

                if not prefixes:
                    logger.error("No parent prefix found for IP %s in Nautobot", ip_address)
                    return False

                def get_prefix_len(p):
                    try:
                        return int(p.get("prefix", "").split("/")[1])
                    except (ValueError, IndexError, AttributeError):
                        return 0

                prefixes.sort(key=get_prefix_len, reverse=True)

                best_prefix = prefixes[0]
                prefix_id = best_prefix.get("id")

                response = requests.get(
                    "%s/api/extras/statuses/" % base_url,
                    headers=headers,
                    params={"name": "Active"},
                )
                response.raise_for_status()

                statuses = response.json().get("results", [])
                if not statuses:
                    logger.error("Active status not found in Nautobot")
                    return False

                status_id = statuses[0].get("id")

                parent_prefix_cidr = best_prefix.get("prefix", "")
                prefix_length = parent_prefix_cidr.split("/")[1] if "/" in parent_prefix_cidr else "32"

                ip_with_netmask = "%s/%s" % (ip_address, prefix_length)

                create_data = {
                    "address": ip_with_netmask,
                    "status": {"id": status_id},
                    "parent": {"id": prefix_id},
                    "custom_fields": {response_custom_field_name: current_date},
                }

                if dns_name:
                    create_data["dns_name"] = dns_name

                response = requests.post(
                    "%s/api/ipam/ip-addresses/" % base_url,
                    headers=headers,
                    json=create_data,
                )

                if not response.ok:
                    logger.error(
                        "Failed to create IP %s. Status: %s, Response: %s",
                        ip_address,
                        response.status_code,
                        response.text,
                    )

                response.raise_for_status()

                logger.info(
                    "Created IP %s - %s=%s, status=Active",
                    ip_address,
                    response_custom_field_name,
                    current_date,
                )
                return True

        except Exception as e:
            logger.error("Error processing IP %s in Nautobot: %s", ip_address, e, exc_info=True)
            return False

    def _update_prefix_last_scan(
        self,
        prefix_cidr: str,
    ) -> bool:
        """PATCH the last_scan custom field on a prefix."""
        import service_factory

        nautobot_service = service_factory.build_nautobot_service()

        current_date = datetime.now().strftime("%Y-%m-%d")

        try:
            config = nautobot_service._get_config()
            if not config["url"] or not config["token"]:
                logger.error("Nautobot URL and token must be configured")
                return False

            base_url = config["url"].rstrip("/")
            headers = {
                "Authorization": "Token %s" % config["token"],
                "Content-Type": "application/json",
            }

            response = requests.get(
                "%s/api/ipam/prefixes/" % base_url,
                headers=headers,
                params={"prefix": prefix_cidr},
            )
            response.raise_for_status()

            prefixes = response.json().get("results", [])
            if not prefixes:
                logger.debug("Prefix %s not found, searching by containment", prefix_cidr)
                network_addr = prefix_cidr.split("/")[0]
                response = requests.get(
                    "%s/api/ipam/prefixes/" % base_url,
                    headers=headers,
                    params={"contains": network_addr},
                )
                response.raise_for_status()
                prefixes = response.json().get("results", [])

                if not prefixes:
                    logger.warning("No parent prefix found for %s", prefix_cidr)
                    return False

                def get_prefix_len(p):
                    try:
                        return int(p.get("prefix", "").split("/")[1])
                    except (ValueError, IndexError, AttributeError):
                        return 0

                prefixes.sort(key=get_prefix_len, reverse=True)

            best_prefix = prefixes[0]
            prefix_id = best_prefix.get("id")
            logger.debug(
                "Updating last_scan for prefix: %s (ID: %s)",
                best_prefix.get("prefix"),
                prefix_id,
            )

            update_data = {"custom_fields": {"last_scan": current_date}}

            response = requests.patch(
                "%s/api/ipam/prefixes/%s/" % (base_url, prefix_id),
                headers=headers,
                json=update_data,
            )
            response.raise_for_status()
            return True

        except Exception as e:
            logger.error("Error updating prefix %s: %s", prefix_cidr, e, exc_info=True)
            return False
