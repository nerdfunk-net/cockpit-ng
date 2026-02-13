"""
Git file operations router - File-specific operations like listing, search, and history.
Handles file content, history, and comparison operations across Git repositories.
"""

from __future__ import annotations
import logging
import os
import fnmatch

import yaml
from fastapi import APIRouter, Depends, HTTPException, status
from git import InvalidGitRepositoryError, GitCommandError

from core.auth import require_permission
from services.settings.cache import cache_service
from services.settings.git.paths import repo_path as git_repo_path
from services.settings.git.shared_utils import get_git_repo_by_id, git_repo_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/git/{repo_id}", tags=["git-files"])


@router.get("/files/search")
async def search_repository_files(
    repo_id: int,
    query: str = "",
    limit: int = 50,
    current_user: dict = Depends(require_permission("git.repositories", "read")),
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
    current_user: dict = Depends(require_permission("git.repositories", "read")),
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
    repo_id: int,
    file_path: str,
    current_user: dict = Depends(require_permission("git.repositories", "read")),
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
    current_user: dict = Depends(require_permission("git.repositories", "read")),
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


@router.get("/file-content")
async def get_file_content(
    repo_id: int,
    path: str,
    current_user: dict = Depends(require_permission("git.repositories", "read")),
):
    """Read the content of a file from a Git repository.

    Args:
        repo_id: Git repository ID
        path: Relative path to the file within the repository
        current_user: Current authenticated user

    Returns:
        Plain text content of the file
    """
    try:
        # Get repository details
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")

        # Resolve repository working directory
        repo_path = git_repo_path(repository)

        if not os.path.exists(repo_path):
            raise HTTPException(
                status_code=404,
                detail=f"Repository directory not found: {repo_path}",
            )

        # Construct full file path
        file_path = os.path.join(repo_path, path)

        # Security check: ensure the file is within the repository
        file_path_resolved = os.path.realpath(file_path)
        repo_path_resolved = os.path.realpath(repo_path)

        if not file_path_resolved.startswith(repo_path_resolved):
            raise HTTPException(
                status_code=403,
                detail="Access denied: file path is outside repository",
            )

        # Check if file exists
        if not os.path.exists(file_path_resolved):
            raise HTTPException(
                status_code=404,
                detail=f"File not found: {path}",
            )

        # Check if it's a file (not a directory)
        if not os.path.isfile(file_path_resolved):
            raise HTTPException(
                status_code=400,
                detail=f"Path is not a file: {path}",
            )

        # Read file content
        try:
            with open(file_path_resolved, "r", encoding="utf-8") as f:
                content = f.read()
        except UnicodeDecodeError:
            # If file is binary, return error
            raise HTTPException(
                status_code=400,
                detail=f"File is not a text file: {path}",
            )

        logger.info(
            f"User {current_user.get('username')} read file {path} from repository {repository['name']}"
        )

        # Return plain text content
        from fastapi.responses import PlainTextResponse

        return PlainTextResponse(content=content)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reading file content: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error reading file content: {str(e)}",
        )


@router.get("/file-content-parsed")
async def get_file_content_parsed(
    repo_id: int,
    path: str,
    current_user: dict = Depends(require_permission("git.repositories", "read")),
):
    """Read a YAML file from a Git repository and return parsed JSON.

    Reuses the same security checks (path traversal protection, repo validation)
    as get_file_content, then parses with yaml.safe_load.

    Args:
        repo_id: Git repository ID
        path: Relative path to the YAML file within the repository
        current_user: Current authenticated user

    Returns:
        JSON with parsed data and file path
    """
    try:
        # Get repository details
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")

        # Resolve repository working directory
        repo_path = git_repo_path(repository)

        if not os.path.exists(repo_path):
            raise HTTPException(
                status_code=404,
                detail="Repository directory not found",
            )

        # Construct full file path
        file_path = os.path.join(repo_path, path)

        # Security check: ensure the file is within the repository
        file_path_resolved = os.path.realpath(file_path)
        repo_path_resolved = os.path.realpath(repo_path)

        if not file_path_resolved.startswith(repo_path_resolved):
            raise HTTPException(
                status_code=403,
                detail="Access denied: file path is outside repository",
            )

        if not os.path.exists(file_path_resolved):
            raise HTTPException(status_code=404, detail="File not found: %s" % path)

        if not os.path.isfile(file_path_resolved):
            raise HTTPException(status_code=400, detail="Path is not a file: %s" % path)

        # Read file content
        try:
            with open(file_path_resolved, "r", encoding="utf-8") as f:
                content = f.read()
        except UnicodeDecodeError:
            raise HTTPException(
                status_code=400,
                detail="File is not a text file: %s" % path,
            )

        # Parse YAML content
        try:
            parsed = yaml.safe_load(content)
        except yaml.YAMLError as e:
            raise HTTPException(
                status_code=400,
                detail="YAML parse error: %s" % str(e),
            )

        logger.info(
            "User %s parsed YAML file %s from repository %s",
            current_user.get("username"),
            path,
            repository["name"],
        )

        return {"parsed": parsed, "file_path": path}

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error parsing YAML file content: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error parsing file content: %s" % str(e),
        )


@router.get("/tree")
async def get_directory_tree(
    repo_id: int,
    path: str = "",
    current_user: dict = Depends(require_permission("git.repositories", "read")),
):
    """Get hierarchical directory structure of a Git repository.

    Args:
        repo_id: Git repository ID
        path: Optional path to get subtree (default: root)
        current_user: Current authenticated user

    Returns:
        Hierarchical tree structure with directories and file counts
    """
    try:
        # Get repository details
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")

        # Resolve repository working directory
        repo_path = str(git_repo_path(repository))

        if not os.path.exists(repo_path):
            return {
                "name": "root",
                "path": "",
                "type": "directory",
                "children": [],
                "repository_name": repository["name"],
            }

        # Resolve the target path
        target_path = os.path.join(repo_path, path) if path else repo_path

        # Security check: ensure the path is within the repository
        target_path_resolved = os.path.realpath(target_path)
        repo_path_resolved = os.path.realpath(repo_path)

        if not target_path_resolved.startswith(repo_path_resolved):
            raise HTTPException(
                status_code=403,
                detail="Access denied: path is outside repository",
            )

        if not os.path.exists(target_path_resolved):
            raise HTTPException(
                status_code=404,
                detail=f"Path not found: {path}",
            )

        if not os.path.isdir(target_path_resolved):
            raise HTTPException(
                status_code=400,
                detail=f"Path is not a directory: {path}",
            )

        def build_tree(dir_path: str, rel_path: str = "") -> dict:
            """Recursively build directory tree structure."""
            children = []

            try:
                items = os.listdir(dir_path)
            except PermissionError:
                logger.warning(f"Permission denied accessing directory: {dir_path}")
                return None

            # Separate directories and files
            dirs = []
            files = []

            for item in items:
                # Skip hidden files and .git directory
                if item.startswith("."):
                    continue

                item_path = os.path.join(dir_path, item)
                item_rel_path = os.path.join(rel_path, item) if rel_path else item

                if os.path.isdir(item_path):
                    dirs.append((item, item_path, item_rel_path))
                elif os.path.isfile(item_path):
                    files.append(item)

            # Sort directories alphabetically
            dirs.sort(key=lambda x: x[0].lower())

            # Process directories recursively
            for dir_name, dir_full_path, dir_rel_path in dirs:
                subtree = build_tree(dir_full_path, dir_rel_path)
                if subtree:  # Only add if we had permission to read it
                    children.append(subtree)

            # Build the current node
            node_name = os.path.basename(dir_path) if rel_path else "root"

            return {
                "name": node_name,
                "path": rel_path,
                "type": "directory",
                "file_count": len(files),
                "children": children,
            }

        # Build tree starting from target path
        tree = build_tree(target_path_resolved, path)

        if tree is None:
            raise HTTPException(
                status_code=403,
                detail="Permission denied accessing directory",
            )

        # Add repository name to root node
        tree["repository_name"] = repository["name"]

        return tree

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error building directory tree: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error building directory tree: {str(e)}",
        )


@router.get("/directory")
async def get_directory_files(
    repo_id: int,
    path: str = "",
    current_user: dict = Depends(require_permission("git.repositories", "read")),
):
    """Get files in a specific directory with last commit metadata.

    Args:
        repo_id: Git repository ID
        path: Directory path (default: root)
        current_user: Current authenticated user

    Returns:
        List of files with last commit information
    """
    try:
        # Get repository details
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")

        # Get Git repository
        repo = get_git_repo_by_id(repo_id)

        # Resolve repository working directory
        repo_path = str(git_repo_path(repository))

        if not os.path.exists(repo_path):
            return {
                "path": path,
                "files": [],
                "directory_exists": False,
            }

        # Resolve the target path
        target_path = os.path.join(repo_path, path) if path else repo_path

        # Security check: ensure the path is within the repository
        target_path_resolved = os.path.realpath(target_path)
        repo_path_resolved = os.path.realpath(repo_path)

        if not target_path_resolved.startswith(repo_path_resolved):
            raise HTTPException(
                status_code=403,
                detail="Access denied: path is outside repository",
            )

        if not os.path.exists(target_path_resolved):
            return {
                "path": path,
                "files": [],
                "directory_exists": False,
            }

        if not os.path.isdir(target_path_resolved):
            raise HTTPException(
                status_code=400,
                detail=f"Path is not a directory: {path}",
            )

        # List files in directory (not subdirectories)
        files_data = []

        try:
            items = os.listdir(target_path_resolved)
        except PermissionError:
            raise HTTPException(
                status_code=403,
                detail="Permission denied accessing directory",
            )

        for item in items:
            # Skip hidden files
            if item.startswith("."):
                continue

            item_path = os.path.join(target_path_resolved, item)

            # Only process files, not directories
            if not os.path.isfile(item_path):
                continue

            # Get file stats
            file_size = os.path.getsize(item_path)

            # Calculate relative path from repository root
            file_rel_path = os.path.join(path, item) if path else item

            # Get last commit for this file
            try:
                commits = list(repo.iter_commits(paths=file_rel_path, max_count=1))

                if commits:
                    last_commit = commits[0]
                    commit_info = {
                        "hash": last_commit.hexsha,
                        "short_hash": last_commit.hexsha[:8],
                        "message": last_commit.message.strip(),
                        "author": {
                            "name": last_commit.author.name,
                            "email": last_commit.author.email,
                        },
                        "date": last_commit.committed_datetime.isoformat(),
                        "timestamp": int(last_commit.committed_datetime.timestamp()),
                    }
                else:
                    # File exists but no commit history (shouldn't happen in a proper git repo)
                    commit_info = {
                        "hash": "",
                        "short_hash": "",
                        "message": "No commit history",
                        "author": {"name": "", "email": ""},
                        "date": "",
                        "timestamp": 0,
                    }
            except Exception as e:
                logger.warning(f"Failed to get commit info for {file_rel_path}: {e}")
                commit_info = {
                    "hash": "",
                    "short_hash": "",
                    "message": "Error fetching commit",
                    "author": {"name": "", "email": ""},
                    "date": "",
                    "timestamp": 0,
                }

            files_data.append(
                {
                    "name": item,
                    "path": file_rel_path,
                    "size": file_size,
                    "last_commit": commit_info,
                }
            )

        # Sort files alphabetically
        files_data.sort(key=lambda x: x["name"].lower())

        return {
            "path": path,
            "files": files_data,
            "directory_exists": True,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing directory files: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing directory files: {str(e)}",
        )
