"""
Pydantic models for Grafana Agent
"""

from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class AgentStatusResponse(BaseModel):
    """Agent health status from Redis"""

    agent_id: str
    status: str  # online, offline
    last_heartbeat: int
    version: str
    hostname: str
    capabilities: str
    started_at: int
    commands_executed: int


class CommandRequest(BaseModel):
    """Request to send command to agent"""

    agent_id: str = Field(..., description="Agent hostname/ID")
    command: str = Field(
        ..., description="Command name (echo, git_pull, docker_restart)"
    )
    params: Dict[str, Any] = Field(
        default_factory=dict, description="Command parameters"
    )


class CommandResponse(BaseModel):
    """Response from agent after command execution"""

    command_id: str
    status: str  # success, error, timeout
    output: Optional[str] = None
    error: Optional[str] = None
    execution_time_ms: int


class GitPullRequest(BaseModel):
    """Convenience model for git pull command"""

    agent_id: str
    repository_path: str
    branch: str = "main"


class DockerRestartRequest(BaseModel):
    """Convenience model for docker restart command"""

    agent_id: str


class CommandHistoryItem(BaseModel):
    """Command history record"""

    id: int
    agent_id: str
    command_id: str
    command: str
    params: Optional[str] = None  # JSON string
    status: Optional[str] = None
    output: Optional[str] = None
    error: Optional[str] = None
    execution_time_ms: Optional[int] = None
    sent_at: datetime
    completed_at: Optional[datetime] = None
    sent_by: Optional[str] = None

    class Config:
        from_attributes = True


class CommandHistoryResponse(BaseModel):
    """List of command history"""

    commands: List[CommandHistoryItem]
    total: int


class AgentListResponse(BaseModel):
    """List of all registered agents"""

    agents: List[AgentStatusResponse]
