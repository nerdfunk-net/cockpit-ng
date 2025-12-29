"""
CheckMK integration routers.

This package contains routers for:
- CheckMK host management
- Nautobot to CheckMK synchronization
- Host inventory operations
"""

from .main import router as checkmk_router
from .sync import router as nb2cmk_router

__all__ = ["checkmk_router", "nb2cmk_router"]
