"""
Sanitized HTTP error payloads for server failures (see doc/refactoring/CURSOR_REFACTOR_1.md P1).

5xx responses use a generic client message plus an opaque error_id; full details are logged only.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, NoReturn

from fastapi import HTTPException, status

INTERNAL_ERROR_MESSAGE = "An internal error occurred"


def internal_error_detail(*, error_id: str | None = None) -> dict[str, str]:
    """JSON-serializable body fragment for HTTPException ``detail`` (FastAPI wraps as ``detail``)."""
    eid = error_id or str(uuid.uuid4())
    return {"message": INTERNAL_ERROR_MESSAGE, "error_id": eid}


def raise_internal_server_error(
    logger: logging.Logger,
    log_message: str,
    exc: BaseException | None = None,
    *,
    extra: dict[str, Any] | None = None,
) -> NoReturn:
    """
    Log a server failure (with optional traceback) and raise HTTP 500 with a safe body.

    Call from ``except`` blocks; when ``exc`` is passed, traceback is logged via ``exc_info``.
    """
    error_id = str(uuid.uuid4())
    log_extra: dict[str, Any] = {"error_id": error_id}
    if extra:
        log_extra.update(extra)
    if exc is not None:
        logger.error(
            "%s (error_id=%s)",
            log_message,
            error_id,
            exc_info=True,
            extra=log_extra,
        )
    else:
        logger.error(
            "%s (error_id=%s)",
            log_message,
            error_id,
            extra=log_extra,
        )
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=internal_error_detail(error_id=error_id),
    )
