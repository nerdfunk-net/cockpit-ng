"""
Command executor for Cockpit Netmiko Agent
Handles SSH command execution on network devices via Netmiko
"""

import logging
import time
from typing import Any, Callable, Dict, List, Optional

from cryptography.fernet import Fernet, InvalidToken
from netmiko import ConnectHandler
from netmiko.exceptions import NetmikoAuthenticationException, NetmikoTimeoutException

from config import config

logger = logging.getLogger(__name__)


def _decrypt_password(encrypted: str) -> str:
    """Fernet-decrypt a device password that was encrypted by the backend."""
    try:
        f = Fernet(config.fernet_key)
        return f.decrypt(encrypted.encode()).decode()
    except InvalidToken as e:
        raise ValueError(
            "Failed to decrypt password — shared secret mismatch or tampered data"
        ) from e


def _run_netmiko(
    ip_address: str,
    device_type: str,
    username: str,
    password_encrypted: str,
    commands: List[str],
    *,
    enable_mode: bool = False,
    write_config: bool = False,
    use_textfsm: bool = False,
    privileged: bool = False,
) -> Dict[str, Any]:
    """
    Connect to a device via Netmiko and execute commands.

    Mirrors backend/services/network/automation/connection.py:connect_and_execute()
    with the addition of Fernet password decryption.
    """
    host_ip = ip_address.split("/")[0] if "/" in ip_address else ip_address

    result: Dict[str, Any] = {
        "device": host_ip,
        "success": False,
        "output": "",
        "command_outputs": {},
        "error": None,
    }

    password = _decrypt_password(password_encrypted)

    try:
        logger.info("Connecting to device %s (type: %s)", host_ip, device_type)

        device_params = {
            "device_type": device_type,
            "host": host_ip,
            "username": username,
            "password": password,
            "timeout": config.netmiko_timeout,
            "session_timeout": config.netmiko_timeout * 2,
        }

        with ConnectHandler(**device_params) as conn:
            logger.info("Connected to %s", host_ip)

            if privileged:
                try:
                    conn.enable()
                except Exception as exc:
                    logger.warning(
                        "Could not enter privileged mode on %s: %s", host_ip, exc
                    )

            command_outputs: Dict[str, Any] = {}
            output = ""

            if enable_mode:
                output = conn.send_config_set(commands)
            else:
                for idx, cmd in enumerate(commands, 1):
                    logger.info(
                        "Executing command %d/%d on %s: %s",
                        idx,
                        len(commands),
                        host_ip,
                        cmd,
                    )
                    raw = conn.send_command(cmd, use_textfsm=False, read_timeout=30)

                    if output:
                        output += "\n"
                    output += raw

                    if use_textfsm:
                        try:
                            from netmiko.utilities import get_structured_data  # type: ignore[import]

                            parsed = get_structured_data(
                                raw, platform=device_type, command=cmd
                            )
                            command_outputs[cmd] = parsed if parsed else raw
                        except Exception as parse_err:
                            logger.warning(
                                "TextFSM parse failed for '%s': %s", cmd, parse_err
                            )
                            command_outputs[cmd] = raw
                    else:
                        command_outputs[cmd] = raw

            if write_config:
                try:
                    save_out = conn.send_command(
                        "copy running-config startup-config",
                        expect_string=r"Destination filename",
                        read_timeout=30,
                    )
                    save_out += conn.send_command(
                        "\n", expect_string=None, read_timeout=30
                    )
                    command_outputs["write_config"] = save_out
                    output += f"\n{save_out}"
                except Exception as save_err:
                    logger.warning(
                        "Failed to write config on %s: %s", host_ip, save_err
                    )
                    command_outputs["write_config_error"] = str(save_err)

            result["success"] = True
            result["output"] = output
            result["command_outputs"] = command_outputs

    except NetmikoTimeoutException as exc:
        logger.error("Timeout on %s: %s", host_ip, exc)
        result["error"] = f"Connection timeout: {exc}"
    except NetmikoAuthenticationException as exc:
        logger.error("Auth failed for %s: %s", host_ip, exc)
        result["error"] = f"Authentication failed: {exc}"
    except ValueError as exc:
        logger.error("Credential error for %s: %s", host_ip, exc)
        result["error"] = str(exc)
    except Exception as exc:
        logger.error("Unexpected error on %s: %s", host_ip, exc)
        result["error"] = f"Unexpected error: {exc}"

    return result


class CommandExecutor:
    """Pluggable command executor with handler registry"""

    def __init__(self):
        self.handlers: Dict[str, Callable] = {}
        self._register_builtin_commands()

    def _register_builtin_commands(self):
        self.register("echo", self._execute_echo)
        self.register("get_running_config", self._execute_get_running_config)
        self.register("get_startup_config", self._execute_get_startup_config)
        self.register("execute_commands", self._execute_commands)

    def register(self, command_name: str, handler: Callable):
        self.handlers[command_name] = handler
        logger.info("Registered command handler: %s", command_name)

    async def execute(
        self,
        command: str,
        params: dict,
        publish_progress: Optional[Callable] = None,
    ) -> dict:
        """Execute a command by name. Returns dict with status, output, error, execution_time_ms."""
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

    # ------------------------------------------------------------------
    # Built-in commands
    # ------------------------------------------------------------------

    async def _execute_echo(
        self, params: dict, publish_progress: Optional[Callable] = None
    ) -> dict:
        message = params.get("message", "pong")
        logger.info("Echo: %s", message)
        return {"status": "success", "output": message, "error": None}

    async def _execute_get_running_config(
        self, params: dict, publish_progress: Optional[Callable] = None
    ) -> dict:
        """
        Retrieve running configuration from a network device.

        Expected params:
            ip_address   (required)
            device_type  (required)  e.g. "cisco_ios"
            username     (required)
            password     (required, Fernet-encrypted)
            privileged   (optional, default False)
        """
        err = _validate_device_params(params)
        if err:
            return {"status": "error", "error": err, "output": None}

        result = _run_netmiko(
            ip_address=params["ip_address"],
            device_type=params["device_type"],
            username=params["username"],
            password_encrypted=params["password"],
            commands=["show running-config"],
            privileged=params.get("privileged", False),
        )

        return _netmiko_result_to_response(result)

    async def _execute_get_startup_config(
        self, params: dict, publish_progress: Optional[Callable] = None
    ) -> dict:
        """
        Retrieve startup configuration from a network device.

        Expected params: same as get_running_config
        """
        err = _validate_device_params(params)
        if err:
            return {"status": "error", "error": err, "output": None}

        result = _run_netmiko(
            ip_address=params["ip_address"],
            device_type=params["device_type"],
            username=params["username"],
            password_encrypted=params["password"],
            commands=["show startup-config"],
            privileged=params.get("privileged", False),
        )

        return _netmiko_result_to_response(result)

    async def _execute_commands(
        self, params: dict, publish_progress: Optional[Callable] = None
    ) -> dict:
        """
        Execute arbitrary commands on a network device.

        Expected params:
            ip_address   (required)
            device_type  (required)
            username     (required)
            password     (required, Fernet-encrypted)
            commands     (required) list of command strings
            enable_mode  (optional, default False) — enter configure terminal
            write_config (optional, default False) — copy running-config startup-config
            use_textfsm  (optional, default False) — parse output with TextFSM
            privileged   (optional, default False) — enter enable/privileged mode
        """
        err = _validate_device_params(params)
        if err:
            return {"status": "error", "error": err, "output": None}

        commands = params.get("commands")
        if not commands or not isinstance(commands, list):
            return {
                "status": "error",
                "error": "commands must be a non-empty list",
                "output": None,
            }

        result = _run_netmiko(
            ip_address=params["ip_address"],
            device_type=params["device_type"],
            username=params["username"],
            password_encrypted=params["password"],
            commands=commands,
            enable_mode=params.get("enable_mode", False),
            write_config=params.get("write_config", False),
            use_textfsm=params.get("use_textfsm", False),
            privileged=params.get("privileged", False),
        )

        return _netmiko_result_to_response(result)


# ------------------------------------------------------------------
# Private helpers
# ------------------------------------------------------------------


def _validate_device_params(params: dict) -> Optional[str]:
    """Return an error string if required device params are missing, else None."""
    for field in ("ip_address", "device_type", "username", "password"):
        if not params.get(field):
            return f"{field} is required"
    return None


def _netmiko_result_to_response(result: Dict[str, Any]) -> dict:
    """Convert a _run_netmiko result dict to the executor response format."""
    if result["success"]:
        return {
            "status": "success",
            "output": {
                "device": result["device"],
                "output": result["output"],
                "command_outputs": result["command_outputs"],
            },
            "error": None,
        }
    return {
        "status": "error",
        "output": None,
        "error": result["error"],
    }
