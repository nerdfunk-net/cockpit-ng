"""
Load and validate the Get Data agent pipeline from config.yaml.

Only command steps declared in this file may run — the agent rejects any
remote command not listed here.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Literal, Optional, Union

import yaml

logger = logging.getLogger(__name__)

StepType = Literal["execute", "sftp_get"]

_FLOW_ID_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9_-]*$")


@dataclass(frozen=True)
class ExecuteStep:
    type: Literal["execute"]
    host: str
    # Remote: single shell command string. Local (host=local): list of shell commands.
    command: Union[str, List[str]]
    username: Optional[str] = None
    ssh_key: bool = True
    ssh_key_file: Optional[str] = None
    port: int = 22
    password: Optional[str] = None

    @property
    def is_local(self) -> bool:
        return self.host.lower() == "local"


@dataclass(frozen=True)
class SftpGetStep:
    type: Literal["sftp_get"]
    host: str
    username: str
    src_file: str
    dst_file: str
    ssh_key: bool = True
    ssh_key_file: Optional[str] = None
    port: int = 22
    password: Optional[str] = None


PipelineStep = Union[ExecuteStep, SftpGetStep]


@dataclass(frozen=True)
class FlowDefinition:
    """One named flow: action steps plus a local result file to return."""

    steps: List[PipelineStep]
    result_file: str


@dataclass(frozen=True)
class AgentCommandConfig:
    """Named data-collection flows."""

    flows: Dict[str, FlowDefinition]


# Backward-compatible alias used by older imports/tests.
CommandPipeline = AgentCommandConfig


def _require_str(mapping: dict, key: str, context: str) -> str:
    value = mapping.get(key)
    if not value or not isinstance(value, str):
        raise ValueError(f"{context}: '{key}' must be a non-empty string")
    return value.strip()


def _parse_command_list(step: dict, context: str) -> List[str]:
    """Parse ``command`` as a non-empty list of shell command strings (local host)."""
    commands = step.get("command")
    if not isinstance(commands, list) or not commands:
        raise ValueError(
            f"{context}: for host 'local', 'command' must be a non-empty list of strings"
        )

    parsed: List[str] = []
    for index, command in enumerate(commands):
        if not isinstance(command, str) or not command.strip():
            raise ValueError(f"{context}: command[{index}] must be a non-empty string")
        parsed.append(command.strip())
    return parsed


def _parse_ssh_common(
    step: dict, context: str
) -> tuple[str, bool, Optional[str], Optional[str], int]:
    """Parse shared SSH fields for remote execute / sftp_get steps."""
    username = _require_str(step, "username", context)

    ssh_key = step.get("ssh_key", True)
    if not isinstance(ssh_key, bool):
        raise ValueError(f"{context}: 'ssh_key' must be a boolean")

    ssh_key_file = step.get("ssh_key_file")
    if ssh_key_file is not None:
        if not isinstance(ssh_key_file, str) or not ssh_key_file.strip():
            raise ValueError(f"{context}: 'ssh_key_file' must be a non-empty string")
        ssh_key_file = ssh_key_file.strip()

    password = step.get("password")
    if password is not None:
        if not isinstance(password, str) or not password:
            raise ValueError(f"{context}: 'password' must be a non-empty string")

    port = step.get("port", 22)
    if not isinstance(port, int) or port < 1 or port > 65535:
        raise ValueError(f"{context}: 'port' must be an integer between 1 and 65535")

    return username, ssh_key, ssh_key_file, password, port


def _parse_local_execute_step(step: dict, host: str, context: str) -> ExecuteStep:
    """Parse an execute step that runs on the agent host (host: local)."""
    commands = _parse_command_list(step, context)
    return ExecuteStep(
        type="execute",
        host=host,
        command=commands,
    )


def _parse_action_step(step: dict, context: str) -> PipelineStep:
    if not isinstance(step, dict):
        raise ValueError(f"{context} must be a mapping")

    step_type = step.get("type")
    if step_type not in ("execute", "sftp_get"):
        raise ValueError(
            f"{context}: type must be 'execute' or 'sftp_get', got {step_type!r}"
        )

    host = _require_str(step, "host", context)

    if step_type == "execute" and host.lower() == "local":
        return _parse_local_execute_step(step, host, context)

    username, ssh_key, ssh_key_file, password, port = _parse_ssh_common(step, context)

    if step_type == "execute":
        command = _require_str(step, "command", context)
        return ExecuteStep(
            type="execute",
            host=host,
            username=username,
            command=command,
            ssh_key=ssh_key,
            ssh_key_file=ssh_key_file,
            port=port,
            password=password,
        )

    src_file = _require_str(step, "src_file", context)
    dst_file = _require_str(step, "dst_file", context)
    return SftpGetStep(
        type="sftp_get",
        host=host,
        username=username,
        src_file=src_file,
        dst_file=dst_file,
        ssh_key=ssh_key,
        ssh_key_file=ssh_key_file,
        port=port,
        password=password,
    )


def _parse_result_entry(step: object, context: str) -> str:
    if not isinstance(step, dict):
        raise ValueError(f"{context} must be a mapping")

    keys = list(step.keys())
    if keys != ["result"]:
        raise ValueError(f"{context}: result entry must be a single 'result' key")

    file_path = step.get("result")
    if not isinstance(file_path, str) or not file_path.strip():
        raise ValueError(f"{context}: 'result' must be a non-empty file path")
    return file_path.strip()


def _parse_flow(flow_id: str, steps_raw: object) -> FlowDefinition:
    if not isinstance(steps_raw, list) or not steps_raw:
        raise ValueError(f"commands.{flow_id} must be a non-empty list")

    action_steps: List[PipelineStep] = []
    result_file: Optional[str] = None

    for index, step in enumerate(steps_raw):
        context = f"commands.{flow_id}[{index}]"
        if isinstance(step, dict) and "result" in step and "type" not in step:
            if result_file is not None:
                raise ValueError(
                    f"commands.{flow_id}: only one result entry is allowed"
                )
            result_file = _parse_result_entry(step, context)
            continue

        action_steps.append(_parse_action_step(step, context))

    if not action_steps:
        raise ValueError(f"commands.{flow_id} must contain at least one action step")
    if not result_file:
        raise ValueError(f"commands.{flow_id} must end with a result entry")

    # Result entry must be last in the YAML list.
    last_step = steps_raw[-1]
    if not (isinstance(last_step, dict) and list(last_step.keys()) == ["result"]):
        raise ValueError(
            f"commands.{flow_id}: result entry must be the last item in the flow"
        )

    return FlowDefinition(steps=action_steps, result_file=result_file)


def _parse_flows(raw: object) -> Dict[str, FlowDefinition]:
    if not isinstance(raw, dict) or not raw:
        raise ValueError("commands must be a non-empty mapping of flow identifiers")

    flows: Dict[str, FlowDefinition] = {}
    for flow_id, steps_raw in raw.items():
        if not isinstance(flow_id, str) or not flow_id.strip():
            raise ValueError("commands: flow identifiers must be non-empty strings")
        flow_id = flow_id.strip()
        if not _FLOW_ID_RE.match(flow_id):
            raise ValueError(
                f"commands: flow identifier {flow_id!r} must start with a letter "
                f"and contain only letters, digits, hyphens, and underscores"
            )
        if flow_id in flows:
            raise ValueError(f"commands: duplicate flow identifier {flow_id!r}")

        flows[flow_id] = _parse_flow(flow_id, steps_raw)

    return flows


def load_command_pipeline(config_path: Path) -> AgentCommandConfig:
    """Load and validate the command configuration from *config_path*."""
    if not config_path.is_file():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    with config_path.open(encoding="utf-8") as handle:
        raw = yaml.safe_load(handle)

    if not isinstance(raw, dict):
        raise ValueError("config.yaml root must be a mapping")

    commands = raw.get("commands")
    flows = _parse_flows(commands)
    config = AgentCommandConfig(flows=flows)
    flow_summary = ", ".join(
        f"{flow_id} ({len(flow.steps)} action step(s) -> {flow.result_file})"
        for flow_id, flow in flows.items()
    )
    logger.info("Loaded flow(s) [%s] from %s", flow_summary, config_path)
    return config
