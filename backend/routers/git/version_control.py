"""
Git version control router - Git VCS operations like branches, commits, and diffs.
Handles Git-specific version control functionality.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from git import GitCommandError, InvalidGitRepositoryError

from core.auth import require_permission
from core.safe_http_errors import raise_internal_server_error
from dependencies import get_git_cache_service, get_git_diff_service
from services.git.shared_utils import get_git_repo_by_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/git/{repo_id}", tags=["git-version-control"])


@router.get("/branches")
async def get_branches(
    repo_id: int,
    current_user: dict = Depends(require_permission("git.operations", "execute")),
):
    """Get list of Git branches."""
    try:
        repo = get_git_repo_by_id(repo_id)

        current_branch = repo.active_branch.name if repo.active_branch else None
        branches = []

        for branch in repo.branches:
            branches.append(
                {"name": branch.name, "current": branch.name == current_branch}
            )

        return branches
    except (InvalidGitRepositoryError, GitCommandError) as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Git repository not found or invalid: {str(e)}",
        )
    except Exception as e:
        raise_internal_server_error(logger, "Git branches error: ", e)


@router.get("/commits/{branch_name}")
async def get_commits(
    repo_id: int,
    branch_name: str,
    current_user: dict = Depends(require_permission("git.repositories", "read")),
    git_cache_service=Depends(get_git_cache_service),
):
    """Get commits for a specific branch."""
    try:
        from services.settings.manager import SettingsManager

        cache_cfg = SettingsManager().get_cache_settings()
        repo = get_git_repo_by_id(repo_id)
        if branch_name not in [ref.name for ref in repo.refs]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Branch '{branch_name}' not found",
            )
        limit = int(cache_cfg.get("max_commits", 500))
        return git_cache_service.get_commits(
            repo_id=repo_id,
            repo_path=repo.working_dir,
            branch_name=branch_name,
            limit=limit,
            use_models=False,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(logger, "Failed to get commits: ", e)


@router.post("/diff")
async def compare_commits(
    repo_id: int,
    request: dict,
    current_user: dict = Depends(require_permission("git.operations", "execute")),
    git_diff_service=Depends(get_git_diff_service),
):
    """Compare files between two Git commits."""
    try:
        commit1 = request.get("commit1")
        commit2 = request.get("commit2")
        file_path = request.get("file_path")
        if not all([commit1, commit2, file_path]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required parameters: commit1, commit2, file_path",
            )
        repo = get_git_repo_by_id(repo_id)
        return git_diff_service.compare_commits_side_by_side(
            repo, commit1, commit2, file_path
        )
    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(logger, "Failed to compare commits: ", e)
