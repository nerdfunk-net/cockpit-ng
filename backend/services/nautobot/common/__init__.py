"""
Common utilities for Nautobot operations.

This package contains pure functions and exception classes used across
Nautobot service modules.
"""

from .validators import (
    is_valid_uuid,
    validate_ip_address,
    validate_mac_address,
    validate_cidr,
    validate_required_fields,
)

from .utils import (
    flatten_nested_fields,
    extract_nested_value,
    normalize_tags,
    prepare_update_data,
    extract_id_from_url,
)

from .exceptions import (
    NautobotError,
    NautobotValidationError,
    NautobotResourceNotFoundError,
    NautobotDuplicateResourceError,
    NautobotAPIError,
    is_duplicate_error,
    handle_already_exists_error,
)

__all__ = [
    # Validators
    "is_valid_uuid",
    "validate_ip_address",
    "validate_mac_address",
    "validate_cidr",
    "validate_required_fields",
    # Utils
    "flatten_nested_fields",
    "extract_nested_value",
    "normalize_tags",
    "prepare_update_data",
    "extract_id_from_url",
    # Exceptions
    "NautobotError",
    "NautobotValidationError",
    "NautobotResourceNotFoundError",
    "NautobotDuplicateResourceError",
    "NautobotAPIError",
    "is_duplicate_error",
    "handle_already_exists_error",
]
