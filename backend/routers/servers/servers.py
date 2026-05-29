"""
Router for server management.

Endpoints:
  GET    /api/servers           – list all servers (optional ?group_by=<field>)
  GET    /api/servers/{id}      – single server
  POST   /api/servers           – create server
  PUT    /api/servers/{id}      – update server
  DELETE /api/servers/{id}      – delete server
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from core.auth import require_permission
from core.safe_http_errors import raise_internal_server_error
from dependencies import get_servers_service
from models.servers import (
    CreateServerRequest,
    ListServersResponse,
    ServerResponse,
    UpdateServerRequest,
)
from services.servers.servers_service import ServersService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/servers", tags=["servers"])

_ALLOWED_GROUP_BY = frozenset(
    {"location", "distribution_release", "distribution_version", "contact"}
)


@router.get("", response_model=ListServersResponse)
async def list_servers(
    group_by: Optional[str] = Query(
        None, description="Group servers by field (location, distribution_release, …)"
    ),
    _: dict = Depends(require_permission("servers", "read")),
    service: ServersService = Depends(get_servers_service),
) -> ListServersResponse:
    """Return all servers, optionally grouped by a field value."""
    try:
        servers = service.get_all()
        return ListServersResponse(
            servers=[ServerResponse.model_validate(s) for s in servers],
            total=len(servers),
        )
    except Exception as exc:
        raise_internal_server_error(logger, "Failed to list servers", exc)


@router.get("/{server_id}", response_model=ServerResponse)
async def get_server(
    server_id: int,
    _: dict = Depends(require_permission("servers", "read")),
    service: ServersService = Depends(get_servers_service),
) -> ServerResponse:
    """Return a single server by ID."""
    try:
        server = service.get_by_id(server_id)
        if server is None:
            raise HTTPException(status_code=404, detail="Server not found")
        return ServerResponse.model_validate(server)
    except HTTPException:
        raise
    except Exception as exc:
        raise_internal_server_error(logger, "Failed to get server", exc)


@router.post("", response_model=ServerResponse, status_code=201)
async def create_server(
    request: CreateServerRequest,
    _: dict = Depends(require_permission("servers", "write")),
    service: ServersService = Depends(get_servers_service),
) -> ServerResponse:
    """Create a new server record."""
    try:
        server = service.create(**request.model_dump())
        return ServerResponse.model_validate(server)
    except Exception as exc:
        raise_internal_server_error(logger, "Failed to create server", exc)


@router.put("/{server_id}", response_model=ServerResponse)
async def update_server(
    server_id: int,
    request: UpdateServerRequest,
    _: dict = Depends(require_permission("servers", "write")),
    service: ServersService = Depends(get_servers_service),
) -> ServerResponse:
    """Update an existing server record."""
    try:
        updates = {k: v for k, v in request.model_dump().items() if v is not None}
        server = service.update(server_id, **updates)
        if server is None:
            raise HTTPException(status_code=404, detail="Server not found")
        return ServerResponse.model_validate(server)
    except HTTPException:
        raise
    except Exception as exc:
        raise_internal_server_error(logger, "Failed to update server", exc)


@router.delete("/{server_id}", status_code=204)
async def delete_server(
    server_id: int,
    _: dict = Depends(require_permission("servers", "delete")),
    service: ServersService = Depends(get_servers_service),
) -> None:
    """Delete a server record."""
    try:
        deleted = service.delete(server_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Server not found")
    except HTTPException:
        raise
    except Exception as exc:
        raise_internal_server_error(logger, "Failed to delete server", exc)
