"""
Main service for Nautobot to CheckMK device synchronization operations.
"""

from __future__ import annotations
import json
import logging
from typing import Dict, Any, List
from fastapi import HTTPException, status

from services.checkmk.config import config_service
from services.checkmk.normalization import device_normalization_service
from services.checkmk.folder import checkmk_folder_service
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
                devices.append(
                    {
                        "id": str(device.get("id", "")),
                        "name": device.get("name", ""),
                        "role": device.get("role", {}).get("name", "")
                        if device.get("role")
                        else "",
                        "status": device.get("status", {}).get("name", "")
                        if device.get("status")
                        else "",
                        "location": device.get("location", {}).get("name", "")
                        if device.get("location")
                        else "",
                    }
                )

            return DeviceList(
                devices=devices,
                total=len(devices),
                message=f"Retrieved {len(devices)} devices from Nautobot",
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
            # Load query from configuration file
            query = config_service.get_query("get_device_normalized")
            if not query:
                # Fallback to default query if not found in config
                logger.warning(
                    "Query 'get_device_normalized' not found in config, using fallback query"
                )
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
                      parent {
                        name
                      }
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
            normalized_dict = extensions.model_dump()

            # DEBUG: Log normalized device config for test fixture creation
            logger.debug(f"[NORMALIZE] Device {device_id} normalized config:")
            logger.debug(f"[NORMALIZE] Config keys: {list(normalized_dict.keys())}")
            logger.debug(f"[NORMALIZE] Full normalized config: {normalized_dict}")

            return normalized_dict

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
                    "role": device.get("role", {}).get("name", "")
                    if device.get("role")
                    else "",
                    "status": device.get("status", {}).get("name", "")
                    if device.get("status")
                    else "",
                    "location": device.get("location", {}).get("name", "")
                    if device.get("location")
                    else "",
                    "checkmk_status": "unknown",
                }

                # Try to get comparison status for this device
                try:
                    device_id = str(device.get("id", ""))
                    if device_id:
                        comparison_result = await self.compare_device_config(device_id)
                        device_info["checkmk_status"] = comparison_result.result
                        device_info["diff"] = comparison_result.diff
                        device_info["normalized_config"] = (
                            comparison_result.normalized_config
                        )
                        device_info["checkmk_config"] = comparison_result.checkmk_config

                        # Map host_not_found to missing for frontend consistency
                        if device_info["checkmk_status"] == "host_not_found":
                            device_info["checkmk_status"] = "missing"
                    else:
                        device_info["checkmk_status"] = "error"
                except HTTPException as http_exc:
                    if http_exc.status_code == 404:
                        logger.info(
                            f"Device {device.get('name', 'unknown')} not found in CheckMK"
                        )
                        device_info["checkmk_status"] = "missing"
                        device_info["diff"] = (
                            f"Host '{device.get('name', 'unknown')}' not found in CheckMK"
                        )
                        device_info["normalized_config"] = {}
                        device_info["checkmk_config"] = None
                    else:
                        logger.warning(
                            f"HTTP error comparing device {device.get('name', 'unknown')}: {http_exc}"
                        )
                        device_info["checkmk_status"] = "error"
                except Exception as e:
                    logger.warning(
                        f"Error comparing device {device.get('name', 'unknown')}: {e}"
                    )
                    device_info["checkmk_status"] = "error"

                devices_with_status.append(device_info)

            return DeviceListWithStatus(
                devices=devices_with_status,
                total=len(devices_with_status),
                ignored_attributes=config_service.get_ignore_attributes(),
                message=f"Retrieved {len(devices_with_status)} devices with CheckMK comparison status",
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
            logger.info(f"[COMPARE] Starting comparison for device ID: {device_id}")
            try:
                normalized_config = await self.get_device_normalized(device_id)
                logger.debug(
                    f"[COMPARE] Successfully retrieved normalized config for device {device_id}"
                )
            except Exception as norm_error:
                error_msg = f"Failed to normalize device config for device {device_id}: {str(norm_error)}"
                logger.error(f"[COMPARE ERROR] {error_msg}", exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=error_msg,
                )

            # Get hostname from internal dict
            internal_data = normalized_config.get("internal", {})
            hostname = internal_data.get("hostname")

            if not hostname:
                error_msg = (
                    f"Device {device_id} has no hostname configured in normalized data"
                )
                logger.error(
                    f"[COMPARE ERROR] {error_msg}. Internal data: {internal_data}"
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Device has no hostname configured",
                )

            logger.info(f"[COMPARE] Comparing device: {hostname} (ID: {device_id})")

            # Get CheckMK host config using internal API
            try:
                from routers.checkmk import get_host

                # Create admin user context for CheckMK call
                admin_user = {"permissions": 15}  # Admin permissions

                # Call internal CheckMK API to get host data
                try:
                    logger.debug(
                        f"[COMPARE] Fetching CheckMK data for host: {hostname}"
                    )
                    checkmk_response = await get_host(hostname, False, admin_user)
                    # Extract the actual data from the CheckMKOperationResponse
                    checkmk_data = (
                        checkmk_response.data
                        if hasattr(checkmk_response, "data")
                        else checkmk_response
                    )
                    logger.debug(
                        f"[COMPARE] Successfully retrieved CheckMK data for {hostname}"
                    )
                except HTTPException as e:
                    if e.status_code == 404:
                        logger.info(
                            f"[COMPARE] Host '{hostname}' not found in CheckMK during comparison"
                        )
                        return DeviceComparison(
                            result="host_not_found",
                            diff=f"Host '{hostname}' not found in CheckMK",
                            normalized_config=normalized_config,
                            checkmk_config=None,
                        )
                    else:
                        error_msg = f"CheckMK API error for host {hostname}: {e.detail}"
                        logger.error(f"[COMPARE ERROR] {error_msg}")
                        raise HTTPException(
                            status_code=e.status_code,
                            detail=error_msg,
                        )

            except HTTPException:
                raise
            except Exception as e:
                error_msg = f"Unexpected error getting CheckMK host data for {hostname}: {str(e)}"
                logger.error(f"[COMPARE ERROR] {error_msg}", exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=error_msg,
                )

            # Extract attributes from CheckMK data
            try:
                checkmk_extensions = checkmk_data.get("extensions", {})
                logger.debug(
                    f"[COMPARE] CheckMK extensions keys for {hostname}: {list(checkmk_extensions.keys())}"
                )

                # Remove meta_data key from CheckMK config before comparison
                if "meta_data" in checkmk_extensions.get("attributes", {}):
                    del checkmk_extensions["attributes"]["meta_data"]
                    logger.debug(
                        f"[COMPARE] Removed meta_data from CheckMK attributes for {hostname}"
                    )

                # Create clean copies for comparison (remove internal dicts)
                nb_config_for_comparison = {
                    k: v for k, v in normalized_config.items() if k != "internal"
                }
                cmk_config_for_comparison = {
                    k: v for k, v in checkmk_extensions.items() if k != "internal"
                }

                logger.debug(
                    f"[COMPARE] Nautobot config keys for {hostname}: {list(nb_config_for_comparison.keys())}"
                )
                logger.debug(
                    f"[COMPARE] CheckMK config keys for {hostname}: {list(cmk_config_for_comparison.keys())}"
                )

                # Compare the configurations
                logger.info(
                    f"[COMPARE] Starting configuration comparison for {hostname}"
                )
                differences = self._compare_configurations(
                    nb_config_for_comparison, cmk_config_for_comparison
                )
                logger.info(
                    f"[COMPARE] Found {len(differences)} difference(s) for {hostname}"
                )

            except Exception as e:
                error_msg = f"Error processing configurations for comparison of {hostname}: {str(e)}"
                logger.error(f"[COMPARE ERROR] {error_msg}", exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=error_msg,
                )

            # Determine result
            if differences:
                result = "diff"
                diff_text = "; ".join(differences)
            else:
                result = "equal"
                diff_text = ""

            # Include internal section in the response for UI display purposes
            # The comparison was done without it, but we need it for device metadata
            nb_config_with_internal = nb_config_for_comparison.copy()
            if "internal" in normalized_config:
                nb_config_with_internal["internal"] = normalized_config["internal"]

            return DeviceComparison(
                result=result,
                diff=diff_text,
                normalized_config=nb_config_with_internal,
                checkmk_config=cmk_config_for_comparison,
                ignored_attributes=config_service.get_ignore_attributes(),
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error comparing device configs for {device_id}: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to compare device configs: {e}",
            )

    def _compare_configurations(
        self, nb_config: Dict[str, Any], cmk_config: Dict[str, Any]
    ) -> List[str]:
        """Compare Nautobot and CheckMK configurations and return differences.

        Args:
            nb_config: Normalized Nautobot configuration
            cmk_config: CheckMK configuration

        Returns:
            List of difference descriptions
        """
        differences = []

        try:
            compare_keys = config_service.get_comparison_keys()
            ignore_attributes = config_service.get_ignore_attributes()
            logger.debug(f"[COMPARE] Comparison keys: {compare_keys}")
            logger.debug(f"[COMPARE] Ignore attributes: {ignore_attributes}")
        except Exception as e:
            error_msg = f"Failed to load comparison configuration: {str(e)}"
            logger.error(f"[COMPARE ERROR] {error_msg}", exc_info=True)
            raise ValueError(error_msg)

        for compare_key in compare_keys:
            try:
                if compare_key == "attributes":
                    # Special handling for attributes (compare nested values)
                    nb_attributes = nb_config.get("attributes", {})
                    cmk_attributes = cmk_config.get("attributes", {})

                    logger.debug(
                        f"[COMPARE] Nautobot attributes before filtering: {list(nb_attributes.keys())}"
                    )
                    logger.debug(
                        f"[COMPARE] CheckMK attributes before filtering: {list(cmk_attributes.keys())}"
                    )

                    # Validate that attributes are dictionaries
                    if not isinstance(nb_attributes, dict):
                        error_msg = f"Nautobot attributes is not a dictionary: {type(nb_attributes)}"
                        logger.error(f"[COMPARE ERROR] {error_msg}")
                        raise ValueError(error_msg)

                    if not isinstance(cmk_attributes, dict):
                        error_msg = f"CheckMK attributes is not a dictionary: {type(cmk_attributes)}"
                        logger.error(f"[COMPARE ERROR] {error_msg}")
                        raise ValueError(error_msg)

                    # Filter out ignored attributes
                    try:
                        nb_attributes_filtered = {
                            k: v
                            for k, v in nb_attributes.items()
                            if k not in ignore_attributes
                        }
                        cmk_attributes_filtered = {
                            k: v
                            for k, v in cmk_attributes.items()
                            if k not in ignore_attributes
                        }
                        logger.debug(
                            f"[COMPARE] Nautobot attributes after filtering: {list(nb_attributes_filtered.keys())}"
                        )
                        logger.debug(
                            f"[COMPARE] CheckMK attributes after filtering: {list(cmk_attributes_filtered.keys())}"
                        )
                    except Exception as filter_error:
                        error_msg = f"Error filtering attributes: {str(filter_error)}"
                        logger.error(f"[COMPARE ERROR] {error_msg}", exc_info=True)
                        raise ValueError(error_msg)

                    # Debug logging for filtered attributes
                    nb_filtered_out = {
                        k: v for k, v in nb_attributes.items() if k in ignore_attributes
                    }
                    cmk_filtered_out = {
                        k: v
                        for k, v in cmk_attributes.items()
                        if k in ignore_attributes
                    }

                    if nb_filtered_out:
                        logger.debug(
                            f"[COMPARE] Nautobot attributes filtered out: {nb_filtered_out}"
                        )
                    if cmk_filtered_out:
                        logger.debug(
                            f"[COMPARE] CheckMK attributes filtered out: {cmk_filtered_out}"
                        )

                    # Compare attributes (only non-ignored ones)
                    try:
                        for key, nb_value in nb_attributes_filtered.items():
                            if key in cmk_attributes_filtered:
                                cmk_value = cmk_attributes_filtered[key]
                                if nb_value != cmk_value:
                                    logger.debug(
                                        f"[COMPARE] Attribute '{key}' differs: Nautobot='{nb_value}' vs CheckMK='{cmk_value}'"
                                    )
                                    differences.append(
                                        f"attributes.'{key}': Nautobot='{nb_value}' vs CheckMK='{cmk_value}'"
                                    )
                            else:
                                logger.debug(
                                    f"[COMPARE] Attribute '{key}' present in Nautobot but missing in CheckMK"
                                )
                                differences.append(
                                    f"attributes.'{key}': Present in Nautobot ('{nb_value}') but missing in CheckMK"
                                )

                        # Check for attributes in CheckMK that are not in normalized config (only non-ignored ones)
                        for key, cmk_value in cmk_attributes_filtered.items():
                            if key not in nb_attributes_filtered:
                                logger.debug(
                                    f"[COMPARE] Attribute '{key}' present in CheckMK but missing in Nautobot"
                                )
                                differences.append(
                                    f"attributes.'{key}': Present in CheckMK ('{cmk_value}') but missing in Nautobot"
                                )
                    except Exception as attr_compare_error:
                        error_msg = (
                            f"Error comparing attributes: {str(attr_compare_error)}"
                        )
                        logger.error(f"[COMPARE ERROR] {error_msg}", exc_info=True)
                        raise ValueError(error_msg)

                else:
                    # Direct comparison for other keys (like folder)
                    try:
                        nb_value = nb_config.get(compare_key)
                        cmk_value = cmk_config.get(compare_key)

                        if nb_value != cmk_value:
                            logger.debug(
                                f"[COMPARE] Key '{compare_key}' differs: Nautobot='{nb_value}' vs CheckMK='{cmk_value}'"
                            )
                            differences.append(
                                f"'{compare_key}': Nautobot='{nb_value}' vs CheckMK='{cmk_value}'"
                            )
                    except Exception as key_compare_error:
                        error_msg = f"Error comparing key '{compare_key}': {str(key_compare_error)}"
                        logger.error(f"[COMPARE ERROR] {error_msg}", exc_info=True)
                        raise ValueError(error_msg)

            except Exception as compare_key_error:
                error_msg = f"Error processing comparison key '{compare_key}': {str(compare_key_error)}"
                logger.error(f"[COMPARE ERROR] {error_msg}", exc_info=True)
                # Add to differences instead of failing entirely
                differences.append(
                    f"ERROR comparing '{compare_key}': {str(compare_key_error)}"
                )

        return differences

    @staticmethod
    def filter_diff_by_ignored_attributes(
        diff_text: str, ignored_attributes: List[str]
    ) -> str:
        """Filter diff text to remove differences related to ignored attributes.

        Args:
            diff_text: The raw diff text with all differences
            ignored_attributes: List of attribute names to ignore

        Returns:
            Filtered diff text with ignored attributes removed
        """
        if not diff_text or not ignored_attributes:
            return diff_text

        # Split diff into individual difference items (separated by "; ")
        differences = diff_text.split("; ")

        # Filter out differences that mention ignored attributes
        filtered_differences = []
        for diff in differences:
            # Check if this difference is about an ignored attribute
            # Format: "attributes.'attribute_name': ..."
            is_ignored = False
            for ignored_attr in ignored_attributes:
                if f"attributes.'{ignored_attr}':" in diff:
                    is_ignored = True
                    logger.debug(f"Filtering out ignored attribute: {diff}")
                    break

            if not is_ignored:
                filtered_differences.append(diff)

        # Rejoin the filtered differences
        return "; ".join(filtered_differences)

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
                client = _get_checkmk_client()

                # Log detailed information for debugging
                logger.info("Creating host with parameters:")
                logger.info(f"  hostname: {hostname}")
                logger.info(f"  folder: {folder}")
                logger.info(f"  site: {device_site}")
                logger.info(f"  attributes: {attributes}")

                # Ensure folder exists before creating host
                if folder and folder != "/":
                    logger.info(
                        f"Ensuring folder '{folder}' exists before creating host"
                    )
                    folder_created = await checkmk_folder_service.create_path(
                        folder, device_site, {}
                    )
                    if not folder_created:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Cannot create or ensure folder path '{folder}' exists in CheckMK",
                        )
                    logger.info(f"Folder '{folder}' is ready")

                # Convert folder path format: CheckMK uses ~ instead of /
                # First normalize double slashes, then convert / to ~
                normalized_folder = folder.replace("//", "/") if folder else "/"
                checkmk_folder = (
                    normalized_folder.replace("/", "~") if normalized_folder else "~"
                )
                logger.info(
                    f"Converted folder path from '{folder}' to '{checkmk_folder}' for CheckMK client"
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
                        f"Starting service discovery (tabula_rasa) for host {hostname}"
                    )
                    discovery_result = client.start_service_discovery(
                        hostname, mode="tabula_rasa"
                    )
                    logger.info(
                        f"Service discovery started for host {hostname}: {discovery_result}"
                    )
                    create_result["discovery"] = {
                        "started": True,
                        "mode": "tabula_rasa",
                        "result": discovery_result,
                    }
                except Exception as discovery_error:
                    # Log but don't fail the whole operation if discovery fails
                    logger.warning(
                        f"Failed to start service discovery for host {hostname}: {discovery_error}"
                    )
                    create_result["discovery"] = {
                        "started": False,
                        "error": str(discovery_error),
                    }

            except CheckMKAPIError as e:
                logger.error(f"CheckMK API error creating host {hostname}: {e}")

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
                f"Successfully added device {device_id} ({hostname}) to CheckMK"
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
                client = _get_checkmk_client()

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
                    f"Converted new folder path from '{new_folder_normalized}' to '{checkmk_new_folder}' for CheckMK client"
                )

                # Move the host to the new folder
                try:
                    client.move_host(hostname, checkmk_new_folder)
                    logger.info(
                        f"Moved host {hostname} from {current_folder_normalized} to {new_folder_normalized}"
                    )
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
                f"Successfully updated device {device_id} ({hostname}) in CheckMK"
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

    def get_filtered_attributes(self, nb_attributes, cmk_attributes) -> List[str]:
        """Get the list of attributes that are ignored during comparison.

        Returns:
            List of attribute names
        """
        ignore_attributes = config_service.get_ignore_attributes()
        return [key for key in nb_attributes.keys() if key not in ignore_attributes] + [
            key for key in cmk_attributes.keys() if key not in ignore_attributes
        ]


# Global instance for dependency injection
nb2cmk_service = NautobotToCheckMKService()
