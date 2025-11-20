"""
Nautobot router submodules.
"""

from .devices import router as devices_router
from .metadata import router as metadata_router
from .ipam_prefixes import router as ipam_prefixes_router
from .ipam_addresses import router as ipam_addresses_router
from .ipam_ip_address_to_interface import router as ipam_ip_address_to_interface_router
from .dcim_interfaces import router as dcim_interfaces_router

__all__ = [
    "devices_router",
    "metadata_router",
    "ipam_prefixes_router",
    "ipam_addresses_router",
    "ipam_ip_address_to_interface_router",
    "dcim_interfaces_router",
]
