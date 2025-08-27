"""
Authentication module for MCP server.
Handles API key validation against the Cockpit backend user database.
"""

import os
import sys
import sqlite3
import logging
from typing import Optional, Dict, Any
from contextlib import contextmanager

# Add backend path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

logger = logging.getLogger(__name__)

# Configuration
DATA_DIRECTORY = os.getenv("DATA_DIRECTORY", os.path.join(os.path.dirname(__file__), "..", "data"))
DB_PATH = os.path.join(DATA_DIRECTORY, "settings", "cockpit_settings.db")


def validate_api_key(api_key: str) -> Optional[Dict[str, Any]]:
    """
    Validate API key against user profiles database.
    
    Args:
        api_key: API key to validate
        
    Returns:
        User info dict if valid, None if invalid
    """
    if not api_key or len(api_key) != 42:
        return None
    
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        
        # Find user with matching API key
        user_row = conn.execute(
            "SELECT username FROM user_profiles WHERE api_key = ? AND api_key IS NOT NULL", 
            (api_key,)
        ).fetchone()
        
        conn.close()
        
        if not user_row:
            logger.warning(f"Invalid API key attempted: {api_key[:8]}...")
            return None
        
        username = user_row["username"]
        
        # Get full user details from user management system
        try:
            from services.user_management import get_user_by_username
            user = get_user_by_username(username)
            
            if not user or user["status"] != "active":
                logger.warning(f"User {username} account inactive or not found")
                return None
            
            return {
                "username": user["username"],
                "user_id": user["id"],
                "permissions": user["permissions"],
                "realname": user["realname"]
            }
            
        except ImportError:
            # Fallback if user management service is not available
            logger.warning("User management service not available, using basic validation")
            return {
                "username": username,
                "user_id": None,
                "permissions": 0,
                "realname": username
            }
        
    except sqlite3.Error as e:
        logger.error(f"Database error during API key validation: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error during API key validation: {e}")
        return None


# Global context for storing current request authentication
_current_user_context: Optional[Dict[str, Any]] = None


@contextmanager
def authenticated_context(api_key: str):
    """
    Context manager for authenticated MCP requests.
    
    Args:
        api_key: API key from request
    """
    global _current_user_context
    
    # Validate API key
    user_info = validate_api_key(api_key)
    if not user_info:
        raise Exception("Invalid or missing API key")
    
    # Set context
    old_context = _current_user_context
    _current_user_context = user_info
    
    try:
        yield user_info
    finally:
        # Restore old context
        _current_user_context = old_context


def get_current_user() -> Optional[Dict[str, Any]]:
    """
    Get current authenticated user from context.
    
    Returns:
        User info dict if authenticated, None otherwise
    """
    return _current_user_context


def require_authentication() -> Dict[str, Any]:
    """
    Require authentication for current request.
    
    Returns:
        User info dict
        
    Raises:
        Exception if not authenticated
    """
    user_info = get_current_user()
    if not user_info:
        raise Exception("Authentication required")
    return user_info


def get_api_key_from_env() -> Optional[str]:
    """
    Get API key from environment variables for development/testing.
    
    Returns:
        API key string or None
    """
    return os.getenv("COCKPIT_API_KEY")