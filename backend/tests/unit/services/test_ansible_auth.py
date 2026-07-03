"""Unit tests for services/cockpit_agent/ansible_auth.py."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from services.cockpit_agent.ansible_auth import (
    AnsibleAuthError,
    ResolvedAnsibleAuth,
    resolve_ansible_auth,
)


def _credentials_mock(username: str = "admin") -> MagicMock:
    credentials = MagicMock()
    credentials.get_credential_by_id.return_value = {"username": username}
    return credentials


@pytest.mark.unit
def test_invalid_auth_type_raises() -> None:
    with pytest.raises(AnsibleAuthError, match="Invalid auth_type"):
        resolve_ansible_auth(auth_type="bogus", credential_id=None, ansible_user=None)


@pytest.mark.unit
def test_ssh_key_mode_requires_ansible_user() -> None:
    with pytest.raises(AnsibleAuthError, match="SSH username is required"):
        resolve_ansible_auth(auth_type="ssh_key", credential_id=None, ansible_user=None)


@pytest.mark.unit
def test_ssh_key_mode_resolves_without_credential_lookup() -> None:
    credentials_service = _credentials_mock()
    result = resolve_ansible_auth(
        auth_type="ssh_key",
        credential_id=None,
        ansible_user="svcuser",
        credentials_service=credentials_service,
    )

    assert result == ResolvedAnsibleAuth(
        use_sshkey=True, ansible_user="svcuser", credential_id=None
    )
    credentials_service.get_credential_by_id.assert_not_called()


@pytest.mark.unit
def test_ssh_key_passphrase_mode_requires_credential_id() -> None:
    with pytest.raises(AnsibleAuthError, match="No credential_id specified"):
        resolve_ansible_auth(
            auth_type="ssh_key_passphrase", credential_id=None, ansible_user=None
        )


@pytest.mark.unit
def test_ssh_key_passphrase_mode_resolves_username_from_credential() -> None:
    credentials_service = _credentials_mock("keyuser")
    result = resolve_ansible_auth(
        auth_type="ssh_key_passphrase",
        credential_id=5,
        ansible_user=None,
        credentials_service=credentials_service,
    )

    assert result == ResolvedAnsibleAuth(
        use_sshkey=True, ansible_user="keyuser", credential_id=5
    )


@pytest.mark.unit
def test_credentials_mode_requires_credential_id() -> None:
    with pytest.raises(AnsibleAuthError, match="No credential_id specified"):
        resolve_ansible_auth(
            auth_type="credentials", credential_id=None, ansible_user=None
        )


@pytest.mark.unit
def test_credentials_mode_resolves_username_from_credential() -> None:
    credentials_service = _credentials_mock("admin")
    result = resolve_ansible_auth(
        auth_type="credentials",
        credential_id=5,
        ansible_user=None,
        credentials_service=credentials_service,
    )

    assert result == ResolvedAnsibleAuth(
        use_sshkey=False, ansible_user="admin", credential_id=5
    )


@pytest.mark.unit
def test_credential_not_found_raises() -> None:
    credentials_service = MagicMock()
    credentials_service.get_credential_by_id.return_value = None

    with pytest.raises(AnsibleAuthError, match="Credential 5 not found"):
        resolve_ansible_auth(
            auth_type="credentials",
            credential_id=5,
            ansible_user=None,
            credentials_service=credentials_service,
        )


@pytest.mark.unit
def test_credential_missing_username_raises() -> None:
    credentials_service = MagicMock()
    credentials_service.get_credential_by_id.return_value = {"username": None}

    with pytest.raises(AnsibleAuthError, match="has no username"):
        resolve_ansible_auth(
            auth_type="credentials",
            credential_id=5,
            ansible_user=None,
            credentials_service=credentials_service,
        )
