"""
Pydantic models for Grafana Agent
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class AgentStatusResponse(BaseModel):
    """Agent health status from Redis"""

    agent_id: str
    status: str  # online, offline
    last_heartbeat: int
    version: str
    hostname: str  # Agent ID (for display/compatibility)
    capabilities: str
    data_flows: str = ""
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
    timeout: Optional[int] = Field(
        default=None,
        description=(
            "Seconds to wait for the agent response before returning. "
            "When omitted the endpoint returns immediately with status 'pending'."
        ),
    )


class CommandResponse(BaseModel):
    """Response from agent after command execution"""

    command_id: str
    status: str  # success, error, timeout, pending
    output: Optional[Any] = None
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


class AnsibleGetFactsRequest(BaseModel):
    """Request to gather Ansible facts from a target host."""

    agent_id: str = Field(..., description="Ansible agent ID")
    ip_address: str = Field(..., description="Target hostname or IP address")
    ansible_user: Optional[str] = Field(
        default=None,
        description="SSH username — required when use_sshkey=True and credential_id is not set",
    )
    use_sshkey: bool = Field(default=True, description="Use SSH key authentication")
    credential_id: Optional[int] = Field(
        default=None,
        description="Credential ID: SSH key passphrase (use_sshkey=True) or username/password (use_sshkey=False)",
    )
    ansible_port: int = Field(default=22, description="SSH port")
    timeout: int = Field(default=60, description="Seconds to wait for agent response")


class AnsibleGetCiscoFactsRequest(BaseModel):
    """Request to gather facts from a Cisco IOS/NX-OS device via an Ansible agent."""

    agent_id: str = Field(..., description="Ansible agent ID")
    ip_address: str = Field(..., description="Target hostname or IP address")
    network_driver: str = Field(
        ...,
        description=(
            "Nautobot platform.network_driver (e.g. cisco_ios, cisco_nxos). "
            "Mapped server-side to ansible_network_os."
        ),
    )
    ansible_user: Optional[str] = Field(
        default=None,
        description="SSH username — required when use_sshkey=True and credential_id is not set",
    )
    use_sshkey: bool = Field(default=True, description="Use SSH key authentication")
    credential_id: Optional[int] = Field(
        default=None,
        description="Credential ID: SSH key passphrase (use_sshkey=True) or username/password (use_sshkey=False)",
    )
    ansible_port: int = Field(default=22, description="SSH port")
    timeout: int = Field(default=60, description="Seconds to wait for agent response")


class OpenPortsScanRequest(BaseModel):
    """Request to scan open TCP/UDP ports on a target host."""

    agent_id: str = Field(..., description="Ansible agent ID")
    ip_address: str = Field(..., description="Target hostname or IP address")
    ansible_user: Optional[str] = Field(
        default=None,
        description="SSH username — required when use_sshkey=True and credential_id is not set",
    )
    use_sshkey: bool = Field(default=True, description="Use SSH key authentication")
    credential_id: Optional[int] = Field(
        default=None,
        description="Credential ID: SSH key passphrase (use_sshkey=True) or username/password (use_sshkey=False)",
    )
    ansible_port: int = Field(default=22, description="SSH port")
    timeout: int = Field(default=60, description="Seconds to wait for agent response")


class GetDataRequest(BaseModel):
    """Request to run a Get Data agent flow (config-driven on the agent)."""

    agent_id: str = Field(..., description="Get Data agent ID")
    flow_id: str = Field(
        ...,
        description="Pipeline flow identifier from the agent config (e.g. data-1)",
    )
    timeout: int = Field(
        default=120,
        description="Seconds to wait for the full pipeline to complete",
    )


class NmapScanRequest(BaseModel):
    """Request to scan open TCP/UDP ports on a target host via an nmap agent."""

    agent_id: str = Field(..., description="Nmap agent ID")
    ip_address: str = Field(..., description="Target hostname or IP address")
    ports: Optional[str] = Field(
        default=None,
        description='Port specification, e.g. "22,80,443" or "1-1024" (agent default when omitted)',
    )
    scan_type: Optional[str] = Field(
        default=None,
        description="Scan type: syn, connect, or udp (agent default when omitted)",
    )
    service_detection: Optional[bool] = Field(
        default=None,
        description="Enable nmap -sV service/version detection",
    )
    timeout: int = Field(default=300, description="Seconds to wait for agent response")


class NmapPortBinding(BaseModel):
    address: str
    port: int


class NmapServiceInfo(BaseModel):
    protocol: str
    port: int
    state: Optional[str] = None
    service: Optional[str] = None
    product: Optional[str] = None
    version: Optional[str] = None


class NmapScanOutput(BaseModel):
    """Structured output returned by the nmap agent scan_ports command."""

    ip_address: str
    hostname: str
    host_status: str
    tcp_ports: List[NmapPortBinding]
    udp_ports: List[NmapPortBinding]
    scan_arguments: str
    services: List[NmapServiceInfo] = Field(default_factory=list)


class NmapScanResponse(BaseModel):
    """Response from agent after nmap scan_ports command execution."""

    command_id: str
    status: str
    output: Optional[NmapScanOutput] = None
    error: Optional[str] = None
    execution_time_ms: int


class CommandHistoryItem(BaseModel):
    """Command history record"""

    model_config = ConfigDict(from_attributes=True)

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


class CommandHistoryResponse(BaseModel):
    """List of command history"""

    commands: List[CommandHistoryItem]
    total: int


class AgentListResponse(BaseModel):
    """List of all registered agents"""

    agents: List[AgentStatusResponse]


class PingRequest(BaseModel):
    """Request to ping devices from an inventory via a cockpit agent"""

    inventory_id: int = Field(
        ..., description="Saved inventory ID to resolve devices from"
    )


class PingIpResult(BaseModel):
    """Result for a single IP address ping"""

    ip_address: str
    reachable: bool
    latency_ms: Optional[float] = None
    packet_loss_percent: int


class PingDeviceResult(BaseModel):
    """Ping results for one device"""

    device_name: str
    device_id: Optional[str] = None
    ip_results: List[PingIpResult]


class PingOutput(BaseModel):
    """Structured output returned by the ping agent command"""

    results: List[PingDeviceResult]
    total_devices: int
    reachable_count: int
    unreachable_count: int


class PingResponse(BaseModel):
    """Response from agent after ping command execution"""

    command_id: str
    status: str  # success, error, timeout
    output: Optional[PingOutput] = None
    error: Optional[str] = None
    execution_time_ms: int


class PingJobResponse(BaseModel):
    """Returned immediately when a ping is submitted as a background Celery job"""

    celery_task_id: str
    status: str  # queued
    message: str
