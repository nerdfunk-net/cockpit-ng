"""Unit tests for device interface sync (orphan deletion)."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from services.nautobot.devices.interface_workflow import InterfaceManagerService

DEVICE_ID = "ac000000-0000-0000-0003-000000000001"
IFACE_KEEP_ID = "ac000000-0000-0000-0002-000000000001"
IFACE_ORPHAN_ID = "ac000000-0000-0000-0002-000000000002"


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_delete_orphan_device_interfaces() -> None:
    """Orphan interfaces are deleted when not in desired_names."""
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(
        side_effect=[
            {
                "results": [
                    {"id": IFACE_KEEP_ID, "name": "Ethernet1"},
                    {"id": IFACE_ORPHAN_ID, "name": "Ethernet2"},
                ]
            },
            None,
            None,
        ]
    )
    service = InterfaceManagerService(mock_nb)
    service._clean_interface_ips = AsyncMock()

    deleted = await service._delete_orphan_device_interfaces(
        device_id=DEVICE_ID,
        desired_names={"Ethernet1"},
        warnings=[],
    )

    assert deleted == 1
    delete_call = mock_nb.rest_request.await_args_list[-1]
    assert delete_call.kwargs["method"] == "DELETE"
    assert IFACE_ORPHAN_ID in delete_call.kwargs["endpoint"]
