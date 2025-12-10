"""Shared Git utility helpers.

This module centralizes common Git operations used by multiple routers:
- Resolve repository working directory under the data directory
- Inject basic auth into HTTPS URLs safely
- Temporarily set SSL-related environment variables
- Normalize Git URLs for comparison (strip userinfo)
- Open an existing repo or clone if missing/mismatched

These helpers reduce duplication and ensure consistent behavior across
the Git-related API routers.
"""

from __future__ import annotations

import logging
from contextlib import contextmanager
from pathlib import Path
from typing import Dict, Optional

from git import Repo

logger = logging.getLogger(__name__)


def repo_path(repository: Dict) -> Path:
    """Compute the on-disk path for a repository.

    DEPRECATED: Use git_paths.repo_path() instead.
    This function is kept for backward compatibility.

    Args:
        repository: Repository metadata dict with keys like 'name' and optional 'path'.

    Returns:
        Absolute Path to the repository working directory under data/git/.
    """
    from services.git_paths import repo_path as _repo_path

    return _repo_path(repository)


def add_auth_to_url(url: str, username: Optional[str], token: Optional[str]) -> str:
    """Return a URL with HTTP(S) basic auth credentials injected.

    DEPRECATED: Use git_auth_service.build_auth_url() instead.
    This function is kept for backward compatibility.

    - Only applies to http/https URLs; other schemes (ssh/git) are returned untouched.
    - Username/token are URL-encoded.
    - If credentials are missing, the original URL is returned.
    """
    from services.git_auth_service import git_auth_service

    return git_auth_service.build_auth_url(url, username, token)


def normalize_git_url(url: str) -> str:
    """Normalize a Git URL by removing any userinfo to enable safe comparison.

    DEPRECATED: Use git_auth_service.normalize_url() instead.
    This function is kept for backward compatibility.
    """
    from services.git_auth_service import git_auth_service

    return git_auth_service.normalize_url(url)


@contextmanager
def set_ssl_env(repository: Dict):
    """Context manager to apply SSL-related environment variables for Git commands.

    DEPRECATED: Use git_env.set_ssl_env() instead.
    This function is kept for backward compatibility.

    Honors the 'verify_ssl' flag in the repository dict. Optionally supports
    custom CA/cert paths if keys are present (ssl_ca_info, ssl_cert).
    """
    from services.git_env import set_ssl_env as _set_ssl_env

    with _set_ssl_env(repository):
        yield


def resolve_git_credentials(
    repository: Dict,
) -> tuple[Optional[str], Optional[str], Optional[str]]:
    """Resolve username, token/password, and SSH key path from credential_name.

    DEPRECATED: Use git_auth_service.resolve_credentials() instead.
    This function is kept for backward compatibility.

    Args:
        repository: Repository metadata dict with credential_name and auth_type

    Returns:
        Tuple of (username, token, ssh_key_path) - ssh_key_path is set for ssh_key auth
    """
    from services.git_auth_service import git_auth_service

    return git_auth_service.resolve_credentials(repository)


def open_or_clone(repository: Dict) -> Repo:
    """Open the repo at its path, or clone if missing/invalid/mismatched.

    DEPRECATED: Use git_clone_service.open_or_clone() instead.
    This function is kept for backward compatibility.

    Logic:
    - Ensure the repository directory exists
    - Try to open as Repo; if remote URL (normalized) mismatches expected, reclone
    - If opening fails, clone from repository['url'] with credentials and SSL env

    Returns:
        A GitPython Repo instance ready for use.

    Raises:
        GitCommandError/InvalidGitRepositoryError or other exceptions for clone errors.
    """
    from services.git_clone_service import git_clone_service

    return git_clone_service.open_or_clone(repository)
