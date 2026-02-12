"""
Metadata service for Nautobot custom fields and other metadata operations.

This service provides business logic for metadata operations without
framework dependencies (FastAPI, etc.).
"""

import logging
from typing import List, Dict, Any
from services.nautobot.client import NautobotService

logger = logging.getLogger(__name__)


class NautobotMetadataService:
    """Service for Nautobot metadata operations."""

    def __init__(self, nautobot_service: NautobotService):
        """
        Initialize metadata service.

        Args:
            nautobot_service: Nautobot API client instance
        """
        self.nautobot = nautobot_service

    async def get_device_custom_fields(self) -> List[Dict[str, Any]]:
        """
        Get Nautobot custom fields specifically for dcim.device content type.

        Returns:
            List of custom field definitions for devices

        Raises:
            Exception: If the API request fails
        """
        logger.debug("Fetching device custom fields from Nautobot")
        result = await self.nautobot.rest_request(
            "extras/custom-fields/?content_types=dcim.device"
        )
        custom_fields = result.get("results", [])
        logger.debug("Retrieved %d device custom field definitions", len(custom_fields))
        return custom_fields

    async def get_prefix_custom_fields(self) -> List[Dict[str, Any]]:
        """
        Get Nautobot custom fields specifically for ipam.prefix content type.

        Returns:
            List of custom field definitions for prefixes

        Raises:
            Exception: If the API request fails
        """
        logger.debug("Fetching prefix custom fields from Nautobot")
        result = await self.nautobot.rest_request(
            "extras/custom-fields/?content_types=ipam.prefix"
        )
        custom_fields = result.get("results", [])
        logger.debug("Retrieved %d prefix custom field definitions", len(custom_fields))
        return custom_fields

    async def get_custom_field_choices(
        self, custom_field_name: str
    ) -> List[Dict[str, Any]]:
        """
        Get Nautobot custom field choices for a specific custom field.

        Args:
            custom_field_name: Name of the custom field

        Returns:
            List of choices for the specified custom field

        Raises:
            Exception: If the API request fails
        """
        logger.debug("Fetching custom field choices for: %s", custom_field_name)
        result = await self.nautobot.rest_request(
            f"extras/custom-field-choices/?custom_field={custom_field_name}"
        )
        choices = result.get("results", [])
        logger.debug(
            "Retrieved %d choices for custom field '%s'",
            len(choices),
            custom_field_name,
        )
        return choices
