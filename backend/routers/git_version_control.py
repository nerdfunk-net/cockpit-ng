"""
Git version control router - Git VCS operations like branches, commits, and diffs.
Handles Git-specific version control functionality.
"""

from __future__ import annotations
import difflib
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from git import InvalidGitRepositoryError, GitCommandError

from core.auth import get_current_username
from models.git import GitCommitRequest, GitBranchRequest
from services.cache_service import cache_service
from services.git_shared_utils import get_git_repo_by_id

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/git/{repo_id}", tags=["git-version-control"])


@router.get("/branches")
async def get_branches(repo_id: int, current_user: str = Depends(get_current_username)):
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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Git branches error: {str(e)}",
        )


@router.post("/branches")
async def create_or_switch_branch(
    repo_id: int,
    request: GitBranchRequest,
    current_user: str = Depends(get_current_username),
):
    """Create or switch to a Git branch."""
    try:
        repo = get_git_repo_by_id(repo_id)

        if request.create:
            # Create new branch
            new_branch = repo.create_head(request.branch_name)
            repo.head.reference = new_branch
            repo.head.reset(index=True, working_tree=True)
            return {
                "message": f"Created and switched to branch '{request.branch_name}'"
            }
        else:
            # Switch to existing branch
            repo.git.checkout(request.branch_name)
            return {"message": f"Switched to branch '{request.branch_name}'"}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to manage branch: {str(e)}",
        )


@router.get("/commits/{branch_name}")
async def get_commits(
    repo_id: int, branch_name: str, current_user: str = Depends(get_current_username)
):
    """Get commits for a specific branch."""
    try:
        from settings_manager import settings_manager

        cache_cfg = settings_manager.get_cache_settings()
        repo = get_git_repo_by_id(repo_id)

        # Check if branch exists
        if branch_name not in [ref.name for ref in repo.refs]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Branch '{branch_name}' not found",
            )

        # Try cache first
        repo_scope = f"repo:{repo_id}"
        cache_key = f"{repo_scope}:commits:{branch_name}"
        if cache_cfg.get("enabled", True):
            cached = cache_service.get(cache_key)
            if cached is not None:
                return cached

        # Get commits from the branch (respect max_commits)
        limit = int(cache_cfg.get("max_commits", 500))
        commits = []
        for commit in repo.iter_commits(branch_name, max_count=limit):
            commits.append(
                {
                    "hash": commit.hexsha,
                    "short_hash": commit.hexsha[:8],
                    "message": commit.message.strip(),
                    "author": {
                        "name": commit.author.name,
                        "email": commit.author.email,
                    },
                    "date": commit.committed_datetime.isoformat(),
                    "files_changed": len(commit.stats.files),
                }
            )

        # Store in cache
        if cache_cfg.get("enabled", True):
            cache_service.set(
                cache_key, commits, int(cache_cfg.get("ttl_seconds", 600))
            )

        return commits

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get commits: {str(e)}",
        )


@router.post("/commits")
async def create_commit(
    repo_id: int,
    request: GitCommitRequest,
    current_user: str = Depends(get_current_username),
):
    """Commit changes to Git repository."""
    try:
        repo = get_git_repo_by_id(repo_id)

        # Add files
        if request.files:
            for file_path in request.files:
                repo.index.add([file_path])
        else:
            # Add all changes
            repo.git.add(A=True)

        # Commit changes
        commit = repo.index.commit(request.message)

        return {
            "success": True,
            "commit_hash": commit.hexsha,
            "message": request.message,
            "files_committed": len(commit.stats.files),
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to commit changes: {str(e)}",
        )


@router.get("/commits/{commit_hash}/diff")
async def get_commit_diff(
    repo_id: int, commit_hash: str, current_user: str = Depends(get_current_username)
):
    """Get diff for a specific commit."""
    try:
        repo = get_git_repo_by_id(repo_id)

        commit = repo.commit(commit_hash)

        # Get diff against parent (or empty tree if first commit)
        if commit.parents:
            diff = commit.parents[0].diff(commit, create_patch=True)
        else:
            diff = commit.diff(
                repo.git.hash_object("-t", "tree", "/dev/null"), create_patch=True
            )

        diffs = []
        for d in diff:
            diffs.append(
                {
                    "file": d.a_path or d.b_path,
                    "change_type": d.change_type,
                    "diff": str(d) if d.create_patch else "",
                }
            )

        return {
            "commit": {
                "hash": commit.hexsha[:8],
                "message": commit.message.strip(),
                "author": str(commit.author),
                "date": commit.committed_datetime.isoformat(),
            },
            "diffs": diffs,
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get diff: {str(e)}",
        )


@router.post("/diff")
async def compare_commits(
    repo_id: int, request: dict, current_user: str = Depends(get_current_username)
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

        # Get the commits
        commit_obj1 = repo.commit(commit1)
        commit_obj2 = repo.commit(commit2)

        # Get file content from both commits
        try:
            file_content1 = (
                (commit_obj1.tree / file_path).data_stream.read().decode("utf-8")
            )
        except KeyError:
            file_content1 = ""

        try:
            file_content2 = (
                (commit_obj2.tree / file_path).data_stream.read().decode("utf-8")
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

        # Prepare full file content for comparison display
        file1_lines = []
        file2_lines = []

        lines1_list = file_content1.splitlines()
        lines2_list = file_content2.splitlines()

        # Use difflib.SequenceMatcher to get line-by-line comparison
        matcher = difflib.SequenceMatcher(None, lines1_list, lines2_list)

        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == "equal":
                for i in range(i1, i2):
                    file1_lines.append(
                        {
                            "line_number": i + 1,
                            "content": lines1_list[i],
                            "type": "equal",
                        }
                    )
                for j in range(j1, j2):
                    file2_lines.append(
                        {
                            "line_number": j + 1,
                            "content": lines2_list[j],
                            "type": "equal",
                        }
                    )
            elif tag == "delete":
                for i in range(i1, i2):
                    file1_lines.append(
                        {
                            "line_number": i + 1,
                            "content": lines1_list[i],
                            "type": "delete",
                        }
                    )
            elif tag == "insert":
                for j in range(j1, j2):
                    file2_lines.append(
                        {
                            "line_number": j + 1,
                            "content": lines2_list[j],
                            "type": "insert",
                        }
                    )
            elif tag == "replace":
                for i in range(i1, i2):
                    file1_lines.append(
                        {
                            "line_number": i + 1,
                            "content": lines1_list[i],
                            "type": "replace",
                        }
                    )
                for j in range(j1, j2):
                    file2_lines.append(
                        {
                            "line_number": j + 1,
                            "content": lines2_list[j],
                            "type": "replace",
                        }
                    )

        return {
            "commit1": commit1[:8],
            "commit2": commit2[:8],
            "file_path": file_path,
            "diff_lines": diff_lines,  # Keep for backward compatibility
            "left_file": f"{file_path} ({commit1[:8]})",
            "right_file": f"{file_path} ({commit2[:8]})",
            "left_lines": file1_lines,
            "right_lines": file2_lines,
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
            detail=f"Failed to compare commits: {str(e)}",
        )
