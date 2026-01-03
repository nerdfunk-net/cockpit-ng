"""
Network automation and management routers.

This package contains routers for:
- Configuration management (backup, compare, view)
- Network automation (Netmiko, templates)
- Compliance checking
- Network utilities (ping, etc.)
"""

# Import config routers
from .configs.compare import router as file_compare_router

# Import automation routers
from .automation.netmiko import router as netmiko_router

# Import compliance router (temporarily disabled - requires pysnmp)
# from .compliance import router as compliance_check_router

# Import tools router (temporarily disabled - depends on nautobot_service)
# from .tools.ping import router as tools_router

# Export all routers
__all__ = [
    "file_compare_router",
    "netmiko_router",
    # "tools_router",  # Temporarily disabled - depends on nautobot_service
    # "compliance_check_router",  # Temporarily disabled - requires pysnmp dependency
]
