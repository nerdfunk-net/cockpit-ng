"""
Nautobot integration services.

This package contains services for:
- Nautobot API client
- Device operations (creation, update, query, import, common)
- Configuration operations (backup, config management)
- Device offboarding
- Helper utilities
"""

from .client import nautobot_service, NautobotService
from .offboarding import offboarding_service
from .metadata_service import NautobotMetadataService

# Create metadata service instance
nautobot_metadata_service = NautobotMetadataService(nautobot_service)

__all__ = [
    "nautobot_service",
    "NautobotService",
    "offboarding_service",
    "nautobot_metadata_service",
    "NautobotMetadataService",
]
