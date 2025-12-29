"""
Inventory management routers.

This package contains routers for:
- Inventory CRUD operations
- SSL certificate management
"""

from .main import router as inventory_router
from .certificates import router as certificates_router

__all__ = ["inventory_router", "certificates_router"]
