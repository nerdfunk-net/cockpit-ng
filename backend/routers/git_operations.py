"""
Git repository operations router - Repository sync, status, and management operations.
Handles syncing, status checking, and operational tasks for Git repositories.
"""

from __future__ import annotations
import logging
import os
import shutil
import subprocess
import time
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, status
from git import GitCommandError, Repo

from core.auth import require_permission
from services.cache_service import cache_service
from services.git_utils import (
    repo_path as git_repo_path,
    add_auth_to_url,
    set_ssl_env,
    resolve_git_credentials,
)
from services.git_shared_utils import get_git_repo_by_id, git_repo_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/git/{repo_id}", tags=["git-operations"])


def get_cached_commits(repo_id: int, branch_name: str, repo_path: str, limit: int = 50):
    """
    Get commits for a repository using cache when available, fallback to subprocess.
    Uses consistent cache key format across all git operations.
    """
    try:
        # Get cache configuration
        from settings_manager import settings_manager

        cache_cfg = settings_manager.get_cache_settings()

        # Try cache first if enabled
        repo_scope = f"repo:{repo_id}"
        cache_key = f"{repo_scope}:commits:{branch_name}"

        if cache_cfg.get("enabled", True):
            cached_commits = cache_service.get(cache_key)
            if cached_commits is not None:
                # Return limited commits from cache
                logger.debug(
                    f"Using cached commits for repo {repo_id}, branch {branch_name}"
                )
                return cached_commits[:limit]

        # Cache miss or disabled - fetch using GitPython for consistency
        try:
            repo = Repo(repo_path)

            commits = []
            for commit in repo.iter_commits(branch_name, max_count=limit):
                commits.append(
                    {
                        "hash": commit.hexsha,
                        "short_hash": commit.hexsha[:8],
                        "message": commit.message.strip(),
                        "author": commit.author.name,
                        "date": commit.committed_datetime.isoformat(),
                    }
                )

            # Store in cache if enabled
            if cache_cfg.get("enabled", True):
                # Use max_commits from config for full cache entry
                max_commits = int(cache_cfg.get("max_commits", 500))
                if len(commits) < max_commits:
                    # Fetch full commit list for cache
                    full_commits = []
                    for commit in repo.iter_commits(branch_name, max_count=max_commits):
                        full_commits.append(
                            {
                                "hash": commit.hexsha,
                                "short_hash": commit.hexsha[:8],
                                "message": commit.message.strip(),
                                "author": commit.author.name,
                                "date": commit.committed_datetime.isoformat(),
                            }
                        )

                    ttl = int(cache_cfg.get("ttl_seconds", 600))
                    cache_service.set(cache_key, full_commits, ttl)
                    logger.debug(
                        f"Cached {len(full_commits)} commits for repo {repo_id}, branch {branch_name}"
                    )

            return commits

        except Exception as git_error:
            # Fallback to subprocess if GitPython fails
            logger.warning(
                f"GitPython failed for repo {repo_id}, falling back to subprocess: {git_error}"
            )

            log = subprocess.run(
                [
                    "git",
                    "log",
                    "-n",
                    str(limit),
                    "--date=iso",
                    "--format=%H|%s|%an|%ad",
                ],
                cwd=repo_path,
                capture_output=True,
                text=True,
                timeout=10,
            )

            commits = []
            if log.returncode == 0 and log.stdout:
                for line in log.stdout.splitlines():
                    parts = line.split("|", 3)
                    if len(parts) == 4:
                        commits.append(
                            {
                                "hash": parts[0],
                                "short_hash": parts[0][:8],
                                "message": parts[1],
                                "author": parts[2],
                                "date": parts[3],
                            }
                        )

            return commits

    except Exception as e:
        logger.error(f"Failed to get commits for repo {repo_id}: {e}")
        return []


@router.get("/status")
async def get_repository_status(
    repo_id: int,
    current_user: dict = Depends(require_permission("git.operations", "execute")),
):
    """Get the status of a specific repository (exists, sync status, commit info)."""
    try:
        # Get repository details
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")

        # Resolve repository working directory
        repo_path = str(git_repo_path(repository))

        status_info = {
            "repository_name": repository["name"],
            "repository_url": repository["url"],
            "repository_branch": repository["branch"],
            "sync_status": repository.get("sync_status", "unknown"),
            "exists": os.path.exists(repo_path),
            "is_git_repo": False,
            "is_synced": False,
            "behind_count": 0,
            "ahead_count": 0,
            "current_commit": None,
            "current_branch": None,
            "last_commit_message": None,
            "last_commit_date": None,
            "branches": [],
            "commits": [],
            "config_files": [],
        }

        if status_info["exists"]:
            # Check if it's a valid Git repository
            try:
                result = subprocess.run(
                    ["git", "status", "--porcelain"],
                    cwd=repo_path,
                    capture_output=True,
                    text=True,
                    timeout=10,
                )
                if result.returncode == 0:
                    status_info["is_git_repo"] = True

                    # Get current branch name
                    try:
                        br = subprocess.run(
                            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
                            cwd=repo_path,
                            capture_output=True,
                            text=True,
                            timeout=5,
                        )
                        if br.returncode == 0:
                            status_info["current_branch"] = (br.stdout or "").strip()
                    except Exception as e:
                        logger.warning(f"Could not get current branch: {e}")

                    # Get current commit info
                    try:
                        commit_result = subprocess.run(
                            ["git", "log", "-1", "--format=%H|%s|%ai|%an|%ae"],
                            cwd=repo_path,
                            capture_output=True,
                            text=True,
                            timeout=10,
                        )
                        if (
                            commit_result.returncode == 0
                            and commit_result.stdout.strip()
                        ):
                            commit_info = commit_result.stdout.strip().split("|", 4)
                            if len(commit_info) >= 5:
                                status_info["current_commit"] = commit_info[0][
                                    :8
                                ]  # Short hash
                                status_info["last_commit_message"] = commit_info[1]
                                status_info["last_commit_date"] = commit_info[2]
                                status_info["last_commit_author"] = commit_info[3]
                                status_info["last_commit_author_email"] = commit_info[4]
                    except Exception as e:
                        logger.warning(f"Could not get commit info: {e}")

                    # Get list of branches
                    try:
                        brs = subprocess.run(
                            ["git", "branch", "--format=%(refname:short)"],
                            cwd=repo_path,
                            capture_output=True,
                            text=True,
                            timeout=5,
                        )
                        if brs.returncode == 0 and brs.stdout:
                            status_info["branches"] = [
                                b.strip().lstrip("* ").strip()
                                for b in brs.stdout.splitlines()
                                if b.strip()
                            ]
                    except Exception as e:
                        logger.warning(f"Could not list branches: {e}")

                    # Get recent commits using cache
                    try:
                        status_info["commits"] = get_cached_commits(
                            repo_id, repository["branch"], repo_path
                        )
                    except Exception as e:
                        logger.warning(f"Could not get recent commits: {e}")
                        status_info["commits"] = []

                    # Check if repository is synced with remote
                    try:
                        # Fetch latest remote refs (timeout quickly)
                        subprocess.run(
                            ["git", "fetch", "--dry-run"],
                            cwd=repo_path,
                            capture_output=True,
                            timeout=5,
                        )

                        # Check how many commits behind/ahead
                        behind_result = subprocess.run(
                            [
                                "git",
                                "rev-list",
                                "--count",
                                f"HEAD..origin/{repository['branch']}",
                            ],
                            cwd=repo_path,
                            capture_output=True,
                            text=True,
                            timeout=5,
                        )
                        if behind_result.returncode == 0:
                            status_info["behind_count"] = int(
                                behind_result.stdout.strip() or 0
                            )

                        ahead_result = subprocess.run(
                            [
                                "git",
                                "rev-list",
                                "--count",
                                f"origin/{repository['branch']}..HEAD",
                            ],
                            cwd=repo_path,
                            capture_output=True,
                            text=True,
                            timeout=5,
                        )
                        if ahead_result.returncode == 0:
                            status_info["ahead_count"] = int(
                                ahead_result.stdout.strip() or 0
                            )

                        status_info["is_synced"] = status_info["behind_count"] == 0

                    except Exception as e:
                        logger.warning(f"Could not check sync status: {e}")
                        # If we can't check sync status, assume it needs sync
                        status_info["is_synced"] = False

                    # Get list of configuration files
                    try:
                        for root, dirs, files in os.walk(repo_path):
                            # Skip .git directory
                            if ".git" in root:
                                continue

                            for file in files:
                                if not file.startswith("."):
                                    rel_path = os.path.relpath(
                                        os.path.join(root, file), repo_path
                                    )
                                    status_info["config_files"].append(rel_path)

                        # Sort files for consistency
                        status_info["config_files"].sort()

                    except Exception as e:
                        logger.warning(f"Could not scan config files: {e}")

            except Exception as e:
                logger.warning(f"Error checking Git repository status: {e}")

        return {"success": True, "data": status_info}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting repository status: {e}")
        return {
            "success": False,
            "message": f"Failed to get repository status: {str(e)}",
        }


@router.post("/sync")
async def sync_repository(
    repo_id: int,
    current_user: dict = Depends(require_permission("git.operations", "execute")),
):
    """Sync a git repository (clone if not exists, pull if exists)."""
    try:
        # Load repository
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")

        git_repo_manager.update_sync_status(repo_id, "syncing")

        # Compute repo path (uses configured 'path' or fallback to 'name')
        repo_path = str(git_repo_path(repository))

        logger.info(f"Syncing repository '{repository['name']}' to path: {repo_path}")
        logger.info(f"Repository URL: {repository['url']}")
        logger.info(f"Repository branch: {repository['branch']}")

        os.makedirs(os.path.dirname(repo_path), exist_ok=True)

        # Determine action: clone or pull
        repo_dir_exists = os.path.exists(repo_path)
        is_git_repo = os.path.isdir(os.path.join(repo_path, ".git"))
        needs_clone = not is_git_repo

        # Resolve credentials using the utility function
        resolved_username, resolved_token = resolve_git_credentials(repository)

        # Build clone URL (inject auth for http/https)
        clone_url = repository["url"]
        parsed = urlparse(repository["url"]) if repository.get("url") else None
        if parsed and parsed.scheme in ["http", "https"] and resolved_token:
            clone_url = add_auth_to_url(
                repository["url"], resolved_username, resolved_token
            )

        success = False
        message = ""

        if needs_clone:
            # Backup non-repo directory if present
            if repo_dir_exists and not is_git_repo:
                parent_dir = os.path.dirname(
                    repo_path.rstrip(os.sep)
                ) or os.path.dirname(repo_path)
                base_name = os.path.basename(os.path.normpath(repo_path))
                backup_path = os.path.join(
                    parent_dir, f"{base_name}_backup_{int(time.time())}"
                )
                shutil.move(repo_path, backup_path)
                logger.info(f"Backed up existing directory to {backup_path}")

            # SSL env toggle
            try:
                if not repository.get("verify_ssl", True):
                    logger.warning(
                        "Git SSL verification disabled - not recommended for production"
                    )
                with set_ssl_env(repository):
                    logger.info(
                        f"Cloning branch {repository['branch']} into {repo_path}"
                    )
                    Repo.clone_from(clone_url, repo_path, branch=repository["branch"])

                if not os.path.isdir(os.path.join(repo_path, ".git")):
                    raise GitCommandError(
                        "clone", 1, b"", b".git not found after clone"
                    )

                success = True
                message = f"Repository '{repository['name']}' cloned successfully to {repo_path}"
                logger.info(message)
            except GitCommandError as gce:
                err = str(gce)
                logger.error(f"Git clone failed: {err}")
                if "authentication" in err.lower():
                    message = (
                        "Authentication failed. Please check your Git credentials."
                    )
                elif "not found" in err.lower():
                    message = f"Repository or branch not found. URL: {repository['url']} Branch: {repository['branch']}"
                else:
                    message = f"Git clone failed: {err}"
            except Exception as e:
                logger.error(f"Unexpected error during Git clone: {e}")
                message = f"Unexpected error: {str(e)}"
            finally:
                # Cleanup empty directory after failed clone
                try:
                    if (
                        not success
                        and os.path.isdir(repo_path)
                        and not os.listdir(repo_path)
                    ):
                        shutil.rmtree(repo_path)
                        logger.info(
                            f"Removed empty directory after failed clone: {repo_path}"
                        )
                except Exception as ce:
                    logger.warning(f"Cleanup after failed clone skipped: {ce}")
        else:
            # Pull latest
            try:
                repo = Repo(repo_path)
                origin = repo.remotes.origin
                # Update remote URL with auth if needed
                if parsed and parsed.scheme in ["http", "https"] and resolved_token:
                    auth_url = add_auth_to_url(
                        repository["url"], resolved_username, resolved_token
                    )
                    try:
                        origin.set_url(auth_url)
                    except Exception as e:
                        logger.debug(f"Skipping remote URL update: {e}")

                with set_ssl_env(repository):
                    origin.pull(repository["branch"])
                    success = True
                    message = f"Repository '{repository['name']}' updated successfully"
                    logger.info(message)
            except Exception as e:
                logger.error(f"Error during Git pull: {e}")
                message = f"Pull failed: {str(e)}"

        # Final status
        if success:
            git_repo_manager.update_sync_status(repo_id, "synced")
            return {"success": True, "message": message, "repository_path": repo_path}
        else:
            git_repo_manager.update_sync_status(repo_id, f"error: {message}")
            raise HTTPException(status_code=500, detail=message)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error syncing repository {repo_id}: {e}")
        git_repo_manager.update_sync_status(repo_id, f"error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/remove-and-sync")
async def remove_and_sync_repository(
    repo_id: int,
    current_user: dict = Depends(require_permission("git.operations", "execute")),
):
    """Remove existing repository and clone fresh copy."""
    try:
        # Get repository details
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")

        git_repo_manager.update_sync_status(repo_id, "removing-and-syncing")

        # Resolve repository working directory
        repo_path = str(git_repo_path(repository))

        logger.info(
            f"Remove and sync repository '{repository['name']}' at path: {repo_path}"
        )

        # Remove existing directory if it exists
        if os.path.exists(repo_path):
            # Create backup with timestamp
            parent_dir = os.path.dirname(repo_path.rstrip(os.sep)) or os.path.dirname(
                repo_path
            )
            base_name = os.path.basename(os.path.normpath(repo_path))
            backup_path = os.path.join(
                parent_dir, f"{base_name}_removed_{int(time.time())}"
            )

            try:
                shutil.move(repo_path, backup_path)
                logger.info(f"Existing repository backed up to {backup_path}")
            except Exception as e:
                logger.warning(f"Could not backup existing repository: {e}")
                # Try to remove directly
                shutil.rmtree(repo_path, ignore_errors=True)
                logger.info(f"Removed existing repository at {repo_path}")

        # Ensure parent directory exists
        os.makedirs(os.path.dirname(repo_path), exist_ok=True)

        # Resolve credentials using the utility function
        resolved_username, resolved_token = resolve_git_credentials(repository)

        # Build clone URL (inject auth for http/https)
        clone_url = repository["url"]
        parsed = urlparse(repository["url"]) if repository.get("url") else None
        if parsed and parsed.scheme in ["http", "https"] and resolved_token:
            clone_url = add_auth_to_url(
                repository["url"], resolved_username, resolved_token
            )

        # Clone fresh copy
        success = False
        message = ""

        try:
            if not repository.get("verify_ssl", True):
                logger.warning(
                    "Git SSL verification disabled - not recommended for production"
                )

            with set_ssl_env(repository):
                logger.info(
                    f"Cloning fresh copy of branch {repository['branch']} into {repo_path}"
                )
                Repo.clone_from(clone_url, repo_path, branch=repository["branch"])

            if not os.path.isdir(os.path.join(repo_path, ".git")):
                raise GitCommandError("clone", 1, b"", b".git not found after clone")

            success = True
            message = (
                f"Repository '{repository['name']}' removed and re-cloned successfully"
            )
            logger.info(message)

        except GitCommandError as gce:
            err = str(gce)
            logger.error(f"Git clone failed: {err}")
            if "authentication" in err.lower():
                message = "Authentication failed. Please check your Git credentials."
            elif "not found" in err.lower():
                message = f"Repository or branch not found. URL: {repository['url']} Branch: {repository['branch']}"
            else:
                message = f"Git clone failed: {err}"
        except Exception as e:
            logger.error(f"Unexpected error during Git clone: {e}")
            message = f"Unexpected error: {str(e)}"
        finally:
            # Cleanup empty directory after failed clone
            try:
                if (
                    not success
                    and os.path.isdir(repo_path)
                    and not os.listdir(repo_path)
                ):
                    shutil.rmtree(repo_path)
                    logger.info(
                        f"Removed empty directory after failed clone: {repo_path}"
                    )
            except Exception as ce:
                logger.warning(f"Cleanup after failed clone skipped: {ce}")

        # Final status update
        if success:
            git_repo_manager.update_sync_status(repo_id, "synced")
            return {"success": True, "message": message, "repository_path": repo_path}
        else:
            git_repo_manager.update_sync_status(repo_id, f"error: {message}")
            raise HTTPException(status_code=500, detail=message)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing and syncing repository {repo_id}: {e}")
        git_repo_manager.update_sync_status(repo_id, f"error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/info")
async def get_repository_info(
    repo_id: int,
    current_user: dict = Depends(require_permission("git.operations", "execute")),
):
    """Get detailed information about a repository."""
    try:
        # Get repository metadata from DB
        repository = git_repo_manager.get_repository(repo_id)

        if not repository:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Repository with ID {repo_id} not found",
            )

        # Get git repository instance
        repo = get_git_repo_by_id(repo_id)

        # Collect repository statistics
        try:
            total_commits = sum(1 for _ in repo.iter_commits())
        except (AttributeError, OSError, ValueError):
            total_commits = 0

        try:
            total_branches = len(list(repo.branches))
        except (AttributeError, OSError):
            total_branches = 0

        try:
            current_branch = repo.active_branch.name if repo.active_branch else None
        except (AttributeError, TypeError):
            current_branch = None

        return {
            "id": repository["id"],
            "name": repository["name"],
            "category": repository["category"],
            "url": repository["url"],
            "branch": repository["branch"],
            "path": repository.get("path"),
            "is_active": repository["is_active"],
            "description": repository.get("description"),
            "created_at": repository.get("created_at"),
            "last_sync": repository.get("last_sync"),
            "sync_status": repository.get("sync_status"),
            "git_stats": {
                "current_branch": current_branch,
                "total_commits": total_commits,
                "total_branches": total_branches,
                "working_directory": repo.working_dir,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get repository info: {str(e)}",
        )


@router.get("/debug")
async def debug_git(
    repo_id: int,
    current_user: dict = Depends(require_permission("git.operations", "execute")),
):
    """Debug Git setup."""
    try:
        repo = get_git_repo_by_id(repo_id)
        return {
            "status": "success",
            "repo_path": repo.working_dir,
            "branch": repo.active_branch.name,
        }
    except Exception as e:
        return {"status": "error", "error": str(e), "error_type": type(e).__name__}
