"""
Network configuration management routers.

This package contains routers for:
- Configuration backup
- Configuration comparison
- Configuration viewing
"""

from .compare import router

__all__ = ["router"]
