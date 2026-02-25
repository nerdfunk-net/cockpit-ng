"""
Netmiko service for executing commands on network devices.
"""

from __future__ import annotations
import logging
from typing import List, Dict, Any, Set
from netmiko import ConnectHandler
from netmiko.exceptions import NetmikoTimeoutException, NetmikoAuthenticationException
import asyncio
from concurrent.futures import ThreadPoolExecutor
import uuid

logger = logging.getLogger(__name__)


class NetmikoService:
    """Service for handling Netmiko command execution."""

    def __init__(self):
        """Initialize the service."""
        self.executor = ThreadPoolExecutor(max_workers=10)
        self.active_sessions: Set[str] = set()  # Track active session IDs
        self.cancelled_sessions: Set[str] = set()  # Track cancelled session IDs

    def register_session(self, session_id: str) -> None:
        """
        Register a new execution session.

        Args:
            session_id: The session ID to register
        """
        self.active_sessions.add(session_id)
        logger.info("Session %s registered", session_id)

    def unregister_session(self, session_id: str) -> None:
        """
        Unregister an execution session.

        Args:
            session_id: The session ID to unregister
        """
        self.active_sessions.discard(session_id)
        self.cancelled_sessions.discard(session_id)
        logger.info("Session %s unregistered", session_id)

    def is_session_cancelled(self, session_id: str) -> bool:
        """
        Check if a session has been cancelled.

        Args:
            session_id: The session ID to check

        Returns:
            True if the session has been cancelled, False otherwise
        """
        return session_id in self.cancelled_sessions

    def cancel_session(self, session_id: str) -> None:
        """
        Cancel an execution session.

        Args:
            session_id: The session ID to cancel
        """
        self.cancelled_sessions.add(session_id)
        logger.info("Session %s marked for cancellation", session_id)

    def _connect_and_execute(
        self,
        device_ip: str,
        device_type: str,
        username: str,
        password: str,
        commands: List[str],
        enable_mode: bool = False,
        write_config: bool = False,
        use_textfsm: bool = False,
        session_id: str | None = None,
        privileged: bool = False,
    ) -> Dict[str, Any]:
        """
        Connect to a device and execute commands.

        Args:
            device_ip: IP address of the device (can be CIDR notation)
            device_type: Device type (e.g., cisco_ios, cisco_nxos)
            username: SSH username
            password: SSH password
            commands: List of commands to execute
            enable_mode: Whether to enter config mode (configure terminal)
            write_config: Whether to save config after successful execution
            use_textfsm: Whether to parse output using TextFSM (only for exec mode)
            session_id: Optional session ID for cancellation support
            privileged: Whether to enter privileged exec mode (enable)

        Returns:
            Dictionary with execution results
        """
        # Extract host part if IP is in CIDR notation (e.g., 192.168.1.1/24)
        host_ip = device_ip.split("/")[0] if "/" in device_ip else device_ip

        result = {
            "device": host_ip,
            "success": False,
            "output": "",
            "command_outputs": {},
            "error": None,
            "cancelled": False,
        }

        # Check if session has been cancelled before starting
        if session_id and session_id in self.cancelled_sessions:
            logger.info("Skipping device %s - session %s cancelled", host_ip, session_id)
            result["cancelled"] = True
            result["error"] = "Execution cancelled by user"
            return result

        try:
            logger.info("Connecting to device %s (type: %s)", host_ip, device_type)

            # Device connection parameters
            device = {
                "device_type": device_type,
                "host": host_ip,
                "username": username,
                "password": password,
                "timeout": 30,
                "session_timeout": 60,
                # "secret": password, # Use password as enable secret if needed
            }

            # Connect to the device
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

                command_outputs = {}
                output = ""

                if enable_mode:
                    logger.info("Entering config mode on %s", host_ip)
                    # send_config_set automatically:
                    # 1. Enters config mode (configure terminal)
                    # 2. Sends commands line by line
                    # 3. Exits config mode
                    # 4. Waits for prompt after each command
                    output = connection.send_config_set(commands)
                    logger.info("Config commands executed on %s", host_ip)
                else:
                    # Execute commands in exec mode, line by line
                    for idx, command in enumerate(commands, 1):
                        logger.info(
                            "Executing command %s/%s on %s: %s", idx, len(commands), host_ip, command
                        )

                        # Get raw output from device (execute once)
                        raw_output = connection.send_command(
                            command,
                            use_textfsm=False,
                            read_timeout=30,
                            expect_string=None,  # Auto-detect prompt
                        )

                        # Add raw output to concatenated output
                        if output:
                            output += "\n"
                        output += raw_output

                        # If TextFSM parsing is requested, parse the raw output we already have
                        if use_textfsm:
                            logger.info(
                                "Parsing command output with TextFSM for: %s", command
                            )
                            try:
                                # Use netmiko's textfsm parsing on the raw output
                                from netmiko.utilities import get_structured_data

                                parsed_output = get_structured_data(
                                    raw_output, platform=device_type, command=command
                                )

                                # Store parsed output if we got structured data
                                if parsed_output:
                                    command_outputs[command] = parsed_output
                                    logger.info(
                                        "Successfully parsed output for: %s", command
                                    )
                                else:
                                    # No TextFSM template available, store raw output
                                    logger.info(
                                        "No TextFSM template available for: %s", command
                                    )
                                    command_outputs[command] = raw_output
                            except Exception as parse_error:
                                logger.warning(
                                    "TextFSM parsing failed for command '%s': %s", command, parse_error
                                )
                                # Store raw output if parsing fails
                                command_outputs[command] = raw_output
                        else:
                            # Store raw output in command_outputs if no parsing requested
                            command_outputs[command] = raw_output

                # Save config if requested and execution was successful
                if write_config:
                    logger.info("Writing config to startup on %s", host_ip)
                    try:
                        save_output = connection.send_command(
                            "copy running-config startup-config",
                            expect_string=r"Destination filename",
                            read_timeout=30,
                        )
                        # Confirm by pressing enter (send empty line)
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
            error_msg = f"Connection timeout: {str(e)}"
            logger.error("Timeout connecting to %s: %s", host_ip, e)
            result["error"] = error_msg
        except NetmikoAuthenticationException as e:
            error_msg = f"Authentication failed: {str(e)}"
            logger.error("Authentication failed for %s: %s", host_ip, e)
            result["error"] = error_msg
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            logger.error("Error executing commands on %s: %s", host_ip, e)
            result["error"] = error_msg

        return result

    async def execute_commands_on_device(
        self,
        device_ip: str,
        platform: str,
        username: str,
        password: str,
        commands: List[str],
        enable_mode: bool = False,
        write_config: bool = False,
        use_textfsm: bool = False,
        session_id: str | None = None,
    ) -> Dict[str, Any]:
        """
        Execute commands on a single device.

        Args:
            device_ip: IP address of the device
            platform: Device platform (e.g., 'cisco_ios', 'arista_eos')
            username: SSH username
            password: SSH password
            commands: List of commands to execute
            enable_mode: Whether to enter config mode
            write_config: Whether to save config after successful execution
            use_textfsm: Whether to parse output using TextFSM (only for exec mode)
            session_id: Optional session ID for cancellation support

        Returns:
            Result dictionary with success, output, and error fields
        """
        device_type = self._map_platform_to_device_type(platform)

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            self.executor,
            self._connect_and_execute,
            device_ip,
            device_type,
            username,
            password,
            commands,
            enable_mode,
            write_config,
            use_textfsm,
            session_id,
        )

        return result

    async def execute_commands(
        self,
        devices: List[Dict[str, str]],
        commands: List[str],
        username: str,
        password: str,
        enable_mode: bool = False,
        write_config: bool = False,
        use_textfsm: bool = False,
        session_id: str | None = None,
    ) -> tuple[str, List[Dict[str, Any]]]:
        """
        Execute commands on multiple devices concurrently.

        Args:
            devices: List of device dicts with 'ip' and 'device_type'
            commands: List of commands to execute
            username: SSH username
            password: SSH password
            enable_mode: Whether to enter config mode
            write_config: Whether to save config after successful execution
            use_textfsm: Whether to parse output using TextFSM (only for exec mode)
            session_id: Optional session ID for cancellation support

        Returns:
            Tuple of (session_id, list of result dictionaries)
        """
        # Generate session ID if not provided
        if not session_id:
            session_id = str(uuid.uuid4())

        logger.info(
            "Starting command execution on %s devices (session: %s). Commands: %s, Enable mode: %s, Write config: %s, Use TextFSM: %s",
            len(devices), session_id, len(commands), enable_mode, write_config, use_textfsm,
        )

        # Create tasks for all devices
        tasks = []
        loop = asyncio.get_event_loop()

        for device in devices:
            device_ip = device.get("ip") or device.get("primary_ip4", "")
            device_type = self._map_platform_to_device_type(
                device.get("platform", "cisco_ios")
            )

            if not device_ip:
                logger.warning(
                    "Skipping device without IP: %s", device.get('name', 'Unknown')
                )
                continue

            # Run the synchronous netmiko operation in a thread pool
            task = loop.run_in_executor(
                self.executor,
                self._connect_and_execute,
                device_ip,
                device_type,
                username,
                password,
                commands,
                enable_mode,
                write_config,
                use_textfsm,
                session_id,
            )
            tasks.append(task)

        # Execute all tasks concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error("Task failed with exception: %s", result)
                processed_results.append(
                    {
                        "device": devices[i].get("ip")
                        or devices[i].get("primary_ip4", "Unknown"),
                        "success": False,
                        "output": "",
                        "error": str(result),
                    }
                )
            else:
                processed_results.append(result)

        # Log summary
        success_count = sum(1 for r in processed_results if r["success"])
        cancelled_count = sum(1 for r in processed_results if r.get("cancelled", False))
        logger.info(
            "Command execution completed (session: %s). Successful: %s/%s, Cancelled: %s",
            session_id, success_count, len(processed_results), cancelled_count,
        )

        # Clean up cancelled session from tracking
        if session_id in self.cancelled_sessions:
            self.cancelled_sessions.remove(session_id)
            logger.info("Cleaned up cancelled session: %s", session_id)

        return session_id, processed_results

    def _map_platform_to_device_type(self, platform: str) -> str:
        """
        Map Nautobot platform names to Netmiko device types.

        Args:
            platform: Platform name from Nautobot

        Returns:
            Netmiko device type string
        """
        platform_lower = platform.lower()

        # Mapping of common platform names to Netmiko device types
        mapping = {
            "ios": "cisco_ios",
            "cisco_ios": "cisco_ios",
            "nxos": "cisco_nxos",
            "cisco_nxos": "cisco_nxos",
            "asa": "cisco_asa",
            "cisco_asa": "cisco_asa",
            "xe": "cisco_xe",
            "cisco_xe": "cisco_xe",
            "xr": "cisco_xr",
            "cisco_xr": "cisco_xr",
            "junos": "juniper_junos",
            "juniper": "juniper_junos",
            "juniper_junos": "juniper_junos",
            "arista": "arista_eos",
            "eos": "arista_eos",
            "arista_eos": "arista_eos",
            "hp": "hp_comware",
            "comware": "hp_comware",
            "hp_comware": "hp_comware",
        }

        # Check if platform matches any key
        for key, value in mapping.items():
            if key in platform_lower:
                return value

        # Default to cisco_ios if no match found
        logger.warning(
            "Unknown platform '%s', defaulting to 'cisco_ios'. You may need to adjust this mapping.",
            platform,
        )
        return "cisco_ios"


# Singleton instance
netmiko_service = NetmikoService()
