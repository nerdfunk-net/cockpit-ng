"""
Device onboarding service for Nautobot.

Handles onboarding devices via Nautobot's 'Sync Devices From Network' job.
"""

import logging
from typing import Dict, Any
from services.nautobot.client import NautobotService
from services.nautobot.resolvers import MetadataResolver, NetworkResolver
from services.nautobot.common.exceptions import NautobotAPIError

logger = logging.getLogger(__name__)


class DeviceOnboardingService:
    """Service for device onboarding operations."""

    def __init__(self, nautobot_service: NautobotService):
        """
        Initialize device onboarding service.

        Args:
            nautobot_service: Nautobot API client instance
        """
        self.nautobot = nautobot_service
        self.metadata_resolver = MetadataResolver(nautobot_service)
        self.network_resolver = NetworkResolver(nautobot_service)

    async def onboard_device(self, device_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Onboard a device via Nautobot 'Sync Devices From Network' job.

        Args:
            device_data: Device configuration data including:
                - location: Location UUID
                - ip_address: IP address of the device
                - secret_group_id: Secrets group UUID
                - role: Role name (will be resolved to UUID)
                - namespace: Namespace name (will be resolved to UUID)
                - status: Device status name (will be resolved to UUID)
                - interface_status: Interface status name (will be resolved to UUID)
                - ip_status: IP address status name (will be resolved to UUID)
                - platform: Platform name (will be resolved to UUID) or "auto-detect"
                - port: SSH port (default: 22)
                - timeout: Connection timeout (default: 30)
                - update_devices_without_primary_ip: Whether to update devices without primary IP

        Returns:
            API response from Nautobot job execution

        Raises:
            NautobotAPIError: If onboarding fails
        """
        try:
            # Debug: Log the input device data
            logger.debug("=== NAUTOBOT ONBOARD DEBUG ===")
            logger.debug("Input device_data: %s", device_data)

            # Extract data - location and secret_group_id should already be UUIDs
            location_id = device_data.get("location", "")
            secret_group_id = device_data.get("secret_group_id", "")

            # Resolve string names to UUIDs using resolvers
            role_name = device_data.get("role", "")
            role_id = (
                await self.metadata_resolver.resolve_role_id(role_name)
                if role_name
                else ""
            )

            namespace_name = device_data.get("namespace", "")
            namespace_id = (
                await self.network_resolver.resolve_namespace_id(namespace_name)
                if namespace_name
                else ""
            )

            device_status_name = device_data.get("status", "")
            device_status_id = (
                await self.metadata_resolver.resolve_status_id(
                    device_status_name, "dcim.device"
                )
                if device_status_name
                else ""
            )

            interface_status_name = device_data.get("interface_status", "")
            interface_status_id = (
                await self.metadata_resolver.resolve_status_id(
                    interface_status_name, "dcim.interface"
                )
                if interface_status_name
                else ""
            )

            ip_status_name = device_data.get("ip_status", "")
            ip_status_id = (
                await self.metadata_resolver.resolve_status_id(
                    ip_status_name, "ipam.ipaddress"
                )
                if ip_status_name
                else ""
            )

            platform_name = device_data.get("platform", "")
            # Handle special case for "auto-detect" platform or when UUID lookup fails
            if platform_name == "auto-detect":
                platform_id = None  # Use None for auto-detect
            elif platform_name:
                platform_id = await self.metadata_resolver.resolve_platform_id(
                    platform_name
                )
                logger.debug(
                    "Platform '%s' resolved to ID: %s", platform_name, platform_id
                )
                # If UUID lookup fails, use None instead of the platform name
                if not platform_id:
                    platform_id = None
            else:
                platform_id = None

            # Map the input data to the expected Nautobot API format
            # Using UUIDs instead of string names where resolved
            job_data = {
                "data": {
                    "location": location_id,
                    "ip_addresses": device_data.get("ip_address", ""),
                    "secrets_group": secret_group_id,
                    "device_role": role_id
                    or role_name,  # Fallback to name if resolution fails
                    "namespace": namespace_id or namespace_name,
                    "device_status": device_status_id or device_status_name,
                    "interface_status": interface_status_id or interface_status_name,
                    "ip_address_status": ip_status_id or ip_status_name,
                    "platform": platform_id,
                    "port": device_data.get("port", 22),
                    "timeout": device_data.get("timeout", 30),
                    "update_devices_without_primary_ip": device_data.get(
                        "update_devices_without_primary_ip", False
                    ),
                }
            }

            # Debug: Log the job data being sent to Nautobot
            logger.debug("Job data being sent to Nautobot:")
            logger.debug("  Original names -> UUIDs:")
            logger.debug("    role: '%s' -> '%s'", role_name, role_id)
            logger.debug("    namespace: '%s' -> '%s'", namespace_name, namespace_id)
            logger.debug(
                "    device_status: '%s' -> '%s'", device_status_name, device_status_id
            )
            logger.debug(
                "    interface_status: '%s' -> '%s'",
                interface_status_name,
                interface_status_id,
            )
            logger.debug("    ip_status: '%s' -> '%s'", ip_status_name, ip_status_id)
            logger.debug("    platform: '%s' -> '%s'", platform_name, platform_id)
            for key, value in job_data["data"].items():
                logger.debug("  %s: '%s' (type: %s)", key, value, type(value).__name__)
            logger.debug("Complete job_data: %s", job_data)
            logger.debug("=== END NAUTOBOT ONBOARD DEBUG ===")

            # Call the Nautobot 'Sync Devices From Network' job endpoint
            response = await self.nautobot.rest_request(
                "extras/jobs/Sync%20Devices%20From%20Network/run/",
                method="POST",
                data=job_data,
            )

            return response

        except Exception as e:
            logger.error("Device onboarding failed: %s", e)
            raise NautobotAPIError(f"Failed to onboard device: {str(e)}")
