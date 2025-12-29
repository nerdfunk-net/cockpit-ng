"""
CheckMK integration routers.

This package contains routers for:
- CheckMK host management
- Nautobot to CheckMK synchronization
- Host inventory operations
"""

from .main import router as checkmk_router
from .main import get_host, delete_host, _get_checkmk_client
from .sync import router as nb2cmk_router

__all__ = ["checkmk_router", "nb2cmk_router", "get_host", "delete_host", "_get_checkmk_client"]
