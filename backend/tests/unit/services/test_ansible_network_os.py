"""Unit tests for network_driver → ansible_network_os mapping."""

from __future__ import annotations

import pytest

from services.cockpit_agent.ansible_network_os import (
    UnsupportedNetworkDriverError,
    resolve_ansible_network_os,
)


@pytest.mark.unit
@pytest.mark.parametrize(
    ("driver", "expected"),
    [
        ("cisco_ios", "cisco.ios.ios"),
        ("cisco_nxos", "cisco.nxos.nxos"),
        ("  cisco_ios  ", "cisco.ios.ios"),
    ],
)
def test_resolve_ansible_network_os_supported(driver: str, expected: str) -> None:
    assert resolve_ansible_network_os(driver) == expected


@pytest.mark.unit
@pytest.mark.parametrize("driver", ["", "   ", "juniper_junos", "cisco_xr"])
def test_resolve_ansible_network_os_unsupported(driver: str) -> None:
    with pytest.raises(UnsupportedNetworkDriverError):
        resolve_ansible_network_os(driver)
