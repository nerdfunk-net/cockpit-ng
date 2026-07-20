"""
Saved server search service — PostgreSQL CRUD for saved server search queries.

Mirrors services/inventory/persistence_service.py for the server-clients
saved-search domain.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from core.models import SavedServerSearch
from repositories.servers.saved_search_repository import SavedSearchRepository

logger = logging.getLogger(__name__)


class SavedSearchService:
    """Manages saved server search configurations in PostgreSQL."""

    def __init__(self, repository: SavedSearchRepository):
        self.repository = repository

    # ------------------------------------------------------------------
    # Access control
    # ------------------------------------------------------------------

    def _assert_access(self, search: dict, username: str) -> None:
        """Raise PermissionError if user cannot access a private search."""
        if search.get("scope") == "private" and search.get("created_by") != username:
            raise PermissionError(f"Access denied to saved search {search['id']}")

    # ------------------------------------------------------------------
    # CRUD operations
    # ------------------------------------------------------------------

    def create_search(self, search_data: Dict[str, Any]) -> Optional[int]:
        """Create a new saved search."""
        try:
            if not search_data.get("name"):
                raise ValueError("Search name is required")

            if not search_data.get("created_by"):
                raise ValueError("Creator username is required")

            if not search_data.get("query"):
                raise ValueError("Query is required")

            existing = self.repository.get_by_name(
                search_data["name"], search_data["created_by"], active_only=True
            )
            if existing:
                raise ValueError(
                    f"Saved search with name '{search_data['name']}' already exists for this user"
                )

            search = self.repository.create(
                name=search_data["name"],
                description=search_data.get("description"),
                query=search_data["query"],
                scope=search_data.get("scope", "global"),
                group_path=search_data.get("group_path") or None,
                created_by=search_data["created_by"],
                is_active=True,
            )

            logger.info(
                "Saved search '%s' created with ID %s by %s",
                search_data["name"],
                search.id,
                search_data["created_by"],
            )
            return search.id

        except ValueError:
            raise
        except Exception as e:
            logger.error("Error creating saved search: %s", e)
            raise

    def get_search(
        self,
        search_id: int,
        username: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Get a saved search by ID.

        If *username* is provided, raises PermissionError when the caller
        does not have access to a private search.
        """
        try:
            search = self.repository.get_by_id(search_id)
            if not search:
                return None

            result = self._model_to_dict(search)

            if username is not None:
                self._assert_access(result, username)

            return result

        except PermissionError:
            raise
        except Exception as e:
            logger.error("Error getting saved search %s: %s", search_id, e)
            return None

    def list_searches(
        self,
        username: str,
        active_only: bool = True,
        scope: Optional[str] = None,
        group_path_filter: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """List saved searches accessible to a user.

        Returns global searches and private searches owned by the user.
        """
        try:
            searches = self.repository.list_searches(
                username=username,
                active_only=active_only,
                scope=scope,
                group_path_filter=group_path_filter,
            )

            results = [self._model_to_dict(s) for s in searches]
            logger.info(
                "Listed %s saved searches for user %s (scope=%s, group_path_filter=%s)",
                len(results),
                username,
                scope,
                group_path_filter,
            )
            return results

        except Exception as e:
            logger.error("Error listing saved searches: %s", e)
            return []

    def get_all_groups(self, username: str) -> List[str]:
        """Return all unique group paths (including ancestor paths) accessible to a user."""
        try:
            raw_paths = self.repository.get_distinct_group_paths(username)

            all_paths: set[str] = set()
            for path in raw_paths:
                segments = path.split("/")
                for i in range(1, len(segments) + 1):
                    all_paths.add("/".join(segments[:i]))

            return sorted(all_paths)

        except Exception as e:
            logger.error("Error fetching saved-search groups: %s", e)
            return []

    def rename_group(self, old_path: str, new_name: str, username: str) -> dict:
        """Rename the last segment of old_path to new_name across all matching searches.

        Args:
            old_path: Full path of the group to rename (e.g. 'networking/dc1')
            new_name: New leaf segment name (e.g. 'datacenter1')
            username: Authenticated user performing the rename

        Returns:
            Dict with 'updated_count' and 'new_path'

        Raises:
            ValueError: If old_path is empty, new_name is empty, or new_name contains '/'
        """
        if not old_path:
            raise ValueError("Cannot rename the root group")
        if not new_name or not new_name.strip():
            raise ValueError("New group name must not be empty")
        if "/" in new_name:
            raise ValueError("Group name must not contain '/'")

        new_name = new_name.strip()
        segments = old_path.split("/")
        segments[-1] = new_name
        new_path = "/".join(segments)

        if new_path == old_path:
            logger.info(
                "rename_group: old_path == new_path ('%s'), skipping update", old_path
            )
            return {"updated_count": 0, "new_path": new_path}

        try:
            updated_count = self.repository.rename_group(old_path, new_path, username)
            logger.info(
                "Renamed saved-search group '%s' -> '%s': %s rows updated by %s",
                old_path,
                new_path,
                updated_count,
                username,
            )
            return {"updated_count": updated_count, "new_path": new_path}
        except Exception as e:
            logger.error("Error renaming saved-search group '%s': %s", old_path, e)
            raise

    def update_search(
        self, search_id: int, search_data: Dict[str, Any], username: str
    ) -> bool:
        """Update an existing saved search."""
        try:
            current_obj = self.repository.get_by_id(search_id)
            if not current_obj:
                raise ValueError(f"Saved search with ID {search_id} not found")

            if current_obj.scope == "private" and current_obj.created_by != username:
                raise ValueError("You don't have permission to update this search")

            current = self._model_to_dict(current_obj)

            update_kwargs = {
                "name": search_data.get("name", current["name"]),
                "description": search_data.get("description", current["description"]),
                "query": search_data.get("query", current["query"]),
                "scope": search_data.get("scope", current["scope"]),
                "group_path": search_data.get("group_path", current.get("group_path"))
                or None,
            }

            self.repository.update(search_id, **update_kwargs)
            logger.info("Saved search %s updated by %s", search_id, username)
            return True

        except Exception as e:
            logger.error("Error updating saved search %s: %s", search_id, e)
            raise

    def delete_search(
        self, search_id: int, username: str, hard_delete: bool = True
    ) -> bool:
        """Delete a saved search (hard delete by default)."""
        try:
            search = self.repository.get_by_id(search_id)
            if not search:
                raise ValueError(f"Saved search with ID {search_id} not found")

            if search.scope == "private" and search.created_by != username:
                raise ValueError("You don't have permission to delete this search")

            if hard_delete:
                self.repository.delete(search_id)
            else:
                self.repository.update(search_id, is_active=False)

            logger.info(
                "Saved search %s %s by %s",
                search_id,
                "deleted" if hard_delete else "deactivated",
                username,
            )
            return True

        except Exception as e:
            logger.error("Error deleting saved search %s: %s", search_id, e)
            raise

    def search_searches(
        self, query: str, username: str, active_only: bool = True
    ) -> List[Dict[str, Any]]:
        """Search saved searches by name or description."""
        try:
            searches = self.repository.search_searches(query, username, active_only)
            return [self._model_to_dict(s) for s in searches]

        except Exception as e:
            logger.error("Error searching saved searches: %s", e)
            return []

    def health_check(self) -> Dict[str, Any]:
        """Check saved-search database health."""
        try:
            active_count = self.repository.get_active_count()
            total_count = self.repository.get_total_count()
            return {
                "status": "healthy",
                "storage_type": "database",
                "active_searches": active_count,
                "total_searches": total_count,
            }
        except Exception as e:
            logger.error("Saved-search database health check failed: %s", e)
            return {"status": "unhealthy", "error": str(e)}

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _model_to_dict(self, search: SavedServerSearch) -> Dict[str, Any]:
        """Convert SQLAlchemy model to dictionary."""
        return {
            "id": search.id,
            "name": search.name,
            "description": search.description,
            "query": search.query or {},
            "scope": search.scope,
            "group_path": search.group_path,
            "created_by": search.created_by,
            "is_active": bool(search.is_active),
            "created_at": (
                search.created_at.isoformat() if search.created_at else None
            ),
            "updated_at": (
                search.updated_at.isoformat() if search.updated_at else None
            ),
        }
