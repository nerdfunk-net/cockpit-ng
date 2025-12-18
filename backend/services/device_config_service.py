"""
Device Configuration Service

Handles fetching device information from Nautobot and retrieving
configurations from network devices via SSH (Netmiko).
"""

import logging
from typing import Optional
from pathlib import Path

from services.nautobot import NautobotService
from services.netmiko_service import NetmikoService
from utils.netmiko_platform_mapper import NetmikoPlatformMapper

logger = logging.getLogger(__name__)


class DeviceConfigService:
    """
    Service for retrieving device configurations.

    Provides methods for:
    - Fetching device details from Nautobot (via GraphQL)
    - Connecting to devices and retrieving configs (via Netmiko/SSH)
    - Parsing configuration output
    - Saving configurations to disk
    """

    # GraphQL query for full device details (used for backup with templated paths)
    DEVICE_QUERY_FULL = """
    query getDevice($deviceId: ID!) {
      device(id: $deviceId) {
        id
        name
        hostname: name
        asset_tag
        serial
        _custom_field_data
        custom_field_data: _custom_field_data
        primary_ip4 {
          id
          address
          host
          mask_length
        }
        platform {
          id
          name
          manufacturer {
            id
            name
          }
        }
        device_type {
          id
          model
          manufacturer {
            id
            name
          }
        }
        role {
          id
          name
        }
        location {
          id
          name
          description
          location_type {
            id
            name
          }
          parent {
            id
            name
            description
            location_type {
              id
              name
            }
            parent {
              id
              name
              description
            }
          }
        }
        tenant {
          id
          name
          tenant_group {
            id
            name
          }
        }
        rack {
          id
          name
          rack_group {
            id
            name
          }
        }
        status {
          id
          name
        }
        tags {
          id
          name
        }
      }
    }
    """

    # GraphQL query for basic device details (minimal data)
    DEVICE_QUERY_BASIC = """
    query getDevice($deviceId: ID!) {
      device(id: $deviceId) {
        id
        name
        primary_ip4 {
          address
        }
        platform {
          name
        }
      }
    }
    """

    def __init__(self):
        """
        Initialize the DeviceConfigService with required dependencies.

        Creates instances of:
        - NautobotService: For GraphQL queries to Nautobot
        - NetmikoService: For SSH connections to network devices
        - NetmikoPlatformMapper: For platform name normalization

        Note:
            Services are created with default configurations. For custom
            configurations, consider dependency injection pattern.
        """
        self.nautobot_service = NautobotService()
        self.netmiko_service = NetmikoService()
        self.platform_mapper = NetmikoPlatformMapper()

    def fetch_device_from_nautobot(
        self,
        device_id: str,
        full_details: bool = True,
        device_index: Optional[int] = None,
    ) -> Optional[dict]:
        """
        Fetch comprehensive device information from Nautobot.

        Queries Nautobot's GraphQL API to retrieve device metadata including:
        - Basic device info (name, ID, serial, asset tag)
        - Network information (primary IP address)
        - Platform details (OS type, manufacturer)
        - Location hierarchy (data center, region, site)
        - Device role (access, core, distribution, etc.)
        - Custom fields

        Args:
            device_id: UUID of the device in Nautobot
            full_details: If True, uses DEVICE_QUERY_FULL (includes location hierarchy).
                        If False, uses DEVICE_QUERY_BASIC (minimal fields)
            device_index: Optional index for progress logging (e.g., "[1/10]")

        Returns:
            dict: Device data from Nautobot with all fields populated, or None if:
                - Device not found in Nautobot
                - Device has no primary IP address
                - GraphQL query fails

        Raises:
            ValueError: If device not found or has no primary IP address

        Example:
            >>> device = service.fetch_device_from_nautobot(
            ...     device_id="abc-123",
            ...     full_details=True,
            ...     device_index=1
            ... )
            >>> print(device['name'], device['primary_ip4']['address'])
        """
        log_prefix = f"[{device_index}]" if device_index else ""

        logger.info(f"{log_prefix} Fetching device details from Nautobot...")

        query = self.DEVICE_QUERY_FULL if full_details else self.DEVICE_QUERY_BASIC
        variables = {"deviceId": device_id}

        device_data = self.nautobot_service._sync_graphql_query(query, variables)

        if (
            not device_data
            or "data" not in device_data
            or not device_data["data"].get("device")
        ):
            logger.error(f"{log_prefix} ✗ Failed to get device data from Nautobot")
            logger.error(f"{log_prefix} Response: {device_data}")
            raise ValueError("Failed to fetch device data from Nautobot")

        device = device_data["data"]["device"]
        device_name = device.get("name", device_id)
        primary_ip = (
            device.get("primary_ip4", {}).get("address", "").split("/")[0]
            if device.get("primary_ip4")
            else None
        )
        platform = (
            device.get("platform", {}).get("name", "unknown")
            if device.get("platform")
            else "unknown"
        )

        logger.info(f"{log_prefix} ✓ Device data fetched from Nautobot")
        logger.info(f"{log_prefix}   - Name: {device_name}")
        logger.info(f"{log_prefix}   - Primary IP: {primary_ip or 'NOT SET'}")
        logger.info(f"{log_prefix}   - Platform: {platform}")

        if not primary_ip:
            logger.error(
                f"{log_prefix} ✗ Device has no primary IP address - cannot connect"
            )
            raise ValueError("No primary IP address")

        return device

    def retrieve_device_configs(
        self,
        device_ip: str,
        device_type: str,
        username: str,
        password: str,
        device_index: Optional[int] = None,
        device_name: Optional[str] = None,
    ) -> dict:
        """
        Retrieve running and startup configurations from a network device.

        Args:
            device_ip: Device IP address
            device_type: Netmiko device_type
            username: SSH username
            password: SSH password
            device_index: Optional device index for logging
            device_name: Optional device name for logging

        Returns:
            dict: {
                'success': bool,
                'command_outputs': dict,
                'output': str,
                'error': str (if failed)
            }

        Raises:
            Exception: If SSH connection or command execution fails
        """
        log_prefix = f"[{device_index}]" if device_index else ""
        display_name = device_name or device_ip

        logger.info(
            f"{log_prefix} Connecting to {display_name} ({device_ip}) via SSH..."
        )
        logger.info(f"{log_prefix}   - Username: {username}")
        logger.info(f"{log_prefix}   - Device type: {device_type}")

        # Connect and execute backup commands
        commands = ["show running-config", "show startup-config"]
        result = self.netmiko_service._connect_and_execute(
            device_ip=device_ip,
            device_type=device_type,
            username=username,
            password=password,
            commands=commands,
            enable_mode=False,
            privileged=True,
        )

        if not result["success"]:
            logger.error(f"{log_prefix} ✗ SSH connection or command execution failed")
            logger.error(f"{log_prefix} Error: {result.get('error')}")
            raise Exception(result.get("error", "SSH connection failed"))

        logger.info(f"{log_prefix} ✓ SSH connection successful")
        return result

    def parse_config_output(
        self,
        command_outputs: dict,
        fallback_output: str,
        device_index: Optional[int] = None,
    ) -> tuple[str, str]:
        """
        Parse running and startup configurations from command output.

        Args:
            command_outputs: Dictionary of command outputs from Netmiko
            fallback_output: Fallback output string if structured data missing
            device_index: Optional device index for logging

        Returns:
            tuple: (running_config, startup_config) as strings
        """
        log_prefix = f"[{device_index}]" if device_index else ""

        logger.info(f"{log_prefix} Parsing configuration output...")
        logger.debug(
            f"{log_prefix} Available command outputs keys: "
            f"{list(command_outputs.keys())}"
        )

        running_config = command_outputs.get("show running-config", "").strip()
        startup_config = command_outputs.get("show startup-config", "").strip()

        logger.debug(f"{log_prefix} Running config length: {len(running_config)}")
        logger.debug(f"{log_prefix} Startup config length: {len(startup_config)}")

        if not startup_config:
            logger.debug(
                f"{log_prefix} Startup config content (first 100 chars): "
                f"'{command_outputs.get('show startup-config', '')[:100]}'"
            )

        # Fallback to general output if structured data is missing
        if not running_config and not startup_config:
            logger.debug(f"{log_prefix} Using fallback output parsing")
            if "show startup-config" in fallback_output:
                parts = fallback_output.split("show startup-config")
                running_config = parts[0].strip()
                if len(parts) > 1:
                    startup_config = parts[1].strip()
            else:
                running_config = fallback_output.strip()

        # Validate we got configs
        if running_config:
            logger.info(f"{log_prefix} ✓ Running config: {len(running_config)} bytes")
        else:
            logger.warning(f"{log_prefix} ⚠ Running config is empty!")

        if startup_config:
            logger.info(f"{log_prefix} ✓ Startup config: {len(startup_config)} bytes")
        else:
            logger.info(f"{log_prefix} Startup config is empty or not retrieved")

        return running_config, startup_config

    def save_configs_to_disk(
        self,
        running_config: str,
        startup_config: str,
        device: dict,
        repo_path: Path,
        current_date: str,
        running_template: Optional[str] = None,
        startup_template: Optional[str] = None,
        device_index: Optional[int] = None,
    ) -> dict:
        """
        Save device configurations to disk.

        Args:
            running_config: Running configuration content
            startup_config: Startup configuration content
            device: Device data from Nautobot
            repo_path: Path to Git repository
            current_date: Timestamp string for file naming
            running_template: Optional template path for running config
            startup_template: Optional template path for startup config
            device_index: Optional device index for logging

        Returns:
            dict: {
                'running_file': Path to running config file,
                'startup_file': Path to startup config file (or None),
                'running_config_bytes': int,
                'startup_config_bytes': int
            }
        """
        log_prefix = f"[{device_index}]" if device_index else ""
        device_name = device.get("name", "unknown")

        # Generate file paths
        if running_template:
            from utils.path_template import replace_template_variables

            running_path = replace_template_variables(running_template, device)
            running_path = running_path.lstrip("/")
            logger.info(
                f"{log_prefix} Using templated running config path: {running_path}"
            )
        else:
            running_path = f"backups/{device_name}.{current_date}.running-config"
            logger.info(
                f"{log_prefix} Using default running config path: {running_path}"
            )

        if startup_template:
            from utils.path_template import replace_template_variables

            startup_path = replace_template_variables(startup_template, device)
            startup_path = startup_path.lstrip("/")
            logger.info(
                f"{log_prefix} Using templated startup config path: {startup_path}"
            )
        else:
            startup_path = f"backups/{device_name}.{current_date}.startup-config"
            logger.info(
                f"{log_prefix} Using default startup config path: {startup_path}"
            )

        running_file = repo_path / running_path
        startup_file = repo_path / startup_path

        # Ensure parent directories exist
        running_file.parent.mkdir(parents=True, exist_ok=True)
        startup_file.parent.mkdir(parents=True, exist_ok=True)

        logger.info(f"{log_prefix} Writing configs to disk...")
        running_file.write_text(running_config)
        logger.info(f"{log_prefix}   - Running config → {running_file.name}")

        startup_file_relative = None
        if startup_config:
            startup_file.write_text(startup_config)
            logger.info(f"{log_prefix}   - Startup config → {startup_file.name}")
            startup_file_relative = str(startup_file.relative_to(repo_path))

        return {
            "running_file": str(running_file.relative_to(repo_path)),
            "startup_file": startup_file_relative,
            "running_config_bytes": len(running_config),
            "startup_config_bytes": len(startup_config) if startup_config else 0,
        }
