"""Git file and directory listing — filename search, trees, and dir listings."""

from __future__ import annotations

import fnmatch
import logging
import os
from typing import Any, Dict

from fastapi import HTTPException, status

from services.git.path_containment import resolve_within_repo as _resolve_within_repo
from services.git.paths import repo_path as git_repo_path
from services.git.shared_utils import get_git_repo_by_id, git_repo_manager

logger = logging.getLogger(__name__)


class GitFileListService:
    """Listing operations on files within a managed Git repository."""

    def search_files(
        self,
        repo_id: int,
        query: str = "",
        limit: int = 50,
    ) -> Dict[str, Any]:
        """Scan directory, filter by query, sort by relevance, paginate."""
        try:
            repository = git_repo_manager.get_repository(repo_id)
            if not repository:
                raise HTTPException(status_code=404, detail="Repository not found")

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

            structured_files = []

            for root, _dirs, files in os.walk(repo_path):
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

            filtered_files = structured_files
            if query:
                query_lower = query.lower()
                filtered_files = []

                for file_info in structured_files:
                    if (
                        query_lower in file_info["name"].lower()
                        or query_lower in file_info["path"].lower()
                        or query_lower in file_info["directory"].lower()
                    ):
                        filtered_files.append(file_info)
                    elif fnmatch.fnmatch(
                        file_info["name"].lower(), f"*{query_lower}*"
                    ) or fnmatch.fnmatch(file_info["path"].lower(), f"*{query_lower}*"):
                        filtered_files.append(file_info)

            if query:

                def sort_key(item):
                    name_lower = item["name"].lower()
                    item["path"].lower()
                    query_lower = query.lower()

                    if name_lower == query_lower:
                        return (0, item["path"])
                    elif name_lower.startswith(query_lower):
                        return (1, item["path"])
                    elif query_lower in name_lower:
                        return (2, item["path"])
                    else:
                        return (3, item["path"])

                filtered_files.sort(key=sort_key)
            else:
                filtered_files.sort(key=lambda x: x["path"])

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
            logger.error("Error searching repository files: %s", e)
            return {"success": False, "message": "File search failed: %s" % str(e)}

    def get_directory_tree(
        self,
        repo_id: int,
        path: str = "",
    ) -> Dict[str, Any]:
        """Return nested directory tree for a commit."""
        try:
            repository = git_repo_manager.get_repository(repo_id)
            if not repository:
                raise HTTPException(status_code=404, detail="Repository not found")

            repo_path = str(git_repo_path(repository))

            if not os.path.exists(repo_path):
                return {
                    "name": "root",
                    "path": "",
                    "type": "directory",
                    "children": [],
                    "repository_name": repository["name"],
                }

            target_path_resolved = _resolve_within_repo(repo_path, path or "")

            if not os.path.exists(target_path_resolved):
                raise HTTPException(
                    status_code=404,
                    detail="Path not found: %s" % path,
                )

            if not os.path.isdir(target_path_resolved):
                raise HTTPException(
                    status_code=400,
                    detail="Path is not a directory: %s" % path,
                )

            def build_tree(dir_path: str, rel_path: str = "") -> dict:
                children = []

                try:
                    items = os.listdir(dir_path)
                except PermissionError:
                    logger.warning(
                        "Permission denied accessing directory: %s", dir_path
                    )
                    return None

                dirs = []
                files = []

                for item in items:
                    if item.startswith("."):
                        continue

                    item_path = os.path.join(dir_path, item)
                    item_rel_path = os.path.join(rel_path, item) if rel_path else item

                    if os.path.isdir(item_path):
                        dirs.append((item, item_path, item_rel_path))
                    elif os.path.isfile(item_path):
                        files.append(item)

                dirs.sort(key=lambda x: x[0].lower())

                for _dir_name, dir_full_path, dir_rel_path in dirs:
                    subtree = build_tree(dir_full_path, dir_rel_path)
                    if subtree:
                        children.append(subtree)

                node_name = os.path.basename(dir_path) if rel_path else "root"

                return {
                    "name": node_name,
                    "path": rel_path,
                    "type": "directory",
                    "file_count": len(files),
                    "children": children,
                }

            tree = build_tree(target_path_resolved, path)

            if tree is None:
                raise HTTPException(
                    status_code=403,
                    detail="Permission denied accessing directory",
                )

            tree["repository_name"] = repository["name"]

            return tree

        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error building directory tree: %s", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error building directory tree: %s" % str(e),
            )

    def get_directory_files(
        self,
        repo_id: int,
        path: str = "",
    ) -> Dict[str, Any]:
        """Return flat list of files in a specific directory."""
        try:
            repository = git_repo_manager.get_repository(repo_id)
            if not repository:
                raise HTTPException(status_code=404, detail="Repository not found")

            repo = get_git_repo_by_id(repo_id)
            repo_path = str(git_repo_path(repository))

            if not os.path.exists(repo_path):
                return {
                    "path": path,
                    "files": [],
                    "directory_exists": False,
                }

            target_path_resolved = _resolve_within_repo(repo_path, path or "")

            if not os.path.exists(target_path_resolved):
                return {
                    "path": path,
                    "files": [],
                    "directory_exists": False,
                }

            if not os.path.isdir(target_path_resolved):
                raise HTTPException(
                    status_code=400,
                    detail="Path is not a directory: %s" % path,
                )

            files_data = []

            try:
                items = os.listdir(target_path_resolved)
            except PermissionError:
                raise HTTPException(
                    status_code=403,
                    detail="Permission denied accessing directory",
                )

            for item in items:
                if item.startswith("."):
                    continue

                item_path = os.path.join(target_path_resolved, item)

                if not os.path.isfile(item_path):
                    continue

                file_size = os.path.getsize(item_path)
                file_rel_path = os.path.join(path, item) if path else item

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
                            "timestamp": int(
                                last_commit.committed_datetime.timestamp()
                            ),
                        }
                    else:
                        commit_info = {
                            "hash": "",
                            "short_hash": "",
                            "message": "No commit history",
                            "author": {"name": "", "email": ""},
                            "date": "",
                            "timestamp": 0,
                        }
                except Exception as e:
                    logger.warning(
                        "Failed to get commit info for %s: %s", file_rel_path, e
                    )
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

            files_data.sort(key=lambda x: x["name"].lower())

            return {
                "path": path,
                "files": files_data,
                "directory_exists": True,
            }

        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error listing directory files: %s", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error listing directory files: %s" % str(e),
            )
