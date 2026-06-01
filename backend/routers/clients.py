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
from core.safe_http_errors import raise_internal_server_error
from dependencies import get_client_data_service
from models.client_data import (
    ClientDataPageResponse,
    ClientDataTableRow,
    ClientDevicesApiResponse,
    ClientHistoryApiResponse,
    ClientHostnameHistoryRow,
    ClientIpHistoryRow,
    ClientMacHistoryRow,
)
from services.clients.client_data_service import ClientDataService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/clients", tags=["clients"])


@router.get("/devices", response_model=ClientDevicesApiResponse)
async def get_client_devices(
    _: dict = Depends(require_permission("network.clients", "read")),
    client_data: ClientDataService = Depends(get_client_data_service),
) -> ClientDevicesApiResponse:
    """Return a sorted list of distinct device names from collected ARP data."""
    try:
        devices = client_data.get_device_names()
        return ClientDevicesApiResponse(devices=devices)
    except Exception as exc:
        raise_internal_server_error(logger, "Failed to list client devices", exc)


@router.get("/data", response_model=ClientDataPageResponse)
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
    client_data: ClientDataService = Depends(get_client_data_service),
) -> ClientDataPageResponse:
    """Return paginated correlated client data (ARP + MAC table + hostname)."""
    try:
        items, total = client_data.get_client_data(
            device_name=device_name,
            ip_address=ip_address,
            mac_address=mac_address,
            port=port,
            vlan=vlan,
            hostname=hostname,
            page=page,
            page_size=page_size,
        )
        return ClientDataPageResponse(
            items=[ClientDataTableRow.model_validate(row) for row in items],
            total=total,
            page=page,
            page_size=page_size,
        )
    except Exception as exc:
        raise_internal_server_error(logger, "Failed to get client data", exc)


@router.get("/history", response_model=ClientHistoryApiResponse)
async def get_client_history(
    ip_address: Optional[str] = Query(None, description="IP address to look up"),
    mac_address: Optional[str] = Query(None, description="MAC address to look up"),
    hostname: Optional[str] = Query(None, description="Hostname to look up"),
    _: dict = Depends(require_permission("network.clients", "read")),
    client_data: ClientDataService = Depends(get_client_data_service),
) -> ClientHistoryApiResponse:
    """Return full cross-session history for an IP address, MAC address, or hostname.

    At least one of the three parameters must be provided.  Each is queried
    independently so the three result arrays reflect the raw source tables.
    """
    if not any([ip_address, mac_address, hostname]):
        return ClientHistoryApiResponse()
    try:
        raw = client_data.get_client_history(
            ip_address=ip_address,
            mac_address=mac_address,
            hostname=hostname,
        )
        return ClientHistoryApiResponse(
            ip_history=[
                ClientIpHistoryRow.model_validate(r) for r in raw["ip_history"]
            ],
            mac_history=[
                ClientMacHistoryRow.model_validate(r) for r in raw["mac_history"]
            ],
            hostname_history=[
                ClientHostnameHistoryRow.model_validate(r)
                for r in raw["hostname_history"]
            ],
        )
    except Exception as exc:
        raise_internal_server_error(logger, "Failed to get client history", exc)
