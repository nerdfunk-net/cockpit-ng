"""Unit tests for services/git/env.py and shared_utils.py."""

from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from services.git.env import set_ssl_env
from services.git import shared_utils


@pytest.mark.unit
def test_set_ssl_env_disables_verify_and_restores() -> None:
    original = os.environ.get("GIT_SSL_NO_VERIFY")
    repo = {"verify_ssl": False, "ssl_ca_info": "/ca.pem", "ssl_cert": "/cert.pem"}

    with set_ssl_env(repo):
        assert os.environ.get("GIT_SSL_NO_VERIFY") == "1"
        assert os.environ.get("GIT_SSL_CA_INFO") == "/ca.pem"
        assert os.environ.get("GIT_SSL_CERT") == "/cert.pem"

    if original is None:
        assert "GIT_SSL_NO_VERIFY" not in os.environ
    else:
        assert os.environ.get("GIT_SSL_NO_VERIFY") == original


@pytest.mark.unit
def test_get_git_repositories_by_category_opens_repos() -> None:
    repo_dict = {"name": "templates", "id": 1}
    git_service = MagicMock()
    git_service.open_or_clone.return_value = MagicMock(name="Repo")

    with (
        patch.object(
            shared_utils.git_repo_manager,
            "get_repositories_by_category",
            return_value=[repo_dict],
        ),
        patch(
            "service_factory.build_git_service",
            return_value=git_service,
        ),
    ):
        repos = shared_utils.get_git_repositories_by_category("templates")

    assert len(repos) == 1
    git_service.open_or_clone.assert_called_once_with(repo_dict)


@pytest.mark.unit
def test_get_git_repo_by_id_not_found() -> None:
    with patch.object(
        shared_utils.git_repo_manager,
        "get_repository",
        return_value=None,
    ):
        with pytest.raises(HTTPException) as exc_info:
            shared_utils.get_git_repo_by_id(99)

    assert exc_info.value.status_code == 404


@pytest.mark.unit
def test_get_git_repo_by_id_inactive() -> None:
    with patch.object(
        shared_utils.git_repo_manager,
        "get_repository",
        return_value={"id": 1, "name": "r1", "is_active": False},
    ):
        with pytest.raises(HTTPException) as exc_info:
            shared_utils.get_git_repo_by_id(1)

    assert exc_info.value.status_code == 400
