"""
Service factory: plain Python factory functions for constructing services.

No FastAPI imports. No global state.

Usage:
- FastAPI routers: use dependencies.py (which calls this module internally)
- Celery tasks and non-router code: import and call factory functions directly

See: doc/refactoring/REFACTORING_SERVICES.md — Phase 2
"""

from __future__ import annotations
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from services.nautobot.client import NautobotService
    from services.nautobot.sync_client import NautobotSyncClient
    from services.nautobot.metadata_service import NautobotMetadataService
    from services.nautobot.offboarding.service import OffboardingService
    from services.inventory.inventory import InventoryService
    from services.nautobot.devices.query import DeviceQueryService
    from services.checkmk.client import CheckMKService
    from services.checkmk.host_service import CheckMKHostService
    from checkmk.client import CheckMKClient


def build_nautobot_service() -> "NautobotService":
    """Return the module-level NautobotService singleton.

    In the FastAPI app, the singleton is lifecycle-managed via lifespan.
    In Celery tasks, use build_nautobot_sync_client() instead for sync calls,
    or create a short-lived NautobotService and call startup()/shutdown()
    around a single asyncio.run() block.
    """
    from services.nautobot.client import nautobot_service

    return nautobot_service


def build_nautobot_sync_client() -> "NautobotSyncClient":
    """Create a new NautobotSyncClient for sync Celery task usage."""
    from services.nautobot.sync_client import NautobotSyncClient

    return NautobotSyncClient()


def build_checkmk_client(site_name: Optional[str] = None) -> "CheckMKClient":
    """Create a CheckMK client from database settings.

    Absorbs the logic from services/checkmk/client_factory.py.
    """
    from services.checkmk.client_factory import get_checkmk_client

    return get_checkmk_client(site_name)


def build_inventory_service() -> "InventoryService":
    """Create a new InventoryService instance."""
    from services.inventory.inventory import InventoryService

    return InventoryService()


def build_device_query_service() -> "DeviceQueryService":
    """Create a new DeviceQueryService instance."""
    from services.nautobot.devices.query import DeviceQueryService

    return DeviceQueryService()


def build_checkmk_service() -> "CheckMKService":
    """Create a new CheckMKService instance."""
    from services.checkmk.client import CheckMKService

    return CheckMKService()


def build_checkmk_host_service() -> "CheckMKHostService":
    """Create a new CheckMKHostService instance."""
    from services.checkmk.host_service import CheckMKHostService

    return CheckMKHostService()


def build_nautobot_metadata_service() -> "NautobotMetadataService":
    """Create a NautobotMetadataService using the module-level nautobot_service singleton."""
    from services.nautobot.metadata_service import NautobotMetadataService
    from services.nautobot.client import nautobot_service

    return NautobotMetadataService(nautobot_service)


def build_offboarding_service() -> "OffboardingService":
    """Create a new OffboardingService instance."""
    from services.nautobot.offboarding.service import OffboardingService

    return OffboardingService()
