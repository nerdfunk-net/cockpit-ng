"""
Ping Network Task for Celery
Pings CIDR networks and optionally resolves DNS names.
"""

from celery import shared_task
import logging
import time
import ipaddress
import subprocess
import tempfile
import os
import socket
from typing import List, Dict, Any, Set, Tuple

import job_run_manager

logger = logging.getLogger(__name__)


def _expand_cidr_to_ips(cidr: str) -> List[str]:
    """Convert CIDR notation to list of IP addresses."""
    try:
        network = ipaddress.ip_network(cidr, strict=False)

        # Safety check: enforce reasonable network sizes
        if network.prefixlen < 19:
            raise ValueError(f"Network too large: {cidr}. Minimum prefix length is /19")

        # Convert to list of IP strings
        if network.prefixlen == 32:
            # Single host
            return [str(network.network_address)]
        else:
            # Network range - get all hosts
            return [str(ip) for ip in network.hosts()]

    except Exception as e:
        raise ValueError(f"Invalid CIDR notation {cidr}: {e}")


def _is_valid_ip(ip_str: str) -> bool:
    """Validate if string is a valid IP address."""
    try:
        ipaddress.ip_address(ip_str)
        return True
    except ValueError:
        return False


def _fping_networks(
    ip_list: List[str],
    count: int = 3,
    timeout: int = 500,
    retry: int = 3,
    interval: int = 10
) -> Set[str]:
    """Use fping to ping multiple IP addresses efficiently using a temporary file.

    Args:
        ip_list: List of IP addresses to ping
        count: Number of pings per host (default: 3)
        timeout: Individual target timeout in ms (default: 500)
        retry: Number of retries (default: 3)
        interval: Interval between packets in ms (default: 10)
    """
    if not ip_list:
        return set()

    alive_ips: Set[str] = set()
    temp_file_path = None

    try:
        # Create temporary file with all IP addresses
        with tempfile.NamedTemporaryFile(
            mode='w', delete=False, suffix='.txt', prefix='fping_targets_'
        ) as temp_file:
            temp_file_path = temp_file.name
            for ip in ip_list:
                temp_file.write(f"{ip}\n")

        logger.info(f"Created temporary file {temp_file_path} with {len(ip_list)} IP addresses")

        # Build fping command with options
        cmd = [
            "fping",
            "-c", str(count),      # Number of pings per target
            "-t", str(timeout),    # Timeout in ms
            "-r", str(retry),      # Number of retries
            "-i", str(interval),   # Interval between packets in ms
        ]

        logger.info(f"Running fping command: {' '.join(cmd)} < {temp_file_path}")

        # Build full command with input redirection
        full_cmd = f"{' '.join(cmd)} < {temp_file_path}"

        # Use shell=True to support input redirection
        result = subprocess.run(
            full_cmd,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=60,  # Allow up to 60 seconds for network scanning
            text=True,
        )

        # Parse fping output
        # Format examples:
        # "8.8.8.8 is alive"
        # "8.8.8.8 : duplicate for [0], 64 bytes, 538 ms"
        # "100.113.172.23 is unreachable"

        # Process both stdout and stderr as fping can output to both
        all_output = ""
        if result.stdout:
            all_output += result.stdout
        if result.stderr:
            all_output += result.stderr

        if all_output:
            for line in all_output.strip().split("\n"):
                line = line.strip()
                if not line:
                    continue

                # Extract IP address from the beginning of the line
                parts = line.split()
                if len(parts) >= 3:
                    ip = parts[0]
                    status_indicator = parts[1] + " " + parts[2]  # "is alive" or "is unreachable"

                    if _is_valid_ip(ip):
                        if "is alive" in status_indicator:
                            alive_ips.add(ip)
                        # We ignore "is unreachable" and other statuses (like duplicates)

        logger.info(f"fping discovered {len(alive_ips)} alive hosts out of {len(ip_list)} targets")

    except subprocess.TimeoutExpired:
        logger.warning("fping command timed out")
    except FileNotFoundError:
        logger.error("fping command not found. Please install fping")
    except Exception as e:
        logger.error(f"fping command failed: {e}")
    finally:
        # Clean up temporary file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
                logger.debug(f"Cleaned up temporary file {temp_file_path}")
            except Exception as e:
                logger.warning(f"Failed to clean up temporary file {temp_file_path}: {e}")

    return alive_ips


def _resolve_dns(ip: str) -> str:
    """Resolve DNS name for an IP address."""
    try:
        hostname, _, _ = socket.gethostbyaddr(ip)
        return hostname
    except (socket.herror, socket.gaierror, socket.timeout):
        return ""
    except Exception as e:
        logger.debug(f"DNS resolution failed for {ip}: {e}")
        return ""


def _condense_ip_ranges(ips: List[str]) -> List[str]:
    """
    Condense consecutive IP addresses into ranges.
    Example: ['192.168.1.10', '192.168.1.11', '192.168.1.12'] -> ['192.168.1.10 - 12']
    """
    if not ips:
        return []

    # Sort IPs
    sorted_ips = sorted(ips, key=lambda x: ipaddress.ip_address(x))

    condensed = []
    range_start = None
    range_end = None
    prev_ip_obj = None

    for ip_str in sorted_ips:
        ip_obj = ipaddress.ip_address(ip_str)

        if prev_ip_obj is None:
            # First IP in range
            range_start = ip_str
            range_end = ip_str
        elif int(ip_obj) == int(prev_ip_obj) + 1:
            # Consecutive IP - extend range
            range_end = ip_str
        else:
            # Gap detected - save previous range and start new one
            if range_start == range_end:
                condensed.append(range_start)
            else:
                # Extract last octet for condensed format
                start_parts = range_start.split('.')
                end_parts = range_end.split('.')
                if start_parts[:3] == end_parts[:3]:
                    condensed.append(f"{range_start} - {end_parts[3]}")
                else:
                    condensed.append(f"{range_start} - {range_end}")

            range_start = ip_str
            range_end = ip_str

        prev_ip_obj = ip_obj

    # Add final range
    if range_start == range_end:
        condensed.append(range_start)
    else:
        start_parts = range_start.split('.')
        end_parts = range_end.split('.')
        if start_parts[:3] == end_parts[:3]:
            condensed.append(f"{range_start} - {end_parts[3]}")
        else:
            condensed.append(f"{range_start} - {range_end}")

    return condensed


@shared_task(bind=True, name="tasks.ping_network_task")
def ping_network_task(
    self,
    cidrs: List[str],
    resolve_dns: bool = False,
    executed_by: str = "unknown",
    count: int = 3,
    timeout: int = 500,
    retry: int = 3,
    interval: int = 10
) -> Dict[str, Any]:
    """
    Ping network CIDR ranges and optionally resolve DNS names.

    Args:
        self: Task instance (for updating state)
        cidrs: List of CIDR networks to ping (e.g., ['192.168.1.0/24'])
        resolve_dns: Whether to resolve DNS names for reachable IPs
        executed_by: Username who triggered the task
        count: Number of pings per host (default: 3)
        timeout: Individual target timeout in ms (default: 500)
        retry: Number of retries (default: 3)
        interval: Interval between packets in ms (default: 10)

    Returns:
        dict: Results with reachable/unreachable IPs per network
    """
    job_run_id = None

    try:
        # Create job run record
        job_run = job_run_manager.create_job_run(
            job_name=f"Ping Network ({len(cidrs)} network(s))",
            job_type="ping_network",
            triggered_by="manual",
            executed_by=executed_by,
            target_devices=None,  # No devices, just networks
        )
        job_run_id = job_run["id"]

        # Mark job as started
        job_run_manager.mark_started(job_run_id, self.request.id)

        logger.info(f"Ping network task started: {len(cidrs)} networks, resolve_dns={resolve_dns}")

        # Expand all CIDRs to IP lists
        all_ips: List[str] = []
        network_ips: Dict[str, List[str]] = {}

        self.update_state(
            state='PROGRESS',
            meta={
                'status': 'Expanding CIDR networks...',
                'current': 0,
                'total': len(cidrs),
                'networks_processed': 0,
            }
        )

        for idx, cidr in enumerate(cidrs):
            try:
                cidr_ips = _expand_cidr_to_ips(cidr)
                all_ips.extend(cidr_ips)
                network_ips[cidr] = cidr_ips
                logger.info(f"Expanded {cidr} to {len(cidr_ips)} IPs")
            except Exception as e:
                logger.error(f"Failed to expand CIDR {cidr}: {e}")
                network_ips[cidr] = []

        # Ping all IPs using fping
        self.update_state(
            state='PROGRESS',
            meta={
                'status': f'Pinging {len(all_ips)} IP addresses...',
                'current': 0,
                'total': len(all_ips),
                'networks_processed': 0,
            }
        )

        alive_ips = _fping_networks(all_ips, count, timeout, retry, interval)
        logger.info(f"fping found {len(alive_ips)} alive hosts out of {len(all_ips)} targets")

        # Process results per network
        network_results: List[Dict[str, Any]] = []

        for idx, (cidr, cidr_ips) in enumerate(network_ips.items()):
            self.update_state(
                state='PROGRESS',
                meta={
                    'status': f'Processing network {idx + 1}/{len(cidrs)}...',
                    'current': idx + 1,
                    'total': len(cidrs),
                    'networks_processed': idx,
                }
            )

            reachable: List[Dict[str, str]] = []
            unreachable: List[str] = []

            for ip in cidr_ips:
                if ip in alive_ips:
                    ip_data = {"ip": ip}
                    if resolve_dns:
                        hostname = _resolve_dns(ip)
                        if hostname:
                            ip_data["hostname"] = hostname
                    reachable.append(ip_data)
                else:
                    unreachable.append(ip)

            # Condense unreachable ranges
            unreachable_condensed = _condense_ip_ranges(unreachable)

            network_results.append({
                "network": cidr,
                "total_ips": len(cidr_ips),
                "reachable_count": len(reachable),
                "unreachable_count": len(unreachable),
                "reachable": reachable,
                "unreachable": unreachable_condensed,
            })

        result = {
            "success": True,
            "networks": network_results,
            "total_networks": len(cidrs),
            "total_ips_scanned": len(all_ips),
            "total_reachable": len(alive_ips),
            "total_unreachable": len(all_ips) - len(alive_ips),
            "resolve_dns": resolve_dns,
        }

        # Mark job as completed
        job_run_manager.mark_completed(
            job_run_id,
            result=result
        )

        logger.info(f"Ping network task completed: {len(alive_ips)}/{len(all_ips)} reachable")
        return result

    except Exception as e:
        logger.error(f"Ping network task failed: {e}", exc_info=True)

        # Mark job as failed
        if job_run_id:
            job_run_manager.mark_failed(
                job_run_id,
                error_message=str(e)
            )

        return {
            "success": False,
            "error": str(e),
            "networks": [],
        }
