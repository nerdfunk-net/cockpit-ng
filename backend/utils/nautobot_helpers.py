"""
Utility functions for Nautobot operations.

This module provides helper functions for common Nautobot-related tasks
such as retrieving configuration and building HTTP headers.
"""

from typing import Tuple


def get_nautobot_config() -> Tuple[str, str]:
    """
    Get Nautobot URL and token from database settings with fallback to env config.

    Tries to retrieve Nautobot configuration from the database settings first.
    If database settings are not available or incomplete, falls back to
    environment-based configuration.

    Returns:
        Tuple[str, str]: A tuple containing (nautobot_url, nautobot_token)

    Example:
        >>> nautobot_url, nautobot_token = get_nautobot_config()
        >>> print(f"Using Nautobot at {nautobot_url}")
    """
    from settings_manager import settings_manager
    from config import settings

    try:
        db_settings = settings_manager.get_nautobot_settings()
        if db_settings and db_settings.get("url") and db_settings.get("token"):
            return (db_settings["url"].rstrip("/"), db_settings["token"])
        raise Exception("No database settings")
    except Exception:
        return (settings.nautobot_url.rstrip("/"), settings.nautobot_token)


def get_nautobot_headers(token: str) -> dict:
    """
    Get standard Nautobot API headers.

    Args:
        token: Nautobot API token

    Returns:
        dict: HTTP headers dictionary with Content-Type and Authorization

    Example:
        >>> headers = get_nautobot_headers("my-api-token")
        >>> print(headers)
        {'Content-Type': 'application/json', 'Authorization': 'Token my-api-token'}
    """
    return {
        "Content-Type": "application/json",
        "Authorization": f"Token {token}",
    }
