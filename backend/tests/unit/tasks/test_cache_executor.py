"""Unit tests for tasks/execution/cache_executor.py."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tasks.execution.cache_executor import execute_cache_devices

_PATCH_NB = "service_factory.build_nautobot_service"
_PATCH_CACHE = "service_factory.build_cache_service"


@pytest.mark.unit
def test_execute_cache_devices_success() -> None:
    task_ctx = MagicMock()
    mock_nb = MagicMock()
    mock_nb.graphql_query = AsyncMock(
        return_value={
            "data": {
                "devices": [
                    {"id": "uuid-1", "name": "r1"},
                    {"id": "uuid-2", "name": "r2"},
                ]
            }
        }
    )
    mock_cache = MagicMock()

    with patch(_PATCH_NB, return_value=mock_nb):
        with patch(_PATCH_CACHE, return_value=mock_cache):
            result = execute_cache_devices(
                schedule_id=None,
                credential_id=None,
                job_parameters=None,
                target_devices=None,
                task_context=task_ctx,
            )

    assert result["success"] is True
    assert result["devices_cached"] == 2
    assert mock_cache.set.call_count == 2


@pytest.mark.unit
def test_execute_cache_devices_graphql_error() -> None:
    task_ctx = MagicMock()
    mock_nb = MagicMock()
    mock_nb.graphql_query = AsyncMock(return_value={"errors": ["boom"]})

    with patch(_PATCH_NB, return_value=mock_nb):
        with patch(_PATCH_CACHE, return_value=MagicMock()):
            result = execute_cache_devices(
                schedule_id=1,
                credential_id=None,
                job_parameters={},
                target_devices=[],
                task_context=task_ctx,
            )

    assert result["success"] is False
    assert "GraphQL" in result["error"]


@pytest.mark.unit
def test_execute_cache_devices_handles_exception() -> None:
    task_ctx = MagicMock()

    with patch(_PATCH_NB, side_effect=RuntimeError("service down")):
        result = execute_cache_devices(
            schedule_id=None,
            credential_id=None,
            job_parameters=None,
            target_devices=None,
            task_context=task_ctx,
        )

    assert result["success"] is False
    assert "service down" in result["error"]
