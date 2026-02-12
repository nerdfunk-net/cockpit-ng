"""Offboarding settings loading and validation."""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from services.nautobot.offboarding.types import OffboardingResult
from settings_manager import settings_manager

logger = logging.getLogger(__name__)


def get_offboarding_settings() -> Optional[Dict[str, Any]]:
    """Load offboarding settings from the settings manager."""
    try:
        return settings_manager.get_device_offboarding_settings()
    except Exception as exc:
        logger.error("Failed to load offboarding settings: %s", str(exc))
        return None


def validate_offboarding_settings(
    settings: Optional[Dict[str, Any]],
    results: OffboardingResult,
) -> bool:
    """Validate settings before processing. Returns True if valid."""
    logger.debug("Validating offboarding settings")

    if not settings:
        error_msg = "No offboarding settings configured - cannot proceed with set-offboarding mode"
        results["errors"].append(error_msg)
        results["success"] = False
        logger.error("%s", error_msg)
        return False

    # Check if remove_all_custom_fields is set
    remove_all_fields = settings.get("remove_all_custom_fields", False)
    logger.debug("remove_all_custom_fields = %s", remove_all_fields)

    # Check if clear_device_name is set
    clear_device_name = settings.get("clear_device_name", False)
    logger.debug("clear_device_name = %s", clear_device_name)

    # Check if custom field settings exist
    custom_field_settings = settings.get("custom_field_settings") or {}
    logger.debug("custom_field_settings = %s", custom_field_settings)

    # If remove_all_custom_fields is True or clear_device_name is True, we have valid actions
    if remove_all_fields or clear_device_name:
        logger.debug(
            "remove_all_custom_fields=%s or clear_device_name=%s - validation passed",
            remove_all_fields,
            clear_device_name,
        )
        return True

    # If remove_all_custom_fields and clear_device_name are both False, we need some custom field settings
    if not custom_field_settings:
        error_msg = (
            "No custom field settings configured, remove_all_custom_fields is False, "
            "and clear_device_name is False - cannot proceed with set-offboarding mode"
        )
        results["errors"].append(error_msg)
        results["success"] = False
        logger.error("%s", error_msg)
        return False

    logger.debug("Offboarding settings validation passed")
    return True


def normalize_integration_mode(mode: Optional[str]) -> str:
    """Convert integration mode aliases to canonical values ('remove' | 'set-offboarding')."""
    logger.debug("normalize_integration_mode called with mode='%s'", mode)

    if not mode:
        logger.debug("Mode is None/empty, defaulting to 'remove'")
        return "remove"

    normalized = mode.strip().lower()
    logger.debug("Normalized input '%s' to '%s'", mode, normalized)

    if normalized == "remove":
        logger.debug("Exact match for 'remove', returning 'remove'")
        return "remove"

    aliases = {
        "set-offboarding": "set-offboarding",
        "set offboarding": "set-offboarding",
        "set offboarding values": "set-offboarding",
    }
    result = aliases.get(normalized, "remove")
    logger.debug("Alias lookup for '%s' returned '%s'", normalized, result)
    return result
