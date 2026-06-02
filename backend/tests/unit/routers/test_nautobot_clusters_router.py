"""Unit tests for Nautobot virtualization cluster router create endpoint."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from models.nautobot import CreateClusterRequest, CreateClusterTypeRequest
from routers.nautobot.clusters import create_cluster, create_cluster_type

CLUSTER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
CLUSTER_TYPE_ID = "e5f6a7b8-c9d0-1234-ef01-345678901234"
GROUP_ID = "b2c3d4e5-f6a7-8901-bcde-f12345678901"
LOCATION_ID = "c3d4e5f6-a7b8-9012-cdef-123456789012"


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_create_cluster_delegates_to_manager() -> None:
    """Create endpoint delegates to ClusterManager and logs audit event."""
    mock_nb = MagicMock()
    mock_audit = MagicMock()
    request = CreateClusterRequest(
        name="api-cluster",
        description="From API",
        cluster_type=CLUSTER_TYPE_ID,
        cluster_group=GROUP_ID,
        location=LOCATION_ID,
    )
    cluster_result = {"id": CLUSTER_ID, "name": "api-cluster"}

    with patch(
        "routers.nautobot.clusters.ClusterManager",
    ) as mock_manager_cls:
        mock_manager = MagicMock()
        mock_manager.create_cluster = AsyncMock(return_value=cluster_result)
        mock_manager_cls.return_value = mock_manager

        result = await create_cluster(
            request=request,
            current_user={"sub": "tester", "user_id": 1},
            nautobot_service=mock_nb,
            audit_log=mock_audit,
        )

    assert result == cluster_result
    mock_manager.create_cluster.assert_awaited_once_with(
        name="api-cluster",
        description="From API",
        cluster_type_id=CLUSTER_TYPE_ID,
        cluster_group_id=GROUP_ID,
        location_id=LOCATION_ID,
        tags=None,
    )
    mock_audit.log_event.assert_called_once()
    assert mock_audit.log_event.call_args.kwargs["event_type"] == "nautobot-cluster-created"


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_create_cluster_type_delegates_to_manager() -> None:
    """Create cluster type endpoint delegates to ClusterManager and logs audit."""
    mock_nb = MagicMock()
    mock_audit = MagicMock()
    request = CreateClusterTypeRequest(
        name="VMware vSphere",
        slug="vmware-vsphere",
        description="vSphere cluster type",
    )
    cluster_type_result = {
        "id": CLUSTER_TYPE_ID,
        "name": "VMware vSphere",
        "slug": "vmware-vsphere",
    }

    with patch(
        "routers.nautobot.clusters.ClusterManager",
    ) as mock_manager_cls:
        mock_manager = MagicMock()
        mock_manager.create_cluster_type = AsyncMock(return_value=cluster_type_result)
        mock_manager_cls.return_value = mock_manager

        result = await create_cluster_type(
            request=request,
            current_user={"sub": "tester", "user_id": 1},
            nautobot_service=mock_nb,
            audit_log=mock_audit,
        )

    assert result == cluster_type_result
    mock_manager.create_cluster_type.assert_awaited_once_with(
        name="VMware vSphere",
        slug="vmware-vsphere",
        description="vSphere cluster type",
        tags=None,
    )
    mock_audit.log_event.assert_called_once()
    assert (
        mock_audit.log_event.call_args.kwargs["event_type"]
        == "nautobot-cluster-type-created"
    )
