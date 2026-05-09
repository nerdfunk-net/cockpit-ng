"""
Nautobot Virtual Chassis endpoints.

Provides an endpoint for creating Virtual Chassis objects in Nautobot DCIM.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Response, status

from core.auth import require_permission
from dependencies import get_nautobot_service
from models.nautobot import (
    CreateVirtualChassisRequest,
    UpdateVirtualChassisRequest,
    VirtualChassisDetailResponse,
    VirtualChassisListItem,
    VirtualChassisResponse,
)
from services.nautobot.client import NautobotService
from services.nautobot.common.exceptions import NautobotAPIError

logger = logging.getLogger(__name__)

router = APIRouter(tags=["nautobot-devices"])


@router.get(
    "/virtual-chassis",
    response_model=list[VirtualChassisListItem],
    summary="🔷 GraphQL: List all Virtual Chassis",
)
async def list_virtual_chassis(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
) -> list[dict]:
    """
    List all Virtual Chassis configured in Nautobot.

    **🔷 This endpoint uses GraphQL** to query all virtual chassis objects.

    **Required Permission:** `nautobot.devices:read`

    **Returns:**
    - List of `{ id, name }` objects for each configured Virtual Chassis
    """
    query = "{ virtual_chassis { id name } }"
    try:
        result = await nautobot_service.graphql_query(query)
        return result["data"]["virtual_chassis"]
    except NautobotAPIError as exc:
        logger.error("Failed to list virtual chassis: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list virtual chassis: {exc}",
        )
    except Exception as exc:
        logger.error("Failed to list virtual chassis: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list virtual chassis: {exc}",
        )


VIRTUAL_CHASSIS_DETAIL_QUERY = """
{{
  virtual_chassis(id: "{vc_id}") {{
    id
    name
    members {{ id name }}
    master {{
      id
      name
      location {{ id name }}
      role {{ id name }}
      status {{ id name }}
      platform {{ id name }}
      device_type {{ id model }}
      software_version {{ id version }}
    }}
  }}
}}
"""


@router.get(
    "/virtual-chassis/{vc_id}",
    response_model=VirtualChassisDetailResponse,
    summary="🔷 GraphQL: Get Virtual Chassis Detail",
)
async def get_virtual_chassis_detail(
    vc_id: str,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
) -> dict:
    """
    Get detailed information for a single Virtual Chassis, including master device attributes.

    **🔷 This endpoint uses GraphQL** to query the virtual chassis and its master device.

    **Required Permission:** `nautobot.devices:read`

    **Returns:**
    - `id`, `name`: Virtual chassis identity
    - `members`: List of member devices `{ id, name }`
    - `master`: Master device with `location`, `role`, `status`, `platform`, `device_type`, `software_version`

    **Raises:**
    - `404`: Virtual chassis not found
    - `500`: Nautobot API error
    """
    query = VIRTUAL_CHASSIS_DETAIL_QUERY.format(vc_id=vc_id)
    try:
        result = await nautobot_service.graphql_query(query)
        items = result["data"]["virtual_chassis"]
        if not items:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Virtual chassis {vc_id} not found",
            )
        return items[0]
    except HTTPException:
        raise
    except NautobotAPIError as exc:
        logger.error(
            "Failed to get virtual chassis detail %s: %s", vc_id, exc, exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get virtual chassis detail: {exc}",
        )
    except Exception as exc:
        logger.error(
            "Failed to get virtual chassis detail %s: %s", vc_id, exc, exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get virtual chassis detail: {exc}",
        )


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


@router.delete(
    "/virtual-chassis/{vc_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="🔶 REST: Delete Virtual Chassis",
)
async def delete_virtual_chassis(
    vc_id: str,
    current_user: dict = Depends(require_permission("nautobot.devices", "delete")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
) -> Response:
    """
    Delete a virtual chassis from Nautobot DCIM.

    **🔶 This endpoint uses REST API** via Nautobot's `DELETE /dcim/virtual-chassis/{id}/`.

    **Required Permission:** `nautobot.devices:delete`

    This removes the virtual chassis object but does NOT delete member devices.
    Remove the chassis before deleting member devices during offboarding.

    **Raises:**
    - `404`: Virtual chassis not found
    - `500`: Nautobot API error
    """
    try:
        await nautobot_service.rest_request(
            f"dcim/virtual-chassis/{vc_id}/",
            method="DELETE",
        )
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except NautobotAPIError as exc:
        error_msg = str(exc)
        logger.error(
            "Failed to delete virtual chassis %s: %s", vc_id, error_msg, exc_info=True
        )
        if "404" in error_msg or "Not Found" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Virtual chassis {vc_id} not found",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete virtual chassis: {error_msg}",
        )
    except Exception as exc:
        logger.error(
            "Failed to delete virtual chassis %s: %s", vc_id, exc, exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete virtual chassis: {exc}",
        )


@router.patch(
    "/virtual-chassis/{vc_id}",
    response_model=VirtualChassisResponse,
    summary="🔶 REST: Update Virtual Chassis Master",
)
async def update_virtual_chassis(
    vc_id: str,
    request: UpdateVirtualChassisRequest,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
) -> dict:
    """
    Update the master device of a virtual chassis.

    **🔶 This endpoint uses REST API** via Nautobot's `PATCH /dcim/virtual-chassis/{id}/`.

    **Required Permission:** `nautobot.devices:write`

    **Request Body:**
    - `new_master_id`: UUID of the device to become the new master

    **Raises:**
    - `400`: Invalid request
    - `404`: Virtual chassis not found
    - `500`: Nautobot API error
    """
    try:
        result = await nautobot_service.rest_request(
            f"dcim/virtual-chassis/{vc_id}/",
            method="PATCH",
            data={"master": {"id": request.new_master_id}},
        )
        return result
    except NautobotAPIError as exc:
        error_msg = str(exc)
        logger.error(
            "Failed to update virtual chassis %s: %s", vc_id, error_msg, exc_info=True
        )
        if "404" in error_msg or "Not Found" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Virtual chassis {vc_id} not found",
            )
        if "400" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_msg,
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update virtual chassis: {error_msg}",
        )
    except Exception as exc:
        logger.error(
            "Failed to update virtual chassis %s: %s", vc_id, exc, exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update virtual chassis: {exc}",
        )
