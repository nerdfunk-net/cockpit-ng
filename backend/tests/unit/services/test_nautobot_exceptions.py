"""Unit tests for services/nautobot/common/exceptions.py."""

from __future__ import annotations

import pytest

from services.nautobot.common.exceptions import (
    NautobotDuplicateResourceError,
    NautobotResourceNotFoundError,
    handle_already_exists_error,
    is_duplicate_error,
    translate_http_exception,
)


@pytest.mark.unit
def test_resource_not_found_error_message() -> None:
    err = NautobotResourceNotFoundError("Device", "router-01")

    assert "Device" in str(err)
    assert err.identifier == "router-01"


@pytest.mark.unit
def test_duplicate_resource_error_message() -> None:
    err = NautobotDuplicateResourceError("IP", "10.0.0.1")

    assert "already exists" in str(err)


@pytest.mark.unit
@pytest.mark.parametrize(
    "message",
    ["Resource already exists", "duplicate key", "UNIQUE constraint failed"],
)
def test_is_duplicate_error_detects_keywords(message: str) -> None:
    assert is_duplicate_error(RuntimeError(message)) is True


@pytest.mark.unit
def test_is_duplicate_error_false_for_other_errors() -> None:
    assert is_duplicate_error(RuntimeError("connection refused")) is False


@pytest.mark.unit
def test_handle_already_exists_error_returns_structured_dict() -> None:
    result = handle_already_exists_error(Exception("already exists"), "Device")

    assert result["error"] == "already_exists"
    assert "Device" in result["message"]


@pytest.mark.unit
def test_translate_http_exception_maps_status_codes() -> None:
    exc404 = translate_http_exception(Exception("404 Not Found"), "fetch device")
    assert exc404.status_code == 404

    exc403 = translate_http_exception(Exception("403 forbidden"), "update")
    assert exc403.status_code == 403

    exc400 = translate_http_exception(Exception("400 bad"), "create")
    assert exc400.status_code == 400

    exc500 = translate_http_exception(Exception("boom"), "sync")
    assert exc500.status_code == 500
