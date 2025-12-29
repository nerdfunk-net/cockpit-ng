"""
Shared Git utilities for use across Git router modules.
Consolidates common functions to avoid duplication.
"""

import logging
from fastapi import HTTPException, status
from git_repositories_manager import GitRepositoryManager
from services.settings.git.service import git_service

logger = logging.getLogger(__name__)

# Initialize git repository manager - shared instance
git_repo_manager = GitRepositoryManager()


def get_git_repo_by_id(repo_id: int):
    """Get Git repository instance by ID (shared utility function)."""
    try:
        # Get repository details directly by ID
        repository = git_repo_manager.get_repository(repo_id)

        if not repository:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Git repository with ID {repo_id} not found.",
            )

        if not repository["is_active"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Git repository '{repository['name']}' is inactive. Please activate it first.",
            )

        # Open the repository (or clone if needed) using central git_service
        try:
            repo = git_service.open_or_clone(repository)
            return repo
        except Exception as e:
            logger.error(f"Failed to prepare repository {repository['name']}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to open/clone Git repository: {str(e)}",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting Git repository {repo_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Git repository error: {str(e)}",
        )
