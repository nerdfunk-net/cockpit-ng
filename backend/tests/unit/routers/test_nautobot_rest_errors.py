"""Unit tests for Nautobot REST error helpers."""

from __future__ import annotations

import pytest

from routers.nautobot.rest_errors import extract_nautobot_error_detail


@pytest.mark.unit
def test_extract_nautobot_error_detail_parses_json_body() -> None:
    """400 responses with JSON bodies are flattened to a readable message."""
    error_msg = (
        "REST request failed with status 400: "
        '{"__all__":["Duplicate association for this object."]}'
    )
    assert extract_nautobot_error_detail(error_msg) == (
        "Duplicate association for this object."
    )


@pytest.mark.unit
def test_extract_nautobot_error_detail_returns_plain_message() -> None:
    """Non-REST-wrapped messages are returned unchanged."""
    assert extract_nautobot_error_detail("Cannot create IP address") == (
        "Cannot create IP address"
    )
