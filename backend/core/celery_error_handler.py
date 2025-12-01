"""
Centralized error handling for Celery API endpoints.
Provides consistent error logging and HTTP exception raising.

Created in Phase 3 of Celery refactoring to reduce code duplication.
Refactored in Phase 4 to use general-purpose error handling utilities.

DEPRECATED: Import from core.error_handlers instead.
This module is kept for backward compatibility only.
"""

from core.error_handlers import handle_errors

# Backward compatibility alias
handle_celery_errors = handle_errors
