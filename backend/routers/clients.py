"""
Router for querying collected client data.

Endpoints:
  GET /api/clients/devices  — list of distinct device names
  GET /api/clients/data     — paginated correlated client data table
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query

from core.auth import require_permission
from repositories.client_data_repository import ClientDataRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/clients", tags=["clients"])
_repo = ClientDataRepository()


@router.get("/devices")
async def get_client_devices(
    _: dict = Depends(require_permission("network.clients", "read")),
) -> dict:
    """Return a sorted list of distinct device names from collected ARP data."""
    devices = _repo.get_device_names()
    return {"devices": devices}


@router.get("/data")
async def get_client_data(
    device_name: Optional[str] = Query(None, description="Filter by device name"),
    ip_address: Optional[str] = Query(None, description="Filter IP address (partial)"),
    mac_address: Optional[str] = Query(
        None, description="Filter MAC address (partial)"
    ),
    port: Optional[str] = Query(None, description="Filter port (partial)"),
    vlan: Optional[str] = Query(None, description="Filter VLAN (partial)"),
    hostname: Optional[str] = Query(None, description="Filter hostname (partial)"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=500, description="Rows per page"),
    _: dict = Depends(require_permission("network.clients", "read")),
) -> dict:
    """Return paginated correlated client data (ARP + MAC table + hostname)."""
    items, total = _repo.get_client_data(
        device_name=device_name,
        ip_address=ip_address,
        mac_address=mac_address,
        port=port,
        vlan=vlan,
        hostname=hostname,
        page=page,
        page_size=page_size,
    )
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/history")
async def get_client_history(
    ip_address: Optional[str] = Query(None, description="IP address to look up"),
    mac_address: Optional[str] = Query(None, description="MAC address to look up"),
    hostname: Optional[str] = Query(None, description="Hostname to look up"),
    _: dict = Depends(require_permission("network.clients", "read")),
) -> dict:
    """Return full cross-session history for an IP address, MAC address, or hostname.

    At least one of the three parameters must be provided.  Each is queried
    independently so the three result arrays reflect the raw source tables.
    """
    if not any([ip_address, mac_address, hostname]):
        return {"ip_history": [], "mac_history": [], "hostname_history": []}
    return _repo.get_client_history(
        ip_address=ip_address,
        mac_address=mac_address,
        hostname=hostname,
    )
