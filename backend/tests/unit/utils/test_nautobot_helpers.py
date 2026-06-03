"""Unit tests for utils/nautobot_helpers.py."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from utils.nautobot_helpers import get_nautobot_config, get_nautobot_headers


@pytest.mark.unit
def test_get_nautobot_headers_includes_token() -> None:
    headers = get_nautobot_headers("my-token")
    assert headers["Authorization"] == "Token my-token"
    assert headers["Content-Type"] == "application/json"


@pytest.mark.unit
def test_get_nautobot_config_from_database() -> None:
    mock_manager = MagicMock()
    mock_manager.get_nautobot_settings.return_value = {
        "url": "https://nb.example.com/",
        "token": "db-token",
    }

    with patch("services.settings.manager.SettingsManager", return_value=mock_manager):
        url, token = get_nautobot_config()

    assert url == "https://nb.example.com"
    assert token == "db-token"


@pytest.mark.unit
def test_get_nautobot_config_falls_back_to_env() -> None:
    mock_manager = MagicMock()
    mock_manager.get_nautobot_settings.side_effect = RuntimeError("no db")

    mock_settings = MagicMock()
    mock_settings.nautobot_url = "https://env.example.com/"
    mock_settings.nautobot_token = "env-token"

    with patch("services.settings.manager.SettingsManager", return_value=mock_manager):
        with patch("config.settings", mock_settings):
            url, token = get_nautobot_config()

    assert url == "https://env.example.com"
    assert token == "env-token"
