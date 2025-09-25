"""
Nautobot API router for device management and API interactions.
"""

import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from ..core.security import get_current_user
from ..models.nautobot import (
    DeviceFilter,
    DeviceListResponse,
    Device,
    CheckIPRequest,
    IPAddressCheck,
    DeviceOnboardRequest,
    OnboardingResponse,
    SyncNetworkDataRequest,
    SyncResponse,
    Location,
    NautobotStats,
    HealthCheckResponse,
    ConnectionTestResponse,
    NautobotRole,
    NautobotPlatform,
    NautobotStatus,
    NautobotNamespace,
    NautobotSecretGroup,
)
from ..services.nautobot import nautobot_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/debug/platform-test")
async def test_platform_fields(
    current_user: dict = Depends(get_current_user),
):
    """Test different platform field variations in GraphQL."""
    try:
        username = (
            current_user.get("username")
            if isinstance(current_user, dict)
            else current_user.username
        )

        results = await nautobot_service.test_platform_fields(username)
        return results

    except Exception as e:
        logger.error(f"Platform field test failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Platform field test failed: {str(e)}",
        )


@router.get("/debug/simple-device-test")
async def simple_device_test(
    current_user: dict = Depends(get_current_user),
):
    """Simple test to check device fields including platform."""
    try:
        username = (
            current_user.get("username")
            if isinstance(current_user, dict)
            else current_user.username
        )

        # Simple query to get one device with platform field
        query = """
        query test_device_platform {
          devices(limit: 1) {
            id
            name
            platform {
              network_driver
            }
            device_type {
              model
            }
          }
        }
        """

        print("=== SIMPLE DEVICE TEST ===")
        print(f"Query: {query}")

        result = await nautobot_service.graphql_query(query, {}, username)

        print(f"Result: {result}")
        print("=== END SIMPLE DEVICE TEST ===")

        return {
            "query": query,
            "result": result,
            "analysis": {
                "has_data": "data" in result,
                "has_devices": "devices" in result.get("data", {}),
                "device_count": len(result.get("data", {}).get("devices", [])),
                "first_device": result.get("data", {}).get("devices", [{}])[0] if result.get("data", {}).get("devices") else None
            }
        }

    except Exception as e:
        print(f"Simple device test failed: {str(e)}")
        logger.error(f"Simple device test failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Simple device test failed: {str(e)}",
        )


@router.get("/debug/config")
async def debug_nautobot_config(
    current_user: dict = Depends(get_current_user),
):
    """Debug endpoint to check Nautobot configuration."""
    try:
        username = (
            current_user.get("username")
            if isinstance(current_user, dict)
            else current_user.username
        )
        config = nautobot_service._get_config(username)

        # Return sanitized config for debugging
        return {
            "username": username,
            "config_source": config.get("_source"),
            "url_present": bool(config.get("url")),
            "token_present": bool(config.get("token")),
            "url": config.get("url") if config.get("url") else None,
            "timeout": config.get("timeout"),
            "verify_ssl": config.get("verify_ssl"),
        }
    except Exception as e:
        logger.error(f"Error getting debug config: {str(e)}")
        return {"error": str(e)}


@router.get("/test", response_model=ConnectionTestResponse)
async def test_nautobot_connection(
    current_user: dict = Depends(get_current_user),
):
    """Test current Nautobot connection using configured settings."""
    try:
        from ..core.config import settings

        # Use global environment settings
        if not settings.nautobot_url or not settings.nautobot_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nautobot settings not configured. Please configure Nautobot URL and token.",
            )

        success, message = await nautobot_service.test_connection(
            settings.nautobot_url,
            settings.nautobot_token,
            settings.nautobot_timeout,
            settings.nautobot_verify_ssl,
        )

        return ConnectionTestResponse(
            success=success,
            message=message,
            nautobot_url=settings.nautobot_url,
            connection_source="environment",
        )
    except Exception as e:
        logger.error(f"Error testing Nautobot connection: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to test Nautobot connection: {str(e)}",
        )


@router.get("/devices", response_model=DeviceListResponse)
async def get_devices(
    limit: Optional[int] = None,
    offset: Optional[int] = None,
    filter_type: Optional[str] = None,
    filter_value: Optional[str] = None,
    disable_cache: bool = False,
    current_user: dict = Depends(get_current_user),
):
    """Get list of devices from Nautobot with optional filtering and pagination.
    
    Args:
        limit: Maximum number of devices to return
        offset: Number of devices to skip for pagination
        filter_type: Type of filter to apply ('name', 'location', 'prefix')
        filter_value: Value to filter by
        disable_cache: If True, bypass cache and fetch fresh data from Nautobot
        current_user: Current authenticated user
    """
    try:
        username = (
            current_user.get("username")
            if isinstance(current_user, dict)
            else current_user.username
        )
        logger.info(f"Fetching devices for user: {username}, disable_cache: {disable_cache}")
        result = await nautobot_service.get_devices(
            limit=limit,
            offset=offset,
            filter_type=filter_type,
            filter_value=filter_value,
            username=username,
            disable_cache=disable_cache,
        )
        return DeviceListResponse(**result)
    except Exception as e:
        logger.error(f"Error fetching devices for user {username}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch devices: {str(e)}",
        )


@router.get("/devices/{device_id}", response_model=Device)
async def get_device(
    device_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get specific device details from Nautobot."""
    try:
        username = (
            current_user.get("username")
            if isinstance(current_user, dict)
            else current_user.username
        )
        device = await nautobot_service.get_device(device_id, username=username)
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Device {device_id} not found",
            )
        return Device(**device)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching device {device_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch device {device_id}: {str(e)}",
        )


@router.get("/devices/{device_id}/nautobot-data")
async def get_device_nautobot_data(
    device_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get complete device data from Nautobot including all fields."""
    try:
        username = (
            current_user.get("username")
            if isinstance(current_user, dict)
            else current_user.username
        )

        # Use GraphQL to get all device data
        query = """
        query GetCompleteDeviceData($device_id: ID!) {
          device(id: $device_id) {
            id
            name
            display
            device_type {
              id
              manufacturer {
                name
              }
              model
            }
            role {
              id
              name
            }
            platform {
              id
              name
              network_driver
            }
            location {
              id
              name
              parent {
                name
              }
            }
            status {
              id
              name
            }
            primary_ip4 {
              id
              address
              family
            }
            primary_ip6 {
              id
              address
              family
            }
            serial
            asset_tag
            config_context
            local_config_context_data
            local_config_context_data_owner_content_type {
              model
            }
            local_config_context_data_owner_object_id
            secrets_group {
              id
              name
            }
            tenant {
              id
              name
            }
            cluster {
              id
              name
            }
            virtual_chassis {
              id
              name
            }
            vc_position
            vc_priority
            comments
            last_updated
            created
            custom_fields
            tags {
              id
              name
            }
            cf_last_backup
          }
        }
        """

        variables = {"device_id": device_id}
        result = await nautobot_service.graphql_query(query, variables, username=username)

        if "errors" in result:
            logger.error(f"GraphQL errors fetching device data: {result['errors']}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to fetch device data: {result['errors']}",
            )

        device_data = result.get("data", {}).get("device")
        if not device_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Device {device_id} not found",
            )

        return device_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching complete device data for {device_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch complete device data: {str(e)}",
        )


@router.get("/devices/{device_id}/details")
async def get_device_details(
    device_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get detailed device information using the comprehensive devices.md query."""
    try:
        username = (
            current_user.get("username")
            if isinstance(current_user, dict)
            else current_user.username
        )

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
                    location_type {
                        id
                        name
                    }
                    parent {
                        id
                        name
                        description
                        location_type {
                            id
                            name
                        }
                    }
                }
                status {
                    id
                    name
                }
                tenant {
                    id
                    name
                    tenant_group {
                        name
                    }
                }
                rack {
                    id
                    name
                    rack_group {
                        id
                        name
                    }
                }
                tags {
                    id
                    name
                }
                interfaces {
                    id
                    name
                    description
                    enabled
                    mac_address
                    type
                    mode
                    mtu
                    status {
                        id
                        name
                    }
                    ip_addresses {
                        address
                        status {
                            id
                            name
                        }
                        role {
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
                vrfs {
                    id
                    name
                    rd
                    description
                    namespace {
                        id
                        name
                    }
                }
            }
        }
        """

        variables = {"deviceId": device_id}

        result = await nautobot_service.graphql_query(query, variables, username=username)

        if "errors" in result:
            logger.error(f"GraphQL errors fetching device details: {result['errors']}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to fetch device details: {result['errors']}",
            )

        device = result.get("data", {}).get("device")
        if not device:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Device {device_id} not found",
            )

        return device

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching device details for {device_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch device details: {str(e)}",
        )


@router.post("/devices/search", response_model=DeviceListResponse)
async def search_devices(
    filters: DeviceFilter,
    current_user: dict = Depends(get_current_user),
):
    """Search devices with filters.
    
    Args:
        filters: Device filter parameters including disable_cache option
        current_user: Current authenticated user
    """
    try:
        username = (
            current_user.get("username")
            if isinstance(current_user, dict)
            else current_user.username
        )
        logger.info(f"Searching devices for user: {username}, disable_cache: {filters.disable_cache}")
        result = await nautobot_service.get_devices(
            limit=filters.limit,
            offset=filters.offset,
            filter_type=filters.filter_type,
            filter_value=filters.filter_value,
            username=username,
            disable_cache=filters.disable_cache,
        )
        return DeviceListResponse(**result)
    except Exception as e:
        logger.error(f"Error searching devices: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to search devices: {str(e)}",
        )


@router.post("/check-ip", response_model=IPAddressCheck)
async def check_ip_address(
    request: CheckIPRequest,
    current_user: dict = Depends(get_current_user),
):
    """Check if an IP address is available in Nautobot."""
    try:
        username = (
            current_user.get("username")
            if isinstance(current_user, dict)
            else current_user.username
        )
        result = await nautobot_service.check_ip_address(
            request.ip_address, username=username
        )
        return IPAddressCheck(**result)
    except Exception as e:
        logger.error(f"Error checking IP address {request.ip_address}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check IP address: {str(e)}",
        )


@router.post("/devices/onboard", response_model=OnboardingResponse)
async def onboard_device(
    request: DeviceOnboardRequest,
    current_user: dict = Depends(get_current_user),
):
    """Onboard a new device to Nautobot."""
    try:
        from ..core.config import settings

        if not settings.nautobot_url or not settings.nautobot_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nautobot settings not configured.",
            )

        # Prepare job data
        job_data = {
            "data": {
                "location": request.location_id,
                "ip_addresses": request.ip_address,
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

        # Make job API call via REST
        job_url = "extras/jobs/Sync%20Devices%20From%20Network/run/"
        username = (
            current_user.get("username")
            if isinstance(current_user, dict)
            else current_user.username
        )
        result = await nautobot_service.rest_request(
            job_url, method="POST", data=job_data, username=username
        )

        job_id = result.get("job_result", {}).get("id") or result.get("id")
        job_status = result.get("job_result", {}).get("status") or result.get(
            "status", "pending"
        )

        return OnboardingResponse(
            success=True,
            message=f"Device onboarding job started successfully for {request.ip_address}",
            job_id=job_id,
            job_status=job_status,
            device_data=request.dict(),
            nautobot_response=result,
        )

    except Exception as e:
        logger.error(f"Error onboarding device: {str(e)}")
        return OnboardingResponse(
            success=False,
            message=f"Failed to onboard device: {str(e)}",
            device_data=request.dict(),
        )


@router.post("/sync-network-data", response_model=SyncResponse)
async def sync_network_data(
    request: SyncNetworkDataRequest,
    current_user: dict = Depends(get_current_user),
):
    """Sync network data with Nautobot."""
    try:
        from ..core.config import settings

        if not settings.nautobot_url or not settings.nautobot_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nautobot settings not configured.",
            )

        # Prepare job data
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

        # Make job API call via REST
        job_url = "extras/jobs/Sync%20Network%20Data%20From%20Network/run/"
        username = (
            current_user.get("username")
            if isinstance(current_user, dict)
            else current_user.username
        )
        result = await nautobot_service.rest_request(
            job_url, method="POST", data=job_data, username=username
        )

        job_id = result.get("job_result", {}).get("id") or result.get("id")
        job_status = result.get("job_result", {}).get("status") or result.get(
            "status", "pending"
        )

        return SyncResponse(
            success=True,
            message="Network data sync job started successfully",
            job_id=job_id,
            job_status=job_status,
            nautobot_response=result,
        )

    except Exception as e:
        logger.error(f"Error syncing network data: {str(e)}")
        return SyncResponse(
            success=False,
            message=f"Failed to sync network data: {str(e)}",
        )


@router.get("/locations", response_model=List[Location])
async def get_locations(
    current_user: dict = Depends(get_current_user),
):
    """Get list of locations from Nautobot."""
    try:
        username = (
            current_user.get("username")
            if isinstance(current_user, dict)
            else current_user.username
        )
        locations = await nautobot_service.get_locations(username=username)
        return [Location(**location) for location in locations]
    except Exception as e:
        logger.error(f"Error fetching locations: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch locations: {str(e)}",
        )


@router.get("/stats", response_model=NautobotStats)
async def get_nautobot_stats(
    current_user: dict = Depends(get_current_user),
):
    """Get Nautobot statistics."""
    try:
        username = (
            current_user.get("username")
            if isinstance(current_user, dict)
            else current_user.username
        )
        stats = await nautobot_service.get_stats(username=username)
        return NautobotStats(**stats)
    except Exception as e:
        logger.error(f"Error fetching Nautobot stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch statistics: {str(e)}",
        )


@router.get("/namespaces", response_model=List[NautobotNamespace])
async def get_namespaces(
    current_user: dict = Depends(get_current_user),
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
        username = (
            current_user.get("username")
            if isinstance(current_user, dict)
            else current_user.username
        )
        result = await nautobot_service.graphql_query(query, username=username)

        if "errors" in result:
            raise Exception(f"GraphQL errors: {result['errors']}")

        namespaces = result["data"]["namespaces"]
        return [NautobotNamespace(**ns) for ns in namespaces]
    except Exception as e:
        logger.error(f"Error fetching namespaces: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch namespaces: {str(e)}",
        )


@router.get("/roles", response_model=List[NautobotRole])
async def get_nautobot_roles(
    current_user: dict = Depends(get_current_user),
):
    """Get Nautobot device roles."""
    try:
        username = (
            current_user.get("username")
            if isinstance(current_user, dict)
            else current_user.username
        )
        result = await nautobot_service.rest_request("extras/roles/", username=username)
        roles = result.get("results", [])
        return [NautobotRole(**role) for role in roles]
    except Exception as e:
        logger.error(f"Error fetching roles: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch roles: {str(e)}",
        )


@router.get("/roles/devices", response_model=List[NautobotRole])
async def get_nautobot_device_roles(
    current_user: dict = Depends(get_current_user),
):
    """Get Nautobot roles specifically for dcim.device content type."""
    try:
        username = (
            current_user.get("username")
            if isinstance(current_user, dict)
            else current_user.username
        )
        result = await nautobot_service.rest_request(
            "extras/roles/?content_types=dcim.device", username=username
        )
        roles = result.get("results", [])
        return [NautobotRole(**role) for role in roles]
    except Exception as e:
        logger.error(f"Error fetching device roles: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch device roles: {str(e)}",
        )


@router.get("/platforms", response_model=List[NautobotPlatform])
async def get_nautobot_platforms(
    current_user: dict = Depends(get_current_user),
):
    """Get Nautobot platforms."""
    try:
        username = (
            current_user.get("username")
            if isinstance(current_user, dict)
            else current_user.username
        )
        result = await nautobot_service.rest_request(
            "dcim/platforms/", username=username
        )
        platforms = result.get("results", [])
        return [NautobotPlatform(**platform) for platform in platforms]
    except Exception as e:
        logger.error(f"Error fetching platforms: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch platforms: {str(e)}",
        )


@router.get("/statuses", response_model=List[NautobotStatus])
async def get_nautobot_statuses(
    current_user: dict = Depends(get_current_user),
):
    """Get all Nautobot statuses."""
    try:
        username = (
            current_user.get("username")
            if isinstance(current_user, dict)
            else current_user.username
        )
        result = await nautobot_service.rest_request(
            "extras/statuses/", username=username
        )
        statuses = result.get("results", [])
        return [NautobotStatus(**status) for status in statuses]
    except Exception as e:
        logger.error(f"Error fetching statuses: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch statuses: {str(e)}",
        )


@router.get("/statuses/device", response_model=List[NautobotStatus])
async def get_nautobot_device_statuses(
    current_user: dict = Depends(get_current_user),
):
    """Get Nautobot device statuses."""
    try:
        username = (
            current_user.get("username")
            if isinstance(current_user, dict)
            else current_user.username
        )
        result = await nautobot_service.rest_request(
            "extras/statuses/?content_types=dcim.device", username=username
        )
        statuses = result.get("results", [])
        return [NautobotStatus(**status) for status in statuses]
    except Exception as e:
        logger.error(f"Error fetching device statuses: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch device statuses: {str(e)}",
        )


@router.get("/secret-groups", response_model=List[NautobotSecretGroup])
async def get_nautobot_secret_groups(
    current_user: dict = Depends(get_current_user),
):
    """Get Nautobot secret groups."""
    try:
        query = """
        query secrets_groups {
          secrets_groups {
            id
            name
          }
        }
        """
        username = (
            current_user.get("username")
            if isinstance(current_user, dict)
            else current_user.username
        )
        result = await nautobot_service.graphql_query(query, username=username)

        if "errors" in result:
            logger.warning(f"GraphQL errors fetching secret groups: {result['errors']}")
            return []

        secret_groups = result["data"]["secrets_groups"]
        return [NautobotSecretGroup(**group) for group in secret_groups]
    except Exception as e:
        logger.warning(f"Secret groups endpoint not available: {str(e)}")
        return []


@router.get("/health-check", response_model=HealthCheckResponse)
async def nautobot_health_check(
    current_user: dict = Depends(get_current_user),
):
    """Simple health check to verify Nautobot connectivity."""
    try:
        username = (
            current_user.get("username")
            if isinstance(current_user, dict)
            else current_user.username
        )
        result = await nautobot_service.rest_request(
            "dcim/devices/?limit=1", username=username
        )
        return HealthCheckResponse(
            status="connected",
            message="Nautobot is accessible",
            devices_count=result.get("count", 0),
        )
    except Exception as e:
        logger.error(f"Nautobot health check failed: {str(e)}")

        error_msg = str(e)
        if "403" in error_msg or "Invalid token" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Nautobot connection failed: Invalid or missing API token.",
            )
        elif "ConnectionError" in error_msg or "timeout" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Nautobot connection failed: Cannot reach Nautobot server.",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Nautobot connection failed: {error_msg}",
            )
