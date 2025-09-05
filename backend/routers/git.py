"""
Consolidated Git router for repository management and version control operations.
Combines repository management (CRUD) and git operations (commits, branches, files).
"""

from __future__ import annotations
import difflib
import logging
import os
import shutil
import subprocess
import time
import fnmatch
from urllib.parse import urlparse
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from git import InvalidGitRepositoryError, GitCommandError, Repo

from core.auth import get_current_username, verify_admin_token
from models.git import GitCommitRequest, GitBranchRequest
from models.git_repositories import (
    GitRepositoryRequest,
    GitRepositoryResponse,
    GitRepositoryListResponse,
    GitRepositoryUpdateRequest,
    GitConnectionTestRequest,
    GitConnectionTestResponse,
    GitSyncRequest,
    GitSyncResponse,
)
from git_repositories_manager import GitRepositoryManager
from services.cache_service import cache_service
from services.git_utils import (
    open_or_clone,
    repo_path as git_repo_path,
    add_auth_to_url,
    set_ssl_env,
    resolve_git_credentials,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/git", tags=["git"])

# Initialize git repository manager
git_repo_manager = GitRepositoryManager()


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
                logger.debug(f"Using cached commits for repo {repo_id}, branch {branch_name}")
                return cached_commits[:limit]
        
        # Cache miss or disabled - fetch using GitPython for consistency
        try:
            repo = Repo(repo_path)
            
            commits = []
            for commit in repo.iter_commits(branch_name, max_count=limit):
                commits.append({
                    "hash": commit.hexsha,
                    "short_hash": commit.hexsha[:8],
                    "message": commit.message.strip(),
                    "author": commit.author.name,
                    "date": commit.committed_datetime.isoformat(),
                })
            
            # Store in cache if enabled
            if cache_cfg.get("enabled", True):
                # Use max_commits from config for full cache entry
                max_commits = int(cache_cfg.get("max_commits", 500))
                if len(commits) < max_commits:
                    # Fetch full commit list for cache
                    full_commits = []
                    for commit in repo.iter_commits(branch_name, max_count=max_commits):
                        full_commits.append({
                            "hash": commit.hexsha,
                            "short_hash": commit.hexsha[:8],
                            "message": commit.message.strip(),
                            "author": commit.author.name,
                            "date": commit.committed_datetime.isoformat(),
                        })
                    
                    ttl = int(cache_cfg.get("ttl_seconds", 600))
                    cache_service.set(cache_key, full_commits, ttl)
                    logger.debug(f"Cached {len(full_commits)} commits for repo {repo_id}, branch {branch_name}")
            
            return commits
            
        except Exception as git_error:
            # Fallback to subprocess if GitPython fails
            logger.warning(f"GitPython failed for repo {repo_id}, falling back to subprocess: {git_error}")
            
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
                        commits.append({
                            "hash": parts[0],
                            "short_hash": parts[0][:8],
                            "message": parts[1],
                            "author": parts[2],
                            "date": parts[3],
                        })
            
            return commits
            
    except Exception as e:
        logger.error(f"Failed to get commits for repo {repo_id}: {e}")
        return []


def get_git_repo_by_id(repo_id: int):
    """Get Git repository instance by ID (shared utility function)."""
    try:
        # Get repository details directly by ID
        repository = git_repo_manager.get_repository(repo_id)

        if not repository:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Git repository with ID {repo_id} not found.",
            )

        if not repository["is_active"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Git repository '{repository['name']}' is inactive. Please activate it first.",
            )

        # Open the repository (or clone if needed) using shared utilities
        try:
            repo = open_or_clone(repository)
            return repo
        except Exception as e:
            logger.error(f"Failed to prepare repository {repository['name']}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to open/clone Git repository: {str(e)}",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting Git repository {repo_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Git repository error: {str(e)}",
        )


# =============================================================================
# REPOSITORY MANAGEMENT ENDPOINTS
# =============================================================================

@router.get("/repositories", response_model=GitRepositoryListResponse)
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



@router.get("/repositories/{repo_id}", response_model=GitRepositoryResponse)
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


@router.get("/repositories/{repo_id}/edit")
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


@router.post("/repositories", response_model=GitRepositoryResponse)
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


@router.put("/repositories/{repo_id}", response_model=GitRepositoryResponse)
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


@router.delete("/repositories/{repo_id}")
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


# =============================================================================
# REPOSITORY OPERATIONS ENDPOINTS
# =============================================================================

@router.post("/repositories/test-connection", response_model=GitConnectionTestResponse)
async def test_git_connection(
    test_request: GitConnectionTestRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Test git repository connection."""
    try:
        # Import git functionality
        import tempfile
        from pathlib import Path

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


@router.get("/repositories/{repo_id}/status")
async def get_repository_status(
    repo_id: int, current_user: str = Depends(get_current_username)
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
                        if commit_result.returncode == 0 and commit_result.stdout.strip():
                            commit_info = commit_result.stdout.strip().split("|", 4)
                            if len(commit_info) >= 5:
                                status_info["current_commit"] = commit_info[0][:8]  # Short hash
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


@router.post("/repositories/{repo_id}/sync")
async def sync_repository(
    repo_id: int, current_user: dict = Depends(verify_admin_token)
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


@router.post("/repositories/{repo_id}/remove-and-sync")
async def remove_and_sync_repository(
    repo_id: int, current_user: dict = Depends(verify_admin_token)
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

        logger.info(f"Remove and sync repository '{repository['name']}' at path: {repo_path}")
        
        # Remove existing directory if it exists
        if os.path.exists(repo_path):
            # Create backup with timestamp
            parent_dir = os.path.dirname(repo_path.rstrip(os.sep)) or os.path.dirname(repo_path)
            base_name = os.path.basename(os.path.normpath(repo_path))
            backup_path = os.path.join(parent_dir, f"{base_name}_removed_{int(time.time())}")
            
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
            clone_url = add_auth_to_url(repository["url"], resolved_username, resolved_token)

        # Clone fresh copy
        success = False
        message = ""

        try:
            if not repository.get("verify_ssl", True):
                logger.warning("Git SSL verification disabled - not recommended for production")
            
            with set_ssl_env(repository):
                logger.info(f"Cloning fresh copy of branch {repository['branch']} into {repo_path}")
                Repo.clone_from(clone_url, repo_path, branch=repository["branch"])

            if not os.path.isdir(os.path.join(repo_path, ".git")):
                raise GitCommandError("clone", 1, b"", b".git not found after clone")

            success = True
            message = f"Repository '{repository['name']}' removed and re-cloned successfully"
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
                if not success and os.path.isdir(repo_path) and not os.listdir(repo_path):
                    shutil.rmtree(repo_path)
                    logger.info(f"Removed empty directory after failed clone: {repo_path}")
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




# =============================================================================
# GIT VERSION CONTROL ENDPOINTS
# =============================================================================

@router.get("/repositories/{repo_id}/branches")
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


@router.post("/repositories/{repo_id}/branches")
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


@router.get("/repositories/{repo_id}/commits/{branch_name}")
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


@router.post("/repositories/{repo_id}/commits")
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


@router.get("/repositories/{repo_id}/commits/{commit_hash}/diff")
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


@router.post("/repositories/{repo_id}/diff")
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


# =============================================================================
# FILE OPERATIONS ENDPOINTS
# =============================================================================

@router.get("/repositories/{repo_id}/files/{commit_hash}")
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


@router.get("/repositories/{repo_id}/files/search")
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


@router.get("/repositories/{repo_id}/files/{file_path:path}/history")
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


@router.get("/repositories/{repo_id}/files/{file_path:path}/complete-history")
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
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No commits found for file: {file_path}",
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


# =============================================================================
# UTILITY AND COMPARISON ENDPOINTS
# =============================================================================

@router.post("/compare-across-repos")
async def compare_files_across_repos(
    request: dict, current_user: str = Depends(get_current_username)
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


@router.get("/repositories/{repo_id}/info")
async def get_repository_info(
    repo_id: int, current_user: str = Depends(get_current_username)
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


@router.get("/repositories/{repo_id}/debug")
async def debug_git(repo_id: int, current_user: str = Depends(get_current_username)):
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


@router.get("/health")
async def health_check(current_user: dict = Depends(verify_admin_token)):
    """Health check for git repository management."""
    try:
        health = git_repo_manager.health_check()
        return health
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


