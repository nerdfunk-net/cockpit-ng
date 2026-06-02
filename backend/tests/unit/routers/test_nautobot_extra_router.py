"""Unit tests for Nautobot extra router endpoints."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

import pytest

from models.nautobot import (
    ContactAssociationBulkUpdateItem,
    ContactAssociationBulkUpdateRequest,
    ContactAssociationCreate,
)
from routers.nautobot.extra import (
    bulk_update_contact_associations,
    create_contact_association,
    delete_contact_association,
)

CONTACT_ID = UUID("11a31b51-a9fb-4ef2-a4ab-e9ddde219797")
DEVICE_ID = UUID("45aff2ec-20fe-4338-bc0e-20793a47f02c")
ASSOCIATION_ID = UUID("876fdff9-a7c5-403b-8923-7e67a4a19ecb")


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_create_contact_association_posts_to_nautobot() -> None:
    """Create endpoint proxies POST with mapped payload and default role/status."""
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(
        return_value={"id": str(ASSOCIATION_ID), "contact": {"id": str(CONTACT_ID)}}
    )
    mock_audit = MagicMock()

    body = ContactAssociationCreate(
        contact_id=CONTACT_ID,
        associated_object_type="dcim.device",
        associated_object_id=DEVICE_ID,
    )
    result = await create_contact_association(
        body=body,
        current_user={"sub": "tester", "user_id": 1},
        nautobot_service=mock_nb,
        audit_log=mock_audit,
    )

    assert result["id"] == str(ASSOCIATION_ID)
    mock_nb.rest_request.assert_awaited_once_with(
        "extras/contact-associations/",
        method="POST",
        data={
            "contact": str(CONTACT_ID),
            "associated_object_type": "dcim.device",
            "associated_object_id": str(DEVICE_ID),
            "role": {"name": "Administrative"},
            "status": {"name": "Active"},
        },
    )
    mock_audit.log_event.assert_called_once()


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_create_contact_association_custom_role_status() -> None:
    """Create endpoint forwards explicit role and status references."""
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(return_value={"id": str(ASSOCIATION_ID)})
    mock_audit = MagicMock()

    body = ContactAssociationCreate(
        contact_id=CONTACT_ID,
        associated_object_type="virtualization.virtualmachine",
        associated_object_id=DEVICE_ID,
        role="866298d0-d942-440b-9c89-8b3e9eb81f79",
        status={"name": "Active"},
    )
    await create_contact_association(
        body=body,
        current_user={"sub": "tester"},
        nautobot_service=mock_nb,
        audit_log=mock_audit,
    )

    mock_nb.rest_request.assert_awaited_once_with(
        "extras/contact-associations/",
        method="POST",
        data={
            "contact": str(CONTACT_ID),
            "associated_object_type": "virtualization.virtualmachine",
            "associated_object_id": str(DEVICE_ID),
            "role": "866298d0-d942-440b-9c89-8b3e9eb81f79",
            "status": {"name": "Active"},
        },
    )


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_bulk_update_contact_associations_patches_list() -> None:
    """Bulk update endpoint proxies PATCH with array body and mapped fields."""
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(return_value=[{"id": str(ASSOCIATION_ID)}])

    body = ContactAssociationBulkUpdateRequest(
        items=[
            ContactAssociationBulkUpdateItem(
                id=ASSOCIATION_ID,
                contact_id=CONTACT_ID,
                status={"name": "Active"},
            )
        ]
    )
    result = await bulk_update_contact_associations(
        body=body,
        current_user={"sub": "tester"},
        nautobot_service=mock_nb,
    )

    assert result == [{"id": str(ASSOCIATION_ID)}]
    mock_nb.rest_request.assert_awaited_once_with(
        "extras/contact-associations/",
        method="PATCH",
        data=[
            {
                "id": str(ASSOCIATION_ID),
                "contact": str(CONTACT_ID),
                "status": {"name": "Active"},
            }
        ],
    )


@pytest.mark.asyncio
@pytest.mark.unit
@pytest.mark.nautobot
async def test_delete_contact_association_deletes_in_nautobot() -> None:
    """Delete endpoint proxies DELETE to Nautobot extras contact-associations."""
    mock_nb = MagicMock()
    mock_nb.rest_request = AsyncMock(return_value={"status": "success"})

    result = await delete_contact_association(
        association_id=str(ASSOCIATION_ID),
        current_user={"sub": "tester"},
        nautobot_service=mock_nb,
    )

    mock_nb.rest_request.assert_awaited_once_with(
        f"extras/contact-associations/{ASSOCIATION_ID}/",
        method="DELETE",
    )
    assert result == {"status": "deleted"}
