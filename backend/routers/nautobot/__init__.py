"""
Nautobot integration routers.

This package contains routers for:
- Device management (CRUD operations)
- Interface management
- IP address and prefix management
- Metadata operations
- Export and sync functionality
- Network scanning and bulk operations
- Virtualization cluster management
"""

from .main import router as nautobot_router
from .devices import router as devices_router
from .interfaces import router as interfaces_router
from .ip_addresses import router as ip_addresses_router
from .prefixes import router as prefixes_router
from .ip_interface_mapping import router as ip_interface_mapping_router
from .metadata import router as metadata_router
from .tools.scan_and_add import router as scan_and_add_router
from .clusters import router as clusters_router

__all__ = [
    "nautobot_router",
    "devices_router",
    "interfaces_router",
    "ip_addresses_router",
    "prefixes_router",
    "ip_interface_mapping_router",
    "metadata_router",
    "scan_and_add_router",
    "clusters_router",
]
