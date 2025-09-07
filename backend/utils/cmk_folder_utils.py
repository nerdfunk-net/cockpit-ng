"""
Utility functions for working with CheckMK folders and paths.
"""

from __future__ import annotations
import logging
import re
from typing import Dict, Any

logger = logging.getLogger(__name__)


def parse_folder_value(folder_template: str, device_data: Dict[str, Any]) -> str:
    """Parse folder template variables and return the processed folder path.

    Supports variables like {_custom_field_data.net} and direct device attributes.
    
    Args:
        folder_template: Template string with variables in {key} format
        device_data: Device data dictionary from Nautobot
        
    Returns:
        Processed folder path with variables replaced
    """
    logger.debug(f"parse_folder_value: Starting with template='{folder_template}'")
    logger.debug(f"parse_folder_value: Device data keys: {list(device_data.keys())}")
    
    folder_path = folder_template
    custom_field_data = device_data.get("_custom_field_data", {})
    logger.debug(f"parse_folder_value: Custom field data: {custom_field_data}")

    # Find all template variables in the format {key} or {_custom_field_data.key}
    template_vars = re.findall(r"\{([^}]+)\}", folder_path)
    logger.debug(f"parse_folder_value: Found template variables: {template_vars}")

    for var in template_vars:
        logger.debug(f"parse_folder_value: Processing variable '{var}'")
        if var.startswith("_custom_field_data."):
            # Extract the custom field key
            custom_field_key = var.replace("_custom_field_data.", "")
            custom_field_value = custom_field_data.get(custom_field_key, "")
            logger.debug(f"parse_folder_value: Custom field '{custom_field_key}' = '{custom_field_value}'")
            folder_path = folder_path.replace(f"{{{var}}}", str(custom_field_value))
        elif var in device_data:
            # Direct device attribute
            device_value = device_data.get(var, "")
            # Handle nested attributes (e.g., location.name)
            if isinstance(device_value, dict) and "name" in device_value:
                actual_value = device_value["name"]
                logger.debug(f"parse_folder_value: Device attribute '{var}' is dict, using 'name': '{actual_value}'")
            else:
                actual_value = device_value
                logger.debug(f"parse_folder_value: Device attribute '{var}' = '{actual_value}'")
            folder_path = folder_path.replace(f"{{{var}}}", str(actual_value))
        else:
            logger.debug(f"parse_folder_value: Variable '{var}' not found in device data or custom fields")

    logger.debug(f"parse_folder_value: Final folder path: '{folder_path}'")
    return folder_path


def normalize_folder_path(folder_path: str) -> str:
    """Normalize CheckMK folder path by removing trailing slashes.
    
    Args:
        folder_path: Raw folder path
        
    Returns:
        Normalized folder path
    """
    logger.debug(f"normalize_folder_path: Input path: '{folder_path}'")
    
    if not folder_path or folder_path == "/":
        logger.debug("normalize_folder_path: Path is empty or root, returning '/'")
        return "/"
    
    normalized = folder_path.rstrip("/")
    logger.debug(f"normalize_folder_path: Normalized path: '{normalized}'")
    return normalized


def build_checkmk_folder_path(path_parts: list[str]) -> str:
    """Build CheckMK folder path from parts.
    
    Args:
        path_parts: List of folder path components
        
    Returns:
        CheckMK folder path with ~ separators
    """
    logger.debug(f"build_checkmk_folder_path: Input parts: {path_parts}")
    
    if not path_parts:
        logger.debug("build_checkmk_folder_path: No parts provided, returning '/'")
        return "/"
    
    result = "~" + "~".join(path_parts)
    logger.debug(f"build_checkmk_folder_path: Built path: '{result}'")
    return result


def split_checkmk_folder_path(folder_path: str) -> list[str]:
    """Split CheckMK folder path into components.
    
    Args:
        folder_path: CheckMK folder path
        
    Returns:
        List of path components
    """
    logger.debug(f"split_checkmk_folder_path: Input path: '{folder_path}'")
    
    if not folder_path or folder_path in ["/", "~"]:
        logger.debug("split_checkmk_folder_path: Path is empty or root, returning empty list")
        return []
    
    # Remove leading ~ if present and split by ~
    if folder_path.startswith("~"):
        path_parts = folder_path.lstrip("~").split("~")
        logger.debug(f"split_checkmk_folder_path: Splitting by '~': {path_parts}")
    else:
        path_parts = folder_path.lstrip("/").split("/")
        logger.debug(f"split_checkmk_folder_path: Splitting by '/': {path_parts}")
    
    result = [part for part in path_parts if part]  # Remove empty parts
    logger.debug(f"split_checkmk_folder_path: Final parts (empty removed): {result}")
    return result
