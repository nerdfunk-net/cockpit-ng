"""
Tools routers package.

This package contains routers for developer/administrative tools:
- Schema management and database migrations
- RBAC seeding
- Test baseline creation
- CA certificate management
"""

from .schema import router as tools_router
from .certificates import router as certificates_router

__all__ = [
    "tools_router",
    "certificates_router",
]
