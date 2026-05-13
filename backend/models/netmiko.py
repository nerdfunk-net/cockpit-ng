"""Pydantic models for Netmiko command execution."""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class DeviceCommand(BaseModel):
    devices: List[Dict[str, str]] = Field(
        ...,
        description="List of devices with 'ip' or 'primary_ip4' and 'platform' fields",
    )
    commands: List[str] = Field(
        ..., description="List of commands to execute", min_length=1
    )
    credential_id: Optional[int] = Field(default=None)
    username: Optional[str] = Field(default=None)
    password: Optional[str] = Field(default=None)
    enable_mode: bool = Field(default=False)
    write_config: bool = Field(default=False)
    use_textfsm: bool = Field(default=False)
    session_id: Optional[str] = Field(default=None)


class CommandResult(BaseModel):
    device: str
    success: bool
    output: str
    error: Optional[str] = None
    command_outputs: Optional[Dict[str, Any]] = Field(default=None)


class CommandExecutionResponse(BaseModel):
    session_id: str
    results: List[CommandResult]
    total_devices: int
    successful: int
    failed: int
    cancelled: int


class TemplateExecutionRequest(BaseModel):
    device_ids: List[str] = Field(
        ..., description="List of device UUIDs from Nautobot", min_length=1
    )
    template_id: Optional[int] = Field(default=None)
    template_content: Optional[str] = Field(default=None)
    user_variables: Dict[str, Any] = Field(default_factory=dict)
    use_nautobot_context: bool = Field(default=True)
    dry_run: bool = Field(default=False)
    credential_id: Optional[int] = Field(default=None)
    username: Optional[str] = Field(default=None)
    password: Optional[str] = Field(default=None)
    enable_mode: bool = Field(default=False)
    write_config: bool = Field(default=False)
    session_id: Optional[str] = Field(default=None)


class TemplateExecutionResult(BaseModel):
    device_id: str
    device_name: str
    success: bool
    rendered_content: Optional[str] = None
    output: Optional[str] = None
    error: Optional[str] = None


class TemplateExecutionResponse(BaseModel):
    session_id: str
    results: List[TemplateExecutionResult]
    summary: Dict[str, int] = Field(
        description="Summary statistics (total, rendered_successfully, executed_successfully, failed, cancelled)"
    )
