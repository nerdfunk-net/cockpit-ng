"""
Git repository management router - CRUD operations for repositories.
Handles creation, reading, updating, and deletion of Git repository configurations.
"""

from __future__ import annotations
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from core.auth import require_permission
from models.git_repositories import (
    GitRepositoryRequest,
    GitRepositoryResponse,
    GitRepositoryListResponse,
    GitRepositoryUpdateRequest,
    GitConnectionTestRequest,
    GitConnectionTestResponse,
)
from services.git_utils import resolve_git_credentials
from services.git_shared_utils import git_repo_manager
import tempfile
import subprocess
import os
from pathlib import Path

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/git-repositories", tags=["git-repositories"])


@router.get("/", response_model=GitRepositoryListResponse)
async def get_repositories(
    category: Optional[str] = None,
    active_only: bool = False,
    current_user: dict = Depends(require_permission("git.repositories", "read")),
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


@router.get("/{repo_id}", response_model=GitRepositoryResponse)
async def get_repository(
    repo_id: int,
    current_user: dict = Depends(require_permission("git.repositories", "read")),
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


@router.get("/{repo_id}/edit")
async def get_repository_for_edit(
    repo_id: int,
    current_user: dict = Depends(require_permission("git.repositories", "write")),
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


@router.post("/", response_model=GitRepositoryResponse)
async def create_repository(
    repository: GitRepositoryRequest,
    current_user: dict = Depends(require_permission("git.repositories", "write")),
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


@router.put("/{repo_id}", response_model=GitRepositoryResponse)
async def update_repository(
    repo_id: int,
    repository: GitRepositoryUpdateRequest,
    current_user: dict = Depends(require_permission("git.repositories", "write")),
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


@router.delete("/{repo_id}")
async def delete_repository(
    repo_id: int,
    hard_delete: bool = True,
    current_user: dict = Depends(require_permission("git.repositories", "delete")),
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


@router.post("/test-connection", response_model=GitConnectionTestResponse)
async def test_git_connection(
    test_request: GitConnectionTestRequest,
    current_user: dict = Depends(require_permission("git.repositories", "write")),
):
    """Test git repository connection."""
    try:
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


@router.get("/health")
async def health_check(
    current_user: dict = Depends(require_permission("git.repositories", "read")),
):
    """Health check for git repository management."""
    try:
        health = git_repo_manager.health_check()
        return health
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{repo_id}/debug/read")
async def debug_read_test(
    repo_id: int,
    current_user: dict = Depends(require_permission("git.repositories", "write")),
):
    """Debug operation: Test reading a file from the repository."""
    try:
        from services.git_shared_utils import get_git_repo_by_id
        from pathlib import Path

        # Get repository details
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")

        repo = get_git_repo_by_id(repo_id)
        repo_path = Path(repo.working_dir)
        test_file_path = repo_path / ".cockpit_debug_test.txt"

        # Try to read the test file
        if not test_file_path.exists():
            return {
                "success": False,
                "message": "Test file does not exist",
                "details": {
                    "file_path": str(test_file_path),
                    "repository_path": str(repo_path),
                    "exists": False,
                    "suggestion": "Use the 'Write' operation to create the test file first"
                }
            }

        try:
            content = test_file_path.read_text()
            return {
                "success": True,
                "message": "File read successfully",
                "details": {
                    "file_path": str(test_file_path),
                    "content": content,
                    "size_bytes": len(content),
                    "readable": True
                }
            }
        except PermissionError as e:
            return {
                "success": False,
                "message": "Permission denied reading file",
                "details": {
                    "error": str(e),
                    "file_path": str(test_file_path),
                    "error_type": "PermissionError",
                    "suggestion": "Check file system permissions for the repository directory"
                }
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Error reading file: {str(e)}",
                "details": {
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "file_path": str(test_file_path)
                }
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Debug read test failed for repo {repo_id}: {e}")
        return {
            "success": False,
            "message": f"Debug test failed: {str(e)}",
            "details": {
                "error": str(e),
                "error_type": type(e).__name__,
                "stage": "repository_access"
            }
        }


@router.post("/{repo_id}/debug/write")
async def debug_write_test(
    repo_id: int,
    current_user: dict = Depends(require_permission("git.repositories", "write")),
):
    """Debug operation: Test writing a file to the repository."""
    try:
        from services.git_shared_utils import get_git_repo_by_id
        from pathlib import Path
        from datetime import datetime

        # Get repository details
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")

        repo = get_git_repo_by_id(repo_id)
        repo_path = Path(repo.working_dir)
        test_file_path = repo_path / ".cockpit_debug_test.txt"

        # Create test content with timestamp
        test_content = f"Cockpit Debug Test\nTimestamp: {datetime.now().isoformat()}\nRepository: {repository['name']}\n"

        try:
            # Try to write the file
            test_file_path.write_text(test_content)

            # Verify write
            if test_file_path.exists():
                written_content = test_file_path.read_text()
                success = written_content == test_content

                # Get git status
                repo_status = "unknown"
                try:
                    if repo.is_dirty(untracked_files=True):
                        repo_status = "modified (file created but not committed)"
                    else:
                        repo_status = "clean"
                except Exception:
                    repo_status = "status check failed"

                return {
                    "success": success,
                    "message": "File written successfully" if success else "File written but verification failed",
                    "details": {
                        "file_path": str(test_file_path),
                        "content_length": len(test_content),
                        "verified": success,
                        "git_status": repo_status,
                        "writable": True
                    }
                }
            else:
                return {
                    "success": False,
                    "message": "File write appeared to succeed but file does not exist",
                    "details": {
                        "file_path": str(test_file_path),
                        "error_type": "VerificationError"
                    }
                }

        except PermissionError as e:
            return {
                "success": False,
                "message": "Permission denied writing file",
                "details": {
                    "error": str(e),
                    "file_path": str(test_file_path),
                    "error_type": "PermissionError",
                    "suggestion": "Check file system permissions for the repository directory",
                    "directory_writable": os.access(str(repo_path), os.W_OK)
                }
            }
        except OSError as e:
            return {
                "success": False,
                "message": f"OS error writing file: {str(e)}",
                "details": {
                    "error": str(e),
                    "error_type": "OSError",
                    "file_path": str(test_file_path),
                    "suggestion": "Check disk space and file system health"
                }
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Error writing file: {str(e)}",
                "details": {
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "file_path": str(test_file_path)
                }
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Debug write test failed for repo {repo_id}: {e}")
        return {
            "success": False,
            "message": f"Debug test failed: {str(e)}",
            "details": {
                "error": str(e),
                "error_type": type(e).__name__,
                "stage": "repository_access"
            }
        }


@router.post("/{repo_id}/debug/delete")
async def debug_delete_test(
    repo_id: int,
    current_user: dict = Depends(require_permission("git.repositories", "write")),
):
    """Debug operation: Test deleting the test file from the repository."""
    try:
        from services.git_shared_utils import get_git_repo_by_id
        from pathlib import Path

        # Get repository details
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")

        repo = get_git_repo_by_id(repo_id)
        repo_path = Path(repo.working_dir)
        test_file_path = repo_path / ".cockpit_debug_test.txt"

        # Check if file exists before deletion
        if not test_file_path.exists():
            return {
                "success": False,
                "message": "Test file does not exist, nothing to delete",
                "details": {
                    "file_path": str(test_file_path),
                    "exists": False
                }
            }

        try:
            # Try to delete the file
            test_file_path.unlink()

            # Verify deletion
            if test_file_path.exists():
                return {
                    "success": False,
                    "message": "File deletion appeared to succeed but file still exists",
                    "details": {
                        "file_path": str(test_file_path),
                        "error_type": "VerificationError"
                    }
                }
            else:
                # Get git status
                repo_status = "unknown"
                try:
                    if repo.is_dirty(untracked_files=True):
                        repo_status = "modified (file deleted but not committed)"
                    else:
                        repo_status = "clean"
                except Exception:
                    repo_status = "status check failed"

                return {
                    "success": True,
                    "message": "File deleted successfully",
                    "details": {
                        "file_path": str(test_file_path),
                        "verified": True,
                        "git_status": repo_status
                    }
                }

        except PermissionError as e:
            return {
                "success": False,
                "message": "Permission denied deleting file",
                "details": {
                    "error": str(e),
                    "file_path": str(test_file_path),
                    "error_type": "PermissionError",
                    "suggestion": "Check file system permissions for the file"
                }
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Error deleting file: {str(e)}",
                "details": {
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "file_path": str(test_file_path)
                }
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Debug delete test failed for repo {repo_id}: {e}")
        return {
            "success": False,
            "message": f"Debug test failed: {str(e)}",
            "details": {
                "error": str(e),
                "error_type": type(e).__name__,
                "stage": "repository_access"
            }
        }


@router.post("/{repo_id}/debug/push")
async def debug_push_test(
    repo_id: int,
    current_user: dict = Depends(require_permission("git.repositories", "write")),
):
    """Debug operation: Test pushing changes to the remote repository."""
    try:
        from services.git_shared_utils import get_git_repo_by_id
        from pathlib import Path
        from datetime import datetime
        from services.git_utils import resolve_git_credentials

        # Get repository details
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")

        repo = get_git_repo_by_id(repo_id)
        repo_path = Path(repo.working_dir)
        test_file_path = repo_path / ".cockpit_debug_test.txt"

        # Resolve credentials for push
        username, token = resolve_git_credentials(repository)

        # Check for credentials
        if not username or not token:
            return {
                "success": False,
                "message": "No credentials configured for push",
                "details": {
                    "error": "Push requires authentication credentials",
                    "error_type": "AuthenticationRequired",
                    "suggestion": "Configure a token credential for this repository to enable push operations"
                }
            }

        try:
            # Step 1: Create or update test file
            test_content = f"Cockpit Debug Push Test\nTimestamp: {datetime.now().isoformat()}\nRepository: {repository['name']}\n"
            test_file_path.write_text(test_content)

            # Step 2: Stage the file
            try:
                repo.index.add(['.cockpit_debug_test.txt'])
            except Exception as add_error:
                return {
                    "success": False,
                    "message": f"Failed to stage file: {str(add_error)}",
                    "details": {
                        "error": str(add_error),
                        "error_type": type(add_error).__name__,
                        "stage": "git_add"
                    }
                }

            # Step 3: Commit the change
            try:
                commit_message = f"Debug push test - {datetime.now().isoformat()}"
                commit = repo.index.commit(commit_message)
                commit_sha = commit.hexsha[:8]
            except Exception as commit_error:
                # If nothing to commit (file already exists with same content), that's ok
                if "nothing to commit" in str(commit_error).lower():
                    return {
                        "success": False,
                        "message": "No changes to push (test file unchanged)",
                        "details": {
                            "error": str(commit_error),
                            "error_type": "NoChanges",
                            "suggestion": "The test file already exists with the same content. Use Write test first or modify the file manually."
                        }
                    }
                return {
                    "success": False,
                    "message": f"Failed to commit changes: {str(commit_error)}",
                    "details": {
                        "error": str(commit_error),
                        "error_type": type(commit_error).__name__,
                        "stage": "git_commit"
                    }
                }

            # Step 4: Update remote URL with credentials
            try:
                origin = repo.remote('origin')
                original_url = list(origin.urls)[0]

                # Build authenticated URL
                if "://" in repository['url']:
                    protocol, rest = repository['url'].split("://", 1)
                    # Remove any existing auth from URL
                    if "@" in rest:
                        rest = rest.split("@", 1)[1]
                    auth_url = f"{protocol}://{username}:{token}@{rest}"
                else:
                    auth_url = repository['url']

                # Temporarily set the URL with credentials
                origin.set_url(auth_url)

            except Exception as remote_error:
                return {
                    "success": False,
                    "message": f"Failed to configure remote: {str(remote_error)}",
                    "details": {
                        "error": str(remote_error),
                        "error_type": type(remote_error).__name__,
                        "stage": "configure_remote"
                    }
                }

            # Step 5: Push to remote
            try:
                push_info = origin.push(refspec=f"{repository['branch']}:{repository['branch']}")

                # Restore original URL (without credentials)
                try:
                    origin.set_url(original_url)
                except Exception:
                    pass  # Best effort to clean up

                # Check push result
                if push_info and len(push_info) > 0:
                    push_result = push_info[0]

                    # Check for errors
                    if push_result.flags & push_result.ERROR:
                        return {
                            "success": False,
                            "message": f"Push failed: {push_result.summary}",
                            "details": {
                                "error": push_result.summary,
                                "error_type": "PushError",
                                "commit_sha": commit_sha,
                                "suggestion": "Check repository permissions and credentials"
                            }
                        }

                    # Success!
                    return {
                        "success": True,
                        "message": "Push test successful - changes pushed to remote",
                        "details": {
                            "commit_sha": commit_sha,
                            "commit_message": commit_message,
                            "branch": repository['branch'],
                            "remote": "origin",
                            "file_path": str(test_file_path),
                            "push_summary": push_result.summary,
                            "verified": True
                        }
                    }
                else:
                    return {
                        "success": False,
                        "message": "Push completed but no feedback received",
                        "details": {
                            "error": "No push info returned",
                            "error_type": "UnknownPushResult",
                            "commit_sha": commit_sha
                        }
                    }

            except Exception as push_error:
                # Restore original URL even if push fails
                try:
                    origin.set_url(original_url)
                except Exception:
                    pass

                error_message = str(push_error)

                # Provide helpful error messages for common issues
                if "permission denied" in error_message.lower() or "403" in error_message:
                    suggestion = "Authentication failed or insufficient permissions. Check that the token has write access."
                elif "could not resolve host" in error_message.lower():
                    suggestion = "Network error: Cannot reach remote repository. Check network connectivity."
                elif "authentication failed" in error_message.lower():
                    suggestion = "Credentials are invalid. Update the token in credential settings."
                else:
                    suggestion = "Check repository configuration and network connectivity"

                return {
                    "success": False,
                    "message": f"Failed to push: {error_message}",
                    "details": {
                        "error": error_message,
                        "error_type": type(push_error).__name__,
                        "stage": "git_push",
                        "commit_sha": commit_sha,
                        "suggestion": suggestion
                    }
                }

        except PermissionError as e:
            return {
                "success": False,
                "message": "Permission denied for file operations",
                "details": {
                    "error": str(e),
                    "file_path": str(test_file_path),
                    "error_type": "PermissionError",
                    "suggestion": "Check file system permissions for the repository directory"
                }
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Unexpected error during push test: {str(e)}",
                "details": {
                    "error": str(e),
                    "error_type": type(e).__name__,
                    "file_path": str(test_file_path)
                }
            }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Debug push test failed for repo {repo_id}: {e}")
        return {
            "success": False,
            "message": f"Debug test failed: {str(e)}",
            "details": {
                "error": str(e),
                "error_type": type(e).__name__,
                "stage": "repository_access"
            }
        }


@router.get("/{repo_id}/debug/diagnostics")
async def debug_diagnostics(
    repo_id: int,
    current_user: dict = Depends(require_permission("git.repositories", "read")),
):
    """Get comprehensive diagnostic information for the repository."""
    try:
        from services.git_shared_utils import get_git_repo_by_id
        from pathlib import Path
        import ssl

        # Get repository details
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")

        diagnostics = {
            "repository_info": {
                "id": repository["id"],
                "name": repository["name"],
                "url": repository["url"],
                "branch": repository["branch"],
                "is_active": repository["is_active"],
                "verify_ssl": repository.get("verify_ssl", True)
            },
            "access_test": {},
            "file_system": {},
            "git_status": {},
            "ssl_info": {},
            "credentials": {}
        }

        # Test repository access
        try:
            repo = get_git_repo_by_id(repo_id)
            repo_path = Path(repo.working_dir)

            diagnostics["access_test"] = {
                "accessible": True,
                "path": str(repo_path),
                "exists": repo_path.exists()
            }

            # File system permissions
            try:
                diagnostics["file_system"] = {
                    "readable": os.access(str(repo_path), os.R_OK),
                    "writable": os.access(str(repo_path), os.W_OK),
                    "executable": os.access(str(repo_path), os.X_OK),
                    "path": str(repo_path)
                }
            except Exception as e:
                diagnostics["file_system"] = {
                    "error": str(e),
                    "error_type": type(e).__name__
                }

            # Git status
            try:
                diagnostics["git_status"] = {
                    "is_dirty": repo.is_dirty(untracked_files=True),
                    "active_branch": repo.active_branch.name,
                    "head_commit": repo.head.commit.hexsha[:8] if repo.head.is_valid() else "no commits",
                    "remotes": [r.name for r in repo.remotes],
                    "has_origin": "origin" in [r.name for r in repo.remotes]
                }
            except Exception as e:
                diagnostics["git_status"] = {
                    "error": str(e),
                    "error_type": type(e).__name__
                }

        except Exception as e:
            diagnostics["access_test"] = {
                "accessible": False,
                "error": str(e),
                "error_type": type(e).__name__
            }

        # SSL/Certificate information
        try:
            if not repository.get("verify_ssl", True):
                diagnostics["ssl_info"] = {
                    "verification": "disabled",
                    "note": "SSL verification is disabled for this repository"
                }
            else:
                diagnostics["ssl_info"] = {
                    "verification": "enabled",
                    "ssl_version": ssl.OPENSSL_VERSION
                }
        except Exception as e:
            diagnostics["ssl_info"] = {
                "error": str(e),
                "error_type": type(e).__name__
            }

        # Credential information (without exposing secrets)
        try:
            from services.git_utils import resolve_git_credentials

            username, token = resolve_git_credentials(repository)
            diagnostics["credentials"] = {
                "credential_name": repository.get("credential_name", "none"),
                "has_username": bool(username),
                "has_token": bool(token),
                "token_length": len(token) if token else 0,
                "authentication": "configured" if (username and token) else "none"
            }
        except Exception as e:
            diagnostics["credentials"] = {
                "error": str(e),
                "error_type": type(e).__name__
            }

        return {
            "success": True,
            "repository_id": repo_id,
            "diagnostics": diagnostics
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Debug diagnostics failed for repo {repo_id}: {e}")
        return {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }
