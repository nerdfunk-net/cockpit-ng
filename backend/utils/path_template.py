"""
Path Template Utility
Replaces template variables in path strings with Nautobot device attributes.

Supports nested attributes like {location.parent.name} and {custom_field_data.cf_net}.
"""

import logging
import re
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


def replace_template_variables(template: str, device_data: Dict[str, Any]) -> str:
    """
    Replace template variables in a path template with device attributes from Nautobot.

    Args:
        template: Path template string with variables like "{device_name}", "{location.name}", etc.
        device_data: Device data dictionary from Nautobot GraphQL query

    Returns:
        str: Path with variables replaced with actual values

    Examples:
        >>> device_data = {
        ...     "name": "router01",
        ...     "location": {"name": "DC1", "parent": {"name": "USA"}},
        ...     "custom_field_data": {"cf_net": "core"}
        ... }
        >>> replace_template_variables("{location.parent.name}/{location.name}/{device_name}.cfg", device_data)
        "USA/DC1/router01.cfg"
    """
    if not template:
        return template

    # Find all variables in the template (format: {variable.path.here})
    pattern = r"\{([^}]+)\}"
    matches = re.findall(pattern, template)

    result = template
    for match in matches:
        variable_path = match.strip()

        # Get the value from device_data
        value = _get_nested_value(device_data, variable_path)

        if value is not None:
            # Replace the variable with its value
            result = result.replace(f"{{{match}}}", str(value))
            logger.debug("Replaced {%s} with '%s'", match, value)
        else:
            # Keep the original variable if not found, or replace with empty string
            logger.warning(
                "Variable '%s' not found in device data, keeping as-is", match
            )
            # Optionally: result = result.replace(f"{{{match}}}", "")

    return result


def _get_nested_value(data: Dict[str, Any], path: str) -> Optional[Any]:
    """
    Get a nested value from a dictionary using dot notation.

    Args:
        data: The dictionary to search
        path: Dot-separated path like "location.parent.name"

    Returns:
        The value at the path, or None if not found

    Examples:
        >>> data = {"location": {"parent": {"name": "USA"}}, "name": "router01"}
        >>> _get_nested_value(data, "location.parent.name")
        "USA"
        >>> _get_nested_value(data, "name")
        "router01"
        >>> _get_nested_value(data, "device_name")  # Special alias for 'name'
        "router01"
        >>> _get_nested_value(data, "custom_field_data.cf_net")
        "core"
    """
    # Handle special aliases
    if path == "device_name":
        path = "name"

    # For backwards compatibility: map custom_fields to custom_field_data
    if path.startswith("custom_fields."):
        path = path.replace("custom_fields.", "custom_field_data.", 1)
        logger.debug("Mapping custom_fields to custom_field_data: %s", path)

    # Split the path and traverse the dictionary
    keys = path.split(".")
    current = data

    for key in keys:
        if isinstance(current, dict) and key in current:
            current = current[key]
        else:
            return None

    return current


def sanitize_path_component(value: str) -> str:
    """
    Sanitize a path component to remove invalid characters.

    Args:
        value: The path component to sanitize

    Returns:
        str: Sanitized path component safe for filesystem use
    """
    # Replace invalid characters with underscores
    invalid_chars = '<>:"|?*'
    for char in invalid_chars:
        value = value.replace(char, "_")

    # Remove leading/trailing dots and spaces
    value = value.strip(". ")

    return value


def validate_template_path(template: str) -> bool:
    """
    Validate that a template path has valid syntax.

    Args:
        template: The template string to validate

    Returns:
        bool: True if valid, False otherwise
    """
    if not template:
        return False

    # Check for balanced curly braces
    open_count = template.count("{")
    close_count = template.count("}")

    if open_count != close_count:
        logger.error("Unbalanced braces in template: %s", template)
        return False

    # Check for empty variables
    pattern = r"\{\s*\}"
    if re.search(pattern, template):
        logger.error("Empty variable in template: %s", template)
        return False

    return True
