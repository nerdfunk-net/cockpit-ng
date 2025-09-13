"""
Git repository management router - CRUD operations for repositories.
Handles creation, reading, updating, and deletion of Git repository configurations.
"""

from __future__ import annotations
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from core.auth import verify_admin_token
from models.git_repositories import (
    GitRepositoryRequest,
    GitRepositoryResponse,
    GitRepositoryListResponse,
    GitRepositoryUpdateRequest,
    GitConnectionTestRequest,
    GitConnectionTestResponse,
)
from services.git_utils import resolve_git_credentials
from services.git_shared_utils import git_repo_manager
import tempfile
import subprocess
import os
from pathlib import Path

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/git-repositories", tags=["git-repositories"])


@router.get("/", response_model=GitRepositoryListResponse)
async def get_repositories(
    category: Optional[str] = None,
    active_only: bool = False,
    current_user: dict = Depends(verify_admin_token),
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
    repo_id: int, current_user: dict = Depends(verify_admin_token)
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
    repo_id: int, current_user: dict = Depends(verify_admin_token)
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
    repository: GitRepositoryRequest, current_user: dict = Depends(verify_admin_token)
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
    current_user: dict = Depends(verify_admin_token),
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
    current_user: dict = Depends(verify_admin_token),
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
    current_user: dict = Depends(verify_admin_token),
):
    """Test git repository connection."""
    try:
        # Create temporary directory for test
        with tempfile.TemporaryDirectory() as temp_dir:
            test_path = Path(temp_dir) / "test_repo"

            # Build git clone command
            clone_url = test_request.url

            # Create a temporary repository dict to use credential resolution
            temp_repo = {
                "credential_name": test_request.credential_name,
                "username": test_request.username,  # fallback
                "token": test_request.token,  # fallback
            }

            # Resolve credentials using the utility function
            resolved_username, resolved_token = resolve_git_credentials(temp_repo)

            # Handle credential resolution errors
            if test_request.credential_name and not resolved_token:
                return GitConnectionTestResponse(
                    success=False,
                    message=f"Failed to resolve credential '{test_request.credential_name}' - credential not found, not a token type, or decryption failed",
                    details={},
                )

            if resolved_username and resolved_token:
                # Add authentication to URL
                if "://" in clone_url:
                    protocol, rest = clone_url.split("://", 1)
                    clone_url = (
                        f"{protocol}://{resolved_username}:{resolved_token}@{rest}"
                    )

            # Set up environment
            env = os.environ.copy()
            if not test_request.verify_ssl:
                env["GIT_SSL_NO_VERIFY"] = "1"

            # Try to clone (shallow clone for speed)
            cmd = [
                "git",
                "clone",
                "--depth",
                "1",
                "--branch",
                test_request.branch,
                clone_url,
                str(test_path),
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                env=env,
                timeout=30,  # 30 second timeout
            )

            if result.returncode == 0:
                return GitConnectionTestResponse(
                    success=True,
                    message="Git connection successful",
                    details={"branch": test_request.branch, "url": test_request.url},
                )
            else:
                return GitConnectionTestResponse(
                    success=False,
                    message=f"Git connection failed: {result.stderr}",
                    details={"error": result.stderr, "return_code": result.returncode},
                )

    except subprocess.TimeoutExpired:
        return GitConnectionTestResponse(
            success=False,
            message="Git connection test timed out",
            details={"error": "Connection timeout after 30 seconds"},
        )
    except Exception as e:
        logger.error(f"Error testing git connection: {e}")
        return GitConnectionTestResponse(
            success=False,
            message=f"Git connection test error: {str(e)}",
            details={"error": str(e)},
        )


@router.get("/health")
async def health_check(current_user: dict = Depends(verify_admin_token)):
    """Health check for git repository management."""
    try:
        health = git_repo_manager.health_check()
        return health
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))