"""
Inventory router for managing Ansible inventory configurations.

This router provides CRUD endpoints for storing and retrieving inventory
configurations in the PostgreSQL database.
"""

from __future__ import annotations
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from core.auth import require_permission
from inventory_manager import inventory_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/inventory", tags=["inventory"])


# ============================================================================
# Pydantic Models
# ============================================================================


class SavedInventoryCondition(BaseModel):
    """Saved inventory condition from the UI."""

    field: str = Field(..., description="Device field to filter on")
    operator: str = Field(..., description="Logical operator")
    value: str = Field(..., description="Value to filter by")
    logic: str = Field(..., description="Logic operator (AND, OR, NOT)")


class CreateInventoryRequest(BaseModel):
    """Request for creating a new inventory."""

    name: str = Field(..., description="Inventory name")
    description: Optional[str] = Field(None, description="Inventory description")
    conditions: List[dict] = Field(
        ..., description="List of logical conditions or tree structure"
    )
    template_category: Optional[str] = Field(
        None, description="Template category (optional)"
    )
    template_name: Optional[str] = Field(None, description="Template name (optional)")
    scope: str = Field(default="global", description="Scope: 'global' or 'private'")


class UpdateInventoryRequest(BaseModel):
    """Request for updating an inventory."""

    name: Optional[str] = Field(None, description="Inventory name")
    description: Optional[str] = Field(None, description="Inventory description")
    conditions: Optional[List[dict]] = Field(
        None, description="List of logical conditions or tree structure"
    )
    template_category: Optional[str] = Field(None, description="Template category")
    template_name: Optional[str] = Field(None, description="Template name")
    scope: Optional[str] = Field(None, description="Scope: 'global' or 'private'")


class InventoryResponse(BaseModel):
    """Response model for a single inventory."""

    id: int
    name: str
    description: Optional[str]
    conditions: List[dict]
    template_category: Optional[str]
    template_name: Optional[str]
    scope: str
    created_by: str
    is_active: bool
    created_at: Optional[str]
    updated_at: Optional[str]


class ListInventoriesResponse(BaseModel):
    """Response with list of inventories."""

    inventories: List[InventoryResponse]
    total: int


class InventoryDeleteResponse(BaseModel):
    """Response after deleting an inventory."""

    success: bool
    message: str


# ============================================================================
# Endpoints
# ============================================================================


@router.post("", response_model=InventoryResponse, status_code=status.HTTP_201_CREATED)
async def create_inventory(
    request: CreateInventoryRequest,
    current_user: dict = Depends(require_permission("general.inventory", "write")),
) -> InventoryResponse:
    """
    Create a new inventory configuration.

    Requires general.inventory:write permission.
    """
    try:
        username = current_user.get("username")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username not found in token",
            )

        # Conditions are already dicts (flexible structure for tree format)
        inventory_data = {
            "name": request.name,
            "description": request.description,
            "conditions": request.conditions,
            "template_category": request.template_category,
            "template_name": request.template_name,
            "scope": request.scope,
            "created_by": username,
        }

        inventory_id = inventory_manager.create_inventory(inventory_data)
        if not inventory_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create inventory",
            )

        # Retrieve the created inventory
        inventory = inventory_manager.get_inventory(inventory_id)
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Inventory created but could not be retrieved",
            )

        return InventoryResponse(**inventory)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating inventory: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create inventory: {str(e)}",
        )


@router.get("", response_model=ListInventoriesResponse)
async def list_inventories(
    scope: Optional[str] = None,
    active_only: bool = True,
    current_user: dict = Depends(require_permission("general.inventory", "read")),
) -> ListInventoriesResponse:
    """
    List all inventories accessible to the current user.

    Returns:
    - Global inventories (scope='global')
    - Private inventories owned by the user (scope='private' AND created_by=username)

    Query Parameters:
    - scope: Filter by scope ('global', 'private', or None for both)
    - active_only: Only return active inventories (default: true)

    Requires general.inventory:read permission.
    """
    try:
        username = current_user.get("username")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username not found in token",
            )

        inventories = inventory_manager.list_inventories(
            username=username, active_only=active_only, scope=scope
        )

        return ListInventoriesResponse(
            inventories=[InventoryResponse(**inv) for inv in inventories],
            total=len(inventories),
        )

    except Exception as e:
        logger.error(f"Error listing inventories: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list inventories: {str(e)}",
        )


@router.get("/{inventory_id}", response_model=InventoryResponse)
async def get_inventory(
    inventory_id: int,
    current_user: dict = Depends(require_permission("general.inventory", "read")),
) -> InventoryResponse:
    """
    Get a specific inventory by ID.

    Requires general.inventory:read permission.
    """
    try:
        inventory = inventory_manager.get_inventory(inventory_id)
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inventory with ID {inventory_id} not found",
            )

        # Check access (user can access global inventories or their own private ones)
        username = current_user.get("username")
        if inventory["scope"] == "private" and inventory["created_by"] != username:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this inventory",
            )

        return InventoryResponse(**inventory)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting inventory {inventory_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get inventory: {str(e)}",
        )


@router.get("/by-name/{inventory_name}", response_model=InventoryResponse)
async def get_inventory_by_name(
    inventory_name: str,
    current_user: dict = Depends(require_permission("general.inventory", "read")),
) -> InventoryResponse:
    """
    Get a specific inventory by name.

    Returns the inventory owned by the current user with the given name.

    Requires general.inventory:read permission.
    """
    try:
        username = current_user.get("username")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username not found in token",
            )

        inventory = inventory_manager.get_inventory_by_name(inventory_name, username)
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inventory '{inventory_name}' not found",
            )

        return InventoryResponse(**inventory)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting inventory by name '{inventory_name}': {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get inventory: {str(e)}",
        )


@router.put("/{inventory_id}", response_model=InventoryResponse)
async def update_inventory(
    inventory_id: int,
    request: UpdateInventoryRequest,
    current_user: dict = Depends(require_permission("general.inventory", "write")),
) -> InventoryResponse:
    """
    Update an existing inventory.

    Only the owner of a private inventory can update it.
    Global inventories can be updated by anyone with write permission.

    Requires general.inventory:write permission.
    """
    try:
        username = current_user.get("username")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username not found in token",
            )

        # Build update data (only include non-None fields)
        update_data = {}
        if request.name is not None:
            update_data["name"] = request.name
        if request.description is not None:
            update_data["description"] = request.description
        if request.conditions is not None:
            # Conditions are already dicts (flexible structure for tree format)
            update_data["conditions"] = request.conditions
        if request.template_category is not None:
            update_data["template_category"] = request.template_category
        if request.template_name is not None:
            update_data["template_name"] = request.template_name
        if request.scope is not None:
            update_data["scope"] = request.scope

        success = inventory_manager.update_inventory(
            inventory_id, update_data, username
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update inventory",
            )

        # Retrieve updated inventory
        inventory = inventory_manager.get_inventory(inventory_id)
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inventory with ID {inventory_id} not found after update",
            )

        return InventoryResponse(**inventory)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating inventory {inventory_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update inventory: {str(e)}",
        )


@router.delete("/{inventory_id}", response_model=InventoryDeleteResponse)
async def delete_inventory(
    inventory_id: int,
    hard_delete: bool = False,
    current_user: dict = Depends(require_permission("general.inventory", "delete")),
) -> InventoryDeleteResponse:
    """
    Delete an inventory (soft delete by default).

    Only the owner of a private inventory can delete it.
    Global inventories can be deleted by anyone with delete permission.

    Query Parameters:
    - hard_delete: If true, permanently delete. If false (default), soft delete.

    Requires general.inventory:delete permission.
    """
    try:
        username = current_user.get("username")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username not found in token",
            )

        success = inventory_manager.delete_inventory(
            inventory_id, username, hard_delete
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete inventory",
            )

        return InventoryDeleteResponse(
            success=True,
            message=f"Inventory {'deleted' if hard_delete else 'deactivated'} successfully",
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting inventory {inventory_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete inventory: {str(e)}",
        )


@router.get("/search/{query}", response_model=ListInventoriesResponse)
async def search_inventories(
    query: str,
    active_only: bool = True,
    current_user: dict = Depends(require_permission("general.inventory", "read")),
) -> ListInventoriesResponse:
    """
    Search inventories by name or description.

    Returns inventories accessible to the current user that match the search query.

    Requires general.inventory:read permission.
    """
    try:
        username = current_user.get("username")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username not found in token",
            )

        inventories = inventory_manager.search_inventories(query, username, active_only)

        return ListInventoriesResponse(
            inventories=[InventoryResponse(**inv) for inv in inventories],
            total=len(inventories),
        )

    except Exception as e:
        logger.error(f"Error searching inventories: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to search inventories: {str(e)}",
        )
