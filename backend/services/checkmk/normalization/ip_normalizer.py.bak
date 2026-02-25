"""IP address normalization for device data."""

import ipaddress
import logging
from typing import Dict, Any

from models.nb2cmk import DeviceExtensions

logger = logging.getLogger(__name__)


class IPNormalizer:
    """Handles IP address processing and validation."""

    def process_ip_address(
        self, device_data: Dict[str, Any], extensions: DeviceExtensions
    ) -> None:
        """Process and set IP address attribute.

        Args:
            device_data: Device data from Nautobot
            extensions: Extensions object to update
        """
        primary_ip4 = device_data.get("primary_ip4")
        if primary_ip4 and primary_ip4.get("address"):
            ip_address = primary_ip4.get("address")
            # Remove CIDR notation (e.g., "192.168.1.1/24" becomes "192.168.1.1")
            extensions.attributes["ipaddress"] = (
                ip_address.split("/")[0] if "/" in ip_address else ip_address
            )
        else:
            extensions.attributes["ipaddress"] = ""

    def extract_device_ip(self, device_data: Dict[str, Any]) -> str:
        """Extract IP address from device data.

        Args:
            device_data: Device data from Nautobot

        Returns:
            IP address string without CIDR notation
        """
        primary_ip4 = device_data.get("primary_ip4")
        if primary_ip4 and primary_ip4.get("address"):
            ip_address = primary_ip4.get("address")
            return ip_address.split("/")[0] if "/" in ip_address else ip_address
        return ""

    def process_ip_based_attributes(
        self, device_ip: str, by_ip_config: Dict[str, Any], extensions: DeviceExtensions
    ) -> None:
        """Process IP-based additional attributes.

        Args:
            device_ip: Device IP address
            by_ip_config: IP-based configuration
            extensions: Extensions object to update
        """
        try:
            device_ip_obj = ipaddress.ip_address(device_ip)

            # Check each IP/CIDR in by_ip config
            for ip_or_cidr, additional_attrs in by_ip_config.items():
                try:
                    # Try to parse as network (CIDR) first
                    try:
                        network = ipaddress.ip_network(ip_or_cidr, strict=False)
                        if device_ip_obj in network:
                            if isinstance(additional_attrs, dict):
                                extensions.attributes.update(additional_attrs)
                                logger.info(
                                    "Added additional attributes for device IP '%s' matching '%s': %s",
                                    device_ip,
                                    ip_or_cidr,
                                    list(additional_attrs.keys()),
                                )
                    except ipaddress.AddressValueError:
                        # Not a valid network, try as single IP
                        try:
                            single_ip = ipaddress.ip_address(ip_or_cidr)
                            if device_ip_obj == single_ip:
                                if isinstance(additional_attrs, dict):
                                    extensions.attributes.update(additional_attrs)
                                    logger.info(
                                        f"Added additional attributes for device IP '{device_ip}' matching '{ip_or_cidr}': {list(additional_attrs.keys())}"
                                    )
                        except ipaddress.AddressValueError:
                            logger.warning(
                                f"Invalid IP address or CIDR in additional_attributes config: {ip_or_cidr}"
                            )
                except Exception as e:
                    logger.warning(
                        f"Error processing additional_attributes IP rule '{ip_or_cidr}': {e}"
                    )
                    continue

        except ipaddress.AddressValueError:
            logger.warning(
                f"Invalid device IP address for additional_attributes: {device_ip}"
            )
