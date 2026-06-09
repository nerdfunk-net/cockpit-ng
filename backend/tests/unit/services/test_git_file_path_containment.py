"""Unit tests for the path-boundary containment check in GitFileService.

Guards against directory traversal and the sibling-directory bypass that a
bare ``startswith`` prefix check would allow (``/repos/myrepo-secret``
passing a ``/repos/myrepo`` containment test).
"""

import os

import pytest
from fastapi import HTTPException

from services.git.path_containment import resolve_within_repo as _resolve_within_repo


@pytest.fixture
def repo(tmp_path):
    repo_dir = tmp_path / "myrepo"
    repo_dir.mkdir()
    (repo_dir / "a").mkdir()
    (repo_dir / "a" / "b.txt").write_text("content")
    return repo_dir


@pytest.mark.unit
class TestResolveWithinRepo:
    def test_returns_joined_path_for_normal_file(self, repo):
        resolved = _resolve_within_repo(str(repo), "a/b.txt")
        assert resolved == os.path.realpath(str(repo / "a" / "b.txt"))

    def test_empty_path_resolves_to_repo_root(self, repo):
        resolved = _resolve_within_repo(str(repo), "")
        assert resolved == os.path.realpath(str(repo))

    def test_parent_traversal_raises_403(self, repo):
        with pytest.raises(HTTPException) as exc_info:
            _resolve_within_repo(str(repo), "../../etc/passwd")
        assert exc_info.value.status_code == 403

    def test_absolute_path_outside_repo_raises_403(self, repo):
        with pytest.raises(HTTPException) as exc_info:
            _resolve_within_repo(str(repo), "/etc/passwd")
        assert exc_info.value.status_code == 403

    def test_sibling_directory_prefix_bypass_raises_403(self, repo, tmp_path):
        # /tmp/x/myrepo-secret starts with /tmp/x/myrepo as a *string*,
        # but is outside the repo as a *path*.
        sibling = tmp_path / "myrepo-secret"
        sibling.mkdir()
        (sibling / "f").write_text("secret")

        with pytest.raises(HTTPException) as exc_info:
            _resolve_within_repo(str(repo), "../myrepo-secret/f")
        assert exc_info.value.status_code == 403

    def test_symlink_escape_raises_403(self, repo, tmp_path):
        outside = tmp_path / "outside.txt"
        outside.write_text("secret")
        (repo / "link.txt").symlink_to(outside)

        with pytest.raises(HTTPException) as exc_info:
            _resolve_within_repo(str(repo), "link.txt")
        assert exc_info.value.status_code == 403
