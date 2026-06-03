"""Unit tests for services/nautobot/common/utils.py."""

from __future__ import annotations

import pytest

from services.nautobot.common.utils import (
    extract_id_from_url,
    extract_nested_value,
    flatten_nested_fields,
    normalize_tags,
    prepare_update_data,
)


@pytest.mark.unit
def test_flatten_nested_fields() -> None:
    result = flatten_nested_fields(
        {"platform.name": "ios", "status": "active"},
    )

    assert result == {"platform": "ios", "status": "active"}


@pytest.mark.unit
def test_extract_nested_value_found_and_missing() -> None:
    data = {"platform": {"name": "ios"}}

    assert extract_nested_value(data, "platform.name") == "ios"
    assert extract_nested_value(data, "platform.version") is None


@pytest.mark.unit
@pytest.mark.parametrize(
    "tags,expected",
    [
        (None, []),
        ("a,b", ["a", "b"]),
        ([" x ", ""], ["x"]),
        ("single", ["single"]),
    ],
)
def test_normalize_tags(tags: object, expected: list[str]) -> None:
    assert normalize_tags(tags) == expected


@pytest.mark.unit
def test_prepare_update_data_with_interface() -> None:
    row = {
        "name": "sw1",
        "status": "active",
        "tags": "prod,core",
        "interface_name": "Loopback0",
        "interface_type": "virtual",
        "interface_status": "active",
        "ip_namespace": "Global",
    }
    headers = list(row.keys())

    data, iface, ns = prepare_update_data(row, headers)

    assert data["status"] == "active"
    assert data["tags"] == ["prod", "core"]
    assert iface is not None
    assert iface["name"] == "Loopback0"
    assert ns == "Global"
    assert "name" not in data


@pytest.mark.unit
def test_extract_id_from_url() -> None:
    uuid = "550e8400-e29b-41d4-a716-446655440000"
    url = f"/api/dcim/devices/{uuid}/"

    assert extract_id_from_url(url) == uuid
    assert extract_id_from_url("/api/dcim/devices/") is None
