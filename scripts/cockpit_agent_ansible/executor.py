"""
Command executor for Cockpit Ansible Agent
Handles execution of ansible facts gathering and echo commands
"""

import asyncio
import json
import logging
import os
import re
import shlex
import shutil
import stat
import tempfile
import time
from pathlib import Path
from typing import Callable, Dict, Optional

from cryptography.fernet import Fernet, InvalidToken

from config import config

logger = logging.getLogger(__name__)


def _decrypt_password(encrypted: str) -> str:
    """Fernet-decrypt a password that was encrypted by the backend."""
    try:
        f = Fernet(config.fernet_key)
        return f.decrypt(encrypted.encode()).decode()
    except InvalidToken as e:
        raise ValueError(
            "Failed to decrypt — shared secret mismatch or tampered data"
        ) from e


class CommandExecutor:
    """Pluggable command executor with handler registry"""

    def __init__(self):
        self.handlers: Dict[str, Callable] = {}
        self._register_builtin_commands()

    def _register_builtin_commands(self):
        """Register default command handlers"""
        self.register("echo", self._execute_echo)
        self.register("get_facts", self._execute_get_facts)
        self.register("get_open_ports", self._execute_get_open_ports)

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

    async def _run_ansible_playbook(self, params: dict, playbook_filename: str) -> dict:
        """
        Shared plumbing for Ansible-agent commands (get_facts, get_open_ports, ...):
        decrypt auth params, invoke `ansible-playbook -i "IP,"` against
        *playbook_filename*, and return the JSON the playbook wrote to facts_dest.

        Auth modes (mutually exclusive):
          SSH key (no passphrase):
            use_sshkey=true, ansible_user required, no ansible_password/ssh_passphrase
          SSH key with passphrase (Fernet-encrypted by backend):
            use_sshkey=true, ansible_user required, ssh_passphrase=<encrypted>
          Username/password (Fernet-encrypted by backend):
            use_sshkey=false, ansible_user required, ansible_password=<encrypted>

        Optional:
            ansible_ssh_private_key_file  — override default SSH identity file
            ansible_port                  — default 22

        Returns {"status": "success", "data": <parsed json>, "ip_address": ip_address}
        or {"status": "error", "error": ..., "output": None}.
        """
        ip_address = params.get("ip_address")
        ansible_user = params.get("ansible_user")
        use_sshkey = params.get("use_sshkey", False)

        # Decrypt Fernet-encrypted fields sent by the backend
        ansible_password: Optional[str] = None
        if params.get("ansible_password"):
            ansible_password = _decrypt_password(params["ansible_password"])

        ssh_passphrase: Optional[str] = None
        if params.get("ssh_passphrase"):
            ssh_passphrase = _decrypt_password(params["ssh_passphrase"])

        if not ip_address:
            return {
                "status": "error",
                "error": "ip_address is required",
                "output": None,
            }
        if not ansible_user:
            return {
                "status": "error",
                "error": "ansible_user is required",
                "output": None,
            }
        if not ansible_password and not use_sshkey:
            return {
                "status": "error",
                "error": "Either ansible_password or use_sshkey is required",
                "output": None,
            }

        if ansible_password and not shutil.which("sshpass"):
            return {
                "status": "error",
                "error": (
                    "sshpass is not installed on this agent host. "
                    "Ansible requires sshpass for password-based SSH authentication. "
                    "Install it with: apt-get install sshpass  or  yum install sshpass"
                ),
                "output": None,
            }

        ansible_port = int(params.get("ansible_port", 22))
        playbook_path = Path(config.ansible_playbook_dir) / playbook_filename

        with tempfile.NamedTemporaryFile(
            prefix="cockpit_ansible_", suffix=".json", delete=False
        ) as tmp:
            facts_dest = tmp.name

        askpass_script: Optional[str] = None

        try:
            extra_vars = (
                f"ansible_user={ansible_user} "
                f"ansible_port={ansible_port} "
                f"facts_dest={facts_dest}"
            )

            cmd = [
                "ansible-playbook",
                "-i",
                f"{ip_address},",
                str(playbook_path),
                "-e",
                extra_vars,
            ]

            if ansible_password:
                cmd += ["-e", f"ansible_password={ansible_password}"]

            if key_file := params.get("ansible_ssh_private_key_file"):
                cmd += ["-e", f"ansible_ssh_private_key_file={key_file}"]

            env = os.environ.copy()
            env["ANSIBLE_HOST_KEY_CHECKING"] = (
                "True" if config.ansible_host_key_checking else "False"
            )

            if ssh_passphrase:
                # Use SSH_ASKPASS to supply the key passphrase non-interactively.
                # SSH respects SSH_ASKPASS when DISPLAY is unset and
                # SSH_ASKPASS_REQUIRE=force is set (OpenSSH ≥ 8.4).
                with tempfile.NamedTemporaryFile(
                    mode="w", suffix=".sh", delete=False
                ) as askpass_f:
                    askpass_f.write(f"#!/bin/sh\necho {shlex.quote(ssh_passphrase)}\n")
                    askpass_script = askpass_f.name
                os.chmod(askpass_script, stat.S_IRWXU)
                env["SSH_ASKPASS"] = askpass_script
                env["SSH_ASKPASS_REQUIRE"] = "force"
                env.pop("DISPLAY", None)

            logger.info(
                "Running ansible-playbook %s for %s (user=%s, port=%d)",
                playbook_filename,
                ip_address,
                ansible_user,
                ansible_port,
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

            logger.debug("ansible-playbook exit=%d", process.returncode)
            if stdout_text:
                logger.debug("stdout: %s", stdout_text[:500])

            if process.returncode != 0:
                combined = (stdout_text + "\n" + stderr_text).strip()
                logger.error(
                    "ansible-playbook failed (exit=%d):\n%s",
                    process.returncode,
                    combined[:2000],
                )

                # Extract the most specific fatal/unreachable message from Ansible output.
                fatal_match = re.search(r'fatal:.*?"msg":\s*"([^"]+)"', combined)
                if fatal_match:
                    error_msg = fatal_match.group(1)
                elif combined:
                    error_msg = combined
                else:
                    error_msg = (
                        f"ansible-playbook exited with code {process.returncode}"
                    )

                return {
                    "status": "error",
                    "error": error_msg,
                    "output": None,
                }

            try:
                with open(facts_dest) as f:
                    data = json.load(f)
            except FileNotFoundError:
                return {
                    "status": "error",
                    "error": "Result file was not created — playbook may have failed silently",
                    "output": None,
                }
            except json.JSONDecodeError as e:
                return {
                    "status": "error",
                    "error": f"Failed to parse result JSON: {e}",
                    "output": None,
                }

            return {"status": "success", "data": data, "ip_address": ip_address}

        finally:
            for path in (facts_dest, askpass_script):
                if path:
                    try:
                        os.unlink(path)
                    except FileNotFoundError:
                        pass

    async def _execute_get_facts(
        self, params: dict, publish_progress: Optional[Callable] = None
    ) -> dict:
        """
        Gather Ansible facts from a target host and return the JSON data.

        See _run_ansible_playbook for supported auth modes and optional params.
        """
        result = await self._run_ansible_playbook(params, "get_facts.yml")
        if result["status"] != "success":
            return result

        facts = result["data"]
        ip_address = result["ip_address"]
        hostname = (
            facts.get("ansible_fqdn") or facts.get("ansible_hostname") or ip_address
        )
        logger.info("Facts gathered for %s (hostname=%s)", ip_address, hostname)

        return {
            "status": "success",
            "output": {
                "facts": facts,
                "ip_address": ip_address,
                "hostname": hostname,
            },
            "error": None,
        }

    async def _execute_get_open_ports(
        self, params: dict, publish_progress: Optional[Callable] = None
    ) -> dict:
        """
        Scan open TCP/UDP listening ports on a target host and return the result.

        See _run_ansible_playbook for supported auth modes and optional params —
        identical connection contract to get_facts.
        """
        result = await self._run_ansible_playbook(params, "scan_open_ports.yml")
        if result["status"] != "success":
            return result

        data = result["data"]
        ip_address = result["ip_address"]
        hostname = data.get("hostname") or ip_address
        logger.info("Open ports scanned for %s (hostname=%s)", ip_address, hostname)

        return {
            "status": "success",
            "output": {
                "tcp_ports": data.get("tcp_ports", []),
                "udp_ports": data.get("udp_ports", []),
                "ip_address": data.get("ip_address") or ip_address,
                "hostname": hostname,
            },
            "error": None,
        }
