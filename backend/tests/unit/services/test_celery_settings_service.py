"""Unit tests for services/settings/celery_service.py."""

from __future__ import annotations

import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from services.settings.celery_service import BUILTIN_QUEUES, CelerySettingsService
from services.settings.defaults import CelerySettings

_PATCH_REPO = "services.settings.celery_service.CelerySettingRepository"


def _default() -> CelerySettings:
    return CelerySettings(
        max_workers=4,
        cleanup_enabled=True,
        cleanup_interval_hours=6,
        cleanup_age_hours=24,
        client_data_cleanup_enabled=True,
        client_data_cleanup_interval_hours=24,
        client_data_cleanup_age_hours=168,
        result_expires_hours=24,
        queues=[],
    )


def _settings_row(**kwargs) -> SimpleNamespace:
    defaults = {
        "id": 1,
        "max_workers": 8,
        "cleanup_enabled": False,
        "cleanup_interval_hours": 12,
        "cleanup_age_hours": 48,
        "client_data_cleanup_enabled": True,
        "client_data_cleanup_interval_hours": 24,
        "client_data_cleanup_age_hours": 168,
        "result_expires_hours": 72,
        "queues": None,
    }
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


@pytest.mark.unit
class TestCelerySettingsServiceGet:
    def test_returns_settings_from_db(self):
        svc = CelerySettingsService(_default())
        row = _settings_row(queues=json.dumps([{"name": "custom", "built_in": False}]))
        with patch(_PATCH_REPO) as MockRepo:
            MockRepo.return_value.get_settings.return_value = row
            result = svc.get()

        assert result["max_workers"] == 8
        assert result["queues"] == [{"name": "custom", "built_in": False}]

    def test_falls_back_to_defaults_when_no_row(self):
        svc = CelerySettingsService(_default())
        with patch(_PATCH_REPO) as MockRepo:
            MockRepo.return_value.get_settings.return_value = None
            result = svc.get()

        assert result["max_workers"] == 4

    def test_falls_back_to_defaults_on_exception(self):
        svc = CelerySettingsService(_default())
        with patch(_PATCH_REPO) as MockRepo:
            MockRepo.return_value.get_settings.side_effect = RuntimeError("db down")
            result = svc.get()

        assert result["max_workers"] == 4

    def test_bad_queues_json_returns_empty_list(self):
        svc = CelerySettingsService(_default())
        row = _settings_row(queues="not-valid-json")
        with patch(_PATCH_REPO) as MockRepo:
            MockRepo.return_value.get_settings.return_value = row
            result = svc.get()

        assert result["queues"] == []

    def test_null_queues_returns_empty_list(self):
        svc = CelerySettingsService(_default())
        row = _settings_row(queues=None)
        with patch(_PATCH_REPO) as MockRepo:
            MockRepo.return_value.get_settings.return_value = row
            result = svc.get()

        assert result["queues"] == []


@pytest.mark.unit
class TestCelerySettingsServiceUpdate:
    def test_creates_new_row_when_none_exists(self):
        svc = CelerySettingsService(_default())
        with patch(_PATCH_REPO) as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get_settings.return_value = None
            result = svc.update({"max_workers": 10})

        assert result is True
        mock_repo.create.assert_called_once()

    def test_updates_existing_row(self):
        svc = CelerySettingsService(_default())
        with patch(_PATCH_REPO) as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get_settings.return_value = _settings_row()
            result = svc.update({"max_workers": 10})

        assert result is True
        mock_repo.update.assert_called_once()

    def test_serialises_queues_list_to_json(self):
        svc = CelerySettingsService(_default())
        queues = [{"name": "custom"}]
        with patch(_PATCH_REPO) as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get_settings.return_value = None
            svc.update({"queues": queues})
            _, kwargs = mock_repo.create.call_args
            assert kwargs["queues"] == json.dumps(queues)

    def test_returns_false_on_exception(self):
        svc = CelerySettingsService(_default())
        with patch(_PATCH_REPO) as MockRepo:
            MockRepo.return_value.get_settings.side_effect = RuntimeError("boom")
            result = svc.update({})

        assert result is False

    def test_empty_queues_list_stored_as_none(self):
        svc = CelerySettingsService(_default())
        with patch(_PATCH_REPO) as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get_settings.return_value = None
            svc.update({"queues": []})
            _, kwargs = mock_repo.create.call_args
            assert kwargs["queues"] is None


@pytest.mark.unit
class TestEnsureBuiltinQueues:
    def test_adds_missing_builtin_queues(self):
        svc = CelerySettingsService(_default())
        with patch(_PATCH_REPO) as MockRepo:
            mock_repo = MockRepo.return_value
            # Simulate DB with no queues
            mock_repo.get_settings.return_value = _settings_row(queues=None)
            result = svc.ensure_builtin_queues()

        assert result is True

    def test_all_builtins_already_present_no_update(self):
        svc = CelerySettingsService(_default())
        existing_queues = [
            {**q, "built_in": True} for q in BUILTIN_QUEUES
        ]
        with patch(_PATCH_REPO) as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get_settings.return_value = _settings_row(
                queues=json.dumps(existing_queues)
            )
            result = svc.ensure_builtin_queues()

        assert result is True
        mock_repo.update.assert_not_called()

    def test_sets_built_in_flag_on_existing_queues(self):
        svc = CelerySettingsService(_default())
        # Queue without built_in flag
        existing = [{"name": "default", "description": "default", "built_in": False}]
        with patch(_PATCH_REPO) as MockRepo:
            mock_repo = MockRepo.return_value
            mock_repo.get_settings.return_value = _settings_row(
                queues=json.dumps(existing)
            )
            result = svc.ensure_builtin_queues()

        assert result is True

    def test_returns_false_on_exception(self):
        svc = CelerySettingsService(_default())
        with patch(_PATCH_REPO) as MockRepo:
            MockRepo.return_value.get_settings.side_effect = RuntimeError("db error")
            result = svc.ensure_builtin_queues()

        assert result is False
