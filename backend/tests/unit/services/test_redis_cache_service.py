"""Unit tests for services/settings/cache.py (RedisCacheService)."""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest

from services.settings.cache import RedisCacheService


def _redis_mock() -> MagicMock:
    client = MagicMock()
    client.exists.return_value = True
    client.hgetall.return_value = {
        "hits": "10",
        "misses": "2",
        "created": "5",
        "cleared": "1",
    }
    client.get.return_value = "1700000000.0"
    client.keys.return_value = [
        "cockpit-cache:stats",
        "cockpit-cache:start_time",
        "cockpit-cache:nautobot:devices:all",
    ]
    return client


def _service(redis: MagicMock) -> RedisCacheService:
    with patch("services.settings.cache.redis.from_url", return_value=redis):
        return RedisCacheService("redis://localhost", key_prefix="cockpit-cache")


@pytest.mark.unit
def test_get_returns_deserialized_value() -> None:
    redis = _redis_mock()
    redis.get.return_value = json.dumps({"items": [1, 2]})
    svc = _service(redis)

    assert svc.get("nautobot:devices:all") == {"items": [1, 2]}
    redis.hincrby.assert_called_with("cockpit-cache:stats", "hits", 1)


@pytest.mark.unit
def test_get_returns_none_on_miss() -> None:
    redis = _redis_mock()
    redis.get.return_value = None
    svc = _service(redis)

    assert svc.get("missing") is None


@pytest.mark.unit
def test_get_deletes_invalid_json() -> None:
    redis = _redis_mock()
    redis.get.return_value = "not-json"
    svc = _service(redis)

    assert svc.get("bad") is None
    redis.delete.assert_called()


@pytest.mark.unit
def test_set_serializes_with_ttl() -> None:
    redis = _redis_mock()
    svc = _service(redis)

    svc.set("key", {"a": 1}, ttl_seconds=120)

    redis.setex.assert_called_once()
    args = redis.setex.call_args[0]
    assert args[1] == 120


@pytest.mark.unit
def test_delete_returns_true_when_key_removed() -> None:
    redis = _redis_mock()
    redis.delete.return_value = 1
    svc = _service(redis)

    assert svc.delete("key") is True


@pytest.mark.unit
def test_clear_namespace_deletes_matching_keys() -> None:
    redis = _redis_mock()
    redis.keys.return_value = ["cockpit-cache:ns:1", "cockpit-cache:ns:2"]
    redis.delete.return_value = 2
    svc = _service(redis)

    count = svc.clear_namespace("ns")

    assert count == 2


@pytest.mark.unit
def test_stats_returns_overview() -> None:
    redis = _redis_mock()
    redis.memory_usage.return_value = 1024
    svc = _service(redis)

    result = svc.stats()

    assert result["overview"]["total_items"] >= 0
    assert result["performance"]["cache_hits"] == 10


@pytest.mark.unit
def test_get_entries_lists_keys() -> None:
    redis = _redis_mock()
    redis.keys.return_value = [
        "cockpit-cache:stats",
        "cockpit-cache:start_time",
        "cockpit-cache:ns:k1",
    ]
    redis.ttl.return_value = 120
    redis.memory_usage.return_value = 256
    svc = _service(redis)

    entries = svc.get_entries()

    assert len(entries) == 1
    assert entries[0]["namespace"] == "ns"


@pytest.mark.unit
def test_get_performance_metrics() -> None:
    redis = _redis_mock()
    svc = _service(redis)

    metrics = svc.get_performance_metrics()

    assert metrics["cache_hits"] == 10
    assert metrics["total_requests"] == 12


@pytest.mark.unit
def test_clear_all_deletes_cache_keys() -> None:
    redis = _redis_mock()
    redis.keys.return_value = [
        "cockpit-cache:stats",
        "cockpit-cache:start_time",
        "cockpit-cache:a",
        "cockpit-cache:b",
    ]
    redis.delete.return_value = 2
    svc = _service(redis)

    count = svc.clear_all()

    assert count == 2


@pytest.mark.unit
def test_get_namespace_info_returns_entries() -> None:
    redis = _redis_mock()
    redis.keys.return_value = ["cockpit-cache:nautobot:devices:all"]
    redis.ttl.return_value = 90
    redis.memory_usage.return_value = 512
    svc = _service(redis)

    info = svc.get_namespace_info("nautobot")

    assert info["total_entries"] == 1
    assert info["entries"][0]["key"].startswith("nautobot:")


@pytest.mark.unit
def test_cleanup_expired_is_noop() -> None:
    redis = _redis_mock()
    svc = _service(redis)

    assert svc.cleanup_expired() == 0
