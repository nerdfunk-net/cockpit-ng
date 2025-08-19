"""
Git router for repository management and version control operations.
"""

from __future__ import annotations
import difflib
import logging
import os
import shutil
from pathlib import Path
from typing import Dict, Any, Optional
from urllib.parse import urlparse
from fastapi import APIRouter, Depends, HTTPException, status
from git import Repo, InvalidGitRepositoryError, GitCommandError

from core.auth import verify_token
from models.git import GitCommitRequest, GitBranchRequest
from services.cache_service import cache_service
from services.git_utils import open_or_clone, repo_path, normalize_git_url

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/git", tags=["git"])


def get_git_repo():
    """Get Git repository instance for the selected config repository."""
    try:
        from settings_manager import settings_manager
        from git_repositories_manager import GitRepositoryManager

        # Get the selected repository from Git Management
        selected_id = settings_manager.get_selected_git_repository()
        if not selected_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No Git repository selected for configuration comparison. Please select a repository in Git Management."
            )

        # Get repository details
        git_repo_manager = GitRepositoryManager()
        repository = git_repo_manager.get_repository(selected_id)
        if not repository:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Selected Git repository not found. Please select a valid repository in Git Management."
            )

        if not repository['is_active']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected Git repository is inactive. Please activate it or select a different repository."
            )

        # Open the repository (or clone if needed) using shared utilities
        try:
            repo = open_or_clone(repository)
            return repo
        except Exception as e:
            logger.error(f"Failed to prepare repository {repository['name']}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to open/clone Git repository: {str(e)}"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting Git repository: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Git repository error: {str(e)}"
        )


@router.get("/status")
async def git_status(current_user: str = Depends(verify_token)):
    """Get Git repository status."""
    try:
        repo = get_git_repo()

        # Check if repository has any commits
        commits = []
        current_branch = None

        try:
            # Try to get current branch
            current_branch = repo.active_branch.name
        except Exception as e:
            logger.warning(f"Could not get active branch (repository may be empty): {e}")
            # For empty repositories, use default branch name
            current_branch = "main"

        # Get recent commits (needed by frontend)
        try:
            # Check if repository has any commits
            if repo.head.is_valid():
                for commit in repo.iter_commits(max_count=50):
                    commits.append({
                        "hash": commit.hexsha,
                        "short_hash": commit.hexsha[:7],
                        "message": commit.message.strip(),
                        "author": commit.author.name,
                        "date": commit.committed_datetime.isoformat(),
                        "timestamp": int(commit.committed_date)
                    })
            else:
                logger.info("Repository has no commits yet")
        except Exception as e:
            logger.warning(f"Could not fetch commits: {e}")

        # Get status (handle cases where repository is empty)
        try:
            is_dirty = repo.is_dirty()
            untracked_files = repo.untracked_files
            modified_files = [item.a_path for item in repo.index.diff(None)]
            staged_files = []

            # Only get staged files if repository has commits
            if repo.head.is_valid():
                staged_files = [item.a_path for item in repo.index.diff("HEAD")]
        except Exception as e:
            logger.warning(f"Could not get repository status details: {e}")
            is_dirty = False
            untracked_files = []
            modified_files = []
            staged_files = []

        status_info = {
            "current_branch": current_branch,  # Frontend expects this field name
            "branch": current_branch,  # Keep for backward compatibility
            "is_dirty": is_dirty,
            "untracked_files": untracked_files,
            "modified_files": modified_files,
            "staged_files": staged_files,
            "commits": commits  # Frontend needs this for Git Commits mode
        }

        return status_info
    except (InvalidGitRepositoryError, GitCommandError) as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Git repository not found or invalid: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Git status error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Git status error: {str(e)}"
        )


@router.post("/commit")
async def git_commit(
    request: GitCommitRequest,
    current_user: str = Depends(verify_token)
):
    """Commit changes to Git repository."""
    try:
        repo = get_git_repo()

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
            "files_committed": len(commit.stats.files)
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to commit changes: {str(e)}"
        )


@router.get("/branches")
async def git_branches(current_user: str = Depends(verify_token)):
    """Get list of Git branches."""
    try:
        repo = get_git_repo()

        branches = [branch.name for branch in repo.branches]
        return branches
    except (InvalidGitRepositoryError, GitCommandError) as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Git repository not found or invalid: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Git branches error: {str(e)}"
        )


@router.post("/branch")
async def git_branch(
    request: GitBranchRequest,
    current_user: str = Depends(verify_token)
):
    """Create or switch to a Git branch."""
    try:
        repo = get_git_repo()

        if request.create:
            # Create new branch
            new_branch = repo.create_head(request.branch_name)
            repo.head.reference = new_branch
            repo.head.reset(index=True, working_tree=True)
            return {"message": f"Created and switched to branch '{request.branch_name}'"}
        else:
            # Switch to existing branch
            repo.git.checkout(request.branch_name)
            return {"message": f"Switched to branch '{request.branch_name}'"}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to manage branch: {str(e)}"
        )


@router.get("/diff/{commit_hash}")
async def git_diff(
    commit_hash: str,
    current_user: str = Depends(verify_token)
):
    """Get diff for a specific commit."""
    try:
        repo = get_git_repo()

        commit = repo.commit(commit_hash)

        # Get diff against parent (or empty tree if first commit)
        if commit.parents:
            diff = commit.parents[0].diff(commit, create_patch=True)
        else:
            diff = commit.diff(repo.git.hash_object('-t', 'tree', '/dev/null'), create_patch=True)

        diffs = []
        for d in diff:
            diffs.append({
                "file": d.a_path or d.b_path,
                "change_type": d.change_type,
                "diff": str(d) if d.create_patch else ""
            })

        return {
            "commit": {
                "hash": commit.hexsha[:8],
                "message": commit.message.strip(),
                "author": str(commit.author),
                "date": commit.committed_datetime.isoformat()
            },
            "diffs": diffs
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get diff: {str(e)}"
        )


@router.get("/commits/{branch_name}")
async def git_commits(
    branch_name: str,
    current_user: str = Depends(verify_token)
):
    """Get commits for a specific branch."""
    try:
        from settings_manager import settings_manager
        cache_cfg = settings_manager.get_cache_settings()
        selected_id = settings_manager.get_selected_git_repository()
        repo = get_git_repo()

        # Check if branch exists
        if branch_name not in [ref.name for ref in repo.refs]:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Branch '{branch_name}' not found"
            )

        # Try cache first
        repo_scope = f"repo:{selected_id}" if selected_id else "repo:default"
        cache_key = f"{repo_scope}:commits:{branch_name}"
        if cache_cfg.get('enabled', True):
            cached = cache_service.get(cache_key)
            if cached is not None:
                return cached

        # Get commits from the branch (respect max_commits)
        limit = int(cache_cfg.get('max_commits', 500))
        commits = []
        for commit in repo.iter_commits(branch_name, max_count=limit):
            commits.append({
                "hash": commit.hexsha,
                "short_hash": commit.hexsha[:8],
                "message": commit.message.strip(),
                "author": {
                    "name": commit.author.name,
                    "email": commit.author.email
                },
                "date": commit.committed_datetime.isoformat(),
                "files_changed": len(commit.stats.files)
            })

        # Store in cache
        if cache_cfg.get('enabled', True):
            cache_service.set(cache_key, commits, int(cache_cfg.get('ttl_seconds', 600)))

        return commits

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get commits: {str(e)}"
        )

@router.get("/files/{commit_hash}")
async def git_files(
    commit_hash: str,
    file_path: str = None,
    current_user: str = Depends(verify_token)
):
    """Get list of files in a specific commit or file content if file_path is provided."""
    try:
        repo = get_git_repo()

        # Get the commit
        commit = repo.commit(commit_hash)

        # If file_path is provided, return file content
        if file_path:
            try:
                file_content = (commit.tree / file_path).data_stream.read().decode('utf-8')
                return {
                    "file_path": file_path,
                    "content": file_content,
                    "commit": commit_hash[:8]
                }
            except KeyError:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"File '{file_path}' not found in commit {commit_hash[:8]}"
                )

        # Otherwise, return list of files
        files = []
        for item in commit.tree.traverse():
            if item.type == 'blob':  # Only files, not directories
                files.append(item.path)

        # Filter for configuration files based on allowed extensions
        from config import settings
        config_extensions = settings.allowed_file_extensions
        config_files = [
            f for f in files 
            if any(f.endswith(ext) for ext in config_extensions)
        ]
        return sorted(config_files)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get files: {str(e)}"
        )


@router.post("/diff")
async def git_diff_compare(
    request: dict,
    current_user: str = Depends(verify_token)
):
    """Compare files between two Git commits."""
    try:
        commit1 = request.get("commit1")
        commit2 = request.get("commit2") 
        file_path = request.get("file_path")

        if not all([commit1, commit2, file_path]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required parameters: commit1, commit2, file_path"
            )

        repo = get_git_repo()

        # Get the commits
        commit_obj1 = repo.commit(commit1)
        commit_obj2 = repo.commit(commit2)

        # Get file content from both commits
        try:
            file_content1 = (commit_obj1.tree / file_path).data_stream.read().decode('utf-8')
        except KeyError:
            file_content1 = ""

        try:
            file_content2 = (commit_obj2.tree / file_path).data_stream.read().decode('utf-8')
        except KeyError:
            file_content2 = ""

        # Generate diff
        diff_lines = []

        lines1 = file_content1.splitlines(keepends=True)
        lines2 = file_content2.splitlines(keepends=True)

        for line in difflib.unified_diff(lines1, lines2, n=3):
            diff_lines.append(line.rstrip('\n'))

        # Calculate stats
        additions = sum(1 for line in diff_lines if line.startswith('+') and not line.startswith('+++'))
        deletions = sum(1 for line in diff_lines if line.startswith('-') and not line.startswith('---'))

        # Prepare full file content for comparison display
        file1_lines = []
        file2_lines = []

        lines1_list = file_content1.splitlines()
        lines2_list = file_content2.splitlines()

        # Use difflib.SequenceMatcher to get line-by-line comparison
        matcher = difflib.SequenceMatcher(None, lines1_list, lines2_list)

        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == 'equal':
                for i in range(i1, i2):
                    file1_lines.append({"line_number": i + 1, "content": lines1_list[i], "type": "equal"})
                for j in range(j1, j2):
                    file2_lines.append({"line_number": j + 1, "content": lines2_list[j], "type": "equal"})
            elif tag == 'delete':
                for i in range(i1, i2):
                    file1_lines.append({"line_number": i + 1, "content": lines1_list[i], "type": "delete"})
            elif tag == 'insert':
                for j in range(j1, j2):
                    file2_lines.append({"line_number": j + 1, "content": lines2_list[j], "type": "insert"})
            elif tag == 'replace':
                for i in range(i1, i2):
                    file1_lines.append({"line_number": i + 1, "content": lines1_list[i], "type": "replace"})
                for j in range(j1, j2):
                    file2_lines.append({"line_number": j + 1, "content": lines2_list[j], "type": "replace"})

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
                "total_lines": len(diff_lines)
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compare commits: {str(e)}"
        )


@router.get("/file-history/{file_path:path}")
async def get_file_last_change(
    file_path: str,
    current_user: str = Depends(verify_token)
):
    """Get the last change information for a specific file."""
    try:
        repo = get_git_repo()

        # Get the commit history for the specific file
        commits = list(repo.iter_commits(paths=file_path, max_count=1))

        if not commits:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No commits found for file: {file_path}"
            )

        last_commit = commits[0]

        # Check if file exists in the last commit
        try:
            file_content = (last_commit.tree / file_path).data_stream.read().decode('utf-8')
            file_exists = True
        except:
            file_exists = False

        return {
            "file_path": file_path,
            "file_exists": file_exists,
            "last_commit": {
                "hash": last_commit.hexsha,
                "short_hash": last_commit.hexsha[:8],
                "message": last_commit.message.strip(),
                "author": {
                    "name": last_commit.author.name,
                    "email": last_commit.author.email
                },
                "committer": {
                    "name": last_commit.committer.name,
                    "email": last_commit.committer.email
                },
                "date": last_commit.committed_datetime.isoformat(),
                "timestamp": int(last_commit.committed_datetime.timestamp())
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get file history: {str(e)}"
        )


@router.get("/file-complete-history/{file_path:path}")
async def get_file_complete_history(file_path: str, from_commit: str = None, current_user: str = Depends(verify_token)):
    """Get the complete history of a file from a specific commit backwards to its creation."""
    try:
        from settings_manager import settings_manager
        cache_cfg = settings_manager.get_cache_settings()
        selected_id = settings_manager.get_selected_git_repository()
        repo = get_git_repo()
        # Cache key per file and starting point
        repo_scope = f"repo:{selected_id}" if selected_id else "repo:default"
        cache_key = f"{repo_scope}:filehistory:{from_commit or 'HEAD'}:{file_path}"
        if cache_cfg.get('enabled', True):
            cached = cache_service.get(cache_key)
            if cached is not None:
                return cached

        # Start from the specified commit or HEAD
        start_commit = from_commit if from_commit else "HEAD"

        # Get all commits that modified this file
        commits = list(repo.iter_commits(start_commit, paths=file_path))

        if not commits:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No commits found for file: {file_path}"
            )

        history_commits = []

        # If we have a specific from_commit, check if it's included in the results
        selected_commit_found = False
        if from_commit:
            for commit in commits:
                if (commit.hexsha == from_commit or 
                    commit.hexsha.startswith(from_commit) or
                    from_commit.startswith(commit.hexsha)):
                    selected_commit_found = True
                    break

        # If the selected commit is not found in the file history,
        # it means the commit exists but didn't modify the file
        # Add it to the beginning of the results for context
        if from_commit and not selected_commit_found:
            try:
                commit_obj = repo.commit(from_commit)
                # Check if file exists in this commit
                try:
                    commit_obj.tree[file_path]
                    # File exists in this commit, add it as context
                    history_commits.append({
                        "hash": commit_obj.hexsha,
                        "short_hash": commit_obj.hexsha[:8],
                        "message": commit_obj.message.strip(),
                        "author": {
                            "name": commit_obj.author.name,
                            "email": commit_obj.author.email
                        },
                        "date": commit_obj.committed_datetime.isoformat(),
                        "change_type": "N"  # No change to file (exists but not modified)
                    })
                except KeyError:
                    # File doesn't exist in this commit, skip it
                    pass
            except Exception:
                # If we can't get the commit, just continue
                pass

        # Process the commits that actually modified the file
        for i, commit in enumerate(commits):
            # Determine change type
            change_type = "M"  # Modified (default)

            if i == len(commits) - 1:
                # This is the first commit where the file appeared
                change_type = "A"  # Added
            else:
                # Check if the file was deleted in this commit
                try:
                    commit.tree[file_path]
                except KeyError:
                    change_type = "D"  # Deleted

            history_commits.append({
                "hash": commit.hexsha,
                "short_hash": commit.hexsha[:8],
                "message": commit.message.strip(),
                "author": {
                    "name": commit.author.name,
                    "email": commit.author.email
                },
                "date": commit.committed_datetime.isoformat(),
                "change_type": change_type
            })

        result = {
            "file_path": file_path,
            "from_commit": start_commit,
            "total_commits": len(history_commits),
            "commits": history_commits
        }
        if cache_cfg.get('enabled', True):
            cache_service.set(cache_key, result, int(cache_cfg.get('ttl_seconds', 600)))
        return result

    except (InvalidGitRepositoryError, GitCommandError) as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Git repository not found or commit not found: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Git file complete history error: {str(e)}"
        )


@router.get("/debug")
async def debug_git(current_user: str = Depends(verify_token)):
    """Debug Git setup."""
    try:
        repo = get_git_repo()
        return {
            "status": "success",
            "repo_path": repo.working_dir,
            "branch": repo.active_branch.name
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "error_type": type(e).__name__
        }


