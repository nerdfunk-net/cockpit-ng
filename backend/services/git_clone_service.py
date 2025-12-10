"""
Git Clone Service.

This service handles repository cloning and opening operations,
including URL validation, credential setup, and error handling.
"""

from __future__ import annotations
import logging
import shutil
from pathlib import Path
from typing import Dict

from git import Repo
from git.exc import InvalidGitRepositoryError

from services.git_paths import repo_path
from services.git_env import set_ssl_env
from services.git_auth_service import git_auth_service

logger = logging.getLogger(__name__)


class GitCloneService:
    """Service for cloning and opening git repositories."""

    def open_or_clone(self, repository: Dict) -> Repo:
        """Open the repo at its path, or clone if missing/invalid/mismatched.

        Logic:
        - Ensure the repository directory exists
        - Try to open as Repo; if remote URL (normalized) mismatches expected, reclone
        - If opening fails, clone from repository['url'] with credentials and SSL env

        Args:
            repository: Repository metadata dict with url, branch, auth info

        Returns:
            A GitPython Repo instance ready for use.

        Raises:
            GitCommandError/InvalidGitRepositoryError or other exceptions for clone errors.

        Example:
            >>> repo_dict = {
            ...     "name": "my-repo",
            ...     "url": "https://github.com/user/repo.git",
            ...     "branch": "main",
            ...     "auth_type": "token",
            ...     "credential_name": "github-token"
            ... }
            >>> repo = git_clone_service.open_or_clone(repo_dict)
        """
        repo_dir = repo_path(repository)
        repo_dir.mkdir(parents=True, exist_ok=True)

        expected_url_norm = (
            git_auth_service.normalize_url(repository["url"])
            if repository.get("url")
            else None
        )

        try:
            repo = Repo(repo_dir)
            # Validate remote URL if present
            try:
                current_remote = repo.remotes.origin.url if repo.remotes else None
            except Exception:
                current_remote = None

            if expected_url_norm and current_remote:
                current_url_norm = git_auth_service.normalize_url(current_remote)
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

            # Use the authentication service for credential setup
            with set_ssl_env(repository):
                try:
                    with git_auth_service.setup_auth_environment(repository) as (
                        clone_url,
                        username,
                        token,
                        ssh_key_path,
                    ):
                        repo = Repo.clone_from(
                            clone_url,
                            repo_dir,
                            branch=repository.get("branch", "main"),
                        )
                        logger.info(
                            "Cloned repository %s from %s",
                            repository.get("name"),
                            repository.get("url"),
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

    def clone_repository(self, repository: Dict, target_path: Path) -> Repo:
        """Clone a repository to a specific path.

        Args:
            repository: Repository metadata dict with url, branch, auth info
            target_path: Destination path for the clone

        Returns:
            A GitPython Repo instance for the cloned repository

        Raises:
            GitCommandError or other exceptions for clone errors
        """
        target_path.mkdir(parents=True, exist_ok=True)

        with set_ssl_env(repository):
            try:
                with git_auth_service.setup_auth_environment(repository) as (
                    clone_url,
                    username,
                    token,
                    ssh_key_path,
                ):
                    repo = Repo.clone_from(
                        clone_url,
                        target_path,
                        branch=repository.get("branch", "main"),
                    )
                    logger.info(
                        "Cloned repository %s to %s",
                        repository.get("name"),
                        target_path,
                    )
                    return repo
            except Exception:
                # Cleanup on failure
                try:
                    if target_path.exists():
                        shutil.rmtree(target_path)
                except Exception:
                    pass
                raise

    def open_repository(self, repo_path: Path) -> Repo:
        """Open an existing repository.

        Args:
            repo_path: Path to the repository

        Returns:
            A GitPython Repo instance

        Raises:
            InvalidGitRepositoryError if the path is not a valid git repository
        """
        return Repo(repo_path)


# Singleton instance for use across the application
git_clone_service = GitCloneService()
