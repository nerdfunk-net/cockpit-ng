"""Unit tests for utils/audit_logger.py.

All tests run offline — the audit_log_repo is patched to avoid DB access.
Tests verify message construction, severity mapping, and call delegation.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

_PATCH_REPO = "utils.audit_logger.audit_log_repo"


# ── log_auth_event ─────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_log_auth_event_success_calls_repo():
    """Successful auth event calls audit_log_repo.create_log."""
    mock_repo = MagicMock()
    with patch(_PATCH_REPO, mock_repo):
        from utils.audit_logger import log_auth_event

        log_auth_event(username="alice", action="login", success=True)

    mock_repo.create_log.assert_called_once()


@pytest.mark.unit
def test_log_auth_event_success_severity_info():
    """Successful auth event uses severity='info'."""
    mock_repo = MagicMock()
    with patch(_PATCH_REPO, mock_repo):
        from utils.audit_logger import log_auth_event

        log_auth_event(username="alice", action="login", success=True)

    call_kwargs = mock_repo.create_log.call_args.kwargs
    assert call_kwargs["severity"] == "info"


@pytest.mark.unit
def test_log_auth_event_failure_severity_warning():
    """Failed auth event uses severity='warning'."""
    mock_repo = MagicMock()
    with patch(_PATCH_REPO, mock_repo):
        from utils.audit_logger import log_auth_event

        log_auth_event(username="bob", action="login_failed", success=False)

    call_kwargs = mock_repo.create_log.call_args.kwargs
    assert call_kwargs["severity"] == "warning"


@pytest.mark.unit
def test_log_auth_event_passes_username():
    """Username is forwarded to the repository."""
    mock_repo = MagicMock()
    with patch(_PATCH_REPO, mock_repo):
        from utils.audit_logger import log_auth_event

        log_auth_event(username="carol", action="logout", success=True)

    call_kwargs = mock_repo.create_log.call_args.kwargs
    assert call_kwargs["username"] == "carol"


@pytest.mark.unit
def test_log_auth_event_repo_error_does_not_raise():
    """Repository failure is swallowed — caller is not interrupted."""
    mock_repo = MagicMock()
    mock_repo.create_log.side_effect = Exception("DB offline")
    with patch(_PATCH_REPO, mock_repo):
        from utils.audit_logger import log_auth_event

        # Should not raise
        log_auth_event(username="dave", action="login", success=True)


# ── log_device_onboarding ──────────────────────────────────────────────────────


@pytest.mark.unit
def test_log_device_onboarding_success_calls_repo():
    """Successful onboarding calls audit_log_repo.create_log."""
    mock_repo = MagicMock()
    with patch(_PATCH_REPO, mock_repo):
        from utils.audit_logger import log_device_onboarding

        log_device_onboarding(username="admin", device_name="router1", success=True)

    mock_repo.create_log.assert_called_once()


@pytest.mark.unit
def test_log_device_onboarding_failure_includes_error_message():
    """Failed onboarding appends the error message to the log message."""
    mock_repo = MagicMock()
    with patch(_PATCH_REPO, mock_repo):
        from utils.audit_logger import log_device_onboarding

        log_device_onboarding(
            username="admin",
            device_name="router1",
            success=False,
            error_message="Timeout",
        )

    call_kwargs = mock_repo.create_log.call_args.kwargs
    assert "Timeout" in call_kwargs["message"]


@pytest.mark.unit
def test_log_device_onboarding_failure_severity_error():
    """Failed onboarding uses severity='error'."""
    mock_repo = MagicMock()
    with patch(_PATCH_REPO, mock_repo):
        from utils.audit_logger import log_device_onboarding

        log_device_onboarding(username="admin", device_name="router1", success=False)

    call_kwargs = mock_repo.create_log.call_args.kwargs
    assert call_kwargs["severity"] == "error"


# ── log_checkmk_sync_event ─────────────────────────────────────────────────────


@pytest.mark.unit
def test_log_checkmk_sync_event_add_success_message():
    """Add action produces 'added to CheckMK' in the message."""
    mock_repo = MagicMock()
    with patch(_PATCH_REPO, mock_repo):
        from utils.audit_logger import log_checkmk_sync_event

        log_checkmk_sync_event(
            username="admin", action="add", device_name="sw1", success=True
        )

    call_kwargs = mock_repo.create_log.call_args.kwargs
    assert "added to" in call_kwargs["message"]


@pytest.mark.unit
def test_log_checkmk_sync_event_update_success_message():
    """Update action produces 'updated in CheckMK' in the message."""
    mock_repo = MagicMock()
    with patch(_PATCH_REPO, mock_repo):
        from utils.audit_logger import log_checkmk_sync_event

        log_checkmk_sync_event(
            username="admin", action="update", device_name="sw1", success=True
        )

    call_kwargs = mock_repo.create_log.call_args.kwargs
    assert "updated in" in call_kwargs["message"]


@pytest.mark.unit
def test_log_checkmk_sync_event_failure_includes_error():
    """Failed sync includes error_message in the log message."""
    mock_repo = MagicMock()
    with patch(_PATCH_REPO, mock_repo):
        from utils.audit_logger import log_checkmk_sync_event

        log_checkmk_sync_event(
            username="admin",
            action="add",
            device_name="sw1",
            success=False,
            error_message="Host already exists",
        )

    call_kwargs = mock_repo.create_log.call_args.kwargs
    assert "Host already exists" in call_kwargs["message"]


# ── log_system_event ───────────────────────────────────────────────────────────


@pytest.mark.unit
def test_log_system_event_uses_system_username():
    """System events are logged under the 'system' username."""
    mock_repo = MagicMock()
    with patch(_PATCH_REPO, mock_repo):
        from utils.audit_logger import log_system_event

        log_system_event("Startup complete")

    call_kwargs = mock_repo.create_log.call_args.kwargs
    assert call_kwargs["username"] == "system"


@pytest.mark.unit
def test_log_system_event_passes_message():
    """Message is forwarded to the repository."""
    mock_repo = MagicMock()
    with patch(_PATCH_REPO, mock_repo):
        from utils.audit_logger import log_system_event

        log_system_event("Scheduler started")

    call_kwargs = mock_repo.create_log.call_args.kwargs
    assert call_kwargs["message"] == "Scheduler started"


@pytest.mark.unit
def test_log_system_event_repo_error_does_not_raise():
    """Repository failure is swallowed — caller is not interrupted."""
    mock_repo = MagicMock()
    mock_repo.create_log.side_effect = RuntimeError("DB error")
    with patch(_PATCH_REPO, mock_repo):
        from utils.audit_logger import log_system_event

        log_system_event("Test event")
