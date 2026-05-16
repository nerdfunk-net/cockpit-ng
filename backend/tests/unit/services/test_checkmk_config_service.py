"""Unit tests for services/checkmk/config.py (ConfigService).

All tests run offline — file I/O is replaced with mock_open.
"""

from __future__ import annotations

from unittest.mock import mock_open, patch

import pytest
import yaml

from services.checkmk.config import ConfigService

# ── Helpers ───────────────────────────────────────────────────────────────────

_CHECKMK_CONFIG = {
    "monitored_site": {"default": "prod"},
    "compare": ["folder", "attributes"],
    "ignore_attributes": ["labels", "meta_data"],
}

_SNMP_CONFIG = {
    "mappings": [{"oid": "1.3.6.1.4.1.9", "platform": "cisco"}]
}

_QUERIES_CONFIG = {
    "queries": {
        "all_devices": "query { devices { id name } }",
        "device_by_name": "  query { device(name: $name) { id } }  ",
    }
}


def _mock_yaml_open(data: dict):
    """Return a mock_open context manager that yields the YAML dump of data."""
    return mock_open(read_data=yaml.dump(data))


# ── load_checkmk_config ───────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_load_checkmk_config_parses_yaml():
    """load_checkmk_config() returns the parsed YAML dict."""
    with patch("builtins.open", _mock_yaml_open(_CHECKMK_CONFIG)):
        result = ConfigService().load_checkmk_config()

    assert result["monitored_site"]["default"] == "prod"
    assert result["compare"] == ["folder", "attributes"]


@pytest.mark.unit
@pytest.mark.checkmk
def test_load_checkmk_config_caches_result():
    """load_checkmk_config() reads the file only once on repeated calls."""
    m = _mock_yaml_open(_CHECKMK_CONFIG)
    with patch("builtins.open", m):
        svc = ConfigService()
        svc.load_checkmk_config()
        svc.load_checkmk_config()  # second call should use cache

    assert m.call_count == 1


@pytest.mark.unit
@pytest.mark.checkmk
def test_load_checkmk_config_force_reload_reads_again():
    """force_reload=True bypasses the cache and reads the file again."""
    m = _mock_yaml_open(_CHECKMK_CONFIG)
    with patch("builtins.open", m):
        svc = ConfigService()
        svc.load_checkmk_config()
        svc.load_checkmk_config(force_reload=True)

    assert m.call_count == 2


@pytest.mark.unit
@pytest.mark.checkmk
def test_load_checkmk_config_file_not_found():
    """load_checkmk_config() propagates FileNotFoundError."""
    with patch("builtins.open", side_effect=FileNotFoundError("not found")):
        with pytest.raises(FileNotFoundError):
            ConfigService().load_checkmk_config()


# ── load_snmp_mapping ─────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_load_snmp_mapping_parses_yaml():
    """load_snmp_mapping() returns the parsed SNMP mapping dict."""
    with patch("builtins.open", _mock_yaml_open(_SNMP_CONFIG)):
        result = ConfigService().load_snmp_mapping()

    assert result["mappings"][0]["platform"] == "cisco"


@pytest.mark.unit
@pytest.mark.checkmk
def test_load_snmp_mapping_caches_result():
    """load_snmp_mapping() reads the file only once."""
    m = _mock_yaml_open(_SNMP_CONFIG)
    with patch("builtins.open", m):
        svc = ConfigService()
        svc.load_snmp_mapping()
        svc.load_snmp_mapping()

    assert m.call_count == 1


@pytest.mark.unit
@pytest.mark.checkmk
def test_load_snmp_mapping_file_not_found():
    """load_snmp_mapping() propagates FileNotFoundError."""
    with patch("builtins.open", side_effect=FileNotFoundError("not found")):
        with pytest.raises(FileNotFoundError):
            ConfigService().load_snmp_mapping()


# ── load_queries ──────────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_load_queries_parses_yaml():
    """load_queries() returns the parsed queries dict."""
    with patch("builtins.open", _mock_yaml_open(_QUERIES_CONFIG)):
        result = ConfigService().load_queries()

    assert "all_devices" in result["queries"]


@pytest.mark.unit
@pytest.mark.checkmk
def test_load_queries_caches_result():
    """load_queries() reads the file only once on repeated calls."""
    m = _mock_yaml_open(_QUERIES_CONFIG)
    with patch("builtins.open", m):
        svc = ConfigService()
        svc.load_queries()
        svc.load_queries()

    assert m.call_count == 1


# ── get_query ─────────────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_query_returns_stripped_query_string():
    """get_query() strips whitespace from the stored query."""
    with patch("builtins.open", _mock_yaml_open(_QUERIES_CONFIG)):
        svc = ConfigService()
        result = svc.get_query("device_by_name")

    assert result == "query { device(name: $name) { id } }"


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_query_returns_none_for_missing_key():
    """get_query() returns None when the query name is not in config."""
    with patch("builtins.open", _mock_yaml_open(_QUERIES_CONFIG)):
        svc = ConfigService()
        result = svc.get_query("nonexistent_query")

    assert result is None


# ── get_default_site ──────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_default_site_returns_configured_value():
    """get_default_site() returns the value from monitored_site.default."""
    with patch("builtins.open", _mock_yaml_open(_CHECKMK_CONFIG)):
        svc = ConfigService()
        result = svc.get_default_site()

    assert result == "prod"


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_default_site_falls_back_to_cmk():
    """get_default_site() returns 'cmk' when monitored_site key is absent."""
    minimal = {}
    with patch("builtins.open", _mock_yaml_open(minimal)):
        svc = ConfigService()
        result = svc.get_default_site()

    assert result == "cmk"


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_default_site_falls_back_on_exception():
    """get_default_site() returns 'cmk' when file reading fails."""
    with patch("builtins.open", side_effect=FileNotFoundError):
        result = ConfigService().get_default_site()

    assert result == "cmk"


# ── get_comparison_keys ───────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_comparison_keys_returns_configured_list():
    """get_comparison_keys() returns the 'compare' list from config."""
    with patch("builtins.open", _mock_yaml_open(_CHECKMK_CONFIG)):
        svc = ConfigService()
        result = svc.get_comparison_keys()

    assert result == ["folder", "attributes"]


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_comparison_keys_defaults_on_missing_key():
    """get_comparison_keys() returns default list when key absent."""
    minimal = {}
    with patch("builtins.open", _mock_yaml_open(minimal)):
        result = ConfigService().get_comparison_keys()

    assert result == ["attributes", "folder"]


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_comparison_keys_defaults_on_exception():
    """get_comparison_keys() returns default list on error."""
    with patch("builtins.open", side_effect=FileNotFoundError):
        result = ConfigService().get_comparison_keys()

    assert result == ["attributes", "folder"]


# ── get_ignore_attributes ─────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_ignore_attributes_returns_configured_list():
    """get_ignore_attributes() returns the ignore_attributes list."""
    with patch("builtins.open", _mock_yaml_open(_CHECKMK_CONFIG)):
        svc = ConfigService()
        result = svc.get_ignore_attributes()

    assert result == ["labels", "meta_data"]


@pytest.mark.unit
@pytest.mark.checkmk
def test_get_ignore_attributes_returns_empty_when_absent():
    """get_ignore_attributes() returns [] when key is missing."""
    minimal = {}
    with patch("builtins.open", _mock_yaml_open(minimal)):
        result = ConfigService().get_ignore_attributes()

    assert result == []


# ── reload_config ─────────────────────────────────────────────────────────────


@pytest.mark.unit
@pytest.mark.checkmk
def test_reload_config_clears_all_caches():
    """reload_config() resets all in-memory caches so next call re-reads."""
    m = _mock_yaml_open(_CHECKMK_CONFIG)
    with patch("builtins.open", m):
        svc = ConfigService()
        svc.load_checkmk_config()  # populates cache
        svc.reload_config()
        svc.load_checkmk_config()  # should read again

    assert m.call_count == 2
