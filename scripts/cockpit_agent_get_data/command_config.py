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
from typing import List, Literal, Optional, Union

import yaml

logger = logging.getLogger(__name__)

StepType = Literal["execute", "sftp_get"]

_RESULT_KEY_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9_]*$")


@dataclass(frozen=True)
class ExecuteStep:
    type: Literal["execute"]
    host: str
    username: str
    command: str
    ssh_key: bool = True
    ssh_key_file: Optional[str] = None
    port: int = 22
    password: Optional[str] = None


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


@dataclass(frozen=True)
class ResultEntry:
    """Keyed local file whose contents are returned to Cockpit via Redis."""

    key: str
    file: str


PipelineStep = Union[ExecuteStep, SftpGetStep]


@dataclass(frozen=True)
class CommandPipeline:
    steps: List[PipelineStep]
    results: List[ResultEntry]


def _require_str(mapping: dict, key: str, context: str) -> str:
    value = mapping.get(key)
    if not value or not isinstance(value, str):
        raise ValueError(f"{context}: '{key}' must be a non-empty string")
    return value.strip()


def _parse_step(step: dict, index: int) -> PipelineStep:
    if not isinstance(step, dict):
        raise ValueError(f"commands[{index}] must be a mapping")

    step_type = step.get("type")
    if step_type not in ("execute", "sftp_get"):
        raise ValueError(
            f"commands[{index}]: type must be 'execute' or 'sftp_get', got {step_type!r}"
        )

    context = f"commands[{index}]"
    host = _require_str(step, "host", context)
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


def _parse_result_entry(entry: dict, index: int) -> ResultEntry:
    if not isinstance(entry, dict):
        raise ValueError(f"result[{index}] must be a mapping")

    context = f"result[{index}]"
    key = _require_str(entry, "key", context)
    if not _RESULT_KEY_RE.match(key):
        raise ValueError(
            f"{context}: 'key' must start with a letter and contain only "
            f"letters, digits, and underscores"
        )
    file_path = _require_str(entry, "file", context)
    return ResultEntry(key=key, file=file_path)


def _parse_results(raw: object) -> List[ResultEntry]:
    if not isinstance(raw, list) or not raw:
        raise ValueError("result must be a non-empty list")

    entries = [_parse_result_entry(entry, index) for index, entry in enumerate(raw)]
    seen_keys = set()
    for entry in entries:
        if entry.key in seen_keys:
            raise ValueError(f"result: duplicate key {entry.key!r}")
        seen_keys.add(entry.key)
    return entries


def load_command_pipeline(config_path: Path) -> CommandPipeline:
    """Load and validate the command pipeline from *config_path*."""
    if not config_path.is_file():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    with config_path.open(encoding="utf-8") as handle:
        raw = yaml.safe_load(handle)

    if not isinstance(raw, dict):
        raise ValueError("config.yaml root must be a mapping")

    commands = raw.get("commands")
    if not isinstance(commands, list) or not commands:
        raise ValueError("config.yaml must contain a non-empty 'commands' list")

    result_raw = raw.get("result")
    if result_raw is None:
        raise ValueError("config.yaml must contain a 'result' section")

    steps = [_parse_step(step, index) for index, step in enumerate(commands)]
    results = _parse_results(result_raw)
    pipeline = CommandPipeline(steps=steps, results=results)
    result_keys = ", ".join(entry.key for entry in results)
    logger.info(
        "Loaded %d command step(s) and result key(s) [%s] from %s",
        len(steps),
        result_keys,
        config_path,
    )
    return pipeline
