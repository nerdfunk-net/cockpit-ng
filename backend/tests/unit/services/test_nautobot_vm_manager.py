"""Unit tests for VirtualMachineManager.

All tests run offline - no real Nautobot instance required.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, call

import pytest

from services.nautobot.common.exceptions import NautobotAPIError
from services.nautobot.managers.vm_manager import VirtualMachineManager

VM_ID = "ac000000-0000-0000-0004-000000000001"
CLUSTER_ID = "ac000000-0000-0000-0005-000000000001"
STATUS_ID = "ac000000-0000-0000-0006-000000000001"
ROLE_ID = "ac000000-0000-0000-0007-000000000001"
IP_ID = "ac000000-0000-0000-0001-000000000001"
VIF_ID = "ac000000-0000-0000-0002-000000000001"


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_assign_ip_to_virtual_interface_skips_existing_assignment() -> None:
    """An existing VM interface IP assignment is not recreated."""
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(
        return_value={"count": 1, "results": [{"id": "assoc"}]}
    )
    manager = VirtualMachineManager(mock_nb)

    result = await manager.assign_ip_to_virtual_interface(IP_ID, VIF_ID)

    assert result is True
    mock_nb.rest_request.assert_awaited_once_with(
        endpoint=f"ipam/ip-address-to-interface/?ip_address={IP_ID}&vm_interface={VIF_ID}",
        method="GET",
    )


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_assign_ip_to_virtual_interface_creates_assignment() -> None:
    """Missing VM interface IP assignments are created with vm_interface payload."""
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(
        side_effect=[
            {"count": 0, "results": []},
            {"id": "assignment-1"},
        ]
    )
    manager = VirtualMachineManager(mock_nb)

    result = await manager.assign_ip_to_virtual_interface(IP_ID, VIF_ID)

    assert result is True
    assert mock_nb.rest_request.await_args_list == [
        call(
            endpoint=f"ipam/ip-address-to-interface/?ip_address={IP_ID}&vm_interface={VIF_ID}",
            method="GET",
        ),
        call(
            endpoint="ipam/ip-address-to-interface/",
            method="POST",
            data={"ip_address": {"id": IP_ID}, "vm_interface": {"id": VIF_ID}},
        ),
    ]


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_assign_primary_ip_to_vm_patches_vm() -> None:
    """Primary IPv4 assignment PATCHes the virtual machine."""
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(return_value={"id": VM_ID})
    manager = VirtualMachineManager(mock_nb)

    result = await manager.assign_primary_ip_to_vm(VM_ID, IP_ID)

    assert result is True
    mock_nb.rest_request.assert_awaited_once_with(
        endpoint=f"virtualization/virtual-machines/{VM_ID}/",
        method="PATCH",
        data={"primary_ip4": {"id": IP_ID}},
    )


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_create_virtual_machine_builds_payload_with_optional_fields() -> None:
    """VM creation includes optional resource references when provided."""
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(return_value={"id": VM_ID, "name": "vm-01"})
    manager = VirtualMachineManager(mock_nb)

    result = await manager.create_virtual_machine(
        name="vm-01",
        cluster_id=CLUSTER_ID,
        status_id=STATUS_ID,
        role_id=ROLE_ID,
        vcpus=4,
        memory=8192,
        disk=100,
        tags=["tag-1"],
        custom_fields={"owner": "netops"},
    )

    assert result["id"] == VM_ID
    mock_nb.rest_request.assert_awaited_once_with(
        "virtualization/virtual-machines/",
        method="POST",
        data={
            "name": "vm-01",
            "cluster": {"id": CLUSTER_ID},
            "status": {"id": STATUS_ID},
            "role": {"id": ROLE_ID},
            "vcpus": 4,
            "memory": 8192,
            "disk": 100,
            "tags": [{"id": "tag-1"}],
            "custom_fields": {"owner": "netops"},
        },
    )


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_create_virtual_interface_builds_vlan_payload() -> None:
    """Virtual interface creation includes VLAN and tag references."""
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(return_value={"id": VIF_ID, "name": "eth0"})
    manager = VirtualMachineManager(mock_nb)

    result = await manager.create_virtual_interface(
        name="eth0",
        virtual_machine_id=VM_ID,
        status_id=STATUS_ID,
        mac_address="aa:bb:cc:dd:ee:ff",
        mtu=1500,
        mode="tagged",
        untagged_vlan_id="vlan-10",
        tagged_vlan_ids=["vlan-20"],
        tags=["tag-1"],
    )

    assert result["id"] == VIF_ID
    mock_nb.rest_request.assert_awaited_once_with(
        "virtualization/interfaces/",
        method="POST",
        data={
            "name": "eth0",
            "virtual_machine": {"id": VM_ID},
            "status": {"id": STATUS_ID},
            "enabled": True,
            "mac_address": "aa:bb:cc:dd:ee:ff",
            "mtu": 1500,
            "mode": "tagged",
            "untagged_vlan": {"id": "vlan-10"},
            "tagged_vlans": [{"id": "vlan-20"}],
            "tags": [{"id": "tag-1"}],
        },
    )


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_create_virtual_machine_wraps_nautobot_api_error() -> None:
    """Nautobot API errors are wrapped with VM context."""
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(side_effect=NautobotAPIError("duplicate"))
    manager = VirtualMachineManager(mock_nb)

    with pytest.raises(NautobotAPIError, match="Failed to create virtual machine"):
        await manager.create_virtual_machine("vm-01", CLUSTER_ID, STATUS_ID)
