"""
Nautobot extra metadata endpoints.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends

from core.auth import require_permission
from core.safe_http_errors import raise_internal_server_error
from dependencies import get_nautobot_service
from services.nautobot.client import NautobotService

logger = logging.getLogger(__name__)
router = APIRouter(tags=["nautobot-extra"])


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
