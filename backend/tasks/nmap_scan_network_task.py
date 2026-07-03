"""
Celery task: expand CIDR networks, find alive hosts via fping, then nmap-scan
each reachable IP through a configured Cockpit nmap agent.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from celery import shared_task

import service_factory
from services.cockpit_agent.cockpit_agent_service import CockpitAgentService
from tasks.ping_network_task import _expand_cidr_to_ips, _fping_networks

logger = logging.getLogger(__name__)

_VALID_SCAN_TYPES = frozenset({"syn", "connect", "udp"})


def _resolve_nmap_agent(agent_id: str) -> Optional[str]:
    """Return agent_id when configured as type=nmap, else None."""
    from repositories.settings.settings_repository import AgentsSettingRepository

    repo = AgentsSettingRepository()
    settings = repo.get_settings()
    if not settings or not settings.agents:
        return None

    agents = settings.agents
    if isinstance(agents, str):
        try:
            agents = json.loads(agents)
        except json.JSONDecodeError:
            return None

    for agent in agents:
        if not isinstance(agent, dict):
            continue
        if agent.get("type") != "nmap":
            continue
        configured_id = agent.get("agent_id") or agent.get("id")
        if configured_id == agent_id:
            return agent_id
    return None


@shared_task(bind=True, name="tasks.nmap_scan_network_task")
def nmap_scan_network_task(
    self,
    cidrs: List[str],
    agent_id: str,
    executed_by: str = "unknown",
    *,
    ports: Optional[str] = None,
    scan_type: str = "connect",
    service_detection: bool = False,
    timeout: int = 300,
) -> Dict[str, Any]:
    job_run_id = None

    try:
        if scan_type not in _VALID_SCAN_TYPES:
            return {"success": False, "error": f"Invalid scan_type: {scan_type}"}

        if not _resolve_nmap_agent(agent_id):
            return {
                "success": False,
                "error": f"Agent '{agent_id}' is not configured as type 'nmap'",
            }

        _jrs = service_factory.build_job_run_service()
        job_run = _jrs.create_job_run(
            job_name=f"Nmap Scan ({len(cidrs)} network(s))",
            job_type="nmap_scan_network",
            triggered_by="manual",
            executed_by=executed_by,
            target_devices=None,
        )
        job_run_id = job_run["id"]
        _jrs.mark_started(job_run_id, self.request.id)

        # Import inside the task so Celery worker_process_init can rebind
        # core.database.SessionLocal after fork (module-level imports go stale).
        from core.database import SessionLocal

        db = SessionLocal()
        try:
            agent_service = CockpitAgentService(db)
            if not agent_service.check_agent_online(agent_id):
                result = {
                    "success": False,
                    "error": f"Agent '{agent_id}' is offline or not responding",
                }
                _jrs.mark_failed(job_run_id, error_message=result["error"])
                return result
        finally:
            db.close()

        all_ips: List[str] = []
        network_ips: Dict[str, List[str]] = {}

        self.update_state(
            state="PROGRESS",
            meta={
                "status": "Expanding CIDR networks...",
                "current": 0,
                "total": len(cidrs),
            },
        )

        for cidr in cidrs:
            try:
                cidr_ips = _expand_cidr_to_ips(cidr)
                all_ips.extend(cidr_ips)
                network_ips[cidr] = cidr_ips
            except Exception as exc:
                logger.error("Failed to expand CIDR %s: %s", cidr, exc)
                network_ips[cidr] = []

        self.update_state(
            state="PROGRESS",
            meta={
                "status": f"Pinging {len(all_ips)} IP addresses...",
                "current": 0,
                "total": len(all_ips),
            },
        )

        alive_ips = _fping_networks(all_ips)
        alive_set = set(alive_ips)
        logger.info(
            "fping found %s alive hosts out of %s targets",
            len(alive_set),
            len(all_ips),
        )

        if not alive_set:
            result = {
                "success": True,
                "agent_id": agent_id,
                "scan_type": scan_type,
                "ports": ports,
                "networks": [
                    {
                        "network": cidr,
                        "total_ips": len(cidr_ips),
                        "reachable_count": 0,
                        "hosts": [],
                    }
                    for cidr, cidr_ips in network_ips.items()
                ],
                "total_networks": len(cidrs),
                "total_ips_scanned": len(all_ips),
                "total_reachable": 0,
                "total_hosts_scanned": 0,
                "total_open_tcp_ports": 0,
                "total_open_udp_ports": 0,
            }
            _jrs.mark_completed(job_run_id, result=result)
            return result

        sorted_alive = sorted(alive_set)
        host_results: Dict[str, Dict[str, Any]] = {}
        total_tcp = 0
        total_udp = 0

        from core.database import SessionLocal

        db = SessionLocal()
        try:
            agent_service = CockpitAgentService(db)
            for idx, ip in enumerate(sorted_alive):
                self.update_state(
                    state="PROGRESS",
                    meta={
                        "status": f"Scanning {ip} ({idx + 1}/{len(sorted_alive)})...",
                        "current": idx + 1,
                        "total": len(sorted_alive),
                    },
                )

                raw = agent_service.send_nmap_scan(
                    agent_id=agent_id,
                    ip_address=ip,
                    sent_by=executed_by,
                    ports=ports,
                    scan_type=scan_type,
                    service_detection=service_detection,
                    timeout=timeout,
                )

                if raw.get("status") != "success":
                    host_results[ip] = {
                        "ip_address": ip,
                        "success": False,
                        "error": raw.get("error") or "Scan failed",
                        "tcp_ports": [],
                        "udp_ports": [],
                    }
                    continue

                output = raw.get("output") or {}
                if isinstance(output, str):
                    try:
                        output = json.loads(output)
                    except json.JSONDecodeError:
                        output = {}

                tcp_ports = output.get("tcp_ports") or []
                udp_ports = output.get("udp_ports") or []
                total_tcp += len(tcp_ports)
                total_udp += len(udp_ports)

                host_results[ip] = {
                    "ip_address": output.get("ip_address") or ip,
                    "hostname": output.get("hostname") or ip,
                    "host_status": output.get("host_status", "unknown"),
                    "tcp_ports": tcp_ports,
                    "udp_ports": udp_ports,
                    "services": output.get("services") or [],
                    "scan_arguments": output.get("scan_arguments", ""),
                    "success": True,
                    "error": None,
                }
        finally:
            db.close()

        network_results: List[Dict[str, Any]] = []
        for cidr, cidr_ips in network_ips.items():
            hosts = [host_results[ip] for ip in cidr_ips if ip in host_results]
            network_results.append(
                {
                    "network": cidr,
                    "total_ips": len(cidr_ips),
                    "reachable_count": sum(1 for ip in cidr_ips if ip in alive_set),
                    "hosts": hosts,
                }
            )

        result = {
            "success": True,
            "agent_id": agent_id,
            "scan_type": scan_type,
            "ports": ports,
            "networks": network_results,
            "total_networks": len(cidrs),
            "total_ips_scanned": len(all_ips),
            "total_reachable": len(alive_set),
            "total_hosts_scanned": len(host_results),
            "total_open_tcp_ports": total_tcp,
            "total_open_udp_ports": total_udp,
        }

        _jrs.mark_completed(job_run_id, result=result)
        logger.info(
            "Nmap scan task completed: %s hosts scanned, %s TCP / %s UDP open ports",
            len(host_results),
            total_tcp,
            total_udp,
        )
        return result

    except Exception as exc:
        logger.error("Nmap scan network task failed: %s", exc, exc_info=True)
        if job_run_id:
            _jrs = service_factory.build_job_run_service()
            _jrs.mark_failed(job_run_id, error_message=str(exc))
        return {"success": False, "error": str(exc), "networks": []}
