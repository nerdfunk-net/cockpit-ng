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
    from services.inventory.persistence_service import InventoryPersistenceService
    from services.nautobot.devices.query import DeviceQueryService
    from services.checkmk.client import CheckMKConnectionService, CheckMKService
    from services.checkmk.host_service import CheckMKHostService
    from services.checkmk.monitoring_service import CheckMKMonitoringService
    from services.checkmk.discovery_service import CheckMKDiscoveryService
    from services.checkmk.problems_service import CheckMKProblemsService
    from services.checkmk.activation_service import CheckMKActivationService
    from services.checkmk.folder import CheckMKFolderService
    from services.checkmk.host_group_service import CheckMKHostGroupService
    from services.checkmk.tag_group_service import CheckMKTagGroupService
    from services.checkmk.base import CheckMKConfig


def get_nautobot_service(request: Request) -> "NautobotService":
    """Provide the app-scoped NautobotService from app.state."""
    return request.app.state.nautobot_service


def get_inventory_persistence_service() -> "InventoryPersistenceService":
    """Provide a new InventoryPersistenceService instance (PostgreSQL CRUD)."""
    return service_factory.build_inventory_persistence_service()


def get_inventory_service() -> "InventoryService":
    """Provide a new InventoryService instance (Nautobot query facade)."""
    return service_factory.build_inventory_service()


def get_device_query_service() -> "DeviceQueryService":
    """Provide a new DeviceQueryService instance."""
    return service_factory.build_device_query_service()


def get_checkmk_config() -> "CheckMKConfig":
    """Provide a validated CheckMKConfig from database settings."""
    from services.checkmk.base import get_checkmk_config as _get_config

    return _get_config()


def get_checkmk_service() -> "CheckMKConnectionService":
    """Provide a new CheckMKConnectionService instance."""
    return service_factory.build_checkmk_service()


def get_checkmk_host_service() -> "CheckMKHostService":
    """Provide a new CheckMKHostService instance."""
    return service_factory.build_checkmk_host_service()


def get_checkmk_monitoring_service() -> "CheckMKMonitoringService":
    """Provide a new CheckMKMonitoringService instance."""
    return service_factory.build_checkmk_monitoring_service()


def get_checkmk_discovery_service() -> "CheckMKDiscoveryService":
    """Provide a new CheckMKDiscoveryService instance."""
    return service_factory.build_checkmk_discovery_service()


def get_checkmk_problems_service() -> "CheckMKProblemsService":
    """Provide a new CheckMKProblemsService instance."""
    return service_factory.build_checkmk_problems_service()


def get_checkmk_activation_service() -> "CheckMKActivationService":
    """Provide a new CheckMKActivationService instance."""
    return service_factory.build_checkmk_activation_service()


def get_checkmk_folder_service() -> "CheckMKFolderService":
    """Provide a new CheckMKFolderService instance."""
    return service_factory.build_checkmk_folder_service()


def get_checkmk_host_group_service() -> "CheckMKHostGroupService":
    """Provide a new CheckMKHostGroupService instance."""
    return service_factory.build_checkmk_host_group_service()


def get_checkmk_tag_group_service() -> "CheckMKTagGroupService":
    """Provide a new CheckMKTagGroupService instance."""
    return service_factory.build_checkmk_tag_group_service()


def get_nautobot_metadata_service() -> "NautobotMetadataService":
    """Provide a NautobotMetadataService instance."""
    return service_factory.build_nautobot_metadata_service()


def get_offboarding_service() -> "OffboardingService":
    """Provide a new OffboardingService instance."""
    return service_factory.build_offboarding_service()


def get_agent_template_render_service():
    """Provide a new AgentTemplateRenderService instance."""
    return service_factory.build_agent_template_render_service()


def get_agent_deployment_service():
    """Provide a new AgentDeploymentService instance."""
    return service_factory.build_agent_deployment_service()


# ---------------------------------------------------------------------------
# CheckMK
# ---------------------------------------------------------------------------


def get_checkmk_config_service():
    """Provide the CheckMK ConfigService."""
    return service_factory.build_checkmk_config_service()


def get_nb2cmk_service():
    """Provide the NautobotToCheckMKService."""
    return service_factory.build_nb2cmk_service()


def get_nb2cmk_db_service():
    """Provide the NB2CMKDatabaseService."""
    return service_factory.build_nb2cmk_db_service()


# ---------------------------------------------------------------------------
# Git
# ---------------------------------------------------------------------------


def get_git_service():
    """Provide the GitService."""
    return service_factory.build_git_service()


def get_git_auth_service():
    """Provide the GitAuthenticationService."""
    return service_factory.build_git_auth_service()


def get_git_cache_service():
    """Provide the GitCacheService."""
    return service_factory.build_git_cache_service()


def get_git_operations_service():
    """Provide the GitOperationsService."""
    return service_factory.build_git_operations_service()


def get_git_connection_service():
    """Provide the GitConnectionService."""
    return service_factory.build_git_connection_service()


def get_git_diff_service():
    """Provide the GitDiffService."""
    return service_factory.build_git_diff_service()


# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------


def get_cache_service(request: Request):
    """Provide the app-scoped RedisCacheService from app.state."""
    return request.app.state.cache_service


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


def get_oidc_service(request: Request):
    """Provide the app-scoped OIDCService from app.state."""
    return request.app.state.oidc_service


def get_nb2cmk_background_service(request: Request):
    """Provide the app-scoped NB2CMKBackgroundService from app.state."""
    return request.app.state.nb2cmk_background_service


# ---------------------------------------------------------------------------
# Network
# ---------------------------------------------------------------------------


def get_scan_service():
    """Provide the ScanService."""
    return service_factory.build_scan_service()


def get_netmiko_service():
    """Provide the NetmikoService."""
    return service_factory.build_netmiko_service()


def get_render_service():
    """Provide the RenderService."""
    return service_factory.build_render_service()


# ---------------------------------------------------------------------------
# Nautobot device services
# ---------------------------------------------------------------------------


def get_device_creation_service():
    """Provide the DeviceCreationService."""
    return service_factory.build_device_creation_service()
