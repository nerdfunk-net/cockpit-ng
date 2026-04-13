"""
Nautobot rack reservation endpoints.

GET    /api/nautobot/rack-reservation  — query existing reservations via GraphQL
POST   /api/nautobot/rack-reservation  — create one or more reservations via REST
DELETE /api/nautobot/rack-reservation  — delete reservations by ID (query params)
"""

from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from core.auth import require_permission
from dependencies import get_nautobot_service
from services.nautobot.client import NautobotService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["nautobot-rack-reservations"])


class RackReservationCreate(BaseModel):
    rack_id: str
    units: List[int]
    description: str
    location_id: str


@router.delete(
    "/rack-reservation",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="🔶 REST: Delete Rack Reservation(s)",
)
async def delete_rack_reservations(
    ids: List[str] = Query(..., description="Nautobot reservation UUID(s) to delete"),
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """Delete one or more rack reservations in Nautobot.

    Pass one or more `ids` query parameters (repeatable).
    Bulk-deletes them via DELETE /dcim/rack-reservations/.

    **🔶 This endpoint uses the Nautobot REST API.**
    """
    try:
        payload = [{"id": reservation_id} for reservation_id in ids]
        await nautobot_service.rest_request(
            "dcim/rack-reservations/",
            method="DELETE",
            data=payload,
        )
    except Exception as e:
        logger.error("Failed to delete rack reservation(s): %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete rack reservation(s): {str(e)}",
        )


@router.get("/rack-reservation", summary="🔷 GraphQL: Get Rack Reservations")
async def get_rack_reservations(
    rack: str = Query(..., description="Rack name or slug"),
    location: str = Query(..., description="Location name"),
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """Query rack reservations for a given rack and location.

    **🔷 This endpoint uses GraphQL.**
    """
    try:
        query = """
        {
          rack_reservations(rack: "%s", location: "%s") {
            id
            description
            units
          }
        }
        """ % (
            rack,
            location,
        )
        result = await nautobot_service.graphql_query(query)
        if "errors" in result:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Nautobot GraphQL error: {result['errors']}",
            )
        return result.get("data", {}).get("rack_reservations", [])
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to fetch rack reservations: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch rack reservations: {str(e)}",
        )


@router.post(
    "/rack-reservation",
    status_code=status.HTTP_201_CREATED,
    summary="🔶 REST: Create Rack Reservation",
)
async def create_rack_reservation(
    body: RackReservationCreate,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """Create a rack reservation in Nautobot.

    The units list is a 1-based list of rack unit numbers to reserve.
    The description is used as the reservation label (typically the unknown device name).

    **🔶 This endpoint uses the Nautobot REST API** (POST /dcim/rack-reservations/).
    """
    try:
        payload = {
            "rack": body.rack_id,
            "units": body.units,
            "description": body.description,
            "location": body.location_id,
        }

        result = await nautobot_service.rest_request(
            "dcim/rack-reservations/",
            method="POST",
            data=payload,
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to create rack reservation: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create rack reservation: {str(e)}",
        )
