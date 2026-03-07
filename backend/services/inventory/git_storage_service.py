"""
Inventory git storage service — save/load inventory configs in git repositories.

Extracted from InventoryService as part of Phase 4 decomposition.
See: doc/refactoring/REFACTORING_SERVICES.md — Phase 4
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from models.inventory import SavedInventory, SavedInventoryCondition

logger = logging.getLogger(__name__)


class InventoryGitStorage:
    """Persists inventory configurations as JSON files inside a git repository."""

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def save_inventory(
        self,
        name: str,
        description: Optional[str],
        conditions: List[Any],
        repository_id: int,
    ) -> Dict[str, Any]:
        """Write an inventory JSON file and push it to the git repository."""
        from git_repositories_manager import GitRepositoryManager
        from services.settings.git.service import git_service
        from services.settings.git.auth import git_auth_service

        try:
            logger.info("Saving inventory '%s' to repository %s", name, repository_id)

            git_manager = GitRepositoryManager()
            repository = git_manager.get_repository(repository_id)
            if not repository:
                raise ValueError(f"Repository with ID {repository_id} not found")

            self._check_https_credentials(repository, git_auth_service)

            logger.info("Opening/cloning Git repository: %s", repository["name"])
            repo = git_service.open_or_clone(repository)

            inventories_dir = Path(repo.working_dir) / "inventories"
            inventories_dir.mkdir(exist_ok=True)
            inventory_file = inventories_dir / f"{name}.json"
            is_update = inventory_file.exists()

            inventory_data: Dict[str, Any] = {
                "name": name,
                "description": description,
                "conditions": [
                    {
                        "field": c.field,
                        "operator": c.operator,
                        "value": c.value,
                        "logic": c.logic,
                    }
                    for c in conditions
                ],
                "created_at": None if is_update else datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
            }

            if is_update:
                try:
                    existing = json.loads(inventory_file.read_text())
                    inventory_data["created_at"] = existing.get("created_at")
                except Exception as e:
                    logger.warning("Could not read existing inventory: %s", e)

            inventory_file.write_text(json.dumps(inventory_data, indent=2))

            action = "Updated" if is_update else "Created"
            commit_message = f"{action} inventory: {name}"
            if description:
                commit_message += f"\n\n{description}"

            logger.info("Committing and pushing: %s", commit_message)
            result = git_service.commit_and_push(
                repository=repository,
                message=commit_message,
                files=[str(inventory_file.relative_to(repo.working_dir))],
                repo=repo,
                branch=repository.get("branch", "main"),
            )

            if not result.success:
                raise ValueError(f"Failed to commit/push: {result.message}")

            logger.info("Successfully saved inventory '%s'", name)
            return {
                "success": True,
                "message": f"Inventory '{name}' successfully saved to {repository['name']}",
            }

        except Exception as e:
            logger.error("Error saving inventory: %s", e)
            raise

    async def list_inventories(self, repository_id: int) -> List[SavedInventory]:
        """Return all saved inventories found in the repository's ``inventories/`` dir."""
        from git_repositories_manager import GitRepositoryManager
        from services.settings.git.service import git_service
        from services.settings.git.auth import git_auth_service

        try:
            logger.info("Listing inventories from repository %s", repository_id)

            git_manager = GitRepositoryManager()
            repository = git_manager.get_repository(repository_id)
            if not repository:
                raise ValueError(f"Repository with ID {repository_id} not found")

            self._check_https_credentials(repository, git_auth_service)

            repo = git_service.open_or_clone(repository)
            git_service.pull(repository, repo=repo)

            inventories_dir = Path(repo.working_dir) / "inventories"
            if not inventories_dir.exists():
                logger.info("No inventories directory found")
                return []

            inventories = []
            for inventory_file in inventories_dir.glob("*.json"):
                try:
                    data = json.loads(inventory_file.read_text())
                    inventories.append(
                        SavedInventory(
                            name=data["name"],
                            description=data.get("description"),
                            conditions=[
                                SavedInventoryCondition(**c) for c in data["conditions"]
                            ],
                            created_at=data.get("created_at"),
                            updated_at=data.get("updated_at"),
                        )
                    )
                except Exception as e:
                    logger.warning("Error reading inventory file %s: %s", inventory_file, e)

            logger.info("Found %s inventories", len(inventories))
            return inventories

        except Exception as e:
            logger.error("Error listing inventories: %s", e)
            raise

    async def load_inventory(
        self, name: str, repository_id: int
    ) -> Optional[SavedInventory]:
        """Load a single inventory by name from the git repository."""
        from git_repositories_manager import GitRepositoryManager
        from services.settings.git.service import git_service
        from services.settings.git.auth import git_auth_service

        try:
            logger.info(
                "Loading inventory '%s' from repository %s", name, repository_id
            )

            git_manager = GitRepositoryManager()
            repository = git_manager.get_repository(repository_id)
            if not repository:
                raise ValueError(f"Repository with ID {repository_id} not found")

            self._check_https_credentials(repository, git_auth_service)

            repo = git_service.open_or_clone(repository)
            git_service.pull(repository, repo=repo)

            inventory_file = (
                Path(repo.working_dir) / "inventories" / f"{name}.json"
            )
            if not inventory_file.exists():
                logger.warning("Inventory file not found: %s", inventory_file)
                return None

            data = json.loads(inventory_file.read_text())
            inventory = SavedInventory(
                name=data["name"],
                description=data.get("description"),
                conditions=[
                    SavedInventoryCondition(**c) for c in data["conditions"]
                ],
                created_at=data.get("created_at"),
                updated_at=data.get("updated_at"),
            )
            logger.info("Successfully loaded inventory '%s'", name)
            return inventory

        except Exception as e:
            logger.error("Error loading inventory: %s", e)
            raise

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _check_https_credentials(repository: Dict[str, Any], git_auth_service) -> None:
        """Raise ValueError if an HTTPS repository lacks configured credentials."""
        if (
            repository.get("url", "").startswith("https://")
            and repository.get("auth_type") != "ssh_key"
        ):
            _, token, _ = git_auth_service.resolve_credentials(repository)
            if not token:
                raise ValueError(
                    f"Repository '{repository['name']}' requires credentials. "
                    "Please configure a credential in Settings → Credentials, "
                    "or use an SSH URL (git@...) instead of HTTPS."
                )
