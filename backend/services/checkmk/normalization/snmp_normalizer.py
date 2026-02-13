"""SNMP configuration normalization for device data."""

import logging
from typing import Dict, Any

from services.checkmk.config import config_service
from models.nb2cmk import DeviceExtensions

logger = logging.getLogger(__name__)


class SNMPNormalizer:
    """Handles SNMP community mapping and configuration."""

    def process_snmp_config(
        self, device_data: Dict[str, Any], extensions: DeviceExtensions
    ) -> None:
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
                snmp_version = snmp_config.get("version")

                # Convert version to string for comparison (YAML may parse unquoted numbers as int)
                snmp_version_str = (
                    str(snmp_version) if snmp_version is not None else None
                )

                # Handle SNMPv2/v1 (community-based)
                if snmp_version_str in ["v1", "v2", "1", "2"]:
                    snmp_community = {
                        "type": "v1_v2_community",
                        "community": snmp_config.get("community", ""),
                    }
                    extensions.attributes["snmp_community"] = snmp_community
                    extensions.attributes["tag_snmp_ds"] = "snmp-v2"
                    extensions.attributes["tag_agent"] = "no-agent"
                    logger.info(
                        "Configured SNMPv%s community-based authentication for device",
                        snmp_version_str,
                    )

                # Handle SNMPv3 (user-based security)
                elif snmp_version_str in ["v3", "3"]:
                    # Map SNMP configuration to normalized format
                    snmp_community = {
                        "type": snmp_config.get("type", ""),
                        "auth_protocol": snmp_config.get("auth_protocol_long", ""),
                        "security_name": snmp_config.get("username", ""),
                        "auth_password": snmp_config.get("auth_password", ""),
                        "privacy_protocol": snmp_config.get(
                            "privacy_protocol_long", ""
                        ),
                        "privacy_password": snmp_config.get("privacy_password", ""),
                    }

                    if snmp_config.get("type", "") == "v3_auth_no_privacy":
                        # we have to remove the keys privacy_protocol and privacy_password
                        snmp_community.pop("privacy_protocol", None)
                        snmp_community.pop("privacy_password", None)

                    extensions.attributes["snmp_community"] = snmp_community
                    extensions.attributes["tag_snmp_ds"] = "snmp-v2"
                    extensions.attributes["tag_agent"] = "no-agent"
                    logger.info(
                        "Configured SNMPv3 with type '%s' for device",
                        snmp_config.get("type"),
                    )

                else:
                    logger.warning(
                        "Unsupported SNMP version '%s' (raw: %s, type: %s) in mapping",
                        snmp_version_str,
                        snmp_version,
                        type(snmp_version).__name__,
                    )
                    extensions.attributes["tag_agent"] = "no-agent"
            else:
                extensions.attributes["tag_agent"] = "no-agent"
                logger.warning(
                    "SNMP credentials key '%s' not found in mapping", snmp_credentials
                )

        except Exception as e:
            logger.error("Error processing SNMP configuration: %s", e)
            # Don't fail the whole process, just log the error
