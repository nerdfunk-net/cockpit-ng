"""
Git file operations router - File-specific operations like listing, search, and history.
Handles file content, history, and comparison operations across Git repositories.
"""

from __future__ import annotations
import logging
import os
import fnmatch

from fastapi import APIRouter, Depends, HTTPException, status
from git import InvalidGitRepositoryError, GitCommandError

from core.auth import get_current_username
from services.cache_service import cache_service
from services.git_utils import repo_path as git_repo_path
from services.git_shared_utils import get_git_repo_by_id, git_repo_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/git/{repo_id}", tags=["git-files"])




@router.get("/files/search")
async def search_repository_files(
    repo_id: int,
    query: str = "",
    limit: int = 50,
    current_user: str = Depends(get_current_username),
):
    """Search for files in a specific Git repository with filtering and pagination."""
    try:
        # Get repository details
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")

        # Resolve repository working directory
        repo_path = str(git_repo_path(repository))

        if not os.path.exists(repo_path):
            return {
                "success": True,
                "data": {
                    "files": [],
                    "total_count": 0,
                    "filtered_count": 0,
                    "query": query,
                    "repository_name": repository["name"],
                },
            }

        # Scan the repository directory for files
        structured_files = []

        for root, dirs, files in os.walk(repo_path):
            # Skip .git directory
            if ".git" in root:
                continue

            rel_root = os.path.relpath(root, repo_path)
            if rel_root == ".":
                rel_root = ""

            for file in files:
                if file.startswith("."):
                    continue

                full_path = os.path.join(rel_root, file) if rel_root else file
                file_info = {
                    "name": file,
                    "path": full_path,
                    "directory": rel_root,
                    "size": os.path.getsize(os.path.join(root, file))
                    if os.path.exists(os.path.join(root, file))
                    else 0,
                }
                structured_files.append(file_info)

        # Filter files based on query
        filtered_files = structured_files
        if query:
            query_lower = query.lower()
            filtered_files = []

            for file_info in structured_files:
                # Search in filename, path, and directory
                if (
                    query_lower in file_info["name"].lower()
                    or query_lower in file_info["path"].lower()
                    or query_lower in file_info["directory"].lower()
                ):
                    filtered_files.append(file_info)
                # Also support wildcard matching
                elif fnmatch.fnmatch(
                    file_info["name"].lower(), f"*{query_lower}*"
                ) or fnmatch.fnmatch(file_info["path"].lower(), f"*{query_lower}*"):
                    filtered_files.append(file_info)

        # Sort by relevance (exact matches first, then by path)
        if query:

            def sort_key(item):
                name_lower = item["name"].lower()
                item["path"].lower()
                query_lower = query.lower()

                # Exact filename match gets highest priority
                if name_lower == query_lower:
                    return (0, item["path"])
                # Filename starts with query
                elif name_lower.startswith(query_lower):
                    return (1, item["path"])
                # Filename contains query
                elif query_lower in name_lower:
                    return (2, item["path"])
                # Path contains query
                else:
                    return (3, item["path"])

            filtered_files.sort(key=sort_key)
        else:
            # No query, sort alphabetically by path
            filtered_files.sort(key=lambda x: x["path"])

        # Apply pagination
        paginated_files = filtered_files[:limit]

        return {
            "success": True,
            "data": {
                "files": paginated_files,
                "total_count": len(structured_files),
                "filtered_count": len(filtered_files),
                "query": query,
                "repository_name": repository["name"],
                "has_more": len(filtered_files) > limit,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error searching repository files: {e}")
        return {"success": False, "message": f"File search failed: {str(e)}"}


@router.get("/files/{commit_hash}/commit")
async def get_files(
    repo_id: int,
    commit_hash: str,
    file_path: str = None,
    current_user: str = Depends(get_current_username),
):
    """Get list of files in a specific commit or file content if file_path is provided."""
    try:
        repo = get_git_repo_by_id(repo_id)

        # Get the commit
        commit = repo.commit(commit_hash)

        # If file_path is provided, return file content
        if file_path:
            try:
                file_content = (
                    (commit.tree / file_path).data_stream.read().decode("utf-8")
                )
                return {
                    "file_path": file_path,
                    "content": file_content,
                    "commit": commit_hash[:8],
                }
            except KeyError:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"File '{file_path}' not found in commit {commit_hash[:8]}",
                )

        # Otherwise, return list of files
        files = []
        for item in commit.tree.traverse():
            if item.type == "blob":  # Only files, not directories
                files.append(item.path)

        # Filter for configuration files based on allowed extensions
        from config import settings

        config_extensions = settings.allowed_file_extensions
        config_files = [
            f for f in files if any(f.endswith(ext) for ext in config_extensions)
        ]
        return sorted(config_files)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get files: {str(e)}",
        )


@router.get("/files/{file_path:path}/history")
async def get_file_history(
    repo_id: int, file_path: str, current_user: str = Depends(get_current_username)
):
    """Get the last change information for a specific file."""
    try:
        repo = get_git_repo_by_id(repo_id)

        # Get the commit history for the specific file
        commits = list(repo.iter_commits(paths=file_path, max_count=1))

        if not commits:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No commits found for file: {file_path}",
            )

        last_commit = commits[0]

        # Check if file exists in the last commit
        try:
            (last_commit.tree / file_path).data_stream.read().decode("utf-8")
            file_exists = True
        except (KeyError, AttributeError, UnicodeDecodeError, OSError):
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
                    "email": last_commit.author.email,
                },
                "committer": {
                    "name": last_commit.committer.name,
                    "email": last_commit.committer.email,
                },
                "date": last_commit.committed_datetime.isoformat(),
                "timestamp": int(last_commit.committed_datetime.timestamp()),
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get file history: {str(e)}",
        )


@router.get("/files/{file_path:path}/complete-history")
async def get_file_complete_history(
    repo_id: int,
    file_path: str,
    from_commit: str = None,
    current_user: str = Depends(get_current_username),
):
    """Get the complete history of a file from a specific commit backwards to its creation."""
    try:
        from settings_manager import settings_manager

        cache_cfg = settings_manager.get_cache_settings()
        repo = get_git_repo_by_id(repo_id)
        
        # Cache key per file and starting point
        repo_scope = f"repo:{repo_id}"
        cache_key = f"{repo_scope}:filehistory:{from_commit or 'HEAD'}:{file_path}"
        if cache_cfg.get("enabled", True):
            cached = cache_service.get(cache_key)
            if cached is not None:
                return cached

        # Start from the specified commit or HEAD
        start_commit = from_commit if from_commit else "HEAD"

        # Get all commits that modified this file
        commits = list(repo.iter_commits(start_commit, paths=file_path))

        if not commits:
            # Check if file exists in the latest commit (HEAD)
            try:
                head_commit = repo.head.commit
                head_commit.tree[file_path]
                # File exists in HEAD but not in the specified start_commit
                # This means it's a new file - get its history from HEAD instead
                commits = list(repo.iter_commits("HEAD", paths=file_path))
                if not commits:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"No commits found for file: {file_path}",
                    )
            except (KeyError, AttributeError):
                # File doesn't exist in HEAD either
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"File not found: {file_path}",
                )

        history_commits = []

        # If we have a specific from_commit, check if it's included in the results
        selected_commit_found = False
        if from_commit:
            for commit in commits:
                if (
                    commit.hexsha == from_commit
                    or commit.hexsha.startswith(from_commit)
                    or from_commit.startswith(commit.hexsha)
                ):
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
                    history_commits.append(
                        {
                            "hash": commit_obj.hexsha,
                            "short_hash": commit_obj.hexsha[:8],
                            "message": commit_obj.message.strip(),
                            "author": {
                                "name": commit_obj.author.name,
                                "email": commit_obj.author.email,
                            },
                            "date": commit_obj.committed_datetime.isoformat(),
                            "change_type": "N",  # No change to file (exists but not modified)
                        }
                    )
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

            history_commits.append(
                {
                    "hash": commit.hexsha,
                    "short_hash": commit.hexsha[:8],
                    "message": commit.message.strip(),
                    "author": {
                        "name": commit.author.name,
                        "email": commit.author.email,
                    },
                    "date": commit.committed_datetime.isoformat(),
                    "change_type": change_type,
                }
            )

        result = {
            "file_path": file_path,
            "from_commit": start_commit,
            "total_commits": len(history_commits),
            "commits": history_commits,
        }
        if cache_cfg.get("enabled", True):
            cache_service.set(cache_key, result, int(cache_cfg.get("ttl_seconds", 600)))
        return result

    except (InvalidGitRepositoryError, GitCommandError) as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Git repository not found or commit not found: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Git file complete history error: {str(e)}",
        )


