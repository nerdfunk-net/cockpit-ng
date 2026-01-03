"""
Network automation routers.

This package contains routers for:
- Netmiko device connections
- Configuration templates
"""

from .netmiko import router as netmiko_router

__all__ = ["netmiko_router"]
