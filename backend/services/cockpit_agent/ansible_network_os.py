"""Map Nautobot platform.network_driver values to Ansible ansible_network_os."""

from __future__ import annotations

# Nautobot / Netmiko-style network_driver → Ansible collection network OS
NETWORK_DRIVER_TO_ANSIBLE_OS: dict[str, str] = {
    "cisco_ios": "cisco.ios.ios",
    "cisco_nxos": "cisco.nxos.nxos",
}

SUPPORTED_NETWORK_DRIVERS = frozenset(NETWORK_DRIVER_TO_ANSIBLE_OS)


class UnsupportedNetworkDriverError(ValueError):
    """Raised when a platform network_driver has no Ansible mapping."""


def resolve_ansible_network_os(network_driver: str) -> str:
    """
    Resolve ansible_network_os from a Nautobot platform.network_driver.

    Args:
        network_driver: e.g. ``cisco_ios``, ``cisco_nxos``

    Returns:
        Ansible network OS string, e.g. ``cisco.ios.ios``

    Raises:
        UnsupportedNetworkDriverError: if the driver is unknown or empty
    """
    driver = (network_driver or "").strip()
    if not driver:
        raise UnsupportedNetworkDriverError("network_driver is required")

    ansible_os = NETWORK_DRIVER_TO_ANSIBLE_OS.get(driver)
    if ansible_os is None:
        supported = ", ".join(sorted(SUPPORTED_NETWORK_DRIVERS))
        raise UnsupportedNetworkDriverError(
            f"Unsupported network_driver {driver!r}. Supported: {supported}"
        )
    return ansible_os
