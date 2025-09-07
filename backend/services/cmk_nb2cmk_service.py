"""
Main service for Nautobot to CheckMK device synchronization operations.
"""

from __future__ import annotations
import logging
from typing import Dict, Any, List
from fastapi import HTTPException, status

from services.cmk_config_service import config_service
from services.cmk_device_normalization_service import device_normalization_service
from services.cmk_folder_service import checkmk_folder_service
from utils.cmk_site_utils import get_device_site_from_normalized_data
from utils.cmk_folder_utils import normalize_folder_path
from models.nb2cmk import (
    DeviceList,
    DeviceListWithStatus,
    DeviceComparison,
    DeviceOperationResult,
    DeviceUpdateResult,
    DefaultSiteResponse,
)

logger = logging.getLogger(__name__)


class NautobotToCheckMKService:
    """Main service for Nautobot to CheckMK device synchronization."""

    async def get_devices_for_sync(self) -> DeviceList:
        """Get all devices from Nautobot for CheckMK sync.
        
        Returns:
            DeviceList with device data
            
        Raises:
            HTTPException: If GraphQL query fails or other errors occur
        """
        try:
            from services.nautobot import nautobot_service

            # Use GraphQL query to get all devices from Nautobot
            query = """
            query all_devices {
              devices {
                id
                name
                role {
                  name
                }
                location {
                  name
                }
                status {
                  name
                }
              }
            }
            """

            result = await nautobot_service.graphql_query(query, {})
            if "errors" in result:
                logger.error(f"GraphQL errors: {result['errors']}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"GraphQL errors: {result['errors']}",
                )

            nautobot_devices = result["data"]["devices"]

            # Transform the data to match frontend expectations
            devices = []
            for device in nautobot_devices:
                devices.append({
                    "id": str(device.get("id", "")),
                    "name": device.get("name", ""),
                    "role": device.get("role", {}).get("name", "") if device.get("role") else "",
                    "status": device.get("status", {}).get("name", "") if device.get("status") else "",
                    "location": device.get("location", {}).get("name", "") if device.get("location") else "",
                })

            return DeviceList(
                devices=devices,
                total=len(devices),
                message=f"Retrieved {len(devices)} devices from Nautobot"
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting devices for CheckMK sync: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get devices for CheckMK sync: {e}",
            )

    async def get_device_normalized(self, device_id: str) -> Dict[str, Any]:
        """Get normalized device config from Nautobot for CheckMK comparison.
        
        Args:
            device_id: Nautobot device ID
            
        Returns:
            Normalized device configuration dictionary
            
        Raises:
            HTTPException: If device not found or normalization fails
        """
        try:
            from services.nautobot import nautobot_service

            # Fetch device data from Nautobot including custom fields
            query = """
            query getDevice($deviceId: ID!) {
              device(id: $deviceId) {
                id
                name
                primary_ip4 {
                  address
                }
                location {
                  name
                }
                role {
                  name
                }
                platform {
                  name
                }
                status {
                  name
                }
                _custom_field_data
                tags {
                  name
                }
              }
            }
            """
            variables = {"deviceId": device_id}
            result = await nautobot_service.graphql_query(query, variables)

            if "errors" in result:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"GraphQL errors: {result['errors']}",
                )

            device_data = result["data"]["device"]

            if not device_data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Device with ID {device_id} not found",
                )

            # Normalize the device data
            extensions = device_normalization_service.normalize_device(device_data)
            
            # Convert to dictionary for API response
            return extensions.model_dump()

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting normalized device config for {device_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get normalized device config: {e}",
            )

    async def get_devices_diff(self) -> DeviceListWithStatus:
        """Get all devices from Nautobot with CheckMK comparison status.
        
        Returns:
            DeviceListWithStatus with comparison information
            
        Raises:
            HTTPException: If operation fails
        """
        try:
            from services.nautobot import nautobot_service

            # Use GraphQL query to get all devices from Nautobot
            query = """
            query all_devices {
              devices {
                id
                name
                role {
                  name
                }
                location {
                  name
                }
                status {
                  name
                }
              }
            }
            """

            result = await nautobot_service.graphql_query(query, {})
            if "errors" in result:
                logger.error(f"GraphQL errors: {result['errors']}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"GraphQL errors: {result['errors']}",
                )

            nautobot_devices = result["data"]["devices"]

            # Process each device and get comparison status
            devices_with_status = []
            for device in nautobot_devices:
                device_info = {
                    "id": str(device.get("id", "")),
                    "name": device.get("name", ""),
                    "role": device.get("role", {}).get("name", "") if device.get("role") else "",
                    "status": device.get("status", {}).get("name", "") if device.get("status") else "",
                    "location": device.get("location", {}).get("name", "") if device.get("location") else "",
                    "checkmk_status": "unknown",
                }

                # Try to get comparison status for this device
                try:
                    device_id = str(device.get("id", ""))
                    if device_id:
                        comparison_result = await self.compare_device_config(device_id)
                        device_info["checkmk_status"] = comparison_result.result
                        device_info["diff"] = comparison_result.diff
                        device_info["normalized_config"] = comparison_result.normalized_config
                        device_info["checkmk_config"] = comparison_result.checkmk_config

                        # Map host_not_found to missing for frontend consistency
                        if device_info["checkmk_status"] == "host_not_found":
                            device_info["checkmk_status"] = "missing"
                    else:
                        device_info["checkmk_status"] = "error"
                except HTTPException as http_exc:
                    if http_exc.status_code == 404:
                        logger.info(f"Device {device.get('name', 'unknown')} not found in CheckMK")
                        device_info["checkmk_status"] = "missing"
                        device_info["diff"] = f"Host '{device.get('name', 'unknown')}' not found in CheckMK"
                        device_info["normalized_config"] = {}
                        device_info["checkmk_config"] = None
                    else:
                        logger.warning(f"HTTP error comparing device {device.get('name', 'unknown')}: {http_exc}")
                        device_info["checkmk_status"] = "error"
                except Exception as e:
                    logger.warning(f"Error comparing device {device.get('name', 'unknown')}: {e}")
                    device_info["checkmk_status"] = "error"

                devices_with_status.append(device_info)

            return DeviceListWithStatus(
                devices=devices_with_status,
                total=len(devices_with_status),
                message=f"Retrieved {len(devices_with_status)} devices with CheckMK comparison status"
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error getting devices diff: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get devices diff: {e}",
            )

    async def compare_device_config(self, device_id: str) -> DeviceComparison:
        """Compare normalized Nautobot device config with CheckMK host config.
        
        Args:
            device_id: Nautobot device ID
            
        Returns:
            DeviceComparison with comparison results
            
        Raises:
            HTTPException: If comparison fails
        """
        try:
            # Get normalized config
            normalized_config = await self.get_device_normalized(device_id)

            # Get hostname from internal dict
            internal_data = normalized_config.get("internal", {})
            hostname = internal_data.get("hostname")

            if not hostname:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Device has no hostname configured",
                )

            # Get CheckMK host config using internal API
            try:
                from routers.checkmk import get_host

                # Create admin user context for CheckMK call
                admin_user = {"permissions": 15}  # Admin permissions

                # Call internal CheckMK API to get host data
                try:
                    checkmk_response = await get_host(hostname, False, admin_user)
                    # Extract the actual data from the CheckMKOperationResponse
                    checkmk_data = (
                        checkmk_response.data
                        if hasattr(checkmk_response, "data")
                        else checkmk_response
                    )
                except HTTPException as e:
                    if e.status_code == 404:
                        logger.info(f"Host '{hostname}' not found in CheckMK during comparison")
                        return DeviceComparison(
                            result="host_not_found",
                            diff=f"Host '{hostname}' not found in CheckMK",
                            normalized_config=normalized_config,
                            checkmk_config=None
                        )
                    else:
                        logger.error(f"CheckMK API error for host {hostname}: {e.detail}")
                        raise HTTPException(
                            status_code=e.status_code,
                            detail=f"CheckMK API error for host {hostname}: {e.detail}",
                        )

            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Error getting CheckMK host data for {hostname}: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to get CheckMK host data: {e}",
                )

            # Extract attributes from CheckMK data
            checkmk_extensions = checkmk_data.get("extensions", {})

            # Remove meta_data key from CheckMK config before comparison
            if "meta_data" in checkmk_extensions.get("attributes", {}):
                del checkmk_extensions["attributes"]["meta_data"]

            # Create clean copies for comparison (remove internal dicts)
            nb_config_for_comparison = {
                k: v for k, v in normalized_config.items() if k != "internal"
            }
            cmk_config_for_comparison = {
                k: v for k, v in checkmk_extensions.items() if k != "internal"
            }

            # Compare the configurations
            differences = self._compare_configurations(nb_config_for_comparison, cmk_config_for_comparison)

            # Determine result
            if differences:
                result = "diff"
                diff_text = "; ".join(differences)
            else:
                result = "equal"
                diff_text = ""

            return DeviceComparison(
                result=result,
                diff=diff_text,
                normalized_config=nb_config_for_comparison,
                checkmk_config=cmk_config_for_comparison
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error comparing device configs for {device_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to compare device configs: {e}",
            )

    def _compare_configurations(self, nb_config: Dict[str, Any], cmk_config: Dict[str, Any]) -> List[str]:
        """Compare Nautobot and CheckMK configurations and return differences.
        
        Args:
            nb_config: Normalized Nautobot configuration
            cmk_config: CheckMK configuration
            
        Returns:
            List of difference descriptions
        """
        differences = []
        compare_keys = config_service.get_comparison_keys()
        ignore_attributes = config_service.get_ignore_attributes()

        for compare_key in compare_keys:
            if compare_key == "attributes":
                # Special handling for attributes (compare nested values)
                nb_attributes = nb_config.get("attributes", {})
                cmk_attributes = cmk_config.get("attributes", {})

                # Filter out ignored attributes
                nb_attributes_filtered = {
                    k: v for k, v in nb_attributes.items() if k not in ignore_attributes
                }
                cmk_attributes_filtered = {
                    k: v for k, v in cmk_attributes.items() if k not in ignore_attributes
                }

                # Compare attributes (only non-ignored ones)
                for key, nb_value in nb_attributes_filtered.items():
                    if key in cmk_attributes_filtered:
                        cmk_value = cmk_attributes_filtered[key]
                        if nb_value != cmk_value:
                            differences.append(
                                f"attributes.'{key}': Nautobot='{nb_value}' vs CheckMK='{cmk_value}'"
                            )
                    else:
                        differences.append(
                            f"attributes.'{key}': Present in Nautobot ('{nb_value}') but missing in CheckMK"
                        )

                # Check for attributes in CheckMK that are not in normalized config (only non-ignored ones)
                for key, cmk_value in cmk_attributes_filtered.items():
                    if key not in nb_attributes_filtered:
                        differences.append(
                            f"attributes.'{key}': Present in CheckMK ('{cmk_value}') but missing in Nautobot"
                        )

            else:
                # Direct comparison for other keys (like folder)
                nb_value = nb_config.get(compare_key)
                cmk_value = cmk_config.get(compare_key)

                if nb_value != cmk_value:
                    differences.append(
                        f"'{compare_key}': Nautobot='{nb_value}' vs CheckMK='{cmk_value}'"
                    )

        return differences

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
            normalized_data = await self.get_device_normalized(device_id)

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
            logger.info(f"Using site '{device_site}' for device {hostname}")

            # Create host in CheckMK using site-aware client
            from routers.checkmk import _get_checkmk_client
            from checkmk.client import CheckMKAPIError

            try:
                # Create CheckMK client with device-specific site
                client = _get_checkmk_client(site_name=device_site)

                # Log detailed information for debugging
                logger.info("Creating host with parameters:")
                logger.info(f"  hostname: {hostname}")
                logger.info(f"  folder: {folder}")
                logger.info(f"  site: {device_site}")
                logger.info(f"  attributes: {attributes}")

                # Ensure folder exists before creating host
                if folder and folder != "/":
                    logger.info(f"Ensuring folder '{folder}' exists before creating host")
                    folder_created = await checkmk_folder_service.create_path(
                        folder, device_site, {}
                    )
                    if not folder_created:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Cannot create or ensure folder path '{folder}' exists in CheckMK",
                        )
                    logger.info(f"Folder '{folder}' is ready")

                # Create host in CheckMK
                result = client.create_host(
                    hostname=hostname,
                    folder=folder,
                    attributes=attributes,
                    bake_agent=False,
                )

                create_result = {
                    "success": True,
                    "message": f"Host {hostname} created successfully",
                    "data": result,
                }

            except CheckMKAPIError as e:
                logger.error(f"CheckMK API error creating host {hostname}: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"CheckMK API error: {e}",
                )

            logger.info(f"Successfully added device {device_id} ({hostname}) to CheckMK")

            return DeviceOperationResult(
                success=True,
                message=f"Device {hostname} successfully added to CheckMK site '{device_site}'",
                device_id=device_id,
                hostname=hostname,
                site=device_site,
                folder=folder,
                checkmk_response=create_result
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error adding device {device_id} to CheckMK: {e}")
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
            normalized_data = await self.get_device_normalized(device_id)

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
            logger.info(f"Using site '{device_site}' for device {hostname} update")

            # Get current CheckMK host config to compare folder
            from routers.checkmk import _get_checkmk_client
            from checkmk.client import CheckMKAPIError

            try:
                # Create CheckMK client with device-specific site
                client = _get_checkmk_client(site_name=device_site)

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
                    logger.error(f"CheckMK API error getting host {hostname}: {e}")
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

                # Move the host to the new folder
                try:
                    client.move_host(hostname, new_folder_normalized)
                    logger.info(f"Moved host {hostname} from {current_folder_normalized} to {new_folder_normalized}")
                except CheckMKAPIError as e:
                    if "428" in str(e) or "precondition" in str(e).lower():
                        raise HTTPException(
                            status_code=status.HTTP_428_PRECONDITION_REQUIRED,
                            detail=f"Cannot move host '{hostname}' - CheckMK changes may need to be activated first. Please activate pending changes in CheckMK and try again.",
                        )
                    else:
                        logger.error(f"CheckMK API error moving host {hostname}: {e}")
                        raise HTTPException(
                            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail=f"CheckMK API error moving host: {e}",
                        )

            # Update host attributes
            try:
                update_result = client.update_host(hostname, new_attributes)
                logger.info(f"Updated host {hostname} attributes")
            except CheckMKAPIError as e:
                logger.error(f"CheckMK API error updating host {hostname}: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"CheckMK API error updating host: {e}",
                )

            logger.info(f"Successfully updated device {device_id} ({hostname}) in CheckMK")

            return DeviceUpdateResult(
                success=True,
                message=f"Device {hostname} successfully updated in CheckMK site '{device_site}'",
                device_id=device_id,
                hostname=hostname,
                site=device_site,
                folder=new_folder,
                folder_changed=folder_changed,
                checkmk_response=update_result
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error updating device {device_id} in CheckMK: {e}")
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


# Global instance for dependency injection
nb2cmk_service = NautobotToCheckMKService()
