"""Unit tests for services/background_jobs/base.py."""

from __future__ import annotations

import pytest

from services.background_jobs.base import (
    extract_device_essentials,
    format_progress_message,
    safe_graphql_query,
)


@pytest.mark.unit
def test_format_progress_message_with_total() -> None:
    msg = format_progress_message(2, 4, "Cached")

    assert msg == "Cached 2/4 (50.0%)"


@pytest.mark.unit
def test_format_progress_message_zero_total() -> None:
    msg = format_progress_message(0, 0, "Processed")

    assert msg == "Processed 0/0 (0.0%)"


@pytest.mark.unit
def test_extract_device_essentials_maps_nested_fields() -> None:
    device = {
        "id": "uuid-1",
        "name": "switch1",
        "serial": "ABC",
        "role": {"name": "Access"},
        "location": {"name": "Site A"},
        "status": {"name": "active"},
        "primary_ip4": {"address": "10.0.0.1/24"},
        "device_type": {
            "model": "C9300",
            "manufacturer": {"name": "Cisco"},
        },
        "platform": {"name": "ios"},
        "tags": [{"name": "prod"}, {"id": "x"}],
    }

    result = extract_device_essentials(device)

    assert result["name"] == "switch1"
    assert result["role"] == "Access"
    assert result["manufacturer"] == "Cisco"
    assert result["tags"] == ["prod"]
    assert result["primary_ip4"] == "10.0.0.1/24"


@pytest.mark.unit
def test_extract_device_essentials_handles_missing_nested_objects() -> None:
    result = extract_device_essentials({"name": "bare"})

    assert result["role"] is None
    assert result["tags"] == []


@pytest.mark.unit
def test_safe_graphql_query_success() -> None:
    ok, err, data = safe_graphql_query({"data": {"devices": []}})

    assert ok is True
    assert err is None
    assert data == {"devices": []}


@pytest.mark.unit
def test_safe_graphql_query_errors() -> None:
    ok, err, data = safe_graphql_query({"errors": [{"message": "bad query"}]})

    assert ok is False
    assert "GraphQL errors" in err
    assert data is None
