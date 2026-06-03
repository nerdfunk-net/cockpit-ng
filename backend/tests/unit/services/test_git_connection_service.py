"""Unit tests for services/git/connection.py."""

from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from subprocess import TimeoutExpired
from unittest.mock import MagicMock, patch

import pytest

from models.git_repositories import GitAuthType, GitConnectionTestRequest
from services.git.connection import GitConnectionService

_PATCH_SSL = "services.git.connection.set_ssl_env"
_PATCH_SUBPROCESS = "services.git.connection.subprocess.run"


@contextmanager
def _noop_ssl(_repo: dict):
    yield


def _request(**kwargs: object) -> GitConnectionTestRequest:
    defaults: dict = {
        "url": "https://example.com/org/repo.git",
        "branch": "main",
        "auth_type": GitAuthType.TOKEN,
        "verify_ssl": True,
    }
    defaults.update(kwargs)
    return GitConnectionTestRequest(**defaults)


def _service() -> GitConnectionService:
    svc = GitConnectionService()
    svc._auth.resolve_credentials = MagicMock(return_value=("git-user", "secret", None))
    svc._auth.build_auth_url = MagicMock(
        side_effect=lambda url, user, token: f"https://{user}:{token}@example.com/org/repo.git"
    )
    return svc


@pytest.mark.unit
def test_validate_credentials_ssh_key_missing() -> None:
    svc = _service()
    req = _request(auth_type=GitAuthType.SSH_KEY, credential_name="deploy-key")

    result = svc._validate_credentials(req, "ssh_key", "", "", "")

    assert result is not None
    assert result.success is False
    assert "SSH key" in result.message


@pytest.mark.unit
def test_validate_credentials_token_missing() -> None:
    svc = _service()
    req = _request(credential_name="github-token")

    result = svc._validate_credentials(req, "token", "user", "", "")

    assert result is not None
    assert "token" in result.message.lower()


@pytest.mark.unit
def test_validate_credentials_generic_missing() -> None:
    svc = _service()
    req = _request(auth_type=GitAuthType.GENERIC, credential_name="ci-user")

    result = svc._validate_credentials(req, "generic", "user", "", "")

    assert result is not None
    assert "generic" in result.message.lower()


@pytest.mark.unit
def test_validate_credentials_passes_when_resolved() -> None:
    svc = _service()
    req = _request(credential_name="github-token")

    result = svc._validate_credentials(req, "token", "user", "tok", "")

    assert result is None


@pytest.mark.unit
def test_build_clone_url_embeds_token_auth() -> None:
    svc = _service()
    req = _request()

    url = svc._build_clone_url(req, "token", "user", "tok")

    assert url.startswith("https://user:")
    svc._auth.build_auth_url.assert_called_once()


@pytest.mark.unit
def test_build_clone_url_unchanged_without_credentials() -> None:
    svc = _service()
    req = _request(url="https://example.com/plain.git")

    url = svc._build_clone_url(req, "none", "", "")

    assert url == "https://example.com/plain.git"
    svc._auth.build_auth_url.assert_not_called()


@pytest.mark.unit
def test_test_clone_success() -> None:
    svc = _service()
    req = _request()
    proc = MagicMock(returncode=0, stderr="")

    with patch(_PATCH_SUBPROCESS, return_value=proc) as run:
        result = svc._test_clone(
            clone_url="https://example.com/repo.git",
            branch="main",
            test_path=Path("/tmp/test_repo"),
            auth_type="token",
            ssh_key_path="",
            test_request=req,
        )

    assert result.success is True
    assert result.details["branch"] == "main"
    run.assert_called_once()
    env = run.call_args.kwargs["env"]
    assert "GIT_SSH_COMMAND" not in env


@pytest.mark.unit
def test_test_clone_failure_includes_stderr() -> None:
    svc = _service()
    req = _request()
    proc = MagicMock(returncode=128, stderr="fatal: repository not found")

    with patch(_PATCH_SUBPROCESS, return_value=proc):
        result = svc._test_clone(
            clone_url="https://example.com/missing.git",
            branch="main",
            test_path=Path("/tmp/test_repo"),
            auth_type="token",
            ssh_key_path="",
            test_request=req,
        )

    assert result.success is False
    assert "not found" in result.message
    assert result.details["return_code"] == 128


@pytest.mark.unit
def test_test_clone_sets_ssh_command_for_ssh_key() -> None:
    svc = _service()
    req = _request(auth_type=GitAuthType.SSH_KEY)
    proc = MagicMock(returncode=0, stderr="")

    with patch(_PATCH_SUBPROCESS, return_value=proc) as run:
        svc._test_clone(
            clone_url="git@github.com:org/repo.git",
            branch="main",
            test_path=Path("/tmp/test_repo"),
            auth_type="ssh_key",
            ssh_key_path="/keys/id_rsa",
            test_request=req,
        )

    env = run.call_args.kwargs["env"]
    assert 'ssh -i "/keys/id_rsa"' in env["GIT_SSH_COMMAND"]


@pytest.mark.unit
def test_test_connection_success() -> None:
    svc = _service()
    req = _request(username="inline", token="inline-token")
    proc = MagicMock(returncode=0, stderr="")

    with patch(_PATCH_SSL, _noop_ssl):
        with patch(_PATCH_SUBPROCESS, return_value=proc):
            result = svc.test_connection(req)

    assert result.success is True
    svc._auth.resolve_credentials.assert_called_once()


@pytest.mark.unit
def test_test_connection_returns_early_on_credential_validation() -> None:
    svc = _service()
    svc._auth.resolve_credentials.return_value = ("", "", "")
    req = _request(credential_name="missing-token")

    result = svc.test_connection(req)

    assert result.success is False
    assert "resolve credential" in result.message.lower()


@pytest.mark.unit
def test_test_connection_handles_timeout() -> None:
    svc = _service()
    req = _request()

    with patch(_PATCH_SSL, _noop_ssl):
        with patch(_PATCH_SUBPROCESS, side_effect=TimeoutExpired("git", 30)):
            result = svc.test_connection(req)

    assert result.success is False
    assert "timed out" in result.message.lower()


@pytest.mark.unit
def test_test_connection_handles_unexpected_error() -> None:
    svc = _service()
    req = _request()
    svc._auth.resolve_credentials.side_effect = RuntimeError("vault unavailable")

    result = svc.test_connection(req)

    assert result.success is False
    assert "vault unavailable" in result.message
