"""
Custom exceptions for Nautobot operations.
"""

from __future__ import annotations

from fastapi import HTTPException, status


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
    logger.warning("%s already exists: %s", resource_type, error_msg)

    return {
        "error": "already_exists",
        "message": f"{resource_type} already exists",
        "detail": error_msg,
    }


def translate_http_exception(exc: Exception, context: str) -> HTTPException:
    """Map common Nautobot API errors to appropriate HTTP status codes.

    Args:
        exc: The exception to translate
        context: Context message describing what operation failed

    Returns:
        HTTPException with appropriate status code
    """
    message = str(exc)
    if "404" in message or "Not Found" in message:
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{context}: Resource not found",
        )
    if "403" in message:
        return HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{context}: Permission denied",
        )
    if "400" in message:
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{context}: Invalid request",
        )
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"{context}: {message}",
    )
