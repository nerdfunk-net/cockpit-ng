"""Git file read operations facade — listing, search, history, and content.

``GitFileService`` keeps the original single-object interface used by
``routers/git/files.py`` while delegating to four focused services
(mirrors the Nautobot ``DeviceCommonService`` facade pattern).
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from models.git_content_search import GitContentSearchRequest
from services.git.file_history_service import GitFileHistoryService
from services.git.file_list_service import GitFileListService
from services.git.file_read_service import GitFileReadService
from services.git.file_search_service import GitFileSearchService

# Re-exported for backward compatibility.
from services.git.path_containment import (
    resolve_within_repo as _resolve_within_repo,  # noqa: F401
)


class GitFileService:
    """Read-only operations on files within a managed Git repository."""

    def __init__(self) -> None:
        self._reader = GitFileReadService()
        self._lister = GitFileListService()
        self._searcher = GitFileSearchService()
        self._history = GitFileHistoryService()

    # -- listing ------------------------------------------------------------

    def search_files(
        self, repo_id: int, query: str = "", limit: int = 50
    ) -> Dict[str, Any]:
        return self._lister.search_files(repo_id, query, limit)

    def get_directory_tree(self, repo_id: int, path: str = "") -> Dict[str, Any]:
        return self._lister.get_directory_tree(repo_id, path)

    def get_directory_files(self, repo_id: int, path: str = "") -> Dict[str, Any]:
        return self._lister.get_directory_files(repo_id, path)

    # -- history ------------------------------------------------------------

    def get_commit_files(
        self, repo_id: int, commit_hash: str, file_path: Optional[str] = None
    ) -> Any:
        return self._history.get_commit_files(repo_id, commit_hash, file_path)

    def get_file_last_commit(self, repo_id: int, file_path: str) -> Dict[str, Any]:
        return self._history.get_file_last_commit(repo_id, file_path)

    def get_file_history(
        self,
        repo_id: int,
        file_path: str,
        from_commit: Optional[str] = None,
        cache_service=None,
        cache_enabled: bool = True,
        cache_ttl: int = 600,
    ) -> Dict[str, Any]:
        return self._history.get_file_history(
            repo_id,
            file_path,
            from_commit=from_commit,
            cache_service=cache_service,
            cache_enabled=cache_enabled,
            cache_ttl=cache_ttl,
        )

    # -- content ------------------------------------------------------------

    def get_file_content(
        self, repo_id: int, path: str, username: Optional[str] = None
    ) -> str:
        return self._reader.get_file_content(repo_id, path, username)

    def get_file_content_parsed(
        self, repo_id: int, path: str, username: Optional[str] = None
    ) -> Dict[str, Any]:
        return self._reader.get_file_content_parsed(repo_id, path, username)

    def list_csv_files(
        self, repo_id: int, query: str = "", limit: int = 200
    ) -> Dict[str, Any]:
        return self._reader.list_csv_files(repo_id, query, limit)

    def get_csv_headers(
        self,
        repo_id: int,
        path: str,
        delimiter: str = ",",
        quote_char: str = '"',
    ) -> Dict[str, Any]:
        return self._reader.get_csv_headers(repo_id, path, delimiter, quote_char)

    # -- content search -----------------------------------------------------

    def search_file_content(
        self, repo_id: int, request: GitContentSearchRequest
    ) -> Dict[str, Any]:
        return self._searcher.search_file_content(repo_id, request)
