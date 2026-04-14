"""
Rack device name mapping endpoints.

GET    /rack-mappings?rack_name=X&location_id=Y  — list saved mappings for a rack
POST   /rack-mappings                             — upsert one or more mappings
DELETE /rack-mappings?rack_name=X&location_id=Y  — delete all mappings for a rack
"""

from __future__ import annotations

import logging
from typing import List

from fastapi import APIRouter, Depends, Query, Response, status
from pydantic import BaseModel
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from core.auth import require_permission
from core.database import get_db
from core.models import RackDeviceMapping

logger = logging.getLogger(__name__)

router = APIRouter(tags=["nautobot-rack-mappings"])


class MappingEntry(BaseModel):
    origin_name: str
    mapped_name: str


class RackMappingItem(BaseModel):
    origin_name: str
    mapped_name: str


class RackMappingsCreate(BaseModel):
    rack_name: str
    location_id: str
    mappings: List[MappingEntry]


@router.get(
    "/rack-mappings",
    response_model=List[RackMappingItem],
    summary="List saved device name mappings for a rack",
)
async def get_rack_mappings(
    rack_name: str = Query(..., description="Rack name"),
    location_id: str = Query(..., description="Nautobot location UUID"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
) -> List[RackMappingItem]:
    """Return all saved CSV-to-Nautobot device name mappings for the given rack and location."""
    rows = (
        db.query(RackDeviceMapping)
        .filter(
            RackDeviceMapping.rack_name == rack_name,
            RackDeviceMapping.location_id == location_id,
        )
        .order_by(RackDeviceMapping.origin_name)
        .all()
    )
    return [RackMappingItem(origin_name=r.origin_name, mapped_name=r.mapped_name) for r in rows]


@router.post(
    "/rack-mappings",
    summary="Upsert device name mappings for a rack",
)
async def upsert_rack_mappings(
    body: RackMappingsCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
) -> Response:
    """Insert or update CSV-to-Nautobot device name mappings.

    If a mapping for the same (rack_name, location_id, origin_name) already exists,
    its mapped_name is updated to the new value.
    """
    if not body.mappings:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    for entry in body.mappings:
        stmt = (
            pg_insert(RackDeviceMapping)
            .values(
                rack_name=body.rack_name,
                location_id=body.location_id,
                origin_name=entry.origin_name,
                mapped_name=entry.mapped_name,
            )
            .on_conflict_do_update(
                constraint="uq_rack_device_mapping",
                set_={"mapped_name": entry.mapped_name},
            )
        )
        db.execute(stmt)

    db.commit()
    logger.info(
        "Upserted %d rack device mapping(s) for rack=%s location=%s",
        len(body.mappings),
        body.rack_name,
        body.location_id,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete(
    "/rack-mappings",
    summary="Delete all device name mappings for a rack",
)
async def delete_rack_mappings(
    rack_name: str = Query(..., description="Rack name"),
    location_id: str = Query(..., description="Nautobot location UUID"),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
) -> Response:
    """Delete all saved mappings for the given rack and location."""
    deleted = (
        db.query(RackDeviceMapping)
        .filter(
            RackDeviceMapping.rack_name == rack_name,
            RackDeviceMapping.location_id == location_id,
        )
        .delete(synchronize_session=False)
    )
    db.commit()
    logger.info(
        "Deleted %d rack device mapping(s) for rack=%s location=%s",
        deleted,
        rack_name,
        location_id,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
