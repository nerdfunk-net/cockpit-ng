"""Unit tests for services/git/diff.py."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from services.git.diff import GitDiffService


class _FakeBlob:
    def __init__(self, text: str) -> None:
        self._data = text.encode("utf-8")

    @property
    def data_stream(self) -> MagicMock:
        stream = MagicMock()
        stream.read.return_value = self._data
        return stream


class _FakeTree:
    def __init__(self, files: dict[str, str]) -> None:
        self._files = files

    def __getitem__(self, path: str) -> _FakeBlob:
        if path not in self._files:
            raise KeyError(path)
        return _FakeBlob(self._files[path])


class _FakeCommit:
    def __init__(self, files: dict[str, str]) -> None:
        self.tree = _FakeTree(files)


def _fake_repo(commits: dict[str, _FakeCommit]) -> MagicMock:
    repo = MagicMock()

    def _commit(ref: str) -> _FakeCommit:
        if ref not in commits:
            raise KeyError(ref)
        return commits[ref]

    repo.commit.side_effect = _commit
    return repo


@pytest.fixture
def svc() -> GitDiffService:
    return GitDiffService()


@pytest.mark.unit
def test_unified_diff_detects_changes(svc: GitDiffService) -> None:
    lines1 = ["alpha\n", "beta\n"]
    lines2 = ["alpha\n", "gamma\n"]

    diff = svc.unified_diff(lines1, lines2)

    assert any(line.startswith("-beta") for line in diff)
    assert any(line.startswith("+gamma") for line in diff)


@pytest.mark.unit
def test_calculate_diff_stats_counts_additions_and_deletions(
    svc: GitDiffService,
) -> None:
    diff_lines = [
        "--- a",
        "+++ b",
        "-old",
        "+new",
        " context",
    ]

    stats = svc.calculate_diff_stats(diff_lines)

    assert stats.additions == 1
    assert stats.deletions == 1


@pytest.mark.unit
def test_line_by_line_diff_parses_add_remove_context(svc: GitDiffService) -> None:
    content1 = "keep\nremove\n"
    content2 = "keep\nadd\n"

    parsed, stats = svc.line_by_line_diff(content1, content2)

    types = {line.type for line in parsed}
    assert "add" in types
    assert "remove" in types
    assert stats.additions >= 1
    assert stats.deletions >= 1


@pytest.mark.unit
def test_compare_text_content_returns_diff_result(svc: GitDiffService) -> None:
    result = svc.compare_text_content("one\n", "two\n")

    assert result.diff_lines
    assert result.line_by_line
    assert result.stats.additions >= 1
    assert result.stats.deletions >= 1


@pytest.mark.unit
def test_compare_file_versions_reads_both_commits(svc: GitDiffService) -> None:
    repo = _fake_repo(
        {
            "aaa": _FakeCommit({"cfg.txt": "v1\n"}),
            "bbb": _FakeCommit({"cfg.txt": "v2\n"}),
        }
    )

    result = svc.compare_file_versions(repo, "cfg.txt", "aaa", "bbb")

    assert result.stats.additions >= 1
    assert any(line.type == "remove" for line in result.line_by_line)


@pytest.mark.unit
def test_compare_file_versions_treats_missing_file_as_empty(
    svc: GitDiffService,
) -> None:
    repo = _fake_repo(
        {
            "aaa": _FakeCommit({}),
            "bbb": _FakeCommit({"new.txt": "content\n"}),
        }
    )

    result = svc.compare_file_versions(repo, "new.txt", "aaa", "bbb")

    assert result.stats.additions >= 1


@pytest.mark.unit
def test_compare_file_versions_raises_on_invalid_commit(
    svc: GitDiffService,
) -> None:
    repo = MagicMock()
    repo.commit.side_effect = ValueError("bad ref")

    with pytest.raises(ValueError, match="bad ref"):
        svc.compare_file_versions(repo, "f.txt", "aaa", "bbb")


@pytest.mark.unit
def test_compare_files_across_repos(svc: GitDiffService) -> None:
    repo1 = _fake_repo({"HEAD": _FakeCommit({"shared.yml": "left\n"})})
    repo2 = _fake_repo({"HEAD": _FakeCommit({"shared.yml": "right\n"})})

    result = svc.compare_files_across_repos(repo1, repo2, "shared.yml")

    assert result.stats.additions >= 1
    assert result.stats.deletions >= 1


@pytest.mark.unit
def test_compare_files_across_repos_missing_in_one_repo(
    svc: GitDiffService,
) -> None:
    repo1 = _fake_repo({"HEAD": _FakeCommit({})})
    repo2 = _fake_repo({"HEAD": _FakeCommit({"only-here.txt": "x\n"})})

    result = svc.compare_files_across_repos(repo1, repo2, "only-here.txt")

    assert result.stats.additions >= 1


@pytest.mark.unit
def test_compare_file_versions_missing_in_second_commit(
    svc: GitDiffService,
) -> None:
    repo = _fake_repo(
        {
            "aaa": _FakeCommit({"gone.txt": "was here\n"}),
            "bbb": _FakeCommit({}),
        }
    )

    result = svc.compare_file_versions(repo, "gone.txt", "aaa", "bbb")

    assert result.stats.deletions >= 1


@pytest.mark.unit
def test_compare_files_across_repos_missing_in_second_repo(
    svc: GitDiffService,
) -> None:
    repo1 = _fake_repo({"HEAD": _FakeCommit({"shared.txt": "left\n"})})
    repo2 = _fake_repo({"HEAD": _FakeCommit({})})

    result = svc.compare_files_across_repos(repo1, repo2, "shared.txt")

    assert result.stats.deletions >= 1


@pytest.mark.unit
def test_compare_files_across_repos_raises_on_commit_error(
    svc: GitDiffService,
) -> None:
    repo1 = MagicMock()
    repo1.commit.side_effect = OSError("disk error")
    repo2 = _fake_repo({"HEAD": _FakeCommit({})})

    with pytest.raises(OSError, match="disk error"):
        svc.compare_files_across_repos(repo1, repo2, "f.txt")
