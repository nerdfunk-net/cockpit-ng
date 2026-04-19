"""
Nautobot integration routers.

This package contains routers for:
- Device management (CRUD operations)
- Interface management
- IP address and prefix management
- Location hierarchy
- Device taxonomy (platforms, device-types, manufacturers, roles)
- Statuses and tags
- IPAM metadata (namespaces, VLANs, software versions)
- Infrastructure (racks, rack groups, interface types)
- Device operations (details, delete, offboard)
- Utility endpoints (stats, health-check)
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
from .locations import router as locations_router
from .taxonomy import router as taxonomy_router
from .statuses import router as statuses_router
from .tags import router as tags_router
from .ipam import router as ipam_metadata_router
from .infrastructure import router as infrastructure_router
from .device_ops import router as device_ops_router
from .utils import router as nautobot_utils_router
from .tools.scan_and_add import router as scan_and_add_router
from .clusters import router as clusters_router

__all__ = [
    "nautobot_router",
    "devices_router",
    "interfaces_router",
    "ip_addresses_router",
    "prefixes_router",
    "ip_interface_mapping_router",
    "locations_router",
    "taxonomy_router",
    "statuses_router",
    "tags_router",
    "ipam_metadata_router",
    "infrastructure_router",
    "device_ops_router",
    "nautobot_utils_router",
    "scan_and_add_router",
    "clusters_router",
]
