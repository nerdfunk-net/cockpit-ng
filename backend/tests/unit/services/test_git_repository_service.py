"""Unit tests for services/settings/git/repository_service.py.

All tests run offline — GitRepositoryRepository is patched.
"""

from __future__ import annotations

from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest

from services.settings.git.repository_service import GitRepositoryService

_PATCH_REPO = "services.settings.git.repository_service.GitRepositoryRepository"


def _make_repo_obj(
    *,
    id: int = 1,
    name: str = "my-repo",
    category: str = "templates",
    url: str = "https://github.com/org/repo",
    branch: str = "main",
    auth_type: str = "token",
    credential_name: str | None = None,
    path: str | None = None,
    verify_ssl: bool = True,
    git_author_name: str | None = None,
    git_author_email: str | None = None,
    description: str | None = None,
    is_active: bool = True,
    last_sync: datetime | None = None,
    sync_status: str | None = None,
    created_at: datetime | None = None,
    updated_at: datetime | None = None,
) -> MagicMock:
    obj = MagicMock()
    obj.id = id
    obj.name = name
    obj.category = category
    obj.url = url
    obj.branch = branch
    obj.auth_type = auth_type
    obj.credential_name = credential_name
    obj.path = path
    obj.verify_ssl = verify_ssl
    obj.git_author_name = git_author_name
    obj.git_author_email = git_author_email
    obj.description = description
    obj.is_active = is_active
    obj.last_sync = last_sync
    obj.sync_status = sync_status
    obj.created_at = created_at
    obj.updated_at = updated_at
    return obj


# ── create_repository ─────────────────────────────────────────────────────────


@pytest.mark.unit
def test_create_repository_returns_new_id():
    """create_repository() returns the ID of the newly created record."""
    new_obj = _make_repo_obj(id=42)
    mock_repo = MagicMock()
    mock_repo.name_exists.return_value = False
    mock_repo.create.return_value = new_obj

    with patch(_PATCH_REPO, return_value=mock_repo):
        svc = GitRepositoryService()
        result = svc.create_repository(
            {"name": "my-repo", "category": "templates", "url": "https://github.com/x"}
        )

    assert result == 42


@pytest.mark.unit
def test_create_repository_raises_when_name_exists():
    """create_repository() raises ValueError when the name is already taken."""
    mock_repo = MagicMock()
    mock_repo.name_exists.return_value = True

    with patch(_PATCH_REPO, return_value=mock_repo):
        svc = GitRepositoryService()
        with pytest.raises(ValueError, match="already exists"):
            svc.create_repository(
                {"name": "dup", "category": "templates", "url": "https://x"}
            )


# ── get_repository ────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_get_repository_returns_dict_when_found():
    """get_repository() returns a dict representation when the record exists."""
    mock_repo = MagicMock()
    mock_repo.get_by_id.return_value = _make_repo_obj(id=1, name="repo1")

    with patch(_PATCH_REPO, return_value=mock_repo):
        svc = GitRepositoryService()
        result = svc.get_repository(1)

    assert result is not None
    assert result["name"] == "repo1"
    assert result["id"] == 1


@pytest.mark.unit
def test_get_repository_returns_none_when_not_found():
    """get_repository() returns None when the record does not exist."""
    mock_repo = MagicMock()
    mock_repo.get_by_id.return_value = None

    with patch(_PATCH_REPO, return_value=mock_repo):
        svc = GitRepositoryService()
        result = svc.get_repository(999)

    assert result is None


# ── get_repositories ──────────────────────────────────────────────────────────


@pytest.mark.unit
def test_get_repositories_returns_list_of_dicts():
    """get_repositories() returns list of dict representations."""
    objs = [_make_repo_obj(id=1, name="r1"), _make_repo_obj(id=2, name="r2")]
    mock_repo = MagicMock()
    mock_repo.get_all.return_value = objs

    with patch(_PATCH_REPO, return_value=mock_repo):
        svc = GitRepositoryService()
        result = svc.get_repositories()

    assert len(result) == 2
    assert result[0]["name"] == "r1"


@pytest.mark.unit
def test_get_repositories_by_category_filters():
    """get_repositories_by_category() delegates to get_by_category with active_only=True."""
    mock_repo = MagicMock()
    mock_repo.get_by_category.return_value = [_make_repo_obj(category="templates")]

    with patch(_PATCH_REPO, return_value=mock_repo):
        svc = GitRepositoryService()
        result = svc.get_repositories_by_category("templates")

    mock_repo.get_by_category.assert_called_once_with("templates", True)
    assert len(result) == 1


# ── update_repository ─────────────────────────────────────────────────────────


@pytest.mark.unit
def test_update_repository_returns_true_on_valid_fields():
    """update_repository() calls repo.update and returns True."""
    mock_repo = MagicMock()
    mock_repo.get_by_name.return_value = None  # no name conflict

    with patch(_PATCH_REPO, return_value=mock_repo):
        svc = GitRepositoryService()
        result = svc.update_repository(1, {"branch": "develop"})

    assert result is True
    mock_repo.update.assert_called_once()


@pytest.mark.unit
def test_update_repository_returns_false_for_empty_payload():
    """update_repository() returns False when no valid fields are provided."""
    mock_repo = MagicMock()

    with patch(_PATCH_REPO, return_value=mock_repo):
        svc = GitRepositoryService()
        result = svc.update_repository(1, {"nonexistent_field": "x"})

    assert result is False
    mock_repo.update.assert_not_called()


@pytest.mark.unit
def test_update_repository_raises_on_duplicate_name():
    """update_repository() raises ValueError when renamed to an existing name."""
    conflict = _make_repo_obj(id=99, name="taken")
    mock_repo = MagicMock()
    mock_repo.get_by_name.return_value = conflict

    with patch(_PATCH_REPO, return_value=mock_repo):
        svc = GitRepositoryService()
        with pytest.raises(ValueError, match="already exists"):
            svc.update_repository(1, {"name": "taken"})


# ── delete_repository ─────────────────────────────────────────────────────────


@pytest.mark.unit
def test_delete_repository_hard_deletes_by_default():
    """delete_repository() calls repo.delete for hard delete."""
    mock_repo = MagicMock()

    with patch(_PATCH_REPO, return_value=mock_repo):
        svc = GitRepositoryService()
        result = svc.delete_repository(1)

    assert result is True
    mock_repo.delete.assert_called_once_with(1)


@pytest.mark.unit
def test_delete_repository_soft_deactivates():
    """delete_repository(hard_delete=False) deactivates instead of deleting."""
    mock_repo = MagicMock()

    with patch(_PATCH_REPO, return_value=mock_repo):
        svc = GitRepositoryService()
        result = svc.delete_repository(1, hard_delete=False)

    assert result is True
    mock_repo.update.assert_called_once()
    call_kwargs = mock_repo.update.call_args.kwargs
    assert call_kwargs["is_active"] is False


# ── update_sync_status ────────────────────────────────────────────────────────


@pytest.mark.unit
def test_update_sync_status_calls_repo_update():
    """update_sync_status() delegates to repo.update with sync fields."""
    mock_repo = MagicMock()

    with patch(_PATCH_REPO, return_value=mock_repo):
        svc = GitRepositoryService()
        result = svc.update_sync_status(1, "synced")

    assert result is True
    call_kwargs = mock_repo.update.call_args.kwargs
    assert call_kwargs["sync_status"] == "synced"


# ── health_check ──────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_health_check_returns_healthy():
    """health_check() returns status=healthy when repo responds."""
    objs = [
        _make_repo_obj(id=1, category="templates", is_active=True),
        _make_repo_obj(id=2, category="configs", is_active=False),
    ]
    mock_repo = MagicMock()
    mock_repo.get_all.return_value = objs

    with patch(_PATCH_REPO, return_value=mock_repo):
        svc = GitRepositoryService()
        result = svc.health_check()

    assert result["status"] == "healthy"
    assert result["total_repositories"] == 2
    assert result["active_repositories"] == 1


@pytest.mark.unit
def test_health_check_returns_error_on_exception():
    """health_check() returns status=error when repo raises."""
    mock_repo = MagicMock()
    mock_repo.get_all.side_effect = RuntimeError("DB offline")

    with patch(_PATCH_REPO, return_value=mock_repo):
        svc = GitRepositoryService()
        result = svc.health_check()

    assert result["status"] == "error"
