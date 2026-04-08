"""
Set Primary IP executor.
Sets the primary IP address for devices based on reachability or interface name.

Strategies:
  - ip_reachable: Pings all IPs of each device via a Cockpit Agent.
    If exactly 1 IP is reachable, sets it as the primary IP in Nautobot.
    Multiple reachable IPs → skipped (ambiguous).
    No reachable IPs → unreachable.

  - interface_name: Not yet implemented. Returns a scaffold response.
"""

import asyncio
import json
import logging
import time
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# GraphQL query that returns IPs with their Nautobot UUIDs
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


def execute_set_primary_ip(
    schedule_id: Optional[int],
    credential_id: Optional[int],
    job_parameters: Optional[dict],
    target_devices: Optional[list],
    task_context,
    template: Optional[dict] = None,
    job_run_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Execute set_primary_ip job.

    Reads from template:
      - set_primary_ip_strategy: "ip_reachable" or "interface_name"
      - set_primary_ip_agent_id: cockpit agent ID (required for ip_reachable)
      - inventory_name: name of the saved inventory to resolve devices from
      - inventory_source: must be "inventory"

    Returns:
        dict with success, strategy, per-device results, and summary counts.
    """
    params = job_parameters or {}
    tmpl = template or {}

    strategy = params.get("set_primary_ip_strategy") or tmpl.get(
        "set_primary_ip_strategy"
    )
    if not strategy:
        return {"success": False, "error": "No set_primary_ip_strategy provided"}

    if strategy == "interface_name":
        return _execute_interface_name_scaffold()

    if strategy == "ip_reachable":
        return _execute_ip_reachable(params, tmpl, job_run_id)

    return {"success": False, "error": f"Unknown strategy: {strategy}"}


def _execute_interface_name_scaffold() -> Dict[str, Any]:
    """Scaffold response for the interface_name strategy (not yet implemented)."""
    return {
        "success": True,
        "status": "completed",
        "strategy": "interface_name",
        "note": "Interface Name strategy is not yet implemented.",
        "total_devices": 0,
        "assigned_count": 0,
        "skipped_count": 0,
        "unreachable_count": 0,
        "failed_count": 0,
        "execution_time_ms": 0,
        "results": [],
    }


def _execute_ip_reachable(
    params: dict,
    tmpl: dict,
    job_run_id: Optional[int],
) -> Dict[str, Any]:
    """
    Execute the ip_reachable strategy:
    1. Resolve devices from inventory.
    2. For each device query Nautobot for IPs with UUIDs.
    3. Ping all IPs via the selected Cockpit Agent.
    4. For each device with exactly 1 reachable IP, set it as primary in Nautobot.
    """
    agent_id = params.get("set_primary_ip_agent_id") or tmpl.get(
        "set_primary_ip_agent_id"
    )
    if not agent_id:
        return {"success": False, "error": "No set_primary_ip_agent_id provided"}

    start_ms = int(time.time() * 1000)

    # Resolve devices from inventory
    inventory_name: Optional[str] = params.get("inventory_name") or tmpl.get(
        "inventory_name"
    )
    inventory_id: Optional[int] = params.get("inventory_id")

    if (
        not inventory_id
        and inventory_name
        and tmpl.get("inventory_source") == "inventory"
    ):
        import service_factory

        persistence_service = service_factory.build_inventory_persistence_service()
        inv = persistence_service.get_inventory_by_name(
            inventory_name, "celery_scheduler"
        )
        if inv:
            inventory_id = inv.get("id")
            logger.info(
                "Resolved inventory '%s' to ID %s", inventory_name, inventory_id
            )

    if not inventory_id:
        return {
            "success": False,
            "error": "No inventory resolved — inventory_id or inventory_name required",
        }

    try:
        # device_records: List[{device_name, device_id, ip_objects: [{id, address}]}]
        device_records = asyncio.run(_resolve_devices_with_ip_ids(inventory_id))
    except Exception as exc:
        logger.error(
            "Failed to resolve inventory %s: %s", inventory_id, exc, exc_info=True
        )
        return {"success": False, "error": f"Failed to resolve inventory: {exc}"}

    if not device_records:
        return {"success": False, "error": "No devices found in inventory"}

    # Build the ip_addresses list as objects carrying both the address and its
    # Nautobot UUID.  The agent echoes the UUID back in each ip_result so we can
    # identify the exact IP object without any IP→UUID re-lookup (which would be
    # ambiguous when the same address exists in multiple namespaces).
    device_ping_list = [
        {
            "device_name": r["device_name"],
            "device_id": r["device_id"],
            "ip_addresses": [
                {"address": obj["address"].split("/")[0], "uuid": obj["id"]}
                for obj in r["ip_objects"]
            ],
        }
        for r in device_records
    ]

    logger.info(
        "Set Primary IP executor (ip_reachable): agent=%s, devices=%d, job_run_id=%s",
        agent_id,
        len(device_ping_list),
        job_run_id,
    )

    from core.database import SessionLocal
    from services.cockpit_agent_service import CockpitAgentService

    db = SessionLocal()
    try:
        cockpit_svc = CockpitAgentService(db)

        if not cockpit_svc.check_agent_online(agent_id):
            return {
                "success": False,
                "error": f"Agent '{agent_id}' is offline or not responding",
            }

        raw = cockpit_svc.send_ping(
            agent_id=agent_id,
            devices=device_ping_list,
            sent_by="celery_scheduler",
            timeout=600,  # 10 min — accommodates large inventories (hundreds of devices)
        )
    except Exception as exc:
        logger.error("Ping failed: %s", exc, exc_info=True)
        return {"success": False, "error": str(exc)}
    finally:
        db.close()

    if raw.get("status") == "timeout":
        return {"success": False, "error": "Ping timed out after 600 seconds"}
    if raw.get("status") == "error":
        return {"success": False, "error": raw.get("error", "Ping returned an error")}

    output = raw.get("output")
    if isinstance(output, str):
        try:
            output = json.loads(output)
        except json.JSONDecodeError:
            output = {}
    output = output or {}

    ping_results: List[dict] = output.get("results", [])

    # Process results and assign primary IPs
    results: List[dict] = []
    assigned_count = 0
    skipped_count = 0
    unreachable_count = 0
    failed_count = 0

    try:
        import service_factory

        nautobot_svc = service_factory.build_nautobot_service()
        from services.nautobot.devices.common import DeviceCommonService

        device_svc = DeviceCommonService(nautobot_svc)
    except Exception as exc:
        logger.error("Failed to initialize Nautobot service: %s", exc, exc_info=True)
        return {
            "success": False,
            "error": f"Failed to initialize Nautobot service: {exc}",
        }

    for ping_device in ping_results:
        device_name = ping_device.get("device_name", "")
        device_id = ping_device.get("device_id")
        ip_results = ping_device.get("ip_results", [])

        reachable_entries = [ip for ip in ip_results if ip.get("reachable")]
        reachable_ips = [ip["ip_address"] for ip in reachable_entries]

        if not reachable_entries:
            results.append(
                {
                    "device_name": device_name,
                    "device_id": device_id,
                    "status": "unreachable",
                    "primary_ip": None,
                    "reachable_ips": [],
                    "reason": None,
                }
            )
            unreachable_count += 1
            continue

        if len(reachable_entries) > 1:
            results.append(
                {
                    "device_name": device_name,
                    "device_id": device_id,
                    "status": "skipped",
                    "primary_ip": None,
                    "reachable_ips": reachable_ips,
                    "reason": f"Ambiguous: {len(reachable_entries)} IPs are reachable",
                }
            )
            skipped_count += 1
            continue

        # Exactly 1 reachable IP — UUID is carried directly in the ping result.
        reachable_entry = reachable_entries[0]
        reachable_ip = reachable_entry.get("ip_address", "")
        ip_uuid = reachable_entry.get("uuid")

        if not ip_uuid:
            results.append(
                {
                    "device_name": device_name,
                    "device_id": device_id,
                    "status": "failed",
                    "primary_ip": reachable_ip,
                    "reachable_ips": reachable_ips,
                    "reason": f"IP UUID not found for {reachable_ip}",
                }
            )
            failed_count += 1
            continue

        if not device_id:
            results.append(
                {
                    "device_name": device_name,
                    "device_id": None,
                    "status": "failed",
                    "primary_ip": reachable_ip,
                    "reachable_ips": reachable_ips,
                    "reason": "Device ID (Nautobot UUID) not available",
                }
            )
            failed_count += 1
            continue

        try:
            success = asyncio.run(
                device_svc.assign_primary_ip_to_device(device_id, ip_uuid)
            )
        except Exception as exc:
            logger.error(
                "Failed to assign primary IP for device '%s': %s", device_name, exc
            )
            success = False

        if success:
            results.append(
                {
                    "device_name": device_name,
                    "device_id": device_id,
                    "status": "assigned",
                    "primary_ip": reachable_ip,
                    "reachable_ips": reachable_ips,
                    "reason": None,
                }
            )
            assigned_count += 1
        else:
            results.append(
                {
                    "device_name": device_name,
                    "device_id": device_id,
                    "status": "failed",
                    "primary_ip": reachable_ip,
                    "reachable_ips": reachable_ips,
                    "reason": "Nautobot API call to assign primary IP failed",
                }
            )
            failed_count += 1

    execution_time_ms = int(time.time() * 1000) - start_ms

    return {
        "success": True,
        "status": "completed",
        "strategy": "ip_reachable",
        "total_devices": len(results),
        "assigned_count": assigned_count,
        "skipped_count": skipped_count,
        "unreachable_count": unreachable_count,
        "failed_count": failed_count,
        "execution_time_ms": execution_time_ms,
        "results": results,
    }


async def _resolve_devices_with_ip_ids(inventory_id: int) -> List[dict]:
    """
    Resolve devices from a saved inventory and return their IPs with Nautobot UUIDs.

    Returns:
        List of {device_name, device_id, ip_objects: [{id, address}]}
    """
    import service_factory
    from routers.cockpit_agent import _conditions_to_operations

    persistence_svc = service_factory.build_inventory_persistence_service()
    inventory_svc = service_factory.build_inventory_service()
    nautobot_svc = service_factory.build_nautobot_service()

    inventory = persistence_svc.get_inventory(inventory_id)
    if not inventory:
        raise ValueError(f"Inventory {inventory_id} not found")

    conditions = inventory.get("conditions", [])
    operations = _conditions_to_operations(conditions)
    devices, _ = await inventory_svc.preview_inventory(operations)

    device_records: List[dict] = []
    for device in devices:
        if not device.name:
            continue
        try:
            result = await nautobot_svc.graphql_query(
                _DEVICE_IPS_QUERY, {"name": device.name}
            )
            ip_objects = _extract_ip_objects(result, device.name)
        except Exception as exc:
            logger.warning("Failed to fetch IPs for device '%s': %s", device.name, exc)
            ip_objects = []

        device_records.append(
            {
                "device_name": device.name,
                "device_id": device.id,
                "ip_objects": ip_objects,
            }
        )

    return device_records


def _extract_ip_objects(graphql_result: dict, device_name: str) -> List[dict]:
    """Extract IP addresses with their Nautobot UUIDs from a GraphQL response."""
    ip_objects: List[dict] = []
    devices_data = graphql_result.get("data", {}).get("devices", [])
    for dev in devices_data:
        for iface in dev.get("interfaces", []):
            for assignment in iface.get("ip_address_assignments", []):
                ip_entry = assignment.get("ip_address", {})
                ip_id = ip_entry.get("id")
                address = ip_entry.get("address")
                if ip_id and address:
                    ip_objects.append({"id": ip_id, "address": address})
    return ip_objects
