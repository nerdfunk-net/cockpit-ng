"""CheckMK integration routers."""

from fastapi import APIRouter

from .connection import router as _connection_router
from .hosts import router as _hosts_router
from .monitoring import router as _monitoring_router
from .discovery import router as _discovery_router
from .problems import router as _problems_router
from .activation import router as _activation_router
from .folders import router as _folders_router
from .host_groups import router as _host_groups_router
from .tag_groups import router as _tag_groups_router
from .sync import router as nb2cmk_router

checkmk_router = APIRouter(prefix="/api/checkmk", tags=["checkmk"])
for _sub in [
    _connection_router,
    _hosts_router,
    _monitoring_router,
    _discovery_router,
    _problems_router,
    _activation_router,
    _folders_router,
    _host_groups_router,
    _tag_groups_router,
]:
    checkmk_router.include_router(_sub)

__all__ = ["checkmk_router", "nb2cmk_router"]
