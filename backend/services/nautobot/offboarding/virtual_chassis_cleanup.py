"""Virtual chassis operations used during device offboarding."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Dict

from fastapi import HTTPException, status

from models.nautobot import (
    DeviceVirtualChassisStatus,
    VirtualChassisInfo,
    VirtualChassisMember,
)
from services.nautobot.common.exceptions import NautobotAPIError
from services.nautobot.common.validators import is_valid_uuid

if TYPE_CHECKING:
    from services.nautobot.client import NautobotService

logger = logging.getLogger(__name__)

# GraphQL query to fetch virtual chassis membership for a single device.
# Uses string formatting after UUID validation — no injection risk.
_VIRTUAL_CHASSIS_QUERY = """
{
  devices(id: "%s") {
    id
    name
    virtual_chassis {
      id
      name
      members { id name }
      master { id name }
    }
  }
}
"""


class VirtualChassisCleanupManager:
    """Handles virtual chassis read/write operations during offboarding."""

    def __init__(self, nautobot_service: "NautobotService") -> None:
        self._nb = nautobot_service

    async def get_status(self, device_id: str) -> DeviceVirtualChassisStatus:
        """Query Nautobot for the virtual chassis status of a device.

        Raises:
            HTTPException 400 if device_id is not a valid UUID.
            HTTPException 500 on API errors.
        """
        if not is_valid_uuid(device_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid device UUID: {device_id}",
            )

        query = _VIRTUAL_CHASSIS_QUERY % device_id
        try:
            result = await self._nb.graphql_query(query)
        except NautobotAPIError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"GraphQL query failed: {exc}",
            ) from exc

        devices: list[Dict[str, Any]] = result.get("data", {}).get("devices", [])
        if not devices:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Device {device_id} not found in Nautobot",
            )

        device = devices[0]
        vc_data = device.get("virtual_chassis")

        if not vc_data:
            return DeviceVirtualChassisStatus(
                is_in_chassis=False,
                is_master=False,
                virtual_chassis=None,
            )

        master_data = vc_data.get("master") or {}
        is_master = master_data.get("id") == device_id

        vc_info = VirtualChassisInfo(
            id=vc_data["id"],
            name=vc_data["name"],
            members=[
                VirtualChassisMember(id=m["id"], name=m["name"])
                for m in vc_data.get("members", [])
            ],
            master=VirtualChassisMember(
                id=master_data["id"], name=master_data.get("name", "")
            )
            if master_data.get("id")
            else None,
        )

        return DeviceVirtualChassisStatus(
            is_in_chassis=True,
            is_master=is_master,
            virtual_chassis=vc_info,
        )

    async def delete_virtual_chassis(self, vc_id: str) -> None:
        """Delete a virtual chassis from Nautobot via REST.

        Raises:
            HTTPException on API error.
        """
        if not is_valid_uuid(vc_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid virtual chassis UUID: {vc_id}",
            )
        try:
            await self._nb.rest_request(
                f"dcim/virtual-chassis/{vc_id}/",
                method="DELETE",
            )
            logger.info("Deleted virtual chassis %s", vc_id)
        except NautobotAPIError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete virtual chassis {vc_id}: {exc}",
            ) from exc

    async def update_master(self, vc_id: str, new_master_id: str) -> None:
        """Reassign the master of a virtual chassis via REST PATCH.

        Raises:
            HTTPException on validation or API error.
        """
        if not is_valid_uuid(vc_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid virtual chassis UUID: {vc_id}",
            )
        if not is_valid_uuid(new_master_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid new master device UUID: {new_master_id}",
            )
        try:
            await self._nb.rest_request(
                f"dcim/virtual-chassis/{vc_id}/",
                method="PATCH",
                data={"master": {"id": new_master_id}},
            )
            logger.info(
                "Updated virtual chassis %s master to %s", vc_id, new_master_id
            )
        except NautobotAPIError as exc:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update virtual chassis master: {exc}",
            ) from exc
