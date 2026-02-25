"""
Device configuration comparison service for Nautobot to CheckMK sync.

This module handles comparing device configurations between Nautobot
and CheckMK to identify differences.
"""

from __future__ import annotations
import logging
from typing import Dict, Any, List
from fastapi import HTTPException, status

from services.checkmk.config import config_service
from models.nb2cmk import DeviceListWithStatus, DeviceComparison

logger = logging.getLogger(__name__)


class DeviceComparisonService:
    """Service for comparing device configurations between Nautobot and CheckMK."""

    def __init__(self, query_service):
        """Initialize comparison service with query service dependency.

        Args:
            query_service: DeviceQueryService instance for retrieving device data
        """
        self.query_service = query_service

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
                logger.error("GraphQL errors: %s", result["errors"])
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="GraphQL errors: {}".format(result["errors"]),
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
            logger.error("Error getting devices diff: %s", e)
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
            logger.info("[COMPARE] Starting comparison for device ID: %s", device_id)
            try:
                normalized_config = await self.query_service.get_device_normalized(
                    device_id
                )
                logger.debug(
                    f"[COMPARE] Successfully retrieved normalized config for device {device_id}"
                )
            except Exception as norm_error:
                error_msg = f"Failed to normalize device config for device {device_id}: {str(norm_error)}"
                logger.error("[COMPARE ERROR] %s", error_msg, exc_info=True)
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

            logger.info("[COMPARE] Comparing device: %s (ID: %s)", hostname, device_id)

            # Get CheckMK host config using service layer
            try:
                from services.checkmk.client_factory import (
                    get_host_data,
                    HostNotFoundError,
                )
                from checkmk.client import CheckMKAPIError

                # Call service layer to get host data
                try:
                    logger.debug(
                        f"[COMPARE] Fetching CheckMK data for host: {hostname}"
                    )
                    checkmk_data = await get_host_data(hostname, False)
                    logger.debug(
                        f"[COMPARE] Successfully retrieved CheckMK data for {hostname}"
                    )
                except HostNotFoundError:
                    logger.info(
                        f"[COMPARE] Host '{hostname}' not found in CheckMK during comparison"
                    )
                    return DeviceComparison(
                        result="host_not_found",
                        diff=f"Host '{hostname}' not found in CheckMK",
                        normalized_config=normalized_config,
                        checkmk_config=None,
                    )
                except CheckMKAPIError as e:
                    error_msg = f"CheckMK API error for host {hostname}: {str(e)}"
                    logger.error("[COMPARE ERROR] %s", error_msg)
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=error_msg,
                    )

            except HTTPException:
                raise
            except Exception as e:
                error_msg = f"Unexpected error getting CheckMK host data for {hostname}: {str(e)}"
                logger.error("[COMPARE ERROR] %s", error_msg, exc_info=True)
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
                logger.error("[COMPARE ERROR] %s", error_msg, exc_info=True)
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
            logger.error("Error comparing device configs for %s: %s", device_id, e)
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
            logger.debug("[COMPARE] Comparison keys: %s", compare_keys)
            logger.debug("[COMPARE] Ignore attributes: %s", ignore_attributes)
        except Exception as e:
            error_msg = f"Failed to load comparison configuration: {str(e)}"
            logger.error("[COMPARE ERROR] %s", error_msg, exc_info=True)
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
                        logger.error("[COMPARE ERROR] %s", error_msg)
                        raise ValueError(error_msg)

                    if not isinstance(cmk_attributes, dict):
                        error_msg = f"CheckMK attributes is not a dictionary: {type(cmk_attributes)}"
                        logger.error("[COMPARE ERROR] %s", error_msg)
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
                        logger.error("[COMPARE ERROR] %s", error_msg, exc_info=True)
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
                        logger.error("[COMPARE ERROR] %s", error_msg, exc_info=True)
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
                        logger.error("[COMPARE ERROR] %s", error_msg, exc_info=True)
                        raise ValueError(error_msg)

            except Exception as compare_key_error:
                error_msg = f"Error processing comparison key '{compare_key}': {str(compare_key_error)}"
                logger.error("[COMPARE ERROR] %s", error_msg, exc_info=True)
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
                    logger.debug("Filtering out ignored attribute: %s", diff)
                    break

            if not is_ignored:
                filtered_differences.append(diff)

        # Rejoin the filtered differences
        return "; ".join(filtered_differences)

    def get_filtered_attributes(self, nb_attributes, cmk_attributes) -> List[str]:
        """Get the list of attributes that are ignored during comparison.

        Returns:
            List of attribute names
        """
        ignore_attributes = config_service.get_ignore_attributes()
        return [key for key in nb_attributes.keys() if key not in ignore_attributes] + [
            key for key in cmk_attributes.keys() if key not in ignore_attributes
        ]
