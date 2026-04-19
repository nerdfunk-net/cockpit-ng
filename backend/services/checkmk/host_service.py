"""
CheckMK host management service.
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional

from services.checkmk.base import CheckMKClientFactory, slash_to_tilde
from services.checkmk.exceptions import (
    CheckMKAPIError,
    HostNotFoundError,
)

logger = logging.getLogger(__name__)


class CheckMKHostService:
    """Service for CheckMK host management operations."""

    def __init__(self):
        pass

    # ------------------------------------------------------------------
    # GET /hosts
    # ------------------------------------------------------------------

    async def get_all_hosts(
        self,
        effective_attributes: bool = False,
        include_links: bool = False,
        site: Optional[str] = None,
    ) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        result = await asyncio.to_thread(
            lambda: client.get_all_hosts(
                effective_attributes=effective_attributes,
                include_links=include_links,
                site=site,
            )
        )
        hosts = []
        for host_data in result.get("value", []):
            hosts.append(
                {
                    "host_name": host_data.get("id"),
                    "folder": host_data.get("extensions", {}).get("folder", "/"),
                    "attributes": host_data.get("extensions", {}).get("attributes", {}),
                    "effective_attributes": host_data.get("extensions", {}).get(
                        "effective_attributes"
                    )
                    if effective_attributes
                    else None,
                }
            )
        return {"hosts": hosts, "total": len(hosts)}

    # ------------------------------------------------------------------
    # GET /hosts/{hostname}
    # ------------------------------------------------------------------

    async def get_host(
        self, hostname: str, effective_attributes: bool = False
    ) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        try:
            return await asyncio.to_thread(
                lambda: client.get_host(hostname, effective_attributes)
            )
        except CheckMKAPIError as e:
            if e.status_code == 404:
                raise HostNotFoundError(
                    f"Host '{hostname}' not found in CheckMK"
                ) from e
            raise

    # ------------------------------------------------------------------
    # POST /hosts
    # ------------------------------------------------------------------

    async def create_host(
        self,
        hostname: str,
        folder: Optional[str],
        attributes: Optional[Dict[str, Any]],
        bake_agent: bool = False,
        start_discovery: bool = False,
        discovery_mode: str = "tabula_rasa",
    ) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        result = await asyncio.to_thread(
            lambda: client.create_host(
                hostname=hostname,
                folder=folder,
                attributes=attributes,
                bake_agent=bake_agent,
            )
        )
        response_data: Dict[str, Any] = {"create_result": result}

        if start_discovery:
            try:
                logger.info(
                    "Starting service discovery (%s) for host %s",
                    discovery_mode,
                    hostname,
                )
                disc_result = await asyncio.to_thread(
                    lambda: client.start_service_discovery(
                        hostname, mode=discovery_mode
                    )
                )
                response_data["discovery"] = {
                    "started": True,
                    "mode": discovery_mode,
                    "result": disc_result,
                }
            except Exception as e:
                logger.warning("Failed to start discovery for host %s: %s", hostname, e)
                response_data["discovery"] = {"started": False, "error": str(e)}

        return response_data

    # ------------------------------------------------------------------
    # POST /hosts/create  (v2 — bake_agent from query param)
    # ------------------------------------------------------------------

    async def create_host_v2(
        self,
        hostname: str,
        folder: Optional[str],
        attributes: Optional[Dict[str, Any]],
        bake_agent: bool = False,
        request_bake_agent: bool = False,
        start_discovery: bool = False,
        discovery_mode: str = "tabula_rasa",
    ) -> Dict[str, Any]:
        effective_bake = bake_agent if bake_agent is not None else request_bake_agent
        return await self.create_host(
            hostname=hostname,
            folder=folder,
            attributes=attributes,
            bake_agent=effective_bake,
            start_discovery=start_discovery,
            discovery_mode=discovery_mode,
        )

    # ------------------------------------------------------------------
    # PUT /hosts/{hostname}
    # ------------------------------------------------------------------

    async def update_host(
        self, hostname: str, attributes: Dict[str, Any]
    ) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(lambda: client.update_host(hostname, attributes))

    # ------------------------------------------------------------------
    # DELETE /hosts/{hostname}
    # ------------------------------------------------------------------

    async def delete_host(
        self, hostname: str, site_name: Optional[str] = None
    ) -> Dict[str, Any]:
        logger.info("Deleting host from CheckMK: %s", hostname)
        client = CheckMKClientFactory.build_client_from_settings(site_name=site_name)
        await asyncio.to_thread(lambda: client.delete_host(hostname))
        return {"success": True, "message": f"Host {hostname} deleted successfully"}

    # ------------------------------------------------------------------
    # POST /hosts/{hostname}/move
    # ------------------------------------------------------------------

    async def move_host(self, hostname: str, target_folder: str) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        checkmk_folder = slash_to_tilde(target_folder)
        return await asyncio.to_thread(
            lambda: client.move_host(hostname, checkmk_folder)
        )

    # ------------------------------------------------------------------
    # POST /hosts/{hostname}/rename
    # ------------------------------------------------------------------

    async def rename_host(self, hostname: str, new_name: str) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(lambda: client.rename_host(hostname, new_name))

    # ------------------------------------------------------------------
    # POST /hosts/bulk-create
    # ------------------------------------------------------------------

    async def bulk_create_hosts(self, entries: List[Any]) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        hosts = [
            {
                "host_name": e.host_name,
                "folder": e.folder,
                "attributes": e.attributes,
            }
            for e in entries
        ]
        return await asyncio.to_thread(lambda: client.bulk_create_hosts(hosts))

    # ------------------------------------------------------------------
    # POST /hosts/bulk-update
    # ------------------------------------------------------------------

    async def bulk_update_hosts(self, entries: Dict[str, Any]) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        hosts = {
            hostname: {"attributes": req.attributes}
            for hostname, req in entries.items()
        }
        return await asyncio.to_thread(lambda: client.bulk_update_hosts(hosts))

    # ------------------------------------------------------------------
    # POST /hosts/bulk-delete
    # ------------------------------------------------------------------

    async def bulk_delete_hosts(self, entries: List[str]) -> Dict[str, Any]:
        client = CheckMKClientFactory.build_client_from_settings()
        return await asyncio.to_thread(lambda: client.bulk_delete_hosts(entries))
