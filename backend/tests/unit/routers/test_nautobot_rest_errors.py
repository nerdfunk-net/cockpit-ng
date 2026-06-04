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


@pytest.mark.unit
def test_extract_nautobot_error_detail_parses_wrapped_vm_error() -> None:
    """Manager-wrapped 400 errors still expose Nautobot field messages."""
    import json

    body = {
        "role": [
            "Related object not found using the provided attributes: "
            "{'pk': UUID('0366c817-a426-4b6c-bde5-03d85cb93304')}"
        ]
    }
    error_msg = (
        "Failed to create virtual machine: REST request failed with status 400: "
        f"{json.dumps(body)}"
    )
    detail = extract_nautobot_error_detail(error_msg)
    assert "Role:" in detail
    assert "not found in Nautobot" in detail
    assert "Server Defaults" in detail


@pytest.mark.unit
def test_extract_nautobot_error_detail_includes_field_name() -> None:
    """Per-field JSON errors are labeled with the field name."""
    error_msg = (
        'REST request failed with status 400: {"status":["This field is required."]}'
    )
    assert extract_nautobot_error_detail(error_msg) == "Status: This field is required."
