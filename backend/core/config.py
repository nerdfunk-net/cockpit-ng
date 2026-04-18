"""
Core configuration utilities and dependencies.
"""

from __future__ import annotations


def get_settings():
    """Get application settings."""
    from config import settings

    return settings


def get_nautobot_service():
    """Get Nautobot service instance."""
    import service_factory

    return service_factory.build_nautobot_service()


def get_settings_manager():
    """Get settings manager instance."""
    from settings_manager import settings_manager

    return settings_manager
