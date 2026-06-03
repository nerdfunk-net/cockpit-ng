"""Unit tests for CheckMK URL parsing."""

from __future__ import annotations

import pytest

from services.checkmk.base import checkmk_api_base_url, parse_checkmk_url

pytestmark = pytest.mark.unit


@pytest.mark.parametrize(
    ("url", "site_arg", "protocol", "host", "site"),
    [
        ("http://192.168.178.101:8080", "cmk", "http", "192.168.178.101:8080", "cmk"),
        (
            "http://192.168.178.101:8080/cmk",
            None,
            "http",
            "192.168.178.101:8080",
            "cmk",
        ),
        (
            "http://192.168.178.101:8080/cmk/check_mk/api/1.0",
            None,
            "http",
            "192.168.178.101:8080",
            "cmk",
        ),
        ("https://checkmk.local", "main", "https", "checkmk.local", "main"),
    ],
)
def test_parse_checkmk_url(url, site_arg, protocol, host, site):
    assert parse_checkmk_url(url, site_arg) == (protocol, host, site)
    assert (
        checkmk_api_base_url(protocol, host, site)
        == f"{protocol}://{host}/{site}/check_mk/api/1.0"
    )
