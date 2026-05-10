"""
Command executor for Cockpit Ansible Agent
Handles execution of ansible facts gathering and echo commands
"""

import asyncio
import json
import logging
import os
import tempfile
import time
from pathlib import Path
from typing import Callable, Dict, Optional

from config import config

logger = logging.getLogger(__name__)


class CommandExecutor:
    """Pluggable command executor with handler registry"""

    def __init__(self):
        self.handlers: Dict[str, Callable] = {}
        self._register_builtin_commands()

    def _register_builtin_commands(self):
        """Register default command handlers"""
        self.register("echo", self._execute_echo)
        self.register("get_facts", self._execute_get_facts)

    def register(self, command_name: str, handler: Callable):
        """Register a new command handler"""
        self.handlers[command_name] = handler
        logger.info(f"Registered command handler: {command_name}")

    async def execute(
        self,
        command: str,
        params: dict,
        publish_progress: Optional[Callable] = None,
    ) -> dict:
        """
        Execute a command by name.

        publish_progress: optional callable(data: dict) that sends intermediate
        progress updates back to the backend while the command is still running.

        Returns: dict with status, output, error, execution_time_ms
        """
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
        except Exception as e:
            logger.error(f"Command execution failed: {command}", exc_info=True)
            return {
                "status": "error",
                "error": str(e),
                "output": None,
                "execution_time_ms": int((time.time() - start_time) * 1000),
            }

    # ------------------------------------------------------------------
    # Built-in commands
    # ------------------------------------------------------------------

    async def _execute_echo(
        self, params: dict, publish_progress: Optional[Callable] = None
    ) -> dict:
        """Echo command for health checks"""
        message = params.get("message", "pong")
        logger.info(f"Echo command: {message}")
        return {"status": "success", "output": message, "error": None}

    async def _execute_get_facts(
        self, params: dict, publish_progress: Optional[Callable] = None
    ) -> dict:
        """
        Gather Ansible facts from a target host and return the JSON data.

        Expected params:
        {
            "ip_address": "192.168.1.1",                      # required
            "ansible_user": "root",                           # required
            "ansible_password": "secret",                     # optional
            "ansible_ssh_private_key_file": "/path/to/key",   # optional
            "ansible_port": 22                                # optional (default: 22)
        }

        Returns:
        {
            "facts": { <full hostvars dict> },
            "ip_address": "192.168.1.1",
            "hostname": "router1.example.com"
        }
        """
        ip_address = params.get("ip_address")
        ansible_user = params.get("ansible_user")

        if not ip_address:
            return {"status": "error", "error": "ip_address is required", "output": None}
        if not ansible_user:
            return {"status": "error", "error": "ansible_user is required", "output": None}

        ansible_port = int(params.get("ansible_port", 22))
        playbook_path = Path(config.ansible_playbook_dir) / "get_facts.yml"

        with tempfile.NamedTemporaryFile(
            prefix="cockpit_facts_", suffix=".json", delete=False
        ) as tmp:
            facts_dest = tmp.name

        try:
            extra_vars = (
                f"ansible_user={ansible_user} "
                f"ansible_port={ansible_port} "
                f"facts_dest={facts_dest}"
            )

            cmd = [
                "ansible-playbook",
                "-i", f"{ip_address},",
                str(playbook_path),
                "-e", extra_vars,
            ]

            if ansible_password := params.get("ansible_password"):
                cmd += ["-e", f"ansible_password={ansible_password}"]

            if key_file := params.get("ansible_ssh_private_key_file"):
                cmd += ["-e", f"ansible_ssh_private_key_file={key_file}"]

            env = os.environ.copy()
            env["ANSIBLE_HOST_KEY_CHECKING"] = "True" if config.ansible_host_key_checking else "False"

            logger.info(
                f"Running ansible-playbook for {ip_address} "
                f"(user={ansible_user}, port={ansible_port})"
            )

            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
            )

            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(),
                    timeout=config.ansible_timeout,
                )
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
                return {
                    "status": "error",
                    "error": f"ansible-playbook timed out after {config.ansible_timeout}s",
                    "output": None,
                }

            stdout_text = stdout.decode("utf-8", errors="replace")
            stderr_text = stderr.decode("utf-8", errors="replace")

            logger.debug(f"ansible-playbook exit={process.returncode}")
            if stdout_text:
                logger.debug(f"stdout: {stdout_text[:500]}")

            if process.returncode != 0:
                logger.error(f"ansible-playbook failed:\n{stderr_text[:1000]}")
                return {
                    "status": "error",
                    "error": stderr_text or f"ansible-playbook exited with code {process.returncode}",
                    "output": None,
                }

            try:
                with open(facts_dest) as f:
                    facts = json.load(f)
            except FileNotFoundError:
                return {
                    "status": "error",
                    "error": "Facts file was not created — playbook may have failed silently",
                    "output": None,
                }
            except json.JSONDecodeError as e:
                return {
                    "status": "error",
                    "error": f"Failed to parse facts JSON: {e}",
                    "output": None,
                }

            hostname = facts.get("ansible_fqdn") or facts.get("ansible_hostname") or ip_address
            logger.info(f"Facts gathered for {ip_address} (hostname={hostname})")

            return {
                "status": "success",
                "output": {
                    "facts": facts,
                    "ip_address": ip_address,
                    "hostname": hostname,
                },
                "error": None,
            }

        finally:
            try:
                os.unlink(facts_dest)
            except FileNotFoundError:
                pass
