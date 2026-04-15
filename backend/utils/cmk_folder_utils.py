"""
Utility functions for working with CheckMK folders and paths.
"""

from __future__ import annotations
import logging
import re
from typing import Dict, Any

logger = logging.getLogger(__name__)


def _resolve_location_type_filter(
    device_data: Dict[str, Any], field_path: str, filter_value: str
) -> str:
    """Find the first location in the hierarchy matching location_type and return its field.

    Traverses device.location → .parent → .parent.parent → ...
    Returns the target field (e.g. 'name') from the first location whose
    location_type.name matches filter_value (case-insensitive).

    Args:
        device_data: Device data dictionary from Nautobot.
        field_path: Field path such as "location.name" (root key + target field).
        filter_value: Location type name to match, e.g. "City".

    Returns:
        Field value from the matching location, or "" if none found.
    """
    parts = field_path.split(".")
    if len(parts) < 2:
        logger.debug(
            "_resolve_location_type_filter: field_path '%s' too short, need at least 2 parts",
            field_path,
        )
        return ""

    root_key = parts[0]  # e.g. "location"
    target_field = parts[-1]  # e.g. "name"

    location = device_data.get(root_key)
    filter_lower = filter_value.lower()

    while location and isinstance(location, dict):
        location_type = location.get("location_type") or {}
        type_name = (
            location_type.get("name", "") if isinstance(location_type, dict) else ""
        )
        if type_name.lower() == filter_lower:
            value = location.get(target_field, "")
            logger.debug(
                "_resolve_location_type_filter: matched location_type='%s', %s='%s'",
                type_name,
                target_field,
                value,
            )
            return str(value) if value else ""
        location = location.get("parent")

    logger.debug(
        "_resolve_location_type_filter: no location with location_type='%s' found in hierarchy",
        filter_value,
    )
    return ""


def parse_folder_value(folder_template: str, device_data: Dict[str, Any]) -> str:
    """Parse folder template variables and return the processed folder path.

    Supports multiple variable types:
    - Custom field data: {_custom_field_data.net}
    - Nested device attributes: {location.name}, {role.slug}
    - Direct device attributes: {name}, {serial}

    Args:
        folder_template: Template string with variables in {key} format
        device_data: Device data dictionary from Nautobot

    Returns:
        Processed folder path with variables replaced
    """
    logger.debug("parse_folder_value: Starting with template='%s'", folder_template)
    logger.debug("parse_folder_value: Device data keys: %s", list(device_data.keys()))

    folder_path = folder_template
    custom_field_data = device_data.get("_custom_field_data", {})
    logger.debug("parse_folder_value: Custom field data: %s", custom_field_data)

    # Find all template variables in the format {key} or {_custom_field_data.key}
    template_vars = re.findall(r"\{([^}]+)\}", folder_path)
    logger.debug("parse_folder_value: Found template variables: %s", template_vars)

    for var in template_vars:
        logger.debug("parse_folder_value: Processing variable '%s'", var)
        actual_value = ""

        # Handle filter syntax: "{location.name | location_type:City}"
        if " | " in var:
            field_part, filter_part = var.split(" | ", 1)
            filter_part = filter_part.strip()
            if ":" in filter_part:
                filter_method, filter_value = filter_part.split(":", 1)
                filter_method = filter_method.strip()
                filter_value = filter_value.strip()
                if filter_method == "location_type":
                    actual_value = _resolve_location_type_filter(
                        device_data, field_part.strip(), filter_value
                    )
                else:
                    logger.warning(
                        "parse_folder_value: unsupported filter method '%s' in variable '%s'",
                        filter_method,
                        var,
                    )
            folder_path = folder_path.replace(f"{{{var}}}", str(actual_value))
            continue

        if var.startswith("_custom_field_data."):
            # Handle custom field data: {_custom_field_data.net}
            custom_field_key = var.replace("_custom_field_data.", "")
            actual_value = custom_field_data.get(custom_field_key, "")
            logger.debug(
                "parse_folder_value: Custom field '%s' = '%s'",
                custom_field_key,
                actual_value,
            )
        else:
            # Handle regular device data with dot notation: {location.name}
            if "." in var:
                # Split the path and traverse the nested dictionary
                path_parts = var.split(".")
                current_value = device_data

                for part in path_parts:
                    if isinstance(current_value, dict) and part in current_value:
                        current_value = current_value[part]
                        logger.debug(
                            "parse_folder_value: Traversing '%s', current value: %s",
                            part,
                            current_value,
                        )
                    else:
                        logger.debug(
                            "parse_folder_value: Path part '%s' not found or not a dict",
                            part,
                        )
                        current_value = ""
                        break

                actual_value = current_value if current_value != device_data else ""
                logger.debug(
                    "parse_folder_value: Nested attribute '%s' = '%s'",
                    var,
                    actual_value,
                )
            else:
                # Simple direct attribute: {name}
                actual_value = device_data.get(var, "")
                logger.debug(
                    "parse_folder_value: Direct attribute '%s' = '%s'",
                    var,
                    actual_value,
                )

        # Replace the variable in the folder path
        folder_path = folder_path.replace(f"{{{var}}}", str(actual_value))

        if not actual_value:
            logger.debug(
                "parse_folder_value: Variable '%s' resolved to empty value", var
            )

    logger.debug("parse_folder_value: Final folder path: '%s'", folder_path)
    return folder_path


def normalize_folder_path(folder_path: str) -> str:
    """Normalize CheckMK folder path by removing trailing slashes.

    Args:
        folder_path: Raw folder path

    Returns:
        Normalized folder path
    """
    logger.debug("normalize_folder_path: Input path: '%s'", folder_path)

    if not folder_path or folder_path == "/":
        logger.debug("normalize_folder_path: Path is empty or root, returning '/'")
        return "/"

    normalized = folder_path.rstrip("/")
    logger.debug("normalize_folder_path: Normalized path: '%s'", normalized)
    return normalized


def build_checkmk_folder_path(path_parts: list[str]) -> str:
    """Build CheckMK folder path from parts.

    Args:
        path_parts: List of folder path components

    Returns:
        CheckMK folder path with ~ separators
    """
    logger.debug("build_checkmk_folder_path: Input parts: %s", path_parts)

    if not path_parts:
        logger.debug("build_checkmk_folder_path: No parts provided, returning '/'")
        return "/"

    result = "~" + "~".join(path_parts)
    logger.debug("build_checkmk_folder_path: Built path: '%s'", result)
    return result


def split_checkmk_folder_path(folder_path: str) -> list[str]:
    """Split CheckMK folder path into components.

    Args:
        folder_path: CheckMK folder path

    Returns:
        List of path components
    """
    logger.debug("split_checkmk_folder_path: Input path: '%s'", folder_path)

    if not folder_path or folder_path in ["/", "~"]:
        logger.debug(
            "split_checkmk_folder_path: Path is empty or root, returning empty list"
        )
        return []

    # Remove leading ~ if present and split by ~
    if folder_path.startswith("~"):
        path_parts = folder_path.lstrip("~").split("~")
        logger.debug("split_checkmk_folder_path: Splitting by '~': %s", path_parts)
    else:
        path_parts = folder_path.lstrip("/").split("/")
        logger.debug("split_checkmk_folder_path: Splitting by '/': %s", path_parts)

    result = [part for part in path_parts if part]  # Remove empty parts
    logger.debug("split_checkmk_folder_path: Final parts (empty removed): %s", result)
    return result
