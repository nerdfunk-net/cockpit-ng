"""
Network automation and management routers.

This package contains routers for:
- Configuration comparison (minimal - only compare endpoint for Config View)
- Network automation (Netmiko, templates)
- Compliance checking
- Network utilities (ping, etc.)
"""

# Import config routers
from .configs.compare import router as file_compare_router
from .configs.backup import router as backup_router

# Import automation routers
from .automation.netmiko import router as netmiko_router

# Import compliance router
from .compliance import router as compliance_check_router

# Import tools router (temporarily disabled - depends on nautobot_service)
# from .tools.ping import router as tools_router

# Export all routers
__all__ = [
    "file_compare_router",
    "backup_router",
    "netmiko_router",
    "compliance_check_router",
    # "tools_router",  # Temporarily disabled - depends on nautobot_service
]
