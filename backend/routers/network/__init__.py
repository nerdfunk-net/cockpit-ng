"""
Network automation and management routers.

This package contains routers for:
- Configuration comparison (minimal - only compare endpoint for Config View)
- Network automation (Netmiko, templates)
- Compliance checking
"""

# Import config routers
# Import automation routers
from .automation.netmiko import router as netmiko_router

# Import compliance router
from .compliance import router as compliance_check_router
from .configs.backup import router as backup_router
from .configs.compare import router as file_compare_router

# Export all routers
__all__ = [
    "file_compare_router",
    "backup_router",
    "netmiko_router",
    "compliance_check_router",
]
