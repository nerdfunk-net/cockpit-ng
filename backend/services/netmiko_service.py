"""
Netmiko service for executing commands on network devices.
"""

from __future__ import annotations
import logging
from typing import List, Dict, Any
from netmiko import ConnectHandler
from netmiko.exceptions import NetmikoTimeoutException, NetmikoAuthenticationException
import asyncio
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)


class NetmikoService:
    """Service for handling Netmiko command execution."""

    def __init__(self):
        """Initialize the service."""
        self.executor = ThreadPoolExecutor(max_workers=10)

    def _connect_and_execute(
        self,
        device_ip: str,
        device_type: str,
        username: str,
        password: str,
        commands: List[str],
        enable_mode: bool = False,
        write_config: bool = False,
    ) -> Dict[str, Any]:
        """
        Connect to a device and execute commands.

        Args:
            device_ip: IP address of the device (can be CIDR notation)
            device_type: Device type (e.g., cisco_ios, cisco_nxos)
            username: SSH username
            password: SSH password
            commands: List of commands to execute
            enable_mode: Whether to enter config mode
            write_config: Whether to save config after successful execution

        Returns:
            Dictionary with execution results
        """
        # Extract host part if IP is in CIDR notation (e.g., 192.168.1.1/24)
        host_ip = device_ip.split('/')[0] if '/' in device_ip else device_ip

        result = {
            "device": host_ip,
            "success": False,
            "output": "",
            "error": None,
        }

        try:
            logger.info(f"Connecting to device {host_ip} (type: {device_type})")

            # Device connection parameters
            device = {
                "device_type": device_type,
                "host": host_ip,
                "username": username,
                "password": password,
                "timeout": 30,
                "session_timeout": 60,
            }

            # Connect to the device
            with ConnectHandler(**device) as connection:
                logger.info(f"Successfully connected to {host_ip}")

                output = ""

                if enable_mode:
                    logger.info(f"Entering config mode on {host_ip}")
                    # send_config_set automatically:
                    # 1. Enters config mode (configure terminal)
                    # 2. Sends commands line by line
                    # 3. Exits config mode
                    # 4. Waits for prompt after each command
                    output = connection.send_config_set(commands)
                    logger.info(f"Config commands executed on {host_ip}")
                else:
                    # Execute commands in exec mode, line by line
                    for idx, command in enumerate(commands, 1):
                        logger.info(f"Executing command {idx}/{len(commands)} on {host_ip}: {command}")

                        # Send command and wait for prompt (Netmiko handles this)
                        cmd_output = connection.send_command(
                            command,
                            read_timeout=30,
                            expect_string=None  # Auto-detect prompt
                        )

                        # Format output with separators
                        output += f"\n{'='*60}\n"
                        output += f"Command {idx}: {command}\n"
                        output += f"{'='*60}\n"
                        output += cmd_output + "\n"

                # Save config if requested and execution was successful
                if write_config:
                    logger.info(f"Writing config to startup on {host_ip}")
                    try:
                        save_output = connection.send_command(
                            "copy running-config startup-config",
                            expect_string=r"Destination filename",
                            read_timeout=30
                        )
                        # Confirm by pressing enter (send empty line)
                        save_output += connection.send_command(
                            "\n",
                            expect_string=None,
                            read_timeout=30
                        )
                        output += f"\n{'='*60}\n"
                        output += "Save Config to Startup\n"
                        output += f"{'='*60}\n"
                        output += save_output + "\n"
                        logger.info(f"Config saved to startup on {host_ip}")
                    except Exception as save_error:
                        logger.warning(f"Failed to save config on {host_ip}: {save_error}")
                        output += f"\n{'='*60}\n"
                        output += "Save Config to Startup - WARNING\n"
                        output += f"{'='*60}\n"
                        output += f"Failed to save config: {str(save_error)}\n"

                result["success"] = True
                result["output"] = output
                logger.info(f"Command execution successful on {host_ip}")

        except NetmikoTimeoutException as e:
            error_msg = f"Connection timeout: {str(e)}"
            logger.error(f"Timeout connecting to {host_ip}: {e}")
            result["error"] = error_msg
        except NetmikoAuthenticationException as e:
            error_msg = f"Authentication failed: {str(e)}"
            logger.error(f"Authentication failed for {host_ip}: {e}")
            result["error"] = error_msg
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            logger.error(f"Error executing commands on {host_ip}: {e}")
            result["error"] = error_msg

        return result

    async def execute_commands(
        self,
        devices: List[Dict[str, str]],
        commands: List[str],
        username: str,
        password: str,
        enable_mode: bool = False,
        write_config: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Execute commands on multiple devices concurrently.

        Args:
            devices: List of device dicts with 'ip' and 'device_type'
            commands: List of commands to execute
            username: SSH username
            password: SSH password
            enable_mode: Whether to enter config mode
            write_config: Whether to save config after successful execution

        Returns:
            List of result dictionaries
        """
        logger.info(
            f"Starting command execution on {len(devices)} devices. "
            f"Commands: {len(commands)}, Enable mode: {enable_mode}, Write config: {write_config}"
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
                logger.warning(f"Skipping device without IP: {device.get('name', 'Unknown')}")
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
            )
            tasks.append(task)

        # Execute all tasks concurrently
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Task failed with exception: {result}")
                processed_results.append({
                    "device": devices[i].get("ip") or devices[i].get("primary_ip4", "Unknown"),
                    "success": False,
                    "output": "",
                    "error": str(result),
                })
            else:
                processed_results.append(result)

        # Log summary
        success_count = sum(1 for r in processed_results if r["success"])
        logger.info(
            f"Command execution completed. "
            f"Successful: {success_count}/{len(processed_results)}"
        )

        return processed_results

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
            f"Unknown platform '{platform}', defaulting to 'cisco_ios'. "
            f"You may need to adjust this mapping."
        )
        return "cisco_ios"


# Singleton instance
netmiko_service = NetmikoService()
