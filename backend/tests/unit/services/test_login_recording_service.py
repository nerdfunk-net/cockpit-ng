"""Unit tests for services/auth/login_recording_service.py.

All tests run offline — repositories are injected via DI.
db_transaction is patched to avoid any DB access.
"""

from __future__ import annotations

from contextlib import contextmanager
from unittest.mock import MagicMock, patch

import pytest

from services.auth.login_recording_service import LoginRecordingService


@contextmanager
def _fake_transaction():
    """Context manager that yields a mock session without touching a DB."""
    yield MagicMock()


def _make_service() -> tuple[LoginRecordingService, MagicMock, MagicMock]:
    mock_users = MagicMock()
    mock_audit = MagicMock()
    svc = LoginRecordingService(
        user_repository=mock_users, audit_repository=mock_audit
    )
    return svc, mock_users, mock_audit


# ── record_successful_login ────────────────────────────────────────────────────


@pytest.mark.unit
def test_record_login_updates_last_login():
    """record_successful_login calls user_repository.update_last_login."""
    svc, mock_users, mock_audit = _make_service()
    with patch(
        "services.auth.login_recording_service.db_transaction", _fake_transaction
    ):
        svc.record_successful_login(
            user_id=1,
            username="alice",
            role_names=["admin"],
            authentication_method="local",
        )
    mock_users.update_last_login.assert_called_once()


@pytest.mark.unit
def test_record_login_creates_audit_entry():
    """record_successful_login calls audit_repository.create_log."""
    svc, mock_users, mock_audit = _make_service()
    with patch(
        "services.auth.login_recording_service.db_transaction", _fake_transaction
    ):
        svc.record_successful_login(
            user_id=2,
            username="bob",
            role_names=["viewer"],
            authentication_method="oidc",
        )
    mock_audit.create_log.assert_called_once()


@pytest.mark.unit
def test_record_login_audit_event_type_is_login():
    """Audit log entry has event_type='login'."""
    svc, mock_users, mock_audit = _make_service()
    with patch(
        "services.auth.login_recording_service.db_transaction", _fake_transaction
    ):
        svc.record_successful_login(
            user_id=3,
            username="carol",
            role_names=[],
            authentication_method="local",
        )
    call_kwargs = mock_audit.create_log.call_args.kwargs
    assert call_kwargs["event_type"] == "login"


@pytest.mark.unit
def test_record_login_includes_authentication_method():
    """extra_data in the audit log contains authentication_method."""
    svc, mock_users, mock_audit = _make_service()
    with patch(
        "services.auth.login_recording_service.db_transaction", _fake_transaction
    ):
        svc.record_successful_login(
            user_id=4,
            username="dave",
            role_names=["editor"],
            authentication_method="saml",
        )
    call_kwargs = mock_audit.create_log.call_args.kwargs
    extra = call_kwargs["extra_data"]
    assert extra["authentication_method"] == "saml"


@pytest.mark.unit
def test_record_login_includes_roles_in_extra_data():
    """extra_data in the audit log contains the assigned roles."""
    svc, mock_users, mock_audit = _make_service()
    with patch(
        "services.auth.login_recording_service.db_transaction", _fake_transaction
    ):
        svc.record_successful_login(
            user_id=5,
            username="eve",
            role_names=["netops", "viewer"],
            authentication_method="local",
        )
    extra = mock_audit.create_log.call_args.kwargs["extra_data"]
    assert extra["roles"] == ["netops", "viewer"]


@pytest.mark.unit
def test_record_login_custom_message_used():
    """Custom message is forwarded to the audit entry."""
    svc, mock_users, mock_audit = _make_service()
    with patch(
        "services.auth.login_recording_service.db_transaction", _fake_transaction
    ):
        svc.record_successful_login(
            user_id=6,
            username="frank",
            role_names=[],
            authentication_method="local",
            message="SSO login via provider X",
        )
    call_kwargs = mock_audit.create_log.call_args.kwargs
    assert call_kwargs["message"] == "SSO login via provider X"


@pytest.mark.unit
def test_record_login_default_message_contains_username():
    """Default message includes the username when no custom message given."""
    svc, mock_users, mock_audit = _make_service()
    with patch(
        "services.auth.login_recording_service.db_transaction", _fake_transaction
    ):
        svc.record_successful_login(
            user_id=7,
            username="grace",
            role_names=[],
            authentication_method="local",
        )
    call_kwargs = mock_audit.create_log.call_args.kwargs
    assert "grace" in call_kwargs["message"]


@pytest.mark.unit
def test_record_login_extra_data_merged():
    """extra_data kwarg is merged with the standard fields."""
    svc, mock_users, mock_audit = _make_service()
    with patch(
        "services.auth.login_recording_service.db_transaction", _fake_transaction
    ):
        svc.record_successful_login(
            user_id=8,
            username="heidi",
            role_names=[],
            authentication_method="local",
            extra_data={"ip": "10.0.0.1"},
        )
    extra = mock_audit.create_log.call_args.kwargs["extra_data"]
    assert extra["ip"] == "10.0.0.1"
    assert "authentication_method" in extra
