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
import os
import shutil
from contextlib import contextmanager
from pathlib import Path
from typing import Dict, Optional
from urllib.parse import urlparse, urlunparse, quote as urlquote

from git import Repo
from git.exc import InvalidGitRepositoryError, GitCommandError

logger = logging.getLogger(__name__)


def repo_path(repository: Dict) -> Path:
    """Compute the on-disk path for a repository.

    Args:
        repository: Repository metadata dict with keys like 'name' and optional 'path'.

    Returns:
        Absolute Path to the repository working directory under data/git/.
    """
    from config import settings as config_settings

    sub_path = (repository.get("path") or repository["name"]).lstrip("/")
    return Path(config_settings.data_directory) / "git" / sub_path


def add_auth_to_url(url: str, username: Optional[str], token: Optional[str]) -> str:
    """Return a URL with HTTP(S) basic auth credentials injected.

    - Only applies to http/https URLs; other schemes (ssh/git) are returned untouched.
    - Username/token are URL-encoded.
    - If credentials are missing, the original URL is returned.
    """
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return url
        if not token:
            return url
        user_enc = urlquote(str(username or "git"), safe="")
        token_enc = urlquote(str(token), safe="")
        netloc = parsed.netloc
        # Strip existing userinfo, then add ours
        if "@" in netloc:
            netloc = netloc.split("@", 1)[-1]
        netloc = f"{user_enc}:{token_enc}@{netloc}"
        return urlunparse((parsed.scheme, netloc, parsed.path, parsed.params, parsed.query, parsed.fragment))
    except Exception:
        # Be conservative; return original URL on parsing errors
        return url


def normalize_git_url(url: str) -> str:
    """Normalize a Git URL by removing any userinfo to enable safe comparison."""
    try:
        parsed = urlparse(url)
        netloc = parsed.netloc
        if "@" in netloc:
            netloc = netloc.split("@", 1)[-1]
        return urlunparse((parsed.scheme, netloc, parsed.path, "", "", ""))
    except Exception:
        return url


@contextmanager
def set_ssl_env(repository: Dict):
    """Context manager to apply SSL-related environment variables for Git commands.

    Honors the 'verify_ssl' flag in the repository dict. Optionally supports
    custom CA/cert paths if keys are present (ssl_ca_info, ssl_cert).
    """
    original = {
        "GIT_SSL_NO_VERIFY": os.environ.get("GIT_SSL_NO_VERIFY"),
        "GIT_SSL_CA_INFO": os.environ.get("GIT_SSL_CA_INFO"),
        "GIT_SSL_CERT": os.environ.get("GIT_SSL_CERT"),
    }
    try:
        if not repository.get("verify_ssl", True):
            os.environ["GIT_SSL_NO_VERIFY"] = "1"
        if repository.get("ssl_ca_info"):
            os.environ["GIT_SSL_CA_INFO"] = str(repository["ssl_ca_info"])
        if repository.get("ssl_cert"):
            os.environ["GIT_SSL_CERT"] = str(repository["ssl_cert"])
        yield
    finally:
        # Restore prior values (unset if previously absent)
        for key, val in original.items():
            if val is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = val


def open_or_clone(repository: Dict) -> Repo:
    """Open the repo at its path, or clone if missing/invalid/mismatched.

    Logic:
    - Ensure the repository directory exists
    - Try to open as Repo; if remote URL (normalized) mismatches expected, reclone
    - If opening fails, clone from repository['url'] with credentials and SSL env

    Returns:
        A GitPython Repo instance ready for use.

    Raises:
        GitCommandError/InvalidGitRepositoryError or other exceptions for clone errors.
    """
    repo_dir = repo_path(repository)
    repo_dir.mkdir(parents=True, exist_ok=True)

    expected_url_norm = normalize_git_url(repository["url"]) if repository.get("url") else None

    try:
        repo = Repo(repo_dir)
        # Validate remote URL if present
        try:
            current_remote = repo.remotes.origin.url if repo.remotes else None
        except Exception:
            current_remote = None

        if expected_url_norm and current_remote:
            current_url_norm = normalize_git_url(current_remote)
            if current_url_norm != expected_url_norm:
                logger.warning(
                    "Repository URL mismatch. Expected: %s, Found: %s; re-cloning",
                    expected_url_norm,
                    current_url_norm,
                )
                raise InvalidGitRepositoryError("URL mismatch, need to re-clone")

        return repo
    except Exception:
        # Re-clone fresh
        if repo_dir.exists():
            try:
                shutil.rmtree(repo_dir)
            except Exception as re:
                logger.warning("Failed to remove repo dir before re-clone: %s", re)
        repo_dir.mkdir(parents=True, exist_ok=True)

        clone_url = add_auth_to_url(
            repository.get("url", ""),
            repository.get("username"),
            repository.get("token"),
        )

        with set_ssl_env(repository):
            try:
                repo = Repo.clone_from(
                    clone_url,
                    repo_dir,
                    branch=repository.get("branch", "main"),
                )
                logger.info(
                    "Cloned repository %s from %s", repository.get("name"), repository.get("url")
                )
                return repo
            except Exception:
                # Cleanup empty/partial dir on failure
                try:
                    if repo_dir.exists() and not any(repo_dir.iterdir()):
                        shutil.rmtree(repo_dir)
                except Exception:
                    pass
                raise
