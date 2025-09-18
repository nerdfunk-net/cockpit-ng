"""
Core configuration utilities and dependencies.
"""

from __future__ import annotations


def get_settings():
    """Get application settings."""
    from config import get_config

    return get_config()


def get_nautobot_service():
    """Get Nautobot service instance."""
    from services.nautobot import nautobot_service

    return nautobot_service


def get_settings_manager():
    """Get settings manager instance."""
    from settings_manager import settings_manager

    return settings_manager
