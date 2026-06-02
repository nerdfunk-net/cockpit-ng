"""Unit tests for ClusterManager."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from services.nautobot.managers.cluster_manager import ClusterManager, slug_from_name

CLUSTER_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
CLUSTER_TYPE_ID = "e5f6a7b8-c9d0-1234-ef01-345678901234"
GROUP_ID = "b2c3d4e5-f6a7-8901-bcde-f12345678901"
LOCATION_ID = "c3d4e5f6-a7b8-9012-cdef-123456789012"
TAG_ID = "d4e5f6a7-b8c9-0123-def0-234567890123"


def test_slug_from_name() -> None:
    """Slug helper normalizes display names for Nautobot."""
    assert slug_from_name("VMware vSphere") == "vmware-vsphere"
    assert slug_from_name("  My Type!  ") == "my-type"


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_create_cluster_type_minimal_payload() -> None:
    """Create cluster type sends name and derived slug to Nautobot POST."""
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(
        return_value={
            "id": CLUSTER_TYPE_ID,
            "name": "VMware vSphere",
            "slug": "vmware-vsphere",
        }
    )
    manager = ClusterManager(mock_nb)

    result = await manager.create_cluster_type(name="VMware vSphere")

    assert result["id"] == CLUSTER_TYPE_ID
    mock_nb.rest_request.assert_awaited_once_with(
        "virtualization/cluster-types/",
        method="POST",
        data={"name": "VMware vSphere", "slug": "vmware-vsphere"},
    )


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_create_cluster_type_explicit_slug() -> None:
    """Create cluster type uses explicit slug when provided."""
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(return_value={"id": CLUSTER_TYPE_ID, "name": "KVM"})
    manager = ClusterManager(mock_nb)

    await manager.create_cluster_type(
        name="KVM",
        slug="kvm-hypervisor",
        description="Linux KVM",
        tags=[TAG_ID],
    )

    mock_nb.rest_request.assert_awaited_once_with(
        "virtualization/cluster-types/",
        method="POST",
        data={
            "name": "KVM",
            "slug": "kvm-hypervisor",
            "description": "Linux KVM",
            "tags": [{"id": TAG_ID}],
        },
    )


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_create_cluster_minimal_payload() -> None:
    """Create cluster sends name-only payload to Nautobot POST."""
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(return_value={"id": CLUSTER_ID, "name": "lab-cluster"})
    manager = ClusterManager(mock_nb)

    result = await manager.create_cluster(name="lab-cluster")

    assert result["id"] == CLUSTER_ID
    mock_nb.rest_request.assert_awaited_once_with(
        "virtualization/clusters/",
        method="POST",
        data={"name": "lab-cluster"},
    )


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_create_cluster_full_payload() -> None:
    """Create cluster maps optional fields to Nautobot nested id references."""
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(return_value={"id": CLUSTER_ID, "name": "full-cluster"})
    manager = ClusterManager(mock_nb)

    await manager.create_cluster(
        name="full-cluster",
        description="Test cluster",
        cluster_type_id=CLUSTER_TYPE_ID,
        cluster_group_id=GROUP_ID,
        location_id=LOCATION_ID,
        tags=[TAG_ID],
    )

    mock_nb.rest_request.assert_awaited_once_with(
        "virtualization/clusters/",
        method="POST",
        data={
            "name": "full-cluster",
            "description": "Test cluster",
            "cluster_type": {"id": CLUSTER_TYPE_ID},
            "cluster_group": {"id": GROUP_ID},
            "location": {"id": LOCATION_ID},
            "tags": [{"id": TAG_ID}],
        },
    )
