"""Unit tests for services/audit/audit_log_service.py.

All tests run offline — the repository is injected via DI.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from services.audit.audit_log_service import AuditLogService


def _make_service() -> tuple[AuditLogService, MagicMock]:
    mock_repo = MagicMock()
    return AuditLogService(repository=mock_repo), mock_repo


# ── log_event ──────────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_log_event_delegates_to_repository():
    """log_event passes all kwargs to repository.create_log."""
    svc, mock_repo = _make_service()
    svc.log_event(action="login", username="admin")
    mock_repo.create_log.assert_called_once_with(action="login", username="admin")


@pytest.mark.unit
def test_log_event_returns_repository_result():
    """Return value from repository.create_log is forwarded unchanged."""
    svc, mock_repo = _make_service()
    mock_repo.create_log.return_value = "audit-entry"
    result = svc.log_event(action="delete")
    assert result == "audit-entry"


@pytest.mark.unit
def test_log_event_multiple_kwargs():
    """All supplied kwargs reach the repository."""
    svc, mock_repo = _make_service()
    svc.log_event(action="create", username="bob", resource="device", severity="info")
    mock_repo.create_log.assert_called_once_with(action="create", username="bob", resource="device", severity="info")


@pytest.mark.unit
def test_log_event_no_kwargs():
    """log_event with no kwargs is valid (delegates empty call)."""
    svc, mock_repo = _make_service()
    svc.log_event()
    mock_repo.create_log.assert_called_once_with()


@pytest.mark.unit
def test_log_event_repository_exception_propagates():
    """Exceptions from the repository bubble up to the caller."""
    svc, mock_repo = _make_service()
    mock_repo.create_log.side_effect = RuntimeError("DB offline")
    with pytest.raises(RuntimeError, match="DB offline"):
        svc.log_event(action="x")
