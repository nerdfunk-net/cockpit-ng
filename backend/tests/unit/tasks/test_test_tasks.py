"""Unit tests for tasks/test_tasks.py.

All tests run offline — no Celery broker, database, or external services required.
Bound tasks (bind=True) are called via task.run(**kwargs); Celery provides self
automatically, and update_state is patched on the task instance.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

import tasks.test_tasks as _test_tasks_module

debug_wait_task = _test_tasks_module.debug_wait_task
progress_task = _test_tasks_module.test_progress_task
simple_task = _test_tasks_module.test_task


# ── test_task ─────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_task_returns_success_with_message():
    """Custom message is echoed back in the success response."""
    with patch("tasks.test_tasks.time.sleep"):
        result = simple_task.run(message="ping")

    assert result["success"] is True
    assert result["message"] == "ping"
    assert "timestamp" in result


@pytest.mark.unit
def test_task_default_message():
    """Default message is used when none is provided."""
    with patch("tasks.test_tasks.time.sleep"):
        result = simple_task.run()

    assert result["success"] is True
    assert "Hello from Celery!" in result["message"]


@pytest.mark.unit
def test_task_returns_failure_on_exception():
    """If time.sleep raises, the task returns success=False with the error."""
    with patch("tasks.test_tasks.time.sleep", side_effect=RuntimeError("boom")):
        result = simple_task.run(message="hello")

    assert result["success"] is False
    assert "boom" in result["error"]


# ── test_progress_task ────────────────────────────────────────────────────────


@pytest.mark.unit
def test_progress_task_returns_success():
    """Task completes all steps and returns success."""
    with patch.object(progress_task, "update_state"):
        with patch("tasks.test_tasks.time.sleep"):
            result = progress_task.run(duration=3)

    assert result["success"] is True
    assert result["duration"] == 3
    assert "3 steps" in result["message"]


@pytest.mark.unit
def test_progress_task_calls_update_state_per_step():
    """update_state is called once per step."""
    with patch.object(progress_task, "update_state") as mock_update:
        with patch("tasks.test_tasks.time.sleep"):
            progress_task.run(duration=4)

    assert mock_update.call_count == 4


@pytest.mark.unit
def test_progress_task_zero_duration():
    """With duration=0 the task completes immediately without calling update_state."""
    with patch.object(progress_task, "update_state") as mock_update:
        result = progress_task.run(duration=0)

    assert result["success"] is True
    mock_update.assert_not_called()


@pytest.mark.unit
def test_progress_task_returns_failure_on_exception():
    """Exception inside the loop is caught and returned as success=False."""
    with patch.object(progress_task, "update_state"):
        with patch("tasks.test_tasks.time.sleep", side_effect=ValueError("oops")):
            result = progress_task.run(duration=2)

    assert result["success"] is False
    assert "oops" in result["error"]


# ── debug_wait_task ───────────────────────────────────────────────────────────


@pytest.mark.unit
def test_debug_wait_task_marks_started_and_completed():
    """When job_run_id is given the task calls mark_started and mark_completed."""
    mock_jrs = MagicMock()

    with patch.object(debug_wait_task, "update_state"):
        with patch("service_factory.build_job_run_service", return_value=mock_jrs):
            with patch("tasks.test_tasks.time.sleep"):
                result = debug_wait_task.run(duration=1, job_run_id=42)

    assert result["success"] is True
    mock_jrs.mark_started.assert_called_once()
    assert mock_jrs.mark_started.call_args[0][0] == 42
    mock_jrs.mark_completed.assert_called_once()


@pytest.mark.unit
def test_debug_wait_task_without_job_run_id():
    """Without job_run_id the task runs without touching mark_started/mark_completed."""
    mock_jrs = MagicMock()

    with patch.object(debug_wait_task, "update_state"):
        with patch("service_factory.build_job_run_service", return_value=mock_jrs):
            with patch("tasks.test_tasks.time.sleep"):
                result = debug_wait_task.run(duration=1, job_run_id=None)

    assert result["success"] is True
    mock_jrs.mark_started.assert_not_called()
    mock_jrs.mark_completed.assert_not_called()


@pytest.mark.unit
def test_debug_wait_task_marks_failed_on_exception():
    """When the sleep raises, the task calls mark_failed and returns success=False."""
    mock_jrs = MagicMock()

    with patch.object(debug_wait_task, "update_state"):
        with patch("service_factory.build_job_run_service", return_value=mock_jrs):
            with patch(
                "tasks.test_tasks.time.sleep", side_effect=RuntimeError("crash")
            ):
                result = debug_wait_task.run(duration=2, job_run_id=7)

    assert result["success"] is False
    assert "crash" in result["error"]
    mock_jrs.mark_failed.assert_called_once()
    assert mock_jrs.mark_failed.call_args[0][0] == 7
