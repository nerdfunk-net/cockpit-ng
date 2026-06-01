"""Unit tests for utils/cmk_folder_utils.py.

All tests run offline — no external dependencies required.
"""

from __future__ import annotations

import pytest

from utils.cmk_folder_utils import (
    _resolve_location_type_filter,
    _resolve_plain_field,
    build_checkmk_folder_path,
    normalize_folder_path,
    parse_folder_value,
    split_checkmk_folder_path,
)

# ── normalize_folder_path ──────────────────────────────────────────────────────


@pytest.mark.unit
def test_normalize_folder_path_empty_string():
    """Empty string returns '/'."""
    assert normalize_folder_path("") == "/"


@pytest.mark.unit
def test_normalize_folder_path_root():
    """Root slash '/' stays as '/'."""
    assert normalize_folder_path("/") == "/"


@pytest.mark.unit
def test_normalize_folder_path_trailing_slash():
    """Trailing slash is stripped."""
    assert normalize_folder_path("/dc1/") == "/dc1"


@pytest.mark.unit
def test_normalize_folder_path_no_trailing_slash():
    """Path without trailing slash is unchanged."""
    assert normalize_folder_path("/dc1/access") == "/dc1/access"


@pytest.mark.unit
def test_normalize_folder_path_multiple_trailing_slashes():
    """Multiple trailing slashes are all stripped."""
    assert normalize_folder_path("/dc1//") == "/dc1"


# ── build_checkmk_folder_path ──────────────────────────────────────────────────


@pytest.mark.unit
def test_build_checkmk_folder_path_empty():
    """No parts → root '/'."""
    assert build_checkmk_folder_path([]) == "/"


@pytest.mark.unit
def test_build_checkmk_folder_path_single_part():
    """Single part → '~<part>'."""
    assert build_checkmk_folder_path(["dc1"]) == "~dc1"


@pytest.mark.unit
def test_build_checkmk_folder_path_multiple_parts():
    """Multiple parts joined with '~' separator."""
    assert build_checkmk_folder_path(["dc1", "access"]) == "~dc1~access"


@pytest.mark.unit
def test_build_checkmk_folder_path_three_levels():
    """Three-level path encoded correctly."""
    assert (
        build_checkmk_folder_path(["dc1", "access", "floor1"]) == "~dc1~access~floor1"
    )


# ── split_checkmk_folder_path ──────────────────────────────────────────────────


@pytest.mark.unit
def test_split_checkmk_folder_path_empty():
    """Empty string → empty list."""
    assert split_checkmk_folder_path("") == []


@pytest.mark.unit
def test_split_checkmk_folder_path_root_slash():
    """Root '/' → empty list."""
    assert split_checkmk_folder_path("/") == []


@pytest.mark.unit
def test_split_checkmk_folder_path_root_tilde():
    """Root '~' → empty list."""
    assert split_checkmk_folder_path("~") == []


@pytest.mark.unit
def test_split_checkmk_folder_path_tilde_notation():
    """Tilde-encoded path splits correctly."""
    assert split_checkmk_folder_path("~dc1") == ["dc1"]


@pytest.mark.unit
def test_split_checkmk_folder_path_tilde_nested():
    """Nested tilde path splits into components."""
    assert split_checkmk_folder_path("~dc1~access") == ["dc1", "access"]


@pytest.mark.unit
def test_split_checkmk_folder_path_slash_notation():
    """Slash-encoded path also splits correctly."""
    assert split_checkmk_folder_path("/dc1/access") == ["dc1", "access"]


@pytest.mark.unit
def test_split_checkmk_folder_path_single_slash_folder():
    """Single-level slash path."""
    assert split_checkmk_folder_path("/dc1") == ["dc1"]


# ── _resolve_plain_field ───────────────────────────────────────────────────────


@pytest.mark.unit
def test_resolve_plain_field_top_level():
    """Direct top-level key is resolved."""
    device = {"name": "router1", "status": "active"}
    assert _resolve_plain_field(device, "name") == "router1"


@pytest.mark.unit
def test_resolve_plain_field_nested():
    """Dot-notation traverses nested dicts."""
    device = {"location": {"name": "DC1"}}
    assert _resolve_plain_field(device, "location.name") == "DC1"


@pytest.mark.unit
def test_resolve_plain_field_missing_key():
    """Missing key returns empty string."""
    device = {"name": "router1"}
    assert _resolve_plain_field(device, "role.name") == ""


@pytest.mark.unit
def test_resolve_plain_field_none_value():
    """None value in dict returns empty string."""
    device = {"name": None}
    assert _resolve_plain_field(device, "name") == ""


# ── _resolve_location_type_filter ─────────────────────────────────────────────


@pytest.mark.unit
def test_resolve_location_type_filter_direct_match():
    """Matches location_type at first level."""
    device = {
        "location": {
            "name": "NYC",
            "location_type": {"name": "City"},
        }
    }
    assert _resolve_location_type_filter(device, "location.name", "City") == "NYC"


@pytest.mark.unit
def test_resolve_location_type_filter_parent_match():
    """Traverses parent hierarchy to find matching location_type."""
    device = {
        "location": {
            "name": "Floor1",
            "location_type": {"name": "Floor"},
            "parent": {
                "name": "NYC",
                "location_type": {"name": "City"},
            },
        }
    }
    assert _resolve_location_type_filter(device, "location.name", "City") == "NYC"


@pytest.mark.unit
def test_resolve_location_type_filter_no_match():
    """Returns empty string when no location matches the type."""
    device = {
        "location": {
            "name": "Floor1",
            "location_type": {"name": "Floor"},
        }
    }
    assert _resolve_location_type_filter(device, "location.name", "City") == ""


@pytest.mark.unit
def test_resolve_location_type_filter_case_insensitive():
    """Match is case-insensitive."""
    device = {
        "location": {
            "name": "NYC",
            "location_type": {"name": "CITY"},
        }
    }
    assert _resolve_location_type_filter(device, "location.name", "city") == "NYC"


@pytest.mark.unit
def test_resolve_location_type_filter_missing_location():
    """No location in device data returns empty string."""
    device = {"name": "router1"}
    assert _resolve_location_type_filter(device, "location.name", "City") == ""


@pytest.mark.unit
def test_resolve_location_type_filter_short_field_path():
    """Field path with fewer than 2 parts returns empty string."""
    device = {"location": {"name": "NYC", "location_type": {"name": "City"}}}
    assert _resolve_location_type_filter(device, "location", "City") == ""


# ── parse_folder_value ────────────────────────────────────────────────────────


@pytest.mark.unit
def test_parse_folder_value_static_path():
    """Template with no variables returns path unchanged."""
    assert parse_folder_value("/dc1/access", {}) == "/dc1/access"


@pytest.mark.unit
def test_parse_folder_value_direct_attribute():
    """Simple {name} variable is replaced."""
    device = {"name": "router1"}
    assert parse_folder_value("/devices/{name}", device) == "/devices/router1"


@pytest.mark.unit
def test_parse_folder_value_nested_attribute():
    """Nested {location.name} is replaced."""
    device = {"location": {"name": "DC1"}}
    assert parse_folder_value("/{location.name}", device) == "/DC1"


@pytest.mark.unit
def test_parse_folder_value_custom_field():
    """Custom field {_custom_field_data.net} is replaced."""
    device = {"_custom_field_data": {"net": "core"}}
    assert parse_folder_value("/{_custom_field_data.net}", device) == "/core"


@pytest.mark.unit
def test_parse_folder_value_missing_variable():
    """Missing variable resolves to empty string."""
    device = {}
    assert parse_folder_value("/{location.name}", device) == "/"


@pytest.mark.unit
def test_parse_folder_value_location_type_filter():
    """Filter syntax {location.name | location_type:City} is processed."""
    device = {
        "location": {
            "name": "NYC",
            "location_type": {"name": "City"},
        }
    }
    result = parse_folder_value("/{location.name | location_type:City}", device)
    assert result == "/NYC"


@pytest.mark.unit
def test_parse_folder_value_location_type_filter_fallback():
    """Filter with no match falls back to the base field."""
    device = {
        "location": {
            "name": "Floor1",
            "location_type": {"name": "Floor"},
        }
    }
    result = parse_folder_value("/{location.name | location_type:City}", device)
    # No City found, falls back to plain location.name
    assert result == "/Floor1"
