"""Unit tests for utils/nautobot_helpers.py.

All tests run offline — no real Nautobot or database required.
get_nautobot_config() is not tested here as it requires DB/env setup;
get_nautobot_headers() is fully pure.
"""

from __future__ import annotations

import pytest

from utils.nautobot_helpers import get_nautobot_headers

# ── get_nautobot_headers ───────────────────────────────────────────────────────


@pytest.mark.unit
def test_get_nautobot_headers_content_type():
    """Headers contain the correct Content-Type."""
    headers = get_nautobot_headers("my-token")
    assert headers["Content-Type"] == "application/json"


@pytest.mark.unit
def test_get_nautobot_headers_authorization_format():
    """Authorization header follows 'Token <token>' format."""
    headers = get_nautobot_headers("abc123")
    assert headers["Authorization"] == "Token abc123"


@pytest.mark.unit
def test_get_nautobot_headers_returns_dict():
    """Return value is a dict with exactly two keys."""
    headers = get_nautobot_headers("tok")
    assert isinstance(headers, dict)
    assert set(headers.keys()) == {"Content-Type", "Authorization"}


@pytest.mark.unit
def test_get_nautobot_headers_empty_token():
    """Empty token produces 'Token ' authorization header."""
    headers = get_nautobot_headers("")
    assert headers["Authorization"] == "Token "
