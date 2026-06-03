"""Unit tests for utils/netmiko_platform_mapper.py."""

from __future__ import annotations

import pytest

from utils.netmiko_platform_mapper import NetmikoPlatformMapper, map_platform_to_netmiko


@pytest.mark.unit
def test_map_to_netmiko_matches_ios() -> None:
    assert NetmikoPlatformMapper.map_to_netmiko("Cisco IOS") == "cisco_ios"


@pytest.mark.unit
def test_map_to_netmiko_defaults_when_empty() -> None:
    assert NetmikoPlatformMapper.map_to_netmiko(None) == "cisco_ios"


@pytest.mark.unit
def test_map_to_netmiko_unknown_uses_default() -> None:
    assert NetmikoPlatformMapper.map_to_netmiko("unknown-os-xyz") == "cisco_ios"


@pytest.mark.unit
def test_add_mapping_extends_platform_map() -> None:
    NetmikoPlatformMapper.add_mapping("CustomOS", "juniper_junos")
    assert NetmikoPlatformMapper.map_to_netmiko("device with customos") == "juniper_junos"


@pytest.mark.unit
def test_convenience_function_delegates() -> None:
    assert map_platform_to_netmiko("NXOS") == "cisco_nxos"
