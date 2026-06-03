"""Unit tests for services/git/config.py."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from services.git.config import set_git_author


@pytest.mark.unit
def test_set_git_author_applies_and_restores_defaults() -> None:
    config_reader = MagicMock()
    config_reader.get_value.side_effect = Exception("unset")
    config_writer = MagicMock()

    repo = MagicMock()
    repo.config_reader.return_value = config_reader
    repo.config_writer.return_value = config_writer

    repository = {
        "git_author_name": "Test User",
        "git_author_email": "test@example.com",
    }

    with set_git_author(repository, repo):
        config_writer.set_value.assert_any_call("user", "name", "Test User")
        config_writer.set_value.assert_any_call("user", "email", "test@example.com")

    assert config_writer.release.call_count >= 2


@pytest.mark.unit
def test_set_git_author_restores_previous_values() -> None:
    config_reader = MagicMock()
    config_reader.get_value.side_effect = ["Old Name", "old@example.com"]
    config_writer = MagicMock()

    repo = MagicMock()
    repo.config_reader.return_value = config_reader
    repo.config_writer.return_value = config_writer

    with set_git_author({}, repo):
        pass

    config_writer.set_value.assert_any_call("user", "name", "Old Name")
    config_writer.set_value.assert_any_call("user", "email", "old@example.com")
