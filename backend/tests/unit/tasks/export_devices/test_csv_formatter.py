"""Unit tests for tasks/export_devices/formatters/csv.py."""

from __future__ import annotations

import pytest

from tasks.export_devices.formatters.csv import (
    _extract_device_fields,
    _extract_interface_fields,
    export_to_csv,
)


@pytest.mark.unit
def test_export_to_csv_empty_devices() -> None:
    assert export_to_csv([], {}) == ""


@pytest.mark.unit
def test_export_to_csv_device_without_interfaces() -> None:
    devices = [
        {
            "name": "switch1",
            "serial": "ABC",
            "role": {"name": "Access"},
            "status": {"name": "active"},
            "tags": [{"name": "lab"}],
        }
    ]

    csv_content = export_to_csv(
        devices,
        {"delimiter": ",", "quoteChar": '"', "includeHeaders": True},
    )

    assert "name" in csv_content
    assert "switch1" in csv_content
    assert "Access" in csv_content


@pytest.mark.unit
def test_export_to_csv_one_row_per_interface() -> None:
    devices = [
        {
            "name": "r1",
            "interfaces": [
                {
                    "name": "eth0",
                    "type": "1000base-t",
                    "ip_addresses": [{"address": "10.0.0.1/24"}],
                },
                {"name": "eth1", "type": "virtual"},
            ],
        }
    ]

    csv_content = export_to_csv(devices, {"delimiter": ";", "includeHeaders": True})

    assert csv_content.count("r1") == 2
    assert "interface_eth0" in csv_content or "interface_name" in csv_content
    assert "eth0" in csv_content
    assert "eth1" in csv_content


@pytest.mark.unit
def test_extract_device_fields_flattens_nested_and_custom_fields() -> None:
    fields = _extract_device_fields(
        {
            "name": "core",
            "role": {"name": "Core"},
            "primary_ip4": {
                "address": "10.0.0.5/24",
                "parent": {"namespace": {"name": "Global"}},
            },
            "_custom_field_data": {"site": "east"},
        }
    )

    assert fields["name"] == "core"
    assert fields["role"] == "Core"
    assert fields["ip_address"] == "10.0.0.5/24"
    assert fields["namespace"] == "Global"
    assert fields["cf_site"] == "east"


@pytest.mark.unit
def test_extract_interface_fields_sets_primary_ipv4_flag() -> None:
    device = {"primary_ip4": {"address": "10.0.0.1/24"}}
    iface = {
        "name": "Gi0/1",
        "type": "1000base-t",
        "enabled": True,
        "ip_addresses": [{"address": "10.0.0.1/24"}],
    }

    fields = _extract_interface_fields(iface, device)

    assert fields["interface_name"] == "Gi0/1"
    assert fields["interface_ip_address"] == "10.0.0.1/24"
    assert fields["set_primary_ipv4"] == "true"
