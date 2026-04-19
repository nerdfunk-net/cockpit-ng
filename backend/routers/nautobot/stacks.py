"""
Nautobot Stacks endpoints.

Provides endpoints for detecting devices with multiple serial numbers,
splitting them into separate devices, and building Virtual Chassis groups.
"""

from __future__ import annotations

import logging
import re
from collections import defaultdict
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from core.auth import require_permission
from dependencies import get_nautobot_service
from models.nautobot import AddDeviceRequest
from services.nautobot.client import NautobotService
from services.nautobot.common.exceptions import NautobotAPIError
from services.nautobot.devices.creation import DeviceCreationService
from services.nautobot.devices.update import DeviceUpdateService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["nautobot-stacks"])


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class StackDeviceInfo(BaseModel):
    """Device information as returned by the GraphQL query."""

    id: str
    name: str
    serial: str
    location: Optional[Dict[str, Any]] = None
    device_type: Optional[Dict[str, Any]] = None


class ProcessStacksRequest(BaseModel):
    """Request to split and build virtual chassis for selected stack devices."""

    device_ids: List[str] = Field(
        ...,
        min_items=1,
        description="List of device UUIDs to process (split + build VC)",
    )
    separator: str = Field(
        default=",",
        description="Delimiter used to split multiple serial numbers",
    )


class DeviceResult(BaseModel):
    """Result for a single device processed in the stacks workflow."""

    device_id: str
    device_name: str
    success: bool
    message: str
    created_devices: List[str] = Field(default_factory=list)
    virtual_chassis_id: Optional[str] = None
    virtual_chassis_name: Optional[str] = None


class ProcessStacksResponse(BaseModel):
    """Response after processing stack devices."""

    results: List[DeviceResult]
    total: int
    succeeded: int
    failed: int


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_STACK_DEVICES_QUERY = """
{
  devices {
    id
    name
    serial
    location {
      id
      name
    }
    device_type {
      id
      model
      manufacturer {
        id
        name
      }
    }
  }
}
"""

_FULL_DEVICE_QUERY = """
{
  devices {
    id
    name
    role { id name }
    status { id name }
    location { id name }
    device_type { id model manufacturer { id name } }
    _custom_field_data
    tags { id name }
    rack { id name }
    face
    serial
  }
}
"""


def _parse_serials(serial_field: str | None, separator: str = ",") -> list[str]:
    """Return a list of stripped serial numbers from a raw field value."""
    if not serial_field:
        return []
    return [s.strip() for s in serial_field.split(separator) if s.strip()]


def _group_key(device_name: str) -> str:
    """Return the canonical group key for a device name.

    Strips any ':N' suffix from the hostname part (before the first '.').
    """
    hostname, dot, domain = device_name.partition(".")
    base_hostname = hostname.split(":")[0]
    return f"{base_hostname}{dot}{domain}" if dot else base_hostname


def _is_master(device_name: str) -> bool:
    """Return True if this device has no ':N' suffix (primary member)."""
    hostname = device_name.partition(".")[0]
    return ":" not in hostname


def _member_position(device_name: str) -> int:
    """Return the numeric position encoded in the device name."""
    hostname = device_name.partition(".")[0]
    if ":" in hostname:
        try:
            return int(hostname.split(":")[1])
        except (IndexError, ValueError):
            pass
    return 1


def _build_add_request(
    device: dict[str, Any],
    new_name: str,
    serial: str,
) -> AddDeviceRequest:
    """Build an AddDeviceRequest for a copy of *device* with a single serial."""
    custom_fields = {
        k: v
        for k, v in (device.get("_custom_field_data") or {}).items()
        if v is not None
    }
    tags = [t["id"] for t in (device.get("tags") or [])]
    rack = device.get("rack") or {}

    return AddDeviceRequest(
        name=new_name,
        device_type=device["device_type"]["id"],
        role=device["role"]["id"],
        location=device["location"]["id"],
        status=device["status"]["id"],
        serial=serial,
        custom_fields=custom_fields or None,
        tags=tags or None,
        rack=rack.get("id") or None,
        face=device.get("face") or None,
        interfaces=[],
        add_prefix=False,
    )


async def _fetch_device_full(
    nb: NautobotService,
    device_id: str,
) -> dict[str, Any] | None:
    """Fetch full device data by ID using GraphQL."""
    query = f"""
    {{
      devices(id: "{device_id}") {{
        id
        name
        role {{ id name }}
        status {{ id name }}
        location {{ id name }}
        device_type {{ id model manufacturer {{ id name }} }}
        _custom_field_data
        tags {{ id name }}
        rack {{ id name }}
        face
        serial
      }}
    }}
    """
    result = await nb.graphql_query(query)
    devices = result.get("data", {}).get("devices", [])
    return devices[0] if devices else None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "/devices/stacks",
    summary="🔷 GraphQL: List Devices with Multiple Serials (Stacks)",
)
async def get_stack_devices(
    serial_ic: Optional[str] = None,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
) -> dict:
    """Get devices that have multiple serial numbers (potential stacks).

    **🔷 This endpoint uses GraphQL** to query Nautobot for devices whose
    serial field contains a comma, indicating multiple serial numbers.

    Returns devices with id, name, serial, location, and device_type.
    """
    try:
        result = await nautobot_service.graphql_query(_STACK_DEVICES_QUERY)

        if "errors" in result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"GraphQL errors: {result['errors']}",
            )

        all_devices = result.get("data", {}).get("devices", [])
        # Filter in Python: keep only devices whose serial field contains a comma
        stack_devices = [d for d in all_devices if "," in (d.get("serial") or "")]
        return {"devices": stack_devices, "count": len(stack_devices)}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error fetching stack devices: %s", str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch stack devices: {str(exc)}",
        )


@router.post(
    "/devices/stacks/process",
    response_model=ProcessStacksResponse,
    summary="🔶 REST: Split Devices and Build Virtual Chassis",
)
async def process_stacks(
    request: ProcessStacksRequest,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
) -> ProcessStacksResponse:
    """Split devices with multiple serial numbers and build Virtual Chassis groups.

    For each device ID provided:
    1. Fetches full device details from Nautobot
    2. Splits the serial field into individual serials
    3. Updates the original device to keep only the first serial
    4. Creates a copy for each additional serial (e.g. fritz.box → fritz:2.box)
    5. Groups all resulting devices by base name and creates a Virtual Chassis

    **Required Permission:** `nautobot.devices:write`
    """
    creation_service = DeviceCreationService()
    update_service = DeviceUpdateService(nautobot_service)

    results: list[DeviceResult] = []

    for device_id in request.device_ids:
        device = await _fetch_device_full(nautobot_service, device_id)

        if not device:
            results.append(
                DeviceResult(
                    device_id=device_id,
                    device_name="<unknown>",
                    success=False,
                    message=f"Device {device_id} not found in Nautobot",
                )
            )
            continue

        device_name: str = device.get("name") or "<unnamed>"
        serials = _parse_serials(device.get("serial"), request.separator)

        if len(serials) <= 1:
            results.append(
                DeviceResult(
                    device_id=device_id,
                    device_name=device_name,
                    success=False,
                    message="Device has only a single serial number; nothing to split",
                )
            )
            continue

        first_serial = serials[0]
        created_names: list[str] = []
        error_message: str | None = None

        # ------------------------------------------------------------------
        # Step 1: Update the original device to keep only the first serial
        # ------------------------------------------------------------------
        try:
            await update_service.update_device(
                device_identifier={"id": device_id},
                update_data={"serial": first_serial},
            )
            logger.info(
                "Updated device %s serial: %r → %r",
                device_name,
                device.get("serial"),
                first_serial,
            )
        except Exception as exc:
            logger.error("Error updating device %s: %s", device_name, exc)
            results.append(
                DeviceResult(
                    device_id=device_id,
                    device_name=device_name,
                    success=False,
                    message=f"Failed to update original device serial: {exc}",
                )
            )
            continue

        # ------------------------------------------------------------------
        # Step 2: Create one copy per additional serial
        # ------------------------------------------------------------------
        for idx, serial in enumerate(serials[1:], start=2):
            if "." in device_name:
                hostname, _, rest = device_name.partition(".")
                new_name = f"{hostname}:{idx}.{rest}"
            else:
                new_name = f"{device_name}:{idx}"

            add_request = _build_add_request(device, new_name, serial)
            try:
                response = await creation_service.create_device_with_interfaces(
                    add_request
                )
                if response.get("summary", {}).get("device_created"):
                    created_names.append(new_name)
                    logger.info("Created device %s (serial: %s)", new_name, serial)
                else:
                    step = response.get("workflow_status", {}).get("step1_device", {})
                    error_message = (
                        f"Failed to create {new_name}: {step.get('message', 'unknown error')}"
                    )
                    logger.error(error_message)
            except Exception as exc:
                error_message = f"Failed to create {new_name}: {exc}"
                logger.error(error_message)

        if error_message:
            results.append(
                DeviceResult(
                    device_id=device_id,
                    device_name=device_name,
                    success=False,
                    message=error_message,
                    created_devices=created_names,
                )
            )
            continue

        # ------------------------------------------------------------------
        # Step 3: Build Virtual Chassis for the group
        # ------------------------------------------------------------------
        canon_name = _group_key(device_name)
        all_member_names = [device_name] + created_names

        # Re-fetch IDs for all members (original + newly created)
        all_members: list[dict[str, Any]] = []
        for name in all_member_names:
            query = f"""
            {{
              devices(name: "{name}") {{
                id
                name
              }}
            }}
            """
            fetch_result = await nautobot_service.graphql_query(query)
            fetched = fetch_result.get("data", {}).get("devices", [])
            if fetched:
                all_members.append(fetched[0])
            else:
                logger.warning("Could not find device by name '%s' after creation", name)

        if not all_members:
            results.append(
                DeviceResult(
                    device_id=device_id,
                    device_name=device_name,
                    success=False,
                    message="Could not fetch device IDs after split to build Virtual Chassis",
                    created_devices=created_names,
                )
            )
            continue

        # Sort: master first, then by position
        all_members.sort(key=lambda d: _member_position(d.get("name") or ""))
        master = next(
            (d for d in all_members if _is_master(d.get("name") or "")),
            all_members[0],
        )
        others = [d for d in all_members if d["id"] != master["id"]]

        vc_id: str | None = None
        try:
            vc = await nautobot_service.rest_request(
                endpoint="dcim/virtual-chassis/",
                method="POST",
                data={"name": canon_name},
            )
            vc_id = vc["id"]
            logger.info("Created Virtual Chassis '%s' (id: %s)", canon_name, vc_id)

            await nautobot_service.rest_request(
                endpoint=f"dcim/devices/{master['id']}/",
                method="PATCH",
                data={"virtual_chassis": vc_id, "vc_position": 1},
            )

            for pos, member in enumerate(others, start=2):
                await nautobot_service.rest_request(
                    endpoint=f"dcim/devices/{member['id']}/",
                    method="PATCH",
                    data={"virtual_chassis": vc_id, "vc_position": pos},
                )

            await nautobot_service.rest_request(
                endpoint=f"dcim/virtual-chassis/{vc_id}/",
                method="PATCH",
                data={"master": master["id"]},
            )

            results.append(
                DeviceResult(
                    device_id=device_id,
                    device_name=device_name,
                    success=True,
                    message=(
                        f"Split into {len(all_members)} devices and created "
                        f"Virtual Chassis '{canon_name}'"
                    ),
                    created_devices=created_names,
                    virtual_chassis_id=vc_id,
                    virtual_chassis_name=canon_name,
                )
            )
        except Exception as exc:
            logger.error(
                "Error building Virtual Chassis for '%s': %s", canon_name, exc
            )
            results.append(
                DeviceResult(
                    device_id=device_id,
                    device_name=device_name,
                    success=False,
                    message=f"Devices split but Virtual Chassis creation failed: {exc}",
                    created_devices=created_names,
                    virtual_chassis_id=vc_id,
                )
            )

    succeeded = sum(1 for r in results if r.success)
    return ProcessStacksResponse(
        results=results,
        total=len(results),
        succeeded=succeeded,
        failed=len(results) - succeeded,
    )
