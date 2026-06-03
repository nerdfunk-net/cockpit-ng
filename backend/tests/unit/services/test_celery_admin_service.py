"""Unit tests for services/celery/admin_service.py."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from services.celery import admin_service as svc


@pytest.mark.unit
def test_get_beat_status_running_when_lock_exists() -> None:
    redis_client = MagicMock()
    redis_client.exists.side_effect = [1, 0]

    with patch.object(svc, "_redis_client", return_value=redis_client):
        result = svc.get_beat_status()

    assert result["beat_running"] is True
    assert "running" in result["message"].lower()


@pytest.mark.unit
def test_get_beat_status_false_on_redis_error() -> None:
    with patch.object(svc, "_redis_client", side_effect=ConnectionError("down")):
        result = svc.get_beat_status()

    assert result["beat_running"] is False


@pytest.mark.unit
def test_is_redis_connected_true_and_false() -> None:
    ok_client = MagicMock()
    with patch.object(svc, "_redis_client", return_value=ok_client):
        assert svc.is_redis_connected() is True

    bad_client = MagicMock()
    bad_client.ping.side_effect = OSError("refused")
    with patch.object(svc, "_redis_client", return_value=bad_client):
        assert svc.is_redis_connected() is False


@pytest.mark.unit
def test_get_queue_metrics_success() -> None:
    inspect = MagicMock()
    inspect.active_queues.return_value = {
        "worker1": [{"name": "default"}],
    }
    inspect.active.return_value = {"worker1": [{"id": "t1"}]}

    redis_client = MagicMock()
    redis_client.llen.return_value = 3

    fake_queue = MagicMock()
    fake_queue.get.side_effect = lambda key, default=None: {
        "exchange": "default",
        "routing_key": "default",
    }.get(key, default)

    mock_app = MagicMock()
    mock_app.control.inspect.return_value = inspect
    mock_app.conf.task_queues = {"default": fake_queue}
    mock_app.conf.task_routes = {"tasks.*": {"queue": "default"}}

    with (
        patch("services.celery.admin_service.celery_app", mock_app),
        patch.object(svc, "_redis_client", return_value=redis_client),
    ):
        result = svc.get_queue_metrics()

    assert result["success"] is True
    assert result["total_queues"] == 1
    assert result["queues"][0]["pending_tasks"] == 3


@pytest.mark.unit
def test_purge_queue_unknown_raises_key_error() -> None:
    mock_app = MagicMock()
    mock_app.conf.task_queues = {}

    with patch("services.celery.admin_service.celery_app", mock_app):
        with pytest.raises(KeyError, match="not found"):
            svc.purge_queue("missing")


@pytest.mark.unit
def test_get_cleanup_stats_returns_counts() -> None:
    redis_client = MagicMock()
    redis_client.scan_iter.return_value = ["celery-task-meta-1", "celery-task-meta-2"]
    settings_mgr = MagicMock()
    settings_mgr.get_celery_settings.return_value = {"cleanup_age_hours": 12}

    with (
        patch.object(svc, "_redis_client", return_value=redis_client),
        patch("services.settings.manager.SettingsManager", return_value=settings_mgr),
    ):
        result = svc.get_cleanup_stats()

    assert result["cleanup_age_hours"] == 12
    assert result["total_result_keys"] == 2
