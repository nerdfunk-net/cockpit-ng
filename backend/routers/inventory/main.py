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
        logger.error("Error creating inventory: %s", e)
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
        logger.error("Error listing inventories: %s", e)
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
        logger.error("Error getting inventory %s: %s", inventory_id, e)
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

    Returns the inventory with the given name if it is:
    - A global inventory (accessible to all users), OR
    - A private inventory owned by the current user

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
        logger.error("Error getting inventory by name '%s': %s", inventory_name, e)
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
        logger.error("Error updating inventory %s: %s", inventory_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update inventory: {str(e)}",
        )


@router.delete("/{inventory_id}", response_model=InventoryDeleteResponse)
async def delete_inventory(
    inventory_id: int,
    hard_delete: bool = True,
    current_user: dict = Depends(require_permission("general.inventory", "delete")),
) -> InventoryDeleteResponse:
    """
    Delete an inventory (hard delete by default).

    Only the owner of a private inventory can delete it.
    Global inventories can be deleted by anyone with delete permission.

    Query Parameters:
    - hard_delete: If true (default), permanently delete. If false, soft delete (mark as inactive).

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
        logger.error("Error deleting inventory %s: %s", inventory_id, e)
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
        logger.error("Error searching inventories: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to search inventories: {str(e)}",
        )


@router.get("/export/{inventory_id}")
async def export_inventory(
    inventory_id: int,
    current_user: dict = Depends(require_permission("general.inventory", "read")),
):
    """
    Export an inventory as a JSON file.

    Returns the inventory in a structured JSON format that can be imported later.
    Includes metadata and the complete condition tree structure.

    Requires general.inventory:read permission.
    """
    try:
        username = current_user.get("username")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username not found in token",
            )

        # Get the inventory
        inventory = inventory_manager.get_inventory(inventory_id)
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inventory with ID {inventory_id} not found",
            )

        # Check access permissions
        if inventory["scope"] == "private" and inventory["created_by"] != username:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this inventory",
            )

        # Build export data structure
        from datetime import datetime

        export_data = {
            "version": 2,
            "metadata": {
                "name": inventory["name"],
                "description": inventory.get("description", ""),
                "scope": inventory["scope"],
                "exportedAt": datetime.utcnow().isoformat() + "Z",
                "exportedBy": username,
                "originalId": inventory["id"],
            },
            "conditionTree": None,
        }

        # Extract condition tree from conditions
        conditions = inventory.get("conditions", [])
        if conditions and len(conditions) > 0:
            first_condition = conditions[0]
            # Check if this is version 2 format (with tree)
            if (
                isinstance(first_condition, dict)
                and "version" in first_condition
                and first_condition["version"] == 2
            ):
                export_data["conditionTree"] = first_condition.get("tree")
            else:
                # Legacy flat format - convert to tree
                # For simplicity, we'll wrap it in a basic root structure
                export_data["conditionTree"] = {
                    "type": "root",
                    "internalLogic": "AND",
                    "items": [
                        {
                            "id": f"item-{i}",
                            "field": cond.get("field", ""),
                            "operator": cond.get("operator", ""),
                            "value": cond.get("value", ""),
                        }
                        for i, cond in enumerate(conditions)
                    ],
                }

        # Return as JSON response
        from fastapi.responses import JSONResponse

        return JSONResponse(
            content=export_data,
            headers={
                "Content-Disposition": f'attachment; filename="inventory-{inventory["name"]}.json"'
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error exporting inventory %s: %s", inventory_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export inventory: {str(e)}",
        )


class ImportInventoryRequest(BaseModel):
    """Request for importing an inventory from JSON."""

    import_data: dict = Field(..., description="The JSON data to import")


@router.post(
    "/import", response_model=InventoryResponse, status_code=status.HTTP_201_CREATED
)
async def import_inventory(
    request: ImportInventoryRequest,
    current_user: dict = Depends(require_permission("general.inventory", "write")),
) -> InventoryResponse:
    """
    Import an inventory from exported JSON data.

    Validates the import data and creates a new inventory with an "(imported)" suffix.
    The imported inventory will be owned by the current user.

    Requires general.inventory:write permission.
    """
    try:
        username = current_user.get("username")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username not found in token",
            )

        import_data = request.import_data

        # Validate import data structure
        if "version" not in import_data or import_data["version"] != 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid inventory file format. Expected version 2.",
            )

        if "conditionTree" not in import_data or not import_data["conditionTree"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid inventory file. Missing condition tree.",
            )

        if "metadata" not in import_data or not import_data["metadata"].get("name"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid inventory file. Missing metadata.",
            )

        # Create new inventory with imported data
        metadata = import_data["metadata"]
        new_name = f"{metadata['name']} (imported)"
        description = metadata.get("description", "Imported inventory")

        # Wrap the condition tree in version 2 format
        tree_data = {"version": 2, "tree": import_data["conditionTree"]}

        inventory_data = {
            "name": new_name,
            "description": description,
            "conditions": [tree_data],
            "template_category": None,
            "template_name": None,
            "scope": "global",
            "created_by": username,
        }

        inventory_id = inventory_manager.create_inventory(inventory_data)
        if not inventory_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create imported inventory",
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
        logger.error("Error importing inventory: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to import inventory: {str(e)}",
        )
