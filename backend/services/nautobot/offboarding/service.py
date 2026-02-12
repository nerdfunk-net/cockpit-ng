"""Offboarding workflow orchestrator."""

from __future__ import annotations

import logging
from typing import Any, Dict

from fastapi import HTTPException, status

from models.nautobot import OffboardDeviceRequest
from services.nautobot.offboarding.audit import log_offboarding_event
from services.nautobot.offboarding.checkmk_cleanup import CheckMKCleanupManager
from services.nautobot.offboarding.custom_fields import CustomFieldManager
from services.nautobot.offboarding.device_cleanup import DeviceCleanupManager
from services.nautobot.offboarding.ip_cleanup import IPCleanupManager
from services.nautobot.offboarding.settings import (
    get_offboarding_settings,
    normalize_integration_mode,
    validate_offboarding_settings,
)
from services.nautobot.offboarding.types import OffboardingResult, make_result

logger = logging.getLogger(__name__)


class OffboardingService:
    """Orchestrates the device offboarding workflow."""

    def __init__(self) -> None:
        self._device_cleanup = DeviceCleanupManager()
        self._ip_cleanup = IPCleanupManager()
        self._custom_fields = CustomFieldManager(self._device_cleanup)
        self._checkmk_cleanup = CheckMKCleanupManager()

    async def offboard_device(
        self,
        device_id: str,
        request: OffboardDeviceRequest,
        current_user: Dict[str, Any],
    ) -> OffboardingResult:
        """Offboard a device based on the provided request configuration."""
        results = make_result(device_id)

        # 1. Fetch device details
        device_details = await self._fetch_device_details(device_id)
        results["device_name"] = device_details.get("name", device_id)

        # 2. Determine integration mode
        offboarding_settings = get_offboarding_settings()
        logger.debug(
            "Retrieved offboarding settings: %s",
            offboarding_settings is not None,
        )

        integration_mode = normalize_integration_mode(
            request.nautobot_integration_mode or "remove"
        )

        logger.info(
            "Offboarding device %s - raw_mode='%s', normalized_mode='%s'",
            device_id,
            request.nautobot_integration_mode or "remove",
            integration_mode,
        )

        # 3. Execute mode-specific path
        if integration_mode == "remove":
            logger.debug("Taking REMOVAL path for device %s", device_id)
            await self._device_cleanup.handle_device_removal(device_id, results)
        else:
            logger.debug("Taking SET_OFFBOARDING path for device %s", device_id)
            # Validate settings before proceeding
            if not validate_offboarding_settings(offboarding_settings, results):
                logger.debug(
                    "Offboarding settings validation failed for device %s",
                    device_id,
                )
                return results

            # Handle device name clearing (independent of custom fields)
            if offboarding_settings.get("clear_device_name", False):
                logger.debug(
                    "clear_device_name is True - clearing device name for %s",
                    device_id,
                )
                try:
                    await self._device_cleanup.clear_device_name(device_id)
                    results["removed_items"].append("Device name cleared")
                    logger.info("Successfully cleared device name for %s", device_id)
                except HTTPException as exc:
                    results["errors"].append(
                        f"Failed to clear device name: {exc.detail}"
                    )
                    results["success"] = False
                    logger.error(
                        "Failed to clear device name for %s: %s", device_id, exc.detail
                    )
                except Exception as exc:
                    error_msg = (
                        f"Failed to clear device name for {device_id}: {str(exc)}"
                    )
                    results["errors"].append(error_msg)
                    results["success"] = False
                    logger.error(error_msg)

            # Handle serial number clearing (if keep_serial is False)
            if not offboarding_settings.get("keep_serial", False):
                logger.debug(
                    "keep_serial is False - clearing device serial number for %s",
                    device_id,
                )
                try:
                    await self._device_cleanup.clear_device_serial(device_id)
                    results["removed_items"].append("Device serial number cleared")
                    logger.info(
                        "Successfully cleared device serial number for %s", device_id
                    )
                except HTTPException as exc:
                    results["errors"].append(
                        f"Failed to clear device serial number: {exc.detail}"
                    )
                    results["success"] = False
                    logger.error(
                        "Failed to clear device serial number for %s: %s",
                        device_id,
                        exc.detail,
                    )
                except Exception as exc:
                    error_msg = f"Failed to clear device serial number for {device_id}: {str(exc)}"
                    results["errors"].append(error_msg)
                    results["success"] = False
                    logger.error(error_msg)

            # Handle custom fields processing
            await self._custom_fields.apply_offboarding_values(
                device_id, results, offboarding_settings, device_details
            )

            # Handle location, status, and role updates
            await self._device_cleanup.update_device_attributes(
                device_id, results, offboarding_settings
            )

        # 4. IP cleanup
        interface_ips_removed = []
        if request.remove_interface_ips:
            interface_ips_removed = await self._ip_cleanup.remove_interface_ips(
                device_id, device_details, results
            )
        else:
            results["skipped_items"].append("Interface IP removal was not requested")
            logger.info("Interface IP removal skipped (not requested)")

        # 5. Primary IP
        await self._ip_cleanup.remove_primary_ip(
            device_id, device_details, interface_ips_removed, request, results
        )

        # 6. CheckMK
        if request.remove_from_checkmk:
            await self._checkmk_cleanup.remove_host(
                device_details, current_user, results
            )
        else:
            results["skipped_items"].append("CheckMK removal was not requested")
            logger.info("CheckMK removal skipped (not requested)")

        # 7. Summary
        self._build_summary(results)

        # 8. Audit
        log_offboarding_event(
            results, device_details, request, current_user, integration_mode
        )

        return results

    async def _fetch_device_details(self, device_id: str) -> Dict[str, Any]:
        """Fetch device details using shared device query service."""
        try:
            from services.nautobot.devices import device_query_service

            # Use shared device details service
            device = await device_query_service.get_device_details(
                device_id=device_id,
                use_cache=True,
            )
            return device
        except ValueError as exc:
            # ValueError from service indicates device not found or query error
            if "not found" in str(exc).lower():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=str(exc),
                ) from exc
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(exc),
            ) from exc
        except Exception as exc:
            logger.error(
                "Error fetching device details for %s: %s", device_id, str(exc)
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to fetch device details: {str(exc)}",
            ) from exc

    def _build_summary(self, results: OffboardingResult) -> None:
        """Build summary message based on results."""
        removed_count = len(results["removed_items"])
        error_count = len(results["errors"])

        if error_count > 0:
            results["success"] = False
            results["summary"] = (
                "Offboarding partially completed: "
                f"{removed_count} items removed, {error_count} errors occurred"
            )
        else:
            results["summary"] = (
                f"Offboarding completed successfully: {removed_count} items removed"
            )

        logger.info(
            "Offboard process completed for device %s: %s",
            results["device_id"],
            results["summary"],
        )


offboarding_service = OffboardingService()

__all__ = ["offboarding_service", "OffboardingService"]
