"""
Nautobot Virtual Chassis endpoints.

Provides an endpoint for creating Virtual Chassis objects in Nautobot DCIM.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from dependencies import get_nautobot_service
from models.nautobot import CreateVirtualChassisRequest, VirtualChassisResponse
from services.nautobot.client import NautobotService
from services.nautobot.common.exceptions import NautobotAPIError

logger = logging.getLogger(__name__)

router = APIRouter(tags=["nautobot-devices"])


@router.post(
    "/virtual-chassis",
    response_model=VirtualChassisResponse,
    status_code=status.HTTP_201_CREATED,
    summary="🔶 REST: Create Virtual Chassis",
)
async def create_virtual_chassis(
    request: CreateVirtualChassisRequest,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
) -> dict:
    """
    Create a new Virtual Chassis in Nautobot DCIM.

    **🔶 This endpoint uses REST API** to create the Virtual Chassis via
    Nautobot's `POST /dcim/virtual-chassis/` endpoint.

    **Required Permission:** `nautobot.devices:write`

    **Request Body:**
    - `name`: Unique name for the Virtual Chassis (required)
    - `domain`: Optional domain label

    **Returns:**
    - `id`: UUID of the created Virtual Chassis
    - `name`: Name of the Virtual Chassis
    - `master`: Master device (null until a member device is assigned)
    - `domain`: Domain label

    **Raises:**
    - `400`: Invalid request (e.g. duplicate name)
    - `500`: Nautobot API error
    """
    payload: dict = {"name": request.name}
    if request.domain:
        payload["domain"] = request.domain

    try:
        result = await nautobot_service.rest_request(
            endpoint="dcim/virtual-chassis/",
            method="POST",
            data=payload,
        )
        return result
    except NautobotAPIError as exc:
        error_msg = str(exc)
        logger.error("Failed to create virtual chassis: %s", error_msg, exc_info=True)
        if "status 400" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_msg,
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create virtual chassis: {error_msg}",
        )
    except Exception as exc:
        logger.error("Failed to create virtual chassis: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create virtual chassis: {exc}",
        )
