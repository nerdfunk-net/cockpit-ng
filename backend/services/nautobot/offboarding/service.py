"""Offboarding workflow orchestrator."""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status

from models.nautobot import OffboardDeviceRequest
from services.nautobot.common.exceptions import NautobotAPIError
from services.nautobot.devices.common import DeviceCommonService
from services.nautobot.offboarding.audit import log_offboarding_event
from services.nautobot.offboarding.checkmk_cleanup import CheckMKCleanupManager
from services.nautobot.offboarding.device_cleanup import DeviceCleanupManager
from services.nautobot.offboarding.ip_cleanup import IPCleanupManager
from services.nautobot.offboarding.types import OffboardingResult, make_result
from services.nautobot.offboarding.virtual_chassis_cleanup import VirtualChassisCleanupManager

logger = logging.getLogger(__name__)


class OffboardingService:
    """Orchestrates the device offboarding workflow."""

    def __init__(self) -> None:
        import service_factory

        cache_service = service_factory.build_cache_service()
        nautobot_service = service_factory.build_nautobot_service()
        self._device_cleanup = DeviceCleanupManager(cache_service)
        self._ip_cleanup = IPCleanupManager(cache_service)
        self._checkmk_cleanup = CheckMKCleanupManager()
        self._nautobot = nautobot_service
        self._vc_manager = VirtualChassisCleanupManager(nautobot_service)
        self._device_common = DeviceCommonService(nautobot_service)

    async def offboard_device(
        self,
        device_id: str,
        request: OffboardDeviceRequest,
        current_user: Dict[str, Any],
    ) -> OffboardingResult:
        """Offboard a device based on the provided request configuration."""
        results = make_result(device_id)

        if request.virtual_chassis_action == "remove_all":
            await self._offboard_entire_chassis(device_id, request, current_user, results)
        else:
            await self._offboard_single_device(device_id, request, current_user, results)

        self._build_summary(results)
        device_details = results.get("_device_details") or {}
        log_offboarding_event(results, device_details, request, current_user)
        # Remove the internal helper key before returning
        results.pop("_device_details", None)  # type: ignore[misc]
        return results

    async def _offboard_entire_chassis(
        self,
        primary_device_id: str,
        request: OffboardDeviceRequest,
        current_user: Dict[str, Any],
        results: OffboardingResult,
    ) -> None:
        """Delete the virtual chassis then offboard all member devices."""
        vc_id = request.virtual_chassis_id
        member_ids: List[str] = request.chassis_member_ids or []

        # Fetch primary device name for audit context
        try:
            primary_details = await self._fetch_device_details(primary_device_id)
            results["device_name"] = primary_details.get("name", primary_device_id)
            results["_device_details"] = primary_details  # type: ignore[typeddict-unknown-key]
        except HTTPException:
            results["device_name"] = primary_device_id

        # 1. Delete the virtual chassis object first
        if vc_id:
            logger.info("Deleting virtual chassis %s before member removal", vc_id)
            try:
                await self._vc_manager.delete_virtual_chassis(vc_id)
                results["removed_items"].append(f"Virtual chassis: {vc_id}")
            except HTTPException as exc:
                results["errors"].append(f"Failed to delete virtual chassis: {exc.detail}")
                results["success"] = False
                logger.error("Failed to delete virtual chassis %s: %s", vc_id, exc.detail)
                return

        # 2. Offboard every member device
        for member_id in member_ids:
            logger.info("Offboarding virtual chassis member %s", member_id)
            try:
                member_details = await self._fetch_device_details(member_id)
                member_name = member_details.get("name", member_id)
            except HTTPException:
                member_details = {}
                member_name = member_id

            # Delete device directly so we can use the correct member name
            try:
                await self._device_cleanup.delete_device(member_id)
                results["removed_items"].append(f"Device: {member_name} ({member_id})")
            except HTTPException as exc:
                results["errors"].append(exc.detail)
                results["success"] = False
                logger.error("Failed to remove chassis member %s: %s", member_id, exc.detail)
                continue

            if request.remove_interface_ips:
                member_cleanup_details = member_details
                if not request.remove_primary_ip:
                    member_primary_ip4 = member_details.get("primary_ip4")
                    if member_primary_ip4 and member_primary_ip4.get("id"):
                        logger.info(
                            "Excluding primary IP %s from interface cleanup for chassis member %s (user chose to keep it)",
                            member_primary_ip4.get("address"),
                            member_name,
                        )
                        member_cleanup_details = self._exclude_ip_from_device_details(
                            member_cleanup_details, member_primary_ip4["id"]
                        )
                ips_removed = await self._ip_cleanup.remove_interface_ips(
                    member_id, member_cleanup_details, results
                )
            else:
                ips_removed = []

            await self._ip_cleanup.remove_primary_ip(
                member_id, member_details, ips_removed, request, results
            )

            if request.remove_from_checkmk:
                await self._checkmk_cleanup.remove_host(
                    member_details, current_user, results
                )

    async def _offboard_single_device(
        self,
        device_id: str,
        request: OffboardDeviceRequest,
        current_user: Dict[str, Any],
        results: OffboardingResult,
    ) -> None:
        """Offboard a single device, optionally reassigning VC master first."""
        # 1. Fetch device details
        device_details = await self._fetch_device_details(device_id)
        results["device_name"] = device_details.get("name", device_id)
        results["_device_details"] = device_details  # type: ignore[typeddict-unknown-key]

        is_vc_master_reassignment = (
            request.virtual_chassis_action == "remove_single"
            and bool(request.virtual_chassis_id)
            and bool(request.new_master_id)
        )
        primary_ip_data = device_details.get("primary_ip4") if is_vc_master_reassignment else None
        primary_ip_id: Optional[str] = primary_ip_data.get("id") if primary_ip_data else None
        primary_ip_address: Optional[str] = primary_ip_data.get("address") if primary_ip_data else None

        # 2. If this device is the VC master, reassign before deletion
        if is_vc_master_reassignment:
            logger.info(
                "Reassigning virtual chassis %s master to %s before removing device %s",
                request.virtual_chassis_id,
                request.new_master_id,
                device_id,
            )
            try:
                await self._vc_manager.update_master(
                    request.virtual_chassis_id, request.new_master_id
                )
                results["removed_items"].append(
                    f"Virtual chassis master reassigned to {request.new_master_id}"
                )
            except HTTPException as exc:
                results["errors"].append(f"Failed to reassign VC master: {exc.detail}")
                results["success"] = False
                logger.error(
                    "Failed to reassign VC master for chassis %s: %s",
                    request.virtual_chassis_id,
                    exc.detail,
                )
                return

        # 3. Remove device from Nautobot
        logger.info("Removing device %s from Nautobot", device_id)
        await self._device_cleanup.handle_device_removal(device_id, results)

        # 4. Transfer primary IP to new master (VC master reassignment only)
        transferred_ip_id: Optional[str] = None
        if is_vc_master_reassignment and primary_ip_id and primary_ip_address:
            await self._transfer_ip_to_new_master(
                request.new_master_id, primary_ip_address, primary_ip_id, results  # type: ignore[arg-type]
            )
            transferred_ip_id = primary_ip_id

        # 4b. Rename new master if requested
        if is_vc_master_reassignment and request.new_master_name:
            await self._rename_device(
                request.new_master_id,  # type: ignore[arg-type]
                request.new_master_name,
                results,
            )

        # 5. Interface IP cleanup (excluding transferred IP so it is not deleted from IPAM)
        interface_ips_removed: List[Dict[str, Any]] = []
        if request.remove_interface_ips:
            cleanup_details = device_details
            if transferred_ip_id:
                cleanup_details = self._exclude_ip_from_device_details(cleanup_details, transferred_ip_id)
            if not request.remove_primary_ip:
                primary_ip4 = device_details.get("primary_ip4")
                if primary_ip4 and primary_ip4.get("id"):
                    logger.info(
                        "Excluding primary IP %s from interface cleanup (user chose to keep it)",
                        primary_ip4.get("address"),
                    )
                    cleanup_details = self._exclude_ip_from_device_details(
                        cleanup_details, primary_ip4["id"]
                    )
            interface_ips_removed = await self._ip_cleanup.remove_interface_ips(
                device_id, cleanup_details, results
            )
        else:
            results["skipped_items"].append("Interface IP removal was not requested")
            logger.info("Interface IP removal skipped (not requested)")

        # 6. Primary IP
        if transferred_ip_id:
            results["skipped_items"].append(
                f"Primary IP {primary_ip_address} transferred to new VC master"
            )
        else:
            await self._ip_cleanup.remove_primary_ip(
                device_id, device_details, interface_ips_removed, request, results
            )

        # 7. CheckMK
        if request.remove_from_checkmk:
            await self._checkmk_cleanup.remove_host(
                device_details, current_user, results
            )
        else:
            results["skipped_items"].append("CheckMK removal was not requested")
            logger.info("CheckMK removal skipped (not requested)")

    async def _transfer_ip_to_new_master(
        self,
        new_master_id: str,
        ip_address: str,
        ip_id: str,
        results: OffboardingResult,
    ) -> None:
        """Create a management interface on the new VC master and assign the old master's primary IP to it."""
        try:
            interface_id = await self._device_common.ensure_interface_exists(
                device_id=new_master_id,
                interface_name="management",
            )
            await self._device_common.assign_ip_to_interface(
                ip_id=ip_id,
                interface_id=interface_id,
            )
            await self._device_common.assign_primary_ip_to_device(
                device_id=new_master_id,
                ip_address_id=ip_id,
            )
            results["removed_items"].append(
                f"Transferred primary IP {ip_address} to new VC master (management interface)"
            )
            logger.info(
                "Transferred primary IP %s to new VC master %s", ip_address, new_master_id
            )
        except HTTPException as exc:
            results["errors"].append(
                f"Failed to transfer IP {ip_address} to new master: {exc.detail}"
            )
            results["success"] = False
            logger.error(
                "Failed to transfer IP %s to new master %s: %s",
                ip_address, new_master_id, exc.detail,
            )

    async def _rename_device(
        self,
        device_id: str,
        new_name: str,
        results: OffboardingResult,
    ) -> None:
        """Rename a device in Nautobot via REST PATCH."""
        try:
            await self._nautobot.rest_request(
                f"dcim/devices/{device_id}/",
                method="PATCH",
                data={"name": new_name},
            )
            results["removed_items"].append(f"Renamed new VC master to {new_name!r}")
            logger.info("Renamed device %s to %s", device_id, new_name)
        except NautobotAPIError as exc:
            results["errors"].append(f"Failed to rename device to {new_name!r}: {exc}")
            results["success"] = False
            logger.error("Failed to rename device %s to %s: %s", device_id, new_name, exc)

    @staticmethod
    def _exclude_ip_from_device_details(
        device_details: Dict[str, Any],
        ip_id: str,
    ) -> Dict[str, Any]:
        """Return a copy of device_details with the given IP removed from all interfaces."""
        interfaces = device_details.get("interfaces") or []
        updated_interfaces = [
            {
                **iface,
                "ip_addresses": [
                    ip for ip in (iface.get("ip_addresses") or [])
                    if ip.get("id") != ip_id
                ],
            }
            for iface in interfaces
        ]
        return {**device_details, "interfaces": updated_interfaces}

    async def _fetch_device_details(self, device_id: str) -> Dict[str, Any]:
        """Fetch device details using shared device query service."""
        try:
            import service_factory

            device_query_service = service_factory.build_device_query_service()

            # Use shared device details service
            device = await device_query_service.get_device_details(
                device_id=device_id,
                use_cache=True,
            )
            return device
        except ValueError as exc:
            # ValueError from service indicates device not found or query error
            if "not found" in str(exc).lower():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=str(exc),
                ) from exc
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(exc),
            ) from exc
        except Exception as exc:
            logger.error(
                "Error fetching device details for %s: %s", device_id, str(exc)
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to fetch device details: {str(exc)}",
            ) from exc

    def _build_summary(self, results: OffboardingResult) -> None:
        """Build summary message based on results."""
        removed_count = len(results["removed_items"])
        error_count = len(results["errors"])

        if error_count > 0:
            results["success"] = False
            results["summary"] = (
                "Offboarding partially completed: "
                f"{removed_count} items removed, {error_count} errors occurred"
            )
        else:
            results["summary"] = (
                f"Offboarding completed successfully: {removed_count} items removed"
            )

        logger.info(
            "Offboard process completed for device %s: %s",
            results["device_id"],
            results["summary"],
        )


__all__ = ["OffboardingService"]
