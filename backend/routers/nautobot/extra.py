"""
Nautobot extra metadata endpoints.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from core.safe_http_errors import raise_internal_server_error
from dependencies import get_audit_log_service, get_nautobot_service
from models.nautobot import (
    ContactAssociationBulkUpdateRequest,
    ContactAssociationCreate,
)
from routers.nautobot.rest_errors import extract_nautobot_error_detail
from services.audit.audit_log_service import AuditLogService
from services.nautobot.client import NautobotService
from services.nautobot.common.exceptions import NautobotAPIError

logger = logging.getLogger(__name__)
router = APIRouter(tags=["nautobot-extra"])

CONTACT_ASSOCIATIONS_ENDPOINT = "extras/contact-associations/"


@router.get("/contacts", summary="🔶 REST: List Contacts")
async def get_nautobot_contacts(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """Get Nautobot contacts."""
    try:
        result = await nautobot_service.rest_request("extras/contacts/?limit=0")
        return result.get("results", [])
    except Exception as e:
        raise_internal_server_error(logger, "Failed to fetch contacts: ", e)


@router.get("/contacts/{contact_id}", summary="🔶 REST: Get Contact Details")
async def get_nautobot_contact_details(
    contact_id: str,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """Get a specific Nautobot contact by id."""
    try:
        return await nautobot_service.rest_request(f"extras/contacts/{contact_id}/")
    except Exception as e:
        raise_internal_server_error(logger, "Failed to fetch contact details: ", e)


@router.post(
    "/contact-associations/",
    status_code=status.HTTP_201_CREATED,
    summary="🔶 REST: Associate Contact with Device or VM",
)
async def create_contact_association(
    body: ContactAssociationCreate,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
    audit_log: AuditLogService = Depends(get_audit_log_service),
):
    """Associate an existing contact with a device or virtual machine in Nautobot.

    Proxies to POST /api/extras/contact-associations/. Role defaults to
    ``Administrative`` and status to ``Active`` when omitted.

    **🔶 This endpoint uses the Nautobot REST API.**
    """
    payload = body.to_nautobot_payload()
    try:
        result = await nautobot_service.rest_request(
            CONTACT_ASSOCIATIONS_ENDPOINT,
            method="POST",
            data=payload,
        )
    except NautobotAPIError as e:
        error_msg = str(e)
        if "status 400" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=extract_nautobot_error_detail(error_msg),
            ) from e
        raise_internal_server_error(
            logger,
            "Failed to create contact association (Nautobot API error)",
            e,
            extra={"nautobot_error": (error_msg[:4000] if error_msg else "")},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(logger, "Failed to create contact association: ", e)
    else:
        username = (
            current_user.get("sub")
            or current_user.get("username")
            or str(current_user.get("user_id") or "unknown")
        )
        audit_log.log_event(
            username=username,
            user_id=current_user.get("user_id"),
            event_type="nautobot-contact-associated",
            message=(
                f"Contact '{body.contact_id}' associated with "
                f"{body.associated_object_type} '{body.associated_object_id}'"
            ),
            resource_type="contact_association",
            resource_id=result.get("id"),
            resource_name=str(body.contact_id),
            severity="info",
            extra_data={
                "associated_object_type": body.associated_object_type,
                "associated_object_id": str(body.associated_object_id),
            },
        )
        return result


@router.patch(
    "/contact-associations/",
    summary="🔶 REST: Bulk Update Contact Associations",
)
async def bulk_update_contact_associations(
    body: ContactAssociationBulkUpdateRequest,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """Bulk partial update of existing contact associations in Nautobot.

    Each item must include the association ``id``. Proxies to PATCH
    /api/extras/contact-associations/ with a JSON array body.

    **🔶 This endpoint uses the Nautobot REST API.**
    """
    payload: list[dict[str, Any]] = [
        item.to_nautobot_payload() for item in body.items
    ]
    try:
        return await nautobot_service.rest_request(
            CONTACT_ASSOCIATIONS_ENDPOINT,
            method="PATCH",
            data=payload,
        )
    except NautobotAPIError as e:
        error_msg = str(e)
        if "status 400" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=extract_nautobot_error_detail(error_msg),
            ) from e
        raise_internal_server_error(
            logger,
            "Failed to update contact associations (Nautobot API error)",
            e,
            extra={"nautobot_error": (error_msg[:4000] if error_msg else "")},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(
            logger, "Failed to update contact associations: ", e
        )


@router.delete(
    "/contact-associations/{association_id}",
    status_code=status.HTTP_200_OK,
    summary="🔶 REST: Delete Contact Association",
)
async def delete_contact_association(
    association_id: str,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
) -> dict:
    """Delete a Nautobot contact association by id.

    Proxies to DELETE /api/extras/contact-associations/{id}/.

    **🔶 This endpoint uses the Nautobot REST API.**
    """
    try:
        await nautobot_service.rest_request(
            f"{CONTACT_ASSOCIATIONS_ENDPOINT}{association_id}/",
            method="DELETE",
        )
    except NautobotAPIError as e:
        error_msg = str(e)
        if "status 400" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=extract_nautobot_error_detail(error_msg),
            ) from e
        raise_internal_server_error(
            logger,
            "Failed to delete contact association (Nautobot API error)",
            e,
            extra={"nautobot_error": (error_msg[:4000] if error_msg else "")},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise_internal_server_error(
            logger, "Failed to delete contact association: ", e
        )
    return {"status": "deleted"}
