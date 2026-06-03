"""Unit tests for services/git/paths.py."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

import pytest

from services.git.paths import repo_path


@pytest.mark.unit
def test_repo_path_uses_repository_path_when_set() -> None:
    with patch("config.settings.data_directory", "/data"):
        result = repo_path({"name": "my-repo", "path": "configs/agent"})

    assert result == Path("/data/git/configs/agent")


@pytest.mark.unit
def test_repo_path_falls_back_to_name() -> None:
    with patch("config.settings.data_directory", "/data"):
        result = repo_path({"name": "inventory-repo"})

    assert result == Path("/data/git/inventory-repo")
