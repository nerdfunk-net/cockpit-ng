"""Service for handling Nautobot device offboarding workflows."""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from fastapi import HTTPException, status

from models.nautobot import OffboardDeviceRequest
from services.settings.cache import cache_service
from services.nautobot import nautobot_service
from settings_manager import settings_manager

logger = logging.getLogger(__name__)

DEVICE_CACHE_TTL = 30 * 60


class OffboardingService:
    """Encapsulates Nautobot offboarding operations."""

    async def offboard_device(
        self,
        device_id: str,
        request: OffboardDeviceRequest,
        current_user: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Offboard a device based on the provided request configuration."""
        results: Dict[str, Any] = {
            "success": True,
            "device_id": device_id,
            "removed_items": [],
            "skipped_items": [],
            "errors": [],
            "summary": "",
        }

        device_details = await self._fetch_device_details(device_id)
        results["device_name"] = device_details.get("name", device_id)

        # Get offboarding settings early for validation
        offboarding_settings = await self._get_offboarding_settings()
        logger.info(
            "DEBUG: Retrieved offboarding settings: %s",
            offboarding_settings is not None,
        )

        integration_mode_raw = request.nautobot_integration_mode or "remove"
        integration_mode = self._normalize_integration_mode(integration_mode_raw)

        logger.info(
            "DEBUG: Offboarding device %s - raw_mode='%s', normalized_mode='%s'",
            device_id,
            integration_mode_raw,
            integration_mode,
        )

        if integration_mode == "remove":
            logger.info("DEBUG: Taking REMOVAL path for device %s", device_id)
            await self._handle_device_removal(device_id, results)
        else:
            logger.info("DEBUG: Taking SET_OFFBOARDING path for device %s", device_id)
            # Validate settings before proceeding
            if not self._validate_offboarding_settings(offboarding_settings, results):
                logger.warning(
                    "DEBUG: Offboarding settings validation failed for device %s",
                    device_id,
                )
                return results

            # Handle device name clearing (independent of custom fields)
            if offboarding_settings.get("clear_device_name", False):
                logger.info(
                    "DEBUG: clear_device_name is True - clearing device name for %s",
                    device_id,
                )
                try:
                    await self._clear_device_name(device_id)
                    results["removed_items"].append("Device name cleared")
                    logger.info("Successfully cleared device name for %s", device_id)
                except HTTPException as exc:
                    results["errors"].append(
                        f"Failed to clear device name: {exc.detail}"
                    )
                    results["success"] = False
                    logger.error(
                        "Failed to clear device name for %s: %s", device_id, exc.detail
                    )
                except Exception as exc:
                    error_msg = (
                        f"Failed to clear device name for {device_id}: {str(exc)}"
                    )
                    results["errors"].append(error_msg)
                    results["success"] = False
                    logger.error(error_msg)

            # Handle serial number clearing (if keep_serial is False)
            if not offboarding_settings.get("keep_serial", False):
                logger.info(
                    "DEBUG: keep_serial is False - clearing device serial number for %s",
                    device_id,
                )
                try:
                    await self._clear_device_serial(device_id)
                    results["removed_items"].append("Device serial number cleared")
                    logger.info(
                        "Successfully cleared device serial number for %s", device_id
                    )
                except HTTPException as exc:
                    results["errors"].append(
                        f"Failed to clear device serial number: {exc.detail}"
                    )
                    results["success"] = False
                    logger.error(
                        "Failed to clear device serial number for %s: %s",
                        device_id,
                        exc.detail,
                    )
                except Exception as exc:
                    error_msg = f"Failed to clear device serial number for {device_id}: {str(exc)}"
                    results["errors"].append(error_msg)
                    results["success"] = False
                    logger.error(error_msg)

            # Handle custom fields processing
            await self._handle_set_offboarding_values(
                device_id, results, offboarding_settings, device_details
            )

            # Handle location, status, and role updates
            await self._handle_device_attributes_update(
                device_id, results, offboarding_settings
            )

        interface_ips_removed = []
        if request.remove_interface_ips:
            interface_ips_removed = await self._remove_interface_ips(
                device_id, device_details, results
            )
        else:
            results["skipped_items"].append("Interface IP removal was not requested")
            logger.info("Interface IP removal skipped (not requested)")

        await self._remove_primary_ip(
            device_id,
            device_details,
            interface_ips_removed,
            request,
            results,
        )

        if request.remove_from_checkmk:
            await self._remove_from_checkmk(device_details, current_user, results)
        else:
            results["skipped_items"].append("CheckMK removal was not requested")
            logger.info("CheckMK removal skipped (not requested)")

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
            device_id,
            results["summary"],
        )

        # Log device offboarding to audit log
        username = current_user.get("username")
        user_id = current_user.get("user_id")
        if username:
            from repositories.audit_log_repository import audit_log_repo

            # Prepare extra data for audit log
            extra_data = {
                "integration_mode": integration_mode,
                "removed_items_count": removed_count,
                "errors_count": error_count,
            }

            # Add device details if available
            if device_details:
                if "serial" in device_details and device_details["serial"]:
                    extra_data["serial_number"] = device_details["serial"]

                # Get platform name if available
                platform = device_details.get("platform")
                if platform and isinstance(platform, dict):
                    extra_data["platform"] = platform.get("name")

                # Get device type/model if available
                device_type = device_details.get("device_type")
                if device_type and isinstance(device_type, dict):
                    extra_data["device_type"] = device_type.get("model")

            # Add request properties
            extra_data["remove_interface_ips"] = request.remove_interface_ips
            extra_data["remove_primary_ip"] = request.remove_primary_ip
            extra_data["remove_from_checkmk"] = request.remove_from_checkmk

            # Log with appropriate severity based on success
            severity = "info" if results["success"] else "warning"

            audit_log_repo.create_log(
                username=username,
                user_id=user_id,
                event_type="offboard-device",
                message=f"Device '{results['device_name']}' offboarded from Nautobot",
                resource_type="device",
                resource_id=device_id,
                resource_name=results.get("device_name", device_id),
                severity=severity,
                extra_data=extra_data,
            )

        return results

    async def _handle_device_removal(
        self,
        device_id: str,
        results: Dict[str, Any],
    ) -> None:
        logger.info("DEBUG: _handle_device_removal called for device %s", device_id)
        logger.info("Removing device %s", device_id)
        try:
            await self._delete_device(device_id)
            device_name = results.get("device_name", device_id)
            results["removed_items"].append(f"Device: {device_name} ({device_id})")
            logger.info("Successfully removed device %s", device_id)
        except HTTPException as exc:
            results["errors"].append(exc.detail)
            results["success"] = False
            logger.error("Failed to remove device %s: %s", device_id, exc.detail)
        except Exception as exc:
            error_msg = f"Failed to remove device {device_id}: {str(exc)}"
            results["errors"].append(error_msg)
            results["success"] = False
            logger.error(error_msg)

    async def _handle_set_offboarding_values(
        self,
        device_id: str,
        results: Dict[str, Any],
        settings: Dict[str, Any],
        device_details: Dict[str, Any],
    ) -> None:
        logger.info(
            "DEBUG: _handle_set_offboarding_values called for device %s", device_id
        )
        logger.info(
            "Applying custom fields offboarding settings to device %s", device_id
        )

        # 1. Initialize an empty dict named "custom_fields_update"
        custom_fields_update: Dict[str, Any] = {}

        # 2. Get the list of all custom fields and their default values
        try:
            logger.info("DEBUG: Fetching custom field definitions from nautobot router")
            from routers.nautobot import get_nautobot_device_custom_fields

            custom_field_list = await get_nautobot_device_custom_fields()

            logger.info(
                "DEBUG: Retrieved %d custom field definitions",
                len(custom_field_list) if isinstance(custom_field_list, list) else 0,
            )
        except Exception as exc:
            logger.error(
                "DEBUG: Failed to fetch custom field definitions: %s", str(exc)
            )
            results["errors"].append(
                f"Failed to fetch custom field definitions: {str(exc)}"
            )
            results["success"] = False
            return

        if not custom_field_list:
            logger.info("DEBUG: No custom field definitions found")
            results["skipped_items"].append("No custom field definitions found")
            return

        # Get custom field settings from offboarding settings
        custom_field_settings = settings.get("custom_field_settings", {})
        remove_all_custom_fields = settings.get("remove_all_custom_fields", False)
        logger.info("DEBUG: custom_field_settings = %s", custom_field_settings)
        logger.info("DEBUG: remove_all_custom_fields = %s", remove_all_custom_fields)

        # 3. Loop through the custom field list
        for field_def in custom_field_list:
            label = field_def.get("label")
            default_value = field_def.get("default")

            if not label:
                continue

            logger.info(
                "DEBUG: Processing custom field '%s' with default value: %s",
                label,
                default_value,
            )

            # If remove_all_custom_fields is True, clear all fields to default values
            if remove_all_custom_fields:
                custom_fields_update[label] = default_value
                logger.info(
                    "DEBUG: remove_all_custom_fields=True - Setting field '%s' to default value: %s",
                    label,
                    default_value,
                )
            # Otherwise, check if this field is configured in custom_field_settings
            elif label in custom_field_settings:
                configured_value = custom_field_settings[label]
                logger.info(
                    "DEBUG: Found configuration for field '%s': %s",
                    label,
                    configured_value,
                )

                if configured_value == "clear":
                    # Use the default value
                    custom_fields_update[label] = default_value
                    logger.info(
                        "DEBUG: Setting field '%s' to default value: %s",
                        label,
                        default_value,
                    )
                else:
                    # Use the configured value
                    custom_fields_update[label] = configured_value
                    logger.info(
                        "DEBUG: Setting field '%s' to configured value: %s",
                        label,
                        configured_value,
                    )

        # 4. Update the device with the custom_fields_update dict
        if not custom_fields_update:
            results["skipped_items"].append(
                "No custom field updates specified in offboarding settings"
            )
            logger.info("No custom field updates specified; skipping")
            return

        payload = {"custom_fields": custom_fields_update}
        logger.info("DEBUG: Payload for updating custom fields: %s", payload)

        try:
            await self._update_device(device_id, payload)
            results["removed_items"].append(
                "Device custom fields updated for offboarding"
            )
            logger.info(
                "Applied offboarding custom field settings to device %s", device_id
            )
        except HTTPException as exc:
            results["errors"].append(exc.detail)
            results["success"] = False
            logger.error(
                "Failed to apply offboarding settings for device %s: %s",
                device_id,
                exc.detail,
            )
        except Exception as exc:
            error_msg = f"Failed to apply offboarding settings for device {device_id}: {str(exc)}"
            results["errors"].append(error_msg)
            results["success"] = False
            logger.error(error_msg)

    async def _handle_device_attributes_update(
        self,
        device_id: str,
        results: Dict[str, Any],
        settings: Dict[str, Any],
    ) -> None:
        """Update device location, status, and role based on offboarding settings."""
        logger.info(
            "Updating device attributes (location, status, role) for device %s",
            device_id,
        )

        payload = {}
        updates_made = []

        # Update location if specified
        if settings.get("location_id"):
            payload["location"] = settings["location_id"]
            updates_made.append("location")
            logger.info("Setting device location to %s", settings["location_id"])

        # Update status if specified
        if settings.get("status_id"):
            payload["status"] = settings["status_id"]
            updates_made.append("status")
            logger.info("Setting device status to %s", settings["status_id"])

        # Update role if specified
        if settings.get("role_id"):
            payload["role"] = settings["role_id"]
            updates_made.append("role")
            logger.info("Setting device role to %s", settings["role_id"])

        # Only make the API call if there are updates to apply
        if not payload:
            results["skipped_items"].append(
                "No location, status, or role updates specified in offboarding settings"
            )
            logger.info("No device attribute updates specified; skipping")
            return

        try:
            await self._update_device(device_id, payload)
            results["removed_items"].append(
                f"Device attributes updated: {', '.join(updates_made)}"
            )
            logger.info(
                "Successfully updated device attributes for %s: %s",
                device_id,
                ", ".join(updates_made),
            )
        except HTTPException as exc:
            results["errors"].append(
                f"Failed to update device attributes: {exc.detail}"
            )
            results["success"] = False
            logger.error(
                "Failed to update device attributes for %s: %s", device_id, exc.detail
            )
        except Exception as exc:
            error_msg = (
                f"Failed to update device attributes for {device_id}: {str(exc)}"
            )
            results["errors"].append(error_msg)
            results["success"] = False
            logger.error(error_msg)

    async def _remove_interface_ips(
        self,
        device_id: str,
        device_details: Dict[str, Any],
        results: Dict[str, Any],
    ) -> list[Dict[str, Any]]:
        logger.info("Processing interface IP removal")
        interfaces = device_details.get("interfaces", []) or []
        interface_ips_removed: list[Dict[str, Any]] = []

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

    async def _remove_primary_ip(
        self,
        device_id: str,
        device_details: Dict[str, Any],
        interface_ips_removed: list[Dict[str, Any]],
        request: OffboardDeviceRequest,
        results: Dict[str, Any],
    ) -> None:
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

    async def _remove_from_checkmk(
        self,
        device_details: Dict[str, Any],
        current_user: Dict[str, Any],
        results: Dict[str, Any],
    ) -> None:
        logger.info("Processing CheckMK removal")
        device_name = device_details.get("name")

        if not device_name:
            results["skipped_items"].append(
                "CheckMK removal skipped: No device name found"
            )
            logger.warning(
                "CheckMK removal skipped: No device name found in device details"
            )
            return

        try:
            from routers.checkmk import delete_host  # Local import to avoid cycles

            await delete_host(device_name, current_user)
            results["removed_items"].append(f"CheckMK Host: {device_name}")
            logger.info("Successfully removed device %s from CheckMK", device_name)
        except HTTPException as exc:
            results["errors"].append(exc.detail)
            logger.error(
                "Failed to remove device %s from CheckMK: %s",
                device_name,
                exc.detail,
            )
        except Exception as exc:
            error_msg = (
                f"Failed to remove device {device_name} from CheckMK: {str(exc)}"
            )
            results["errors"].append(error_msg)
            logger.error(error_msg)

    async def _fetch_device_details(self, device_id: str) -> Dict[str, Any]:
        """Fetch device details using shared device query service."""
        try:
            from services.nautobot.devices import device_query_service

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

    async def _delete_device(self, device_id: str) -> Dict[str, Any]:
        try:
            result = await nautobot_service.rest_request(
                f"dcim/devices/{device_id}/",
                method="DELETE",
            )
        except Exception as exc:
            raise self._translate_exception(exc, f"Failed to delete device {device_id}")

        cache_service.delete(self._device_cache_key(device_id))
        cache_service.delete(self._device_details_cache_key(device_id))
        cache_service.delete(self._device_list_cache_key())
        return result

    async def _delete_ip_address(self, ip_id: str, device_id: str) -> Dict[str, Any]:
        try:
            result = await nautobot_service.rest_request(
                f"ipam/ip-addresses/{ip_id}/",
                method="DELETE",
            )
        except Exception as exc:
            raise self._translate_exception(exc, f"Failed to delete IP address {ip_id}")

        cache_service.delete(self._ip_address_cache_key(ip_id))
        cache_service.delete(self._device_cache_key(device_id))
        cache_service.delete(self._device_details_cache_key(device_id))
        cache_service.delete(self._device_list_cache_key())
        return result

    async def _update_device(
        self, device_id: str, payload: Dict[str, Any]
    ) -> Dict[str, Any]:
        try:
            updated_device = await nautobot_service.rest_request(
                f"dcim/devices/{device_id}/",
                method="PATCH",
                data=payload,
            )
        except Exception as exc:
            raise self._translate_exception(exc, f"Failed to update device {device_id}")

        if isinstance(updated_device, dict):
            cache_service.set(
                self._device_cache_key(device_id),
                updated_device,
                DEVICE_CACHE_TTL,
            )
            cache_service.set(
                self._device_details_cache_key(device_id),
                updated_device,
                DEVICE_CACHE_TTL,
            )
            cache_service.delete(self._device_list_cache_key())

        return updated_device

    async def _clear_device_name(self, device_id: str) -> Dict[str, Any]:
        """Clear the device name by setting it to an empty string."""
        logger.info("DEBUG: Clearing device name for device %s", device_id)
        payload = {"name": ""}

        try:
            updated_device = await nautobot_service.rest_request(
                f"dcim/devices/{device_id}/",
                method="PATCH",
                data=payload,
            )
        except Exception as exc:
            raise self._translate_exception(
                exc, f"Failed to clear device name for {device_id}"
            )

        # Update cache
        if isinstance(updated_device, dict):
            cache_service.set(
                self._device_cache_key(device_id),
                updated_device,
                DEVICE_CACHE_TTL,
            )
            cache_service.set(
                self._device_details_cache_key(device_id),
                updated_device,
                DEVICE_CACHE_TTL,
            )
            cache_service.delete(self._device_list_cache_key())

        logger.info("DEBUG: Successfully cleared device name for %s", device_id)
        return updated_device

    async def _clear_device_serial(self, device_id: str) -> Dict[str, Any]:
        """Clear the device serial number by setting it to an empty string."""
        logger.info("DEBUG: Clearing device serial number for device %s", device_id)
        payload = {"serial": ""}

        try:
            updated_device = await nautobot_service.rest_request(
                f"dcim/devices/{device_id}/",
                method="PATCH",
                data=payload,
            )
        except Exception as exc:
            raise self._translate_exception(
                exc, f"Failed to clear device serial number for {device_id}"
            )

        # Update cache
        if isinstance(updated_device, dict):
            cache_service.set(
                self._device_cache_key(device_id),
                updated_device,
                DEVICE_CACHE_TTL,
            )
            cache_service.set(
                self._device_details_cache_key(device_id),
                updated_device,
                DEVICE_CACHE_TTL,
            )
            cache_service.delete(self._device_list_cache_key())

        logger.info(
            "DEBUG: Successfully cleared device serial number for %s", device_id
        )
        return updated_device

    async def _get_offboarding_settings(self) -> Optional[Dict[str, Any]]:
        try:
            return settings_manager.get_device_offboarding_settings()
        except Exception as exc:
            logger.error("Failed to load offboarding settings: %s", str(exc))
            return None

    def _validate_offboarding_settings(
        self, settings: Optional[Dict[str, Any]], results: Dict[str, Any]
    ) -> bool:
        """Validate offboarding settings before processing."""
        logger.info("DEBUG: Validating offboarding settings")

        if not settings:
            error_msg = "No offboarding settings configured - cannot proceed with set-offboarding mode"
            results["errors"].append(error_msg)
            results["success"] = False
            logger.error("DEBUG: %s", error_msg)
            return False

        # Check if remove_all_custom_fields is set
        remove_all_fields = settings.get("remove_all_custom_fields", False)
        logger.info("DEBUG: remove_all_custom_fields = %s", remove_all_fields)

        # Check if clear_device_name is set
        clear_device_name = settings.get("clear_device_name", False)
        logger.info("DEBUG: clear_device_name = %s", clear_device_name)

        # Check if custom field settings exist
        custom_field_settings = settings.get("custom_field_settings") or {}
        logger.info("DEBUG: custom_field_settings = %s", custom_field_settings)

        # If remove_all_custom_fields is True or clear_device_name is True, we have valid actions
        if remove_all_fields or clear_device_name:
            logger.info(
                "DEBUG: remove_all_custom_fields=%s or clear_device_name=%s - validation passed",
                remove_all_fields,
                clear_device_name,
            )
            return True

        # If remove_all_custom_fields and clear_device_name are both False, we need some custom field settings
        if not custom_field_settings:
            error_msg = (
                "No custom field settings configured, remove_all_custom_fields is False, "
                "and clear_device_name is False - cannot proceed with set-offboarding mode"
            )
            results["errors"].append(error_msg)
            results["success"] = False
            logger.error("DEBUG: %s", error_msg)
            return False

        logger.info("DEBUG: Offboarding settings validation passed")
        return True

    @staticmethod
    def _normalize_integration_mode(mode: Optional[str]) -> str:
        """Convert integration mode aliases to canonical values."""
        logger.info("DEBUG: _normalize_integration_mode called with mode='%s'", mode)

        if not mode:
            logger.info("DEBUG: Mode is None/empty, defaulting to 'remove'")
            return "remove"

        normalized = mode.strip().lower()
        logger.info("DEBUG: Normalized input '%s' to '%s'", mode, normalized)

        if normalized == "remove":
            logger.info("DEBUG: Exact match for 'remove', returning 'remove'")
            return "remove"

        aliases = {
            "set-offboarding": "set-offboarding",
            "set offboarding": "set-offboarding",
            "set offboarding values": "set-offboarding",
        }
        result = aliases.get(normalized, "remove")
        logger.info("DEBUG: Alias lookup for '%s' returned '%s'", normalized, result)
        return result

    @staticmethod
    def _build_custom_field_payload(
        settings: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        if not settings:
            return None

        custom_fields: Dict[str, Any] = {}
        for name, value in settings.items():
            if value is None:
                custom_fields[name] = None
            elif isinstance(value, str) and value.lower() == "clear":
                custom_fields[name] = None
            else:
                custom_fields[name] = value

        if not custom_fields:
            return None

        return {"custom_fields": custom_fields}

    @staticmethod
    def _translate_exception(exc: Exception, context: str) -> HTTPException:
        message = str(exc)
        if "404" in message or "Not Found" in message:
            return HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{context}: Resource not found",
            )
        if "403" in message:
            return HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"{context}: Permission denied",
            )
        if "400" in message:
            return HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{context}: Invalid request",
            )
        return HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"{context}: {message}",
        )

    @staticmethod
    def _device_cache_key(device_id: str) -> str:
        return f"nautobot:devices:{device_id}"

    @staticmethod
    def _device_details_cache_key(device_id: str) -> str:
        return f"nautobot:device_details:{device_id}"

    @staticmethod
    def _device_list_cache_key() -> str:
        return "nautobot:devices:list:all"

    @staticmethod
    def _ip_address_cache_key(ip_id: str) -> str:
        return f"nautobot:ip_address:{ip_id}"


offboarding_service = OffboardingService()

__all__ = ["offboarding_service"]
