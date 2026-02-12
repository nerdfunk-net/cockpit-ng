"""CheckMK host cleanup during offboarding."""

from __future__ import annotations

import logging
from typing import Any, Dict

from services.nautobot.offboarding.types import OffboardingResult

logger = logging.getLogger(__name__)


class CheckMKCleanupManager:
    """Handles CheckMK host removal during offboarding."""

    async def remove_host(
        self,
        device_details: Dict[str, Any],
        current_user: Dict[str, Any],
        results: OffboardingResult,
    ) -> None:
        """Remove device from CheckMK."""
        logger.info("Processing CheckMK removal")
        device_name = device_details.get("name")

        if not device_name:
            results["skipped_items"].append(
                "CheckMK removal skipped: No device name found"
            )
            logger.warning(
                "CheckMK removal skipped: No device name found in device details"
            )
            return

        try:
            from services.checkmk import checkmk_host_service

            await checkmk_host_service.delete_host(device_name)
            results["removed_items"].append(f"CheckMK Host: {device_name}")
            logger.info("Successfully removed device %s from CheckMK", device_name)
        except ValueError as exc:
            # CheckMK not configured
            results["errors"].append(str(exc))
            logger.error(
                "Failed to remove device %s from CheckMK: %s",
                device_name,
                str(exc),
            )
        except Exception as exc:
            error_msg = (
                f"Failed to remove device {device_name} from CheckMK: {str(exc)}"
            )
            results["errors"].append(error_msg)
            logger.error(error_msg)
