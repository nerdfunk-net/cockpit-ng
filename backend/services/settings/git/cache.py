"""
Git Cache Service - Centralized caching for git operations.

This service consolidates all git caching logic that was previously
scattered across git_operations.py, git_version_control.py, and git_files.py.

Provides consistent cache key generation, TTL management, and cache invalidation
for commits, file history, and other git data.
"""

from __future__ import annotations
import logging
import subprocess
from typing import List, Optional, Dict, Any

from git import Repo
from services.settings.cache import cache_service
from models.git import GitCommit, commit_to_dict

logger = logging.getLogger(__name__)


class GitCacheService:
    """Service for caching git operations data."""

    def __init__(self):
        """Initialize the git cache service."""
        self._cache_enabled = True
        self._max_commits = 500
        self._ttl_seconds = 600

    def _get_cache_config(self) -> Dict[str, Any]:
        """Get cache configuration from settings.

        Returns:
            Dictionary with cache configuration
        """
        try:
            from settings_manager import settings_manager

            return settings_manager.get_cache_settings()
        except Exception as e:
            logger.warning(f"Failed to get cache settings: {e}")
            return {
                "enabled": self._cache_enabled,
                "max_commits": self._max_commits,
                "ttl_seconds": self._ttl_seconds,
            }

    def _build_cache_key(self, repo_id: int, *parts: str) -> str:
        """Build consistent cache key for git operations.

        Args:
            repo_id: Repository ID
            *parts: Additional key components

        Returns:
            Cache key string in format "repo:{id}:part1:part2:..."
        """
        repo_scope = f"repo:{repo_id}"
        if parts:
            return f"{repo_scope}:{':'.join(parts)}"
        return repo_scope

    def get_commits(
        self,
        repo_id: int,
        repo_path: str,
        branch_name: str,
        limit: int = 50,
        use_models: bool = False,
    ) -> List[Dict[str, Any]] | List[GitCommit]:
        """Get commits for a repository with caching.

        Args:
            repo_id: Repository ID
            repo_path: Path to repository on disk
            branch_name: Branch name to get commits from
            limit: Maximum number of commits to return (default: 50)
            use_models: If True, return GitCommit models; if False, return dicts (default: False)

        Returns:
            List of commit dictionaries or GitCommit models
        """
        cache_cfg = self._get_cache_config()
        cache_key = self._build_cache_key(repo_id, "commits", branch_name)

        # Try cache first if enabled
        if cache_cfg.get("enabled", True):
            cached_commits = cache_service.get(cache_key)
            if cached_commits is not None:
                logger.debug(
                    f"Cache hit for commits: repo {repo_id}, branch {branch_name}"
                )
                limited_commits = cached_commits[:limit]
                if use_models:
                    return [GitCommit(**c) for c in limited_commits]
                return limited_commits

        # Cache miss - fetch from repository
        logger.debug(f"Cache miss for commits: repo {repo_id}, branch {branch_name}")
        commits = self._fetch_commits_from_repo(
            repo_id, repo_path, branch_name, limit, cache_cfg
        )

        if use_models:
            return [GitCommit(**c) for c in commits]
        return commits

    def _fetch_commits_from_repo(
        self,
        repo_id: int,
        repo_path: str,
        branch_name: str,
        limit: int,
        cache_cfg: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """Fetch commits from repository using GitPython with subprocess fallback.

        Args:
            repo_id: Repository ID
            repo_path: Path to repository on disk
            branch_name: Branch name
            limit: Number of commits requested
            cache_cfg: Cache configuration

        Returns:
            List of commit dictionaries
        """
        try:
            repo = Repo(repo_path)
            commits = []

            # Fetch requested commits
            for commit in repo.iter_commits(branch_name, max_count=limit):
                commits.append(commit_to_dict(commit))

            # Cache full commit list if enabled and within limits
            if cache_cfg.get("enabled", True):
                max_commits = int(cache_cfg.get("max_commits", 500))
                if len(commits) < max_commits:
                    # Fetch full list for cache
                    full_commits = []
                    for commit in repo.iter_commits(branch_name, max_count=max_commits):
                        full_commits.append(commit_to_dict(commit))

                    ttl = int(cache_cfg.get("ttl_seconds", 600))
                    cache_key = self._build_cache_key(repo_id, "commits", branch_name)
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
            return self._fetch_commits_subprocess(repo_path, branch_name, limit)

    def _fetch_commits_subprocess(
        self, repo_path: str, branch_name: str, limit: int
    ) -> List[Dict[str, Any]]:
        """Fetch commits using git subprocess as fallback.

        Args:
            repo_path: Path to repository on disk
            branch_name: Branch name
            limit: Number of commits to fetch

        Returns:
            List of commit dictionaries
        """
        try:
            log = subprocess.run(
                [
                    "git",
                    "log",
                    "-n",
                    str(limit),
                    "--date=iso",
                    "--format=%H|%s|%an|%ae|%ad",
                    branch_name,
                ],
                cwd=repo_path,
                capture_output=True,
                text=True,
                timeout=10,
            )

            commits = []
            if log.returncode == 0 and log.stdout:
                for line in log.stdout.splitlines():
                    parts = line.split("|", 4)
                    if len(parts) >= 5:
                        commits.append(
                            {
                                "hash": parts[0],
                                "short_hash": parts[0][:8],
                                "message": parts[1],
                                "author": {
                                    "name": parts[2],
                                    "email": parts[3],
                                },
                                "date": parts[4],
                                "files_changed": 0,
                            }
                        )

            return commits

        except Exception as e:
            logger.error(f"Subprocess git log failed: {e}")
            return []

    def get_file_history(
        self,
        repo_id: int,
        repo_path: str,
        file_path: str,
        branch_name: str = "HEAD",
        from_commit: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Get commit history for a specific file with caching.

        Args:
            repo_id: Repository ID
            repo_path: Path to repository on disk
            file_path: Path to file within repository
            branch_name: Branch name (default: HEAD)
            from_commit: Starting commit hash (optional)

        Returns:
            List of commit dictionaries affecting this file
        """
        cache_cfg = self._get_cache_config()

        # Build cache key with file path
        cache_key_parts = ["file_history", branch_name, file_path]
        if from_commit:
            cache_key_parts.append(from_commit)
        cache_key = self._build_cache_key(repo_id, *cache_key_parts)

        # Try cache first if enabled
        if cache_cfg.get("enabled", True):
            cached_history = cache_service.get(cache_key)
            if cached_history is not None:
                logger.debug(
                    f"Cache hit for file history: repo {repo_id}, file {file_path}"
                )
                return cached_history

        # Cache miss - fetch from repository
        logger.debug(f"Cache miss for file history: repo {repo_id}, file {file_path}")

        try:
            repo = Repo(repo_path)
            history_commits = []

            # Get commits that modified this file
            commit_range = from_commit if from_commit else branch_name
            for commit in repo.iter_commits(commit_range, paths=file_path):
                commit_dict = commit_to_dict(commit)

                # Try to determine change type
                try:
                    if commit.parents:
                        parent = commit.parents[0]
                        diff = parent.diff(commit, paths=file_path)
                        if diff:
                            change_type = diff[0].change_type
                            commit_dict["change_type"] = change_type
                        else:
                            commit_dict["change_type"] = "modified"
                    else:
                        commit_dict["change_type"] = "added"
                except Exception:
                    commit_dict["change_type"] = "modified"

                history_commits.append(commit_dict)

            # Cache the results
            if cache_cfg.get("enabled", True):
                ttl = int(cache_cfg.get("ttl_seconds", 600))
                cache_service.set(cache_key, history_commits, ttl)
                logger.debug(
                    f"Cached {len(history_commits)} commits for file {file_path} in repo {repo_id}"
                )

            return history_commits

        except Exception as e:
            logger.error(f"Failed to get file history for {file_path}: {e}")
            return []

    def get_commit_details(
        self, repo_id: int, repo_path: str, commit_hash: str
    ) -> Optional[Dict[str, Any]]:
        """Get detailed information for a specific commit with caching.

        Args:
            repo_id: Repository ID
            repo_path: Path to repository on disk
            commit_hash: Commit hash

        Returns:
            Commit dictionary with stats, or None if not found
        """
        cache_cfg = self._get_cache_config()
        cache_key = self._build_cache_key(repo_id, "commit", commit_hash)

        # Try cache first if enabled
        if cache_cfg.get("enabled", True):
            cached_commit = cache_service.get(cache_key)
            if cached_commit is not None:
                logger.debug(f"Cache hit for commit details: {commit_hash}")
                return cached_commit

        # Cache miss - fetch from repository
        try:
            repo = Repo(repo_path)
            commit = repo.commit(commit_hash)

            commit_dict = commit_to_dict(commit)

            # Add detailed stats
            stats = commit.stats.total
            commit_dict["stats"] = {
                "additions": stats.get("insertions", 0),
                "deletions": stats.get("deletions", 0),
                "changes": stats.get("lines", 0),
                "total_lines": stats.get("files", 0),
            }

            # Cache the result
            if cache_cfg.get("enabled", True):
                ttl = int(cache_cfg.get("ttl_seconds", 600))
                cache_service.set(cache_key, commit_dict, ttl)

            return commit_dict

        except Exception as e:
            logger.error(f"Failed to get commit details for {commit_hash}: {e}")
            return None

    def invalidate_repo(self, repo_id: int) -> None:
        """Invalidate all cached data for a repository.

        This should be called after operations that change the repository state,
        such as sync, pull, or commit operations.

        Args:
            repo_id: Repository ID to invalidate
        """
        try:
            # Build pattern to match all keys for this repo
            pattern = f"repo:{repo_id}:*"

            # Try to delete matching keys
            # Note: This depends on cache_service supporting pattern deletion
            # If not supported, we'd need to track keys or accept stale cache until TTL
            logger.info(f"Invalidating cache for repo {repo_id}")

            # If cache service supports pattern deletion:
            if hasattr(cache_service, "delete_pattern"):
                cache_service.delete_pattern(pattern)
            else:
                # Fallback: just log that we can't invalidate
                logger.warning(
                    f"Cache service doesn't support pattern deletion. "
                    f"Cache for repo {repo_id} will expire based on TTL."
                )

        except Exception as e:
            logger.error(f"Failed to invalidate cache for repo {repo_id}: {e}")

    def invalidate_all(self) -> None:
        """Invalidate all git-related cached data.

        This is a heavy operation and should be used sparingly.
        """
        try:
            # Pattern to match all repo cache keys
            pattern = "repo:*"

            logger.warning("Invalidating ALL git caches")

            if hasattr(cache_service, "delete_pattern"):
                cache_service.delete_pattern(pattern)
            elif hasattr(cache_service, "clear"):
                cache_service.clear()
            else:
                logger.warning("Cache service doesn't support bulk deletion")

        except Exception as e:
            logger.error(f"Failed to invalidate all caches: {e}")


# Singleton instance for use across the application
git_cache_service = GitCacheService()
