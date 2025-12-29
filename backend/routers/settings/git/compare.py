"""
Git cross-repository comparison operations.
Handles operations that work across multiple repositories.
"""

from __future__ import annotations
import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from services.settings.git.shared_utils import get_git_repo_by_id
from services.settings.git.diff import git_diff_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/git-compare", tags=["git-compare"])


@router.post("/repos")
async def compare_files_across_repos(
    request: dict,
    current_user: dict = Depends(require_permission("git.operations", "execute")),
):
    """Compare files between different repositories."""
    try:
        repo1_id = request.get("repo1_id")
        repo2_id = request.get("repo2_id")
        file_path = request.get("file_path")
        commit1 = request.get("commit1", "HEAD")
        commit2 = request.get("commit2", "HEAD")

        if not all([repo1_id, repo2_id, file_path]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required parameters: repo1_id, repo2_id, file_path",
            )

        # Get both repositories
        repo1 = get_git_repo_by_id(repo1_id)
        repo2 = get_git_repo_by_id(repo2_id)

        # Use git_diff_service for comparison
        diff_result = git_diff_service.compare_files_across_repos(
            repo1=repo1,
            repo2=repo2,
            file_path=file_path,
            commit1=commit1,
            commit2=commit2,
        )

        return {
            "repo1_id": repo1_id,
            "repo2_id": repo2_id,
            "file_path": file_path,
            "commit1": commit1,
            "commit2": commit2,
            "diff_lines": diff_result.diff_lines,
            "left_file": f"{file_path} (repo {repo1_id}:{commit1})",
            "right_file": f"{file_path} (repo {repo2_id}:{commit2})",
            "stats": {
                "additions": diff_result.stats.additions,
                "deletions": diff_result.stats.deletions,
                "changes": diff_result.stats.additions + diff_result.stats.deletions,
                "total_lines": len(diff_result.diff_lines),
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compare files across repositories: {str(e)}",
        )
