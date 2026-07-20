"""
Router for server management.

Endpoints:
  GET    /api/servers                              – list all servers (optional ?group_by=<field>)
  POST   /api/servers/search                       – advanced nested boolean search
  GET    /api/servers/search/facets                – distinct values for search dropdowns
  GET    /api/servers/{id}                          – single server
  POST   /api/servers                               – create server
  PUT    /api/servers/{id}                          – update server
  DELETE /api/servers/{id}                          – delete server
  POST   /api/servers/{id}/refresh-facts            – re-gather Ansible facts for a server
  POST   /api/servers/{id}/refresh-open-ports       – re-scan open ports for a server
  GET    /api/servers/{id}/facts/history            – list Ansible facts history entries
  GET    /api/servers/{id}/facts/history/{hist_id}  – single Ansible facts history entry
  GET    /api/servers/{id}/open-ports/history       – list open-ports history entries
  GET    /api/servers/{id}/open-ports/history/{hist_id} – single open-ports history entry
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import ValidationError

from core.auth import require_permission
from core.db_errors import (
    duplicate_server_hostname_message,
    is_duplicate_server_hostname_error,
)
from core.safe_http_errors import raise_internal_server_error
from dependencies import get_server_ansible_ops_service, get_servers_service
from models.servers import (
    CreateServerRequest,
    ListServersResponse,
    ServerFactsHistoryDetail,
    ServerFactsHistoryEntry,
    ServerFactsHistoryListResponse,
    ServerOpenPortsHistoryDetail,
    ServerOpenPortsHistoryEntry,
    ServerOpenPortsHistoryListResponse,
    ServerResponse,
    ServerSearchFacetsResponse,
    ServerSearchHitResponse,
    ServerSearchRequest,
    ServerSearchResponse,
    ServerSummaryResponse,
    UpdateServerRequest,
)
from services.servers.ansible_ops import ServerAnsibleOperationsService
from services.servers.servers_service import _ALLOWED_GROUP_BY, ServersService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/servers", tags=["servers"])


@router.get("", response_model=ListServersResponse)
def list_servers(
    q: Optional[str] = Query(
        None,
        min_length=1,
        max_length=255,
        description="Filter hostnames (case-insensitive substring match)",
    ),
    group_by: Optional[str] = Query(
        None,
        description="Deprecated: grouping is handled client-side",
    ),
    _: dict = Depends(require_permission("servers", "read")),
    service: ServersService = Depends(get_servers_service),
) -> ListServersResponse:
    """Return server summaries for inventory lists (excludes ansible_facts)."""
    if group_by is not None and group_by not in _ALLOWED_GROUP_BY:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid group_by value. Allowed: {sorted(_ALLOWED_GROUP_BY)}",
        )
    try:
        search = q.strip() if q else None
        servers = service.list_summaries(search=search)
        total_all = service.count_all()
        return ListServersResponse(
            servers=[ServerSummaryResponse.model_validate(s) for s in servers],
            total=len(servers),
            total_all=total_all,
        )
    except Exception as exc:
        raise_internal_server_error(logger, "Failed to list servers", exc)


@router.post("/search", response_model=ServerSearchResponse)
def search_servers(
    request: ServerSearchRequest,
    _: dict = Depends(require_permission("servers", "read")),
    service: ServersService = Depends(get_servers_service),
) -> ServerSearchResponse:
    """Run a nested boolean search over server HW/OS columns."""
    try:
        servers = service.search(request.query)
        return ServerSearchResponse(
            servers=[ServerSearchHitResponse.model_validate(s) for s in servers],
            total=len(servers),
        )
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=exc.errors()) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise_internal_server_error(logger, "Failed to search servers", exc)


@router.get("/search/facets", response_model=ServerSearchFacetsResponse)
def get_server_search_facets(
    _: dict = Depends(require_permission("servers", "read")),
    service: ServersService = Depends(get_servers_service),
) -> ServerSearchFacetsResponse:
    """Return distinct OS/distribution values for search dropdowns."""
    try:
        facets = service.get_search_facets()
        return ServerSearchFacetsResponse(**facets)
    except Exception as exc:
        raise_internal_server_error(logger, "Failed to get server search facets", exc)


@router.get("/{server_id}", response_model=ServerResponse)
def get_server(
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
def create_server(
    request: CreateServerRequest,
    _: dict = Depends(require_permission("servers", "write")),
    service: ServersService = Depends(get_servers_service),
) -> ServerResponse:
    """Create a new server record."""
    try:
        server = service.create(request)
        return ServerResponse.model_validate(server)
    except Exception as exc:
        if is_duplicate_server_hostname_error(exc):
            logger.warning("Duplicate server hostname on create: %s", request.hostname)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=duplicate_server_hostname_message(request.hostname),
            ) from exc
        raise_internal_server_error(logger, "Failed to create server", exc)


@router.put("/{server_id}", response_model=ServerResponse)
def update_server(
    server_id: int,
    request: UpdateServerRequest,
    _: dict = Depends(require_permission("servers", "write")),
    service: ServersService = Depends(get_servers_service),
) -> ServerResponse:
    """Update an existing server record."""
    try:
        server = service.update(server_id, request)
        if server is None:
            raise HTTPException(status_code=404, detail="Server not found")
        return ServerResponse.model_validate(server)
    except HTTPException:
        raise
    except Exception as exc:
        if is_duplicate_server_hostname_error(exc):
            hostname = request.hostname or ""
            logger.warning(
                "Duplicate server hostname on update (id=%s): %s",
                server_id,
                hostname,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=duplicate_server_hostname_message(hostname),
            ) from exc
        raise_internal_server_error(logger, "Failed to update server", exc)


@router.post("/{server_id}/refresh-facts", response_model=ServerResponse)
def refresh_server_facts(
    server_id: int,
    user: dict = Depends(require_permission("servers", "write")),
    ops_service: ServerAnsibleOperationsService = Depends(
        get_server_ansible_ops_service
    ),
    service: ServersService = Depends(get_servers_service),
) -> ServerResponse:
    """Re-gather Ansible facts for a server using its stored connection settings."""
    try:
        if service.get_by_id(server_id) is None:
            raise HTTPException(status_code=404, detail="Server not found")
        result = ops_service.refresh_facts_for_server(
            server_id, sent_by=user.get("username", "system")
        )
        if not result.success:
            raise HTTPException(status_code=422, detail=result.error)
        return ServerResponse.model_validate(service.get_by_id(server_id))
    except HTTPException:
        raise
    except Exception as exc:
        raise_internal_server_error(logger, "Failed to refresh server facts", exc)


@router.post("/{server_id}/refresh-open-ports", response_model=ServerResponse)
def refresh_server_open_ports(
    server_id: int,
    user: dict = Depends(require_permission("servers", "write")),
    ops_service: ServerAnsibleOperationsService = Depends(
        get_server_ansible_ops_service
    ),
    service: ServersService = Depends(get_servers_service),
) -> ServerResponse:
    """Re-scan open TCP/UDP ports for a server using its stored connection settings."""
    try:
        if service.get_by_id(server_id) is None:
            raise HTTPException(status_code=404, detail="Server not found")
        result = ops_service.refresh_open_ports_for_server(
            server_id, sent_by=user.get("username", "system")
        )
        if not result.success:
            raise HTTPException(status_code=422, detail=result.error)
        return ServerResponse.model_validate(service.get_by_id(server_id))
    except HTTPException:
        raise
    except Exception as exc:
        raise_internal_server_error(logger, "Failed to refresh server open ports", exc)


@router.get("/{server_id}/facts/history", response_model=ServerFactsHistoryListResponse)
def get_server_facts_history(
    server_id: int,
    _: dict = Depends(require_permission("servers", "read")),
    service: ServersService = Depends(get_servers_service),
) -> ServerFactsHistoryListResponse:
    """Return the Ansible facts history for a server, newest first."""
    try:
        server = service.get_by_id(server_id)
        if server is None:
            raise HTTPException(status_code=404, detail="Server not found")
        entries = service.get_facts_history(server_id)
        return ServerFactsHistoryListResponse(
            entries=[ServerFactsHistoryEntry.model_validate(e) for e in entries]
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise_internal_server_error(logger, "Failed to get server facts history", exc)


@router.get(
    "/{server_id}/facts/history/{history_id}",
    response_model=ServerFactsHistoryDetail,
)
def get_server_facts_history_entry(
    server_id: int,
    history_id: int,
    _: dict = Depends(require_permission("servers", "read")),
    service: ServersService = Depends(get_servers_service),
) -> ServerFactsHistoryDetail:
    """Return a single historical Ansible facts snapshot."""
    try:
        entry = service.get_facts_history_entry(server_id, history_id)
        if entry is None:
            raise HTTPException(status_code=404, detail="History entry not found")
        return ServerFactsHistoryDetail.model_validate(entry)
    except HTTPException:
        raise
    except Exception as exc:
        raise_internal_server_error(
            logger, "Failed to get server facts history entry", exc
        )


@router.get(
    "/{server_id}/open-ports/history",
    response_model=ServerOpenPortsHistoryListResponse,
)
def get_server_open_ports_history(
    server_id: int,
    _: dict = Depends(require_permission("servers", "read")),
    service: ServersService = Depends(get_servers_service),
) -> ServerOpenPortsHistoryListResponse:
    """Return the open-ports history for a server, newest first."""
    try:
        server = service.get_by_id(server_id)
        if server is None:
            raise HTTPException(status_code=404, detail="Server not found")
        entries = service.get_open_ports_history(server_id)
        return ServerOpenPortsHistoryListResponse(
            entries=[ServerOpenPortsHistoryEntry.model_validate(e) for e in entries]
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise_internal_server_error(
            logger, "Failed to get server open ports history", exc
        )


@router.get(
    "/{server_id}/open-ports/history/{history_id}",
    response_model=ServerOpenPortsHistoryDetail,
)
def get_server_open_ports_history_entry(
    server_id: int,
    history_id: int,
    _: dict = Depends(require_permission("servers", "read")),
    service: ServersService = Depends(get_servers_service),
) -> ServerOpenPortsHistoryDetail:
    """Return a single historical open-ports snapshot."""
    try:
        entry = service.get_open_ports_history_entry(server_id, history_id)
        if entry is None:
            raise HTTPException(status_code=404, detail="History entry not found")
        return ServerOpenPortsHistoryDetail.model_validate(entry)
    except HTTPException:
        raise
    except Exception as exc:
        raise_internal_server_error(
            logger, "Failed to get server open ports history entry", exc
        )


@router.delete("/{server_id}", status_code=204)
def delete_server(
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
