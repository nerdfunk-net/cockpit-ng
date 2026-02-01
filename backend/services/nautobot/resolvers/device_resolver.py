"""
Device resolver for device and device-related entity resolution.
"""

import logging
from typing import Optional, Tuple
from .base_resolver import BaseResolver
from ..common.validators import is_valid_uuid

logger = logging.getLogger(__name__)


class DeviceResolver(BaseResolver):
    """Resolver for device and device-related entities."""

    async def resolve_device_by_name(self, device_name: str) -> Optional[str]:
        """
        Resolve device UUID from device name using GraphQL.

        Args:
            device_name: Name of the device to look up

        Returns:
            Device UUID if found, None otherwise
        """
        try:
            logger.info(f"Looking up device by name: {device_name}")

            query = """
            query GetDeviceByName($name: [String]) {
              devices(name: $name) {
                id
                name
              }
            }
            """
            variables = {"name": [device_name]}
            result = await self.nautobot.graphql_query(query, variables)

            if "errors" in result:
                logger.error(
                    f"GraphQL error looking up device by name: {result['errors']}"
                )
                return None

            devices = result.get("data", {}).get("devices", [])
            if devices and len(devices) > 0:
                device_id = devices[0].get("id")
                logger.info(f"Found device by name '{device_name}': {device_id}")
                return device_id

            logger.warning(f"No device found with name: {device_name}")
            return None

        except Exception as e:
            logger.error(f"Error resolving device by name: {e}", exc_info=True)
            return None

    async def resolve_device_by_ip(self, ip_address: str) -> Optional[str]:
        """
        Resolve device UUID from primary IPv4 address using GraphQL.

        Looks up the IP address object and returns the device it's assigned
        to as primary IP.

        Args:
            ip_address: Primary IPv4 address to search for

        Returns:
            Device UUID if found, None otherwise
        """
        try:
            logger.info(f"Looking up device by primary IPv4: {ip_address}")

            # Query for IP address and get the device it's assigned to as primary IP
            query = """
            query GetIPAddress($address: [String]) {
              ip_addresses(address: $address) {
                id
                address
                primary_ip4_for {
                  id
                  name
                }
              }
            }
            """
            variables = {"address": [ip_address]}
            result = await self.nautobot.graphql_query(query, variables)

            if "errors" in result:
                logger.error(f"GraphQL error looking up IP address: {result['errors']}")
                return None

            ip_addresses = result.get("data", {}).get("ip_addresses", [])
            if not ip_addresses or len(ip_addresses) == 0:
                logger.warning(f"No IP address found: {ip_address}")
                return None

            # Get the device from primary_ip4_for
            ip_obj = ip_addresses[0]
            devices = ip_obj.get("primary_ip4_for")

            if not devices:
                logger.warning(
                    f"IP address {ip_address} is not set as primary IP for any device"
                )
                return None

            # primary_ip4_for can be a list or a single device
            if isinstance(devices, list):
                if len(devices) == 0:
                    logger.warning(
                        f"IP address {ip_address} is not set as primary IP for any device"
                    )
                    return None
                device = devices[0]
            else:
                device = devices

            device_id = device.get("id")
            device_name = device.get("name")
            logger.info(
                f"Found device by IP '{ip_address}': {device_name} ({device_id})"
            )
            return device_id

        except Exception as e:
            logger.error(f"Error resolving device by IP: {e}", exc_info=True)
            return None

    async def resolve_device_id(
        self,
        device_id: Optional[str] = None,
        device_name: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> Optional[str]:
        """
        Resolve device UUID from any available identifier.

        Tries in order: device_id (if valid), device_name, ip_address

        Args:
            device_id: Device UUID (if already known)
            device_name: Device name to search for
            ip_address: Primary IPv4 address to search for

        Returns:
            Device UUID if found, None otherwise
        """
        # If device_id is already provided, validate and return it
        if device_id:
            # Basic UUID validation
            if is_valid_uuid(device_id):
                logger.debug(f"Using provided device ID: {device_id}")
                return device_id
            else:
                logger.warning(f"Invalid device ID format: {device_id}")

        # Try resolving by name
        if device_name:
            device_id = await self.resolve_device_by_name(device_name)
            if device_id:
                return device_id

        # Try resolving by IP address
        if ip_address:
            device_id = await self.resolve_device_by_ip(ip_address)
            if device_id:
                return device_id

        logger.error("Could not resolve device ID from any identifier")
        return None

    async def resolve_device_type_id(
        self, model: str, manufacturer: Optional[str] = None
    ) -> Optional[str]:
        """
        Resolve device type (model) to UUID using GraphQL.

        Args:
            model: Device type model name
            manufacturer: Optional manufacturer name for disambiguation

        Returns:
            Device type UUID if found, None otherwise
        """
        try:
            logger.info(
                f"Resolving device type '{model}'"
                + (f" from manufacturer '{manufacturer}'" if manufacturer else "")
            )

            # Build query with optional manufacturer filter
            if manufacturer:
                query = """
                query GetDeviceType($model: [String], $manufacturer: [String]) {
                  device_types(model: $model, manufacturer: $manufacturer) {
                    id
                    model
                    manufacturer {
                      name
                    }
                  }
                }
                """
                variables = {"model": [model], "manufacturer": [manufacturer]}
            else:
                query = """
                query GetDeviceType($model: [String]) {
                  device_types(model: $model) {
                    id
                    model
                    manufacturer {
                      name
                    }
                  }
                }
                """
                variables = {"model": [model]}

            result = await self.nautobot.graphql_query(query, variables)

            if "errors" in result:
                logger.error(f"GraphQL error resolving device type: {result['errors']}")
                return None

            device_types = result.get("data", {}).get("device_types", [])
            if device_types and len(device_types) > 0:
                device_type = device_types[0]
                device_type_id = device_type["id"]
                mfr_name = device_type.get("manufacturer", {}).get("name", "unknown")
                logger.info(
                    f"Resolved device type '{model}' ({mfr_name}) to UUID {device_type_id}"
                )
                return device_type_id

            logger.warning(f"Device type not found: {model}")
            return None

        except Exception as e:
            logger.error(f"Error resolving device type: {e}", exc_info=True)
            return None

    async def get_device_type_display(self, device_type_id: str) -> Optional[str]:
        """
        Get device type display name from UUID using REST API.

        Args:
            device_type_id: Device type UUID

        Returns:
            Device type display name (e.g., "Cisco Catalyst 9300-48P") if found, None otherwise
        """
        try:
            logger.debug(f"Fetching device type display for UUID: {device_type_id}")

            result = await self.nautobot.rest_request(
                endpoint=f"dcim/device-types/{device_type_id}/", method="GET"
            )

            if result:
                # Try display field first (most descriptive), fall back to model
                display_name = result.get("display") or result.get("model")
                if display_name:
                    logger.debug(
                        f"Device type UUID {device_type_id} -> display: {display_name}"
                    )
                    return display_name

            logger.warning(f"Device type not found for UUID: {device_type_id}")
            return None

        except Exception as e:
            logger.error(f"Error fetching device type display: {e}", exc_info=True)
            return None

    async def find_interface_with_ip(
        self, device_name: str, ip_address: str
    ) -> Optional[Tuple[str, str]]:
        """
        Find the interface that currently has a specific IP address on a device.

        Args:
            device_name: Name of the device
            ip_address: IP address to search for (in CIDR notation, e.g., "10.0.0.1/24")

        Returns:
            Tuple of (interface_id, interface_name) if found, None otherwise
        """
        try:
            logger.info(
                f"Finding interface with IP {ip_address} on device {device_name}"
            )

            query = """
            query ($filter_device: [String], $filter_address: [String]) {
              devices(name: $filter_device) {
                id
                name
                interfaces(ip_addresses: $filter_address) {
                  id
                  name
                }
              }
            }
            """
            variables = {
                "filter_device": [device_name],
                "filter_address": [ip_address],
            }

            result = await self.nautobot.graphql_query(query, variables)

            if "errors" in result:
                logger.error(
                    f"GraphQL error finding interface with IP: {result['errors']}"
                )
                return None

            devices = result.get("data", {}).get("devices", [])
            if not devices or len(devices) == 0:
                logger.warning(f"Device '{device_name}' not found")
                return None

            device = devices[0]
            interfaces = device.get("interfaces", [])

            if not interfaces or len(interfaces) == 0:
                logger.info(
                    f"No interface found with IP {ip_address} on device {device_name}"
                )
                return None

            # Return the first interface with this IP
            interface = interfaces[0]
            interface_id = interface.get("id")
            interface_name = interface.get("name")

            logger.info(
                f"Found interface '{interface_name}' (ID: {interface_id}) with IP {ip_address}"
            )
            return (interface_id, interface_name)

        except Exception as e:
            logger.error(f"Error finding interface with IP: {e}", exc_info=True)
            return None
