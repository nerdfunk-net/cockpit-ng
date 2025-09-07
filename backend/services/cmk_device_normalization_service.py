"""
Device normalization service for converting Nautobot device data to CheckMK format.
"""

from __future__ import annotations
import ipaddress
import logging
from typing import Dict, Any

from services.cmk_config_service import config_service
from utils.cmk_site_utils import get_device_site, get_device_folder
from models.nb2cmk import DeviceExtensions

logger = logging.getLogger(__name__)


class DeviceNormalizationService:
    """Service for normalizing Nautobot device data to CheckMK format."""

    def normalize_device(self, device_data: Dict[str, Any]) -> DeviceExtensions:
        """Normalize device data from Nautobot for CheckMK comparison.
        
        Args:
            device_data: Device data from Nautobot GraphQL query
            
        Returns:
            DeviceExtensions object with normalized configuration
            
        Raises:
            ValueError: If device data is invalid or missing required fields
        """
        if not device_data:
            raise ValueError("Device data cannot be empty")

        # Create the root extension dictionary
        extensions = DeviceExtensions(
            folder="",
            attributes={},
            internal={}
        )

        # Set hostname in internal dict (needed for CheckMK queries but not for comparison)
        extensions.internal["hostname"] = device_data.get("name", "")

        # Set site using utility function
        extensions.attributes["site"] = get_device_site(device_data, None)
        logger.info(
            f"Determined site for device {device_data.get('name', '')}: {extensions.attributes['site']}"
        )

        # Set folder using utility function
        extensions.folder = get_device_folder(device_data, None)

        # Set IP address from primary_ip4 (remove CIDR netmask for CheckMK compatibility)
        self._process_ip_address(device_data, extensions)

        # Process various configuration mappings
        self._process_snmp_config(device_data, extensions)
        self._process_additional_attributes(device_data, extensions)
        self._process_cf2htg_mappings(device_data, extensions)
        self._process_tags2htg_mappings(device_data, extensions)
        self._process_field_mappings(device_data, extensions)

        return extensions

    def _process_ip_address(self, device_data: Dict[str, Any], extensions: DeviceExtensions) -> None:
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

    def _process_snmp_config(self, device_data: Dict[str, Any], extensions: DeviceExtensions) -> None:
        """Process SNMP community mapping from custom fields.
        
        Args:
            device_data: Device data from Nautobot
            extensions: Extensions object to update
        """
        try:
            custom_field_data = device_data.get("_custom_field_data", {})
            snmp_credentials = custom_field_data.get("snmp_credentials")

            if not snmp_credentials:
                return

            snmp_mapping = config_service.load_snmp_mapping()

            if snmp_credentials in snmp_mapping:
                snmp_config = snmp_mapping[snmp_credentials]

                # Map SNMP configuration to normalized format
                snmp_community = {
                    "type": snmp_config.get("type", ""),
                    "auth_protocol": snmp_config.get("auth_protocol_long", ""),
                    "security_name": snmp_config.get("username", ""),
                    "auth_password": snmp_config.get("auth_password", ""),
                    "privacy_protocol": snmp_config.get("privacy_protocol_long", ""),
                    "privacy_password": snmp_config.get("privacy_password", ""),
                }

                extensions.attributes["snmp_community"] = snmp_community

                # Add tag_snmp_ds for SNMP version 2 or 3
                snmp_version = snmp_config.get("version")
                if snmp_version in [2, 3]:
                    extensions.attributes["tag_snmp_ds"] = "snmp-v2"
            else:
                logger.warning(
                    f"SNMP credentials key '{snmp_credentials}' not found in mapping"
                )

        except Exception as e:
            logger.error(f"Error processing SNMP configuration: {e}")
            # Don't fail the whole process, just log the error

    def _process_additional_attributes(self, device_data: Dict[str, Any], extensions: DeviceExtensions) -> None:
        """Process additional attributes configuration.
        
        Args:
            device_data: Device data from Nautobot
            extensions: Extensions object to update
        """
        try:
            config = config_service.load_checkmk_config()
            additional_attributes_config = config.get("additional_attributes", {})

            device_name = device_data.get("name", "")
            device_ip = self._extract_device_ip(device_data)

            # 1. Check by_name first (highest priority)
            by_name_config = additional_attributes_config.get("by_name", {})
            if device_name and device_name in by_name_config:
                additional_attrs = by_name_config[device_name]
                if isinstance(additional_attrs, dict):
                    extensions.attributes.update(additional_attrs)
                    logger.info(
                        f"Added additional attributes for device '{device_name}': {list(additional_attrs.keys())}"
                    )

            # 2. Check by_ip (second priority, can add more attributes)
            by_ip_config = additional_attributes_config.get("by_ip", {})
            if device_ip and by_ip_config:
                self._process_ip_based_attributes(device_ip, by_ip_config, extensions)

        except Exception as e:
            logger.error(f"Error processing additional_attributes for device: {e}")
            # Don't fail the whole process, just log the error

    def _process_ip_based_attributes(self, device_ip: str, by_ip_config: Dict[str, Any], extensions: DeviceExtensions) -> None:
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
                                    f"Added additional attributes for device IP '{device_ip}' matching '{ip_or_cidr}': {list(additional_attrs.keys())}"
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
            logger.warning(f"Invalid device IP address for additional_attributes: {device_ip}")

    def _process_cf2htg_mappings(self, device_data: Dict[str, Any], extensions: DeviceExtensions) -> None:
        """Process Custom Field to Host Tag Group mappings.
        
        Args:
            device_data: Device data from Nautobot
            extensions: Extensions object to update
        """
        try:
            config = config_service.load_checkmk_config()
            cf2htg_config = config.get("cf2htg", {})
            custom_field_data = device_data.get("_custom_field_data", {})
            device_name = device_data.get("name", "")

            if cf2htg_config and custom_field_data:
                for custom_field_name, host_tag_group_name in cf2htg_config.items():
                    if custom_field_name in custom_field_data:
                        custom_field_value = custom_field_data[custom_field_name]
                        if custom_field_value:  # Only add if value is not empty/None
                            tag_key = f"tag_{host_tag_group_name}"
                            extensions.attributes[tag_key] = str(custom_field_value)
                            logger.info(
                                f"Added host tag group for device '{device_name}': {tag_key} = {custom_field_value}"
                            )

        except Exception as e:
            logger.error(f"Error processing cf2htg mappings for device: {e}")
            # Don't fail the whole process, just log the error

    def _process_tags2htg_mappings(self, device_data: Dict[str, Any], extensions: DeviceExtensions) -> None:
        """Process Tags to Host Tag Group mappings.
        
        Args:
            device_data: Device data from Nautobot
            extensions: Extensions object to update
        """
        try:
            config = config_service.load_checkmk_config()
            tags2htg_config = config.get("tags2htg", {})
            device_name = device_data.get("name", "")

            if tags2htg_config and device_data.get("tags"):
                device_tags = device_data.get("tags", [])
                # Convert tags list to set of tag names for efficient lookup
                device_tag_names = {
                    tag.get("name")
                    for tag in device_tags
                    if isinstance(tag, dict) and tag.get("name")
                }

                for tag_name, host_tag_group_name in tags2htg_config.items():
                    tag_key = f"tag_{host_tag_group_name}"
                    if tag_name in device_tag_names:
                        extensions.attributes[tag_key] = "true"
                        logger.info(
                            f"Added host tag group for device '{device_name}': {tag_key} = true (tag '{tag_name}' found)"
                        )
                    else:
                        extensions.attributes[tag_key] = "false"
                        logger.info(
                            f"Added host tag group for device '{device_name}': {tag_key} = false (tag '{tag_name}' not found)"
                        )

        except Exception as e:
            logger.error(f"Error processing tags2htg mappings for device: {e}")
            # Don't fail the whole process, just log the error

    def _process_field_mappings(self, device_data: Dict[str, Any], extensions: DeviceExtensions) -> None:
        """Process field mappings from Nautobot to CheckMK attributes.
        
        Args:
            device_data: Device data from Nautobot
            extensions: Extensions object to update
        """
        try:
            config = config_service.load_checkmk_config()
            mapping_config = config.get("mapping", {})
            device_name = device_data.get("name", "")

            logger.info(f"Processing mapping config for device '{device_name}': {mapping_config}")

            # Log device data structure for debugging
            logger.info(f"Device data keys: {list(device_data.keys())}")
            if "_custom_field_data" in device_data:
                logger.info(f"_custom_field_data content: {device_data['_custom_field_data']}")
            else:
                logger.info("No _custom_field_data found in device data")

            if mapping_config:
                for nautobot_field, checkmk_attribute in mapping_config.items():
                    try:
                        value = self._extract_field_value(device_data, nautobot_field)

                        # Add the mapped attribute if value exists and is not empty
                        if value is not None and value != "":
                            # Handle nested objects (e.g., role.name, location.name)
                            if isinstance(value, dict) and "name" in value:
                                logger.info(f"Extracting 'name' from nested object for '{nautobot_field}'")
                                value = value["name"]

                            extensions.attributes[checkmk_attribute] = str(value)
                            logger.info(
                                f"Added mapping for device '{device_name}': {nautobot_field} → {checkmk_attribute} = {value}"
                            )
                        else:
                            logger.info(f"Skipping mapping '{nautobot_field}' - no value found")

                    except Exception as e:
                        logger.warning(f"Error processing mapping '{nautobot_field}' → '{checkmk_attribute}': {e}")
                        continue

        except Exception as e:
            logger.error(f"Error processing field mappings for device: {e}")
            # Don't fail the whole process, just log the error

    def _extract_field_value(self, device_data: Dict[str, Any], field_path: str) -> Any:
        """Extract field value from device data using dot notation.
        
        Args:
            device_data: Device data from Nautobot
            field_path: Field path with dot notation (e.g., "location.name")
            
        Returns:
            Field value or None if not found
        """
        logger.info(f"Processing mapping: {field_path}")

        if "." in field_path:
            # Handle nested field access (e.g., "location.name")
            field_parts = field_path.split(".")
            current_data = device_data

            for part in field_parts:
                if isinstance(current_data, dict) and part in current_data:
                    current_data = current_data[part]
                else:
                    logger.info(f"Nested field '{field_path}' failed at part '{part}' - not found or not dict")
                    return None
            return current_data
        else:
            # Simple field access
            return device_data.get(field_path)

    def _extract_device_ip(self, device_data: Dict[str, Any]) -> str:
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


# Global instance for dependency injection
device_normalization_service = DeviceNormalizationService()
