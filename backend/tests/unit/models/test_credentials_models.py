"""Unit tests for models/credentials.py."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from models.credentials import CredentialCreate, CredentialUpdate


@pytest.mark.unit
def test_create_ssh_key_requires_private_key() -> None:
    with pytest.raises(ValidationError, match="SSH private key"):
        CredentialCreate(
            name="key",
            username="deploy",
            type="ssh_key",
        )


@pytest.mark.unit
def test_create_password_type_requires_password() -> None:
    with pytest.raises(ValidationError, match="Password is required"):
        CredentialCreate(
            name="login",
            username="admin",
            type="generic",
        )


@pytest.mark.unit
def test_create_ssh_key_valid() -> None:
    cred = CredentialCreate(
        name="deploy",
        username="deploy",
        type="ssh_key",
        ssh_private_key="-----BEGIN KEY-----",
    )
    assert cred.ssh_private_key is not None


@pytest.mark.unit
def test_create_rejects_invalid_type() -> None:
    with pytest.raises(ValidationError, match="Invalid credential type"):
        CredentialCreate(
            name="x",
            username="u",
            type="invalid",
            password="pw",
        )


@pytest.mark.unit
def test_update_allows_partial_fields() -> None:
    cred = CredentialUpdate(name="renamed")
    assert cred.name == "renamed"
