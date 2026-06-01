"""Unit tests for tasks/ping_network_task.py.

Covers the pure helper functions (_expand_cidr_to_ips, _is_valid_ip,
_condense_ip_ranges) and the ping_network_task Celery task.
All tests run offline — no fping, Celery broker, or database required.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from tasks.ping_network_task import (
    _condense_ip_ranges,
    _expand_cidr_to_ips,
    _is_valid_ip,
    ping_network_task,
)


def _make_job_run_service(job_run_id: int = 1) -> MagicMock:
    jrs = MagicMock()
    jrs.create_job_run.return_value = {"id": job_run_id}
    return jrs


# ── _expand_cidr_to_ips ───────────────────────────────────────────────────────


@pytest.mark.unit
def test_expand_cidr_returns_host_addresses_for_slash24():
    """/24 network expands to 254 host IPs (excludes network and broadcast)."""
    ips = _expand_cidr_to_ips("192.168.1.0/24")
    assert len(ips) == 254
    assert "192.168.1.0" not in ips
    assert "192.168.1.255" not in ips
    assert "192.168.1.1" in ips
    assert "192.168.1.254" in ips


@pytest.mark.unit
def test_expand_cidr_slash32_returns_single_host():
    """/32 returns exactly the host address."""
    ips = _expand_cidr_to_ips("10.0.0.5/32")
    assert ips == ["10.0.0.5"]


@pytest.mark.unit
def test_expand_cidr_slash19_is_allowed():
    """/19 is the minimum allowed prefix length and should succeed."""
    ips = _expand_cidr_to_ips("10.0.0.0/19")
    assert len(ips) == 8190


@pytest.mark.unit
def test_expand_cidr_too_large_raises_value_error():
    """Networks larger than /19 (e.g. /18) are rejected with ValueError."""
    with pytest.raises(ValueError, match="too large"):
        _expand_cidr_to_ips("10.0.0.0/18")


@pytest.mark.unit
def test_expand_cidr_invalid_notation_raises_value_error():
    """Invalid CIDR notation raises ValueError."""
    with pytest.raises(ValueError):
        _expand_cidr_to_ips("not-a-cidr")


# ── _is_valid_ip ──────────────────────────────────────────────────────────────


@pytest.mark.unit
def test_is_valid_ip_valid_address():
    """Standard IPv4 addresses are recognized as valid."""
    assert _is_valid_ip("192.168.1.1") is True
    assert _is_valid_ip("10.0.0.1") is True
    assert _is_valid_ip("255.255.255.255") is True


@pytest.mark.unit
def test_is_valid_ip_invalid_address():
    """Strings that are not valid IP addresses return False."""
    assert _is_valid_ip("999.999.999.999") is False
    assert _is_valid_ip("not-an-ip") is False
    assert _is_valid_ip("192.168.1") is False


@pytest.mark.unit
def test_is_valid_ip_ipv6_is_valid():
    """IPv6 addresses are also recognized as valid IPs."""
    assert _is_valid_ip("::1") is True
    assert _is_valid_ip("2001:db8::1") is True


# ── _condense_ip_ranges ───────────────────────────────────────────────────────


@pytest.mark.unit
def test_condense_ip_ranges_empty_list():
    """Empty input returns empty list."""
    assert _condense_ip_ranges([]) == []


@pytest.mark.unit
def test_condense_ip_ranges_single_ip():
    """Single IP is returned as-is without range notation."""
    assert _condense_ip_ranges(["192.168.1.1"]) == ["192.168.1.1"]


@pytest.mark.unit
def test_condense_ip_ranges_consecutive_ips():
    """Three consecutive IPs are condensed into a range."""
    result = _condense_ip_ranges(["192.168.1.10", "192.168.1.11", "192.168.1.12"])
    assert result == ["192.168.1.10 - 12"]


@pytest.mark.unit
def test_condense_ip_ranges_non_consecutive_kept_separate():
    """IPs with a gap between them remain as separate entries."""
    result = _condense_ip_ranges(["192.168.1.1", "192.168.1.5"])
    assert len(result) == 2
    assert "192.168.1.1" in result
    assert "192.168.1.5" in result


@pytest.mark.unit
def test_condense_ip_ranges_unsorted_input():
    """Input does not need to be sorted — the function sorts internally."""
    result = _condense_ip_ranges(["192.168.1.12", "192.168.1.10", "192.168.1.11"])
    assert result == ["192.168.1.10 - 12"]


@pytest.mark.unit
def test_condense_ip_ranges_cross_subnet_boundary():
    """IPs across a /24 boundary (different third octet) are kept separate."""
    result = _condense_ip_ranges(["192.168.1.254", "192.168.2.1"])
    assert len(result) == 2


@pytest.mark.unit
def test_condense_ip_ranges_mixed_ranges_and_singles():
    """Output correctly mixes condensed ranges with isolated IPs."""
    ips = ["10.0.0.1", "10.0.0.2", "10.0.0.3", "10.0.0.10", "10.0.0.20"]
    result = _condense_ip_ranges(ips)
    assert "10.0.0.1 - 3" in result
    assert "10.0.0.10" in result
    assert "10.0.0.20" in result
    assert len(result) == 3


# ── ping_network_task ─────────────────────────────────────────────────────────


@pytest.mark.unit
def test_ping_network_task_success_with_alive_hosts():
    """Task reports correct reachable/unreachable counts."""
    mock_jrs = _make_job_run_service(job_run_id=5)
    alive = {"192.168.1.1", "192.168.1.2"}

    with patch.object(ping_network_task, "update_state"):
        with patch("tasks.ping_network_task.service_factory") as mock_sf:
            mock_sf.build_job_run_service.return_value = mock_jrs
            with patch("tasks.ping_network_task._fping_networks", return_value=alive):
                result = ping_network_task.run(cidrs=["192.168.1.0/24"], resolve_dns=False)

    assert result["success"] is True
    assert result["total_reachable"] == 2
    assert result["total_networks"] == 1
    network = result["networks"][0]
    assert network["network"] == "192.168.1.0/24"
    assert network["reachable_count"] == 2


@pytest.mark.unit
def test_ping_network_task_no_alive_hosts():
    """Task succeeds with zero reachable hosts when fping returns empty set."""
    mock_jrs = _make_job_run_service()

    with patch.object(ping_network_task, "update_state"):
        with patch("tasks.ping_network_task.service_factory") as mock_sf:
            mock_sf.build_job_run_service.return_value = mock_jrs
            with patch("tasks.ping_network_task._fping_networks", return_value=set()):
                result = ping_network_task.run(cidrs=["192.168.1.0/24"])

    assert result["success"] is True
    assert result["total_reachable"] == 0
    assert result["networks"][0]["reachable_count"] == 0


@pytest.mark.unit
def test_ping_network_task_invalid_cidr_handled_gracefully():
    """Invalid CIDR in the list yields a network entry with 0 IPs; task still succeeds."""
    mock_jrs = _make_job_run_service()

    with patch.object(ping_network_task, "update_state"):
        with patch("tasks.ping_network_task.service_factory") as mock_sf:
            mock_sf.build_job_run_service.return_value = mock_jrs
            with patch("tasks.ping_network_task._fping_networks", return_value=set()):
                result = ping_network_task.run(cidrs=["not-a-cidr"])

    assert result["success"] is True
    assert result["networks"][0]["total_ips"] == 0


@pytest.mark.unit
def test_ping_network_task_multiple_cidrs():
    """Results are reported per CIDR when multiple networks are given."""
    mock_jrs = _make_job_run_service()

    with patch.object(ping_network_task, "update_state"):
        with patch("tasks.ping_network_task.service_factory") as mock_sf:
            mock_sf.build_job_run_service.return_value = mock_jrs
            with patch("tasks.ping_network_task._fping_networks", return_value=set()):
                result = ping_network_task.run(
                    cidrs=["192.168.1.0/24", "192.168.2.0/24"],
                )

    assert result["total_networks"] == 2
    assert len(result["networks"]) == 2


@pytest.mark.unit
def test_ping_network_task_marks_job_completed():
    """Job run is marked as completed after a successful scan."""
    mock_jrs = _make_job_run_service(job_run_id=9)

    with patch.object(ping_network_task, "update_state"):
        with patch("tasks.ping_network_task.service_factory") as mock_sf:
            mock_sf.build_job_run_service.return_value = mock_jrs
            with patch("tasks.ping_network_task._fping_networks", return_value=set()):
                ping_network_task.run(cidrs=["192.168.1.0/24"])

    mock_jrs.mark_completed.assert_called_once()


@pytest.mark.unit
def test_ping_network_task_service_exception_returns_error():
    """Exception creating the job run record is caught and returns success=False."""
    with patch.object(ping_network_task, "update_state"):
        with patch("tasks.ping_network_task.service_factory") as mock_sf:
            mock_sf.build_job_run_service.side_effect = RuntimeError("redis down")
            result = ping_network_task.run(cidrs=["192.168.1.0/24"])

    assert result["success"] is False
    assert "redis down" in result["error"]
