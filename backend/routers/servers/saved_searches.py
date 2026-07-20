"""
Saved server search router — create, read, update, delete for saved search
configurations, plus group management (list groups, rename group).

All business logic is delegated to SavedSearchService via FastAPI Depends().
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from core.safe_http_errors import raise_internal_server_error
from dependencies import get_saved_search_service
from models.saved_server_search import (
    CreateSavedSearchRequest,
    ListSavedSearchesResponse,
    RenameSavedSearchGroupRequest,
    RenameSavedSearchGroupResponse,
    SavedSearchDeleteResponse,
    SavedSearchGroupsResponse,
    SavedSearchResponse,
    UpdateSavedSearchRequest,
)
from services.servers.saved_search_service import SavedSearchService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/servers/saved-searches", tags=["server-searches"])


@router.post(
    "", response_model=SavedSearchResponse, status_code=status.HTTP_201_CREATED
)
async def create_saved_search(
    request: CreateSavedSearchRequest,
    current_user: dict = Depends(require_permission("server_clients.search", "write")),
    service: SavedSearchService = Depends(get_saved_search_service),
) -> SavedSearchResponse:
    """Create a new saved server search.

    Requires server_clients.search:write permission.
    """
    try:
        username = current_user.get("username")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username not found in token",
            )

        search_data = {
            "name": request.name,
            "description": request.description,
            "query": request.query.model_dump(by_alias=True),
            "scope": request.scope,
            "group_path": request.group_path or None,
            "created_by": username,
        }

        search_id = service.create_search(search_data)
        if not search_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create saved search",
            )

        search = service.get_search(search_id)
        if not search:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Saved search created but could not be retrieved",
            )

        return SavedSearchResponse(**search)

    except ValueError as e:
        logger.warning("Invalid saved-search operation: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid saved-search parameters",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(logger, "Failed to create saved search: ", e)


@router.get("", response_model=ListSavedSearchesResponse)
async def list_saved_searches(
    scope: Optional[str] = None,
    active_only: bool = True,
    group_path: Optional[str] = None,
    current_user: dict = Depends(require_permission("server_clients.search", "read")),
    service: SavedSearchService = Depends(get_saved_search_service),
) -> ListSavedSearchesResponse:
    """List all saved searches accessible to the current user.

    Requires server_clients.search:read permission.
    """
    try:
        username = current_user.get("username")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username not found in token",
            )

        searches = service.list_searches(
            username=username,
            active_only=active_only,
            scope=scope,
            group_path_filter=group_path or None,
        )

        return ListSavedSearchesResponse(
            searches=[SavedSearchResponse(**s) for s in searches],
            total=len(searches),
        )

    except Exception as e:
        raise_internal_server_error(logger, "Failed to list saved searches: ", e)


@router.get("/get-all-groups", response_model=SavedSearchGroupsResponse)
async def get_all_groups(
    current_user: dict = Depends(require_permission("server_clients.search", "read")),
    service: SavedSearchService = Depends(get_saved_search_service),
) -> SavedSearchGroupsResponse:
    """Return all unique saved-search group paths accessible to the user."""
    try:
        username = current_user.get("username")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username not found in token",
            )
        groups = service.get_all_groups(username)
        return SavedSearchGroupsResponse(groups=groups)

    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(logger, "Failed to fetch saved-search groups: ", e)


@router.post("/rename-group", response_model=RenameSavedSearchGroupResponse)
async def rename_group(
    request: RenameSavedSearchGroupRequest,
    current_user: dict = Depends(require_permission("server_clients.search", "write")),
    service: SavedSearchService = Depends(get_saved_search_service),
) -> RenameSavedSearchGroupResponse:
    """Bulk-rename a group path across all matching saved searches.

    Requires server_clients.search:write permission.
    """
    try:
        username = current_user.get("username")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username not found in token",
            )
        result = service.rename_group(
            old_path=request.old_path,
            new_name=request.new_name,
            username=username,
        )
        return RenameSavedSearchGroupResponse(
            updated_count=result["updated_count"],
            new_path=result["new_path"],
        )
    except ValueError as e:
        logger.warning("Invalid saved-search group rename request: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid group rename parameters",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(logger, "Failed to rename group: ", e)


@router.get("/{search_id}", response_model=SavedSearchResponse)
async def get_saved_search(
    search_id: int,
    current_user: dict = Depends(require_permission("server_clients.search", "read")),
    service: SavedSearchService = Depends(get_saved_search_service),
) -> SavedSearchResponse:
    """Get a specific saved search by ID.

    Requires server_clients.search:read permission.
    """
    try:
        username = current_user.get("username")

        search = service.get_search(search_id, username=username)
        if not search:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Saved search with ID {search_id} not found",
            )

        return SavedSearchResponse(**search)

    except PermissionError as e:
        logger.warning("Permission denied on saved-search operation: %s", e)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission denied",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(logger, "Failed to get saved search: ", e)


@router.put("/{search_id}", response_model=SavedSearchResponse)
async def update_saved_search(
    search_id: int,
    request: UpdateSavedSearchRequest,
    current_user: dict = Depends(require_permission("server_clients.search", "write")),
    service: SavedSearchService = Depends(get_saved_search_service),
) -> SavedSearchResponse:
    """Update an existing saved search.

    Only the owner of a private search can update it.

    Requires server_clients.search:write permission.
    """
    try:
        username = current_user.get("username")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username not found in token",
            )

        update_data = {}
        if request.name is not None:
            update_data["name"] = request.name
        if request.description is not None:
            update_data["description"] = request.description
        if request.query is not None:
            update_data["query"] = request.query.model_dump(by_alias=True)
        if request.scope is not None:
            update_data["scope"] = request.scope
        # group_path uses model_fields_set so null (move-to-root) is handled correctly
        if "group_path" in request.model_fields_set:
            update_data["group_path"] = request.group_path or None

        service.update_search(search_id, update_data, username)

        search = service.get_search(search_id)
        if not search:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Saved search with ID {search_id} not found after update",
            )

        return SavedSearchResponse(**search)

    except ValueError as e:
        logger.warning("Invalid saved-search operation: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid saved-search parameters",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(logger, "Failed to update saved search: ", e)


@router.delete("/{search_id}", response_model=SavedSearchDeleteResponse)
async def delete_saved_search(
    search_id: int,
    hard_delete: bool = True,
    current_user: dict = Depends(require_permission("server_clients.search", "delete")),
    service: SavedSearchService = Depends(get_saved_search_service),
) -> SavedSearchDeleteResponse:
    """Delete a saved search (hard delete by default).

    Only the owner of a private search can delete it.

    Requires server_clients.search:delete permission.
    """
    try:
        username = current_user.get("username")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username not found in token",
            )

        service.delete_search(search_id, username, hard_delete)

        return SavedSearchDeleteResponse(
            success=True,
            message=f"Saved search {'deleted' if hard_delete else 'deactivated'} successfully",
        )

    except ValueError as e:
        logger.warning("Invalid saved-search operation: %s", e)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid saved-search parameters",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(logger, "Failed to delete saved search: ", e)
