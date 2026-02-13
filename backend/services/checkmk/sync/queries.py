"""
GraphQL query service for Nautobot device data retrieval.

This module handles all GraphQL queries to Nautobot for device information
used in CheckMK synchronization.
"""

from __future__ import annotations
import logging
from typing import Dict, Any
from fastapi import HTTPException, status

from services.checkmk.config import config_service
from services.checkmk.normalization import device_normalization_service
from models.nb2cmk import DeviceList

logger = logging.getLogger(__name__)


class DeviceQueryService:
    """Service for querying device data from Nautobot."""

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
                logger.error("GraphQL errors: %s", result["errors"])
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="GraphQL errors: {}".format(result["errors"]),
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
            logger.error("Error getting devices for CheckMK sync: %s", e)
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
                    detail="GraphQL errors: {}".format(result["errors"]),
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
            logger.debug("[NORMALIZE] Device %s normalized config:", device_id)
            logger.debug("[NORMALIZE] Config keys: %s", list(normalized_dict.keys()))
            logger.debug("[NORMALIZE] Full normalized config: %s", normalized_dict)

            return normalized_dict

        except HTTPException:
            raise
        except Exception as e:
            logger.error(
                "Error getting normalized device config for %s: %s", device_id, e
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to get normalized device config: {e}",
            )
