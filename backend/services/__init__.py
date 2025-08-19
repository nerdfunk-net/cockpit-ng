"""
Service layer for external integrations and business logic.
"""

from .nautobot import nautobot_service

__all__ = ["nautobot_service"]
