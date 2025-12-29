"""
Network compliance routers.

This package contains routers for:
- Compliance rules management
- Compliance check execution
"""

from .checks import router

__all__ = ["router"]
