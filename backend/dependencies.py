"""
FastAPI dependency providers.

Only FastAPI Depends() providers live here. No business logic.

Usage:
- Import these in routers as: `Depends(get_nautobot_service)` etc.
- Tasks must NOT import from this file — use service_factory.py instead.

See: doc/refactoring/REFACTORING_SERVICES.md — Phase 2
"""

from __future__ import annotations
from typing import TYPE_CHECKING
from fastapi import Request

import service_factory

if TYPE_CHECKING:
    from services.nautobot.client import NautobotService
    from services.nautobot.metadata_service import NautobotMetadataService
    from services.nautobot.offboarding.service import OffboardingService
    from services.inventory.inventory import InventoryService
    from services.nautobot.devices.query import DeviceQueryService
    from services.checkmk.client import CheckMKService
    from services.checkmk.host_service import CheckMKHostService


def get_nautobot_service(request: Request) -> "NautobotService":
    """Provide the app-scoped NautobotService from app.state."""
    return request.app.state.nautobot_service


def get_inventory_service() -> "InventoryService":
    """Provide a new InventoryService instance."""
    return service_factory.build_inventory_service()


def get_device_query_service() -> "DeviceQueryService":
    """Provide a new DeviceQueryService instance."""
    return service_factory.build_device_query_service()


def get_checkmk_service() -> "CheckMKService":
    """Provide a new CheckMKService instance."""
    return service_factory.build_checkmk_service()


def get_checkmk_host_service() -> "CheckMKHostService":
    """Provide a new CheckMKHostService instance."""
    return service_factory.build_checkmk_host_service()


def get_nautobot_metadata_service() -> "NautobotMetadataService":
    """Provide a NautobotMetadataService instance."""
    return service_factory.build_nautobot_metadata_service()


def get_offboarding_service() -> "OffboardingService":
    """Provide a new OffboardingService instance."""
    return service_factory.build_offboarding_service()
