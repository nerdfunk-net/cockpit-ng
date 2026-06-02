"""Unit tests for baseline status resolution by content type."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from services.network.tools.baseline import (
    STATUS_CONTENT_TYPE_VM,
    STATUS_CONTENT_TYPE_VM_INTERFACE,
)
from services.network.tools.baseline import (
    TestBaselineService as BaselineImportService,
)

VM_STATUS_ID = "11111111-1111-1111-1111-111111111111"
IFACE_STATUS_ID = "22222222-2222-2222-2222-222222222222"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_get_status_uuid_scoped_by_content_type() -> None:
    """Same status name resolves to different UUIDs per content type."""
    service = BaselineImportService.__new__(BaselineImportService)
    service.status_cache = {}
    service.nautobot = MagicMock()

    async def mock_rest(endpoint: str, method: str = "GET", data=None):
        if "virtualization.virtualmachine" in endpoint:
            return {
                "results": [{"id": VM_STATUS_ID, "name": "Offline"}],
            }
        if "virtualization.vminterface" in endpoint:
            return {
                "results": [{"id": IFACE_STATUS_ID, "name": "Offline"}],
            }
        return {"results": []}

    service.nautobot.rest_request = AsyncMock(side_effect=mock_rest)

    vm_uuid = await service.get_status_uuid("Offline", STATUS_CONTENT_TYPE_VM)
    iface_uuid = await service.get_status_uuid(
        "Offline", STATUS_CONTENT_TYPE_VM_INTERFACE
    )

    assert vm_uuid == VM_STATUS_ID
    assert iface_uuid == IFACE_STATUS_ID
    assert vm_uuid != iface_uuid
