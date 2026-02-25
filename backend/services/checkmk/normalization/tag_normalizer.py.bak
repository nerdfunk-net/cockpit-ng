"""Tag and attribute mapping normalization for device data."""

from __future__ import annotations
from typing import TYPE_CHECKING

import logging
from typing import Dict, Any

from services.checkmk.config import config_service
from models.nb2cmk import DeviceExtensions

if TYPE_CHECKING:
    from .field_normalizer import FieldNormalizer
    from .ip_normalizer import IPNormalizer

logger = logging.getLogger(__name__)


class TagNormalizer:
    """Handles tag and attribute mappings to CheckMK host tag groups."""

    def __init__(self, field_normalizer: FieldNormalizer, ip_normalizer: IPNormalizer):
        """Initialize with dependencies.

        Args:
            field_normalizer: Field normalizer for field extraction
            ip_normalizer: IP normalizer for IP extraction
        """
        self.field_normalizer = field_normalizer
        self.ip_normalizer = ip_normalizer

    def process_additional_attributes(
        self, device_data: Dict[str, Any], extensions: DeviceExtensions
    ) -> None:
        """Process additional attributes configuration.

        Args:
            device_data: Device data from Nautobot
            extensions: Extensions object to update
        """
        try:
            config = config_service.load_checkmk_config()
            additional_attributes_config = config.get("additional_attributes", {})

            device_name = device_data.get("name", "")
            device_ip = self.ip_normalizer.extract_device_ip(device_data)

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
                self.ip_normalizer.process_ip_based_attributes(
                    device_ip, by_ip_config, extensions
                )

        except Exception as e:
            logger.error("Error processing additional_attributes for device: %s", e)
            # Don't fail the whole process, just log the error

    def process_cf2htg_mappings(
        self, device_data: Dict[str, Any], extensions: DeviceExtensions
    ) -> None:
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
                            tag_key = "tag_{}".format(host_tag_group_name)
                            extensions.attributes[tag_key] = str(custom_field_value)
                            logger.info(
                                "Added host tag group for device '%s': %s = %s",
                                device_name,
                                tag_key,
                                custom_field_value,
                            )

        except Exception as e:
            logger.error("Error processing cf2htg mappings for device: %s", e)
            # Don't fail the whole process, just log the error

    def process_tags2htg_mappings(
        self, device_data: Dict[str, Any], extensions: DeviceExtensions
    ) -> None:
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
                    tag_key = "tag_{}".format(host_tag_group_name)
                    if tag_name in device_tag_names:
                        extensions.attributes[tag_key] = "true"
                        logger.info(
                            "Added host tag group for device '%s': %s = true (tag '%s' found)",
                            device_name,
                            tag_key,
                            tag_name,
                        )
                    # else:
                    #     extensions.attributes[tag_key] = "false"
                    #     logger.info(
                    #         "Added host tag group for device '%s': %s = false (tag '%s' not found)",
                    #         device_name,
                    #         tag_key,
                    #         tag_name,
                    #     )

        except Exception as e:
            logger.error("Error processing tags2htg mappings for device: %s", e)
            # Don't fail the whole process, just log the error

    def process_attr2htg_mappings(
        self, device_data: Dict[str, Any], extensions: DeviceExtensions
    ) -> None:
        """Process Attribute to Host Tag Group mappings.

        Maps Nautobot core attributes (like status, role, location) to CheckMK host tag groups.
        Supports dot notation for nested attributes (e.g., "status.name").

        Args:
            device_data: Device data from Nautobot
            extensions: Extensions object to update
        """
        try:
            config = config_service.load_checkmk_config()
            attr2htg_config = config.get("attr2htg", {})
            device_name = device_data.get("name", "")

            if attr2htg_config:
                logger.info(
                    "Processing attr2htg mappings for device '%s': %s",
                    device_name,
                    attr2htg_config,
                )

                for nautobot_attr, host_tag_group_name in attr2htg_config.items():
                    try:
                        # Use existing extract_field_value to handle dot notation
                        attr_value = self.field_normalizer.extract_field_value(
                            device_data, nautobot_attr
                        )

                        if attr_value is not None and attr_value != "":
                            # Handle nested objects (extract name if it's a dict)
                            if isinstance(attr_value, dict) and "name" in attr_value:
                                attr_value = attr_value["name"]

                            # Convert value to string and set as host tag
                            tag_key = "tag_{}".format(host_tag_group_name)
                            extensions.attributes[tag_key] = str(attr_value)
                            logger.info(
                                "Added host tag group for device '%s': %s → %s = %s",
                                device_name,
                                nautobot_attr,
                                tag_key,
                                attr_value,
                            )
                        else:
                            logger.debug(
                                "Skipping attr2htg mapping '%s' for device '%s' - no value found",
                                nautobot_attr,
                                device_name,
                            )

                    except Exception as e:
                        logger.warning(
                            "Error processing attr2htg mapping '%s' → '%s' for device '%s': %s",
                            nautobot_attr,
                            host_tag_group_name,
                            device_name,
                            e,
                        )
                        continue

        except Exception as e:
            logger.error("Error processing attr2htg mappings for device: %s", e)
            # Don't fail the whole process, just log the error
