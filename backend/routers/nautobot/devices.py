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
    AddDeviceRequest,
    UpdateDeviceRequest,
)
from dependencies import get_nautobot_service, get_device_query_service
from services.nautobot.client import NautobotService
from services.nautobot.common.exceptions import NautobotAPIError
from dependencies import get_device_creation_service
from services.nautobot.devices.query import DeviceQueryService
from services.nautobot.devices.update import DeviceUpdateService
from services.nautobot_helpers.cache_helpers import (
    cache_device,
    get_cached_device,
)

logger = logging.getLogger(__name__)


def _extract_nautobot_error_detail(error_msg: str) -> str:
    """Extract a human-readable message from a NautobotAPIError string.

    Nautobot REST errors look like:
      'REST request failed with status 400: {"__all__":["..."]}'
    or the ip_manager wraps them with a nicer message like:
      'Cannot create IP address ...: No suitable parent prefix exists.'
    """
    import json
    import re

    # If it's already a user-friendly message (not raw REST), return as-is
    if not error_msg.startswith("REST request failed"):
        return error_msg

    # Try to extract JSON body from "REST request failed with status 400: {..."
    match = re.search(r"status \d+: (.+)$", error_msg)
    if match:
        try:
            body = json.loads(match.group(1))
            # Nautobot returns {"field": ["message", ...], ...}
            messages = []
            for field_errors in body.values():
                if isinstance(field_errors, list):
                    messages.extend(field_errors)
                else:
                    messages.append(str(field_errors))
            if messages:
                return "; ".join(messages)
        except (json.JSONDecodeError, AttributeError):
            pass

    return error_msg


router = APIRouter(
    tags=["nautobot-devices"]
)  # No prefix - endpoints define their own paths


@router.get("/test")
async def test_current_nautobot_connection(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
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
        logger.error("Error testing Nautobot connection: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to test Nautobot connection: {str(e)}",
        )


@router.get("/devices", summary="🔷 GraphQL: List Devices")
async def get_devices(
    limit: Optional[int] = None,
    offset: Optional[int] = None,
    filter_type: Optional[str] = None,
    filter_value: Optional[str] = None,
    name_ic: Optional[str] = None,
    location_id: Optional[str] = None,
    reload: bool = False,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    device_query_service: DeviceQueryService = Depends(get_device_query_service),
):
    """Get list of devices from Nautobot with optional filtering and pagination.

    **🔷 This endpoint uses GraphQL** to query Nautobot for device data.

    Args:
        limit: Number of devices per page (default: no limit for full data load)
        offset: Number of devices to skip (default: 0)
        filter_type: Type of filter ('name', 'name__ic', 'location', 'prefix')
            - 'name': Exact name match with regex (name__ire)
            - 'name__ic': Case-insensitive contains match (name__ic)
            - 'location': Filter by location name
            - 'prefix': Filter by IP prefix
        filter_value: Value to filter by
        name_ic: Case-insensitive name contains filter (typeahead search)
        location_id: Filter by location UUID (used with name_ic for rack device search)
        reload: If True, bypass cache and reload from Nautobot (default: False)
    """
    try:
        return await device_query_service.get_devices(
            limit=limit,
            offset=offset,
            filter_type=filter_type,
            filter_value=filter_value,
            name_ic=name_ic,
            location_id=location_id,
            reload=reload,
        )
    except Exception as e:
        logger.error("Error fetching devices: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch devices: {str(e)}",
        )


@router.get("/devices/{device_id}", summary="🔷 GraphQL: Get Device Details")
async def get_device(
    device_id: str,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """Get device details from Nautobot by device ID.

    **🔷 This endpoint uses GraphQL** to fetch detailed device information.
    """
    try:
        # Check cache first
        cached_device = get_cached_device(device_id)
        if cached_device is not None:
            logger.debug("Cache hit for device: %s", device_id)
            return cached_device

        logger.debug("Cache miss for device: %s", device_id)
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
            logger.debug("Caching device: %s", device_id)
            cache_device(device)

        return device
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch device {device_id}: {str(e)}",
        )


@router.post("/check-ip", summary="🔷 GraphQL: Check IP Address")
async def check_ip(
    request: CheckIPRequest,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """Check if an IP address exists in Nautobot.

    **🔷 This endpoint uses GraphQL** to query IP address availability.
    """
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


@router.post("/devices/onboard", summary="⚙️ Nautobot Job: Onboard Device")
async def onboard_device(
    request: DeviceOnboardRequest,
    current_user: dict = Depends(require_permission("devices.onboard", "execute")),
):
    """Onboard a new device to Nautobot.

    **⚙️ This endpoint triggers a Nautobot Job** (Sync Devices From Network).
    """
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

        logger.info("Calling Nautobot job API: %s", job_url)
        logger.info("Job data: %s", job_data)

        response = requests.post(job_url, json=job_data, headers=headers, timeout=30)
        logger.info("Nautobot API response status: %s", response.status_code)
        logger.info("Nautobot API response body: %s", response.text)

        if response.status_code in [200, 201, 202]:
            result = response.json()
            job_id = result.get("job_result", {}).get("id") or result.get("id")
            logger.info("Extracted job ID: %s", job_id)
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

            logger.error("Nautobot job API failed: %s", error_detail)
            return {
                "success": False,
                "message": f"Failed to start onboarding job: {error_detail}",
                "status_code": response.status_code,
                "response_body": response.text,
            }

    except Exception as e:
        logger.error("Exception in onboard_device: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to onboard device: {str(e)}",
        )


@router.post("/add-device", summary="🔶 REST: Add Device with Interfaces")
async def add_device(
    request: AddDeviceRequest,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
    device_creation_service=Depends(get_device_creation_service),
):
    """
    Orchestrated endpoint to add a device with interfaces to Nautobot.

    **🔶 This endpoint uses REST API** to create devices via Nautobot's REST endpoints.

    Workflow:
    1. Create device in Nautobot DCIM
    2. Create IP addresses for all interfaces (if specified)
    3. Create interfaces and assign IP addresses
    4. Assign primary IPv4 address to device
    """
    try:
        result = await device_creation_service.create_device_with_interfaces(
            request,
            username=current_user.get("username"),
            user_id=current_user.get("user_id"),
        )
        return result
    except NautobotAPIError as e:
        error_msg = str(e)
        logger.error("Failed to add device: %s", error_msg, exc_info=True)
        # Forward Nautobot 400 errors as 400 (user-correctable: duplicate device, missing prefix, etc.)
        if "status 400" in error_msg:
            # Extract the human-readable message from the Nautobot JSON response
            detail = _extract_nautobot_error_detail(error_msg)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=detail,
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add device: {error_msg}",
        )
    except Exception as e:
        logger.error("Failed to add device: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add device: {str(e)}",
        )


@router.patch("/devices/{device_id}", summary="🔶 REST: Update Device with Interfaces")
async def update_device(
    device_id: str,
    request: UpdateDeviceRequest,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """
    Update an existing device in Nautobot.

    **🔶 This endpoint uses REST API** to update devices via Nautobot's REST endpoints.

    Workflow:
    1. Validate and resolve update data (names → UUIDs)
    2. Update device properties via PATCH
    3. Update/create interfaces if provided
    4. Verify updates applied successfully

    Args:
        device_id: UUID of the device to update
        request: Update data (only provided fields will be updated)

    Returns:
        Update result with success status, updated fields, and warnings
    """
    try:
        # Initialize the update service
        update_service = DeviceUpdateService(nautobot_service)

        # Convert request to dict and filter out None values and empty interfaces
        update_data = request.model_dump(exclude_none=True, exclude_unset=True)

        # Extract interfaces separately
        interfaces = update_data.pop("interfaces", None)

        # Extract prefix configuration
        add_prefix = update_data.pop("add_prefix", True)
        default_prefix_length = update_data.pop("default_prefix_length", "/24")

        # Prepare device identifier
        device_identifier = {"id": device_id}

        # Call the update service
        result = await update_service.update_device(
            device_identifier=device_identifier,
            update_data=update_data,
            interfaces=interfaces,
            add_prefix=add_prefix,
            default_prefix_length=default_prefix_length,
        )

        return result

    except ValueError as e:
        logger.error("Validation error updating device: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error("Failed to update device: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update device: {str(e)}",
        )


@router.post("/sync-network-data", summary="⚙️ Nautobot Job: Sync Network Data")
async def sync_network_data(
    request: SyncNetworkDataRequest,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
):
    """Sync network data with Nautobot.

    **⚙️ This endpoint triggers a Nautobot Job** (Sync Network Data From Network).
    """
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
