"""
Device synchronization operations service for CheckMK.

This module handles device creation and updates in CheckMK from Nautobot data.
"""

from __future__ import annotations
import json
import logging
from fastapi import HTTPException, status

from services.checkmk.config import config_service
from services.checkmk.folder import checkmk_folder_service
from utils.cmk_site_utils import get_device_site_from_normalized_data
from utils.cmk_folder_utils import normalize_folder_path
from models.nb2cmk import (
    DeviceOperationResult,
    DeviceUpdateResult,
    DefaultSiteResponse,
)

logger = logging.getLogger(__name__)


class DeviceSyncOperations:
    """Service for device synchronization operations with CheckMK."""

    def __init__(self, query_service):
        """Initialize operations service with query service dependency.

        Args:
            query_service: DeviceQueryService instance for retrieving device data
        """
        self.query_service = query_service

    async def add_device_to_checkmk(self, device_id: str) -> DeviceOperationResult:
        """Add a device from Nautobot to CheckMK using normalized config.

        Args:
            device_id: Nautobot device ID

        Returns:
            DeviceOperationResult with operation details

        Raises:
            HTTPException: If operation fails
        """
        try:
            # Get normalized config
            normalized_data = await self.query_service.get_device_normalized(device_id)

            # Get hostname from internal dict
            internal_data = normalized_data.get("internal", {})
            hostname = internal_data.get("hostname")

            if not hostname:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Device has no hostname configured",
                )

            # Extract necessary data for CheckMK host creation
            folder = normalized_data.get("folder", "/")
            attributes = normalized_data.get("attributes", {})

            # Get the device site for CheckMK client initialization
            device_site = get_device_site_from_normalized_data(normalized_data)
            logger.info("Using site '%s' for device %s", device_site, hostname)

            # Create host in CheckMK using site-aware client
            from services.checkmk.client_factory import get_checkmk_client
            from checkmk.client import CheckMKAPIError

            try:
                client = get_checkmk_client()

                # Log detailed information for debugging
                logger.info("Creating host with parameters:")
                logger.info("  hostname: %s", hostname)
                logger.info("  folder: %s", folder)
                logger.info("  site: %s", device_site)
                logger.info("  attributes: %s", attributes)

                # Ensure folder exists before creating host
                if folder and folder != "/":
                    logger.info(
                        "Ensuring folder '%s' exists before creating host", folder
                    )
                    folder_created = await checkmk_folder_service.create_path(
                        folder, device_site, {}
                    )
                    if not folder_created:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Cannot create or ensure folder path '{folder}' exists in CheckMK",
                        )
                    logger.info("Folder '%s' is ready", folder)

                # Convert folder path format: CheckMK uses ~ instead of /
                # First normalize double slashes, then convert / to ~
                normalized_folder = folder.replace("//", "/") if folder else "/"
                checkmk_folder = (
                    normalized_folder.replace("/", "~") if normalized_folder else "~"
                )
                logger.info(
                    "Converted folder path from '%s' to '%s' for CheckMK client",
                    folder,
                    checkmk_folder,
                )

                # Create host in CheckMK
                result = client.create_host(
                    hostname=hostname,
                    folder=checkmk_folder,
                    attributes=attributes,
                    bake_agent=False,
                )

                create_result = {
                    "success": True,
                    "message": f"Host {hostname} created successfully",
                    "data": result,
                }

                # Start service discovery with tabula_rasa mode to add services
                try:
                    logger.info(
                        "Starting service discovery (tabula_rasa) for host %s", hostname
                    )
                    discovery_result = client.start_service_discovery(
                        hostname, mode="tabula_rasa"
                    )
                    logger.info(
                        "Service discovery started for host %s: %s",
                        hostname,
                        discovery_result,
                    )
                    create_result["discovery"] = {
                        "started": True,
                        "mode": "tabula_rasa",
                        "result": discovery_result,
                    }
                except Exception as discovery_error:
                    # Log but don't fail the whole operation if discovery fails
                    logger.warning(
                        "Failed to start service discovery for host %s: %s",
                        hostname,
                        discovery_error,
                    )
                    create_result["discovery"] = {
                        "started": False,
                        "error": str(discovery_error),
                    }

            except CheckMKAPIError as e:
                logger.error("CheckMK API error creating host %s: %s", hostname, e)

                # Preserve CheckMK error details for better error reporting
                error_detail = {
                    "error": str(e),
                    "status_code": e.status_code,
                }

                # Include detailed error fields if available
                if e.response_data:
                    if "detail" in e.response_data:
                        error_detail["detail"] = e.response_data["detail"]
                    if "fields" in e.response_data:
                        error_detail["fields"] = e.response_data["fields"]
                    if "title" in e.response_data:
                        error_detail["title"] = e.response_data["title"]

                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=json.dumps(error_detail),
                )

            logger.info(
                "Successfully added device %s (%s) to CheckMK", device_id, hostname
            )

            return DeviceOperationResult(
                success=True,
                message=f"Device {hostname} successfully added to CheckMK site '{device_site}'",
                device_id=device_id,
                hostname=hostname,
                site=device_site,
                folder=folder,
                checkmk_response=create_result,
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error adding device %s to CheckMK: %s", device_id, e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to add device {device_id} to CheckMK: {e}",
            )

    async def update_device_in_checkmk(self, device_id: str) -> DeviceUpdateResult:
        """Update/sync a device from Nautobot to CheckMK using normalized config.

        Args:
            device_id: Nautobot device ID

        Returns:
            DeviceUpdateResult with operation details

        Raises:
            HTTPException: If operation fails
        """
        try:
            # Get normalized config
            normalized_data = await self.query_service.get_device_normalized(device_id)

            # Get hostname from internal dict
            internal_data = normalized_data.get("internal", {})
            hostname = internal_data.get("hostname")

            if not hostname:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Device has no hostname configured",
                )

            # Extract necessary data for CheckMK host update
            new_folder = normalized_data.get("folder", "/")
            new_attributes = normalized_data.get("attributes", {})

            # Get the device site for CheckMK client initialization
            device_site = get_device_site_from_normalized_data(normalized_data)
            logger.info("Using site '%s' for device %s update", device_site, hostname)

            # Get current CheckMK host config to compare folder
            from services.checkmk.client_factory import get_checkmk_client
            from checkmk.client import CheckMKAPIError

            try:
                # Create CheckMK client with device-specific site
                client = get_checkmk_client()

                # Get current host data
                checkmk_data = client.get_host(hostname)

                # The folder is in extensions.folder
                extensions = checkmk_data.get("extensions", {})
                current_folder = extensions.get("folder", "/")

            except CheckMKAPIError as e:
                if "404" in str(e) or "not found" in str(e).lower():
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Host '{hostname}' not found in CheckMK site '{device_site}' - cannot update non-existent host",
                    )
                else:
                    logger.error("CheckMK API error getting host %s: %s", hostname, e)
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"CheckMK API error: {e}",
                    )

            # Normalize folder paths for comparison
            current_folder_normalized = normalize_folder_path(current_folder)
            new_folder_normalized = normalize_folder_path(new_folder)

            # Check if folder has changed
            folder_changed = current_folder_normalized != new_folder_normalized

            if folder_changed:
                # Ensure the new folder path exists
                path_created = await checkmk_folder_service.create_path(
                    new_folder_normalized, device_site, {}
                )

                if not path_created:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Cannot create or ensure folder path '{new_folder_normalized}' exists in CheckMK",
                    )

                # Convert folder path format: CheckMK uses ~ instead of /
                # First normalize double slashes, then convert / to ~
                normalized_new_folder = (
                    new_folder_normalized.replace("//", "/")
                    if new_folder_normalized
                    else "/"
                )
                checkmk_new_folder = (
                    normalized_new_folder.replace("/", "~")
                    if normalized_new_folder
                    else "~"
                )
                logger.info(
                    "Converted new folder path from '%s' to '%s' for CheckMK client",
                    new_folder_normalized,
                    checkmk_new_folder,
                )

                # Move the host to the new folder
                try:
                    client.move_host(hostname, checkmk_new_folder)
                    logger.info(
                        "Moved host %s from %s to %s",
                        hostname,
                        current_folder_normalized,
                        new_folder_normalized,
                    )
                except CheckMKAPIError as e:
                    if "428" in str(e) or "precondition" in str(e).lower():
                        raise HTTPException(
                            status_code=status.HTTP_428_PRECONDITION_REQUIRED,
                            detail=f"Cannot move host '{hostname}' - CheckMK changes may need to be activated first. Please activate pending changes in CheckMK and try again.",
                        )
                    else:
                        logger.error(
                            "CheckMK API error moving host %s: %s", hostname, e
                        )
                        raise HTTPException(
                            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"CheckMK API error moving host: {e}",
                        )

            # Update host attributes
            try:
                update_result = client.update_host(hostname, new_attributes)
                logger.info("Updated host %s attributes", hostname)
            except CheckMKAPIError as e:
                logger.error("CheckMK API error updating host %s: %s", hostname, e)

                # Preserve CheckMK error details for better error reporting
                error_detail = {
                    "error": str(e),
                    "status_code": e.status_code,
                }

                # Include detailed error fields if available
                if e.response_data:
                    if "detail" in e.response_data:
                        error_detail["detail"] = e.response_data["detail"]
                    if "fields" in e.response_data:
                        error_detail["fields"] = e.response_data["fields"]
                    if "title" in e.response_data:
                        error_detail["title"] = e.response_data["title"]

                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=json.dumps(error_detail),
                )

            logger.info(
                "Successfully updated device %s (%s) in CheckMK", device_id, hostname
            )

            return DeviceUpdateResult(
                success=True,
                message=f"Device {hostname} successfully updated in CheckMK site '{device_site}'",
                device_id=device_id,
                hostname=hostname,
                site=device_site,
                folder=new_folder,
                folder_changed=folder_changed,
                checkmk_response=update_result,
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error("Error updating device %s in CheckMK: %s", device_id, e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update device {device_id} in CheckMK: {e}",
            )

    def get_default_site(self) -> DefaultSiteResponse:
        """Get the default site from CheckMK configuration.

        Returns:
            DefaultSiteResponse with default site name
        """
        default_site = config_service.get_default_site()
        return DefaultSiteResponse(default_site=default_site)
