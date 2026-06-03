"""Unit tests for services/auth/profile_service.py."""

from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from services.auth import profile_service as svc

_PATCH_REPO = "services.auth.profile_service._profile_repo"
_PATCH_CRED_SVC = "service_factory.build_credentials_service"


def _profile(**kwargs: object) -> SimpleNamespace:
    defaults: dict = {
        "id": 1,
        "username": "alice",
        "realname": "Alice",
        "email": "alice@example.com",
        "debug_mode": False,
        "api_key": None,
        "created_at": datetime(2024, 1, 1, 12, 0, 0),
        "updated_at": datetime(2024, 1, 2, 12, 0, 0),
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


@pytest.mark.unit
def test_get_user_profile_returns_dict_when_found() -> None:
    mock_repo = MagicMock()
    mock_repo.get_by_username.return_value = _profile()

    with patch(_PATCH_REPO, mock_repo):
        result = svc.get_user_profile("alice")

    assert result["username"] == "alice"
    assert result["realname"] == "Alice"
    assert result["email"] == "alice@example.com"
    assert result["debug"] is False
    assert "2024-01-01" in result["created_at"]


@pytest.mark.unit
def test_get_user_profile_defaults_when_missing() -> None:
    mock_repo = MagicMock()
    mock_repo.get_by_username.return_value = None

    with patch(_PATCH_REPO, mock_repo):
        result = svc.get_user_profile("bob")

    assert result == {
        "username": "bob",
        "realname": "",
        "email": "",
        "debug": False,
        "api_key": None,
    }


@pytest.mark.unit
def test_update_user_profile_updates_existing() -> None:
    existing = _profile()
    updated = _profile(realname="Alice Updated", email="new@example.com")
    mock_repo = MagicMock()
    mock_repo.get_by_username.return_value = existing
    mock_repo.update.return_value = updated

    with patch(_PATCH_REPO, mock_repo):
        result = svc.update_user_profile(
            "alice", realname="Alice Updated", email="new@example.com"
        )

    assert result["realname"] == "Alice Updated"
    mock_repo.update.assert_called_once()
    update_kwargs = mock_repo.update.call_args.kwargs
    assert update_kwargs["realname"] == "Alice Updated"
    assert update_kwargs["email"] == "new@example.com"


@pytest.mark.unit
def test_update_user_profile_creates_when_missing() -> None:
    created = _profile(username="carol", realname="Carol", email="c@example.com")
    mock_repo = MagicMock()
    mock_repo.get_by_username.return_value = None
    mock_repo.create.return_value = created

    with patch(_PATCH_REPO, mock_repo):
        result = svc.update_user_profile("carol", realname="Carol", debug_mode=True)

    assert result["username"] == "carol"
    mock_repo.create.assert_called_once()
    create_kwargs = mock_repo.create.call_args.kwargs
    assert create_kwargs["username"] == "carol"
    assert create_kwargs["debug_mode"] is True


@pytest.mark.unit
def test_update_user_password_updates_existing_credential() -> None:
    cred_mgr = MagicMock()
    cred_mgr.list_credentials.return_value = [
        {"id": 9, "username": "alice", "status": "active"},
    ]
    mock_repo = MagicMock()

    with patch(_PATCH_REPO, mock_repo):
        with patch(_PATCH_CRED_SVC, return_value=cred_mgr):
            ok = svc.update_user_password("alice", "new-secret")

    assert ok is True
    cred_mgr.update_credential.assert_called_once_with(
        cred_id=9, password="new-secret"
    )
    cred_mgr.create_credential.assert_not_called()


@pytest.mark.unit
def test_update_user_password_creates_credential_when_missing() -> None:
    cred_mgr = MagicMock()
    cred_mgr.list_credentials.return_value = []

    with patch(_PATCH_REPO, MagicMock()):
        with patch(_PATCH_CRED_SVC, return_value=cred_mgr):
            ok = svc.update_user_password("dave", "pw")

    assert ok is True
    cred_mgr.create_credential.assert_called_once()
    assert cred_mgr.create_credential.call_args.kwargs["username"] == "dave"


@pytest.mark.unit
def test_update_user_password_returns_false_on_error() -> None:
    cred_mgr = MagicMock()
    cred_mgr.list_credentials.side_effect = RuntimeError("db down")

    with patch(_PATCH_REPO, MagicMock()):
        with patch(_PATCH_CRED_SVC, return_value=cred_mgr):
            ok = svc.update_user_password("alice", "pw")

    assert ok is False


@pytest.mark.unit
def test_delete_user_profile_success() -> None:
    mock_repo = MagicMock()
    mock_repo.delete_by_username.return_value = True

    with patch(_PATCH_REPO, mock_repo):
        assert svc.delete_user_profile("alice") is True


@pytest.mark.unit
def test_delete_user_profile_returns_false_on_error() -> None:
    mock_repo = MagicMock()
    mock_repo.delete_by_username.side_effect = RuntimeError("fail")

    with patch(_PATCH_REPO, mock_repo):
        assert svc.delete_user_profile("alice") is False
