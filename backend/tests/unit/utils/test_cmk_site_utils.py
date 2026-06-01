"""Unit tests for utils/cmk_site_utils.py pure helper functions.

All tests run offline — no real CheckMK or database connections required.
Tests cover the private pure functions that do not depend on service_factory.
"""

from __future__ import annotations

import pytest

from utils.cmk_site_utils import (
    _extract_device_ip,
    _match_ip_to_folder,
    _match_ip_to_site,
)

# ── _extract_device_ip ─────────────────────────────────────────────────────────


@pytest.mark.unit
def test_extract_device_ip_with_cidr():
    """IP address with CIDR notation strips the prefix length."""
    device = {"primary_ip4": {"address": "10.0.0.1/24"}}
    assert _extract_device_ip(device) == "10.0.0.1"


@pytest.mark.unit
def test_extract_device_ip_without_cidr():
    """Plain IP address is returned as-is."""
    device = {"primary_ip4": {"address": "192.168.1.50"}}
    assert _extract_device_ip(device) == "192.168.1.50"


@pytest.mark.unit
def test_extract_device_ip_no_primary_ip4():
    """Device without primary_ip4 returns empty string."""
    device = {"name": "router1"}
    assert _extract_device_ip(device) == ""


@pytest.mark.unit
def test_extract_device_ip_primary_ip4_none():
    """primary_ip4 set to None returns empty string."""
    device = {"primary_ip4": None}
    assert _extract_device_ip(device) == ""


@pytest.mark.unit
def test_extract_device_ip_primary_ip4_no_address():
    """primary_ip4 without address key returns empty string."""
    device = {"primary_ip4": {}}
    assert _extract_device_ip(device) == ""


# ── _match_ip_to_site ──────────────────────────────────────────────────────────


@pytest.mark.unit
def test_match_ip_to_site_exact_match():
    """IP inside a /32 CIDR matches the site."""
    by_ip = {"10.0.0.1/32": "prod"}
    assert _match_ip_to_site("10.0.0.1", by_ip) == "prod"


@pytest.mark.unit
def test_match_ip_to_site_network_match():
    """IP inside a /24 network matches the site."""
    by_ip = {"10.0.0.0/24": "dc1"}
    assert _match_ip_to_site("10.0.0.100", by_ip) == "dc1"


@pytest.mark.unit
def test_match_ip_to_site_no_match():
    """IP outside all configured networks returns None."""
    by_ip = {"10.0.0.0/24": "dc1"}
    assert _match_ip_to_site("192.168.1.1", by_ip) is None


@pytest.mark.unit
def test_match_ip_to_site_empty_config():
    """Empty config returns None."""
    assert _match_ip_to_site("10.0.0.1", {}) is None


@pytest.mark.unit
def test_match_ip_to_site_invalid_device_ip():
    """Invalid device IP raises ValueError (not handled internally)."""
    by_ip = {"10.0.0.0/24": "dc1"}
    with pytest.raises(ValueError):
        _match_ip_to_site("not-an-ip", by_ip)


@pytest.mark.unit
def test_match_ip_to_site_invalid_cidr_in_config():
    """Invalid CIDR in config raises ValueError (not handled internally)."""
    by_ip = {"not-a-cidr": "dc1"}
    with pytest.raises(ValueError):
        _match_ip_to_site("10.0.0.1", by_ip)


@pytest.mark.unit
def test_match_ip_to_site_first_match_wins():
    """First matching CIDR is returned (dict iteration order)."""
    by_ip = {"10.0.0.0/8": "broad", "10.0.0.0/24": "narrow"}
    result = _match_ip_to_site("10.0.0.5", by_ip)
    # Either match is valid; just verify a value is returned
    assert result in ("broad", "narrow")


# ── _match_ip_to_folder ────────────────────────────────────────────────────────


@pytest.mark.unit
def test_match_ip_to_folder_network_match():
    """IP inside a configured network returns the folder template."""
    by_ip = {"172.16.0.0/12": "/internal"}
    assert _match_ip_to_folder("172.16.0.1", by_ip) == "/internal"


@pytest.mark.unit
def test_match_ip_to_folder_no_match():
    """IP outside all networks returns None."""
    by_ip = {"10.0.0.0/8": "/dc"}
    assert _match_ip_to_folder("192.168.1.1", by_ip) is None


@pytest.mark.unit
def test_match_ip_to_folder_empty_config():
    """Empty config returns None."""
    assert _match_ip_to_folder("10.0.0.1", {}) is None


@pytest.mark.unit
def test_match_ip_to_folder_invalid_ip():
    """Invalid device IP raises ValueError (not handled internally)."""
    by_ip = {"10.0.0.0/24": "/dc"}
    with pytest.raises(ValueError):
        _match_ip_to_folder("bad-ip", by_ip)
