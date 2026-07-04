"""
GraphQL query service for Nautobot device data retrieval.

This module handles all GraphQL queries to Nautobot for device information
used in CheckMK synchronization.
"""

from __future__ import annotations

import logging
from typing import Any, Dict

from fastapi import HTTPException, status

from models.nb2cmk import DeviceList

logger = logging.getLogger(__name__)

_DEVICE_LIST_GRAPHQL_FIELDS = """
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
"""


class DeviceQueryService:
    """Service for querying device data from Nautobot."""

    def __init__(self):
        import service_factory

        self._config = service_factory.build_checkmk_config_service()
        self._normalization = service_factory.build_device_normalization_service()
        self._rule_evaluator = service_factory.build_priority_rule_evaluator()

    async def get_devices_for_sync(
        self, *, require_primary_ip: bool = False
    ) -> DeviceList:
        """Get devices from Nautobot for CheckMK bulk sync or comparison jobs.

        Args:
            require_primary_ip: When True, only devices with a primary IPv4 address
                are returned (via Nautobot ``has_primary_ip`` GraphQL filter).

        Returns:
            DeviceList with device data

        Raises:
            HTTPException: If GraphQL query fails or other errors occur
        """
        try:
            import service_factory

            nautobot_service = service_factory.build_nautobot_service()

            if require_primary_ip:
                query = f"""
                query devices_with_primary_ip($has_primary_ip: Boolean!) {{
                  devices(has_primary_ip: $has_primary_ip) {{
                {_DEVICE_LIST_GRAPHQL_FIELDS}
                  }}
                }}
                """
                variables: Dict[str, Any] = {"has_primary_ip": True}
            else:
                query = f"""
                query all_devices {{
                  devices {{
                {_DEVICE_LIST_GRAPHQL_FIELDS}
                  }}
                }}
                """
                variables = {}

            result = await nautobot_service.graphql_query(query, variables)
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

            scope = (
                "devices with a primary IP address" if require_primary_ip else "devices"
            )
            return DeviceList(
                devices=devices,
                total=len(devices),
                message=f"Retrieved {len(devices)} {scope} from Nautobot",
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
            import service_factory

            nautobot_service = service_factory.build_nautobot_service()

            # Fetch device data from Nautobot including custom fields
            # Load query from configuration file
            query = self._config.get_query("get_device_normalized")
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
                      location_type {
                        name
                      }
                      parent {
                        name
                        location_type {
                          name
                        }
                        parent {
                          name
                          location_type {
                            name
                          }
                        }
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

            # Find the matching priority rule and load its config
            matched_rule = self._rule_evaluator.find_matching_rule(device_data)
            if matched_rule:
                try:
                    device_config = self._config.load_config_file(matched_rule.filename)
                    logger.info(
                        "[NORMALIZE] Device %s uses priority rule '%s' (id=%s)",
                        device_id,
                        matched_rule.filename,
                        matched_rule.id,
                    )
                except FileNotFoundError:
                    logger.warning(
                        "[NORMALIZE] Config file '%s' for rule id=%s not found, falling back to default",
                        matched_rule.filename,
                        matched_rule.id,
                    )
                    device_config = self._config.load_checkmk_config()
                    matched_rule = None
            else:
                device_config = self._config.load_checkmk_config()
                logger.info(
                    "[NORMALIZE] Device %s uses default config (no priority rule matched)",
                    device_id,
                )

            # Normalize the device data using the matched config
            extensions = self._normalization.normalize_device(
                device_data, config=device_config
            )

            # Convert to dictionary for API response
            normalized_dict = extensions.model_dump()

            # Embed matched rule info in internal section for UI display
            if matched_rule:
                normalized_dict["internal"]["matched_rule"] = {
                    "id": matched_rule.id,
                    "filename": matched_rule.filename,
                    "priority_order": matched_rule.priority_order,
                    "is_default": False,
                }
            else:
                normalized_dict["internal"]["matched_rule"] = {
                    "id": None,
                    "filename": "checkmk.yaml",
                    "priority_order": None,
                    "is_default": True,
                }

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
