"""
Custom exceptions for Nautobot operations.
"""


class NautobotError(Exception):
    """Base exception for Nautobot operations."""

    pass


class NautobotValidationError(NautobotError):
    """Validation failed."""

    pass


class NautobotResourceNotFoundError(NautobotError):
    """Resource not found in Nautobot."""

    def __init__(self, resource_type: str, identifier: str):
        self.resource_type = resource_type
        self.identifier = identifier
        super().__init__(f"{resource_type} not found: {identifier}")


class NautobotDuplicateResourceError(NautobotError):
    """Resource already exists."""

    def __init__(self, resource_type: str, identifier: str):
        self.resource_type = resource_type
        self.identifier = identifier
        super().__init__(f"{resource_type} already exists: {identifier}")


class NautobotAPIError(NautobotError):
    """API request failed."""

    pass


def is_duplicate_error(error: Exception) -> bool:
    """
    Check if error is a "duplicate" or "already exists" error.

    Args:
        error: Exception to check

    Returns:
        True if this is a duplicate error, False otherwise
    """
    error_msg = str(error).lower()
    duplicate_keywords = ["already exists", "duplicate", "unique constraint"]
    return any(keyword in error_msg for keyword in duplicate_keywords)


def handle_already_exists_error(error: Exception, resource_type: str) -> dict:
    """
    Handle "already exists" errors with appropriate logging and response.

    Args:
        error: The exception that occurred
        resource_type: Type of resource (for logging)

    Returns:
        Dictionary with error info
    """
    import logging

    logger = logging.getLogger(__name__)
    error_msg = str(error)
    logger.warning(f"{resource_type} already exists: {error_msg}")

    return {
        "error": "already_exists",
        "message": f"{resource_type} already exists",
        "detail": error_msg,
    }
