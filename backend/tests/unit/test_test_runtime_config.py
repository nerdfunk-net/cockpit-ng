"""Unit tests for pytest env helpers."""

from __future__ import annotations

import os

import pytest

from test_runtime_config import (
    checkmk_settings_from_env,
    nautobot_settings_from_env,
    postgres_test_database_url,
)


@pytest.fixture(autouse=True)
def _clear_test_env(monkeypatch):
    monkeypatch.delenv("COCKPIT_TEST_ENV", raising=False)
    monkeypatch.delenv("NAUTOBOT_HOST", raising=False)
    monkeypatch.delenv("NAUTOBOT_TOKEN", raising=False)
    monkeypatch.delenv("CHECKMK_URL", raising=False)
    monkeypatch.delenv("TEST_DATABASE_URL", raising=False)


def test_nautobot_from_env_when_test_mode(monkeypatch):
    monkeypatch.setenv("COCKPIT_TEST_ENV", "1")
    monkeypatch.setenv("NAUTOBOT_HOST", "http://nb.example")
    monkeypatch.setenv("NAUTOBOT_TOKEN", "secret-token")
    cfg = nautobot_settings_from_env()
    assert cfg is not None
    assert cfg["url"] == "http://nb.example"
    assert cfg["token"] == "secret-token"


def test_nautobot_ignored_without_test_mode(monkeypatch):
    monkeypatch.setenv("NAUTOBOT_HOST", "http://nb.example")
    monkeypatch.setenv("NAUTOBOT_TOKEN", "secret-token")
    assert nautobot_settings_from_env() is None


def test_checkmk_from_env(monkeypatch):
    monkeypatch.setenv("COCKPIT_TEST_ENV", "1")
    monkeypatch.setenv("CHECKMK_URL", "https://cmk.example")
    monkeypatch.setenv("CHECKMK_SITE", "main")
    monkeypatch.setenv("CHECKMK_USERNAME", "u")
    monkeypatch.setenv("CHECKMK_PASSWORD", "p")
    cfg = checkmk_settings_from_env()
    assert cfg is not None
    assert cfg["site"] == "main"


def test_postgres_url_derived_from_cockpit_database_vars(monkeypatch):
    monkeypatch.setenv("COCKPIT_TEST_ENV", "1")
    monkeypatch.setenv("COCKPIT_DATABASE_HOST", "127.0.0.1")
    monkeypatch.setenv("COCKPIT_DATABASE_PORT", "5432")
    monkeypatch.setenv("COCKPIT_DATABASE_NAME", "cockpit_test")
    monkeypatch.setenv("COCKPIT_DATABASE_USERNAME", "postgres")
    monkeypatch.setenv("COCKPIT_DATABASE_PASSWORD", "pass")
    url = postgres_test_database_url()
    assert url == "postgresql+psycopg2://postgres:pass@127.0.0.1:5432/cockpit_test"
