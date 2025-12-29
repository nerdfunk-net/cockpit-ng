"""
Network automation routers.

This package contains routers for:
- Ansible inventory generation
- Netmiko device connections
- Configuration templates
"""

from .ansible_inventory import router as ansible_inventory_router
from .netmiko import router as netmiko_router

__all__ = ["ansible_inventory_router", "netmiko_router"]
