"""
Nautobot device management endpoints.
"""

from __future__ import annotations
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from models.nautobot import (
    CheckIPRequest,
    DeviceOnboardRequest,
    SyncNetworkDataRequest,
    DeviceFilter,
    AddDeviceRequest,
)
from services import nautobot_service
from services.cache_service import cache_service
from services.nautobot_helpers.cache_helpers import (
    DEVICE_CACHE_TTL,
    get_device_list_cache_key,
    cache_device,
    get_cached_device,
    cache_device_list,
    get_cached_device_list,
)

logger = logging.getLogger(__name__)
router = APIRouter(
    tags=["nautobot-devices"]
)  # No prefix - endpoints define their own paths


@router.get("/test")
async def test_current_nautobot_connection(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Test current Nautobot connection."""
    try:
        # Get nautobot config using the same pattern as the original code
        try:
            # Try to get settings from database first
            from settings_manager import settings_manager

            db_settings = settings_manager.get_nautobot_settings()
            if db_settings and db_settings.get("url") and db_settings.get("token"):
                nautobot_config = {
                    "url": db_settings["url"],
                    "token": db_settings["token"],
                    "timeout": db_settings.get("timeout", 30),
                    "verify_ssl": db_settings.get("verify_ssl", True),
                    "_source": "database",
                }
            else:
                raise Exception("No database settings")
        except Exception:
            # Fallback to environment variables
            from config import settings

            nautobot_config = {
                "url": settings.nautobot_url,
                "token": settings.nautobot_token,
                "timeout": settings.nautobot_timeout,
                "verify_ssl": True,
                "_source": "environment",
            }

        success, message = await nautobot_service.test_connection(
            nautobot_config.get("url", ""),
            nautobot_config.get("token", ""),
            nautobot_config.get("timeout", 30),
            nautobot_config.get("verify_ssl", True),
        )

        return {
            "success": success,
            "message": message,
            "nautobot_url": nautobot_config.get("url", "Unknown"),
            "connection_source": nautobot_config.get("_source", "unknown"),
        }
    except Exception as e:
        logger.error(f"Error testing Nautobot connection: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to test Nautobot connection: {str(e)}",
        )


@router.get("/devices")
async def get_devices(
    limit: Optional[int] = None,
    offset: Optional[int] = None,
    filter_type: Optional[str] = None,
    filter_value: Optional[str] = None,
    reload: bool = False,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get list of devices from Nautobot with optional filtering and pagination.

    Args:
        limit: Number of devices per page (default: no limit for full data load)
        offset: Number of devices to skip (default: 0)
        filter_type: Type of filter ('name', 'location', 'prefix')
        filter_value: Value to filter by
        reload: If True, bypass cache and reload from Nautobot (default: False)
    """
    try:
        # Check cache first (unless reload is requested)
        cache_key = get_device_list_cache_key(filter_type, filter_value, limit, offset)

        if not reload:
            cached_result = get_cached_device_list(cache_key)
            if cached_result is not None:
                logger.debug(f"Cache hit for devices list: {cache_key}")
                return cached_result
        else:
            logger.debug(f"Reload requested, bypassing cache for: {cache_key}")
        # Build GraphQL query based on filters
        variables = {}

        if filter_type and filter_value:
            if filter_type == "name":
                # First, get the total count without pagination
                count_query = """
                query devices_count_by_name($name_filter: [String]) {
                  devices(name__ire: $name_filter) {
                    id
                  }
                }
                """
                count_variables = {"name_filter": [filter_value]}
                count_result = await nautobot_service.graphql_query(
                    count_query, count_variables
                )
                if "errors" in count_result:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"GraphQL errors in count query: {count_result['errors']}",
                    )
                total_count = len(count_result["data"]["devices"])

                # Now get the paginated data
                query = """
                query devices_by_name(
                  $name_filter: [String],
                  $limit: Int,
                  $offset: Int
                ) {
                  devices(name__ire: $name_filter, limit: $limit, offset: $offset) {
                    id
                    name
                    role {
                      name
                    }
                    location {
                      name
                    }
                    primary_ip4 {
                      address
                    }
                    status {
                      name
                    }
                    device_type {
                      model
                    }
                    cf_last_backup
                  }
                }
                """
                variables = {"name_filter": [filter_value]}

                # Add pagination parameters if provided
                if limit is not None:
                    variables["limit"] = limit
                if offset is not None:
                    variables["offset"] = offset

                result = await nautobot_service.graphql_query(query, variables)
                if "errors" in result:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"GraphQL errors: {result['errors']}",
                    )

                devices = result["data"]["devices"]

                # Calculate if there are more pages
                has_more = (offset or 0) + len(devices) < total_count

                response_data = {
                    "devices": devices,
                    "count": total_count,  # Return actual total count
                    "has_more": has_more,
                    "is_paginated": limit is not None,
                    "current_offset": offset or 0,
                    "current_limit": limit,
                    "next": None
                    if not has_more
                    else f"/api/nautobot/devices?limit={limit}&offset={(offset or 0) + limit}&filter_type={filter_type}&filter_value={filter_value}",
                    "previous": None
                    if (offset or 0) == 0
                    else f"/api/nautobot/devices?limit={limit}&offset={max(0, (offset or 0) - limit)}&filter_type={filter_type}&filter_value={filter_value}",
                }

                # Cache the result and individual devices
                logger.debug(f"Caching devices list: {cache_key}")
                cache_service.set(
                    cache_key, response_data, DEVICE_CACHE_TTL
                )  # Cache the full response
                cache_device_list(
                    cache_key, response_data["devices"]
                )  # Cache individual devices

                return response_data

            elif filter_type == "location":
                query = """
                query devices_by_location(
                  $location_filter: [String],
                  $limit: Int,
                  $offset: Int
                ) {
                  locations(name__ire: $location_filter) {
                    name
                    devices(limit: $limit, offset: $offset) {
                      id
                      name
                      role {
                        name
                      }
                      location {
                        name
                      }
                      primary_ip4 {
                        address
                      }
                      status {
                        name
                      }
                      device_type {
                        model
                      }
                      cf_last_backup
                    }
                  }
                }
                """
                variables = {"location_filter": [filter_value]}

                # Add pagination parameters if provided
                if limit is not None:
                    variables["limit"] = limit
                if offset is not None:
                    variables["offset"] = offset

                result = await nautobot_service.graphql_query(query, variables)
                if "errors" in result:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"GraphQL errors: {result['errors']}",
                    )

                # Extract devices from locations
                devices = []
                for location in result["data"]["locations"]:
                    for device in location["devices"]:
                        device["location"] = {"name": location["name"]}
                        devices.append(device)

                has_more = len(devices) == limit if limit else False

                response_data = {
                    "devices": devices,
                    "count": len(devices),
                    "has_more": has_more,
                    "is_paginated": limit is not None,
                    "current_offset": offset or 0,
                    "current_limit": limit,
                    "next": None
                    if not has_more
                    else f"/api/nautobot/devices?limit={limit}&offset={(offset or 0) + limit}&filter_type={filter_type}&filter_value={filter_value}",
                    "previous": None
                    if (offset or 0) == 0
                    else f"/api/nautobot/devices?limit={limit}&offset={max(0, (offset or 0) - limit)}&filter_type={filter_type}&filter_value={filter_value}",
                }

                # Cache the result and individual devices
                logger.debug(f"Caching devices list: {cache_key}")
                cache_service.set(
                    cache_key, response_data, DEVICE_CACHE_TTL
                )  # Cache the full response
                cache_device_list(
                    cache_key, response_data["devices"]
                )  # Cache individual devices

                return response_data

            elif filter_type == "prefix":
                # Use prefix filtering - correct Nautobot syntax
                query = """
                query devices_by_ip_prefix(
                  $prefix_filter: [String],
                  $limit: Int,
                  $offset: Int
                ) {
                  prefixes(within_include: $prefix_filter) {
                    prefix
                    ip_addresses(limit: $limit, offset: $offset) {
                      primary_ip4_for {
                        id
                        name
                        role {
                          name
                        }
                        location {
                          name
                        }
                        primary_ip4 {
                          address
                        }
                        status {
                          name
                        }
                        device_type {
                          model
                        }
                        cf_last_backup
                      }
                    }
                  }
                }
                """
                variables = {"prefix_filter": [filter_value]}

                # Add pagination parameters if provided
                if limit is not None:
                    variables["limit"] = limit
                if offset is not None:
                    variables["offset"] = offset

                result = await nautobot_service.graphql_query(query, variables)
                if "errors" in result:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"GraphQL errors: {result['errors']}",
                    )

                # Extract unique devices from prefixes
                devices_dict = {}
                for prefix in result["data"]["prefixes"]:
                    for ip_addr in prefix["ip_addresses"]:
                        if ip_addr["primary_ip4_for"]:
                            device = ip_addr["primary_ip4_for"]
                            devices_dict[device["id"]] = device

                devices = list(devices_dict.values())
                has_more = len(devices) == limit if limit else False

                response_data = {
                    "devices": devices,
                    "count": len(devices),
                    "has_more": has_more,
                    "is_paginated": limit is not None,
                    "current_offset": offset or 0,
                    "current_limit": limit,
                    "next": None
                    if not has_more
                    else f"/api/nautobot/devices?limit={limit}&offset={(offset or 0) + limit}&filter_type={filter_type}&filter_value={filter_value}",
                    "previous": None
                    if (offset or 0) == 0
                    else f"/api/nautobot/devices?limit={limit}&offset={max(0, (offset or 0) - limit)}&filter_type={filter_type}&filter_value={filter_value}",
                }

                # Cache the result and individual devices
                logger.debug(f"Caching devices list: {cache_key}")
                cache_service.set(
                    cache_key, response_data, DEVICE_CACHE_TTL
                )  # Cache the full response
                cache_device_list(
                    cache_key, response_data["devices"]
                )  # Cache individual devices

                return response_data

        # Standard device query when no filters are provided
        query = """
        query all_devices($limit: Int, $offset: Int) {
          devices(limit: $limit, offset: $offset) {
            id
            name
            role {
              name
            }
            location {
              name
            }
            primary_ip4 {
              address
            }
            status {
              name
            }
            device_type {
              model
            }
            cf_last_backup
          }
        }
        """

        variables = {}
        # Only add pagination parameters if they are provided
        if limit is not None:
            variables["limit"] = limit
        if offset is not None:
            variables["offset"] = offset

        result = await nautobot_service.graphql_query(query, variables)
        if "errors" in result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"GraphQL errors: {result['errors']}",
            )

        devices = result["data"]["devices"]

        # For unfiltered results
        if limit is not None:
            # First get total count without pagination
            count_query = """
            query all_devices_count {
              devices {
                id
              }
            }
            """
            count_result = await nautobot_service.graphql_query(count_query, {})
            if "errors" in count_result:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"GraphQL errors in count query: {count_result['errors']}",
                )
            total_count = len(count_result["data"]["devices"])

            # Calculate if there are more pages
            has_more = (offset or 0) + len(devices) < total_count

            response_data = {
                "devices": devices,
                "count": total_count,  # Return actual total count
                "has_more": has_more,
                "is_paginated": True,
                "current_offset": offset or 0,
                "current_limit": limit,
                "next": None
                if not has_more
                else f"/api/nautobot/devices?limit={limit}&offset={(offset or 0) + limit}",
                "previous": None
                if (offset or 0) == 0
                else f"/api/nautobot/devices?limit={limit}&offset={max(0, (offset or 0) - limit)}",
            }

            # Cache the result and individual devices
            logger.debug(f"Caching devices list: {cache_key}")
            cache_service.set(
                cache_key, response_data, DEVICE_CACHE_TTL
            )  # Cache the full response
            cache_device_list(
                cache_key, response_data["devices"]
            )  # Cache individual devices

            return response_data
        else:
            # No pagination - return all devices (legacy behavior)
            response_data = {
                "devices": devices,
                "count": len(devices),
                "has_more": False,
                "is_paginated": False,
                "current_offset": 0,
                "current_limit": None,
                "next": None,
                "previous": None,
            }

            # Cache the result and individual devices
            logger.debug(f"Caching devices list: {cache_key}")
            cache_service.set(
                cache_key, response_data, DEVICE_CACHE_TTL
            )  # Cache the full response
            cache_device_list(
                cache_key, response_data["devices"]
            )  # Cache individual devices

            return response_data

    except Exception as e:
        logger.error(f"Error fetching devices: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch devices: {str(e)}",
        )


@router.get("/devices/{device_id}")
async def get_device(
    device_id: str,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get device details from Nautobot by device ID."""
    try:
        # Check cache first
        cached_device = get_cached_device(device_id)
        if cached_device is not None:
            logger.debug(f"Cache hit for device: {device_id}")
            return cached_device

        logger.debug(f"Cache miss for device: {device_id}")
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

        device = result["data"]["device"]

        # Cache the device
        if device:
            logger.debug(f"Caching device: {device_id}")
            cache_device(device)

        return device
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch device {device_id}: {str(e)}",
        )


@router.put("/devices/{device_id}")
async def update_device(
    device_id: str,
    update_data: dict,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
):
    """Update device in Nautobot."""


@router.post("/devices/search")
async def search_devices(
    filters: DeviceFilter,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Search devices in Nautobot with complex filters."""


@router.post("/check-ip")
async def check_ip(
    request: CheckIPRequest,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Check if an IP address exists in Nautobot."""
    try:
        # Use GraphQL query as specified in nautobot_access.md
        query = """
        query device($ip_address: [String]) {
          ip_addresses(address: $ip_address) {
            primary_ip4_for {
              name
            }
          }
        }
        """
        variables = {"ip_address": [request.ip_address]}
        result = await nautobot_service.graphql_query(query, variables)

        if "errors" in result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"GraphQL errors: {result['errors']}",
            )

        ip_addresses = result["data"]["ip_addresses"]
        exists = len(ip_addresses) > 0
        is_available = not exists

        # Check if any IP address is assigned to a device
        assigned_devices = []
        for ip in ip_addresses:
            if ip.get("primary_ip4_for"):
                for device in ip["primary_ip4_for"]:
                    assigned_devices.append({"name": device["name"]})

        is_assigned_to_device = len(assigned_devices) > 0

        return {
            "ip_address": request.ip_address,
            "is_available": is_available,
            "exists": exists,
            "is_assigned_to_device": is_assigned_to_device,
            "assigned_devices": assigned_devices,
            "existing_records": ip_addresses,
            "details": ip_addresses,  # For backward compatibility
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check IP address: {str(e)}",
        )


@router.post("/devices/onboard")
async def onboard_device(
    request: DeviceOnboardRequest,
    current_user: dict = Depends(require_permission("devices.onboard", "execute")),
):
    """Onboard a new device to Nautobot."""
    try:
        # Get nautobot config
        try:
            from settings_manager import settings_manager

            db_settings = settings_manager.get_nautobot_settings()
            if db_settings and db_settings.get("url") and db_settings.get("token"):
                nautobot_url = db_settings["url"].rstrip("/")
                nautobot_token = db_settings["token"]
            else:
                raise Exception("No database settings")
        except Exception:
            from config import settings

            nautobot_url = settings.nautobot_url.rstrip("/")
            nautobot_token = settings.nautobot_token

        # Prepare the job data according to nautobot_access.md
        job_data = {
            "data": {
                "location": request.location_id,
                "ip_addresses": request.ip_address,  # Keep as string - multiple IPs separated by comma
                "secrets_group": request.secret_groups_id,
                "device_role": request.role_id,
                "namespace": request.namespace_id,
                "device_status": request.status_id,
                "interface_status": request.interface_status_id,
                "ip_address_status": request.ip_address_status_id,
                "platform": None
                if request.platform_id == "detect"
                else request.platform_id,
                "port": request.port,
                "timeout": request.timeout,
                "update_devices_without_primary_ip": False,
            }
        }

        # Call Nautobot job API
        job_url = f"{nautobot_url}/api/extras/jobs/Sync%20Devices%20From%20Network/run/"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Token {nautobot_token}",
        }

        import requests

        logger.info(f"Calling Nautobot job API: {job_url}")
        logger.info(f"Job data: {job_data}")

        response = requests.post(job_url, json=job_data, headers=headers, timeout=30)
        logger.info(f"Nautobot API response status: {response.status_code}")
        logger.info(f"Nautobot API response body: {response.text}")

        if response.status_code in [200, 201, 202]:
            result = response.json()
            job_id = result.get("job_result", {}).get("id") or result.get("id")
            logger.info(f"Extracted job ID: {job_id}")
            return {
                "success": True,
                "message": f"Device onboarding job started successfully for {request.ip_address}",
                "job_id": job_id,
                "job_status": result.get("job_result", {}).get("status")
                or result.get("status", "pending"),
                "device_data": request.dict(),
                "nautobot_response": result,
            }
        else:
            error_detail = "Unknown error"
            try:
                error_response = response.json()
                error_detail = error_response.get(
                    "detail", error_response.get("message", str(error_response))
                )
            except (ValueError, KeyError, TypeError):
                error_detail = response.text or f"HTTP {response.status_code}"

            logger.error(f"Nautobot job API failed: {error_detail}")
            return {
                "success": False,
                "message": f"Failed to start onboarding job: {error_detail}",
                "status_code": response.status_code,
                "response_body": response.text,
            }

    except Exception as e:
        logger.error(f"Exception in onboard_device: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to onboard device: {str(e)}",
        )


@router.post("/add-device")
async def add_device(
    request: AddDeviceRequest,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
):
    """
    Orchestrated endpoint to add a device with interfaces to Nautobot.

    Workflow:
    1. Create device in Nautobot DCIM
    2. Create IP addresses for all interfaces (if specified)
    3. Create interfaces and assign IP addresses
    4. Assign primary IPv4 address to device

    Request body:
    {
        "name": "device-name",
        "role": "role-id",
        "status": "status-id",
        "location": "location-id",
        "device_type": "device-type-id",
        "interfaces": [
            {
                "name": "eth0",
                "type": "1000base-t",
                "status": "active",
                "ip_address": "192.168.1.1/24",
                "namespace": "namespace-id",
                "enabled": true,
                "mgmt_only": false,
                "description": "Management interface",
                "mac_address": "00:11:22:33:44:55",
                "mtu": 1500,
                "mode": "access",
                "untagged_vlan": "vlan-id",
                "tagged_vlans": "vlan-id1,vlan-id2",
                "parent_interface": "parent-id",
                "bridge": "bridge-id",
                "lag": "lag-id",
                "tags": "tag1,tag2"
            }
        ]
    }
    """
    try:
        logger.info(f"Starting add-device workflow for: {request.name}")

        # Initialize workflow status tracking
        workflow_status = {
            "step1_device": {"status": "pending", "message": "", "data": None},
            "step2_ip_addresses": {
                "status": "pending",
                "message": "",
                "data": [],
                "errors": [],
            },
            "step3_interfaces": {
                "status": "pending",
                "message": "",
                "data": [],
                "errors": [],
            },
            "step4_primary_ip": {"status": "pending", "message": "", "data": None},
        }

        # Step 1: Create device in Nautobot
        logger.info("Step 1: Creating device in Nautobot DCIM")
        workflow_status["step1_device"]["status"] = "in_progress"

        try:
            device_payload = {
                "name": request.name,
                "device_type": request.device_type,
                "role": request.role,
                "location": request.location,
                "status": request.status,
            }

            # Add optional platform and software_version if provided
            if request.platform:
                device_payload["platform"] = request.platform
            if request.software_version:
                device_payload["software_version"] = request.software_version

            device_response = await nautobot_service.rest_request(
                endpoint="dcim/devices/", method="POST", data=device_payload
            )

            if not device_response or "id" not in device_response:
                workflow_status["step1_device"]["status"] = "failed"
                workflow_status["step1_device"]["message"] = (
                    "Failed to create device: No device ID returned"
                )
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create device: No device ID returned",
                )

            device_id = device_response["id"]
            workflow_status["step1_device"]["status"] = "success"
            workflow_status["step1_device"]["message"] = (
                f"Device '{request.name}' created successfully"
            )
            workflow_status["step1_device"]["data"] = {
                "id": device_id,
                "name": request.name,
            }
            logger.info(f"Device created with ID: {device_id}")

        except HTTPException:
            raise
        except Exception as e:
            workflow_status["step1_device"]["status"] = "failed"
            workflow_status["step1_device"]["message"] = (
                f"Error creating device: {str(e)}"
            )
            logger.error(f"Step 1 failed: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create device: {str(e)}",
            )

        # Step 2: Create IP addresses for all interfaces
        logger.info("Step 2: Creating IP addresses")
        workflow_status["step2_ip_addresses"]["status"] = "in_progress"
        ip_address_map = {}  # Maps interface name to IP address ID
        interfaces_with_ips = [
            iface for iface in request.interfaces if iface.ip_address
        ]

        if not interfaces_with_ips:
            workflow_status["step2_ip_addresses"]["status"] = "skipped"
            workflow_status["step2_ip_addresses"]["message"] = (
                "No IP addresses to create"
            )
        else:
            for interface in interfaces_with_ips:
                try:
                    # Validate that namespace is provided
                    if not interface.namespace:
                        workflow_status["step2_ip_addresses"]["errors"].append(
                            {
                                "interface": interface.name,
                                "ip_address": interface.ip_address,
                                "error": "Namespace is required for all IP addresses",
                            }
                        )
                        logger.error(
                            f"Missing namespace for IP address {interface.ip_address} on interface {interface.name}"
                        )
                        continue

                    ip_payload = {
                        "address": interface.ip_address,
                        "status": interface.status,
                        "namespace": interface.namespace,
                    }

                    ip_response = await nautobot_service.rest_request(
                        endpoint="ipam/ip-addresses/", method="POST", data=ip_payload
                    )

                    if ip_response and "id" in ip_response:
                        ip_address_map[interface.name] = ip_response["id"]
                        workflow_status["step2_ip_addresses"]["data"].append(
                            {
                                "interface": interface.name,
                                "ip_address": interface.ip_address,
                                "id": ip_response["id"],
                                "status": "success",
                            }
                        )
                        logger.info(
                            f"Created IP address {interface.ip_address} with ID: {ip_response['id']}"
                        )
                    else:
                        workflow_status["step2_ip_addresses"]["errors"].append(
                            {
                                "interface": interface.name,
                                "ip_address": interface.ip_address,
                                "error": "No IP ID returned from Nautobot",
                            }
                        )
                        logger.warning(
                            f"Failed to create IP address {interface.ip_address} for interface {interface.name}"
                        )

                except Exception as e:
                    error_msg = str(e)
                    workflow_status["step2_ip_addresses"]["errors"].append(
                        {
                            "interface": interface.name,
                            "ip_address": interface.ip_address,
                            "error": error_msg,
                        }
                    )
                    logger.error(
                        f"Error creating IP address {interface.ip_address}: {error_msg}"
                    )

            success_count = len(workflow_status["step2_ip_addresses"]["data"])
            error_count = len(workflow_status["step2_ip_addresses"]["errors"])

            if success_count > 0 and error_count == 0:
                workflow_status["step2_ip_addresses"]["status"] = "success"
                workflow_status["step2_ip_addresses"]["message"] = (
                    f"Created {success_count} IP address(es) successfully"
                )
            elif success_count > 0 and error_count > 0:
                workflow_status["step2_ip_addresses"]["status"] = "partial"
                workflow_status["step2_ip_addresses"]["message"] = (
                    f"Created {success_count} IP address(es), {error_count} failed"
                )
            else:
                workflow_status["step2_ip_addresses"]["status"] = "failed"
                workflow_status["step2_ip_addresses"]["message"] = (
                    f"Failed to create all {error_count} IP address(es)"
                )

        # Step 3: Create interfaces and assign IP addresses
        logger.info("Step 3: Creating interfaces")
        workflow_status["step3_interfaces"]["status"] = "in_progress"
        created_interfaces = []
        primary_ipv4_id = None

        # Separate LAG interfaces from other interfaces
        # LAG interfaces must be created first so we can reference them
        lag_interfaces = [iface for iface in request.interfaces if iface.type == 'lag']
        other_interfaces = [iface for iface in request.interfaces if iface.type != 'lag']

        # Map frontend interface IDs to Nautobot interface IDs
        interface_id_map = {}

        # Process LAG interfaces first, then other interfaces
        sorted_interfaces = lag_interfaces + other_interfaces
        logger.info(f"Creating {len(lag_interfaces)} LAG interfaces first, then {len(other_interfaces)} other interfaces")

        for interface in sorted_interfaces:
            try:
                interface_payload = {
                    "name": interface.name,
                    "device": device_id,
                    "type": interface.type,
                    "status": interface.status,
                }

                # Add optional properties if provided
                if interface.enabled is not None:
                    interface_payload["enabled"] = interface.enabled
                if interface.mgmt_only is not None:
                    interface_payload["mgmt_only"] = interface.mgmt_only
                if interface.description:
                    interface_payload["description"] = interface.description
                if interface.mac_address:
                    interface_payload["mac_address"] = interface.mac_address
                if interface.mtu:
                    interface_payload["mtu"] = interface.mtu
                if interface.mode:
                    interface_payload["mode"] = interface.mode
                if interface.untagged_vlan:
                    interface_payload["untagged_vlan"] = interface.untagged_vlan
                if interface.tagged_vlans:
                    # Convert comma-separated string to list for Nautobot API
                    interface_payload["tagged_vlans"] = [
                        v.strip() for v in interface.tagged_vlans.split(',') if v.strip()
                    ]
                if interface.parent_interface:
                    interface_payload["parent_interface"] = interface.parent_interface
                if interface.bridge:
                    interface_payload["bridge"] = interface.bridge
                if interface.lag:
                    # Map frontend interface ID to Nautobot interface ID
                    lag_nautobot_id = interface_id_map.get(interface.lag)
                    if lag_nautobot_id:
                        interface_payload["lag"] = lag_nautobot_id
                        logger.info(f"Mapping LAG {interface.lag} to Nautobot ID {lag_nautobot_id}")
                    else:
                        logger.warning(f"LAG interface {interface.lag} not found in interface_id_map")
                if interface.tags:
                    interface_payload["tags"] = interface.tags

                interface_response = await nautobot_service.rest_request(
                    endpoint="dcim/interfaces/", method="POST", data=interface_payload
                )

                if interface_response and "id" in interface_response:
                    interface_id = interface_response["id"]
                    logger.info(
                        f"Created interface {interface.name} with ID: {interface_id}"
                    )

                    # Store mapping from frontend ID to Nautobot ID for LAG references
                    if interface.id:
                        interface_id_map[interface.id] = interface_id
                        logger.debug(f"Mapped frontend ID {interface.id} to Nautobot ID {interface_id}")

                    interface_result = {
                        "name": interface.name,
                        "id": interface_id,
                        "status": "success",
                        "ip_assigned": False,
                        "ip_assignment_error": None,
                    }

                    # Assign IP address to interface if we created one
                    if interface.name in ip_address_map:
                        ip_id = ip_address_map[interface.name]
                        try:
                            # Use the new IP address to interface assignment endpoint
                            assignment_payload = {
                                "ip_address": ip_id,
                                "interface": interface_id,
                            }

                            await nautobot_service.rest_request(
                                endpoint="ipam/ip-address-to-interface/",
                                method="POST",
                                data=assignment_payload,
                            )
                            interface_result["ip_assigned"] = True
                            logger.info(
                                f"Assigned IP {interface.ip_address} to interface {interface.name}"
                            )

                            # Save first IPv4 address for primary IP
                            if (
                                primary_ipv4_id is None
                                and interface.ip_address
                                and "/" in interface.ip_address
                            ):
                                if ":" not in interface.ip_address:
                                    primary_ipv4_id = ip_id

                        except Exception as e:
                            interface_result["ip_assignment_error"] = str(e)
                            logger.error(f"Failed to assign IP to interface: {str(e)}")

                    workflow_status["step3_interfaces"]["data"].append(interface_result)
                    created_interfaces.append(interface_response)
                else:
                    workflow_status["step3_interfaces"]["errors"].append(
                        {
                            "interface": interface.name,
                            "error": "No interface ID returned from Nautobot",
                        }
                    )
                    logger.warning(f"Failed to create interface {interface.name}")

            except Exception as e:
                error_msg = str(e)
                workflow_status["step3_interfaces"]["errors"].append(
                    {"interface": interface.name, "error": error_msg}
                )
                logger.error(f"Error creating interface {interface.name}: {error_msg}")

        success_count = len(workflow_status["step3_interfaces"]["data"])
        error_count = len(workflow_status["step3_interfaces"]["errors"])

        if success_count > 0 and error_count == 0:
            workflow_status["step3_interfaces"]["status"] = "success"
            workflow_status["step3_interfaces"]["message"] = (
                f"Created {success_count} interface(s) successfully"
            )
        elif success_count > 0 and error_count > 0:
            workflow_status["step3_interfaces"]["status"] = "partial"
            workflow_status["step3_interfaces"]["message"] = (
                f"Created {success_count} interface(s), {error_count} failed"
            )
        elif success_count == 0 and error_count > 0:
            workflow_status["step3_interfaces"]["status"] = "failed"
            workflow_status["step3_interfaces"]["message"] = (
                f"Failed to create all {error_count} interface(s)"
            )
        else:
            workflow_status["step3_interfaces"]["status"] = "skipped"
            workflow_status["step3_interfaces"]["message"] = "No interfaces to create"

        # Step 4: Assign primary IPv4 address
        logger.info("Step 4: Assigning primary IPv4 address to device")
        workflow_status["step4_primary_ip"]["status"] = "in_progress"

        if primary_ipv4_id:
            success = await _assign_primary_ipv4(device_id, primary_ipv4_id)
            if success:
                workflow_status["step4_primary_ip"]["status"] = "success"
                workflow_status["step4_primary_ip"]["message"] = (
                    "Primary IPv4 address assigned successfully"
                )
                workflow_status["step4_primary_ip"]["data"] = {"ip_id": primary_ipv4_id}
                logger.info(f"Primary IPv4 assigned successfully: {primary_ipv4_id}")
            else:
                workflow_status["step4_primary_ip"]["status"] = "failed"
                workflow_status["step4_primary_ip"]["message"] = (
                    "Failed to assign primary IPv4 address"
                )
                logger.warning("Failed to assign primary IPv4 address")
        else:
            workflow_status["step4_primary_ip"]["status"] = "skipped"
            workflow_status["step4_primary_ip"]["message"] = (
                "No IPv4 address available for primary IP assignment"
            )
            logger.info("No IPv4 address found for primary IP assignment")

        # Determine overall success
        overall_success = workflow_status["step1_device"][
            "status"
        ] == "success" and workflow_status["step3_interfaces"]["status"] in [
            "success",
            "partial",
        ]

        return {
            "success": overall_success,
            "message": f"Device '{request.name}' workflow completed",
            "device_id": device_id,
            "device": device_response,
            "workflow_status": workflow_status,
            "summary": {
                "device_created": workflow_status["step1_device"]["status"]
                == "success",
                "interfaces_created": len(created_interfaces),
                "interfaces_failed": len(workflow_status["step3_interfaces"]["errors"]),
                "ip_addresses_created": len(ip_address_map),
                "ip_addresses_failed": len(
                    workflow_status["step2_ip_addresses"]["errors"]
                ),
                "primary_ipv4_assigned": primary_ipv4_id is not None,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to add device: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add device: {str(e)}",
        )


async def _assign_primary_ipv4(device_id: str, ip_address_id: str) -> bool:
    """
    Assign primary IPv4 address to a device.

    Args:
        device_id: The Nautobot device ID (UUID)
        ip_address_id: The Nautobot IP address ID (UUID) to set as primary

    Returns:
        bool: True if successful, False otherwise
    """
    try:
        logger.info(f"Assigning primary IPv4 {ip_address_id} to device {device_id}")

        # Use the DCIM devices PATCH endpoint to update the primary_ip4 field
        endpoint = f"dcim/devices/{device_id}/"
        await nautobot_service.rest_request(
            endpoint=endpoint, method="PATCH", data={"primary_ip4": ip_address_id}
        )

        logger.info(
            f"Successfully assigned primary IPv4 {ip_address_id} to device {device_id}"
        )
        return True
    except Exception as e:
        logger.error(f"Error assigning primary IPv4 to device {device_id}: {str(e)}")
        return False


@router.post("/sync-network-data")
async def sync_network_data(
    request: SyncNetworkDataRequest,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
):
    """Sync network data with Nautobot."""
    try:
        # Get nautobot config
        try:
            from settings_manager import settings_manager

            db_settings = settings_manager.get_nautobot_settings()
            if db_settings and db_settings.get("url") and db_settings.get("token"):
                nautobot_url = db_settings["url"].rstrip("/")
                nautobot_token = db_settings["token"]
            else:
                raise Exception("No database settings")
        except Exception:
            from config import settings

            nautobot_url = settings.nautobot_url.rstrip("/")
            nautobot_token = settings.nautobot_token

        # Prepare the job data according to nautobot_access.md
        job_data = {
            "data": {
                "devices": request.data.get("devices", []),
                "default_prefix_status": request.data.get("default_prefix_status"),
                "interface_status": request.data.get("interface_status"),
                "ip_address_status": request.data.get("ip_address_status"),
                "namespace": request.data.get("namespace"),
                "sync_cables": request.data.get("sync_cables", False),
                "sync_software_version": request.data.get(
                    "sync_software_version", False
                ),
                "sync_vlans": request.data.get("sync_vlans", False),
                "sync_vrfs": request.data.get("sync_vrfs", False),
            }
        }

        # Call Nautobot job API
        job_url = f"{nautobot_url}/api/extras/jobs/Sync%20Network%20Data%20From%20Network/run/"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Token {nautobot_token}",
        }

        import requests

        response = requests.post(job_url, json=job_data, headers=headers, timeout=30)

        if response.status_code in [200, 201, 202]:
            result = response.json()
            return {
                "success": True,
                "message": "Network data sync job started successfully",
                "job_id": result.get("job_result", {}).get("id") or result.get("id"),
                "job_status": result.get("job_result", {}).get("status")
                or result.get("status", "pending"),
                "nautobot_response": result,
            }
        else:
            error_detail = "Unknown error"
            try:
                error_response = response.json()
                error_detail = error_response.get(
                    "detail", error_response.get("message", str(error_response))
                )
            except (ValueError, KeyError, TypeError):
                error_detail = response.text or f"HTTP {response.status_code}"

            return {
                "success": False,
                "message": f"Failed to start sync job: {error_detail}",
                "status_code": response.status_code,
            }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to sync network data: {str(e)}",
        )
