"""
Inventory metadata service — custom field and field-value lookups from Nautobot.

Extracted from InventoryService as part of Phase 4 decomposition.
See: doc/refactoring/REFACTORING_SERVICES.md — Phase 4
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class InventoryMetadataService:
    """Fetches Nautobot custom-field definitions and per-field value lists."""

    def __init__(self):
        self._custom_fields_cache = None

    async def get_custom_fields(self) -> List[Dict[str, Any]]:
        """
        Return available custom fields for devices as a normalised list.

        Each entry has keys: ``name``, ``label``, ``type``.
        Results are cached for the lifetime of the service instance.
        """
        if self._custom_fields_cache is not None:
            return self._custom_fields_cache

        try:
            import service_factory
            nautobot_service = service_factory.build_nautobot_service()

            response = await nautobot_service.rest_request(
                "extras/custom-fields/?content_types=dcim.device"
            )
            if not response or "results" not in response:
                logger.error("Invalid REST response for custom fields")
                return []

            transformed_fields = []
            for field in response["results"]:
                field_name = field.get("key") or field.get("name", "")

                label = field.get("label", field_name)
                if isinstance(label, dict):
                    label = label.get("display") or label.get("value") or str(label)

                field_type = field.get("type", "text")
                if isinstance(field_type, dict):
                    field_type = (
                        field_type.get("value")
                        or field_type.get("label")
                        or str(field_type)
                    )

                transformed_fields.append(
                    {
                        "name": str(field_name),
                        "label": str(label) if label else str(field_name),
                        "type": str(field_type),
                    }
                )

            self._custom_fields_cache = transformed_fields
            logger.info("Retrieved %s custom fields for devices", len(transformed_fields))
            return self._custom_fields_cache

        except Exception as e:
            logger.error("Error getting custom fields: %s", e)
            return []

    async def get_field_values(self, field_name: str) -> List[Dict[str, str]]:
        """
        Return dropdown values for a specific inventory filter field.

        Handles both standard Nautobot fields and custom fields (``cf_`` prefix).
        Returns a list of ``{"value": ..., "label": ...}`` dicts, sorted by label.
        """
        try:
            import service_factory
            nautobot_service = service_factory.build_nautobot_service()

            if field_name == "name":
                return []

            if field_name.startswith("cf_"):
                return await self._get_custom_field_values(field_name, nautobot_service)

            if field_name == "custom_fields":
                return await self._get_custom_field_list()

            return await self._get_standard_field_values(field_name, nautobot_service)

        except Exception as e:
            logger.error("Error getting field values for '%s': %s", field_name, e)
            return []

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get_custom_field_values(
        self, field_name: str, nautobot_service
    ) -> List[Dict[str, str]]:
        cf_key = field_name[3:]  # strip "cf_"
        custom_fields = await self.get_custom_fields()
        cf_info = next((cf for cf in custom_fields if cf.get("name") == cf_key), None)

        if cf_info and cf_info.get("type") == "select":
            logger.info(
                "Custom field '%s' is type 'select' - fetching choices", cf_key
            )
            try:
                choices_response = await nautobot_service.rest_request(
                    f"extras/custom-field-choices/?custom_field={cf_key}"
                )
                if choices_response and "results" in choices_response:
                    values = [
                        {"value": str(c.get("value", "")), "label": str(c.get("value", ""))}
                        for c in choices_response["results"]
                        if c.get("value")
                    ]
                    values.sort(key=lambda x: (x.get("label") or "").lower())
                    logger.info(
                        "Retrieved %s choices for custom field '%s'", len(values), cf_key
                    )
                    return values
            except Exception as e:
                logger.error(
                    "Error fetching choices for custom field '%s': %s", cf_key, e
                )
                return []

        logger.info(
            "Custom field '%s' is type '%s' - using text input",
            field_name,
            cf_info.get("type") if cf_info else "unknown",
        )
        return []

    async def _get_custom_field_list(self) -> List[Dict[str, str]]:
        custom_fields = await self.get_custom_fields()
        values = [
            {
                "value": f"cf_{cf.get('name', '')}",
                "label": cf.get("label") or cf.get("name", ""),
            }
            for cf in custom_fields
            if cf.get("name")
        ]
        values.sort(key=lambda x: (x.get("label") or "").lower())
        logger.info("Retrieved %s custom field options", len(values))
        return values

    async def _get_standard_field_values(
        self, field_name: str, nautobot_service
    ) -> List[Dict[str, str]]:
        endpoint_map = {
            "location": "dcim/locations/?limit=0",
            "role": "extras/roles/?content_types=dcim.device&limit=0",
            "status": "extras/statuses/?content_types=dcim.device&limit=0",
            "device_type": "dcim/device-types/?limit=0&depth=1",
            "manufacturer": "dcim/manufacturers/?limit=0",
            "platform": "dcim/platforms/?limit=0",
            "tag": "extras/tags/?content_types=dcim.device&limit=0",
        }

        endpoint = endpoint_map.get(field_name)
        if not endpoint:
            logger.warning("No endpoint defined for field: %s", field_name)
            return []

        response = await nautobot_service.rest_request(endpoint)
        if not response or "results" not in response:
            logger.error("Invalid REST response for field %s", field_name)
            return []

        results = response["results"]
        values: List[Dict[str, str]] = []

        if field_name == "device_type":
            for device_type in results:
                manufacturer_data = device_type.get("manufacturer")
                if manufacturer_data and isinstance(manufacturer_data, dict):
                    manufacturer_name = manufacturer_data.get("name", "Unknown")
                else:
                    manufacturer_name = "Unknown"
                model = device_type.get("model", device_type.get("name", "Unknown"))
                values.append({"value": model, "label": f"{manufacturer_name} {model}"})
        else:
            name_key = "name"
            for item in results:
                name = item.get(name_key, "")
                if name:
                    values.append({"value": name, "label": name})

        values.sort(key=lambda x: (x.get("label") or "").lower())
        logger.info("Retrieved %s values for field '%s'", len(values), field_name)
        return values
