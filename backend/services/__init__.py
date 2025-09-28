"""
Service layer for external integrations and business logic.
"""

from .nautobot import nautobot_service
from .offboarding_service import offboarding_service

__all__ = ["nautobot_service", "offboarding_service"]
