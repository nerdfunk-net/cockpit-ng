"""
Netmiko Platform Mapper Utility

Maps Nautobot platform names to Netmiko device types.
Extracted from backup_tasks.py for reusability and configuration.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


class NetmikoPlatformMapper:
    """
    Maps Nautobot platform names to Netmiko device types.

    This class provides a centralized mapping configuration for converting
    platform identifiers from Nautobot into the device_type parameter
    required by Netmiko for SSH connections.
    """

    # Platform mapping configuration
    # Format: {nautobot_platform_substring: netmiko_device_type}
    PLATFORM_MAP = {
        "ios": "cisco_ios",
        "cisco ios": "cisco_ios",
        "nxos": "cisco_nxos",
        "cisco nxos": "cisco_nxos",
        "asa": "cisco_asa",
        "cisco asa": "cisco_asa",
        "junos": "juniper_junos",
        "juniper": "juniper_junos",
        "arista": "arista_eos",
        "eos": "arista_eos",
        "hp": "hp_comware",
        "comware": "hp_comware",
        "palo alto": "paloalto_panos",
        "panos": "paloalto_panos",
        "fortinet": "fortinet",
        "fortigate": "fortinet",
    }

    DEFAULT_DEVICE_TYPE = "cisco_ios"

    @classmethod
    def map_to_netmiko(cls, platform: Optional[str]) -> str:
        """
        Map a Nautobot platform name to a Netmiko device type.

        Args:
            platform: Platform name from Nautobot (e.g., "Cisco IOS", "NXOS")

        Returns:
            str: Netmiko device_type (e.g., "cisco_ios", "cisco_nxos")

        Examples:
            >>> NetmikoPlatformMapper.map_to_netmiko("Cisco IOS")
            'cisco_ios'
            >>> NetmikoPlatformMapper.map_to_netmiko("NXOS")
            'cisco_nxos'
            >>> NetmikoPlatformMapper.map_to_netmiko(None)
            'cisco_ios'
        """
        if not platform:
            logger.warning(
                f"Platform is None or empty, defaulting to {cls.DEFAULT_DEVICE_TYPE}"
            )
            return cls.DEFAULT_DEVICE_TYPE

        platform_lower = platform.lower().strip()

        # Check each mapping key
        for key, device_type in cls.PLATFORM_MAP.items():
            if key in platform_lower:
                logger.debug(
                    f"Mapped platform '{platform}' to Netmiko type '{device_type}'"
                )
                return device_type

        # No match found - use default
        logger.warning(
            f"Unknown platform '{platform}', defaulting to {cls.DEFAULT_DEVICE_TYPE}"
        )
        return cls.DEFAULT_DEVICE_TYPE

    @classmethod
    def add_mapping(cls, platform_key: str, device_type: str) -> None:
        """
        Add a custom platform mapping.

        Args:
            platform_key: Platform substring to match (case-insensitive)
            device_type: Netmiko device_type to use

        Example:
            >>> NetmikoPlatformMapper.add_mapping("custom_os", "cisco_ios")
        """
        cls.PLATFORM_MAP[platform_key.lower()] = device_type
        logger.info(f"Added platform mapping: '{platform_key}' → '{device_type}'")

    @classmethod
    def get_supported_platforms(cls) -> list[str]:
        """
        Get list of all supported platform mappings.

        Returns:
            list: List of tuples (platform_key, device_type)
        """
        return list(cls.PLATFORM_MAP.items())


# Convenience function for backward compatibility
def map_platform_to_netmiko(platform: Optional[str]) -> str:
    """
    Convenience function that delegates to NetmikoPlatformMapper.

    Args:
        platform: Platform name from Nautobot

    Returns:
        str: Netmiko device_type
    """
    return NetmikoPlatformMapper.map_to_netmiko(platform)
