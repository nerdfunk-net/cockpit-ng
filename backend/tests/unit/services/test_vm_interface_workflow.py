"""Unit tests for VirtualMachineInterfaceWorkflow."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from services.nautobot.virtualization.vm_interface_workflow import (
    VirtualMachineInterfaceWorkflow,
)

VM_ID = "ac000000-0000-0000-0004-000000000001"
VIF_ID = "ac000000-0000-0000-0002-000000000001"
VIF_ORPHAN_ID = "ac000000-0000-0000-0002-000000000002"
STATUS_ID = "ac000000-0000-0000-0006-000000000001"


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_sync_deletes_orphan_interfaces() -> None:
    """sync_interfaces removes VM interfaces not in the desired list."""
    mock_nb = MagicMock()
    workflow = VirtualMachineInterfaceWorkflow(mock_nb)
    workflow.vm_manager.list_virtual_interfaces = AsyncMock(
        return_value=[
            {"id": VIF_ID, "name": "eth0"},
            {"id": VIF_ORPHAN_ID, "name": "eth1"},
        ]
    )
    workflow.vm_manager.delete_virtual_interface = AsyncMock()
    workflow.vm_manager.update_virtual_interface = AsyncMock()
    workflow.vm_manager.create_virtual_interface = AsyncMock()
    workflow.vm_manager.clean_virtual_interface_ips = AsyncMock()
    workflow.vm_manager.assign_ip_to_virtual_interface = AsyncMock()
    workflow.vm_manager.assign_primary_ip_to_vm = AsyncMock()
    workflow._ensure_ip_addresses = AsyncMock(return_value={})

    result = await workflow.sync_vm_interfaces(
        VM_ID,
        [{"name": "eth0", "status": STATUS_ID, "ip_addresses": []}],
        sync_interfaces=True,
    )

    workflow.vm_manager.delete_virtual_interface.assert_awaited_once_with(VIF_ORPHAN_ID)
    assert result.interfaces_deleted == 1


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_sync_updates_existing_interface() -> None:
    """Existing interface by name is PATCHed, not recreated."""
    mock_nb = MagicMock()
    workflow = VirtualMachineInterfaceWorkflow(mock_nb)
    workflow.vm_manager.list_virtual_interfaces = AsyncMock(
        return_value=[{"id": VIF_ID, "name": "eth0"}]
    )
    workflow.vm_manager.delete_virtual_interface = AsyncMock()
    workflow.vm_manager.update_virtual_interface = AsyncMock(return_value={"id": VIF_ID})
    workflow.vm_manager.create_virtual_interface = AsyncMock()
    workflow.vm_manager.clean_virtual_interface_ips = AsyncMock()
    workflow.vm_manager.assign_ip_to_virtual_interface = AsyncMock()
    workflow.vm_manager.assign_primary_ip_to_vm = AsyncMock()
    workflow._ensure_ip_addresses = AsyncMock(return_value={})

    result = await workflow.sync_vm_interfaces(
        VM_ID,
        [{"name": "eth0", "status": STATUS_ID, "enabled": True, "ip_addresses": []}],
        sync_interfaces=False,
    )

    workflow.vm_manager.update_virtual_interface.assert_awaited_once()
    workflow.vm_manager.create_virtual_interface.assert_not_awaited()
    assert result.interfaces_updated == 1
