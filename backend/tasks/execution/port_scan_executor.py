"""
Port Scan job executor.

Runs nmap port scans via a Cockpit nmap agent for scheduled and manual
port_scan job templates.
"""

import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


def execute_port_scan(
    schedule_id: Optional[int],
    credential_id: Optional[int],
    job_parameters: Optional[dict],
    target_devices: Optional[list],
    task_context,
    template: Optional[dict] = None,
    job_run_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Execute port_scan job from a saved template."""
    params = job_parameters or {}
    tmpl = template or {}

    if not tmpl:
        return {"success": False, "error": "No template provided for port_scan job"}

    target_source = params.get("port_scan_target_source") or tmpl.get(
        "port_scan_target_source", "cidr"
    )
    agent_id = params.get("port_scan_agent_id") or tmpl.get("port_scan_agent_id")
    ports = params.get("port_scan_ports") or tmpl.get("port_scan_ports")
    scan_type = params.get("port_scan_type") or tmpl.get("port_scan_type") or "connect"
    service_detection = params.get("port_scan_service_detection")
    if service_detection is None:
        service_detection = tmpl.get("port_scan_service_detection", False)
    timeout = params.get("port_scan_timeout") or tmpl.get("port_scan_timeout") or 300
    use_primary_ip_only = params.get("port_scan_use_primary_ip_only")
    if use_primary_ip_only is None:
        use_primary_ip_only = tmpl.get("port_scan_use_primary_ip_only", True)

    cidrs = params.get("port_scan_cidrs") or tmpl.get("port_scan_cidrs") or []
    inventory_name = params.get("inventory_name") or tmpl.get("inventory_name")

    executed_by = params.get("executed_by") or tmpl.get("created_by") or "admin"

    if not agent_id:
        return {
            "success": False,
            "error": "No port_scan_agent_id configured in template",
        }

    if target_source == "inventory":
        if not inventory_name:
            return {
                "success": False,
                "error": "inventory_name is required for inventory-based port scans",
            }
    elif not cidrs:
        return {
            "success": False,
            "error": "port_scan_cidrs is required for CIDR-based port scans",
        }

    logger.info(
        "Port scan executor: source=%s, agent=%s, schedule_id=%s, job_run_id=%s",
        target_source,
        agent_id,
        schedule_id,
        job_run_id,
    )

    try:
        from tasks.nmap_scan_network_task import run_nmap_port_scan

        return run_nmap_port_scan(
            target_source=target_source,
            cidrs=cidrs,
            inventory_name=inventory_name,
            agent_id=agent_id,
            executed_by=executed_by,
            use_primary_ip_only=bool(use_primary_ip_only),
            ports=ports,
            scan_type=scan_type,
            service_detection=bool(service_detection),
            timeout=int(timeout),
            task_context=task_context,
        )
    except Exception as exc:
        logger.error("Port scan executor failed: %s", exc, exc_info=True)
        return {"success": False, "error": str(exc)}
