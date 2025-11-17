"""
Nautobot router for device management and API interactions.
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
    OffboardDeviceRequest,
    AddDeviceRequest,
)
from services import nautobot_service, offboarding_service
from services.cache_service import cache_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/nautobot", tags=["nautobot"])

# Cache configuration
DEVICE_CACHE_TTL = 30 * 60  # 30 minutes in seconds


def _get_device_cache_key(device_id: str) -> str:
    """Generate cache key for individual device."""
    return f"nautobot:devices:{device_id}"


def _get_device_list_cache_key(
    filter_type: str = None,
    filter_value: str = None,
    limit: int = None,
    offset: int = None,
) -> str:
    """Generate cache key for device list."""
    if filter_type and filter_value:
        key = f"nautobot:devices:list:{filter_type}:{filter_value}"
    else:
        key = "nautobot:devices:list:all"

    if limit is not None and offset is not None:
        key += f":limit_{limit}:offset_{offset}"

    return key


def _cache_device(device: dict) -> None:
    """Cache individual device data."""
    if device and device.get("id"):
        cache_key = _get_device_cache_key(device["id"])
        cache_service.set(cache_key, device, DEVICE_CACHE_TTL)


def _get_cached_device(device_id: str) -> Optional[dict]:
    """Get cached device data."""
    cache_key = _get_device_cache_key(device_id)
    return cache_service.get(cache_key)


def _cache_device_list(cache_key: str, devices: list) -> None:
    """Cache device list and individual devices."""
    # Don't cache the full response data, that's handled elsewhere
    # Just cache individual devices
    for device in devices:
        if isinstance(device, dict):
            _cache_device(device)


def _get_cached_device_list(cache_key: str) -> Optional[list]:
    """Get cached device list."""
    return cache_service.get(cache_key)


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
        cache_key = _get_device_list_cache_key(filter_type, filter_value, limit, offset)

        if not reload:
            cached_result = _get_cached_device_list(cache_key)
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
                _cache_device_list(
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
                _cache_device_list(
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
                _cache_device_list(
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
            _cache_device_list(
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
            _cache_device_list(
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
        cached_device = _get_cached_device(device_id)
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
            _cache_device(device)

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
    4. Assign primary IPv4 address (skeleton only)
    
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
            "step2_ip_addresses": {"status": "pending", "message": "", "data": [], "errors": []},
            "step3_interfaces": {"status": "pending", "message": "", "data": [], "errors": []},
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
            
            device_response = await nautobot_service.rest_request(
                endpoint="dcim/devices/",
                method="POST",
                data=device_payload
            )
            
            if not device_response or "id" not in device_response:
                workflow_status["step1_device"]["status"] = "failed"
                workflow_status["step1_device"]["message"] = "Failed to create device: No device ID returned"
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create device: No device ID returned"
                )
            
            device_id = device_response["id"]
            workflow_status["step1_device"]["status"] = "success"
            workflow_status["step1_device"]["message"] = f"Device '{request.name}' created successfully"
            workflow_status["step1_device"]["data"] = {"id": device_id, "name": request.name}
            logger.info(f"Device created with ID: {device_id}")
            
        except HTTPException:
            raise
        except Exception as e:
            workflow_status["step1_device"]["status"] = "failed"
            workflow_status["step1_device"]["message"] = f"Error creating device: {str(e)}"
            logger.error(f"Step 1 failed: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create device: {str(e)}"
            )
        
        # Step 2: Create IP addresses for all interfaces
        logger.info("Step 2: Creating IP addresses")
        workflow_status["step2_ip_addresses"]["status"] = "in_progress"
        ip_address_map = {}  # Maps interface name to IP address ID
        interfaces_with_ips = [iface for iface in request.interfaces if iface.ip_address]
        
        if not interfaces_with_ips:
            workflow_status["step2_ip_addresses"]["status"] = "skipped"
            workflow_status["step2_ip_addresses"]["message"] = "No IP addresses to create"
        else:
            for interface in interfaces_with_ips:
                try:
                    # Validate that namespace is provided
                    if not interface.namespace:
                        workflow_status["step2_ip_addresses"]["errors"].append({
                            "interface": interface.name,
                            "ip_address": interface.ip_address,
                            "error": "Namespace is required for all IP addresses"
                        })
                        logger.error(f"Missing namespace for IP address {interface.ip_address} on interface {interface.name}")
                        continue
                    
                    ip_payload = {
                        "address": interface.ip_address,
                        "status": interface.status,
                        "namespace": interface.namespace,
                    }
                    
                    ip_response = await nautobot_service.rest_request(
                        endpoint="ipam/ip-addresses/",
                        method="POST",
                        data=ip_payload
                    )
                    
                    if ip_response and "id" in ip_response:
                        ip_address_map[interface.name] = ip_response["id"]
                        workflow_status["step2_ip_addresses"]["data"].append({
                            "interface": interface.name,
                            "ip_address": interface.ip_address,
                            "id": ip_response["id"],
                            "status": "success"
                        })
                        logger.info(f"Created IP address {interface.ip_address} with ID: {ip_response['id']}")
                    else:
                        workflow_status["step2_ip_addresses"]["errors"].append({
                            "interface": interface.name,
                            "ip_address": interface.ip_address,
                            "error": "No IP ID returned from Nautobot"
                        })
                        logger.warning(f"Failed to create IP address {interface.ip_address} for interface {interface.name}")
                        
                except Exception as e:
                    error_msg = str(e)
                    workflow_status["step2_ip_addresses"]["errors"].append({
                        "interface": interface.name,
                        "ip_address": interface.ip_address,
                        "error": error_msg
                    })
                    logger.error(f"Error creating IP address {interface.ip_address}: {error_msg}")
            
            success_count = len(workflow_status["step2_ip_addresses"]["data"])
            error_count = len(workflow_status["step2_ip_addresses"]["errors"])
            
            if success_count > 0 and error_count == 0:
                workflow_status["step2_ip_addresses"]["status"] = "success"
                workflow_status["step2_ip_addresses"]["message"] = f"Created {success_count} IP address(es) successfully"
            elif success_count > 0 and error_count > 0:
                workflow_status["step2_ip_addresses"]["status"] = "partial"
                workflow_status["step2_ip_addresses"]["message"] = f"Created {success_count} IP address(es), {error_count} failed"
            else:
                workflow_status["step2_ip_addresses"]["status"] = "failed"
                workflow_status["step2_ip_addresses"]["message"] = f"Failed to create all {error_count} IP address(es)"
        
        # Step 3: Create interfaces and assign IP addresses
        logger.info("Step 3: Creating interfaces")
        workflow_status["step3_interfaces"]["status"] = "in_progress"
        created_interfaces = []
        primary_ipv4_id = None
        
        for interface in request.interfaces:
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
                    interface_payload["tagged_vlans"] = interface.tagged_vlans
                if interface.parent_interface:
                    interface_payload["parent_interface"] = interface.parent_interface
                if interface.bridge:
                    interface_payload["bridge"] = interface.bridge
                if interface.lag:
                    interface_payload["lag"] = interface.lag
                if interface.tags:
                    interface_payload["tags"] = interface.tags
                
                interface_response = await nautobot_service.rest_request(
                    endpoint="dcim/interfaces/",
                    method="POST",
                    data=interface_payload
                )
                
                if interface_response and "id" in interface_response:
                    interface_id = interface_response["id"]
                    logger.info(f"Created interface {interface.name} with ID: {interface_id}")
                    
                    interface_result = {
                        "name": interface.name,
                        "id": interface_id,
                        "status": "success",
                        "ip_assigned": False,
                        "ip_assignment_error": None
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
                                data=assignment_payload
                            )
                            interface_result["ip_assigned"] = True
                            logger.info(f"Assigned IP {interface.ip_address} to interface {interface.name}")
                            
                            # Save first IPv4 address for primary IP
                            if primary_ipv4_id is None and interface.ip_address and "/" in interface.ip_address:
                                if ":" not in interface.ip_address:
                                    primary_ipv4_id = ip_id
                                    
                        except Exception as e:
                            interface_result["ip_assignment_error"] = str(e)
                            logger.error(f"Failed to assign IP to interface: {str(e)}")
                    
                    workflow_status["step3_interfaces"]["data"].append(interface_result)
                    created_interfaces.append(interface_response)
                else:
                    workflow_status["step3_interfaces"]["errors"].append({
                        "interface": interface.name,
                        "error": "No interface ID returned from Nautobot"
                    })
                    logger.warning(f"Failed to create interface {interface.name}")
                    
            except Exception as e:
                error_msg = str(e)
                workflow_status["step3_interfaces"]["errors"].append({
                    "interface": interface.name,
                    "error": error_msg
                })
                logger.error(f"Error creating interface {interface.name}: {error_msg}")
        
        success_count = len(workflow_status["step3_interfaces"]["data"])
        error_count = len(workflow_status["step3_interfaces"]["errors"])
        
        if success_count > 0 and error_count == 0:
            workflow_status["step3_interfaces"]["status"] = "success"
            workflow_status["step3_interfaces"]["message"] = f"Created {success_count} interface(s) successfully"
        elif success_count > 0 and error_count > 0:
            workflow_status["step3_interfaces"]["status"] = "partial"
            workflow_status["step3_interfaces"]["message"] = f"Created {success_count} interface(s), {error_count} failed"
        elif success_count == 0 and error_count > 0:
            workflow_status["step3_interfaces"]["status"] = "failed"
            workflow_status["step3_interfaces"]["message"] = f"Failed to create all {error_count} interface(s)"
        else:
            workflow_status["step3_interfaces"]["status"] = "skipped"
            workflow_status["step3_interfaces"]["message"] = "No interfaces to create"
        
        # Step 4: Assign primary IPv4 address (skeleton)
        logger.info("Step 4: Assigning primary IPv4 (skeleton)")
        workflow_status["step4_primary_ip"]["status"] = "in_progress"
        
        if primary_ipv4_id:
            success = await _assign_primary_ipv4(device_id, primary_ipv4_id)
            if success:
                workflow_status["step4_primary_ip"]["status"] = "success"
                workflow_status["step4_primary_ip"]["message"] = "Primary IPv4 assignment (skeleton)"
                workflow_status["step4_primary_ip"]["data"] = {"ip_id": primary_ipv4_id}
                logger.info(f"Primary IPv4 assigned: {primary_ipv4_id}")
            else:
                workflow_status["step4_primary_ip"]["status"] = "failed"
                workflow_status["step4_primary_ip"]["message"] = "Failed to assign primary IPv4"
                logger.warning("Failed to assign primary IPv4")
        else:
            workflow_status["step4_primary_ip"]["status"] = "skipped"
            workflow_status["step4_primary_ip"]["message"] = "No IPv4 address available for primary IP"
            logger.info("No IPv4 address found for primary IP assignment")
        
        # Determine overall success
        overall_success = (
            workflow_status["step1_device"]["status"] == "success" and
            workflow_status["step3_interfaces"]["status"] in ["success", "partial"]
        )
        
        return {
            "success": overall_success,
            "message": f"Device '{request.name}' workflow completed",
            "device_id": device_id,
            "device": device_response,
            "workflow_status": workflow_status,
            "summary": {
                "device_created": workflow_status["step1_device"]["status"] == "success",
                "interfaces_created": len(created_interfaces),
                "interfaces_failed": len(workflow_status["step3_interfaces"]["errors"]),
                "ip_addresses_created": len(ip_address_map),
                "ip_addresses_failed": len(workflow_status["step2_ip_addresses"]["errors"]),
                "primary_ipv4_assigned": primary_ipv4_id is not None,
            }
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
    Skeleton function to assign primary IPv4 address to a device.
    
    Args:
        device_id: The Nautobot device ID
        ip_address_id: The Nautobot IP address ID to set as primary
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # TODO: Implement primary IP assignment
        # This is a skeleton for now - to be implemented later
        logger.info(f"[SKELETON] Would assign primary IPv4 {ip_address_id} to device {device_id}")
        
        # When implemented, should do:
        # await nautobot_service.rest_request(
        #     endpoint=f"dcim/devices/{device_id}/",
        #     method="PATCH",
        #     data={"primary_ip4": ip_address_id}
        # )
        
        return True
    except Exception as e:
        logger.error(f"Error in _assign_primary_ipv4: {str(e)}")
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


# Additional endpoints for various Nautobot resources
@router.get("/locations")
async def get_locations(
    current_user: dict = Depends(require_permission("nautobot.locations", "read")),
):
    """Get list of locations from Nautobot with parent and children relationships."""
    try:
        # Try in-memory cache first
        from services.cache_service import cache_service
        from settings_manager import settings_manager

        cache_key = "nautobot:locations:list"
        cached = cache_service.get(cache_key)
        if cached is not None:
            return cached

        # Cache miss; fetch from Nautobot and populate cache
        query = """
                query locations {
                    locations {
                        id
                        name
                        description
                        parent {
                            id
                            name
                            description
                        }
                        children {
                            id
                            name
                            description
                        }
                    }
                }
                """
        result = await nautobot_service.graphql_query(query)

        if "errors" in result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"GraphQL errors: {result['errors']}",
            )

        locations = result["data"]["locations"]
        ttl = int(settings_manager.get_cache_settings().get("ttl_seconds", 600))
        cache_service.set(cache_key, locations, ttl)
        return locations
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch locations: {str(e)}",
        )


@router.get("/namespaces")
async def get_namespaces(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get list of namespaces from Nautobot."""
    try:
        query = """
        query {
          namespaces {
            id
            name
            description
          }
        }
        """
        result = await nautobot_service.graphql_query(query)

        if "errors" in result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"GraphQL errors: {result['errors']}",
            )

        return result["data"]["namespaces"]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch namespaces: {str(e)}",
        )


@router.get("/stats")
async def get_nautobot_stats(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get Nautobot statistics with 10-minute caching."""
    from datetime import datetime, timezone, timedelta
    import json
    import os

    # Cache configuration
    cache_duration = timedelta(minutes=10)
    cache_dir = "data/cache"
    cache_file = os.path.join(cache_dir, "nautobot_stats.json")

    # Ensure cache directory exists
    os.makedirs(cache_dir, exist_ok=True)

    # Check if cache exists and is still valid
    if os.path.exists(cache_file):
        try:
            with open(cache_file, "r") as f:
                cache_data = json.load(f)

            cache_timestamp = datetime.fromisoformat(
                cache_data.get("cache_timestamp", "")
            )
            if datetime.now(timezone.utc) - cache_timestamp < cache_duration:
                logger.info("Returning cached Nautobot stats")
                # Remove cache metadata before returning
                stats = cache_data.copy()
                del stats["cache_timestamp"]
                return stats
        except (json.JSONDecodeError, ValueError, KeyError) as e:
            logger.warning(f"Invalid cache file, will refresh: {e}")

    logger.info("Cache expired or missing, fetching fresh Nautobot stats")

    try:
        # Get device counts by status
        devices_result = await nautobot_service.rest_request("dcim/devices/")
        locations_result = await nautobot_service.rest_request("dcim/locations/")
        device_types_result = await nautobot_service.rest_request("dcim/device-types/")

        # Try to get IP addresses and prefixes (might not exist in all Nautobot versions)
        try:
            ip_addresses_result = await nautobot_service.rest_request(
                "ipam/ip-addresses/"
            )
            ip_addresses_count = ip_addresses_result.get("count", 0)
        except Exception:
            ip_addresses_count = 0

        try:
            prefixes_result = await nautobot_service.rest_request("ipam/prefixes/")
            prefixes_count = prefixes_result.get("count", 0)
        except Exception:
            prefixes_count = 0

        from datetime import datetime, timezone

        stats = {
            # Frontend expects these exact field names
            "devices": devices_result.get("count", 0),
            "locations": locations_result.get("count", 0),
            "device_types": device_types_result.get("count", 0),
            "ip_addresses": ip_addresses_count,
            "prefixes": prefixes_count,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            # Keep backward compatibility
            "total_devices": devices_result.get("count", 0),
            "total_locations": locations_result.get("count", 0),
            "total_device_types": device_types_result.get("count", 0),
        }

        # Save to cache with timestamp
        cache_data = stats.copy()
        cache_data["cache_timestamp"] = datetime.now(timezone.utc).isoformat()

        try:
            with open(cache_file, "w") as f:
                json.dump(cache_data, f)
            logger.info("Nautobot stats cached successfully")
        except Exception as cache_error:
            logger.warning(f"Failed to cache stats: {cache_error}")

        return stats
    except Exception as e:
        logger.error(f"Error fetching Nautobot stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch statistics: {str(e)}",
        )


@router.get("/roles")
async def get_nautobot_roles(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get Nautobot device roles."""
    try:
        result = await nautobot_service.rest_request("extras/roles/")
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch roles: {str(e)}",
        )


@router.get("/roles/devices")
async def get_nautobot_device_roles(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get Nautobot roles specifically for dcim.device content type."""
    try:
        result = await nautobot_service.rest_request(
            "extras/roles/?content_types=dcim.device"
        )
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch device roles: {str(e)}",
        )


@router.get("/platforms")
async def get_nautobot_platforms(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get Nautobot platforms."""
    try:
        result = await nautobot_service.rest_request("dcim/platforms/")
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch platforms: {str(e)}",
        )


@router.get("/statuses")
async def get_nautobot_statuses(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get all Nautobot statuses."""
    try:
        result = await nautobot_service.rest_request("extras/statuses/")
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch statuses: {str(e)}",
        )


@router.get("/statuses/device")
async def get_nautobot_device_statuses(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get Nautobot device statuses."""
    try:
        result = await nautobot_service.rest_request(
            "extras/statuses/?content_types=dcim.device"
        )
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch device statuses: {str(e)}",
        )


@router.get("/statuses/interface")
async def get_nautobot_interface_statuses(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get Nautobot interface statuses."""
    try:
        result = await nautobot_service.rest_request(
            "extras/statuses/?content_types=dcim.interface"
        )
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch interface statuses: {str(e)}",
        )


@router.get("/statuses/ipaddress")
async def get_nautobot_ipaddress_statuses(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get Nautobot IP address statuses."""
    try:
        result = await nautobot_service.rest_request(
            "extras/statuses/?content_types=ipam.ipaddress"
        )
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch IP address statuses: {str(e)}",
        )


@router.get("/statuses/prefix")
async def get_nautobot_prefix_statuses(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get Nautobot prefix statuses."""
    try:
        result = await nautobot_service.rest_request(
            "extras/statuses/?content_types=ipam.prefix"
        )
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch prefix statuses: {str(e)}",
        )


@router.get("/statuses/combined")
async def get_nautobot_combined_statuses(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get combined Nautobot statuses."""
    try:
        result = await nautobot_service.rest_request("extras/statuses/")
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch combined statuses: {str(e)}",
        )


@router.get("/secret-groups")
async def get_nautobot_secret_groups(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get Nautobot secret groups."""
    try:
        # Use GraphQL query as specified in nautobot_access.md
        query = """
        query secrets_groups {
          secrets_groups {
            id
            name
          }
        }
        """
        result = await nautobot_service.graphql_query(query)

        if "errors" in result:
            logger.warning(f"GraphQL errors fetching secret groups: {result['errors']}")
            return []

        return result["data"]["secrets_groups"]
    except Exception as e:
        # Return empty list if secret groups don't exist
        logger.warning(f"Secret groups endpoint not available: {str(e)}")
        return []


@router.get("/device-types")
async def get_nautobot_device_types(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get Nautobot device types."""
    try:
        result = await nautobot_service.rest_request("dcim/device-types/")
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch device types: {str(e)}",
        )


@router.get("/manufacturers")
async def get_nautobot_manufacturers(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get Nautobot manufacturers."""
    try:
        result = await nautobot_service.rest_request("dcim/manufacturers/")
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch manufacturers: {str(e)}",
        )


@router.get("/tags")
async def get_nautobot_tags(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get Nautobot tags."""
    try:
        result = await nautobot_service.rest_request("extras/tags/")
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch tags: {str(e)}",
        )


@router.get("/tags/devices")
async def get_nautobot_device_tags(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get Nautobot tags specifically for dcim.device content type."""
    try:
        result = await nautobot_service.rest_request(
            "extras/tags/?content_types=dcim.device"
        )
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch device tags: {str(e)}",
        )


@router.get("/custom-fields/devices")
async def get_nautobot_device_custom_fields(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get Nautobot custom fields specifically for dcim.device content type."""
    try:
        result = await nautobot_service.rest_request(
            "extras/custom-fields/?content_types=dcim.device"
        )
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch device custom fields: {str(e)}",
        )


@router.get("/custom-field-choices/{custom_field_name}")
async def get_nautobot_custom_field_choices(
    custom_field_name: str,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get Nautobot custom field choices for a specific custom field."""
    try:
        result = await nautobot_service.rest_request(
            f"extras/custom-field-choices/?custom_field={custom_field_name}"
        )
        return result.get("results", [])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch custom field choices for {custom_field_name}: {str(e)}",
        )


@router.get("/jobs/{job_id}/results")
async def get_job_results(
    job_id: str,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get job results from Nautobot."""
    try:
        result = await nautobot_service.rest_request(f"extras/job-results/{job_id}/")

        # Extract the status value from the response
        status_value = result.get("status", {}).get("value")

        return {"status": status_value}
    except Exception as e:
        error_msg = str(e)

        # Check if it's a 404 Not Found error from Nautobot
        if "404" in error_msg or "Not Found" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Job result not found: {job_id}",
            )

        logger.error(f"Error fetching job result {job_id}: {error_msg}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch job result: {error_msg}",
        )


@router.get("/health-check")
async def nautobot_health_check(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Simple health check to verify Nautobot connectivity."""
    try:
        # Use the same test approach as the nautobot service - query devices with limit 1
        result = await nautobot_service.rest_request("dcim/devices/?limit=1")
        return {
            "status": "connected",
            "message": "Nautobot is accessible",
            "devices_count": result.get("count", 0),
        }
    except Exception as e:
        # Log the full exception details for debugging
        logger.error(f"Nautobot health check failed: {str(e)}", exc_info=True)

        error_msg = str(e)
        error_type = type(e).__name__

        # Include detailed error information in the response
        detailed_error = {
            "error_message": error_msg,
            "error_type": error_type,
            "error_details": str(e.__dict__) if hasattr(e, "__dict__") else None,
        }

        if "403" in error_msg or "Invalid token" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Nautobot connection failed: Invalid or missing API token. Please check Nautobot settings. Details: {detailed_error}",
            )
        elif "ConnectionError" in error_msg or "timeout" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Nautobot connection failed: Cannot reach Nautobot server. Please check Nautobot URL and connectivity. Details: {detailed_error}",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Nautobot connection failed: {error_msg}. Error type: {error_type}. Details: {detailed_error}",
            )


@router.get("/devices/{device_id}/details")
async def get_device_details(
    device_id: str,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """Get detailed device information using the comprehensive devices.md query."""
    try:
        # Start with a simplified query based on the working get_device method, then add more fields
        query = """
        query DeviceDetails($deviceId: ID!) {
            device(id: $deviceId) {
                id
                name
                hostname: name
                asset_tag
                serial
                position
                face
                config_context
                local_config_context_data
                _custom_field_data
                primary_ip4 {
                    id
                    address
                    description
                    ip_version
                    host
                    mask_length
                    dns_name
                    status {
                        id
                        name
                    }
                    parent {
                        id
                        prefix
                    }
                }
                role {
                    id
                    name
                }
                device_type {
                    id
                    model
                    manufacturer {
                        id
                        name
                    }
                }
                platform {
                    id
                    name
                    network_driver
                    manufacturer {
                        id
                        name
                    }
                }
                location {
                    id
                    name
                    description
                    parent {
                        id
                        name
                    }
                }
                status {
                    id
                    name
                }
                interfaces {
                    id
                    name
                    type
                    enabled
                    mtu
                    mac_address
                    description
                    status {
                        id
                        name
                    }
                    ip_addresses {
                        id
                        address
                        ip_version
                        status {
                            id
                            name
                        }
                    }
                    connected_interface {
                        id
                        name
                        device {
                            id
                            name
                        }
                    }
                    cable {
                        id
                        status {
                            id
                            name
                        }
                    }
                    tagged_vlans {
                        id
                        name
                        vid
                    }
                    untagged_vlan {
                        id
                        name
                        vid
                    }
                }
                console_ports {
                    id
                    name
                    type
                    description
                }
                console_server_ports {
                    id
                    name
                    type
                    description
                }
                power_ports {
                    id
                    name
                    type
                    description
                }
                power_outlets {
                    id
                    name
                    type
                    description
                }
                secrets_group {
                    id
                    name
                }
                tags {
                    id
                    name
                    color
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
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Device {device_id} not found",
            )

        # Cache the device details
        cache_key = f"nautobot:device_details:{device_id}"
        cache_service.set(cache_key, device, DEVICE_CACHE_TTL)

        return device
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching device details for {device_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch device details: {str(e)}",
        )


@router.delete("/devices/{device_id}")
async def delete_device(
    device_id: str,
    current_user: dict = Depends(require_permission("nautobot.devices", "delete")),
):
    """Delete a device from Nautobot."""
    try:
        # Use REST API to delete the device
        await nautobot_service.rest_request(
            f"dcim/devices/{device_id}/", method="DELETE"
        )

        # Clear device from cache
        cache_key = _get_device_cache_key(device_id)
        cache_service.delete(cache_key)

        # Clear device details cache
        details_cache_key = f"nautobot:device_details:{device_id}"
        cache_service.delete(details_cache_key)

        # Clear device list caches to force refresh
        cache_keys_to_clear = [
            "nautobot:devices:list:all",
        ]
        for key in cache_keys_to_clear:
            cache_service.delete(key)

        return {
            "success": True,
            "message": f"Device {device_id} deleted successfully",
            "device_id": device_id,
        }

    except Exception as e:
        logger.error(f"Error deleting device {device_id}: {str(e)}")
        if "404" in str(e) or "Not Found" in str(e):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Device {device_id} not found",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete device: {str(e)}",
        )


@router.delete("/ip-address/{ip_id}")
async def delete_ip_address(
    ip_id: str,
    current_user: dict = Depends(require_permission("nautobot.devices", "delete")),
):
    """Delete an IP address from Nautobot."""
    try:
        # Use REST API to delete the IP address
        await nautobot_service.rest_request(
            f"ipam/ip-addresses/{ip_id}/", method="DELETE"
        )

        # Clear related caches
        cache_keys_to_clear = [
            f"nautobot:ip_address:{ip_id}",
            "nautobot:devices:list:all",  # Device list might contain IP address info
        ]
        for key in cache_keys_to_clear:
            cache_service.delete(key)

        return {
            "success": True,
            "message": f"IP address {ip_id} deleted successfully",
            "ip_id": ip_id,
        }

    except Exception as e:
        logger.error(f"Error deleting IP address {ip_id}: {str(e)}")
        if "404" in str(e) or "Not Found" in str(e):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"IP address {ip_id} not found",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete IP address: {str(e)}",
        )


@router.post("/offboard/{device_id}")
async def offboard_device(
    device_id: str,
    request: OffboardDeviceRequest,
    current_user: dict = Depends(require_permission("devices.offboard", "execute")),
):
    """Offboard a device by removing it or applying configured offboarding values."""
    try:
        return await offboarding_service.offboard_device(
            device_id=device_id,
            request=request,
            current_user=current_user,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Unexpected error during offboard process for device %s: %s",
            device_id,
            str(e),
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Offboarding failed: {str(e)}",
        )


# =============================================================================
# IPAM Prefix Endpoints
# =============================================================================


@router.get("/ipam/prefixes")
async def get_ipam_prefixes(
    prefix: Optional[str] = None,
    namespace: Optional[str] = None,
    location: Optional[str] = None,
    status: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = None,
    current_user: dict = Depends(require_permission("nautobot.locations", "read")),
):
    """
    Get IP prefixes from Nautobot IPAM.
    
    Query parameters:
    - prefix: Filter by prefix (e.g., "10.0.0.0/8")
    - namespace: Filter by namespace name
    - location: Filter by location name
    - status: Filter by status (e.g., "active", "reserved", "deprecated")
    - limit: Maximum number of results
    - offset: Pagination offset
    """
    try:
        # Build query parameters
        params = {}
        if prefix:
            params["prefix"] = prefix
        if namespace:
            params["namespace"] = namespace
        if location:
            params["location"] = location
        if status:
            params["status"] = status
        if limit:
            params["limit"] = limit
        if offset:
            params["offset"] = offset
        
        # Build endpoint URL with query parameters
        endpoint = "ipam/prefixes/"
        if params:
            query_string = "&".join([f"{k}={v}" for k, v in params.items()])
            endpoint = f"{endpoint}?{query_string}"
        
        result = await nautobot_service.rest_request(endpoint, method="GET")
        
        logger.info(f"Retrieved {result.get('count', 0)} prefixes from Nautobot IPAM")
        return result
        
    except Exception as e:
        logger.error(f"Failed to get IPAM prefixes: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve IPAM prefixes: {str(e)}",
        )


@router.get("/ipam/prefixes/{prefix_id}")
async def get_ipam_prefix(
    prefix_id: str,
    current_user: dict = Depends(require_permission("nautobot.locations", "read")),
):
    """
    Get a specific IP prefix by ID from Nautobot IPAM.
    
    Parameters:
    - prefix_id: The UUID of the prefix
    """
    try:
        endpoint = f"ipam/prefixes/{prefix_id}/"
        result = await nautobot_service.rest_request(endpoint, method="GET")
        
        logger.info(f"Retrieved prefix {prefix_id} from Nautobot IPAM")
        return result
        
    except Exception as e:
        logger.error(f"Failed to get IPAM prefix {prefix_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND if "404" in str(e) else status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve IPAM prefix: {str(e)}",
        )


@router.post("/ipam/prefixes")
async def create_ipam_prefix(
    prefix_data: dict,
    current_user: dict = Depends(require_permission("nautobot.locations", "write")),
):
    """
    Create a new IP prefix in Nautobot IPAM.
    
    Request body should contain:
    - prefix: The IP prefix (e.g., "10.0.0.0/24")
    - namespace: Namespace ID or name
    - status: Status ID or name (e.g., "active")
    - type: Prefix type (e.g., "network", "pool")
    - location: (optional) Location ID
    - description: (optional) Description
    - tags: (optional) List of tag IDs
    
    Example:
    {
        "prefix": "10.0.0.0/24",
        "namespace": "global",
        "status": "active",
        "type": "network",
        "description": "Management network"
    }
    """
    try:
        # Validate required fields
        if "prefix" not in prefix_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required field: prefix"
            )
        if "namespace" not in prefix_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required field: namespace"
            )
        
        endpoint = "ipam/prefixes/"
        result = await nautobot_service.rest_request(
            endpoint, 
            method="POST", 
            data=prefix_data
        )
        
        logger.info(f"Created prefix {prefix_data.get('prefix')} in Nautobot IPAM")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create IPAM prefix: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create IPAM prefix: {str(e)}",
        )


@router.put("/ipam/prefixes/{prefix_id}")
@router.patch("/ipam/prefixes/{prefix_id}")
async def update_ipam_prefix(
    prefix_id: str,
    prefix_data: dict,
    current_user: dict = Depends(require_permission("nautobot.locations", "write")),
):
    """
    Update an existing IP prefix in Nautobot IPAM.
    
    Parameters:
    - prefix_id: The UUID of the prefix to update
    
    Request body can contain any updatable fields:
    - prefix: The IP prefix
    - namespace: Namespace ID
    - status: Status ID
    - type: Prefix type
    - location: Location ID
    - description: Description
    - tags: List of tag IDs
    """
    try:
        endpoint = f"ipam/prefixes/{prefix_id}/"
        
        # Use PATCH for partial updates (from @router.patch), PUT for full replacement
        # Both decorators point to the same function, so we always use PATCH internally
        result = await nautobot_service.rest_request(
            endpoint, 
            method="PATCH",  # Use PATCH for partial updates
            data=prefix_data
        )
        
        logger.info(f"Updated prefix {prefix_id} in Nautobot IPAM")
        return result
        
    except Exception as e:
        logger.error(f"Failed to update IPAM prefix {prefix_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND if "404" in str(e) else status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update IPAM prefix: {str(e)}",
        )


@router.delete("/ipam/prefixes/{prefix_id}")
async def delete_ipam_prefix(
    prefix_id: str,
    current_user: dict = Depends(require_permission("nautobot.locations", "delete")),
):
    """
    Delete an IP prefix from Nautobot IPAM.
    
    Parameters:
    - prefix_id: The UUID of the prefix to delete
    """
    try:
        endpoint = f"ipam/prefixes/{prefix_id}/"
        result = await nautobot_service.rest_request(endpoint, method="DELETE")
        
        logger.info(f"Deleted prefix {prefix_id} from Nautobot IPAM")
        return result
        
    except Exception as e:
        logger.error(f"Failed to delete IPAM prefix {prefix_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND if "404" in str(e) else status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete IPAM prefix: {str(e)}",
        )


# IPAM IP Address Endpoints
# =============================================================================


@router.get("/ipam/ip-addresses")
async def get_ipam_ip_addresses(
    address: Optional[str] = None,
    namespace: Optional[str] = None,
    parent: Optional[str] = None,
    status: Optional[str] = None,
    dns_name: Optional[str] = None,
    device: Optional[str] = None,
    interface: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = None,
    current_user: dict = Depends(require_permission("nautobot.locations", "read")),
):
    """
    Get IP addresses from Nautobot IPAM.
    
    Query parameters:
    - address: Filter by IP address (e.g., "192.168.1.1")
    - namespace: Filter by namespace name
    - parent: Filter by parent prefix ID
    - status: Filter by status (e.g., "active", "reserved", "deprecated")
    - dns_name: Filter by DNS name
    - device: Filter by device name or ID
    - interface: Filter by interface name or ID
    - limit: Maximum number of results
    - offset: Pagination offset
    """
    try:
        # Build query parameters
        params = {}
        if address:
            params["address"] = address
        if namespace:
            params["namespace"] = namespace
        if parent:
            params["parent"] = parent
        if status:
            params["status"] = status
        if dns_name:
            params["dns_name"] = dns_name
        if device:
            params["device"] = device
        if interface:
            params["interface"] = interface
        if limit:
            params["limit"] = limit
        if offset:
            params["offset"] = offset
        
        # Build endpoint URL with query parameters
        endpoint = "ipam/ip-addresses/"
        if params:
            query_string = "&".join([f"{k}={v}" for k, v in params.items()])
            endpoint = f"{endpoint}?{query_string}"
        
        result = await nautobot_service.rest_request(endpoint, method="GET")
        
        logger.info(f"Retrieved {result.get('count', 0)} IP addresses from Nautobot IPAM")
        return result
        
    except Exception as e:
        logger.error(f"Failed to get IPAM IP addresses: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve IPAM IP addresses: {str(e)}",
        )


@router.get("/ipam/ip-addresses/{ip_address_id}")
async def get_ipam_ip_address(
    ip_address_id: str,
    current_user: dict = Depends(require_permission("nautobot.locations", "read")),
):
    """
    Get a specific IP address by ID from Nautobot IPAM.
    
    Parameters:
    - ip_address_id: The UUID of the IP address
    """
    try:
        endpoint = f"ipam/ip-addresses/{ip_address_id}/"
        result = await nautobot_service.rest_request(endpoint, method="GET")
        
        logger.info(f"Retrieved IP address {ip_address_id} from Nautobot IPAM")
        return result
        
    except Exception as e:
        logger.error(f"Failed to get IPAM IP address {ip_address_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND if "404" in str(e) else status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve IPAM IP address: {str(e)}",
        )


@router.post("/ipam/ip-addresses")
async def create_ipam_ip_address(
    ip_address_data: dict,
    current_user: dict = Depends(require_permission("nautobot.locations", "write")),
):
    """
    Create a new IP address in Nautobot IPAM.
    
    Request body should contain:
    - address: The IP address with mask (e.g., "192.168.1.1/24" or "192.168.1.1")
    - namespace: Namespace ID (optional, defaults to Global)
    - status: Status ID or name (e.g., "active")
    - type: Address type (e.g., "host", "anycast", "loopback")
    - parent: (optional) Parent prefix ID
    - dns_name: (optional) DNS name
    - description: (optional) Description
    - tags: (optional) List of tag IDs
    
    Example:
    {
        "address": "192.168.1.100/24",
        "namespace": "global",
        "status": "active",
        "type": "host",
        "dns_name": "server.example.com",
        "description": "Application server"
    }
    """
    try:
        # Validate required fields
        if "address" not in ip_address_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required field: address"
            )
        
        endpoint = "ipam/ip-addresses/"
        result = await nautobot_service.rest_request(
            endpoint, 
            method="POST", 
            data=ip_address_data
        )
        
        logger.info(f"Created IP address {ip_address_data.get('address')} in Nautobot IPAM")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create IPAM IP address: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create IPAM IP address: {str(e)}",
        )


@router.put("/ipam/ip-addresses/{ip_address_id}")
@router.patch("/ipam/ip-addresses/{ip_address_id}")
async def update_ipam_ip_address(
    ip_address_id: str,
    ip_address_data: dict,
    current_user: dict = Depends(require_permission("nautobot.locations", "write")),
):
    """
    Update an existing IP address in Nautobot IPAM.
    
    Parameters:
    - ip_address_id: The UUID of the IP address to update
    
    Request body can contain any updatable fields:
    - address: The IP address with mask
    - namespace: Namespace ID
    - status: Status ID
    - type: Address type
    - parent: Parent prefix ID
    - dns_name: DNS name
    - description: Description
    - tags: List of tag IDs
    """
    try:
        endpoint = f"ipam/ip-addresses/{ip_address_id}/"
        
        # Use PATCH for partial updates
        result = await nautobot_service.rest_request(
            endpoint, 
            method="PATCH",
            data=ip_address_data
        )
        
        logger.info(f"Updated IP address {ip_address_id} in Nautobot IPAM")
        return result
        
    except Exception as e:
        logger.error(f"Failed to update IPAM IP address {ip_address_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND if "404" in str(e) else status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update IPAM IP address: {str(e)}",
        )


@router.delete("/ipam/ip-addresses/{ip_address_id}")
async def delete_ipam_ip_address(
    ip_address_id: str,
    current_user: dict = Depends(require_permission("nautobot.locations", "delete")),
):
    """
    Delete an IP address from Nautobot IPAM.
    
    Parameters:
    - ip_address_id: The UUID of the IP address to delete
    """
    try:
        endpoint = f"ipam/ip-addresses/{ip_address_id}/"
        result = await nautobot_service.rest_request(endpoint, method="DELETE")
        
        logger.info(f"Deleted IP address {ip_address_id} from Nautobot IPAM")
        return result
        
    except Exception as e:
        logger.error(f"Failed to delete IPAM IP address {ip_address_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND if "404" in str(e) else status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete IPAM IP address: {str(e)}",
        )


@router.post("/ipam/ip-address-to-interface")
async def assign_ip_address_to_interface(
    assignment_data: dict,
    current_user: dict = Depends(require_permission("nautobot.locations", "write")),
):
    """
    Assign an IP address to an interface in Nautobot.
    
    This endpoint creates an IP address to interface assignment using the
    Nautobot REST API endpoint /api/ipam/ip-address-to-interface/.
    
    Request body should contain:
    - ip_address: IP address ID (UUID)
    - interface: Interface ID (UUID)
    
    Example:
    {
        "ip_address": "uuid-of-ip-address",
        "interface": "uuid-of-interface"
    }
    
    Returns the created assignment object.
    """
    try:
        # Validate required fields
        if "ip_address" not in assignment_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required field: ip_address"
            )
        if "interface" not in assignment_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required field: interface"
            )
        
        endpoint = "ipam/ip-address-to-interface/"
        result = await nautobot_service.rest_request(
            endpoint, 
            method="POST", 
            data=assignment_data
        )
        
        logger.info(f"Assigned IP address {assignment_data.get('ip_address')} to interface {assignment_data.get('interface')}")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to assign IP address to interface: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to assign IP address to interface: {str(e)}",
        )


# DCIM Device Endpoints
# =============================================================================


@router.get("/dcim/devices")
async def get_dcim_devices(
    name: Optional[str] = None,
    location: Optional[str] = None,
    role: Optional[str] = None,
    device_type: Optional[str] = None,
    platform: Optional[str] = None,
    status: Optional[str] = None,
    tenant: Optional[str] = None,
    tag: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = None,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """
    Get devices from Nautobot DCIM.
    
    Query parameters:
    - name: Filter by device name
    - location: Filter by location name or ID
    - role: Filter by role name or ID
    - device_type: Filter by device type name or ID
    - platform: Filter by platform name or ID
    - status: Filter by status (e.g., "active", "planned", "offline")
    - tenant: Filter by tenant name or ID
    - tag: Filter by tag name
    - limit: Maximum number of results
    - offset: Pagination offset
    """
    try:
        # Build query parameters
        params = {}
        if name:
            params["name"] = name
        if location:
            params["location"] = location
        if role:
            params["role"] = role
        if device_type:
            params["device_type"] = device_type
        if platform:
            params["platform"] = platform
        if status:
            params["status"] = status
        if tenant:
            params["tenant"] = tenant
        if tag:
            params["tag"] = tag
        if limit:
            params["limit"] = limit
        if offset:
            params["offset"] = offset
        
        # Build endpoint URL with query parameters
        endpoint = "dcim/devices/"
        if params:
            query_string = "&".join([f"{k}={v}" for k, v in params.items()])
            endpoint = f"{endpoint}?{query_string}"
        
        result = await nautobot_service.rest_request(endpoint, method="GET")
        
        logger.info(f"Retrieved {result.get('count', 0)} devices from Nautobot DCIM")
        return result
        
    except Exception as e:
        logger.error(f"Failed to get DCIM devices: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve DCIM devices: {str(e)}",
        )


@router.get("/dcim/devices/{device_id}")
async def get_dcim_device(
    device_id: str,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """
    Get a specific device by ID from Nautobot DCIM.
    
    Parameters:
    - device_id: The UUID of the device
    """
    try:
        endpoint = f"dcim/devices/{device_id}/"
        result = await nautobot_service.rest_request(endpoint, method="GET")
        
        logger.info(f"Retrieved device {device_id} from Nautobot DCIM")
        return result
        
    except Exception as e:
        logger.error(f"Failed to get DCIM device {device_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND if "404" in str(e) else status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve DCIM device: {str(e)}",
        )


@router.post("/dcim/devices")
async def create_dcim_device(
    device_data: dict,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
):
    """
    Create a new device in Nautobot DCIM.
    
    Request body should contain:
    - name: Device name (required)
    - device_type: Device type ID (required)
    - role: Role ID (required)
    - location: Location ID (required)
    - status: Status ID or name (required)
    - platform: (optional) Platform ID
    - serial: (optional) Serial number
    - asset_tag: (optional) Asset tag
    - tenant: (optional) Tenant ID
    - rack: (optional) Rack ID
    - position: (optional) Rack position
    - face: (optional) Rack face ("front" or "rear")
    - primary_ip4: (optional) Primary IPv4 address ID
    - primary_ip6: (optional) Primary IPv6 address ID
    - comments: (optional) Comments
    - tags: (optional) List of tag IDs
    - custom_fields: (optional) Custom field values
    
    Example:
    {
        "name": "switch-01",
        "device_type": "device-type-uuid",
        "role": "role-uuid",
        "location": "location-uuid",
        "status": "active",
        "platform": "platform-uuid",
        "serial": "SN123456",
        "comments": "Main distribution switch"
    }
    """
    try:
        # Validate required fields
        required_fields = ["name", "device_type", "role", "location", "status"]
        missing_fields = [field for field in required_fields if field not in device_data]
        
        if missing_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required fields: {', '.join(missing_fields)}"
            )
        
        endpoint = "dcim/devices/"
        result = await nautobot_service.rest_request(
            endpoint, 
            method="POST", 
            data=device_data
        )
        
        logger.info(f"Created device {device_data.get('name')} in Nautobot DCIM")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create DCIM device: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create DCIM device: {str(e)}",
        )


@router.put("/dcim/devices/{device_id}")
@router.patch("/dcim/devices/{device_id}")
async def update_dcim_device(
    device_id: str,
    device_data: dict,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
):
    """
    Update an existing device in Nautobot DCIM.
    
    Parameters:
    - device_id: The UUID of the device to update
    
    Request body can contain any updatable fields:
    - name: Device name
    - device_type: Device type ID
    - role: Role ID
    - location: Location ID
    - status: Status ID
    - platform: Platform ID
    - serial: Serial number
    - asset_tag: Asset tag
    - tenant: Tenant ID
    - rack: Rack ID
    - position: Rack position
    - face: Rack face
    - primary_ip4: Primary IPv4 address ID
    - primary_ip6: Primary IPv6 address ID
    - comments: Comments
    - tags: List of tag IDs
    - custom_fields: Custom field values
    """
    try:
        endpoint = f"dcim/devices/{device_id}/"
        
        # Use PATCH for partial updates
        result = await nautobot_service.rest_request(
            endpoint, 
            method="PATCH",
            data=device_data
        )
        
        logger.info(f"Updated device {device_id} in Nautobot DCIM")
        return result
        
    except Exception as e:
        logger.error(f"Failed to update DCIM device {device_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND if "404" in str(e) else status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update DCIM device: {str(e)}",
        )


@router.delete("/dcim/devices/{device_id}")
async def delete_dcim_device(
    device_id: str,
    current_user: dict = Depends(require_permission("nautobot.devices", "delete")),
):
    """
    Delete a device from Nautobot DCIM.
    
    Parameters:
    - device_id: The UUID of the device to delete
    """
    try:
        endpoint = f"dcim/devices/{device_id}/"
        result = await nautobot_service.rest_request(endpoint, method="DELETE")
        
        logger.info(f"Deleted device {device_id} from Nautobot DCIM")
        return result
        
    except Exception as e:
        logger.error(f"Failed to delete DCIM device {device_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND if "404" in str(e) else status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete DCIM device: {str(e)}",
        )


# DCIM Interface Endpoints
# =============================================================================


@router.get("/dcim/interfaces")
async def get_dcim_interfaces(
    device: Optional[str] = None,
    device_id: Optional[str] = None,
    name: Optional[str] = None,
    type: Optional[str] = None,
    enabled: Optional[bool] = None,
    mgmt_only: Optional[bool] = None,
    mac_address: Optional[str] = None,
    status: Optional[str] = None,
    limit: Optional[int] = None,
    offset: Optional[int] = None,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """
    Get device interfaces from Nautobot DCIM.
    
    Query parameters:
    - device: Filter by device name
    - device_id: Filter by device ID
    - name: Filter by interface name
    - type: Filter by interface type (e.g., "1000base-t", "10gbase-x-sfpp")
    - enabled: Filter by enabled status (true/false)
    - mgmt_only: Filter by management-only status (true/false)
    - mac_address: Filter by MAC address
    - status: Filter by status
    - limit: Maximum number of results
    - offset: Pagination offset
    """
    try:
        # Build query parameters
        params = {}
        if device:
            params["device"] = device
        if device_id:
            params["device_id"] = device_id
        if name:
            params["name"] = name
        if type:
            params["type"] = type
        if enabled is not None:
            params["enabled"] = str(enabled).lower()
        if mgmt_only is not None:
            params["mgmt_only"] = str(mgmt_only).lower()
        if mac_address:
            params["mac_address"] = mac_address
        if status:
            params["status"] = status
        if limit:
            params["limit"] = limit
        if offset:
            params["offset"] = offset
        
        # Build endpoint URL with query parameters
        endpoint = "dcim/interfaces/"
        if params:
            query_string = "&".join([f"{k}={v}" for k, v in params.items()])
            endpoint = f"{endpoint}?{query_string}"
        
        result = await nautobot_service.rest_request(endpoint, method="GET")
        
        logger.info(f"Retrieved {result.get('count', 0)} interfaces from Nautobot DCIM")
        return result
        
    except Exception as e:
        logger.error(f"Failed to get DCIM interfaces: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve DCIM interfaces: {str(e)}",
        )


@router.get("/dcim/interfaces/{interface_id}")
async def get_dcim_interface(
    interface_id: str,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """
    Get a specific interface by ID from Nautobot DCIM.
    
    Parameters:
    - interface_id: The UUID of the interface
    """
    try:
        endpoint = f"dcim/interfaces/{interface_id}/"
        result = await nautobot_service.rest_request(endpoint, method="GET")
        
        logger.info(f"Retrieved interface {interface_id} from Nautobot DCIM")
        return result
        
    except Exception as e:
        logger.error(f"Failed to get DCIM interface {interface_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND if "404" in str(e) else status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve DCIM interface: {str(e)}",
        )


@router.post("/dcim/interfaces")
async def create_dcim_interface(
    interface_data: dict,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
):
    """
    Create a new interface in Nautobot DCIM.
    
    Request body should contain:
    - name: Interface name (required)
    - device: Device ID (required)
    - type: Interface type (required, e.g., "1000base-t", "10gbase-x-sfpp")
    - status: Status ID or name (required)
    - enabled: Enable status (optional, default: true)
    - mgmt_only: Management-only flag (optional, default: false)
    - description: Description (optional)
    - mac_address: MAC address (optional)
    - mtu: MTU size (optional)
    - mode: Interface mode (optional, e.g., "access", "tagged")
    - untagged_vlan: Untagged VLAN ID (optional)
    - tagged_vlans: List of tagged VLAN IDs (optional)
    - parent_interface: Parent interface ID for sub-interfaces (optional)
    - bridge: Bridge interface ID (optional)
    - lag: LAG interface ID (optional)
    - tags: List of tag IDs (optional)
    
    Example:
    {
        "name": "GigabitEthernet0/1",
        "device": "device-uuid",
        "type": "1000base-t",
        "status": "active",
        "enabled": true,
        "description": "Uplink to core switch"
    }
    """
    try:
        # Validate required fields
        required_fields = ["name", "device", "type", "status"]
        missing_fields = [field for field in required_fields if field not in interface_data]
        
        if missing_fields:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing required fields: {', '.join(missing_fields)}"
            )
        
        endpoint = "dcim/interfaces/"
        result = await nautobot_service.rest_request(
            endpoint, 
            method="POST", 
            data=interface_data
        )
        
        logger.info(f"Created interface {interface_data.get('name')} on device {interface_data.get('device')} in Nautobot DCIM")
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create DCIM interface: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create DCIM interface: {str(e)}",
        )


@router.put("/dcim/interfaces/{interface_id}")
@router.patch("/dcim/interfaces/{interface_id}")
async def update_dcim_interface(
    interface_id: str,
    interface_data: dict,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
):
    """
    Update an existing interface in Nautobot DCIM.
    
    Parameters:
    - interface_id: The UUID of the interface to update
    
    Request body can contain any updatable fields:
    - name: Interface name
    - device: Device ID
    - type: Interface type
    - status: Status ID
    - enabled: Enable status
    - mgmt_only: Management-only flag
    - description: Description
    - mac_address: MAC address
    - mtu: MTU size
    - mode: Interface mode
    - untagged_vlan: Untagged VLAN ID
    - tagged_vlans: List of tagged VLAN IDs
    - parent_interface: Parent interface ID
    - bridge: Bridge interface ID
    - lag: LAG interface ID
    - tags: List of tag IDs
    """
    try:
        endpoint = f"dcim/interfaces/{interface_id}/"
        
        # Use PATCH for partial updates
        result = await nautobot_service.rest_request(
            endpoint, 
            method="PATCH",
            data=interface_data
        )
        
        logger.info(f"Updated interface {interface_id} in Nautobot DCIM")
        return result
        
    except Exception as e:
        logger.error(f"Failed to update DCIM interface {interface_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND if "404" in str(e) else status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update DCIM interface: {str(e)}",
        )


@router.delete("/dcim/interfaces/{interface_id}")
async def delete_dcim_interface(
    interface_id: str,
    current_user: dict = Depends(require_permission("nautobot.devices", "delete")),
):
    """
    Delete an interface from Nautobot DCIM.
    
    Parameters:
    - interface_id: The UUID of the interface to delete
    """
    try:
        endpoint = f"dcim/interfaces/{interface_id}/"
        result = await nautobot_service.rest_request(endpoint, method="DELETE")
        
        logger.info(f"Deleted interface {interface_id} from Nautobot DCIM")
        return result
        
    except Exception as e:
        logger.error(f"Failed to delete DCIM interface {interface_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND if "404" in str(e) else status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete DCIM interface: {str(e)}",
        )
