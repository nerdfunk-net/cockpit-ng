"""Main device normalization service - orchestrates all normalizers."""

from __future__ import annotations

import logging
from typing import Dict, Any

from services.checkmk.config import config_service
from utils.cmk_site_utils import get_monitored_site, get_device_folder
from models.nb2cmk import DeviceExtensions

from .field_normalizer import FieldNormalizer
from .ip_normalizer import IPNormalizer
from .snmp_normalizer import SNMPNormalizer
from .tag_normalizer import TagNormalizer

logger = logging.getLogger(__name__)


class DeviceNormalizationService:
    """Service for normalizing Nautobot device data to CheckMK format."""

    def __init__(self):
        """Initialize with all normalizers."""
        self.ip_normalizer = IPNormalizer()
        self.snmp_normalizer = SNMPNormalizer()
        self.field_normalizer = FieldNormalizer()
        self.tag_normalizer = TagNormalizer(self.field_normalizer, self.ip_normalizer)

    def normalize_device(self, device_data: Dict[str, Any]) -> DeviceExtensions:
        """Normalize device data from Nautobot for CheckMK comparison.

        Args:
            device_data: Device data from Nautobot GraphQL query

        Returns:
            DeviceExtensions object with normalized configuration

        Raises:
            ValueError: If device data is invalid or missing required fields
        """
        device_name = device_data.get("name", "UNKNOWN") if device_data else "UNKNOWN"

        try:
            if not device_data:
                error_msg = "Device data cannot be empty"
                logger.error("[NORMALIZATION ERROR] %s", error_msg)
                raise ValueError(error_msg)

            logger.info(
                "[NORMALIZATION] Starting normalization for device: %s", device_name
            )
            logger.debug(
                "[NORMALIZATION] Device data keys: %s", list(device_data.keys())
            )

            # Force load the configuration on service initialization
            try:
                config_service.load_checkmk_config(force_reload=True)
                logger.debug(
                    "[NORMALIZATION] CheckMK config loaded successfully for %s",
                    device_name,
                )
            except Exception as config_error:
                logger.error(
                    "[NORMALIZATION ERROR] Failed to load CheckMK config for %s: %s",
                    device_name,
                    config_error,
                    exc_info=True,
                )
                raise ValueError(
                    "Failed to load CheckMK configuration: {}".format(str(config_error))
                )

            # Create the root extension dictionary
            extensions = DeviceExtensions(folder="", attributes={}, internal={})

            # Set hostname in internal dict (needed for CheckMK queries but not for comparison)
            extensions.internal["hostname"] = device_data.get("name", "")
            logger.debug(
                "[NORMALIZATION] Set hostname: %s", extensions.internal["hostname"]
            )

            # Store device metadata in internal dict (for UI display, not for comparison)
            # Extract role name
            try:
                role = device_data.get("role")
                if isinstance(role, dict):
                    extensions.internal["role"] = role.get("name", "")
                elif isinstance(role, str):
                    extensions.internal["role"] = role
                else:
                    extensions.internal["role"] = ""
                logger.debug(
                    "[NORMALIZATION] Device %s role: %s",
                    device_name,
                    extensions.internal["role"],
                )
            except Exception as e:
                logger.warning(
                    "[NORMALIZATION] Failed to extract role for %s: %s",
                    device_name,
                    e,
                )
                extensions.internal["role"] = ""

            # Extract status name
            try:
                status = device_data.get("status")
                if isinstance(status, dict):
                    extensions.internal["status"] = status.get("name", "")
                elif isinstance(status, str):
                    extensions.internal["status"] = status
                else:
                    extensions.internal["status"] = ""
                logger.debug(
                    "[NORMALIZATION] Device %s status: %s",
                    device_name,
                    extensions.internal["status"],
                )
            except Exception as e:
                logger.warning(
                    "[NORMALIZATION] Failed to extract status for %s: %s",
                    device_name,
                    e,
                )
                extensions.internal["status"] = ""

            # Extract location name
            try:
                location = device_data.get("location")
                if isinstance(location, dict):
                    extensions.internal["location"] = location.get("name", "")
                elif isinstance(location, str):
                    extensions.internal["location"] = location
                else:
                    extensions.internal["location"] = ""
                logger.debug(
                    "[NORMALIZATION] Device %s location: %s",
                    device_name,
                    extensions.internal["location"],
                )
            except Exception as e:
                logger.warning(
                    "[NORMALIZATION] Failed to extract location for %s: %s",
                    device_name,
                    e,
                )
                extensions.internal["location"] = ""

            # Set site using utility function
            try:
                extensions.attributes["site"] = get_monitored_site(device_data, None)
                logger.info(
                    "[NORMALIZATION] Determined site for device %s: %s",
                    device_name,
                    extensions.attributes["site"],
                )
            except Exception as e:
                logger.error(
                    "[NORMALIZATION ERROR] Failed to determine site for %s: %s",
                    device_name,
                    e,
                    exc_info=True,
                )
                raise ValueError(
                    "Failed to determine CheckMK site for device {}: {}".format(
                        device_name, str(e)
                    )
                )

            # Set folder using utility function
            try:
                extensions.folder = get_device_folder(device_data, None)
                logger.info(
                    "[NORMALIZATION] Determined folder for device %s: %s",
                    device_name,
                    extensions.folder,
                )
            except Exception as e:
                logger.error(
                    "[NORMALIZATION ERROR] Failed to determine folder for %s: %s",
                    device_name,
                    e,
                    exc_info=True,
                )
                raise ValueError(
                    "Failed to determine CheckMK folder for device {}: {}".format(
                        device_name, str(e)
                    )
                )

            # Set IP address from primary_ip4 (remove CIDR netmask for CheckMK compatibility)
            try:
                self.ip_normalizer.process_ip_address(device_data, extensions)
                logger.debug(
                    "[NORMALIZATION] Device %s IP address: %s",
                    device_name,
                    extensions.attributes.get("ipaddress", "N/A"),
                )
            except Exception as e:
                logger.error(
                    "[NORMALIZATION ERROR] Failed to process IP address for %s: %s",
                    device_name,
                    e,
                    exc_info=True,
                )
                raise ValueError(
                    "Failed to process IP address for device {}: {}".format(
                        device_name, str(e)
                    )
                )

            # Process various configuration mappings
            try:
                self.snmp_normalizer.process_snmp_config(device_data, extensions)
                self.tag_normalizer.process_additional_attributes(
                    device_data, extensions
                )
                self.tag_normalizer.process_cf2htg_mappings(device_data, extensions)
                self.tag_normalizer.process_tags2htg_mappings(device_data, extensions)
                self.tag_normalizer.process_attr2htg_mappings(device_data, extensions)
                self.field_normalizer.process_field_mappings(device_data, extensions)

                logger.info(
                    "[NORMALIZATION] Successfully normalized device %s", device_name
                )
                logger.debug(
                    "[NORMALIZATION] Final attributes for %s: %s",
                    device_name,
                    list(extensions.attributes.keys()),
                )
                logger.debug(
                    "[NORMALIZATION] Final folder for %s: %s",
                    device_name,
                    extensions.folder,
                )
            except Exception as e:
                logger.error(
                    "[NORMALIZATION ERROR] Failed to process configuration mappings for %s: %s",
                    device_name,
                    e,
                    exc_info=True,
                )
                raise ValueError(
                    "Failed to process configuration mappings for device {}: {}".format(
                        device_name, str(e)
                    )
                )

            return extensions

        except ValueError:
            # Re-raise ValueError with context already logged
            raise
        except Exception as e:
            error_msg = "Unexpected error normalizing device {}: {}".format(
                device_name, str(e)
            )
            logger.error("[NORMALIZATION ERROR] %s", error_msg, exc_info=True)
            raise ValueError(error_msg)
