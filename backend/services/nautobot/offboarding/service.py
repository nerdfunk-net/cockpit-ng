"""Offboarding workflow orchestrator."""

from __future__ import annotations

import logging
from typing import Any, Dict

from fastapi import HTTPException, status

from models.nautobot import OffboardDeviceRequest
from services.nautobot.offboarding.audit import log_offboarding_event
from services.nautobot.offboarding.checkmk_cleanup import CheckMKCleanupManager
from services.nautobot.offboarding.device_cleanup import DeviceCleanupManager
from services.nautobot.offboarding.ip_cleanup import IPCleanupManager
from services.nautobot.offboarding.types import OffboardingResult, make_result

logger = logging.getLogger(__name__)


class OffboardingService:
    """Orchestrates the device offboarding workflow."""

    def __init__(self) -> None:
        self._device_cleanup = DeviceCleanupManager()
        self._ip_cleanup = IPCleanupManager()
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

        # 2. Remove device from Nautobot
        logger.info("Removing device %s from Nautobot", device_id)
        await self._device_cleanup.handle_device_removal(device_id, results)

        # 3. IP cleanup
        interface_ips_removed = []
        if request.remove_interface_ips:
            interface_ips_removed = await self._ip_cleanup.remove_interface_ips(
                device_id, device_details, results
            )
        else:
            results["skipped_items"].append("Interface IP removal was not requested")
            logger.info("Interface IP removal skipped (not requested)")

        # 4. Primary IP
        await self._ip_cleanup.remove_primary_ip(
            device_id, device_details, interface_ips_removed, request, results
        )

        # 5. CheckMK
        if request.remove_from_checkmk:
            await self._checkmk_cleanup.remove_host(
                device_details, current_user, results
            )
        else:
            results["skipped_items"].append("CheckMK removal was not requested")
            logger.info("CheckMK removal skipped (not requested)")

        # 6. Summary
        self._build_summary(results)

        # 7. Audit
        log_offboarding_event(
            results, device_details, request, current_user
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
