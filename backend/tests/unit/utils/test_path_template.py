"""Unit tests for utils/path_template.py.

All tests run offline — no external dependencies required.
"""

from __future__ import annotations

import pytest

from utils.path_template import (
    _get_nested_value,
    replace_template_variables,
    sanitize_path_component,
    validate_template_path,
)

# ── _get_nested_value ──────────────────────────────────────────────────────────


@pytest.mark.unit
def test_get_nested_value_top_level():
    """Top-level key is resolved directly."""
    data = {"name": "router01"}
    assert _get_nested_value(data, "name") == "router01"


@pytest.mark.unit
def test_get_nested_value_nested():
    """Dot-notation traverses nested dicts."""
    data = {"location": {"parent": {"name": "USA"}}}
    assert _get_nested_value(data, "location.parent.name") == "USA"


@pytest.mark.unit
def test_get_nested_value_device_name_alias():
    """'device_name' is an alias for 'name'."""
    data = {"name": "sw01"}
    assert _get_nested_value(data, "device_name") == "sw01"


@pytest.mark.unit
def test_get_nested_value_custom_fields_compat():
    """'custom_fields.x' maps to 'custom_field_data.x'."""
    data = {"custom_field_data": {"cf_net": "core"}}
    assert _get_nested_value(data, "custom_fields.cf_net") == "core"


@pytest.mark.unit
def test_get_nested_value_missing_key():
    """Missing key returns None."""
    data = {"name": "router01"}
    assert _get_nested_value(data, "role.name") is None


@pytest.mark.unit
def test_get_nested_value_intermediate_missing():
    """Missing intermediate key returns None."""
    data = {"location": None}
    assert _get_nested_value(data, "location.name") is None


# ── replace_template_variables ─────────────────────────────────────────────────


@pytest.mark.unit
def test_replace_template_variables_static():
    """Template with no variables is returned unchanged."""
    device = {"name": "router01"}
    assert replace_template_variables("static/path", device) == "static/path"


@pytest.mark.unit
def test_replace_template_variables_empty_template():
    """Empty template returns empty string."""
    assert replace_template_variables("", {"name": "x"}) == ""


@pytest.mark.unit
def test_replace_template_variables_device_name():
    """'{device_name}' is replaced with the device name."""
    device = {"name": "router01"}
    assert replace_template_variables("{device_name}.cfg", device) == "router01.cfg"


@pytest.mark.unit
def test_replace_template_variables_nested():
    """Nested dot-notation variable is replaced."""
    device = {"location": {"name": "DC1"}}
    result = replace_template_variables("{location.name}/config", device)
    assert result == "DC1/config"


@pytest.mark.unit
def test_replace_template_variables_multi_level_nested():
    """Multi-level nested variable is replaced."""
    device = {"location": {"parent": {"name": "USA"}}}
    result = replace_template_variables("{location.parent.name}/{location.parent.name}.cfg", device)
    assert result == "USA/USA.cfg"


@pytest.mark.unit
def test_replace_template_variables_custom_field():
    """Custom field variable is replaced."""
    device = {"custom_field_data": {"cf_net": "core"}}
    result = replace_template_variables("{custom_field_data.cf_net}/devices", device)
    assert result == "core/devices"


@pytest.mark.unit
def test_replace_template_variables_location_type_filter():
    """Location type filter resolves the matching hierarchy level."""
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
    result = replace_template_variables("{location.name | location_type:City}", device)
    assert result == "NYC"


@pytest.mark.unit
def test_replace_template_variables_missing_variable_kept():
    """Variable not found in device data is kept as-is in output."""
    device = {}
    result = replace_template_variables("{missing_field}/path", device)
    # The original variable is left unchanged when not found
    assert "{missing_field}" in result


# ── sanitize_path_component ────────────────────────────────────────────────────


@pytest.mark.unit
def test_sanitize_path_component_clean():
    """Already-clean component is returned unchanged."""
    assert sanitize_path_component("routerA") == "routerA"


@pytest.mark.unit
def test_sanitize_path_component_replaces_invalid_chars():
    """Characters like < > : " | ? * are replaced with underscores."""
    result = sanitize_path_component('file<name>:test"pipe|q?s*')
    assert "<" not in result
    assert ">" not in result
    assert ":" not in result
    assert '"' not in result
    assert "|" not in result
    assert "?" not in result
    assert "*" not in result


@pytest.mark.unit
def test_sanitize_path_component_strips_leading_dot():
    """Leading dot is removed."""
    assert sanitize_path_component(".hidden") == "hidden"


@pytest.mark.unit
def test_sanitize_path_component_strips_trailing_dot():
    """Trailing dot is removed."""
    assert sanitize_path_component("file.") == "file"


@pytest.mark.unit
def test_sanitize_path_component_strips_surrounding_spaces():
    """Leading and trailing spaces are removed."""
    assert sanitize_path_component("  name  ") == "name"


# ── validate_template_path ────────────────────────────────────────────────────


@pytest.mark.unit
def test_validate_template_path_valid_static():
    """Valid static path passes validation."""
    assert validate_template_path("/dc1/access") is True


@pytest.mark.unit
def test_validate_template_path_valid_with_variable():
    """Valid template with variable passes."""
    assert validate_template_path("/{location.name}/config") is True


@pytest.mark.unit
def test_validate_template_path_empty():
    """Empty template fails validation."""
    assert validate_template_path("") is False


@pytest.mark.unit
def test_validate_template_path_unbalanced_braces():
    """Unbalanced braces fail validation."""
    assert validate_template_path("{location.name") is False


@pytest.mark.unit
def test_validate_template_path_empty_variable():
    """Template with empty variable {} fails validation."""
    assert validate_template_path("/{}/path") is False
