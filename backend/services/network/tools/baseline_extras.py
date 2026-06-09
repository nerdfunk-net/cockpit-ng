"""Custom-field creation phase of the baseline import.

Mixin for :class:`services.network.tools.baseline.BaselineImportService`;
expects ``self.nautobot``, ``self.created_resources`` and
``self.custom_field_cache`` from the host class.
"""

import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class BaselineExtrasMixin:
    """Creation of custom fields and custom field choices."""

    async def create_custom_fields(
        self, custom_fields_data: Dict[str, List[Dict[str, Any]]]
    ) -> Dict[str, str]:
        """
        Create custom fields in Nautobot.

        Args:
            custom_fields_data: Dictionary where keys are custom field names and values are lists of field configs

        Returns:
            Dictionary mapping custom field keys to their UUIDs
        """
        created = {}

        for field_key, field_configs in custom_fields_data.items():
            # In YAML, each custom field is defined as a list with one element
            if not field_configs or not isinstance(field_configs, list):
                logger.warning("Custom field '%s' has invalid configuration", field_key)
                continue

            field_config = field_configs[0]  # Get the first (and should be only) config

            try:
                # Generate key from label if not provided
                key = field_config.get("key", field_config.get("label", field_key))

                # Check if custom field already exists by fetching all and filtering client-side
                # (Nautobot API doesn't support filtering by key parameter)
                response = await self.nautobot.rest_request(
                    "extras/custom-fields/", method="GET"
                )

                # Filter client-side by key
                existing = None
                if response.get("results"):
                    for cf in response["results"]:
                        if cf.get("key") == key:
                            existing = cf
                            break

                if existing:
                    created[field_key] = existing["id"]
                    self.custom_field_cache[key] = existing["id"]
                    logger.info("Custom field '%s' already exists", key)
                    continue

                # Prepare payload for custom field creation
                payload = {
                    "label": field_config.get("label", field_key),
                    "key": key,
                    "type": field_config[
                        "type"
                    ],  # Required: select, multi-select, text, etc.
                    "content_types": field_config["content_types"],  # Required
                }

                # Add optional fields
                if "description" in field_config:
                    payload["description"] = field_config["description"]

                if "required" in field_config:
                    payload["required"] = field_config["required"]

                if "default" in field_config:
                    payload["default"] = field_config["default"]

                if "weight" in field_config:
                    payload["weight"] = field_config["weight"]

                if "grouping" in field_config:
                    payload["grouping"] = field_config["grouping"]

                if "filter_logic" in field_config:
                    payload["filter_logic"] = field_config["filter_logic"]

                if "validation_minimum" in field_config:
                    payload["validation_minimum"] = field_config["validation_minimum"]

                if "validation_maximum" in field_config:
                    payload["validation_maximum"] = field_config["validation_maximum"]

                if "validation_regex" in field_config:
                    payload["validation_regex"] = field_config["validation_regex"]

                if "advanced_ui" in field_config:
                    payload["advanced_ui"] = field_config["advanced_ui"]

                # Create the custom field
                result = await self.nautobot.rest_request(
                    "extras/custom-fields/", method="POST", data=payload
                )

                created[field_key] = result["id"]
                self.custom_field_cache[key] = result["id"]
                logger.info(
                    "Created custom field: %s (type: %s)", key, field_config["type"]
                )

            except Exception as e:
                logger.error("Error creating custom field '%s': %s", field_key, e)
                raise

        return created

    async def create_custom_field_choices(
        self, choices_data: Dict[str, List[Dict[str, Any]]]
    ) -> Dict[str, int]:
        """
        Create custom field choices in Nautobot.

        Args:
            choices_data: Dictionary where keys are custom field names and values are lists of choice configs

        Returns:
            Dictionary mapping custom field keys to the count of choices created
        """
        created_counts = {}

        for field_key, choices in choices_data.items():
            if not choices or not isinstance(choices, list):
                logger.warning(
                    "Custom field choices for '%s' has invalid configuration", field_key
                )
                continue

            # Get the custom field UUID from cache
            custom_field_id = self.created_resources["custom_fields"].get(field_key)

            if not custom_field_id:
                # Try to look it up by key
                custom_field_id = self.custom_field_cache.get(field_key)

            if not custom_field_id:
                logger.error(
                    "Custom field '%s' not found. Cannot create choices.", field_key
                )
                continue

            created_count = 0

            for idx, choice in enumerate(choices):
                try:
                    value = choice.get("value")

                    if not value:
                        logger.warning(
                            "Choice for custom field '%s' missing 'value' field",
                            field_key,
                        )
                        continue

                    # Check if choice already exists
                    response = await self.nautobot.rest_request(
                        f"extras/custom-field-choices/?custom_field={custom_field_id}&value={value}",
                        method="GET",
                    )

                    if response.get("count", 0) > 0:
                        logger.info(
                            "Custom field choice '%s' for field '%s' already exists",
                            value,
                            field_key,
                        )
                        created_count += 1
                        continue

                    # Prepare payload for custom field choice
                    payload = {
                        "custom_field": {"id": custom_field_id},
                        "value": value,
                    }

                    # Add optional weight (use index if not provided for ordering)
                    if "weight" in choice:
                        payload["weight"] = choice["weight"]
                    else:
                        payload["weight"] = (
                            idx + 1
                        ) * 100  # Auto-increment: 100, 200, 300...

                    # Create the choice
                    await self.nautobot.rest_request(
                        "extras/custom-field-choices/", method="POST", data=payload
                    )

                    created_count += 1
                    logger.info(
                        "Created custom field choice: %s for field '%s'",
                        value,
                        field_key,
                    )

                except Exception as e:
                    logger.error(
                        "Error creating custom field choice '%s' for field '%s': %s",
                        choice.get("value", "unknown"),
                        field_key,
                        e,
                    )
                    # Continue with next choice instead of raising
                    continue

            created_counts[field_key] = created_count
            logger.info(
                "Created %s choices for custom field '%s'", created_count, field_key
            )

        return created_counts
