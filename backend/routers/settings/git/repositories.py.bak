"""
Git repository management router - CRUD operations for repositories.
Handles creation, reading, updating, and deletion of Git repository configurations.
"""

from __future__ import annotations
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from core.auth import require_permission
from models.git_repositories import (
    GitRepositoryRequest,
    GitRepositoryResponse,
    GitRepositoryListResponse,
    GitRepositoryUpdateRequest,
    GitConnectionTestRequest,
    GitConnectionTestResponse,
)
from services.settings.git.shared_utils import git_repo_manager
from services.settings.git.connection import git_connection_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/git-repositories", tags=["git-repositories"])


@router.get("/", response_model=GitRepositoryListResponse)
async def get_repositories(
    category: Optional[str] = None,
    active_only: bool = False,
    current_user: dict = Depends(require_permission("git.repositories", "read")),
):
    """Get all git repositories."""
    try:
        repositories = git_repo_manager.get_repositories(
            category=category, active_only=active_only
        )

        # Convert to response models
        repo_responses = []
        for repo in repositories:
            repo_responses.append(GitRepositoryResponse(**dict(repo)))

        return GitRepositoryListResponse(
            repositories=repo_responses, total=len(repo_responses)
        )
    except Exception as e:
        logger.error(f"Error getting repositories: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{repo_id}", response_model=GitRepositoryResponse)
async def get_repository(
    repo_id: int,
    current_user: dict = Depends(require_permission("git.repositories", "read")),
):
    """Get a specific git repository by ID."""
    try:
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")

        # Convert repository data
        repo_dict = dict(repository)

        return GitRepositoryResponse(**repo_dict)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting repository {repo_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{repo_id}/edit")
async def get_repository_for_edit(
    repo_id: int,
    current_user: dict = Depends(require_permission("git.repositories", "write")),
):
    """Get a specific git repository by ID with all fields for editing."""
    try:
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")

        # Return all fields including token for editing purposes
        return repository
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting repository {repo_id} for edit: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/", response_model=GitRepositoryResponse)
async def create_repository(
    repository: GitRepositoryRequest,
    current_user: dict = Depends(require_permission("git.repositories", "write")),
):
    """Create a new git repository."""
    try:
        repo_data = repository.dict()
        # Remove legacy username/token fields - only use credential_name
        repo_data.pop("username", None)
        repo_data.pop("token", None)
        repo_id = git_repo_manager.create_repository(repo_data)

        # Get the created repository
        created_repo = git_repo_manager.get_repository(repo_id)
        if not created_repo:
            raise HTTPException(
                status_code=500, detail="Failed to retrieve created repository"
            )

        # Convert created repository data
        repo_dict = dict(created_repo)

        return GitRepositoryResponse(**repo_dict)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating repository: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{repo_id}", response_model=GitRepositoryResponse)
async def update_repository(
    repo_id: int,
    repository: GitRepositoryUpdateRequest,
    current_user: dict = Depends(require_permission("git.repositories", "write")),
):
    """Update a git repository."""
    try:
        # Check if repository exists
        existing_repo = git_repo_manager.get_repository(repo_id)
        if not existing_repo:
            raise HTTPException(status_code=404, detail="Repository not found")

        # Update only provided fields
        repo_data = {k: v for k, v in repository.dict().items() if v is not None}
        # Remove legacy username/token fields - only use credential_name
        repo_data.pop("username", None)
        repo_data.pop("token", None)

        if not repo_data:
            raise HTTPException(status_code=400, detail="No fields to update")

        success = git_repo_manager.update_repository(repo_id, repo_data)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update repository")

        # Get the updated repository
        updated_repo = git_repo_manager.get_repository(repo_id)
        if not updated_repo:
            raise HTTPException(
                status_code=500, detail="Failed to retrieve updated repository"
            )

        # Convert updated repository data
        repo_dict = dict(updated_repo)

        return GitRepositoryResponse(**repo_dict)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating repository {repo_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{repo_id}")
async def delete_repository(
    repo_id: int,
    hard_delete: bool = True,
    current_user: dict = Depends(require_permission("git.repositories", "delete")),
):
    """Delete a git repository."""
    try:
        # Check if repository exists
        existing_repo = git_repo_manager.get_repository(repo_id)
        if not existing_repo:
            raise HTTPException(status_code=404, detail="Repository not found")

        success = git_repo_manager.delete_repository(repo_id, hard_delete=hard_delete)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete repository")

        action = "deleted" if hard_delete else "deactivated"
        return {"message": f"Repository {action} successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting repository {repo_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test-connection", response_model=GitConnectionTestResponse)
async def test_git_connection(
    test_request: GitConnectionTestRequest,
    current_user: dict = Depends(require_permission("git.repositories", "write")),
):
    """Test git repository connection.

    This endpoint now uses git_connection_service for all connection testing logic.
    The service handles credential resolution, authentication setup, and shallow clone testing.
    """
    logger.info(
        f"Received test connection request from user: {current_user.get('username', 'unknown')}"
    )
    logger.debug(
        f"Test request details: url={test_request.url}, branch={test_request.branch}, auth_type={test_request.auth_type}, credential_name={test_request.credential_name}"
    )

    try:
        result = git_connection_service.test_connection(test_request)
        logger.info(
            f"Test connection result: success={result.success}, message={result.message}"
        )
        return result
    except Exception as e:
        logger.error(f"Exception in test_git_connection endpoint: {e}", exc_info=True)
        raise


@router.get("/health")
async def health_check(
    current_user: dict = Depends(require_permission("git.repositories", "read")),
):
    """Health check for git repository management."""
    try:
        health = git_repo_manager.health_check()
        return health
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
