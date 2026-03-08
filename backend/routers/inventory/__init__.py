"""
Inventory management routers.

This package contains routers for:
- ops.py   — Device inventory builder (preview, field options, resolve, analyze)
- crud.py  — Inventory CRUD operations (create, read, update, delete)

Registration order in main.py matters: ops_router must be registered before
crud_router so that path parameters in CRUD (/{inventory_id}) do not capture
static segments like /preview, /field-options, /custom-fields, etc.
"""

from .ops import router as inventory_ops_router
from .crud import router as inventory_crud_router

__all__ = [
    "inventory_ops_router",
    "inventory_crud_router",
]
