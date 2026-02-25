"""
Utility functions for determining CheckMK sites and device placement.
"""

from __future__ import annotations
import ipaddress
import logging
from typing import Dict, Any, Optional

from services.checkmk.config import config_service
from utils.cmk_folder_utils import parse_folder_value

logger = logging.getLogger(__name__)


def get_monitored_site(
    device_data: Dict[str, Any], checkmk_config: Optional[Dict[str, Any]] = None
) -> str:
    """Get the correct CheckMK site for a device based on configuration rules.

    Priority order: by_name > by_nautobot > by_ip > by_location > default

    Args:
        device_data: Device data from Nautobot

    Returns:
        CheckMK site name
    """
    try:
        config = config_service.load_checkmk_config()
        site_config = config.get("monitored_site", {})

        device_name = device_data.get("name", "")
        device_location = (
            device_data.get("location", {}).get("name", "")
            if device_data.get("location")
            else ""
        )
        device_ip = _extract_device_ip(device_data)

        # 1. Check by_name (highest priority)
        by_name_config = site_config.get("by_name", {})
        if device_name and device_name in by_name_config:
            logger.debug(
                f"Found site for device '{device_name}' by name: {by_name_config[device_name]}"
            )
            return by_name_config[device_name]

        # 2. Check by_nautobot (second priority)
        by_nautobot_config = site_config.get("by_nautobot")
        if by_nautobot_config:
            custom_field_data = device_data.get("_custom_field_data", {})
            if by_nautobot_config in custom_field_data:
                site_value = custom_field_data[by_nautobot_config]
                if site_value and site_value != "default":
                    logger.debug(
                        f"Found site for device '{device_name}' by Nautobot field '{by_nautobot_config}': {site_value}"
                    )
                    return site_value

        # 3. Check by_ip (third priority)
        by_ip_config = site_config.get("by_ip", {})
        if device_ip and by_ip_config:
            site = _match_ip_to_site(device_ip, by_ip_config)
            if site:
                logger.debug(
                    f"Found site for device '{device_name}' by IP '{device_ip}': {site}"
                )
                return site

        # 4. Check by_location (fourth priority)
        by_location_config = site_config.get("by_location", {})
        if (
            device_location
            and by_location_config
            and device_location in by_location_config
        ):
            logger.debug(
                f"Found site for device '{device_name}' by location '{device_location}': {by_location_config[device_location]}"
            )
            return by_location_config[device_location]

        # 5. Return default site
        logger.debug(f"Returning default site for device '{device_name}'")
        return config_service.get_default_site()

    except Exception as e:
        logger.error(f"Error determining site for device: {e}")
        return config_service.get_default_site()


def get_device_site_from_normalized_data(normalized_data: Dict[str, Any]) -> str:
    """Extract site from normalized device data, falling back to default site.

    Args:
        normalized_data: Normalized device data with attributes

    Returns:
        CheckMK site name
    """
    try:
        # Check if site is in the attributes
        attributes = normalized_data.get("attributes", {})
        if "site" in attributes and attributes["site"]:
            return attributes["site"]

        # Fall back to default site
        return config_service.get_default_site()

    except Exception as e:
        logger.error(f"Error getting device site from normalized data: {e}")
        return config_service.get_default_site()


def get_device_folder(
    device_data: Dict[str, Any], checkmk_config: Optional[Dict[str, Any]] = None
) -> str:
    """Get the correct CheckMK folder for a device based on configuration rules.

    Priority order: by_name > by_ip > by_location > default
    Role-based folder selection: Uses device role to determine folder configuration

    Args:
        device_data: Device data from Nautobot
        checkmk_config: Optional CheckMK configuration (unused, for compatibility)

    Returns:
        CheckMK folder path
    """

    try:
        config = config_service.load_checkmk_config()
        folders_config = config.get("folders", {})

        device_name = device_data.get("name", "")
        device_location = (
            device_data.get("location", {}).get("name", "")
            if device_data.get("location")
            else ""
        )
        device_ip = _extract_device_ip(device_data)

        # Extract device role
        device_role = (
            device_data.get("role", {}).get("name", "").lower()
            if device_data.get("role")
            else ""
        )

        # Determine which role configuration to use
        if device_role and device_role in folders_config:
            role_config = folders_config[device_role]
            logger.debug(f"Using role-specific folder config for role '{device_role}'")
        elif "default" in folders_config:
            role_config = folders_config["default"]
            logger.debug(f"Using default folder config (device role: '{device_role}')")
        else:
            logger.warning("No default folder configuration found")
            role_config = {}

        # 1. Check by_name first (highest priority)
        by_name_config = role_config.get("by_name", {})
        if device_name and device_name in by_name_config:
            folder_template = by_name_config[device_name]
            folder = parse_folder_value(folder_template, device_data)
            return folder.replace("//", "/")

        # 2. Check by_ip (second priority)
        by_ip_config = role_config.get("by_ip", {})
        if device_ip and by_ip_config:
            folder_template = _match_ip_to_folder(device_ip, by_ip_config)
            if folder_template:
                folder = parse_folder_value(folder_template, device_data)
                return folder.replace("//", "/")

        # 3. Check by_location (third priority)
        by_location_config = role_config.get("by_location", {})
        if (
            device_location
            and by_location_config
            and device_location in by_location_config
        ):
            folder_template = by_location_config[device_location]
            folder = parse_folder_value(folder_template, device_data)
            return folder.replace("//", "/")

        # 4. Use default folder (lowest priority) with template processing
        default_folder_template = role_config.get("default", "/")
        folder = parse_folder_value(default_folder_template, device_data)
        return folder.replace("//", "/")

    except Exception as e:
        logger.error(f"Error determining folder for device: {e}")
        return "/"


def _extract_device_ip(device_data: Dict[str, Any]) -> str:
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


def _match_ip_to_site(device_ip: str, by_ip_config: Dict[str, str]) -> Optional[str]:
    """Match device IP to a site based on IP/CIDR configuration.

    Args:
        device_ip: Device IP address
        by_ip_config: IP to site mapping configuration

    Returns:
        Site name if matched, None otherwise
    """
    try:
        device_ip_obj = ipaddress.ip_address(device_ip)

        # Check each CIDR network in by_ip config
        for cidr_network, site_value in by_ip_config.items():
            try:
                network = ipaddress.ip_network(cidr_network, strict=False)
                if device_ip_obj in network:
                    return site_value
            except ipaddress.AddressValueError:
                logger.warning(f"Invalid CIDR network in site config: {cidr_network}")
                continue

    except ipaddress.AddressValueError:
        logger.warning(f"Invalid device IP address for site matching: {device_ip}")

    return None


def _match_ip_to_folder(device_ip: str, by_ip_config: Dict[str, str]) -> Optional[str]:
    """Match device IP to a folder template based on IP/CIDR configuration.

    Args:
        device_ip: Device IP address
        by_ip_config: IP to folder mapping configuration

    Returns:
        Folder template if matched, None otherwise
    """
    try:
        device_ip_obj = ipaddress.ip_address(device_ip)

        # Check each CIDR network in by_ip config
        for cidr_network, folder_template in by_ip_config.items():
            try:
                network = ipaddress.ip_network(cidr_network, strict=False)
                if device_ip_obj in network:
                    return folder_template
            except ipaddress.AddressValueError:
                logger.warning(f"Invalid CIDR network in folder config: {cidr_network}")
                continue

    except ipaddress.AddressValueError:
        logger.warning(f"Invalid device IP address for folder matching: {device_ip}")

    return None
