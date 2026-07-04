"""
Celery task: expand CIDR networks or resolve saved inventories, find alive hosts
via fping, then nmap-scan each reachable IP through a configured Cockpit nmap agent.
"""

from __future__ import annotations

import asyncio
import ipaddress
import json
import logging
from typing import Any, Dict, List, Optional, Tuple

from celery import shared_task

import service_factory
from services.cockpit_agent.cockpit_agent_service import CockpitAgentService
from tasks.ping_network_task import _expand_cidr_to_ips, _fping_networks

logger = logging.getLogger(__name__)

_VALID_SCAN_TYPES = frozenset({"syn", "connect", "udp"})
_DEVICE_IPS_QUERY = """
query DeviceInterfaces($name: [String]) {
  devices(name: $name) {
    id
    name
    interfaces {
      ip_address_assignments {
        ip_address {
          id
          address
        }
      }
    }
  }
}
"""


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


def _normalize_ip_address(address: str) -> Optional[str]:
    """Return host IP without CIDR suffix, or None when invalid."""
    try:
        if "/" in address:
            return str(ipaddress.ip_interface(address).ip)
        return str(ipaddress.ip_address(address))
    except ValueError:
        return None


async def _resolve_inventory_to_ips(
    inventory_name: str, username: str
) -> Tuple[List[str], Dict[str, List[str]]]:
    """Resolve a saved inventory to unique host IP addresses."""
    from routers.cockpit_agent import _conditions_to_operations, _extract_ip_addresses

    persistence_svc = service_factory.build_inventory_persistence_service()
    inventory_svc = service_factory.build_inventory_service()
    nautobot_svc = service_factory.build_nautobot_service()

    inventory = persistence_svc.get_inventory_by_name(inventory_name, username)
    if not inventory:
        raise ValueError(f"Inventory '{inventory_name}' not found")

    conditions = inventory.get("conditions", [])
    operations = _conditions_to_operations(conditions)
    devices, _ = await inventory_svc.preview_inventory(operations)

    if not devices:
        raise ValueError(f"No devices found in inventory '{inventory_name}'")

    all_ips: List[str] = []
    seen: set[str] = set()

    for device in devices:
        if not device.name:
            continue
        try:
            result = await nautobot_svc.graphql_query(
                _DEVICE_IPS_QUERY, {"name": device.name}
            )
            ip_addresses = _extract_ip_addresses(result, device.name)
        except Exception as exc:
            logger.warning("Failed to fetch IPs for device '%s': %s", device.name, exc)
            ip_addresses = []

        for address in ip_addresses:
            normalized = _normalize_ip_address(address)
            if normalized and normalized not in seen:
                seen.add(normalized)
                all_ips.append(normalized)

    if not all_ips:
        raise ValueError(
            f"No IP addresses found for devices in inventory '{inventory_name}'"
        )

    return all_ips, {inventory_name: all_ips}


def _resolve_inventory_to_ips_sync(
    inventory_name: str, username: str
) -> Tuple[List[str], Dict[str, List[str]]]:
    return asyncio.run(_resolve_inventory_to_ips(inventory_name, username))


def _update_progress(task_context, meta: Dict[str, Any]) -> None:
    if task_context is not None and hasattr(task_context, "update_state"):
        task_context.update_state(state="PROGRESS", meta=meta)


def run_nmap_port_scan(
    *,
    target_source: str,
    cidrs: List[str],
    inventory_name: Optional[str],
    agent_id: str,
    executed_by: str,
    ports: Optional[str] = None,
    scan_type: str = "connect",
    service_detection: bool = False,
    timeout: int = 300,
    task_context=None,
) -> Dict[str, Any]:
    """Core nmap port scan logic shared by ad-hoc and scheduled jobs."""
    if scan_type not in _VALID_SCAN_TYPES:
        return {"success": False, "error": f"Invalid scan_type: {scan_type}"}

    if not _resolve_nmap_agent(agent_id):
        return {
            "success": False,
            "error": f"Agent '{agent_id}' is not configured as type 'nmap'",
        }

    from core.database import SessionLocal

    db = SessionLocal()
    try:
        agent_service = CockpitAgentService(db)
        if not agent_service.check_agent_online(agent_id):
            return {
                "success": False,
                "error": f"Agent '{agent_id}' is offline or not responding",
            }
    finally:
        db.close()

    all_ips: List[str] = []
    network_ips: Dict[str, List[str]] = {}
    resolved_cidrs = list(cidrs)

    if target_source == "inventory":
        if not inventory_name:
            return {
                "success": False,
                "error": "inventory_name is required when target_source is inventory",
            }

        _update_progress(
            task_context,
            {
                "status": f"Resolving inventory '{inventory_name}'...",
                "current": 0,
                "total": 1,
            },
        )

        try:
            all_ips, network_ips = _resolve_inventory_to_ips_sync(
                inventory_name, executed_by
            )
            resolved_cidrs = list(network_ips.keys())
        except Exception as exc:
            return {"success": False, "error": str(exc)}
    else:
        _update_progress(
            task_context,
            {
                "status": "Expanding CIDR networks...",
                "current": 0,
                "total": len(resolved_cidrs),
            },
        )

        for cidr in resolved_cidrs:
            try:
                cidr_ips = _expand_cidr_to_ips(cidr)
                all_ips.extend(cidr_ips)
                network_ips[cidr] = cidr_ips
            except Exception as exc:
                logger.error("Failed to expand CIDR %s: %s", cidr, exc)
                network_ips[cidr] = []

    _update_progress(
        task_context,
        {
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
        return {
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
            "total_networks": len(resolved_cidrs),
            "total_ips_scanned": len(all_ips),
            "total_reachable": 0,
            "total_hosts_scanned": 0,
            "total_open_tcp_ports": 0,
            "total_open_udp_ports": 0,
        }

    sorted_alive = sorted(alive_set)
    host_results: Dict[str, Dict[str, Any]] = {}
    total_tcp = 0
    total_udp = 0

    db = SessionLocal()
    try:
        agent_service = CockpitAgentService(db)
        for idx, ip in enumerate(sorted_alive):
            _update_progress(
                task_context,
                {
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

    return {
        "success": True,
        "agent_id": agent_id,
        "scan_type": scan_type,
        "ports": ports,
        "networks": network_results,
        "total_networks": len(resolved_cidrs),
        "total_ips_scanned": len(all_ips),
        "total_reachable": len(alive_set),
        "total_hosts_scanned": len(host_results),
        "total_open_tcp_ports": total_tcp,
        "total_open_udp_ports": total_udp,
    }


@shared_task(bind=True, name="tasks.nmap_scan_network_task")
def nmap_scan_network_task(
    self,
    cidrs: List[str],
    agent_id: str,
    executed_by: str = "unknown",
    *,
    target_source: str = "cidr",
    inventory_name: Optional[str] = None,
    ports: Optional[str] = None,
    scan_type: str = "connect",
    service_detection: bool = False,
    timeout: int = 300,
) -> Dict[str, Any]:
    job_run_id = None

    try:
        _jrs = service_factory.build_job_run_service()
        job_label = (
            f"inventory '{inventory_name}'"
            if target_source == "inventory" and inventory_name
            else f"{len(cidrs)} network(s)"
        )
        job_run = _jrs.create_job_run(
            job_name=f"Nmap Scan ({job_label})",
            job_type="nmap_scan_network",
            triggered_by="manual",
            executed_by=executed_by,
            target_devices=None,
        )
        job_run_id = job_run["id"]
        _jrs.mark_started(job_run_id, self.request.id)

        result = run_nmap_port_scan(
            target_source=target_source,
            cidrs=cidrs,
            inventory_name=inventory_name,
            agent_id=agent_id,
            executed_by=executed_by,
            ports=ports,
            scan_type=scan_type,
            service_detection=service_detection,
            timeout=timeout,
            task_context=self,
        )

        if result.get("success"):
            _jrs.mark_completed(job_run_id, result=result)
            logger.info(
                "Nmap scan task completed: %s hosts scanned, %s TCP / %s UDP open ports",
                result.get("total_hosts_scanned", 0),
                result.get("total_open_tcp_ports", 0),
                result.get("total_open_udp_ports", 0),
            )
        else:
            _jrs.mark_failed(
                job_run_id, error_message=result.get("error", "Scan failed")
            )

        return result

    except Exception as exc:
        logger.error("Nmap scan network task failed: %s", exc, exc_info=True)
        if job_run_id:
            _jrs = service_factory.build_job_run_service()
            _jrs.mark_failed(job_run_id, error_message=str(exc))
        return {"success": False, "error": str(exc), "networks": []}
