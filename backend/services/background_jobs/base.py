"""
Base utilities for background jobs.
Shared functionality used across multiple Celery tasks.
"""

import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


def format_progress_message(current: int, total: int, operation: str) -> str:
    """
    Format a progress message for task updates.

    Args:
        current: Current item being processed
        total: Total items to process
        operation: Description of operation (e.g., "Cached", "Processed")

    Returns:
        Formatted progress message
    """
    percentage = (current / total * 100) if total > 0 else 0
    return f"{operation} {current}/{total} ({percentage:.1f}%)"


def extract_device_essentials(device: Dict[str, Any]) -> Dict[str, Optional[str]]:
    """
    Extract essential device information for lightweight caching.

    Args:
        device: Full device object from Nautobot

    Returns:
        Dictionary with essential device fields
    """
    return {
        "id": device.get("id"),
        "name": device.get("name"),
        "role": device.get("role", {}).get("name") if device.get("role") else None,
        "location": device.get("location", {}).get("name")
        if device.get("location")
        else None,
        "status": device.get("status", {}).get("name")
        if device.get("status")
        else None,
        "primary_ip4": device.get("primary_ip4", {}).get("address")
        if device.get("primary_ip4")
        else None,
        "device_type": device.get("device_type", {}).get("model")
        if device.get("device_type")
        else None,
        "manufacturer": device.get("device_type", {})
        .get("manufacturer", {})
        .get("name")
        if device.get("device_type", {}).get("manufacturer")
        else None,
        "platform": device.get("platform", {}).get("name")
        if device.get("platform")
        else None,
    }


def safe_graphql_query(
    result: Dict[str, Any],
) -> tuple[bool, Optional[str], Optional[Dict]]:
    """
    Safely extract data from GraphQL query result.

    Args:
        result: GraphQL query result

    Returns:
        Tuple of (success, error_message, data)
    """
    if "errors" in result:
        error_msg = f"GraphQL errors: {result['errors']}"
        logger.error(error_msg)
        return False, error_msg, None

    data = result.get("data", {})
    return True, None, data
