"""Unit tests for the sanitized HTTP error helper."""

import logging
from unittest.mock import Mock

import pytest
from fastapi import HTTPException, status

from core.safe_http_errors import (
    INTERNAL_ERROR_MESSAGE,
    internal_error_detail,
    raise_internal_server_error,
)


def test_internal_error_detail_includes_uuid_error_id():
    body = internal_error_detail()
    assert body["message"] == INTERNAL_ERROR_MESSAGE
    assert "error_id" in body
    assert len(body["error_id"]) == 36


def test_raise_internal_server_error_returns_500_with_safe_body():
    logger = Mock(spec=logging.Logger)
    with pytest.raises(HTTPException) as excinfo:
        raise_internal_server_error(logger, "Failed to do X", ValueError("boom"))
    exc = excinfo.value
    assert exc.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    assert exc.detail["message"] == INTERNAL_ERROR_MESSAGE
    assert "error_id" in exc.detail
    logger.error.assert_called_once()
    args, kwargs = logger.error.call_args
    assert args[0] == "%s (error_id=%s)"
    assert args[1] == "Failed to do X"
    assert kwargs["exc_info"] is True
    assert kwargs["extra"]["error_id"] == exc.detail["error_id"]


def test_raise_internal_server_error_custom_status_code():
    logger = Mock(spec=logging.Logger)
    with pytest.raises(HTTPException) as excinfo:
        raise_internal_server_error(
            logger,
            "Upstream failed",
            RuntimeError("x"),
            status_code=status.HTTP_502_BAD_GATEWAY,
        )
    assert excinfo.value.status_code == status.HTTP_502_BAD_GATEWAY
    assert excinfo.value.detail["message"] == INTERNAL_ERROR_MESSAGE
