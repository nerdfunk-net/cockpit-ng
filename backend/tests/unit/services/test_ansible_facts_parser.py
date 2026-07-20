"""Unit tests for services/servers/ansible_facts_parser.py."""

from __future__ import annotations

import pytest

from services.servers.ansible_facts_parser import parse_ansible_facts

_BASE_ANSIBLE_FACTS = {
    "fqdn": "host1.example.com",
    "hostname": "host1",
    "os_family": "Debian",
    "distribution": "Ubuntu",
    "processor_count": 4,
    "memtotal_mb": 8192,
    "architecture": "x86_64",
    "distribution_release": "jammy",
    "distribution_version": "22.04",
    "default_ipv4": {"address": "10.0.0.5", "interface": "eth0"},
    "mounts": [
        {
            "device": "/dev/sda1",
            "fstype": "ext4",
            "size_total": 50 * (1024**3),
            "size_available": 25 * (1024**3),
        },
        {
            "device": "tmpfs",
            "fstype": "tmpfs",
            "size_total": 1024**3,
            "size_available": 512 * (1024**2),
        },
        {
            "device": "/dev/sdb1",
            "fstype": "tmpfs",
            "size_total": 10 * (1024**3),
            "size_available": 5 * (1024**3),
        },
    ],
}


def _output(ansible_facts=None, virtualization_role=None):
    raw_facts = {"ansible_facts": ansible_facts if ansible_facts is not None else {}}
    if virtualization_role is not None:
        raw_facts["ansible_virtualization_role"] = virtualization_role
    return {"facts": raw_facts, "ip_address": "10.0.0.5", "hostname": "host1"}


@pytest.mark.unit
class TestParseAnsibleFacts:
    def test_parses_full_facts(self) -> None:
        result = parse_ansible_facts(_output(_BASE_ANSIBLE_FACTS, "host"))

        assert result.hostname == "host1.example.com"
        assert result.os_family == "Debian"
        assert result.distribution == "Ubuntu"
        assert result.processor_count == 4
        assert result.memtotal_mb == 8192
        assert result.architecture == "x86_64"
        assert result.distribution_release == "jammy"
        assert result.distribution_version == "22.04"
        assert result.primary_ipv4 == "10.0.0.5"
        assert result.primary_interface == "eth0"
        assert result.disk_total_gb == 50
        assert result.disk_usage_pct == 50
        assert result.is_virtual is False

    def test_only_real_devfs_mounts_are_counted(self) -> None:
        result = parse_ansible_facts(_output(_BASE_ANSIBLE_FACTS))
        # /dev/sda1 (ext4) counts; tmpfs and /dev/sdb1 (tmpfs fstype) don't.
        assert result.disk_count == 1
        assert result.disk_total_gb == 50
        assert result.disk_usage_pct == 50

    def test_virtualization_role_guest_marks_virtual(self) -> None:
        result = parse_ansible_facts(_output(_BASE_ANSIBLE_FACTS, "guest"))
        assert result.is_virtual is True

    def test_hostname_falls_back_to_short_hostname(self) -> None:
        facts = dict(_BASE_ANSIBLE_FACTS)
        facts.pop("fqdn")
        result = parse_ansible_facts(_output(facts))
        assert result.hostname == "host1"

    def test_missing_default_ipv4_yields_empty_strings(self) -> None:
        facts = dict(_BASE_ANSIBLE_FACTS)
        facts.pop("default_ipv4")
        result = parse_ansible_facts(_output(facts))
        assert result.primary_ipv4 == ""
        assert result.primary_interface == ""

    def test_empty_output_returns_defaults(self) -> None:
        result = parse_ansible_facts(None)
        assert result.hostname == ""
        assert result.os_family == ""
        assert result.processor_count is None
        assert result.disk_count == 0
        assert result.disk_total_gb is None
        assert result.disk_usage_pct is None
        assert result.is_virtual is False
        assert result.ansible_facts is None
        assert result.distribution == ""

    def test_ansible_facts_field_preserves_raw_facts_dict(self) -> None:
        result = parse_ansible_facts(_output(_BASE_ANSIBLE_FACTS, "host"))
        assert result.ansible_facts is not None
        assert result.ansible_facts["ansible_facts"] == _BASE_ANSIBLE_FACTS
        assert result.ansible_facts["ansible_virtualization_role"] == "host"
