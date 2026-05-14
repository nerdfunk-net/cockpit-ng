"""
Snapshot router modules.
"""

from .snapshots import router as snapshots_router
from .templates import router as templates_router

__all__ = ["templates_router", "snapshots_router"]
