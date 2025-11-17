"""
Git cross-repository comparison operations.
Handles operations that work across multiple repositories.
"""

from __future__ import annotations
import difflib
import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from services.git_shared_utils import get_git_repo_by_id

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

        # Get file content from both repos
        try:
            file_content1 = (
                (repo1.commit(commit1).tree / file_path)
                .data_stream.read()
                .decode("utf-8")
            )
        except KeyError:
            file_content1 = ""

        try:
            file_content2 = (
                (repo2.commit(commit2).tree / file_path)
                .data_stream.read()
                .decode("utf-8")
            )
        except KeyError:
            file_content2 = ""

        # Generate diff
        diff_lines = []
        lines1 = file_content1.splitlines(keepends=True)
        lines2 = file_content2.splitlines(keepends=True)

        for line in difflib.unified_diff(lines1, lines2, n=3):
            diff_lines.append(line.rstrip("\n"))

        # Calculate stats
        additions = sum(
            1
            for line in diff_lines
            if line.startswith("+") and not line.startswith("+++")
        )
        deletions = sum(
            1
            for line in diff_lines
            if line.startswith("-") and not line.startswith("---")
        )

        return {
            "repo1_id": repo1_id,
            "repo2_id": repo2_id,
            "file_path": file_path,
            "commit1": commit1,
            "commit2": commit2,
            "diff_lines": diff_lines,
            "left_file": f"{file_path} (repo {repo1_id}:{commit1})",
            "right_file": f"{file_path} (repo {repo2_id}:{commit2})",
            "stats": {
                "additions": additions,
                "deletions": deletions,
                "changes": additions + deletions,
                "total_lines": len(diff_lines),
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compare files across repositories: {str(e)}",
        )
