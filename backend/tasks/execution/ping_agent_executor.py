"""
Ping Agent executor.
Sends a ping command to a Cockpit Agent and waits for the results.

Supports two invocation patterns:
  • Ad-hoc (from API): devices are pre-resolved and passed in job_parameters
  • Scheduled template (future): inventory_id is resolved at execution time via asyncio.run()

For the future Job Template support, add a `ping_agent_id` column to the
job_templates table and the executor will read it from `template.get("ping_agent_id")`.
"""

import asyncio
import json
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


def execute_ping_agent(
    schedule_id: Optional[int],
    credential_id: Optional[int],
    job_parameters: Optional[dict],
    target_devices: Optional[list],
    task_context,
    template: Optional[dict] = None,
    job_run_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Execute ping_agent job.

    Reads from job_parameters:
      - agent_id   : ID of the cockpit agent to ping through
      - devices    : pre-resolved list of {device_name, device_id, ip_addresses}
      - inventory_id: (fallback) resolve devices from saved inventory at execution time
      - sent_by    : username to record in command history

    For scheduled templates (future), agent_id may also be read from
    template.get("ping_agent_id").

    Returns:
        dict with success, output (reachable/unreachable counts + per-device results),
        command_id, and execution_time_ms.
    """
    params = job_parameters or {}
    tmpl = template or {}

    agent_id = params.get("agent_id") or tmpl.get("ping_agent_id")
    if not agent_id:
        return {"success": False, "error": "No agent_id provided in job_parameters"}

    devices: Optional[List[dict]] = params.get("devices")
    inventory_id: Optional[int] = params.get("inventory_id")
    sent_by: str = params.get("sent_by", "celery_scheduler")

    # Resolve devices from inventory when not pre-resolved (scheduled template path)
    if not devices and inventory_id:
        try:
            devices = asyncio.run(_resolve_devices_from_inventory(inventory_id))
        except Exception as exc:
            logger.error(
                "Failed to resolve inventory %s: %s", inventory_id, exc, exc_info=True
            )
            return {"success": False, "error": f"Failed to resolve inventory: {exc}"}

    if not devices:
        return {"success": False, "error": "No devices to ping"}

    logger.info(
        "Ping agent executor: agent=%s, devices=%d, job_run_id=%s",
        agent_id,
        len(devices),
        job_run_id,
    )

    from core.database import SessionLocal
    from services.cockpit_agent_service import CockpitAgentService

    db = SessionLocal()
    try:
        service = CockpitAgentService(db)

        if not service.check_agent_online(agent_id):
            return {
                "success": False,
                "error": f"Agent '{agent_id}' is offline or not responding",
            }

        raw = service.send_ping(
            agent_id=agent_id,
            devices=devices,
            sent_by=sent_by,
            timeout=120,
        )

        if raw.get("status") == "timeout":
            return {"success": False, "error": "Ping timed out after 120 seconds"}

        if raw.get("status") == "error":
            return {
                "success": False,
                "error": raw.get("error", "Ping returned an error"),
            }

        output = raw.get("output")
        if isinstance(output, str):
            try:
                output = json.loads(output)
            except json.JSONDecodeError:
                output = {}

        output = output or {}

        return {
            "success": True,
            "status": "completed",
            "command_id": raw.get("command_id", ""),
            "output": output,
            "total_devices": output.get("total_devices", 0),
            "reachable_count": output.get("reachable_count", 0),
            "unreachable_count": output.get("unreachable_count", 0),
            "execution_time_ms": raw.get("execution_time_ms", 0),
        }

    except Exception as exc:
        logger.error("Ping agent executor failed: %s", exc, exc_info=True)
        return {"success": False, "error": str(exc)}
    finally:
        db.close()


async def _resolve_devices_from_inventory(inventory_id: int) -> List[dict]:
    """
    Resolve devices and their IPs from a saved inventory.
    Used for scheduled template execution where devices are not pre-resolved.
    """
    import service_factory
    from routers.cockpit_agent import _conditions_to_operations, _extract_ip_addresses

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

    persistence_svc = service_factory.build_inventory_persistence_service()
    inventory_svc = service_factory.build_inventory_service()
    nautobot_svc = service_factory.build_nautobot_service()

    inventory = persistence_svc.get_inventory(inventory_id)
    if not inventory:
        raise ValueError(f"Inventory {inventory_id} not found")

    conditions = inventory.get("conditions", [])
    operations = _conditions_to_operations(conditions)
    devices, _ = await inventory_svc.preview_inventory(operations)

    device_ping_list: List[dict] = []
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

        device_ping_list.append(
            {
                "device_name": device.name,
                "device_id": device.id,
                "ip_addresses": ip_addresses,
            }
        )

    return device_ping_list
