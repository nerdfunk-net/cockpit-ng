"""
Network configuration management routers.

This package contains routers for:
- Configuration backup
- Configuration comparison
- Configuration viewing
"""

from fastapi import APIRouter

from .backup import router as backup_router
from .compare import router as compare_router

# Combine routers
router = APIRouter()
router.include_router(compare_router)
router.include_router(backup_router)

__all__ = ["router"]
