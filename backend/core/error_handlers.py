"""
Generalized error handling decorators for FastAPI endpoints.
Provides consistent error logging and HTTP exception handling across all routers.

Created in Phase 4 of Celery refactoring to eliminate repetitive try/except blocks
across the entire codebase.
"""

from functools import wraps
from fastapi import HTTPException, status
import logging
import asyncio
from typing import Callable, Any

logger = logging.getLogger(__name__)


def handle_errors(
    operation: str, error_status: int = status.HTTP_500_INTERNAL_SERVER_ERROR
):
    """
    General-purpose decorator for consistent FastAPI endpoint error handling.

    Wraps endpoint functions to provide standardized error handling:
    - Logs errors with full stack trace
    - Re-raises HTTPException as-is (for custom error responses)
    - Converts other exceptions to specified HTTP error status
    - Works with both sync and async functions
    - Provides detailed context for debugging

    Args:
        operation: Human-readable description of the operation
                  (e.g., "fetch devices", "update user", "delete template")
        error_status: HTTP status code for non-HTTP exceptions (default: 500)

    Returns:
        Decorated function with error handling

    Usage:
        @router.get("/users/{user_id}")
        @handle_errors("fetch user details")
        async def get_user(user_id: int):
            # No try/except needed
            user = db.get_user(user_id)
            return user

        @router.post("/devices")
        @handle_errors("create device", error_status=400)
        async def create_device(device: DeviceCreate):
            # Will return 400 on validation errors
            return create_device_in_db(device)

    Example:
        Instead of:
            try:
                result = some_operation()
                return result
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Failed to do operation: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        Use:
            @handle_errors("do operation")
            async def endpoint():
                result = some_operation()
                return result
    """

    def decorator(func: Callable) -> Callable:
        # Handle async functions
        if asyncio.iscoroutinefunction(func):

            @wraps(func)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                try:
                    return await func(*args, **kwargs)
                except HTTPException:
                    # Re-raise HTTP exceptions as-is (allows custom status codes)
                    raise
                except Exception as e:
                    # Log error with full context
                    logger.error(
                        f"Failed to {operation}: {e}",
                        exc_info=True,
                        extra={
                            "operation": operation,
                            "function": func.__name__,
                            "module": func.__module__,
                            "args": args,
                            "kwargs": kwargs,
                        },
                    )
                    # Convert to HTTP error
                    raise HTTPException(
                        status_code=error_status,
                        detail=f"Failed to {operation}: {str(e)}",
                    )

            return async_wrapper

        # Handle sync functions
        else:

            @wraps(func)
            def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
                try:
                    return func(*args, **kwargs)
                except HTTPException:
                    # Re-raise HTTP exceptions as-is
                    raise
                except Exception as e:
                    # Log error with full context
                    logger.error(
                        f"Failed to {operation}: {e}",
                        exc_info=True,
                        extra={
                            "operation": operation,
                            "function": func.__name__,
                            "module": func.__module__,
                            "args": args,
                            "kwargs": kwargs,
                        },
                    )
                    # Convert to HTTP error
                    raise HTTPException(
                        status_code=error_status,
                        detail=f"Failed to {operation}: {str(e)}",
                    )

            return sync_wrapper

    return decorator


def handle_not_found(operation: str, resource_name: str = "Resource"):
    """
    Specialized decorator for operations that may result in 404 Not Found.

    Catches common "not found" exceptions and converts them to HTTP 404.
    Useful for GET/DELETE endpoints on specific resources.

    Args:
        operation: Human-readable description of the operation
        resource_name: Name of the resource type (e.g., "User", "Device")

    Returns:
        Decorated function with 404 error handling

    Usage:
        @router.get("/users/{user_id}")
        @handle_not_found("fetch user", "User")
        async def get_user(user_id: int):
            user = db.get_user(user_id)
            if not user:
                raise ValueError(f"User {user_id} not found")
            return user
    """

    def decorator(func: Callable) -> Callable:
        if asyncio.iscoroutinefunction(func):

            @wraps(func)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                try:
                    return await func(*args, **kwargs)
                except HTTPException:
                    raise
                except (ValueError, KeyError, LookupError) as e:
                    # Common "not found" exceptions
                    logger.warning(
                        f"{resource_name} not found during {operation}: {e}",
                        extra={
                            "operation": operation,
                            "resource": resource_name,
                            "function": func.__name__,
                        },
                    )
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"{resource_name} not found",
                    )
                except Exception as e:
                    logger.error(
                        f"Failed to {operation}: {e}",
                        exc_info=True,
                        extra={"operation": operation, "function": func.__name__},
                    )
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Failed to {operation}: {str(e)}",
                    )

            return async_wrapper
        else:

            @wraps(func)
            def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
                try:
                    return func(*args, **kwargs)
                except HTTPException:
                    raise
                except (ValueError, KeyError, LookupError) as e:
                    logger.warning(
                        f"{resource_name} not found during {operation}: {e}",
                        extra={
                            "operation": operation,
                            "resource": resource_name,
                            "function": func.__name__,
                        },
                    )
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"{resource_name} not found",
                    )
                except Exception as e:
                    logger.error(
                        f"Failed to {operation}: {e}",
                        exc_info=True,
                        extra={"operation": operation, "function": func.__name__},
                    )
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Failed to {operation}: {str(e)}",
                    )

            return sync_wrapper

    return decorator


def handle_validation_errors(operation: str):
    """
    Specialized decorator for operations that may have validation errors.

    Catches validation exceptions and converts them to HTTP 400 Bad Request.
    Useful for POST/PUT/PATCH endpoints with complex validation.

    Args:
        operation: Human-readable description of the operation

    Returns:
        Decorated function with validation error handling

    Usage:
        @router.post("/users")
        @handle_validation_errors("create user")
        async def create_user(user: UserCreate):
            validate_username(user.username)  # May raise ValueError
            return db.create_user(user)
    """

    def decorator(func: Callable) -> Callable:
        if asyncio.iscoroutinefunction(func):

            @wraps(func)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                try:
                    return await func(*args, **kwargs)
                except HTTPException:
                    raise
                except (ValueError, TypeError, AssertionError) as e:
                    # Common validation exceptions
                    logger.warning(
                        f"Validation error during {operation}: {e}",
                        extra={
                            "operation": operation,
                            "function": func.__name__,
                            "error_type": type(e).__name__,
                        },
                    )
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Validation error: {str(e)}",
                    )
                except Exception as e:
                    logger.error(
                        f"Failed to {operation}: {e}",
                        exc_info=True,
                        extra={"operation": operation, "function": func.__name__},
                    )
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Failed to {operation}: {str(e)}",
                    )

            return async_wrapper
        else:

            @wraps(func)
            def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
                try:
                    return func(*args, **kwargs)
                except HTTPException:
                    raise
                except (ValueError, TypeError, AssertionError) as e:
                    logger.warning(
                        f"Validation error during {operation}: {e}",
                        extra={
                            "operation": operation,
                            "function": func.__name__,
                            "error_type": type(e).__name__,
                        },
                    )
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Validation error: {str(e)}",
                    )
                except Exception as e:
                    logger.error(
                        f"Failed to {operation}: {e}",
                        exc_info=True,
                        extra={"operation": operation, "function": func.__name__},
                    )
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Failed to {operation}: {str(e)}",
                    )

            return sync_wrapper

    return decorator


# Alias for backward compatibility with celery_error_handler.py
handle_celery_errors = handle_errors
