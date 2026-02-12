"""Nautobot device offboarding module."""

from services.nautobot.offboarding.service import (
    OffboardingService,
    offboarding_service,
)

__all__ = ["offboarding_service", "OffboardingService"]
