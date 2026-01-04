"""
Snapshot router modules.
"""

from .templates import router as templates_router
from .snapshots import router as snapshots_router

__all__ = ["templates_router", "snapshots_router"]
