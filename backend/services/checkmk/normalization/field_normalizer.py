"""Field normalization for device data."""

import logging
from typing import Dict, Any

from services.checkmk.config import config_service
from models.nb2cmk import DeviceExtensions

logger = logging.getLogger(__name__)


class FieldNormalizer:
    """Handles field mapping and extraction from Nautobot device data."""

    def process_field_mappings(
        self, device_data: Dict[str, Any], extensions: DeviceExtensions
    ) -> None:
        """Process field mappings from Nautobot to CheckMK attributes.

        Args:
            device_data: Device data from Nautobot
            extensions: Extensions object to update
        """
        try:
            config = config_service.load_checkmk_config()
            mapping_config = config.get("mapping", {})
            device_name = device_data.get("name", "")

            logger.info(
                "Processing mapping config for device '%s': %s",
                device_name,
                mapping_config,
            )

            logger.debug("Full device data: %s", device_data)

            # Log device data structure for debugging
            logger.info("Device data keys: %s", list(device_data.keys()))
            if "_custom_field_data" in device_data:
                logger.info(
                    "_custom_field_data content: %s",
                    device_data["_custom_field_data"],
                )
            else:
                logger.info("No _custom_field_data found in device data")

            if mapping_config:
                for nautobot_field, checkmk_attribute in mapping_config.items():
                    try:
                        value = self.extract_field_value(device_data, nautobot_field)

                        # Add the mapped attribute if value exists and is not empty
                        if value is not None and value != "":
                            # Handle nested objects (e.g., role.name, location.name)
                            if isinstance(value, dict) and "name" in value:
                                logger.info(
                                    "Extracting 'name' from nested object for '%s'",
                                    nautobot_field,
                                )
                                value = value["name"]

                            extensions.attributes[checkmk_attribute] = str(value)
                            logger.info(
                                "Added mapping for device '%s': %s → %s = %s",
                                device_name,
                                nautobot_field,
                                checkmk_attribute,
                                value,
                            )
                        else:
                            logger.info(
                                "Skipping mapping '%s' - no value found", nautobot_field
                            )

                    except Exception as e:
                        logger.warning(
                            "Error processing mapping '%s' → '%s': %s",
                            nautobot_field,
                            checkmk_attribute,
                            e,
                        )
                        continue

        except Exception as e:
            logger.error("Error processing field mappings for device: %s", e)
            # Don't fail the whole process, just log the error

    def extract_field_value(self, device_data: Dict[str, Any], field_path: str) -> Any:
        """Extract field value from device data using dot notation.

        Args:
            device_data: Device data from Nautobot
            field_path: Field path with dot notation (e.g., "location.name")

        Returns:
            Field value or None if not found
        """
        logger.info("Processing mapping: %s", field_path)

        if "." in field_path:
            # Handle nested field access (e.g., "location.name")
            field_parts = field_path.split(".")
            current_data = device_data

            for part in field_parts:
                if isinstance(current_data, dict) and part in current_data:
                    current_data = current_data[part]
                else:
                    logger.info(
                        "Nested field '%s' failed at part '%s' - not found or not dict",
                        field_path,
                        part,
                    )
                    return None
            return current_data
        else:
            # Simple field access
            return device_data.get(field_path)
