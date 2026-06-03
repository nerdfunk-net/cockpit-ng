"""Unit tests for services/git/auth.py."""

from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

import pytest

from services.git.auth import GitAuthenticationService


@pytest.fixture
def auth() -> GitAuthenticationService:
    return GitAuthenticationService()


@pytest.mark.unit
def test_resolve_credentials_no_credential_name(auth: GitAuthenticationService) -> None:
    result = auth.resolve_credentials({"auth_type": "token"})

    assert result == (None, None, None)


@pytest.mark.unit
def test_resolve_credentials_token_success(auth: GitAuthenticationService) -> None:
    cred_mgr = MagicMock()
    cred_mgr.list_credentials.return_value = [
        {"id": 1, "name": "github", "type": "token", "username": "git-user"},
    ]
    cred_mgr.get_decrypted_password.return_value = "secret-token"

    with patch("service_factory.build_credentials_service", return_value=cred_mgr):
        user, token, ssh = auth.resolve_credentials(
            {"auth_type": "token", "credential_name": "github"}
        )

    assert user == "git-user"
    assert token == "secret-token"
    assert ssh is None


@pytest.mark.unit
def test_resolve_credentials_ssh_key(auth: GitAuthenticationService) -> None:
    cred_mgr = MagicMock()
    cred_mgr.list_credentials.return_value = [
        {"id": 2, "name": "deploy", "type": "ssh_key", "username": "git"},
    ]
    cred_mgr.get_ssh_key_path.return_value = "/keys/deploy"

    with patch("service_factory.build_credentials_service", return_value=cred_mgr):
        user, token, ssh = auth.resolve_credentials(
            {"auth_type": "ssh_key", "credential_name": "deploy"}
        )

    assert ssh == "/keys/deploy"
    assert token is None


@pytest.mark.unit
def test_build_auth_url_injects_credentials(auth: GitAuthenticationService) -> None:
    url = auth.build_auth_url(
        "https://github.com/org/repo.git",
        "user",
        "token/with/slash",
    )

    assert "user:" in url
    assert "@github.com" in url


@pytest.mark.unit
def test_build_auth_url_skips_ssh(auth: GitAuthenticationService) -> None:
    url = "git@github.com:org/repo.git"
    assert auth.build_auth_url(url, "u", "t") == url


@pytest.mark.unit
def test_normalize_url_strips_userinfo(auth: GitAuthenticationService) -> None:
    normalized = auth.normalize_url("https://user:pass@host.com/repo.git")

    assert "user" not in normalized
    assert "host.com" in normalized


@pytest.mark.unit
def test_setup_auth_environment_ssh_sets_git_ssh_command(
    auth: GitAuthenticationService,
) -> None:
    repo = {
        "auth_type": "ssh_key",
        "credential_name": "key",
        "url": "git@github.com:org/repo.git",
        "name": "repo",
    }
    cred_mgr = MagicMock()
    cred_mgr.list_credentials.return_value = [
        {"id": 1, "name": "key", "type": "ssh_key", "username": "git"},
    ]
    cred_mgr.get_ssh_key_path.return_value = "/tmp/key"

    original = os.environ.get("GIT_SSH_COMMAND")
    try:
        with patch("service_factory.build_credentials_service", return_value=cred_mgr):
            with auth.setup_auth_environment(repo) as (url, *_):
                assert "GIT_SSH_COMMAND" in os.environ
                assert "/tmp/key" in os.environ["GIT_SSH_COMMAND"]
                assert url == repo["url"]
    finally:
        if original is None:
            os.environ.pop("GIT_SSH_COMMAND", None)
        else:
            os.environ["GIT_SSH_COMMAND"] = original
