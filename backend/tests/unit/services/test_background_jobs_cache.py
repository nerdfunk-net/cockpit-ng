"""Unit tests for device and location cache background jobs."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from tests.helpers.asyncio_run import mock_asyncio_run_returning
from services.background_jobs.device_cache_jobs import cache_all_devices_task
from services.background_jobs.location_cache_jobs import cache_all_locations_task


@pytest.mark.unit
def test_cache_all_devices_task_success() -> None:
    graphql_result = {
        "data": {
            "devices": [
                {"id": "1", "name": "sw1", "role": {"name": "access"}},
            ]
        }
    }
    cache = MagicMock()

    with (
        patch("service_factory.build_nautobot_service"),
        patch("service_factory.build_cache_service", return_value=cache),
        patch(
            "services.background_jobs.device_cache_jobs.asyncio.run",
            side_effect=mock_asyncio_run_returning(graphql_result),
        ),
        patch.object(cache_all_devices_task, "update_state"),
    ):
        out = cache_all_devices_task.run()

    assert out["status"] == "completed"
    assert out["cached"] == 1
    cache.set.assert_called()


@pytest.mark.unit
def test_cache_all_devices_task_graphql_error() -> None:
    bad_result = {"errors": [{"message": "syntax"}]}
    with (
        patch("service_factory.build_nautobot_service"),
        patch("service_factory.build_cache_service"),
        patch(
            "services.background_jobs.device_cache_jobs.asyncio.run",
            side_effect=mock_asyncio_run_returning(bad_result),
        ),
        patch.object(cache_all_devices_task, "update_state"),
    ):
        out = cache_all_devices_task.run()

    assert out["status"] == "failed"
    assert out["cached"] == 0


@pytest.mark.unit
def test_cache_all_locations_task_success() -> None:
    graphql_result = {
        "data": {"locations": [{"id": "loc-1", "name": "DC1"}]},
    }
    cache = MagicMock()
    with (
        patch("service_factory.build_nautobot_service"),
        patch("service_factory.build_cache_service", return_value=cache),
        patch(
            "services.background_jobs.location_cache_jobs.asyncio.run",
            side_effect=mock_asyncio_run_returning(graphql_result),
        ),
        patch.object(cache_all_locations_task, "update_state"),
    ):
        out = cache_all_locations_task.run()

    assert out["status"] == "completed"
    assert out["cached"] == 1
    cache.set.assert_called_once()


@pytest.mark.unit
def test_cache_all_locations_task_marks_job_run_completed() -> None:
    graphql_result = {"data": {"locations": [{"id": "1", "name": "Site"}]}}
    job_runs = MagicMock()
    with (
        patch("service_factory.build_nautobot_service"),
        patch("service_factory.build_cache_service"),
        patch(
            "services.background_jobs.location_cache_jobs.asyncio.run",
            side_effect=mock_asyncio_run_returning(graphql_result),
        ),
        patch(
            "service_factory.build_job_run_service",
            return_value=job_runs,
        ),
        patch.object(cache_all_locations_task, "update_state"),
    ):
        out = cache_all_locations_task.run(job_run_id=42)

    assert out["cached"] == 1
    job_runs.mark_completed.assert_called_once_with(42, result=out)
