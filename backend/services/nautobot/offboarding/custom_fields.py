"""Custom field management during offboarding."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Dict

from fastapi import HTTPException

from services.nautobot.offboarding.types import OffboardingResult

if TYPE_CHECKING:
    from services.nautobot.offboarding.device_cleanup import DeviceCleanupManager

logger = logging.getLogger(__name__)


class CustomFieldManager:
    """Handles custom field updates during offboarding."""

    def __init__(self, device_cleanup: DeviceCleanupManager):
        self._device_cleanup = device_cleanup

    async def apply_offboarding_values(
        self,
        device_id: str,
        results: OffboardingResult,
        settings: Dict[str, Any],
        device_details: Dict[str, Any],
    ) -> None:
        """Fetch custom field definitions and apply offboarding values."""
        logger.debug("apply_offboarding_values called for device %s", device_id)
        logger.info(
            "Applying custom fields offboarding settings to device %s", device_id
        )

        # 1. Initialize an empty dict named "custom_fields_update"
        custom_fields_update: Dict[str, Any] = {}

        # 2. Get the list of all custom fields and their default values
        try:
            logger.debug("Fetching custom field definitions from Nautobot")
            from services.nautobot import nautobot_metadata_service

            custom_field_list = (
                await nautobot_metadata_service.get_device_custom_fields()
            )

            logger.debug(
                "Retrieved %d custom field definitions",
                len(custom_field_list) if isinstance(custom_field_list, list) else 0,
            )
        except Exception as exc:
            logger.error("Failed to fetch custom field definitions: %s", str(exc))
            results["errors"].append(
                f"Failed to fetch custom field definitions: {str(exc)}"
            )
            results["success"] = False
            return

        if not custom_field_list:
            logger.debug("No custom field definitions found")
            results["skipped_items"].append("No custom field definitions found")
            return

        # Get custom field settings from offboarding settings
        custom_field_settings = settings.get("custom_field_settings", {})
        remove_all_custom_fields = settings.get("remove_all_custom_fields", False)
        logger.debug("custom_field_settings = %s", custom_field_settings)
        logger.debug("remove_all_custom_fields = %s", remove_all_custom_fields)

        # 3. Loop through the custom field list
        for field_def in custom_field_list:
            label = field_def.get("label")
            default_value = field_def.get("default")

            if not label:
                continue

            logger.debug(
                "Processing custom field '%s' with default value: %s",
                label,
                default_value,
            )

            # If remove_all_custom_fields is True, clear all fields to default values
            if remove_all_custom_fields:
                custom_fields_update[label] = default_value
                logger.debug(
                    "remove_all_custom_fields=True - Setting field '%s' to default value: %s",
                    label,
                    default_value,
                )
            # Otherwise, check if this field is configured in custom_field_settings
            elif label in custom_field_settings:
                configured_value = custom_field_settings[label]
                logger.debug(
                    "Found configuration for field '%s': %s",
                    label,
                    configured_value,
                )

                if configured_value == "clear":
                    # Use the default value
                    custom_fields_update[label] = default_value
                    logger.debug(
                        "Setting field '%s' to default value: %s",
                        label,
                        default_value,
                    )
                else:
                    # Use the configured value
                    custom_fields_update[label] = configured_value
                    logger.debug(
                        "Setting field '%s' to configured value: %s",
                        label,
                        configured_value,
                    )

        # 4. Update the device with the custom_fields_update dict
        if not custom_fields_update:
            results["skipped_items"].append(
                "No custom field updates specified in offboarding settings"
            )
            logger.info("No custom field updates specified; skipping")
            return

        payload = {"custom_fields": custom_fields_update}
        logger.debug("Payload for updating custom fields: %s", payload)

        try:
            await self._device_cleanup.update_device(device_id, payload)
            results["removed_items"].append(
                "Device custom fields updated for offboarding"
            )
            logger.info(
                "Applied offboarding custom field settings to device %s", device_id
            )
        except HTTPException as exc:
            results["errors"].append(exc.detail)
            results["success"] = False
            logger.error(
                "Failed to apply offboarding settings for device %s: %s",
                device_id,
                exc.detail,
            )
        except Exception as exc:
            error_msg = f"Failed to apply offboarding settings for device {device_id}: {str(exc)}"
            results["errors"].append(error_msg)
            results["success"] = False
            logger.error(error_msg)
