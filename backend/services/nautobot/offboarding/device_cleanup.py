"""Device cleanup operations for offboarding (delete, update, clear name/serial)."""

from __future__ import annotations

import logging
from typing import Any, Dict

from fastapi import HTTPException

from services.nautobot_helpers import (
    get_device_cache_key,
    get_device_details_cache_key,
    get_device_list_cache_key,
)
from services.nautobot.common.exceptions import translate_http_exception
from services.nautobot.offboarding.types import DEVICE_CACHE_TTL, OffboardingResult
logger = logging.getLogger(__name__)


class DeviceCleanupManager:
    """Handles device-level mutations during offboarding."""

    def __init__(self, cache_service):
        import service_factory

        self._nb = service_factory.build_nautobot_service()
        self._cache = cache_service

    async def delete_device(self, device_id: str) -> Dict[str, Any]:
        """Delete a device from Nautobot."""
        try:
            result = await self._nb.rest_request(
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
            updated_device = await self._nb.rest_request(
                f"dcim/devices/{device_id}/",
                method="PATCH",
                data=payload,
            )
        except Exception as exc:
            raise translate_http_exception(exc, f"Failed to update device {device_id}")

        if isinstance(updated_device, dict):
            self._update_device_cache(device_id, updated_device)

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

    # --- internal helpers ---

    def _invalidate_device_cache(self, device_id: str) -> None:
        """Delete all cached entries for a device."""
        self._cache.delete(get_device_cache_key(device_id))
        self._cache.delete(get_device_details_cache_key(device_id))
        self._cache.delete(get_device_list_cache_key())

    def _update_device_cache(self, device_id: str, device_data: Dict[str, Any]) -> None:
        """Set device cache entries and invalidate list cache."""
        self._cache.set(
            get_device_cache_key(device_id), device_data, DEVICE_CACHE_TTL
        )
        self._cache.set(
            get_device_details_cache_key(device_id), device_data, DEVICE_CACHE_TTL
        )
        self._cache.delete(get_device_list_cache_key())
