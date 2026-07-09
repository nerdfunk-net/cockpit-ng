"""
Command executor for Cockpit Get Data Agent.

Runs a fixed pipeline from config.yaml via SSH (execute) and SFTP (sftp_get).
Only the ``echo`` health-check and ``get_data`` trigger commands are accepted
from Redis — remote commands always come from the local config file.
"""

from __future__ import annotations

import asyncio
import logging
import os
import shlex
import shutil
import tempfile
import time
from pathlib import Path
from typing import Callable, Dict, List, Optional

from command_config import (
    CommandPipeline,
    ExecuteStep,
    PipelineStep,
    SftpGetStep,
    load_command_pipeline,
)
from config import config

logger = logging.getLogger(__name__)


class CommandExecutor:
    """Pluggable command executor with handler registry."""

    def __init__(self, config_path: Optional[Path] = None):
        self.handlers: Dict[str, Callable] = {}
        pipeline_path = Path(config_path) if config_path else config.config_path
        self.pipeline: CommandPipeline = load_command_pipeline(pipeline_path)
        self._register_builtin_commands()

    def _register_builtin_commands(self) -> None:
        self.register("echo", self._execute_echo)
        self.register("get_data", self._execute_get_data)

    def register(self, command_name: str, handler: Callable) -> None:
        self.handlers[command_name] = handler
        logger.info("Registered command handler: %s", command_name)

    async def execute(
        self,
        command: str,
        params: dict,
        publish_progress: Optional[Callable] = None,
    ) -> dict:
        start_time = time.time()

        if command not in self.handlers:
            return {
                "status": "error",
                "error": f"Unknown command: {command}",
                "output": None,
                "execution_time_ms": 0,
            }

        try:
            handler = self.handlers[command]
            result = await handler(params, publish_progress=publish_progress)
            result["execution_time_ms"] = int((time.time() - start_time) * 1000)
            return result
        except Exception as exc:
            logger.error("Command execution failed: %s", command, exc_info=True)
            return {
                "status": "error",
                "error": str(exc),
                "output": None,
                "execution_time_ms": int((time.time() - start_time) * 1000),
            }

    async def _execute_echo(
        self, params: dict, publish_progress: Optional[Callable] = None
    ) -> dict:
        message = params.get("message", "pong")
        logger.info("Echo command: %s", message)
        return {"status": "success", "output": message, "error": None}

    async def _execute_get_data(
        self, params: dict, publish_progress: Optional[Callable] = None
    ) -> dict:
        """
        Run the configured pipeline step by step.

        Params from the backend are ignored — only config.yaml defines what runs.
        """
        if params:
            logger.warning(
                "Ignoring unexpected params for get_data — pipeline is config-driven"
            )

        step_results: List[dict] = []

        for index, step in enumerate(self.pipeline.steps):
            if publish_progress:
                publish_progress(
                    {
                        "phase": step.type,
                        "step": index + 1,
                        "total_steps": len(self.pipeline.steps),
                    }
                )

            if step.type == "execute":
                result = await self._run_execute_step(step)
            else:
                result = await self._run_sftp_get_step(step)

            step_results.append(result)
            if result["status"] != "success":
                return {
                    "status": "error",
                    "error": result.get("error") or f"Step {index + 1} failed",
                    "output": {"steps": step_results},
                }

        result_payload, read_error = self._read_result_files()
        if read_error:
            return {
                "status": "error",
                "error": read_error,
                "output": {"steps": step_results},
            }

        return {
            "status": "success",
            "output": {
                "steps": step_results,
                "result": result_payload,
            },
            "error": None,
        }

    def _read_result_files(self) -> tuple[Optional[dict[str, str]], Optional[str]]:
        """Read local files declared in config.yaml ``result`` and key by name."""
        payload: dict[str, str] = {}

        for entry in self.pipeline.results:
            result_path = Path(entry.file)
            try:
                content = result_path.read_text(encoding="utf-8", errors="replace")
            except FileNotFoundError:
                return None, f"Result file not found for key {entry.key!r}: {result_path}"
            except OSError as exc:
                return None, (
                    f"Failed to read result file for key {entry.key!r} "
                    f"({result_path}): {exc}"
                )

            payload[entry.key] = content

        return payload, None

    async def _run_execute_step(self, step: ExecuteStep) -> dict:
        logger.info(
            "Executing remote command on %s as %s: %s",
            step.host,
            step.username,
            step.command,
        )

        cmd, env = self._build_ssh_command(step, remote_command=step.command)
        result = await self._run_subprocess(
            cmd,
            env=env,
            label=f"ssh execute on {step.host}",
        )
        return {
            "type": "execute",
            "host": step.host,
            "command": step.command,
            **result,
        }

    async def _run_sftp_get_step(self, step: SftpGetStep) -> dict:
        local_path = Path(step.dst_file)
        logger.info(
            "Fetching %s:%s -> %s as %s",
            step.host,
            step.src_file,
            local_path,
            step.username,
        )

        try:
            local_path.parent.mkdir(parents=True, exist_ok=True)
        except OSError as exc:
            return {
                "type": "sftp_get",
                "status": "error",
                "host": step.host,
                "src_file": step.src_file,
                "dst_file": step.dst_file,
                "error": f"Failed to create destination directory: {exc}",
            }

        batch_path: Optional[str] = None
        try:
            batch_path = self._write_sftp_batch(step.src_file, str(local_path))
            cmd, env = self._build_sftp_command(step, batch_path=batch_path)
            proc_result = await self._run_subprocess(
                cmd,
                env=env,
                label=f"sftp get from {step.host}",
            )
        except Exception as exc:
            return {
                "type": "sftp_get",
                "status": "error",
                "host": step.host,
                "src_file": step.src_file,
                "dst_file": step.dst_file,
                "error": str(exc),
            }
        finally:
            if batch_path:
                try:
                    os.unlink(batch_path)
                except FileNotFoundError:
                    pass

        if proc_result["status"] != "success":
            return {
                "type": "sftp_get",
                "status": "error",
                "host": step.host,
                "src_file": step.src_file,
                "dst_file": step.dst_file,
                "error": proc_result.get("error"),
            }

        try:
            size_bytes = local_path.stat().st_size
        except OSError as exc:
            return {
                "type": "sftp_get",
                "status": "error",
                "host": step.host,
                "src_file": step.src_file,
                "dst_file": step.dst_file,
                "error": f"Downloaded file not found: {exc}",
            }

        return {
            "type": "sftp_get",
            "status": "success",
            "host": step.host,
            "src_file": step.src_file,
            "dst_file": step.dst_file,
            "size_bytes": size_bytes,
        }

    def _write_sftp_batch(self, src_file: str, dst_file: str) -> str:
        """Write an OpenSSH sftp batch script (``get remote local``)."""
        with tempfile.NamedTemporaryFile(
            mode="w",
            prefix="cockpit_sftp_",
            suffix=".txt",
            delete=False,
            encoding="utf-8",
        ) as batch_file:
            batch_file.write(
                f"get {_quote_sftp_path(src_file)} {_quote_sftp_path(dst_file)}\n"
            )
            return batch_file.name

    def _build_ssh_connection_options(
        self, step: PipelineStep
    ) -> tuple[list[str], dict, list[str], Optional[str]]:
        """Shared OpenSSH options for ssh/sftp (without login flags)."""
        options = [
            "-o",
            "BatchMode=yes",
            "-o",
            f"ConnectTimeout={config.command_timeout}",
            "-o",
            f"User={step.username}",
        ]
        if config.ssh_host_key_checking:
            options += ["-o", "StrictHostKeyChecking=yes"]
        else:
            options += ["-o", "StrictHostKeyChecking=accept-new"]

        port: Optional[str] = None
        if step.port != 22:
            port = str(step.port)
        if step.ssh_key_file:
            options += ["-i", step.ssh_key_file]

        env = os.environ.copy()
        wrapper: list[str] = []
        if step.password and not step.ssh_key:
            if not shutil.which("sshpass"):
                raise RuntimeError(
                    "sshpass is required for password authentication. "
                    "Install sshpass or use ssh_key: true."
                )
            env["SSHPASS"] = step.password
            wrapper = ["sshpass", "-e"]

        return options, env, wrapper, port

    def _build_ssh_command(
        self, step: ExecuteStep, *, remote_command: str
    ) -> tuple[list[str], dict]:
        options, env, wrapper, port = self._build_ssh_connection_options(step)
        cmd = [*wrapper, "ssh", *options]
        if port:
            cmd += ["-p", port]
        cmd += [step.host, remote_command]
        return cmd, env

    def _build_sftp_command(
        self, step: SftpGetStep, *, batch_path: str
    ) -> tuple[list[str], dict]:
        options, env, wrapper, port = self._build_ssh_connection_options(step)
        cmd = [*wrapper, "sftp", "-b", batch_path, *options]
        if port:
            cmd += ["-P", port]
        cmd += [step.host]
        return cmd, env

    async def _run_subprocess(
        self,
        cmd: list[str],
        *,
        env: dict,
        label: str,
    ) -> dict:
        log_cmd = " ".join(shlex.quote(part) for part in cmd)
        if "SSHPASS" in env:
            log_cmd = log_cmd.replace(env["SSHPASS"], "REDACTED")
        logger.debug("Running %s: %s", label, log_cmd)

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )

        try:
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=config.command_timeout,
            )
        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            return {
                "status": "error",
                "error": f"{label} timed out after {config.command_timeout}s",
            }

        stdout_text = stdout.decode("utf-8", errors="replace")
        stderr_text = stderr.decode("utf-8", errors="replace")

        if process.returncode != 0:
            combined = (stdout_text + "\n" + stderr_text).strip()
            return {
                "status": "error",
                "error": combined or f"{label} exited with code {process.returncode}",
                "stdout": stdout_text or None,
                "stderr": stderr_text or None,
            }

        return {
            "status": "success",
            "stdout": stdout_text or None,
            "stderr": stderr_text or None,
        }


def _quote_sftp_path(path: str) -> str:
    """Quote a path for an OpenSSH sftp batch file when needed."""
    if any(ch.isspace() for ch in path) or '"' in path:
        return '"' + path.replace('"', '\\"') + '"'
    return path
