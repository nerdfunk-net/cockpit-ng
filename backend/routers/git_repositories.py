"""
Git repositories management API endpoints.
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from typing import List, Optional
import logging
import os

from models.git_repositories import (
    GitRepositoryRequest,
    GitRepositoryResponse,
    GitRepositoryListResponse,
    GitRepositoryUpdateRequest,
    GitConnectionTestRequest,
    GitConnectionTestResponse,
    GitSyncRequest,
    GitSyncResponse
)
from git_repositories_manager import GitRepositoryManager
from core.auth import verify_token
import credentials_manager as cred_mgr
from services.git_utils import repo_path as git_repo_path, add_auth_to_url, set_ssl_env

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/git-repositories", tags=["git-repositories"])

# Initialize git repository manager
git_repo_manager = GitRepositoryManager()


@router.get("", response_model=GitRepositoryListResponse)
async def get_repositories(
    category: Optional[str] = None,
    active_only: bool = False,
    current_user: dict = Depends(verify_token)
):
    """Get all git repositories."""
    try:
        repositories = git_repo_manager.get_repositories(category=category, active_only=active_only)

        # Convert to response models (excluding sensitive data like tokens)
        repo_responses = []
        for repo in repositories:
            repo_dict = dict(repo)
            # Remove token from response for security
            repo_dict.pop('token', None)
            repo_responses.append(GitRepositoryResponse(**repo_dict))

        return GitRepositoryListResponse(
            repositories=repo_responses,
            total=len(repo_responses)
        )
    except Exception as e:
        logger.error(f"Error getting repositories: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/configs")
async def get_config_repositories(current_user: dict = Depends(verify_token)):
    """Get all Git repositories in the 'configs' category."""
    try:
        repositories = git_repo_manager.get_repositories(category='configs', active_only=True)

        # Convert to response models (excluding sensitive data like tokens)
        repo_responses = []
        for repo in repositories:
            repo_dict = dict(repo)
            # Remove token from response for security
            repo_dict.pop('token', None)
            repo_responses.append(GitRepositoryResponse(**repo_dict))

        return GitRepositoryListResponse(
            repositories=repo_responses,
            total=len(repo_responses)
        )
    except Exception as e:
        logger.error(f"Error getting config repositories: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/selected")
async def get_selected_repository(current_user: dict = Depends(verify_token)):
    """Get the currently selected Git repository for configuration comparison."""
    try:
        from settings_manager import settings_manager

        selected_id = settings_manager.get_selected_git_repository()
        if selected_id is None:
            return {"selected_repository": None}

        # Get the repository details
        repository = git_repo_manager.get_repository(selected_id)
        if not repository:
            # Repository was deleted, clear the selection
            settings_manager.set_selected_git_repository(0)
            return {"selected_repository": None}

        # Remove sensitive data
        repo_dict = dict(repository)
        repo_dict.pop('token', None)

        return {
            "selected_repository": GitRepositoryResponse(**repo_dict),
            "selected_id": selected_id
        }
    except Exception as e:
        logger.error(f"Error getting selected repository: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/selected/{repository_id}")
async def set_selected_repository(
    repository_id: int, 
    current_user: dict = Depends(verify_token)
):
    """Set the selected Git repository for configuration comparison."""
    try:
        from settings_manager import settings_manager

        # Verify repository exists and is in configs category
        repository = git_repo_manager.get_repository(repository_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")

        if repository['category'] != 'configs':
            raise HTTPException(status_code=400, detail="Only repositories in 'configs' category can be selected")

        if not repository['is_active']:
            raise HTTPException(status_code=400, detail="Repository must be active to be selected")

        # Set the selected repository
        success = settings_manager.set_selected_git_repository(repository_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to save selected repository")

        return {"message": f"Repository '{repository['name']}' selected successfully", "repository_id": repository_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error setting selected repository: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{repo_id}", response_model=GitRepositoryResponse)
async def get_repository(
    repo_id: int,
    current_user: dict = Depends(verify_token)
):
    """Get a specific git repository by ID."""
    try:
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")

        # Remove token from response for security
        repo_dict = dict(repository)
        repo_dict.pop('token', None)

        return GitRepositoryResponse(**repo_dict)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting repository {repo_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{repo_id}/edit")
async def get_repository_for_edit(
    repo_id: int,
    current_user: dict = Depends(verify_token)
):
    """Get a specific git repository by ID with all fields for editing."""
    try:
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")

        # Return all fields including token for editing purposes
        # Token field is needed to maintain existing credentials in edit form
        return repository
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting repository {repo_id} for edit: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=GitRepositoryResponse)
async def create_repository(
    repository: GitRepositoryRequest,
    current_user: dict = Depends(verify_token)
):
    """Create a new git repository."""
    try:
        repo_data = repository.dict()
        # Prefer credential_name over legacy inline credentials
        if repo_data.get('credential_name'):
            repo_data['username'] = None
            repo_data['token'] = None
        repo_id = git_repo_manager.create_repository(repo_data)

        # Get the created repository
        created_repo = git_repo_manager.get_repository(repo_id)
        if not created_repo:
            raise HTTPException(status_code=500, detail="Failed to retrieve created repository")

        # Remove token from response for security
        repo_dict = dict(created_repo)
        repo_dict.pop('token', None)

        return GitRepositoryResponse(**repo_dict)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating repository: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{repo_id}", response_model=GitRepositoryResponse)
async def update_repository(
    repo_id: int,
    repository: GitRepositoryUpdateRequest,
    current_user: dict = Depends(verify_token)
):
    """Update a git repository."""
    try:
        # Check if repository exists
        existing_repo = git_repo_manager.get_repository(repo_id)
        if not existing_repo:
            raise HTTPException(status_code=404, detail="Repository not found")

        # Update only provided fields
        repo_data = {k: v for k, v in repository.dict().items() if v is not None}
        # Prefer credential_name over legacy inline credentials
        if repo_data.get('credential_name'):
            repo_data['username'] = None
            # Only clear token if explicitly provided or credential selected
            repo_data['token'] = None

        if not repo_data:
            raise HTTPException(status_code=400, detail="No fields to update")

        success = git_repo_manager.update_repository(repo_id, repo_data)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to update repository")

        # Get the updated repository
        updated_repo = git_repo_manager.get_repository(repo_id)
        if not updated_repo:
            raise HTTPException(status_code=500, detail="Failed to retrieve updated repository")

        # Remove token from response for security
        repo_dict = dict(updated_repo)
        repo_dict.pop('token', None)

        return GitRepositoryResponse(**repo_dict)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating repository {repo_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{repo_id}")
async def delete_repository(
    repo_id: int,
    hard_delete: bool = True,
    current_user: dict = Depends(verify_token)
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


@router.post("/test", response_model=GitConnectionTestResponse)
async def test_git_connection(
    test_request: GitConnectionTestRequest,
    current_user: dict = Depends(verify_token)
):
    """Test git repository connection."""
    try:
        # Import git functionality
        import subprocess
        import tempfile
        import os
        from pathlib import Path

        # Create temporary directory for test
        with tempfile.TemporaryDirectory() as temp_dir:
            test_path = Path(temp_dir) / "test_repo"

            # Build git clone command
            clone_url = test_request.url
            resolved_username = test_request.username
            resolved_token = test_request.token

            # Resolve from credential_name when provided
            if test_request.credential_name:
                try:
                    creds = cred_mgr.list_credentials(include_expired=False)
                    match = next((c for c in creds if c['name'] == test_request.credential_name and c['type'] == 'token'), None)
                    if not match:
                        return GitConnectionTestResponse(
                            success=False,
                            message=f"Credential '{test_request.credential_name}' not found or not a token type",
                            details={}
                        )
                    resolved_username = match['username']
                    try:
                        resolved_token = cred_mgr.get_decrypted_password(match['id'])
                    except Exception as de:
                        return GitConnectionTestResponse(
                            success=False,
                            message=f"Failed to decrypt credential token",
                            details={"error": str(de)}
                        )
                except Exception as ce:
                    return GitConnectionTestResponse(
                        success=False,
                        message=f"Credential lookup error",
                        details={"error": str(ce)}
                    )

            if resolved_username and resolved_token:
                # Add authentication to URL
                if "://" in clone_url:
                    protocol, rest = clone_url.split("://", 1)
                    clone_url = f"{protocol}://{resolved_username}:{resolved_token}@{rest}"

            # Set up environment
            env = os.environ.copy()
            if not test_request.verify_ssl:
                env["GIT_SSL_NO_VERIFY"] = "1"

            # Try to clone (shallow clone for speed)
            cmd = [
                "git", "clone", 
                "--depth", "1",
                "--branch", test_request.branch,
                clone_url,
                str(test_path)
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                env=env,
                timeout=30  # 30 second timeout
            )

            if result.returncode == 0:
                return GitConnectionTestResponse(
                    success=True,
                    message="Git connection successful",
                    details={
                        "branch": test_request.branch,
                        "url": test_request.url
                    }
                )
            else:
                return GitConnectionTestResponse(
                    success=False,
                    message=f"Git connection failed: {result.stderr}",
                    details={
                        "error": result.stderr,
                        "return_code": result.returncode
                    }
                )

    except subprocess.TimeoutExpired:
        return GitConnectionTestResponse(
            success=False,
            message="Git connection test timed out",
            details={"error": "Connection timeout after 30 seconds"}
        )
    except Exception as e:
        logger.error(f"Error testing git connection: {e}")
        return GitConnectionTestResponse(
            success=False,
            message=f"Git connection test error: {str(e)}",
            details={"error": str(e)}
        )


@router.get("/{repo_id}/status")
async def get_repository_status(
    repo_id: int,
    current_user: dict = Depends(verify_token)
):
    """Get the status of a specific repository (exists, sync status, commit info)."""
    import subprocess

    try:
        # Get repository details
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")

        # Resolve repository working directory
        repo_path = str(git_repo_path(repository))

        status_info = {
            "repository_name": repository['name'],
            "repository_url": repository['url'],
            "repository_branch": repository['branch'],
            "sync_status": repository.get('sync_status', 'unknown'),
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
            "config_files": []
        }

        if status_info["exists"]:
            # Check if it's a valid Git repository
            try:
                result = subprocess.run(
                    ['git', 'status', '--porcelain'], 
                    cwd=repo_path, 
                    capture_output=True, 
                    text=True, 
                    timeout=10
                )
                if result.returncode == 0:
                    status_info["is_git_repo"] = True
                    # Get current branch name
                    try:
                        br = subprocess.run(
                            ['git', 'rev-parse', '--abbrev-ref', 'HEAD'],
                            cwd=repo_path,
                            capture_output=True,
                            text=True,
                            timeout=5
                        )
                        if br.returncode == 0:
                            status_info["current_branch"] = (br.stdout or '').strip()
                    except Exception as e:
                        logger.warning(f"Could not get current branch: {e}")

                    # Get current commit info
                    try:
                        commit_result = subprocess.run(
                            ['git', 'log', '-1', '--format=%H|%s|%ai|%an|%ae'], 
                            cwd=repo_path, 
                            capture_output=True, 
                            text=True, 
                            timeout=10
                        )
                        if commit_result.returncode == 0 and commit_result.stdout.strip():
                            commit_info = commit_result.stdout.strip().split('|', 4)
                            if len(commit_info) >= 5:
                                status_info["current_commit"] = commit_info[0][:8]  # Short hash
                                status_info["last_commit_message"] = commit_info[1]
                                status_info["last_commit_date"] = commit_info[2]
                                status_info["last_commit_author"] = commit_info[3]  # Author name
                                status_info["last_commit_author_email"] = commit_info[4]  # Author email
                    except Exception as e:
                        logger.warning(f"Could not get commit info: {e}")

                    # Get list of branches
                    try:
                        brs = subprocess.run(
                            ['git', 'branch', '--format=%(refname:short)'],
                            cwd=repo_path,
                            capture_output=True,
                            text=True,
                            timeout=5
                        )
                        if brs.returncode == 0 and brs.stdout:
                            status_info["branches"] = [b.strip().lstrip('* ').strip() for b in brs.stdout.splitlines() if b.strip()]
                    except Exception as e:
                        logger.warning(f"Could not list branches: {e}")

                    # Get recent commits
                    try:
                        log = subprocess.run(
                            ['git', 'log', '-n', '50', '--date=iso', '--format=%H|%s|%an|%ad'],
                            cwd=repo_path,
                            capture_output=True,
                            text=True,
                            timeout=10
                        )
                        commits = []
                        if log.returncode == 0 and log.stdout:
                            for line in log.stdout.splitlines():
                                parts = line.split('|', 3)
                                if len(parts) == 4:
                                    commits.append({
                                        'hash': parts[0],
                                        'short_hash': parts[0][:8],
                                        'message': parts[1],
                                        'author': parts[2],
                                        'date': parts[3]
                                    })
                        status_info["commits"] = commits
                    except Exception as e:
                        logger.warning(f"Could not get recent commits: {e}")

                    # Check if repository is synced with remote
                    try:
                        # Fetch latest remote refs (timeout quickly)
                        subprocess.run(
                            ['git', 'fetch', '--dry-run'], 
                            cwd=repo_path, 
                            capture_output=True, 
                            timeout=5
                        )

                        # Check how many commits behind/ahead
                        behind_result = subprocess.run(
                            ['git', 'rev-list', '--count', f'HEAD..origin/{repository["branch"]}'], 
                            cwd=repo_path, 
                            capture_output=True, 
                            text=True, 
                            timeout=5
                        )
                        if behind_result.returncode == 0:
                            status_info["behind_count"] = int(behind_result.stdout.strip() or 0)

                        ahead_result = subprocess.run(
                            ['git', 'rev-list', '--count', f'origin/{repository["branch"]}..HEAD'], 
                            cwd=repo_path, 
                            capture_output=True, 
                            text=True, 
                            timeout=5
                        )
                        if ahead_result.returncode == 0:
                            status_info["ahead_count"] = int(ahead_result.stdout.strip() or 0)

                        status_info["is_synced"] = (status_info["behind_count"] == 0)

                    except Exception as e:
                        logger.warning(f"Could not check sync status: {e}")
                        # If we can't check sync status, assume it needs sync
                        status_info["is_synced"] = False

                    # Get list of configuration files
                    try:
                        for root, dirs, files in os.walk(repo_path):
                            # Skip .git directory
                            if '.git' in root:
                                continue

                            for file in files:
                                if not file.startswith('.'):
                                    rel_path = os.path.relpath(os.path.join(root, file), repo_path)
                                    status_info["config_files"].append(rel_path)

                        # Sort files for consistency
                        status_info["config_files"].sort()

                    except Exception as e:
                        logger.warning(f"Could not scan config files: {e}")

            except Exception as e:
                logger.warning(f"Error checking Git repository status: {e}")

        return {
            "success": True,
            "data": status_info
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting repository status: {e}")
        return {
            "success": False,
            "message": f"Failed to get repository status: {str(e)}"
        }


@router.post("/{repo_id}/sync")
async def sync_repository(
    repo_id: int,
    current_user: dict = Depends(verify_token)
):
    """Sync a git repository (clone if not exists, pull if exists)."""
    import subprocess
    import shutil
    import time
    import os
    from urllib.parse import urlparse, quote as urlquote
    from git import Repo, GitCommandError

    try:
        # 1) Load repository
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")

        git_repo_manager.update_sync_status(repo_id, "syncing")

        # 2) Compute repo path (uses configured 'path' or fallback to 'name')
        repo_path = str(git_repo_path(repository))

        logger.info(f"Syncing repository '{repository['name']}' to path: {repo_path}")
        logger.info(f"Repository URL: {repository['url']}")
        logger.info(f"Repository branch: {repository['branch']}")

        os.makedirs(os.path.dirname(repo_path), exist_ok=True)

        # 3) Determine action: clone or pull
        repo_dir_exists = os.path.exists(repo_path)
        is_git_repo = os.path.isdir(os.path.join(repo_path, ".git"))
        needs_clone = not is_git_repo

        # 4) Resolve credentials (legacy or via credential_name)
        resolved_username = repository.get("username")
        resolved_token = repository.get("token")
        if repository.get("credential_name"):
            try:
                creds = cred_mgr.list_credentials(include_expired=False)
                match = next(
                    (c for c in creds if c["name"] == repository["credential_name"] and c["type"] == "token"),
                    None,
                )
                if match:
                    resolved_username = match.get("username")
                    try:
                        resolved_token = cred_mgr.get_decrypted_password(match["id"])
                    except Exception as de:
                        logger.error(f"Failed to decrypt token for credential '{repository['credential_name']}': {de}")
                else:
                    logger.error(f"Credential '{repository['credential_name']}' not found or not a token type")
            except Exception as ce:
                logger.error(f"Credential lookup error: {ce}")

        # 5) Build clone URL (inject auth for http/https)
        clone_url = repository["url"]
        parsed = urlparse(repository["url"]) if repository.get("url") else None
        if parsed and parsed.scheme in ["http", "https"] and resolved_token:
            clone_url = add_auth_to_url(repository["url"], resolved_username, resolved_token)

        success = False
        message = ""

        if needs_clone:
            # Backup non-repo directory if present
            if repo_dir_exists and not is_git_repo:
                parent_dir = os.path.dirname(repo_path.rstrip(os.sep)) or os.path.dirname(repo_path)
                base_name = os.path.basename(os.path.normpath(repo_path))
                backup_path = os.path.join(parent_dir, f"{base_name}_backup_{int(time.time())}")
                shutil.move(repo_path, backup_path)
                logger.info(f"Backed up existing directory to {backup_path}")

            # SSL env toggle
            ssl_env_set = False
            try:
                if not repository.get("verify_ssl", True):
                    logger.warning("Git SSL verification disabled - not recommended for production")
                with set_ssl_env(repository):
                    logger.info(f"Cloning branch {repository['branch']} into {repo_path}")
                    Repo.clone_from(clone_url, repo_path, branch=repository["branch"])

                if not os.path.isdir(os.path.join(repo_path, ".git")):
                    raise GitCommandError("clone", 1, b"", b".git not found after clone")

                success = True
                message = f"Repository '{repository['name']}' cloned successfully to {repo_path}"
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
        else:
            # Pull latest
            try:
                repo = Repo(repo_path)
                origin = repo.remotes.origin
                # Update remote URL with auth if needed
                if parsed and parsed.scheme in ["http", "https"] and resolved_token:
                    auth_url = add_auth_to_url(repository["url"], resolved_username, resolved_token)
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

        # 6) Final status
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


@router.post("/sync", response_model=GitSyncResponse)
async def sync_repositories(
    sync_request: GitSyncRequest,
    current_user: dict = Depends(verify_token)
):
    """Sync git repositories."""
    try:
        if sync_request.repository_id:
            # Sync specific repository
            repos = [git_repo_manager.get_repository(sync_request.repository_id)]
            if not repos[0]:
                raise HTTPException(status_code=404, detail="Repository not found")
        else:
            # Sync all active repositories
            repos = git_repo_manager.get_repositories(active_only=True)

        synced = []
        failed = []
        errors = {}

        for repo in repos:
            try:
                repo_id = repo['id']
                git_repo_manager.update_sync_status(repo_id, "syncing")

                # TODO: Implement actual sync logic here
                # For now, just mark as synced
                git_repo_manager.update_sync_status(repo_id, "synced")
                synced.append(repo_id)
            except Exception as e:
                repo_id = repo['id']
                failed.append(repo_id)
                errors[str(repo_id)] = str(e)
                git_repo_manager.update_sync_status(repo_id, f"error: {str(e)}")

        message = f"Synced {len(synced)} repositories"
        if failed:
            message += f", {len(failed)} failed"

        return GitSyncResponse(
            synced_repositories=synced,
            failed_repositories=failed,
            errors=errors,
            message=message
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error syncing repositories: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{repo_id}/files/search")
async def search_repository_files(
    repo_id: int,
    query: str = "", 
    limit: int = 50,
    current_user: dict = Depends(verify_token)
):
    """Search for files in a specific Git repository with filtering and pagination."""
    import fnmatch

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
                    "repository_name": repository['name']
                }
            }

        # Scan the repository directory for files
        structured_files = []

        for root, dirs, files in os.walk(repo_path):
            # Skip .git directory
            if '.git' in root:
                continue

            rel_root = os.path.relpath(root, repo_path)
            if rel_root == '.':
                rel_root = ''

            for file in files:
                if file.startswith('.'):
                    continue

                full_path = os.path.join(rel_root, file) if rel_root else file
                file_info = {
                    "name": file,
                    "path": full_path,
                    "directory": rel_root,
                    "size": os.path.getsize(os.path.join(root, file)) if os.path.exists(os.path.join(root, file)) else 0
                }
                structured_files.append(file_info)

        # Filter files based on query
        filtered_files = structured_files
        if query:
            query_lower = query.lower()
            filtered_files = []

            for file_info in structured_files:
                # Search in filename, path, and directory
                if (query_lower in file_info['name'].lower() or 
                    query_lower in file_info['path'].lower() or
                    query_lower in file_info['directory'].lower()):
                    filtered_files.append(file_info)
                # Also support wildcard matching
                elif (fnmatch.fnmatch(file_info['name'].lower(), f'*{query_lower}*') or
                      fnmatch.fnmatch(file_info['path'].lower(), f'*{query_lower}*')):
                    filtered_files.append(file_info)

        # Sort by relevance (exact matches first, then by path)
        if query:
            def sort_key(item):
                name_lower = item['name'].lower()
                path_lower = item['path'].lower()
                query_lower = query.lower()

                # Exact filename match gets highest priority
                if name_lower == query_lower:
                    return (0, item['path'])
                # Filename starts with query
                elif name_lower.startswith(query_lower):
                    return (1, item['path'])
                # Filename contains query
                elif query_lower in name_lower:
                    return (2, item['path'])
                # Path contains query
                else:
                    return (3, item['path'])

            filtered_files.sort(key=sort_key)
        else:
            # No query, sort alphabetically by path
            filtered_files.sort(key=lambda x: x['path'])

        # Apply pagination
        paginated_files = filtered_files[:limit]

        return {
            "success": True,
            "data": {
                "files": paginated_files,
                "total_count": len(structured_files),
                "filtered_count": len(filtered_files),
                "query": query,
                "repository_name": repository['name'],
                "has_more": len(filtered_files) > limit
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error searching repository files: {e}")
        return {
            "success": False,
            "message": f"File search failed: {str(e)}"
        }


@router.get("/health")
async def health_check(current_user: dict = Depends(verify_token)):
    """Health check for git repository management."""
    try:
        health = git_repo_manager.health_check()
        return health
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
