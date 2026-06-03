"""Unit tests for services/settings/credentials_service.py."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from services.settings.credentials_service import CredentialsService
from services.settings.exceptions import (
    CredentialMissingFieldError,
    CredentialNotFoundError,
)

_PATCH_REPO = "services.settings.credentials_service.CredentialsRepository"
_PATCH_ENCRYPT = "services.settings.credentials_service.EncryptionService"


def _cred(**kwargs: object) -> SimpleNamespace:
    defaults: dict = {
        "id": 1,
        "name": "router-login",
        "username": "admin",
        "type": "password",
        "password_encrypted": b"enc-pw",
        "ssh_key_encrypted": None,
        "ssh_passphrase_encrypted": None,
        "valid_until": None,
        "source": "general",
        "owner": None,
        "is_active": True,
        "created_at": datetime(2024, 1, 1),
        "updated_at": datetime(2024, 1, 1),
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def _service(mock_repo: MagicMock) -> CredentialsService:
    with patch(_PATCH_REPO, return_value=mock_repo):
        with patch(_PATCH_ENCRYPT) as enc:
            enc.return_value.encrypt.side_effect = lambda v: f"enc:{v}".encode()
            enc.return_value.decrypt.side_effect = lambda v: v.decode().replace("enc:", "")
            return CredentialsService()


@pytest.mark.unit
def test_list_credentials_filters_expired() -> None:
    mock_repo = MagicMock()
    today = datetime.now(timezone.utc).date()
    expired_date = (today - timedelta(days=1)).isoformat()
    mock_repo.get_all.return_value = [
        _cred(id=1, valid_until=None),
        _cred(id=2, valid_until=expired_date),
    ]
    svc = _service(mock_repo)

    items = svc.list_credentials(include_expired=False)

    assert len(items) == 1
    assert items[0]["id"] == 1


@pytest.mark.unit
def test_get_credential_by_id_returns_none_when_missing() -> None:
    mock_repo = MagicMock()
    mock_repo.get_by_id.return_value = None
    svc = _service(mock_repo)

    assert svc.get_credential_by_id(99) is None


@pytest.mark.unit
def test_create_credential_encrypts_password() -> None:
    mock_repo = MagicMock()
    mock_repo.create.return_value = _cred()
    svc = _service(mock_repo)

    result = svc.create_credential(
        name="lab",
        username="root",
        cred_type="password",
        password="secret",
    )

    assert result["name"] == "router-login"
    mock_repo.create.assert_called_once()
    assert mock_repo.create.call_args.kwargs["password_encrypted"] == b"enc:secret"


@pytest.mark.unit
def test_update_credential_raises_when_not_found() -> None:
    mock_repo = MagicMock()
    mock_repo.get_by_id.return_value = None
    svc = _service(mock_repo)

    with pytest.raises(CredentialNotFoundError):
        svc.update_credential(5, name="x")


@pytest.mark.unit
def test_get_decrypted_password_raises_when_missing_field() -> None:
    mock_repo = MagicMock()
    mock_repo.get_by_id.return_value = _cred(password_encrypted=None)
    svc = _service(mock_repo)

    with pytest.raises(CredentialMissingFieldError):
        svc.get_decrypted_password(1)


@pytest.mark.unit
def test_get_decrypted_password_returns_plaintext() -> None:
    mock_repo = MagicMock()
    mock_repo.get_by_id.return_value = _cred(password_encrypted=b"enc:pw")
    svc = _service(mock_repo)

    assert svc.get_decrypted_password(1) == "pw"


@pytest.mark.unit
def test_ssh_key_filename_prefix_private_owner() -> None:
    mock_repo = MagicMock()
    svc = _service(mock_repo)

    assert svc._ssh_key_filename_prefix("private", "alice") == "alice_"
    assert svc._ssh_key_filename_prefix("general") == "global_"


@pytest.mark.unit
def test_delete_credential_removes_ssh_file() -> None:
    mock_repo = MagicMock()
    mock_repo.get_by_id.return_value = _cred(type="ssh_key", name="deploy-key")
    svc = _service(mock_repo)

    with patch.object(svc, "_delete_ssh_key_file", return_value=True) as delete_file:
        svc.delete_credential(1)

    delete_file.assert_called_once()
    mock_repo.delete.assert_called_once_with(1)


@pytest.mark.unit
def test_list_credentials_filters_by_source() -> None:
    mock_repo = MagicMock()
    mock_repo.get_by_source.return_value = [_cred(source="private")]
    svc = _service(mock_repo)

    items = svc.list_credentials(source="private")

    assert len(items) == 1
    mock_repo.get_by_source.assert_called_once_with("private")
    mock_repo.get_all.assert_not_called()


@pytest.mark.unit
def test_export_single_ssh_key_writes_file(tmp_path) -> None:
    mock_repo = MagicMock()
    mock_repo.get_by_id.return_value = _cred(
        type="ssh_key",
        name="deploy",
        ssh_key_encrypted=b"enc:ssh-rsa AAA",
        source="general",
    )
    svc = _service(mock_repo)

    with patch.object(svc, "_ssh_keys_directory", return_value=str(tmp_path)):
        path = svc.export_single_ssh_key(1)

    assert path is not None
    assert path.endswith("global_deploy")
    assert os.path.exists(path)


@pytest.mark.unit
def test_update_credential_updates_fields() -> None:
    mock_repo = MagicMock()
    mock_repo.get_by_id.return_value = _cred()
    mock_repo.update.return_value = _cred(name="renamed")
    svc = _service(mock_repo)

    result = svc.update_credential(1, name="renamed")

    assert result["name"] == "renamed"
    mock_repo.update.assert_called_once()


@pytest.mark.unit
def test_get_decrypted_ssh_key_returns_plaintext() -> None:
    mock_repo = MagicMock()
    mock_repo.get_by_id.return_value = _cred(
        type="ssh_key",
        ssh_key_encrypted=b"enc:key-data",
    )
    svc = _service(mock_repo)

    assert svc.get_decrypted_ssh_key(1) == "key-data"


@pytest.mark.unit
def test_to_dict_marks_expiring_status() -> None:
    mock_repo = MagicMock()
    svc = _service(mock_repo)
    today = datetime.now(timezone.utc).date()
    soon = (today + timedelta(days=3)).isoformat()
    result = svc._to_dict(_cred(valid_until=soon))

    assert result["status"] == "expiring"


@pytest.mark.unit
def test_has_ssh_key_true_when_key_present() -> None:
    mock_repo = MagicMock()
    mock_repo.get_by_id.return_value = _cred(
        type="ssh_key",
        ssh_key_encrypted=b"enc:key",
    )
    svc = _service(mock_repo)
    assert svc.has_ssh_key(1) is True


@pytest.mark.unit
def test_get_decrypted_ssh_passphrase_returns_none_when_missing() -> None:
    mock_repo = MagicMock()
    mock_repo.get_by_id.return_value = _cred(type="ssh_key")
    svc = _service(mock_repo)
    assert svc.get_decrypted_ssh_passphrase(1) is None


@pytest.mark.unit
def test_delete_credentials_by_owner() -> None:
    mock_repo = MagicMock()
    mock_repo.delete_by_owner.return_value = 3
    svc = _service(mock_repo)
    assert svc.delete_credentials_by_owner("alice") == 3


@pytest.mark.unit
def test_get_ssh_key_path_returns_existing_file(tmp_path) -> None:
    mock_repo = MagicMock()
    mock_repo.get_by_id.return_value = _cred(
        type="ssh_key",
        name="deploy",
        ssh_key_encrypted=b"enc:ssh-rsa AAA",
    )
    svc = _service(mock_repo)
    key_dir = tmp_path / "keys"
    key_dir.mkdir()
    key_file = key_dir / "global_deploy"
    key_file.write_text("ssh-rsa AAA\n", encoding="utf-8")

    with patch.object(svc, "_ssh_keys_directory", return_value=str(key_dir)):
        path = svc.get_ssh_key_path(1)

    assert path == str(key_file)
