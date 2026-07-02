"""Python port of frontend's parse-ansible-facts.ts — keep both in sync.

Source: frontend/src/components/features/server-clients/server/utils/parse-ansible-facts.ts
"""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

_VIRTUAL_FS = frozenset(
    {
        "tmpfs",
        "proc",
        "sysfs",
        "devtmpfs",
        "cgroup",
        "cgroup2",
        "devpts",
        "hugetlbfs",
        "mqueue",
        "securityfs",
        "fusectl",
        "pstore",
    }
)


def _count_real_mounts(mounts: List[Dict[str, Any]]) -> int:
    return sum(
        1
        for m in mounts
        if str(m.get("device") or "").startswith("/dev/")
        and (m.get("fstype") or "") not in _VIRTUAL_FS
    )


@dataclass(frozen=True)
class ParsedAnsibleFacts:
    hostname: str
    os_family: str
    processor_count: Optional[int]
    memtotal_mb: Optional[int]
    architecture: str
    distribution_release: str
    distribution_version: str
    primary_ipv4: str
    primary_interface: str
    disk_count: int
    is_virtual: bool
    ansible_facts: Optional[Dict[str, Any]]


def parse_ansible_facts(output: Optional[Dict[str, Any]]) -> ParsedAnsibleFacts:
    """Parse the raw `output` dict returned by CockpitAgentService.send_ansible_get_facts()."""
    raw = output or {}
    raw_facts = raw.get("facts") or {}
    f = raw_facts.get("ansible_facts") or {}

    default_ipv4 = f.get("default_ipv4") or {}
    mounts = f.get("mounts") or []
    virtualization_role = raw_facts.get("ansible_virtualization_role")

    return ParsedAnsibleFacts(
        hostname=f.get("fqdn") or f.get("hostname") or "",
        os_family=f.get("os_family") or "",
        processor_count=f.get("processor_count"),
        memtotal_mb=f.get("memtotal_mb"),
        architecture=f.get("architecture") or "",
        distribution_release=f.get("distribution_release") or "",
        distribution_version=f.get("distribution_version") or "",
        primary_ipv4=default_ipv4.get("address") or "",
        primary_interface=default_ipv4.get("interface") or "",
        disk_count=_count_real_mounts(mounts),
        is_virtual=virtualization_role == "guest",
        ansible_facts=raw_facts or None,
    )
