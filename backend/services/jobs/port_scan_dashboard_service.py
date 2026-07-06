"""
Port scan dashboard aggregation service.

Summarizes completed port_scan and nmap_scan_network job results for the dashboard.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Dict, Optional, Set

from repositories.jobs.job_run_repository import job_run_repository

logger = logging.getLogger(__name__)

PORT_SCAN_JOB_TYPES = ("port_scan", "nmap_scan_network")


def _is_port_scan_result(result: Any) -> bool:
    if not isinstance(result, dict):
        return False
    networks = result.get("networks")
    if not isinstance(networks, list):
        return False
    return (
        "agent_id" in result
        or "scan_type" in result
        or "total_open_tcp_ports" in result
    )


def _parse_result(raw_result: Any) -> Optional[Dict[str, Any]]:
    if not raw_result:
        return None
    if isinstance(raw_result, dict):
        return raw_result
    try:
        parsed = json.loads(raw_result)
    except (json.JSONDecodeError, TypeError) as exc:
        logger.warning("Failed to parse port scan job result: %s", exc)
        return None
    return parsed if isinstance(parsed, dict) else None


def _parse_completed_at(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None
    return None


class PortScanDashboardService:
    def get_port_scan_summary(self) -> Dict[str, Any]:
        runs = job_run_repository.get_all_by_types_and_statuses(
            job_types=list(PORT_SCAN_JOB_TYPES),
            statuses=["completed"],
        )

        if not runs:
            return {
                "has_data": False,
                "message": "No port scan jobs have been run yet",
            }

        total_runs = 0
        successful_runs = 0
        total_ips_scanned = 0
        total_reachable = 0
        total_hosts_scanned = 0
        total_open_tcp_ports = 0
        total_open_udp_ports = 0
        networks_seen: Set[str] = set()
        latest_completed_at: Optional[datetime] = None

        for run in runs:
            result = _parse_result(run.get("result"))
            if not result or not _is_port_scan_result(result):
                continue

            total_runs += 1
            if result.get("success", True):
                successful_runs += 1

            total_ips_scanned += int(result.get("total_ips_scanned") or 0)
            total_reachable += int(result.get("total_reachable") or 0)
            total_hosts_scanned += int(result.get("total_hosts_scanned") or 0)
            total_open_tcp_ports += int(result.get("total_open_tcp_ports") or 0)
            total_open_udp_ports += int(result.get("total_open_udp_ports") or 0)

            for network in result.get("networks", []):
                if isinstance(network, dict):
                    network_name = network.get("network")
                    if network_name:
                        networks_seen.add(str(network_name))

            completed_at = _parse_completed_at(run.get("completed_at"))
            if completed_at and (
                latest_completed_at is None or completed_at > latest_completed_at
            ):
                latest_completed_at = completed_at

        if total_runs == 0:
            return {
                "has_data": False,
                "message": "No valid port scan results found",
            }

        total_unreachable = max(total_ips_scanned - total_reachable, 0)
        reachability_percent = (
            round(total_reachable / total_ips_scanned * 100, 1)
            if total_ips_scanned > 0
            else 0.0
        )

        return {
            "has_data": True,
            "total_runs": total_runs,
            "successful_runs": successful_runs,
            "failed_runs": total_runs - successful_runs,
            "total_networks": len(networks_seen),
            "total_ips_scanned": total_ips_scanned,
            "total_reachable": total_reachable,
            "total_unreachable": total_unreachable,
            "total_hosts_scanned": total_hosts_scanned,
            "total_open_tcp_ports": total_open_tcp_ports,
            "total_open_udp_ports": total_open_udp_ports,
            "reachability_percent": reachability_percent,
            "latest_completed_at": latest_completed_at.isoformat()
            if latest_completed_at
            else None,
        }


_service = PortScanDashboardService()


def get_port_scan_dashboard_service() -> PortScanDashboardService:
    return _service
