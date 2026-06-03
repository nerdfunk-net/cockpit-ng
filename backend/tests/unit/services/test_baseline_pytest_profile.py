"""Unit tests for pytest_legacy baseline generation."""

from __future__ import annotations

from models.tools import CreateBaselineRequest
from services.network.tools.baseline_generator import (
    compute_stats,
    generate_baseline_dict,
)


def test_pytest_profile_stats_and_unique_ips() -> None:
    request = CreateBaselineRequest(profile="pytest", name="baseline")
    data = generate_baseline_dict(request)
    stats = compute_stats(data)

    assert stats.network_devices == 100
    assert stats.server_devices == 20
    assert stats.tags.get("Production") == 39
    assert stats.tags.get("Staging") == 52
    assert stats.tags.get("lab") == 29
    assert stats.statuses.get("Active") == 66
    assert stats.statuses.get("Offline") == 54

    primaries = [d["primary_ip4"].split("/")[0] for d in data["devices"]]
    assert len(primaries) == len(set(primaries))

    names = {d["name"] for d in data["devices"]}
    assert "lab-001" in names
    assert "lab-100" in names
    assert "server-20" in names
