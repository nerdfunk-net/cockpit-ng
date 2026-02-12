"""IP address cleanup during offboarding."""

from __future__ import annotations

import logging
from typing import Any, Dict, List

from fastapi import HTTPException

from models.nautobot import OffboardDeviceRequest
from services.nautobot import nautobot_service
from services.nautobot_helpers import (
    get_device_cache_key,
    get_device_details_cache_key,
    get_device_list_cache_key,
    get_ip_address_cache_key,
)
from services.nautobot.common.exceptions import translate_http_exception
from services.nautobot.offboarding.types import OffboardingResult
from services.settings.cache import cache_service

logger = logging.getLogger(__name__)


class IPCleanupManager:
    """Handles IP address removal during offboarding."""

    async def remove_interface_ips(
        self,
        device_id: str,
        device_details: Dict[str, Any],
        results: OffboardingResult,
    ) -> List[Dict[str, Any]]:
        """Remove all IP addresses from device interfaces."""
        logger.info("Processing interface IP removal")
        interfaces = device_details.get("interfaces", []) or []
        interface_ips_removed: List[Dict[str, Any]] = []

        for interface in interfaces:
            interface_name = interface.get("name", "unknown")
            ip_addresses = interface.get("ip_addresses", []) or []

            for ip_addr in ip_addresses:
                ip_id = ip_addr.get("id")
                ip_address = ip_addr.get("address", "unknown")

                if not ip_id:
                    continue

                try:
                    await self._delete_ip_address(ip_id, device_id)
                    interface_ips_removed.append(
                        {
                            "ip_id": ip_id,
                            "address": ip_address,
                            "interface": interface_name,
                        }
                    )
                    results["removed_items"].append(
                        f"Interface IP: {ip_address} (interface: {interface_name})"
                    )
                    logger.info(
                        "Removed interface IP %s from interface %s",
                        ip_address,
                        interface_name,
                    )
                except HTTPException as exc:
                    results["errors"].append(exc.detail)
                    logger.error(
                        "Failed to remove interface IP %s from interface %s: %s",
                        ip_address,
                        interface_name,
                        exc.detail,
                    )
                except Exception as exc:
                    error_msg = (
                        "Failed to remove interface IP "
                        f"{ip_address} from interface {interface_name}: {str(exc)}"
                    )
                    results["errors"].append(error_msg)
                    logger.error(error_msg)

        if not interface_ips_removed:
            results["skipped_items"].append("No interface IPs found to remove")
            logger.info("No interface IP addresses found for removal")

        return interface_ips_removed

    async def remove_primary_ip(
        self,
        device_id: str,
        device_details: Dict[str, Any],
        interface_ips_removed: List[Dict[str, Any]],
        request: OffboardDeviceRequest,
        results: OffboardingResult,
    ) -> None:
        """Remove primary IP address if requested."""
        if not request.remove_primary_ip:
            results["skipped_items"].append("Primary IP removal was not requested")
            logger.info("Primary IP removal skipped (not requested)")
            return

        logger.info("Processing primary IP removal")
        primary_ip4 = device_details.get("primary_ip4")

        if not primary_ip4:
            results["skipped_items"].append("No primary IP found")
            logger.info("No primary IP found for removal")
            return

        primary_ip_id = primary_ip4.get("id")
        primary_ip_address = primary_ip4.get("address", "unknown")

        if not primary_ip_id:
            results["skipped_items"].append("Primary IP has no valid ID")
            logger.warning("Primary IP found but has no valid ID")
            return

        already_removed = any(
            ip_info.get("ip_id") == primary_ip_id for ip_info in interface_ips_removed
        )

        if already_removed:
            results["skipped_items"].append(
                f"Primary IP {primary_ip_address} already removed with interface IPs"
            )
            logger.info(
                "Primary IP %s was already removed as interface IP",
                primary_ip_address,
            )
            return

        try:
            await self._delete_ip_address(primary_ip_id, device_id)
            results["removed_items"].append(f"Primary IP: {primary_ip_address}")
            logger.info("Removed primary IP %s", primary_ip_address)
        except HTTPException as exc:
            results["errors"].append(exc.detail)
            logger.error(
                "Failed to remove primary IP %s: %s",
                primary_ip_address,
                exc.detail,
            )
        except Exception as exc:
            error_msg = f"Failed to remove primary IP {primary_ip_address}: {str(exc)}"
            results["errors"].append(error_msg)
            logger.error(error_msg)

    async def _delete_ip_address(self, ip_id: str, device_id: str) -> Dict[str, Any]:
        """Delete an IP address from Nautobot."""
        try:
            result = await nautobot_service.rest_request(
                f"ipam/ip-addresses/{ip_id}/",
                method="DELETE",
            )
        except Exception as exc:
            raise translate_http_exception(exc, f"Failed to delete IP address {ip_id}")

        cache_service.delete(get_ip_address_cache_key(ip_id))
        cache_service.delete(get_device_cache_key(device_id))
        cache_service.delete(get_device_details_cache_key(device_id))
        cache_service.delete(get_device_list_cache_key())
        return result
