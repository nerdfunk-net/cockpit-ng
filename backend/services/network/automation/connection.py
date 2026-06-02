"""Low-level Netmiko SSH/Telnet connection and command execution."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from netmiko import ConnectHandler
from netmiko.exceptions import NetmikoAuthenticationException, NetmikoTimeoutException

from services.network.automation.session_registry import SessionRegistry

logger = logging.getLogger(__name__)


def connect_and_execute(
    device_ip: str,
    device_type: str,
    username: str,
    password: str,
    commands: List[str],
    registry: SessionRegistry,
    *,
    enable_mode: bool = False,
    write_config: bool = False,
    use_textfsm: bool = False,
    session_id: Optional[str] = None,
    privileged: bool = False,
) -> Dict[str, Any]:
    """Connect to a device and execute commands.

    Args:
        device_ip: IP address of the device (can be CIDR notation)
        device_type: Netmiko device type string (e.g., cisco_ios)
        username: SSH username
        password: SSH password
        commands: List of commands to execute
        registry: Session registry for cancellation checks
        enable_mode: Enter config mode (configure terminal) before sending commands
        write_config: Save config after successful execution
        use_textfsm: Parse output using TextFSM (exec mode only)
        session_id: Optional session ID for cancellation support
        privileged: Enter privileged exec mode (enable) before sending commands

    Returns:
        Dictionary with execution results (device, success, output, command_outputs,
        error, cancelled).
    """
    host_ip = device_ip.split("/")[0] if "/" in device_ip else device_ip

    result: Dict[str, Any] = {
        "device": host_ip,
        "success": False,
        "output": "",
        "command_outputs": {},
        "error": None,
        "cancelled": False,
    }

    if session_id and registry.is_cancelled(session_id):
        logger.info("Skipping device %s - session %s cancelled", host_ip, session_id)
        result["cancelled"] = True
        result["error"] = "Execution cancelled by user"
        return result

    try:
        logger.info("Connecting to device %s (type: %s)", host_ip, device_type)

        device = {
            "device_type": device_type,
            "host": host_ip,
            "username": username,
            "password": password,
            "timeout": 30,
            "session_timeout": 60,
        }

        with ConnectHandler(**device) as connection:
            logger.info("Successfully connected to %s", host_ip)

            if privileged:
                try:
                    logger.info("Entering privileged mode on %s", host_ip)
                    connection.enable()
                    logger.info("Privileged mode enabled")
                except Exception as e:
                    logger.warning(
                        "Failed to enter privileged mode on %s: %s", host_ip, e
                    )

            command_outputs: Dict[str, Any] = {}
            output = ""

            if enable_mode:
                logger.info("Entering config mode on %s", host_ip)
                output = connection.send_config_set(commands)
                logger.info("Config commands executed on %s", host_ip)
            else:
                for idx, command in enumerate(commands, 1):
                    logger.info(
                        "Executing command %s/%s on %s: %s",
                        idx,
                        len(commands),
                        host_ip,
                        command,
                    )

                    raw_output = connection.send_command(
                        command,
                        use_textfsm=False,
                        read_timeout=30,
                        expect_string=None,
                    )

                    if output:
                        output += "\n"
                    output += raw_output

                    if use_textfsm:
                        logger.info(
                            "Parsing command output with TextFSM for: %s", command
                        )
                        try:
                            from netmiko.utilities import get_structured_data

                            parsed_output = get_structured_data(
                                raw_output, platform=device_type, command=command
                            )

                            if parsed_output:
                                command_outputs[command] = parsed_output
                                logger.info(
                                    "Successfully parsed output for: %s", command
                                )
                            else:
                                logger.info(
                                    "No TextFSM template available for: %s", command
                                )
                                command_outputs[command] = raw_output
                        except Exception as parse_error:
                            logger.warning(
                                "TextFSM parsing failed for command '%s': %s",
                                command,
                                parse_error,
                            )
                            command_outputs[command] = raw_output
                    else:
                        command_outputs[command] = raw_output

            if write_config:
                logger.info("Writing config to startup on %s", host_ip)
                try:
                    save_output = connection.send_command(
                        "copy running-config startup-config",
                        expect_string=r"Destination filename",
                        read_timeout=30,
                    )
                    save_output += connection.send_command(
                        "\n", expect_string=None, read_timeout=30
                    )
                    command_outputs["write_config"] = save_output
                    output += f"\n{save_output}"
                    logger.info("Config saved to startup on %s", host_ip)
                except Exception as save_error:
                    logger.warning(
                        "Failed to save config on %s: %s", host_ip, save_error
                    )
                    command_outputs["write_config_error"] = str(save_error)

            result["success"] = True
            result["output"] = output
            result["command_outputs"] = command_outputs
            logger.info("Command execution successful on %s", host_ip)

    except NetmikoTimeoutException as e:
        logger.error("Timeout connecting to %s: %s", host_ip, e)
        result["error"] = f"Connection timeout: {str(e)}"
    except NetmikoAuthenticationException as e:
        logger.error("Authentication failed for %s: %s", host_ip, e)
        result["error"] = f"Authentication failed: {str(e)}"
    except Exception as e:
        logger.error("Error executing commands on %s: %s", host_ip, e)
        result["error"] = f"Unexpected error: {str(e)}"

    return result
