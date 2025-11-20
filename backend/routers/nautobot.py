"""
Nautobot router for device management and API interactions.

This router aggregates all Nautobot-related endpoints by including specialized sub-routers.
Each sub-router handles a specific domain:
- devices: Core device management and operations
- metadata: Lookup data (locations, roles, platforms, tags, etc.)
- ipam_prefixes: IPAM prefix CRUD operations
- ipam_addresses: IPAM IP address CRUD operations
- ipam_ip_address_to_interface: IP address to interface assignments
- dcim_interfaces: DCIM interface CRUD operations
"""

from fastapi import APIRouter

# Import sub-routers
from routers.nautobot_endpoints import (
    devices_router,
    metadata_router,
    ipam_prefixes_router,
    ipam_addresses_router,
    ipam_ip_address_to_interface_router,
    dcim_interfaces_router,
)

# Create main Nautobot router
router = APIRouter(prefix="/api/nautobot")

# Include all sub-routers
router.include_router(devices_router)
router.include_router(metadata_router)
router.include_router(ipam_prefixes_router)
router.include_router(ipam_addresses_router)
router.include_router(ipam_ip_address_to_interface_router)
router.include_router(dcim_interfaces_router)
