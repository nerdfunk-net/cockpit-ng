"""
API Router for Cockpit Agent management
"""

import json
import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.auth import verify_token, require_permission
from core.database import get_db
from dependencies import get_nautobot_service, get_inventory_persistence_service, get_inventory_service
from models.cockpit_agent import (
    AgentListResponse,
    AgentStatusResponse,
    CommandRequest,
    CommandResponse,
    CommandHistoryResponse,
    CommandHistoryItem,
    PingRequest,
    PingResponse,
    PingOutput,
    PingDeviceResult,
    PingIpResult,
)
from models.inventory import LogicalOperation
from services.cockpit_agent_service import CockpitAgentService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/cockpit-agent",
    tags=["cockpit-agent"],
    responses={404: {"description": "Not found"}},
)


@router.post(
    "/command",
    response_model=CommandResponse,
    dependencies=[Depends(require_permission("cockpit_agents", "execute"))],
)
async def send_command(
    request: CommandRequest,
    user: dict = Depends(verify_token),
    db: Session = Depends(get_db),
):
    """
    Send command to Grafana Agent
    Does not wait for response - use this for fire-and-forget commands
    """
    try:
        service = CockpitAgentService(db)

        # Check if agent is online
        if not service.check_agent_online(request.agent_id):
            raise HTTPException(
                status_code=503,
                detail="Agent is offline or not responding",
            )

        # Send command (no wait)
        command_id = service.send_command(
            agent_id=request.agent_id,
            command=request.command,
            params=request.params,
            sent_by=user.get("sub", "system"),
        )

        return {
            "command_id": command_id,
            "status": "pending",
            "output": None,
            "error": None,
            "execution_time_ms": 0,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to send command: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/{agent_id}/git-pull",
    response_model=CommandResponse,
    dependencies=[Depends(require_permission("cockpit_agents", "execute"))],
)
async def git_pull(
    agent_id: str,
    user: dict = Depends(verify_token),
    db: Session = Depends(get_db),
):
    """
    Send git pull command and wait for response (30s timeout)
    Uses repository path and branch configured locally on agent via .env
    """
    try:
        service = CockpitAgentService(db)

        response = service.send_git_pull(
            agent_id=agent_id,
            repository_path="",
            branch="",
            sent_by=user.get("sub", "system"),
            timeout=30,
        )

        if response["status"] == "error":
            raise HTTPException(status_code=500, detail=response.get("error"))

        if response["status"] == "timeout":
            raise HTTPException(status_code=504, detail=response.get("error"))

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Git pull failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/{agent_id}/docker-restart",
    response_model=CommandResponse,
    dependencies=[Depends(require_permission("cockpit_agents", "execute"))],
)
async def docker_restart(
    agent_id: str,
    user: dict = Depends(verify_token),
    db: Session = Depends(get_db),
):
    """
    Send docker restart command and wait for response (60s timeout)
    Container name is configured in agent's .env file
    """
    try:
        service = CockpitAgentService(db)

        response = service.send_docker_restart(
            agent_id=agent_id,
            sent_by=user.get("sub", "system"),
            timeout=60,
        )

        if response["status"] == "error":
            raise HTTPException(status_code=500, detail=response.get("error"))

        if response["status"] == "timeout":
            raise HTTPException(status_code=504, detail=response.get("error"))

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Docker restart failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


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


@router.post(
    "/{agent_id}/ping",
    response_model=PingResponse,
    dependencies=[Depends(require_permission("cockpit_agents", "execute"))],
)
async def ping_devices(
    agent_id: str,
    request: PingRequest,
    user: dict = Depends(verify_token),
    db: Session = Depends(get_db),
    nautobot=Depends(get_nautobot_service),
    inventory_persistence=Depends(get_inventory_persistence_service),
    inventory_svc=Depends(get_inventory_service),
):
    """
    Resolve devices from a saved inventory, fetch their IP addresses from Nautobot,
    then send a ping command to the specified agent and return the results.
    """
    try:
        # 1. Load the saved inventory
        inventory = inventory_persistence.get_inventory(request.inventory_id)
        if not inventory:
            raise HTTPException(status_code=404, detail=f"Inventory {request.inventory_id} not found")

        # 2. Resolve devices from inventory conditions
        # Conditions are stored as [{version: 2, tree: <ConditionTree>}] (new format)
        # or as [{operation_type, conditions, nested_operations}] (legacy format).
        conditions = inventory.get("conditions", [])
        operations = _conditions_to_operations(conditions)
        devices, _ = await inventory_svc.preview_inventory(operations)

        if not devices:
            raise HTTPException(status_code=400, detail="No devices found in inventory")

        logger.info("Resolved %d devices from inventory %d", len(devices), request.inventory_id)

        # 3. For each device, query Nautobot GraphQL to get interface IP addresses
        device_ping_list: List[dict] = []
        for device in devices:
            if not device.name:
                continue
            try:
                result = await nautobot.graphql_query(_DEVICE_IPS_QUERY, {"name": device.name})
                ip_addresses = _extract_ip_addresses(result, device.name)
            except Exception as exc:
                logger.warning("Failed to fetch IPs for device '%s': %s", device.name, exc)
                ip_addresses = []

            device_ping_list.append({
                "device_name": device.name,
                "device_id": device.id,
                "ip_addresses": ip_addresses,
            })

        if not device_ping_list:
            raise HTTPException(status_code=400, detail="No devices with names found in inventory")

        # 4. Send ping command to agent and wait for response (up to 120 s)
        service = CockpitAgentService(db)
        raw = service.send_ping(
            agent_id=agent_id,
            devices=device_ping_list,
            sent_by=user.get("sub", "system"),
            timeout=120,
        )

        if raw.get("status") == "error":
            raise HTTPException(status_code=500, detail=raw.get("error"))
        if raw.get("status") == "timeout":
            raise HTTPException(status_code=504, detail=raw.get("error"))

        # 5. Parse the nested output dict into the PingOutput model
        raw_output = raw.get("output")
        if isinstance(raw_output, str):
            try:
                raw_output = json.loads(raw_output)
            except json.JSONDecodeError:
                raw_output = None

        ping_output: PingOutput | None = None
        if isinstance(raw_output, dict):
            ping_output = PingOutput(
                results=[
                    PingDeviceResult(
                        device_name=d["device_name"],
                        device_id=d.get("device_id"),
                        ip_results=[
                            PingIpResult(
                                ip_address=r["ip_address"],
                                reachable=r["reachable"],
                                latency_ms=r.get("latency_ms"),
                                packet_loss_percent=r.get("packet_loss_percent", 100),
                            )
                            for r in d.get("ip_results", [])
                        ],
                    )
                    for d in raw_output.get("results", [])
                ],
                total_devices=raw_output.get("total_devices", 0),
                reachable_count=raw_output.get("reachable_count", 0),
                unreachable_count=raw_output.get("unreachable_count", 0),
            )

        return PingResponse(
            command_id=raw.get("command_id", ""),
            status=raw.get("status", "success"),
            output=ping_output,
            error=raw.get("error"),
            execution_time_ms=raw.get("execution_time_ms", 0),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Ping failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


def _conditions_to_operations(conditions: list) -> List[LogicalOperation]:
    """
    Convert stored inventory conditions to LogicalOperation list.

    Supports two formats:
      • Version 2 tree: [{version: 2, tree: <ConditionTree>}]
      • Legacy flat:    [{operation_type, conditions, nested_operations}]
    """
    operations: List[LogicalOperation] = []
    for entry in conditions:
        if not isinstance(entry, dict):
            continue
        if entry.get("version") == 2 and "tree" in entry:
            operations.extend(_tree_to_operations(entry["tree"]))
        elif "operation_type" in entry:
            try:
                operations.append(LogicalOperation(**entry))
            except Exception as exc:
                logger.warning("Skipping malformed legacy condition: %s", exc)
    return operations


def _convert_tree_item(item: dict) -> LogicalOperation:
    """Convert a single ConditionItem or ConditionGroup to LogicalOperation."""
    from models.inventory import LogicalCondition as LC

    if item.get("type") == "group":
        group_conditions: List[LC] = []
        nested: List[LogicalOperation] = []
        for sub in item.get("items", []):
            if sub.get("type") == "group":
                converted_sub = _convert_tree_item(sub)
                if sub.get("logic") == "NOT":
                    converted_sub.operation_type = "NOT"
                nested.append(converted_sub)
            else:
                group_conditions.append(LC(
                    field=sub["field"],
                    operator=sub["operator"],
                    value=sub.get("value", ""),
                ))
        return LogicalOperation(
            operation_type=item.get("internalLogic", "AND"),
            conditions=group_conditions,
            nested_operations=nested,
        )
    else:
        return LogicalOperation(
            operation_type="AND",
            conditions=[LC(
                field=item["field"],
                operator=item["operator"],
                value=item.get("value", ""),
            )],
            nested_operations=[],
        )


def _tree_to_operations(tree: dict) -> List[LogicalOperation]:
    """
    Port of the frontend buildOperationsFromTree() function.
    Converts a ConditionTree dict to a list of LogicalOperation.
    """
    items = tree.get("items", [])
    if not items:
        return []

    internal_logic = tree.get("internalLogic", "AND")
    regular: List[LogicalOperation] = []
    not_ops: List[LogicalOperation] = []

    for item in items:
        converted = _convert_tree_item(item)
        if item.get("type") == "group" and item.get("logic") == "NOT":
            converted.operation_type = "NOT"
            not_ops.append(converted)
        else:
            regular.append(converted)

    operations: List[LogicalOperation] = []

    if regular:
        if len(regular) == 1:
            operations.append(regular[0])
        else:
            root_conditions = []
            nested_ops = []
            for op in regular:
                if len(op.conditions) > 1 or len(op.nested_operations) > 0:
                    nested_ops.append(op)
                elif len(op.conditions) == 1:
                    root_conditions.extend(op.conditions)
            operations.append(LogicalOperation(
                operation_type=internal_logic,
                conditions=root_conditions,
                nested_operations=nested_ops,
            ))

    operations.extend(not_ops)
    return operations


def _extract_ip_addresses(graphql_result: dict, device_name: str) -> List[str]:
    """Extract all interface IP addresses for a device from a GraphQL response."""
    ip_addresses: List[str] = []
    devices_data = graphql_result.get("data", {}).get("devices", [])
    for dev in devices_data:
        for iface in dev.get("interfaces", []):
            for assignment in iface.get("ip_address_assignments", []):
                address = assignment.get("ip_address", {}).get("address")
                if address:
                    ip_addresses.append(address)
    return ip_addresses


@router.get(
    "/{agent_id}/status",
    response_model=AgentStatusResponse,
    dependencies=[Depends(require_permission("cockpit_agents", "read"))],
)
async def get_agent_status(
    agent_id: str,
    db: Session = Depends(get_db),
):
    """
    Get health status for specific agent
    """
    try:
        service = CockpitAgentService(db)
        status = service.get_agent_status(agent_id)

        if not status:
            raise HTTPException(
                status_code=404,
                detail=f"Agent {agent_id} not found",
            )

        return status

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get agent status: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/list",
    response_model=AgentListResponse,
    dependencies=[Depends(require_permission("cockpit_agents", "read"))],
)
async def list_agents(
    db: Session = Depends(get_db),
):
    """
    List all registered Grafana Agents
    """
    try:
        service = CockpitAgentService(db)
        agents = service.list_agents()

        return {"agents": agents}

    except Exception as e:
        logger.error("Failed to list agents: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/{agent_id}/history",
    response_model=CommandHistoryResponse,
    dependencies=[Depends(require_permission("cockpit_agents", "read"))],
)
async def get_command_history(
    agent_id: str,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """
    Get command history for specific agent
    """
    try:
        service = CockpitAgentService(db)
        commands = service.get_command_history(agent_id, limit)
        total = service.repository.count_commands(agent_id)

        return {
            "commands": [CommandHistoryItem.from_orm(cmd) for cmd in commands],
            "total": total,
        }

    except Exception as e:
        logger.error("Failed to get command history: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/history/all",
    response_model=CommandHistoryResponse,
    dependencies=[Depends(require_permission("cockpit_agents", "read"))],
)
async def get_all_command_history(
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """
    Get command history for all agents
    """
    try:
        service = CockpitAgentService(db)
        commands = service.get_all_command_history(limit)
        total = service.repository.count_commands()

        return {
            "commands": [CommandHistoryItem.from_orm(cmd) for cmd in commands],
            "total": total,
        }

    except Exception as e:
        logger.error("Failed to get command history: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
