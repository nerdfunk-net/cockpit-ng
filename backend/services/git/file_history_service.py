"""Git file history — commit listings, last-commit metadata, and full history."""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from fastapi import HTTPException, status
from git import GitCommandError, InvalidGitRepositoryError

from services.git.shared_utils import get_git_repo_by_id

logger = logging.getLogger(__name__)


class GitFileHistoryService:
    """Commit history operations on files within a managed Git repository."""

    def get_commit_files(
        self,
        repo_id: int,
        commit_hash: str,
        file_path: Optional[str] = None,
    ) -> Any:
        """List files in a commit, or return single file content when file_path given."""
        try:
            repo = get_git_repo_by_id(repo_id)
            commit = repo.commit(commit_hash)

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
                        detail="File '%s' not found in commit %s"
                        % (file_path, commit_hash[:8]),
                    )

            files = []
            for item in commit.tree.traverse():
                if item.type == "blob":
                    files.append(item.path)

            from config import settings

            config_extensions = settings.allowed_file_extensions
            config_files = [
                f for f in files if any(f.endswith(ext) for ext in config_extensions)
            ]
            return sorted(config_files)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to get files: %s" % str(e),
            )

    def get_file_last_commit(
        self,
        repo_id: int,
        file_path: str,
    ) -> Dict[str, Any]:
        """Return the most recent commit metadata for a file."""
        try:
            repo = get_git_repo_by_id(repo_id)
            commits = list(repo.iter_commits(paths=file_path, max_count=1))

            if not commits:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No commits found for file: %s" % file_path,
                )

            last_commit = commits[0]

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
                detail="Failed to get file history: %s" % str(e),
            )

    def get_file_history(
        self,
        repo_id: int,
        file_path: str,
        from_commit: Optional[str] = None,
        cache_service=None,
        cache_enabled: bool = True,
        cache_ttl: int = 600,
    ) -> Dict[str, Any]:
        """Return full commit chain for a file back to its creation."""
        try:
            repo = get_git_repo_by_id(repo_id)

            repo_scope = "repo:%s" % repo_id
            cache_key = "%s:filehistory:%s:%s" % (
                repo_scope,
                from_commit or "HEAD",
                file_path,
            )
            if cache_enabled and cache_service:
                cached = cache_service.get(cache_key)
                if cached is not None:
                    return cached

            start_commit = from_commit if from_commit else "HEAD"
            commits = list(repo.iter_commits(start_commit, paths=file_path))

            if not commits:
                try:
                    head_commit = repo.head.commit
                    head_commit.tree[file_path]
                    commits = list(repo.iter_commits("HEAD", paths=file_path))
                    if not commits:
                        raise HTTPException(
                            status_code=status.HTTP_404_NOT_FOUND,
                            detail="No commits found for file: %s" % file_path,
                        )
                except (KeyError, AttributeError):
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="File not found: %s" % file_path,
                    )

            history_commits = []

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

            if from_commit and not selected_commit_found:
                try:
                    commit_obj = repo.commit(from_commit)
                    try:
                        commit_obj.tree[file_path]
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
                                "change_type": "N",
                            }
                        )
                    except KeyError:
                        pass
                except Exception:
                    pass

            for i, commit in enumerate(commits):
                change_type = "M"

                if i == len(commits) - 1:
                    change_type = "A"
                else:
                    try:
                        commit.tree[file_path]
                    except KeyError:
                        change_type = "D"

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
            if cache_enabled and cache_service:
                cache_service.set(cache_key, result, cache_ttl)
            return result

        except (InvalidGitRepositoryError, GitCommandError) as e:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Git repository not found or commit not found: %s" % str(e),
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Git file complete history error: %s" % str(e),
            )
