"""
API Router for Grafana Agent management
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.auth import verify_token, require_permission
from core.database import get_db
from models.cockpit_agent import (
    AgentListResponse,
    AgentStatusResponse,
    CommandRequest,
    CommandResponse,
    GitPullRequest,
    DockerRestartRequest,
    CommandHistoryResponse,
    CommandHistoryItem,
)
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
            sent_by=user["sub"],
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
        logger.error(f"Failed to send command: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/git-pull",
    response_model=CommandResponse,
    dependencies=[Depends(require_permission("cockpit_agents", "execute"))],
)
async def git_pull(
    request: GitPullRequest,
    user: dict = Depends(verify_token),
    db: Session = Depends(get_db),
):
    """
    Send git pull command and wait for response (30s timeout)
    Convenience endpoint for git operations
    """
    try:
        service = CockpitAgentService(db)

        response = service.send_git_pull(
            agent_id=request.agent_id,
            repository_path=request.repository_path,
            branch=request.branch,
            sent_by=user["sub"],
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
        logger.error(f"Git pull failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/docker-restart",
    response_model=CommandResponse,
    dependencies=[Depends(require_permission("cockpit_agents", "execute"))],
)
async def docker_restart(
    request: DockerRestartRequest,
    user: dict = Depends(verify_token),
    db: Session = Depends(get_db),
):
    """
    Send docker restart command and wait for response (60s timeout)
    Convenience endpoint for docker operations
    """
    try:
        service = CockpitAgentService(db)

        response = service.send_docker_restart(
            agent_id=request.agent_id,
            container_name=request.container_name,
            sent_by=user["sub"],
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
        logger.error(f"Docker restart failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


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
        logger.error(f"Failed to get agent status: {e}", exc_info=True)
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
        logger.error(f"Failed to list agents: {e}", exc_info=True)
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
        logger.error(f"Failed to get command history: {e}", exc_info=True)
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
        logger.error(f"Failed to get command history: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
