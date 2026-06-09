"""Git file content search — current, history, and diff modes."""

from __future__ import annotations

import difflib
import fnmatch
import logging
import os
from typing import Any, Dict, List, Optional, Set, Tuple

from fastapi import HTTPException, status
from git import GitCommandError

from models.git_content_search import (
    GitContentSearchData,
    GitContentSearchMatch,
    GitContentSearchRequest,
    GitContentSearchResponse,
)
from services.git.path_containment import resolve_within_repo as _resolve_within_repo
from services.git.paths import repo_path as git_repo_path
from services.git.shared_utils import get_git_repo_by_id, git_repo_manager

logger = logging.getLogger(__name__)

MAX_CONTENT_SEARCH_FILE_SIZE = 1024 * 1024
MAX_CONTENT_SEARCH_FILES = 5000
DEFAULT_HISTORY_MAX_COMMITS = 500


class GitFileSearchService:
    """Content search inside repository config files."""

    def search_file_content(
        self,
        repo_id: int,
        request: GitContentSearchRequest,
    ) -> Dict[str, Any]:
        """Search for a string inside repository config file contents."""
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")

        from config import settings

        extensions = settings.allowed_file_extensions

        if request.diff_mode:
            data = self._search_content_diff(repo_id, request, extensions)
        elif request.include_history:
            data = self._search_content_history(repo_id, request, extensions)
        else:
            data = self._search_content_current(
                repo_id, request, extensions, repository
            )

        return GitContentSearchResponse(data=data).model_dump()

    @staticmethod
    def _path_matches_filter(file_path: str, path_filter: str) -> bool:
        if not path_filter.strip():
            return True

        pattern = path_filter.strip()
        path_lower = file_path.lower()
        pattern_lower = pattern.lower()

        if "*" in pattern or "?" in pattern:
            return fnmatch.fnmatch(path_lower, pattern_lower) or fnmatch.fnmatch(
                os.path.basename(path_lower), pattern_lower
            )

        return path_lower.startswith(pattern_lower) or pattern_lower in path_lower

    @staticmethod
    def _has_allowed_extension(file_path: str, extensions: List[str]) -> bool:
        return any(file_path.endswith(ext) for ext in extensions)

    def _list_candidate_paths(
        self,
        repo_path: str,
        path_filter: str,
        extensions: List[str],
    ) -> List[str]:
        if not os.path.exists(repo_path):
            return []

        candidates: List[str] = []
        for root, _dirs, files in os.walk(repo_path):
            if ".git" in root:
                continue

            rel_root = os.path.relpath(root, repo_path)
            if rel_root == ".":
                rel_root = ""

            for file in files:
                if file.startswith("."):
                    continue

                rel_path = os.path.join(rel_root, file) if rel_root else file
                if not self._has_allowed_extension(rel_path, extensions):
                    continue
                if not self._path_matches_filter(rel_path, path_filter):
                    continue

                abs_path = os.path.join(root, file)
                if not os.path.isfile(abs_path):
                    continue
                if os.path.getsize(abs_path) > MAX_CONTENT_SEARCH_FILE_SIZE:
                    continue

                candidates.append(rel_path)
                if len(candidates) >= MAX_CONTENT_SEARCH_FILES:
                    return candidates

        candidates.sort()
        return candidates

    @staticmethod
    def _line_matches(line: str, query: str, case_sensitive: bool) -> bool:
        if case_sensitive:
            return query in line
        return query.lower() in line.lower()

    def _grep_file_content(
        self,
        content: str,
        query: str,
        case_sensitive: bool,
        file_path: str,
        match_source: str,
        commit: Optional[str] = None,
        commit_message: Optional[str] = None,
        commit_date: Optional[str] = None,
        change_type: Optional[str] = None,
    ) -> List[GitContentSearchMatch]:
        lines = content.splitlines()
        matches: List[GitContentSearchMatch] = []

        for idx, line in enumerate(lines, start=1):
            if not self._line_matches(line, query, case_sensitive):
                continue

            matches.append(
                GitContentSearchMatch(
                    file_path=file_path,
                    line_number=idx,
                    line_content=line,
                    context_before=lines[idx - 2] if idx > 1 else None,
                    context_after=lines[idx] if idx < len(lines) else None,
                    commit=commit,
                    commit_message=commit_message,
                    commit_date=commit_date,
                    match_source=match_source,
                    change_type=change_type,
                )
            )

        return matches

    @staticmethod
    def _read_text_file(abs_path: str) -> Optional[str]:
        try:
            with open(abs_path, encoding="utf-8") as handle:
                return handle.read()
        except (UnicodeDecodeError, OSError):
            return None

    @staticmethod
    def _read_blob_at_commit(
        repo: Any,
        commit_hash: str,
        file_path: str,
    ) -> Optional[str]:
        try:
            commit = repo.commit(commit_hash)
            raw = (commit.tree / file_path).data_stream.read()
            return raw.decode("utf-8")
        except (KeyError, UnicodeDecodeError, AttributeError, OSError):
            return None

    def _paginate_matches(
        self,
        all_matches: List[GitContentSearchMatch],
        request: GitContentSearchRequest,
        files_scanned: int,
        search_mode: str,
    ) -> GitContentSearchData:
        total = len(all_matches)
        page = all_matches[request.offset : request.offset + request.limit]
        truncated = total > request.offset + request.limit

        return GitContentSearchData(
            matches=page,
            total_matches=total,
            files_scanned=files_scanned,
            truncated=truncated,
            search_mode=search_mode,
        )

    def _search_content_current(
        self,
        repo_id: int,
        request: GitContentSearchRequest,
        extensions: List[str],
        repository: Dict[str, Any],
    ) -> GitContentSearchData:
        repo_path = str(git_repo_path(repository))
        candidate_paths = self._list_candidate_paths(
            repo_path, request.path_filter, extensions
        )

        head_commit: Optional[str] = None
        try:
            repo = get_git_repo_by_id(repo_id)
            head_commit = repo.head.commit.hexsha[:8]
        except Exception:
            logger.debug("Could not resolve HEAD commit for repo %s", repo_id)

        all_matches: List[GitContentSearchMatch] = []
        files_scanned = 0

        for rel_path in candidate_paths:
            try:
                abs_path = _resolve_within_repo(repo_path, rel_path)
            except HTTPException:
                logger.warning(
                    "Skipping candidate outside repo during search: %s", rel_path
                )
                continue
            content = self._read_text_file(abs_path)
            files_scanned += 1
            if content is None:
                continue

            all_matches.extend(
                self._grep_file_content(
                    content,
                    request.query,
                    request.case_sensitive,
                    rel_path,
                    match_source="current",
                    commit=head_commit,
                )
            )

        return self._paginate_matches(
            all_matches, request, files_scanned, search_mode="current"
        )

    def _search_content_history(
        self,
        repo_id: int,
        request: GitContentSearchRequest,
        extensions: List[str],
    ) -> GitContentSearchData:
        repository = git_repo_manager.get_repository(repo_id)
        if not repository:
            raise HTTPException(status_code=404, detail="Repository not found")

        repo_path = str(git_repo_path(repository))
        candidate_paths = self._list_candidate_paths(
            repo_path, request.path_filter, extensions
        )

        repo = get_git_repo_by_id(repo_id)
        max_commits = DEFAULT_HISTORY_MAX_COMMITS
        try:
            from services.settings.manager import SettingsManager

            cache_cfg = SettingsManager().get_cache_settings()
            max_commits = int(cache_cfg.get("max_commits", DEFAULT_HISTORY_MAX_COMMITS))
        except Exception:
            pass

        all_matches: List[GitContentSearchMatch] = []
        seen: Set[Tuple[str, str, int]] = set()
        files_scanned = 0

        for rel_path in candidate_paths:
            files_scanned += 1
            for commit in repo.iter_commits(paths=rel_path, max_count=max_commits):
                content = self._read_blob_at_commit(repo, commit.hexsha, rel_path)
                if content is None:
                    continue

                commit_short = commit.hexsha[:8]
                for match in self._grep_file_content(
                    content,
                    request.query,
                    request.case_sensitive,
                    rel_path,
                    match_source="history",
                    commit=commit_short,
                    commit_message=commit.message.strip(),
                    commit_date=commit.committed_datetime.isoformat(),
                ):
                    key = (match.file_path, commit_short, match.line_number)
                    if key in seen:
                        continue
                    seen.add(key)
                    all_matches.append(match)

        return self._paginate_matches(
            all_matches, request, files_scanned, search_mode="history"
        )

    def _grep_diff_content(
        self,
        content1: str,
        content2: str,
        query: str,
        case_sensitive: bool,
        file_path: str,
        commit1: str,
        commit2: str,
    ) -> List[GitContentSearchMatch]:
        lines1 = content1.splitlines()
        lines2 = content2.splitlines()
        matches: List[GitContentSearchMatch] = []
        matcher = difflib.SequenceMatcher(None, lines1, lines2)

        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == "equal":
                continue

            if tag in ("delete", "replace"):
                for offset, line in enumerate(lines1[i1:i2]):
                    if not self._line_matches(line, query, case_sensitive):
                        continue
                    line_number = i1 + offset + 1
                    change_type = "remove" if tag == "delete" else "replace"
                    matches.append(
                        GitContentSearchMatch(
                            file_path=file_path,
                            line_number=line_number,
                            line_content=line,
                            context_before=lines1[line_number - 2]
                            if line_number > 1
                            else None,
                            context_after=lines1[line_number]
                            if line_number < len(lines1)
                            else None,
                            commit=f"{commit1[:8]}..{commit2[:8]}",
                            match_source="diff",
                            change_type=change_type,
                        )
                    )

            if tag in ("insert", "replace"):
                for offset, line in enumerate(lines2[j1:j2]):
                    if not self._line_matches(line, query, case_sensitive):
                        continue
                    line_number = j1 + offset + 1
                    change_type = "add" if tag == "insert" else "replace"
                    matches.append(
                        GitContentSearchMatch(
                            file_path=file_path,
                            line_number=line_number,
                            line_content=line,
                            context_before=lines2[line_number - 2]
                            if line_number > 1
                            else None,
                            context_after=lines2[line_number]
                            if line_number < len(lines2)
                            else None,
                            commit=f"{commit1[:8]}..{commit2[:8]}",
                            match_source="diff",
                            change_type=change_type,
                        )
                    )

        return matches

    def _search_content_diff(
        self,
        repo_id: int,
        request: GitContentSearchRequest,
        extensions: List[str],
    ) -> GitContentSearchData:
        commit1 = request.commit1 or ""
        commit2 = request.commit2 or ""

        repo = get_git_repo_by_id(repo_id)
        try:
            repo.commit(commit1)
            repo.commit(commit2)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid commit hash: %s" % exc,
            ) from exc

        try:
            changed_output = repo.git.diff("--name-only", commit1, commit2)
        except GitCommandError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to diff commits: %s" % exc,
            ) from exc

        changed_paths = [
            path.strip() for path in changed_output.splitlines() if path.strip()
        ]

        filtered_paths = [
            path
            for path in changed_paths
            if self._has_allowed_extension(path, extensions)
            and self._path_matches_filter(path, request.path_filter)
        ]

        all_matches: List[GitContentSearchMatch] = []
        files_scanned = 0

        for file_path in filtered_paths:
            files_scanned += 1
            content1 = self._read_blob_at_commit(repo, commit1, file_path) or ""
            content2 = self._read_blob_at_commit(repo, commit2, file_path) or ""
            all_matches.extend(
                self._grep_diff_content(
                    content1,
                    content2,
                    request.query,
                    request.case_sensitive,
                    file_path,
                    commit1,
                    commit2,
                )
            )

        return self._paginate_matches(
            all_matches, request, files_scanned, search_mode="diff"
        )
