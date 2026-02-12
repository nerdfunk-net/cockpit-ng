"""Device cleanup operations for offboarding (delete, update, clear name/serial)."""

from __future__ import annotations

import logging
from typing import Any, Dict

from fastapi import HTTPException

from services.nautobot import nautobot_service
from services.nautobot_helpers import (
    get_device_cache_key,
    get_device_details_cache_key,
    get_device_list_cache_key,
)
from services.nautobot.common.exceptions import translate_http_exception
from services.nautobot.offboarding.types import DEVICE_CACHE_TTL, OffboardingResult
from services.settings.cache import cache_service

logger = logging.getLogger(__name__)


class DeviceCleanupManager:
    """Handles device-level mutations during offboarding."""

    async def delete_device(self, device_id: str) -> Dict[str, Any]:
        """Delete a device from Nautobot."""
        try:
            result = await nautobot_service.rest_request(
                f"dcim/devices/{device_id}/",
                method="DELETE",
            )
        except Exception as exc:
            raise translate_http_exception(exc, f"Failed to delete device {device_id}")

        self._invalidate_device_cache(device_id)
        return result

    async def update_device(
        self, device_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update device attributes in Nautobot."""
        try:
            updated_device = await nautobot_service.rest_request(
                f"dcim/devices/{device_id}/",
                method="PATCH",
                data=payload,
            )
        except Exception as exc:
            raise translate_http_exception(exc, f"Failed to update device {device_id}")

        if isinstance(updated_device, dict):
            self._update_device_cache(device_id, updated_device)

        return updated_device

    async def clear_device_name(self, device_id: str) -> Dict[str, Any]:
        """Clear the device name by setting it to an empty string."""
        logger.debug("Clearing device name for device %s", device_id)
        payload = {"name": ""}

        try:
            updated_device = await nautobot_service.rest_request(
                f"dcim/devices/{device_id}/",
                method="PATCH",
                data=payload,
            )
        except Exception as exc:
            raise translate_http_exception(
                exc, f"Failed to clear device name for {device_id}"
            )

        if isinstance(updated_device, dict):
            self._update_device_cache(device_id, updated_device)

        logger.debug("Successfully cleared device name for %s", device_id)
        return updated_device

    async def clear_device_serial(self, device_id: str) -> Dict[str, Any]:
        """Clear the device serial number by setting it to an empty string."""
        logger.debug("Clearing device serial number for device %s", device_id)
        payload = {"serial": ""}

        try:
            updated_device = await nautobot_service.rest_request(
                f"dcim/devices/{device_id}/",
                method="PATCH",
                data=payload,
            )
        except Exception as exc:
            raise translate_http_exception(
                exc, f"Failed to clear device serial number for {device_id}"
            )

        if isinstance(updated_device, dict):
            self._update_device_cache(device_id, updated_device)

        logger.debug("Successfully cleared device serial number for %s", device_id)
        return updated_device

    async def handle_device_removal(
        self,
        device_id: str,
        results: OffboardingResult,
    ) -> None:
        """Handle device removal workflow."""
        logger.debug("handle_device_removal called for device %s", device_id)
        logger.info("Removing device %s", device_id)
        try:
            await self.delete_device(device_id)
            device_name = results.get("device_name", device_id)
            results["removed_items"].append(f"Device: {device_name} ({device_id})")
            logger.info("Successfully removed device %s", device_id)
        except HTTPException as exc:
            results["errors"].append(exc.detail)
            results["success"] = False
            logger.error("Failed to remove device %s: %s", device_id, exc.detail)
        except Exception as exc:
            error_msg = f"Failed to remove device {device_id}: {str(exc)}"
            results["errors"].append(error_msg)
            results["success"] = False
            logger.error(error_msg)

    async def update_device_attributes(
        self,
        device_id: str,
        results: OffboardingResult,
        settings: Dict[str, Any],
    ) -> None:
        """Update location, status, and role based on offboarding settings."""
        logger.info(
            "Updating device attributes (location, status, role) for device %s",
            device_id,
        )

        payload = {}
        updates_made = []

        # Update location if specified
        if settings.get("location_id"):
            payload["location"] = settings["location_id"]
            updates_made.append("location")
            logger.info("Setting device location to %s", settings["location_id"])

        # Update status if specified
        if settings.get("status_id"):
            payload["status"] = settings["status_id"]
            updates_made.append("status")
            logger.info("Setting device status to %s", settings["status_id"])

        # Update role if specified
        if settings.get("role_id"):
            payload["role"] = settings["role_id"]
            updates_made.append("role")
            logger.info("Setting device role to %s", settings["role_id"])

        # Only make the API call if there are updates to apply
        if not payload:
            results["skipped_items"].append(
                "No location, status, or role updates specified in offboarding settings"
            )
            logger.info("No device attribute updates specified; skipping")
            return

        try:
            await self.update_device(device_id, payload)
            results["removed_items"].append(
                f"Device attributes updated: {', '.join(updates_made)}"
            )
            logger.info(
                "Successfully updated device attributes for %s: %s",
                device_id,
                ", ".join(updates_made),
            )
        except HTTPException as exc:
            results["errors"].append(
                f"Failed to update device attributes: {exc.detail}"
            )
            results["success"] = False
            logger.error(
                "Failed to update device attributes for %s: %s", device_id, exc.detail
            )
        except Exception as exc:
            error_msg = (
                f"Failed to update device attributes for {device_id}: {str(exc)}"
            )
            results["errors"].append(error_msg)
            results["success"] = False
            logger.error(error_msg)

    # --- internal helpers ---

    def _invalidate_device_cache(self, device_id: str) -> None:
        """Delete all cached entries for a device."""
        cache_service.delete(get_device_cache_key(device_id))
        cache_service.delete(get_device_details_cache_key(device_id))
        cache_service.delete(get_device_list_cache_key())

    def _update_device_cache(self, device_id: str, device_data: Dict[str, Any]) -> None:
        """Set device cache entries and invalidate list cache."""
        cache_service.set(
            get_device_cache_key(device_id), device_data, DEVICE_CACHE_TTL
        )
        cache_service.set(
            get_device_details_cache_key(device_id), device_data, DEVICE_CACHE_TTL
        )
        cache_service.delete(get_device_list_cache_key())
