"""Unit tests for utils/task_progress.py.

All tests run offline — no Celery broker required.
The ProgressUpdater delegates to a mock task instance.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from utils.task_progress import ProgressUpdater


def _make_updater() -> tuple[ProgressUpdater, MagicMock]:
    """Return a ProgressUpdater and the underlying mock task."""
    mock_task = MagicMock()
    return ProgressUpdater(mock_task), mock_task


# ── update ─────────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_update_calls_update_state():
    """update() delegates to task.update_state with state=PROGRESS."""
    updater, mock_task = _make_updater()
    updater.update("init", "Starting...", 5)

    mock_task.update_state.assert_called_once()
    call_kwargs = mock_task.update_state.call_args
    assert call_kwargs.kwargs["state"] == "PROGRESS"


@pytest.mark.unit
def test_update_meta_contains_stage_status_progress():
    """Meta dict passed to update_state has stage, status, progress keys."""
    updater, mock_task = _make_updater()
    updater.update("processing", "Working...", 50)

    meta = mock_task.update_state.call_args.kwargs["meta"]
    assert meta["stage"] == "processing"
    assert meta["status"] == "Working..."
    assert meta["progress"] == 50


@pytest.mark.unit
def test_update_clamps_progress_above_100():
    """Progress above 100 is clamped to 100."""
    updater, mock_task = _make_updater()
    updater.update("done", "msg", 150)

    meta = mock_task.update_state.call_args.kwargs["meta"]
    assert meta["progress"] == 100


@pytest.mark.unit
def test_update_clamps_progress_below_0():
    """Progress below 0 is clamped to 0."""
    updater, mock_task = _make_updater()
    updater.update("init", "msg", -10)

    meta = mock_task.update_state.call_args.kwargs["meta"]
    assert meta["progress"] == 0


@pytest.mark.unit
def test_update_includes_extra_fields():
    """Extra keyword arguments appear in the meta dict."""
    updater, mock_task = _make_updater()
    updater.update("running", "msg", 30, job_id="abc-123", count=5)

    meta = mock_task.update_state.call_args.kwargs["meta"]
    assert meta["job_id"] == "abc-123"
    assert meta["count"] == 5


# ── error ──────────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_error_calls_update_state_with_failure():
    """error() calls update_state with state=FAILURE."""
    updater, mock_task = _make_updater()
    updater.error("Something went wrong")

    call_kwargs = mock_task.update_state.call_args.kwargs
    assert call_kwargs["state"] == "FAILURE"


@pytest.mark.unit
def test_error_meta_stage_is_error():
    """error() sets stage='error' and progress=0 in meta."""
    updater, mock_task = _make_updater()
    updater.error("Timeout")

    meta = mock_task.update_state.call_args.kwargs["meta"]
    assert meta["stage"] == "error"
    assert meta["progress"] == 0
    assert meta["status"] == "Timeout"


@pytest.mark.unit
def test_error_includes_extra_fields():
    """Extra fields are included in the error meta."""
    updater, mock_task = _make_updater()
    updater.error("Connection failed", device_ip="10.0.0.1")

    meta = mock_task.update_state.call_args.kwargs["meta"]
    assert meta["device_ip"] == "10.0.0.1"


# ── complete ───────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_complete_calls_update_state_with_success():
    """complete() calls update_state with state=SUCCESS."""
    updater, mock_task = _make_updater()
    updater.complete()

    call_kwargs = mock_task.update_state.call_args.kwargs
    assert call_kwargs["state"] == "SUCCESS"


@pytest.mark.unit
def test_complete_meta_progress_is_100():
    """complete() sets progress=100 in meta."""
    updater, mock_task = _make_updater()
    updater.complete()

    meta = mock_task.update_state.call_args.kwargs["meta"]
    assert meta["progress"] == 100
    assert meta["stage"] == "complete"


@pytest.mark.unit
def test_complete_custom_message():
    """complete() accepts a custom completion message."""
    updater, mock_task = _make_updater()
    updater.complete("All done!")

    meta = mock_task.update_state.call_args.kwargs["meta"]
    assert meta["status"] == "All done!"


@pytest.mark.unit
def test_complete_includes_extra_fields():
    """Extra fields are included in the complete meta."""
    updater, mock_task = _make_updater()
    updater.complete("Done", device_id="xyz-789")

    meta = mock_task.update_state.call_args.kwargs["meta"]
    assert meta["device_id"] == "xyz-789"
