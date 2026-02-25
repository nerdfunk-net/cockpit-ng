"""
Git repository management system.
Database: PostgreSQL (cockpit database)
Table: git_repositories
"""

import logging
from datetime import datetime
from typing import List, Optional, Dict, Any
from repositories import GitRepositoryRepository
from core.models import GitRepository

logger = logging.getLogger(__name__)


class GitRepositoryManager:
    """Manages Git repositories in PostgreSQL database."""

    def __init__(self, db_path: str = None):
        # db_path parameter kept for backward compatibility but not used
        self.repo = GitRepositoryRepository()

    def init_database(self):
        """No-op for backward compatibility. Table created via models."""
        pass

    def create_repository(self, repo_data: Dict[str, Any]) -> int:
        """Create a new git repository."""
        try:
            # Check if name already exists
            if self.repo.name_exists(repo_data["name"]):
                raise ValueError(
                    f"Repository with name '{repo_data['name']}' already exists"
                )

            new_repo = self.repo.create(
                name=repo_data["name"],
                category=repo_data["category"],
                url=repo_data["url"],
                branch=repo_data.get("branch", "main"),
                credential_name=repo_data.get("credential_name"),
                path=repo_data.get("path"),
                verify_ssl=repo_data.get("verify_ssl", True),
                git_author_name=repo_data.get("git_author_name"),
                git_author_email=repo_data.get("git_author_email"),
                description=repo_data.get("description"),
                is_active=repo_data.get("is_active", True),
            )

            logger.info(
                f"Created git repository: {repo_data['name']} (ID: {new_repo.id})"
            )
            return new_repo.id
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error creating git repository: {e}")
            raise

    def get_repository(self, repo_id: int) -> Optional[Dict[str, Any]]:
        """Get a git repository by ID."""
        try:
            repo = self.repo.get_by_id(repo_id)
            if repo:
                return self._model_to_dict(repo)
            return None
        except Exception as e:
            logger.error(f"Error getting git repository {repo_id}: {e}")
            raise

    def get_repositories(
        self, category: Optional[str] = None, active_only: bool = False
    ) -> List[Dict[str, Any]]:
        """Get all git repositories, optionally filtered by category and active status."""
        try:
            if category:
                repos = self.repo.get_by_category(category, active_only)
            elif active_only:
                repos = self.repo.get_all_active()
            else:
                repos = self.repo.get_all()

            return [self._model_to_dict(r) for r in repos]
        except Exception as e:
            logger.error(f"Error getting git repositories: {e}")
            raise

    def update_repository(self, repo_id: int, repo_data: Dict[str, Any]) -> bool:
        """Update a git repository."""
        try:
            # Filter valid fields
            update_kwargs = {}
            for field in [
                "name",
                "category",
                "url",
                "branch",
                "auth_type",
                "credential_name",
                "path",
                "verify_ssl",
                "git_author_name",
                "git_author_email",
                "description",
                "is_active",
            ]:
                if field in repo_data:
                    update_kwargs[field] = repo_data[field]

            if not update_kwargs:
                return False

            # Check for name conflict
            if "name" in update_kwargs:
                existing = self.repo.get_by_name(update_kwargs["name"])
                if existing and existing.id != repo_id:
                    raise ValueError(
                        f"Repository with name '{update_kwargs['name']}' already exists"
                    )

            update_kwargs["updated_at"] = datetime.utcnow()
            self.repo.update(repo_id, **update_kwargs)

            logger.info(f"Updated git repository ID: {repo_id}")
            return True
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error updating git repository {repo_id}: {e}")
            raise

    def delete_repository(self, repo_id: int, hard_delete: bool = True) -> bool:
        """Delete a git repository."""
        try:
            if hard_delete:
                self.repo.delete(repo_id)
                action = "Deleted"
            else:
                self.repo.update(repo_id, is_active=False, updated_at=datetime.utcnow())
                action = "Deactivated"

            logger.info(f"{action} git repository ID: {repo_id}")
            return True
        except Exception as e:
            logger.error(f"Error deleting git repository {repo_id}: {e}")
            raise

    def update_sync_status(
        self, repo_id: int, status: str, last_sync: Optional[datetime] = None
    ) -> bool:
        """Update the sync status of a repository."""
        try:
            if last_sync is None:
                last_sync = datetime.utcnow()

            self.repo.update(
                repo_id,
                sync_status=status,
                last_sync=last_sync,
                updated_at=datetime.utcnow(),
            )
            return True
        except Exception as e:
            logger.error(f"Error updating sync status for repository {repo_id}: {e}")
            raise

    def get_repositories_by_category(self, category: str) -> List[Dict[str, Any]]:
        """Get all active repositories for a specific category."""
        return self.get_repositories(category=category, active_only=True)

    def _model_to_dict(self, repo: GitRepository) -> Dict[str, Any]:
        """Convert GitRepository model to dictionary."""
        return {
            "id": repo.id,
            "name": repo.name,
            "category": repo.category,
            "url": repo.url,
            "branch": repo.branch,
            "auth_type": repo.auth_type,
            "credential_name": repo.credential_name,
            "path": repo.path,
            "verify_ssl": repo.verify_ssl,
            "git_author_name": repo.git_author_name,
            "git_author_email": repo.git_author_email,
            "description": repo.description,
            "is_active": repo.is_active,
            "last_sync": repo.last_sync.isoformat() if repo.last_sync else None,
            "sync_status": repo.sync_status,
            "created_at": repo.created_at.isoformat() if repo.created_at else None,
            "updated_at": repo.updated_at.isoformat() if repo.updated_at else None,
        }

    def health_check(self) -> Dict[str, Any]:
        """Check the health of the git repository management system."""
        try:
            all_repos = self.repo.get_all()
            active_repos = [r for r in all_repos if r.is_active]

            category_counts = {}
            for repo in all_repos:
                category_counts[repo.category] = (
                    category_counts.get(repo.category, 0) + 1
                )

            return {
                "status": "healthy",
                "total_repositories": len(all_repos),
                "active_repositories": len(active_repos),
                "categories": category_counts,
                "database": "PostgreSQL",
            }
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return {"status": "error", "error": str(e), "database": "PostgreSQL"}
