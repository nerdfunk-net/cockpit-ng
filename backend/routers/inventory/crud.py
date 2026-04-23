"""
Inventory CRUD router — create, read, update, delete for saved inventory configurations.

All business logic is delegated to InventoryPersistenceService via FastAPI Depends().

See: doc/refactoring/REFACTORING_INVENTORY.md — Step 2 / Step 4a
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse

from core.auth import require_permission
from dependencies import get_inventory_persistence_service
from models.inventory import (
    CreateInventoryRequest,
    InventoryDeleteResponse,
    InventoryResponse,
    ImportInventoryRequest,
    ListInventoriesResponse,
    UpdateInventoryRequest,
)
from services.inventory.persistence_service import InventoryPersistenceService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/inventory", tags=["inventory"])


# ============================================================================
# Endpoints
# ============================================================================


@router.post("", response_model=InventoryResponse, status_code=status.HTTP_201_CREATED)
async def create_inventory(
    request: CreateInventoryRequest,
    current_user: dict = Depends(require_permission("general.inventory", "write")),
    persistence: InventoryPersistenceService = Depends(
        get_inventory_persistence_service
    ),
) -> InventoryResponse:
    """Create a new inventory configuration.

    Requires general.inventory:write permission.
    """
    try:
        username = current_user.get("username")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username not found in token",
            )

        inventory_data = {
            "name": request.name,
            "description": request.description,
            "conditions": request.conditions,
            "template_category": request.template_category,
            "template_name": request.template_name,
            "scope": request.scope,
            "group_path": request.group_path or None,
            "created_by": username,
        }

        inventory_id = persistence.create_inventory(inventory_data)
        if not inventory_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create inventory",
            )

        inventory = persistence.get_inventory(inventory_id)
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
    group_path: Optional[str] = None,
    current_user: dict = Depends(require_permission("general.inventory", "read")),
    persistence: InventoryPersistenceService = Depends(
        get_inventory_persistence_service
    ),
) -> ListInventoriesResponse:
    """List all inventories accessible to the current user.

    Returns:
    - Global inventories (scope='global')
    - Private inventories owned by the user (scope='private' AND created_by=username)

    Optional filter:
    - group_path: Return only inventories in this group or its descendants.

    Requires general.inventory:read permission.
    """
    try:
        username = current_user.get("username")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username not found in token",
            )

        inventories = persistence.list_inventories(
            username=username,
            active_only=active_only,
            scope=scope,
            group_path_filter=group_path or None,
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
    persistence: InventoryPersistenceService = Depends(
        get_inventory_persistence_service
    ),
) -> InventoryResponse:
    """Get a specific inventory by ID.

    Requires general.inventory:read permission.
    """
    try:
        username = current_user.get("username")

        inventory = persistence.get_inventory(inventory_id, username=username)
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inventory with ID {inventory_id} not found",
            )

        return InventoryResponse(**inventory)

    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )
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
    persistence: InventoryPersistenceService = Depends(
        get_inventory_persistence_service
    ),
) -> InventoryResponse:
    """Get a specific inventory by name.

    Returns the inventory if it is a global inventory or a private inventory
    owned by the current user.

    Requires general.inventory:read permission.
    """
    try:
        username = current_user.get("username")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username not found in token",
            )

        inventory = persistence.get_inventory_by_name(inventory_name, username)
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
    persistence: InventoryPersistenceService = Depends(
        get_inventory_persistence_service
    ),
) -> InventoryResponse:
    """Update an existing inventory.

    Only the owner of a private inventory can update it.

    Requires general.inventory:write permission.
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
        if request.conditions is not None:
            update_data["conditions"] = request.conditions
        if request.template_category is not None:
            update_data["template_category"] = request.template_category
        if request.template_name is not None:
            update_data["template_name"] = request.template_name
        if request.scope is not None:
            update_data["scope"] = request.scope
        # group_path uses model_fields_set so null (move-to-root) is handled correctly
        if "group_path" in request.model_fields_set:
            update_data["group_path"] = request.group_path or None

        persistence.update_inventory(inventory_id, update_data, username)

        inventory = persistence.get_inventory(inventory_id)
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
    persistence: InventoryPersistenceService = Depends(
        get_inventory_persistence_service
    ),
) -> InventoryDeleteResponse:
    """Delete an inventory (hard delete by default).

    Only the owner of a private inventory can delete it.

    Requires general.inventory:delete permission.
    """
    try:
        username = current_user.get("username")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username not found in token",
            )

        persistence.delete_inventory(inventory_id, username, hard_delete)

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
    persistence: InventoryPersistenceService = Depends(
        get_inventory_persistence_service
    ),
) -> ListInventoriesResponse:
    """Search inventories by name or description.

    Requires general.inventory:read permission.
    """
    try:
        username = current_user.get("username")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username not found in token",
            )

        inventories = persistence.search_inventories(query, username, active_only)

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
    persistence: InventoryPersistenceService = Depends(
        get_inventory_persistence_service
    ),
):
    """Export an inventory as a JSON file.

    Requires general.inventory:read permission.
    """
    try:
        username = current_user.get("username")
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username not found in token",
            )

        inventory = persistence.get_inventory(inventory_id, username=username)
        if not inventory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Inventory with ID {inventory_id} not found",
            )

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

        conditions = inventory.get("conditions", [])
        if conditions and len(conditions) > 0:
            first_condition = conditions[0]
            if (
                isinstance(first_condition, dict)
                and "version" in first_condition
                and first_condition["version"] == 2
            ):
                export_data["conditionTree"] = first_condition.get("tree")
            else:
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

        return JSONResponse(
            content=export_data,
            headers={
                "Content-Disposition": f'attachment; filename="inventory-{inventory["name"]}.json"'
            },
        )

    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error exporting inventory %s: %s", inventory_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export inventory: {str(e)}",
        )


@router.post(
    "/import", response_model=InventoryResponse, status_code=status.HTTP_201_CREATED
)
async def import_inventory(
    request: ImportInventoryRequest,
    current_user: dict = Depends(require_permission("general.inventory", "write")),
    persistence: InventoryPersistenceService = Depends(
        get_inventory_persistence_service
    ),
) -> InventoryResponse:
    """Import an inventory from exported JSON data.

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

        metadata = import_data["metadata"]
        new_name = f"{metadata['name']} (imported)"
        description = metadata.get("description", "Imported inventory")
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

        inventory_id = persistence.create_inventory(inventory_data)
        if not inventory_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create imported inventory",
            )

        inventory = persistence.get_inventory(inventory_id)
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
