"""
Inventory management routers.

This package contains routers for:
- Device inventory builder with logical operations
- Inventory CRUD operations
"""

from .inventory import router as general_inventory_router
from .main import router as inventory_router

__all__ = [
    "general_inventory_router",
    "inventory_router",
]
