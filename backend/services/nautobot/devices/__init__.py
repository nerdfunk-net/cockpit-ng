"""
Nautobot device operation services.

This package contains services for:
- Device creation and onboarding
- Device update operations
- Device querying and search
- Device import operations
- Common device utilities
- Interface management
- Type definitions
"""

from services.nautobot.devices.common import DeviceCommonService
from services.nautobot.devices.update import DeviceUpdateService
from services.nautobot.devices.interface_manager import InterfaceManagerService
from services.nautobot.devices.query import device_query_service, DEVICE_DETAILS_QUERY
from services.nautobot.devices.types import (
    DeviceIdentifier,
    InterfaceConfig,
    InterfaceSpec,
    DeviceUpdateResult,
    InterfaceUpdateResult,
)

__all__ = [
    "DeviceCommonService",
    "DeviceUpdateService",
    "InterfaceManagerService",
    "device_query_service",
    "DEVICE_DETAILS_QUERY",
    "DeviceIdentifier",
    "InterfaceConfig",
    "InterfaceSpec",
    "DeviceUpdateResult",
    "InterfaceUpdateResult",
]
