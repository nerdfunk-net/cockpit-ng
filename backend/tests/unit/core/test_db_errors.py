"""Unit tests for database error helpers."""

from __future__ import annotations

import pytest
from sqlalchemy.exc import IntegrityError

from core.db_errors import (
    duplicate_server_hostname_message,
    is_duplicate_server_hostname_error,
)


@pytest.mark.unit
def test_duplicate_server_hostname_message_includes_hostname() -> None:
    msg = duplicate_server_hostname_message("web01.example.com")
    assert "web01.example.com" in msg
    assert "already exists" in msg


@pytest.mark.unit
def test_is_duplicate_server_hostname_error_detects_constraint_name() -> None:
    exc = IntegrityError(
        "insert",
        {},
        Exception('duplicate key value violates unique constraint "uq_servers_hostname"'),
    )
    assert is_duplicate_server_hostname_error(exc) is True


@pytest.mark.unit
def test_is_duplicate_server_hostname_error_ignores_other_integrity_errors() -> None:
    exc = IntegrityError(
        "insert",
        {},
        Exception('duplicate key value violates unique constraint "uq_other"'),
    )
    assert is_duplicate_server_hostname_error(exc) is False
