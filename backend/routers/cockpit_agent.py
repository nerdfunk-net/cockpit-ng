"""
API Router for Cockpit Agent management
"""

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.auth import require_permission, verify_token
from core.database import get_db
from core.safe_http_errors import raise_internal_server_error
from dependencies import (
    get_inventory_persistence_service,
    get_inventory_service,
    get_nautobot_service,
)
from models.cockpit_agent import (
    AgentListResponse,
    AgentStatusResponse,
    AnsibleGetFactsRequest,
    CommandHistoryItem,
    CommandHistoryResponse,
    CommandRequest,
    CommandResponse,
    NmapScanRequest,
    NmapScanResponse,
    OpenPortsScanRequest,
    PingJobResponse,
    PingRequest,
)
from models.inventory import LogicalOperation
from services.cockpit_agent.cockpit_agent_service import CockpitAgentService

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
def send_command(
    request: CommandRequest,
    user: dict = Depends(verify_token),
    db: Session = Depends(get_db),
):
    """
    Send command to Cockpit Agent.

    When **timeout** is omitted the endpoint returns immediately with
    ``status: pending``.  Set **timeout** (seconds) to block until the agent
    replies or the deadline expires.

    Declared as a sync route so the blocking Redis pub/sub wait runs in
    Starlette's thread pool instead of starving the asyncio event loop.
    """
    try:
        service = CockpitAgentService(db)

        # Check if agent is online
        if not service.check_agent_online(request.agent_id):
            raise HTTPException(
                status_code=503,
                detail="Agent is offline or not responding",
            )

        # Fire-and-forget: send only, no waiting
        if request.timeout is None:
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

        # Subscribe before sending to avoid the race where a fast agent
        # responds before the caller has started listening.
        response = service.send_command_and_wait(
            agent_id=request.agent_id,
            command=request.command,
            params=request.params,
            sent_by=user.get("sub", "system"),
            timeout=request.timeout,
        )

        if response.get("status") == "timeout":
            logger.warning(
                "Agent %s timed out: %s", request.agent_id, response.get("error")
            )
            raise HTTPException(
                status_code=504,
                detail="Agent did not respond within the timeout",
            )

        if response.get("status") == "error":
            error_msg = response.get("error") or "Agent returned an error"
            logger.error("Agent %s returned error: %s", request.agent_id, error_msg)
            raise HTTPException(status_code=422, detail=error_msg)

        return response

    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(logger, "Internal error", e)


@router.post(
    "/ansible/get-facts",
    response_model=CommandResponse,
    dependencies=[Depends(require_permission("cockpit_agents", "execute"))],
)
def ansible_get_facts(
    request: AnsibleGetFactsRequest,
    user: dict = Depends(verify_token),
    db: Session = Depends(get_db),
):
    """
    Gather Ansible facts from a target host using a cockpit Ansible agent.

    Credentials are resolved server-side — the frontend passes only a credential_id.
    Supports three auth modes:
      - SSH key (no passphrase): use_sshkey=True, ansible_user required, no credential_id
      - SSH key with passphrase: use_sshkey=True, credential_id set (password = passphrase)
      - Username/password:       use_sshkey=False, credential_id set

    Sync route — blocking Redis wait runs in Starlette's thread pool.
    """
    try:
        if (
            request.use_sshkey
            and request.credential_id is None
            and not request.ansible_user
        ):
            raise HTTPException(
                status_code=422,
                detail="ansible_user is required for SSH key auth without a credential",
            )

        service = CockpitAgentService(db)

        if not service.check_agent_online(request.agent_id):
            raise HTTPException(
                status_code=503,
                detail="Agent is offline or not responding",
            )

        response = service.send_ansible_get_facts(
            agent_id=request.agent_id,
            ip_address=request.ip_address,
            use_sshkey=request.use_sshkey,
            sent_by=user.get("sub", "system"),
            ansible_user=request.ansible_user,
            credential_id=request.credential_id,
            ansible_port=request.ansible_port,
            timeout=request.timeout,
        )

        if response.get("status") == "timeout":
            logger.warning(
                "Ansible agent %s timed out: %s",
                request.agent_id,
                response.get("error"),
            )
            raise HTTPException(
                status_code=504,
                detail="Agent did not respond within the timeout",
            )

        if response.get("status") == "error":
            error_msg = response.get("error") or "Agent returned an error"
            logger.error(
                "Ansible agent %s returned error: %s", request.agent_id, error_msg
            )
            raise HTTPException(status_code=422, detail=error_msg)

        return response

    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(logger, "Internal error", e)


@router.post(
    "/open-ports-scan",
    response_model=CommandResponse,
    dependencies=[Depends(require_permission("cockpit_agents", "execute"))],
)
def open_ports_scan(
    request: OpenPortsScanRequest,
    user: dict = Depends(verify_token),
    db: Session = Depends(get_db),
):
    """
    Scan open TCP/UDP ports on a target host using a cockpit Ansible agent.

    Credentials are resolved server-side — the frontend passes only a credential_id.
    Supports three auth modes:
      - SSH key (no passphrase): use_sshkey=True, ansible_user required, no credential_id
      - SSH key with passphrase: use_sshkey=True, credential_id set (password = passphrase)
      - Username/password:       use_sshkey=False, credential_id set

    Prefer POST /api/servers/{id}/refresh-open-ports for refreshing an existing
    server's open ports from the UI — this low-level endpoint remains for
    debugging and other ad-hoc callers (e.g. the add-server flow).

    Sync route — blocking Redis wait runs in Starlette's thread pool.
    """
    try:
        if (
            request.use_sshkey
            and request.credential_id is None
            and not request.ansible_user
        ):
            raise HTTPException(
                status_code=422,
                detail="ansible_user is required for SSH key auth without a credential",
            )

        service = CockpitAgentService(db)

        if not service.check_agent_online(request.agent_id):
            raise HTTPException(
                status_code=503,
                detail="Agent is offline or not responding",
            )

        response = service.send_open_ports_scan(
            agent_id=request.agent_id,
            ip_address=request.ip_address,
            use_sshkey=request.use_sshkey,
            sent_by=user.get("sub", "system"),
            ansible_user=request.ansible_user,
            credential_id=request.credential_id,
            ansible_port=request.ansible_port,
            timeout=request.timeout,
        )

        if response.get("status") == "timeout":
            logger.warning(
                "Ansible agent %s timed out: %s",
                request.agent_id,
                response.get("error"),
            )
            raise HTTPException(
                status_code=504,
                detail="Agent did not respond within the timeout",
            )

        if response.get("status") == "error":
            error_msg = response.get("error") or "Agent returned an error"
            logger.error(
                "Ansible agent %s returned error: %s", request.agent_id, error_msg
            )
            raise HTTPException(status_code=422, detail=error_msg)

        return response

    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(logger, "Internal error", e)


@router.post(
    "/nmap/scan-ports",
    response_model=NmapScanResponse,
    dependencies=[Depends(require_permission("cockpit_agents", "execute"))],
)
def nmap_scan_ports(
    request: NmapScanRequest,
    user: dict = Depends(verify_token),
    db: Session = Depends(get_db),
):
    """
    Scan open TCP/UDP ports on a target host using a Cockpit nmap agent.

    The agent runs nmap from its own network position — no SSH credentials are
    required. Use **Agents → Operating** in the UI for ad-hoc scans.

    Sync route — blocking Redis wait runs in Starlette's thread pool.
    """
    try:
        if request.scan_type is not None and request.scan_type not in (
            "syn",
            "connect",
            "udp",
        ):
            raise HTTPException(
                status_code=422,
                detail="scan_type must be syn, connect, or udp",
            )

        service = CockpitAgentService(db)

        if not service.check_agent_online(request.agent_id):
            raise HTTPException(
                status_code=503,
                detail="Agent is offline or not responding",
            )

        response = service.send_nmap_scan(
            agent_id=request.agent_id,
            ip_address=request.ip_address,
            sent_by=user.get("sub", "system"),
            ports=request.ports,
            scan_type=request.scan_type,
            service_detection=request.service_detection,
            timeout=request.timeout,
        )

        if response.get("status") == "timeout":
            logger.warning(
                "Nmap agent %s timed out: %s",
                request.agent_id,
                response.get("error"),
            )
            raise HTTPException(
                status_code=504,
                detail="Agent did not respond within the timeout",
            )

        if response.get("status") == "error":
            error_msg = response.get("error") or "Agent returned an error"
            logger.error(
                "Nmap agent %s returned error: %s", request.agent_id, error_msg
            )
            raise HTTPException(status_code=422, detail=error_msg)

        return response

    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(logger, "Internal error", e)


@router.post(
    "/{agent_id}/git-pull",
    response_model=CommandResponse,
    dependencies=[Depends(require_permission("cockpit_agents", "execute"))],
)
def git_pull(
    agent_id: str,
    user: dict = Depends(verify_token),
    db: Session = Depends(get_db),
):
    """
    Send git pull command and wait for response (30s timeout)
    Uses repository path and branch configured locally on agent via .env

    Sync route — blocking Redis wait runs in Starlette's thread pool.
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
            logger.error("Agent %s git-pull error: %s", agent_id, response.get("error"))
            raise_internal_server_error(logger, "Agent returned an error response")

        if response["status"] == "timeout":
            logger.warning(
                "Agent %s git-pull timed out: %s", agent_id, response.get("error")
            )
            raise HTTPException(
                status_code=504,
                detail="Agent did not respond within the timeout",
            )

        return response

    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(logger, "Internal error", e)


@router.post(
    "/{agent_id}/docker-restart",
    response_model=CommandResponse,
    dependencies=[Depends(require_permission("cockpit_agents", "execute"))],
)
def docker_restart(
    agent_id: str,
    user: dict = Depends(verify_token),
    db: Session = Depends(get_db),
):
    """
    Send docker restart command and wait for response (60s timeout)
    Container name is configured in agent's .env file

    Sync route — blocking Redis wait runs in Starlette's thread pool.
    """
    try:
        service = CockpitAgentService(db)

        response = service.send_docker_restart(
            agent_id=agent_id,
            sent_by=user.get("sub", "system"),
            timeout=60,
        )

        if response["status"] == "error":
            logger.error(
                "Agent %s docker-restart error: %s", agent_id, response.get("error")
            )
            raise_internal_server_error(logger, "Agent returned an error response")

        if response["status"] == "timeout":
            logger.warning(
                "Agent %s docker-restart timed out: %s", agent_id, response.get("error")
            )
            raise HTTPException(
                status_code=504,
                detail="Agent did not respond within the timeout",
            )

        return response

    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(logger, "Internal error", e)


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
    response_model=PingJobResponse,
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
    then submit a background Celery job to ping all devices via the specified agent.
    Returns immediately with a celery_task_id — results are visible in Jobs → View.
    """
    try:
        from tasks import dispatch_job

        # 1. Load the saved inventory
        inventory = inventory_persistence.get_inventory(request.inventory_id)
        if not inventory:
            raise HTTPException(
                status_code=404, detail=f"Inventory {request.inventory_id} not found"
            )

        # 2. Resolve devices from inventory conditions
        conditions = inventory.get("conditions", [])
        operations = _conditions_to_operations(conditions)
        devices, _ = await inventory_svc.preview_inventory(operations)

        if not devices:
            raise HTTPException(status_code=400, detail="No devices found in inventory")

        logger.info(
            "Resolved %d devices from inventory %d for ping job",
            len(devices),
            request.inventory_id,
        )

        # 3. For each device, query Nautobot GraphQL to get interface IP addresses
        device_ping_list: List[dict] = []
        for device in devices:
            if not device.name:
                continue
            try:
                result = await nautobot.graphql_query(
                    _DEVICE_IPS_QUERY, {"name": device.name}
                )
                ip_addresses = _extract_ip_addresses(result, device.name)
            except Exception as exc:
                logger.warning(
                    "Failed to fetch IPs for device '%s': %s", device.name, exc
                )
                ip_addresses = []

            device_ping_list.append(
                {
                    "device_name": device.name,
                    "device_id": device.id,
                    "ip_addresses": ip_addresses,
                }
            )

        if not device_ping_list:
            raise HTTPException(
                status_code=400, detail="No devices with names found in inventory"
            )

        username = user.get("sub", "system")

        # 4. Submit background Celery job — returns immediately
        task = dispatch_job.delay(
            job_name=f"Ping - Agent {agent_id}",
            job_type="ping_agent",
            triggered_by="manual",
            executed_by=username,
            target_devices=[d["device_name"] for d in device_ping_list],
            job_parameters={
                "agent_id": agent_id,
                "devices": device_ping_list,
                "sent_by": username,
            },
        )

        logger.info(
            "Ping job queued: agent=%s, devices=%d, celery_task_id=%s",
            agent_id,
            len(device_ping_list),
            task.id,
        )

        return PingJobResponse(
            celery_task_id=task.id,
            status="queued",
            message=f"Ping job queued for {len(device_ping_list)} device(s) — view progress in Jobs → View",
        )

    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(logger, "Internal error", e)


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
                group_conditions.append(
                    LC(
                        field=sub["field"],
                        operator=sub["operator"],
                        value=sub.get("value", ""),
                    )
                )
        return LogicalOperation(
            operation_type=item.get("internalLogic", "AND"),
            conditions=group_conditions,
            nested_operations=nested,
        )
    else:
        return LogicalOperation(
            operation_type="AND",
            conditions=[
                LC(
                    field=item["field"],
                    operator=item["operator"],
                    value=item.get("value", ""),
                )
            ],
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
            operations.append(
                LogicalOperation(
                    operation_type=internal_logic,
                    conditions=root_conditions,
                    nested_operations=nested_ops,
                )
            )

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
def get_agent_status(
    agent_id: str,
    db: Session = Depends(get_db),
):
    """
    Get health status for specific agent.

    Sync route — synchronous Redis hash read; nothing to await.
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
        raise_internal_server_error(logger, "Internal error", e)


@router.get(
    "/list",
    response_model=AgentListResponse,
    dependencies=[Depends(require_permission("cockpit_agents", "read"))],
)
def list_agents(
    db: Session = Depends(get_db),
):
    """
    List all registered Grafana Agents.

    Sync route — synchronous Redis keys scan; nothing to await.
    """
    try:
        service = CockpitAgentService(db)
        agents = service.list_agents()

        return {"agents": agents}

    except Exception as e:
        raise_internal_server_error(logger, "Internal error", e)


@router.get(
    "/{agent_id}/history",
    response_model=CommandHistoryResponse,
    dependencies=[Depends(require_permission("cockpit_agents", "read"))],
)
def get_command_history(
    agent_id: str,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """
    Get command history for specific agent.

    Sync route — synchronous SQLAlchemy reads; nothing to await.
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
        raise_internal_server_error(logger, "Internal error", e)


@router.get(
    "/history/all",
    response_model=CommandHistoryResponse,
    dependencies=[Depends(require_permission("cockpit_agents", "read"))],
)
def get_all_command_history(
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """
    Get command history for all agents.

    Sync route — synchronous SQLAlchemy reads; nothing to await.
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
        raise_internal_server_error(logger, "Internal error", e)
