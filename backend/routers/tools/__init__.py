"""
Tools routers package.

This package contains routers for developer/administrative tools:
- Schema management and database migrations
- RBAC seeding
- Test baseline creation
- CA certificate management
"""

from .certificates import router as certificates_router
from .schema import router as tools_router

__all__ = [
    "tools_router",
    "certificates_router",
]
