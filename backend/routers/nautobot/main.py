"""
Nautobot router for device management and API interactions.

This router aggregates all Nautobot-related endpoints by including specialized sub-routers.
Each sub-router handles a specific domain:
- devices: Core device management and operations
- locations: Location hierarchy (locations, location-types, parent-locations)
- taxonomy: Device taxonomy (platforms, device-types, manufacturers, roles)
- statuses: Status lookups by content type
- tags: Tag and custom field lookups
- ipam: IPAM metadata (namespaces, VLANs, software versions/image files)
- infrastructure: Racks, rack groups, interface types, secret groups
- device_ops: Device details, delete, offboard
- utils: Stats, health-check, job results
- ipam_prefixes: IPAM prefix CRUD operations
- ipam_addresses: IPAM IP address CRUD operations
- ipam_ip_address_to_interface: IP address to interface assignments
- dcim_interfaces: DCIM interface CRUD operations
- clusters: Virtualization cluster management
"""

from fastapi import APIRouter

# Import sub-routers from new feature-based structure
from .devices import router as devices_router
from .locations import router as locations_router
from .taxonomy import router as taxonomy_router
from .statuses import router as statuses_router
from .tags import router as tags_router
from .ipam import router as ipam_metadata_router
from .infrastructure import router as infrastructure_router
from .device_ops import router as device_ops_router
from .utils import router as nautobot_utils_router
from .prefixes import router as ipam_prefixes_router
from .ip_addresses import router as ipam_addresses_router
from .ip_interface_mapping import router as ipam_ip_address_to_interface_router
from .interfaces import router as dcim_interfaces_router
from .clusters import router as clusters_router
from .virtual_chassis import router as virtual_chassis_router
from .rack_reservations import router as rack_reservations_router
from .rack_mappings import router as rack_mappings_router
from .stacks import router as stacks_router

# Create main Nautobot router
router = APIRouter(prefix="/api/nautobot")

# Include all sub-routers
# stacks_router must come before devices_router to prevent /devices/{device_id}
# wildcard from capturing the static /devices/stacks path
router.include_router(stacks_router)
router.include_router(devices_router)
router.include_router(locations_router)
router.include_router(taxonomy_router)
router.include_router(statuses_router)
router.include_router(tags_router)
router.include_router(ipam_metadata_router)
router.include_router(infrastructure_router)
router.include_router(device_ops_router)
router.include_router(nautobot_utils_router)
router.include_router(ipam_prefixes_router)
router.include_router(ipam_addresses_router)
router.include_router(ipam_ip_address_to_interface_router)
router.include_router(dcim_interfaces_router)
router.include_router(clusters_router)
router.include_router(virtual_chassis_router)
router.include_router(rack_reservations_router)
router.include_router(rack_mappings_router)
