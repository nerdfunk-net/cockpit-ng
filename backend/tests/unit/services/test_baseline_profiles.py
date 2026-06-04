"""Unit tests for baseline profile loading and merge."""

from __future__ import annotations

import pytest

from models.tools import CreateBaselineRequest
from services.network.tools.baseline_profiles import (
    list_profiles,
    load_profile,
    merge_profile_into_request,
)

pytestmark = pytest.mark.unit


def test_list_profiles_includes_pytest() -> None:
    ids = {profile.id for profile in list_profiles()}
    assert "pytest" in ids
    assert "demo" in ids


def test_load_pytest_profile() -> None:
    profile = load_profile("pytest")
    assert profile["id"] == "pytest"
    assert profile["request"]["layout"] == "pytest_legacy"


def test_merge_profile_overrides_defaults() -> None:
    request = CreateBaselineRequest(profile="pytest", name="baseline")
    merged = merge_profile_into_request(request)
    assert merged.layout == "pytest_legacy"
    assert merged.number_of_network_devices == 100
    assert merged.number_of_servers == 20
    assert merged.metadata_mode == "golden_parity"
    assert merged.server_role == "Server"
    assert "net=netA" in merged.custom_fields
    assert "checkmk_site=siteA" in merged.custom_fields


def test_merge_unknown_profile_raises() -> None:
    request = CreateBaselineRequest(profile="nonexistent", name="x")
    with pytest.raises(ValueError, match="Unknown baseline profile"):
        merge_profile_into_request(request)
