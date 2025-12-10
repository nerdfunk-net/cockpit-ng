"""
Inventory Management for Ansible Inventory Builder
Handles inventory storage, retrieval, and management operations in PostgreSQL
"""

from __future__ import annotations
import logging
import json
from typing import Dict, Any, Optional, List
from repositories.inventory_repository import InventoryRepository
from core.models import Inventory

logger = logging.getLogger(__name__)


class InventoryManager:
    """Manages Ansible inventory configurations in PostgreSQL database"""

    def create_inventory(self, inventory_data: Dict[str, Any]) -> Optional[int]:
        """Create a new inventory"""
        try:
            repo = InventoryRepository()

            # Validate required fields
            if not inventory_data.get("name"):
                raise ValueError("Inventory name is required")

            if not inventory_data.get("created_by"):
                raise ValueError("Creator username is required")

            if not inventory_data.get("conditions"):
                raise ValueError("Conditions are required")

            # Check for existing active inventory with same name and creator
            existing = repo.get_by_name(
                inventory_data["name"], inventory_data["created_by"], active_only=True
            )
            if existing:
                raise ValueError(
                    f"Inventory with name '{inventory_data['name']}' already exists for this user"
                )

            # Serialize conditions to JSON
            conditions_json = json.dumps(inventory_data["conditions"])

            # Create inventory
            inventory = repo.create(
                name=inventory_data["name"],
                description=inventory_data.get("description"),
                conditions=conditions_json,
                template_category=inventory_data.get("template_category"),
                template_name=inventory_data.get("template_name"),
                scope=inventory_data.get("scope", "global"),
                created_by=inventory_data["created_by"],
                is_active=True,
            )

            logger.info(
                f"Inventory '{inventory_data['name']}' created with ID {inventory.id} by {inventory_data['created_by']}"
            )
            return inventory.id

        except ValueError as e:
            raise e
        except Exception as e:
            logger.error(f"Error creating inventory: {e}")
            raise e

    def get_inventory(self, inventory_id: int) -> Optional[Dict[str, Any]]:
        """Get an inventory by ID"""
        try:
            repo = InventoryRepository()
            inventory = repo.get_by_id(inventory_id)

            if inventory:
                return self._model_to_dict(inventory)
            return None

        except Exception as e:
            logger.error(f"Error getting inventory {inventory_id}: {e}")
            return None

    def get_inventory_by_name(
        self, name: str, username: str
    ) -> Optional[Dict[str, Any]]:
        """Get an inventory by name for a specific user"""
        try:
            repo = InventoryRepository()
            inventory = repo.get_by_name(name, username, active_only=True)

            if inventory:
                return self._model_to_dict(inventory)
            return None

        except Exception as e:
            logger.error(f"Error getting inventory by name '{name}': {e}")
            return None

    def list_inventories(
        self,
        username: str,
        active_only: bool = True,
        scope: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        List inventories accessible to a user.

        Returns:
        - Global inventories (scope='global')
        - Private inventories owned by the user (scope='private' AND created_by=username)
        """
        try:
            repo = InventoryRepository()

            inventories = repo.list_inventories(
                username=username, active_only=active_only, scope=scope
            )

            results = [self._model_to_dict(inv) for inv in inventories]
            logger.info(
                f"Listed {len(results)} inventories for user {username} (scope={scope})"
            )

            return results

        except Exception as e:
            logger.error(f"Error listing inventories: {e}")
            return []

    def update_inventory(
        self, inventory_id: int, inventory_data: Dict[str, Any], username: str
    ) -> bool:
        """Update an existing inventory"""
        try:
            repo = InventoryRepository()

            # Get current inventory
            current_obj = repo.get_by_id(inventory_id)
            if not current_obj:
                raise ValueError(f"Inventory with ID {inventory_id} not found")

            # Check ownership for private inventories
            if current_obj.scope == "private" and current_obj.created_by != username:
                raise ValueError("You don't have permission to update this inventory")

            current = self._model_to_dict(current_obj)

            # Prepare update data
            conditions_json = (
                json.dumps(inventory_data["conditions"])
                if "conditions" in inventory_data
                else current["conditions"]
            )

            # Prepare update kwargs
            update_kwargs = {
                "name": inventory_data.get("name", current["name"]),
                "description": inventory_data.get(
                    "description", current["description"]
                ),
                "conditions": conditions_json,
                "template_category": inventory_data.get(
                    "template_category", current["template_category"]
                ),
                "template_name": inventory_data.get(
                    "template_name", current["template_name"]
                ),
                "scope": inventory_data.get("scope", current["scope"]),
            }

            repo.update(inventory_id, **update_kwargs)

            logger.info(f"Inventory {inventory_id} updated by {username}")
            return True

        except Exception as e:
            logger.error(f"Error updating inventory {inventory_id}: {e}")
            raise e

    def delete_inventory(
        self, inventory_id: int, username: str, hard_delete: bool = False
    ) -> bool:
        """Delete an inventory (soft delete by default)"""
        try:
            repo = InventoryRepository()

            # Get inventory for ownership check
            inventory = repo.get_by_id(inventory_id)
            if not inventory:
                raise ValueError(f"Inventory with ID {inventory_id} not found")

            # Check ownership for private inventories
            if inventory.scope == "private" and inventory.created_by != username:
                raise ValueError("You don't have permission to delete this inventory")

            if hard_delete:
                # Hard delete - remove from database
                repo.delete(inventory_id)
            else:
                # Soft delete - mark as inactive
                repo.update(inventory_id, is_active=False)

            logger.info(
                f"Inventory {inventory_id} {'deleted' if hard_delete else 'deactivated'} by {username}"
            )
            return True

        except Exception as e:
            logger.error(f"Error deleting inventory {inventory_id}: {e}")
            raise e

    def delete_inventory_by_name(
        self, name: str, username: str, hard_delete: bool = False
    ) -> bool:
        """Delete an inventory by name"""
        try:
            repo = InventoryRepository()
            inventory = repo.get_by_name(name, username, active_only=False)

            if not inventory:
                raise ValueError(f"Inventory '{name}' not found")

            return self.delete_inventory(inventory.id, username, hard_delete)

        except Exception as e:
            logger.error(f"Error deleting inventory by name '{name}': {e}")
            raise e

    def search_inventories(
        self, query: str, username: str, active_only: bool = True
    ) -> List[Dict[str, Any]]:
        """Search inventories by name or description"""
        try:
            repo = InventoryRepository()
            inventories = repo.search_inventories(query, username, active_only)
            return [self._model_to_dict(inv) for inv in inventories]

        except Exception as e:
            logger.error(f"Error searching inventories: {e}")
            return []

    def _model_to_dict(self, inventory: Inventory) -> Dict[str, Any]:
        """Convert SQLAlchemy model to dictionary"""
        result = {
            "id": inventory.id,
            "name": inventory.name,
            "description": inventory.description,
            "template_category": inventory.template_category,
            "template_name": inventory.template_name,
            "scope": inventory.scope,
            "created_by": inventory.created_by,
            "is_active": bool(inventory.is_active),
            "created_at": inventory.created_at.isoformat()
            if inventory.created_at
            else None,
            "updated_at": inventory.updated_at.isoformat()
            if inventory.updated_at
            else None,
        }

        # Parse JSON conditions field
        if inventory.conditions:
            try:
                result["conditions"] = json.loads(inventory.conditions)
            except json.JSONDecodeError:
                logger.error(f"Failed to parse conditions for inventory {inventory.id}")
                result["conditions"] = []
        else:
            result["conditions"] = []

        return result

    def health_check(self) -> Dict[str, Any]:
        """Check inventory database health"""
        try:
            repo = InventoryRepository()

            active_count = repo.get_active_count()
            total_count = repo.get_total_count()

            return {
                "status": "healthy",
                "storage_type": "database",
                "active_inventories": active_count,
                "total_inventories": total_count,
            }

        except Exception as e:
            logger.error(f"Inventory database health check failed: {e}")
            return {"status": "unhealthy", "error": str(e)}


# Global inventory manager instance
inventory_manager = InventoryManager()
