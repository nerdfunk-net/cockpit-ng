"""
CheckMK router for settings and API interactions.
"""

from __future__ import annotations
import logging
import json
import os
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import verify_admin_token, verify_token
from models.checkmk import (
    CheckMKTestConnectionRequest,
    CheckMKTestConnectionResponse,
    CheckMKHostCreateRequest,
    CheckMKHostUpdateRequest,
    CheckMKHostMoveRequest,
    CheckMKHostRenameRequest,
    CheckMKBulkHostCreateRequest,
    CheckMKBulkHostUpdateRequest,
    CheckMKBulkHostDeleteRequest,
    CheckMKServiceQueryRequest,
    CheckMKServiceDiscoveryRequest,
    CheckMKDiscoveryPhaseUpdateRequest,
    CheckMKAcknowledgeHostRequest,
    CheckMKAcknowledgeServiceRequest,
    CheckMKDowntimeRequest,
    CheckMKCommentRequest,
    CheckMKActivateChangesRequest,
    CheckMKHostGroupCreateRequest,
    CheckMKFolderCreateRequest,
    CheckMKFolderUpdateRequest,
    CheckMKFolderMoveRequest,
    CheckMKFolderBulkUpdateRequest,
    CheckMKHostTagGroupCreateRequest,
    CheckMKHostTagGroupUpdateRequest,
    CheckMKHostGroupUpdateRequest,
    CheckMKHostGroupBulkUpdateRequest,
    CheckMKHostGroupBulkDeleteRequest,
    CheckMKHostListResponse,
    CheckMKFolderListResponse,
    CheckMKHostTagGroupListResponse,
    CheckMKVersionResponse,
    CheckMKOperationResponse,
)
from services.checkmk import checkmk_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/checkmk", tags=["checkmk"])


@router.post("/test", response_model=CheckMKTestConnectionResponse)
async def test_checkmk_connection(
    request: CheckMKTestConnectionRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Test CheckMK connection with provided settings."""
    try:
        success, message = await checkmk_service.test_connection(
            request.url,
            request.site,
            request.username,
            request.password,
            request.verify_ssl,
        )

        return CheckMKTestConnectionResponse(
            success=success,
            message=message,
            checkmk_url=request.url,
            connection_source="manual_test",
        )
    except Exception as e:
        logger.error(f"Error testing CheckMK connection: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to test CheckMK connection: {str(e)}",
        )


@router.get("/test")
async def test_current_checkmk_connection(
    current_user: dict = Depends(verify_admin_token),
):
    """Test current CheckMK connection using saved settings."""
    try:
        # Get checkmk config from database
        from settings_manager import settings_manager

        db_settings = settings_manager.get_checkmk_settings()
        if (
            not db_settings
            or not db_settings.get("url")
            or not db_settings.get("site")
            or not db_settings.get("username")
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CheckMK settings not configured. Please configure CheckMK settings first.",
            )

        success, message = await checkmk_service.test_connection(
            db_settings["url"],
            db_settings["site"],
            db_settings["username"],
            db_settings["password"],
            db_settings.get("verify_ssl", True),
        )

        return {
            "success": success,
            "message": message,
            "checkmk_url": db_settings["url"],
            "connection_source": "database",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error testing CheckMK connection: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to test CheckMK connection: {str(e)}",
        )


@router.get("/stats")
async def get_checkmk_stats(current_user: dict = Depends(verify_admin_token)):
    """Get CheckMK statistics with 10-minute caching."""
    # Cache configuration
    cache_duration = timedelta(minutes=10)
    cache_dir = "data/cache"
    cache_file = os.path.join(cache_dir, "checkmk_stats.json")

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
                logger.info("Returning cached CheckMK stats")
                # Remove cache metadata before returning
                stats = cache_data.copy()
                del stats["cache_timestamp"]
                return stats
        except (json.JSONDecodeError, ValueError, KeyError) as e:
            logger.warning(f"Invalid CheckMK cache file, will refresh: {e}")

    logger.info("CheckMK cache expired or missing, fetching fresh stats")

    try:
        # Import CheckMK client
        from checkmk.client import CheckMKClient, CheckMKAPIError
        from urllib.parse import urlparse

        # Get CheckMK settings from database
        from settings_manager import settings_manager

        db_settings = settings_manager.get_checkmk_settings()
        if (
            not db_settings
            or not db_settings.get("url")
            or not db_settings.get("site")
            or not db_settings.get("username")
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="CheckMK settings not configured. Please configure CheckMK settings first.",
            )

        # Parse URL
        url = db_settings["url"].rstrip("/")
        if url.startswith(("http://", "https://")):
            parsed_url = urlparse(url)
            protocol = parsed_url.scheme
            host = parsed_url.netloc
        else:
            protocol = "https"
            host = url

        # Create CheckMK client
        client = CheckMKClient(
            host=host,
            site_name=db_settings["site"],
            username=db_settings["username"],
            password=db_settings["password"],
            protocol=protocol,
            verify_ssl=db_settings.get("verify_ssl", True),
            timeout=30,
        )

        # Get all hosts and count them
        hosts_data = client.get_all_hosts()
        host_count = len(hosts_data.get("value", []))

        logger.info(f"Retrieved {host_count} hosts from CheckMK")

        stats = {
            "total_hosts": host_count,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # Save to cache with timestamp
        cache_data = stats.copy()
        cache_data["cache_timestamp"] = datetime.now(timezone.utc).isoformat()

        try:
            with open(cache_file, "w") as f:
                json.dump(cache_data, f)
            logger.info("CheckMK stats cached successfully")
        except Exception as cache_error:
            logger.warning(f"Failed to cache CheckMK stats: {cache_error}")

        return stats

    except CheckMKAPIError as e:
        logger.error(f"CheckMK API error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"CheckMK API error: {str(e)}",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching CheckMK stats: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch CheckMK statistics: {str(e)}",
        )


def _get_checkmk_client(site_name: str = None):
    """Helper function to create CheckMK client from settings

    Args:
        site_name: Optional site name to use. If None, uses the configured default site.
    """
    from settings_manager import settings_manager
    from checkmk.client import CheckMKClient
    from urllib.parse import urlparse

    db_settings = settings_manager.get_checkmk_settings()
    if not db_settings or not all(
        key in db_settings for key in ["url", "site", "username", "password"]
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CheckMK settings not configured. Please configure CheckMK settings first.",
        )

    # Parse URL
    url = db_settings["url"].rstrip("/")
    if url.startswith(("http://", "https://")):
        parsed_url = urlparse(url)
        protocol = parsed_url.scheme
        host = parsed_url.netloc
    else:
        protocol = "https"
        host = url

    # Use provided site_name or fall back to configured site
    # effective_site = site_name or db_settings["site"]
    effective_site = db_settings["site"]

    # Log client initialization details for debugging
    logger.info("Initializing CheckMK client:")
    logger.info(f"  host: {host}")
    logger.info(f"  site_name: {effective_site}")
    logger.info(f"  username: {db_settings['username']}")
    logger.info(f"  protocol: {protocol}")
    logger.info(f"  verify_ssl: {db_settings.get('verify_ssl', True)}")

    return CheckMKClient(
        host=host,
        site_name=effective_site,
        username=db_settings["username"],
        password=db_settings["password"],
        protocol=protocol,
        verify_ssl=db_settings.get("verify_ssl", True),
        timeout=30,
    )


# System Information Endpoints


@router.get("/version", response_model=CheckMKVersionResponse)
async def get_version(current_user: dict = Depends(verify_admin_token)):
    """Get CheckMK version information"""
    try:
        client = _get_checkmk_client()
        version_data = client.get_version()

        return CheckMKVersionResponse(
            version=version_data.get("version", "unknown"),
            edition=version_data.get("edition"),
            demo=version_data.get("demo", False),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting CheckMK version: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get CheckMK version: {str(e)}",
        )


# Host Management Endpoints


@router.get("/hosts", response_model=CheckMKHostListResponse)
async def get_all_hosts(
    effective_attributes: bool = False,
    include_links: bool = False,
    site: str = None,
    current_user: dict = Depends(verify_admin_token),
):
    """Get all hosts from CheckMK"""
    try:
        client = _get_checkmk_client()
        result = client.get_all_hosts(
            effective_attributes=effective_attributes,
            include_links=include_links,
            site=site,
        )

        hosts = []
        for host_data in result.get("value", []):
            hosts.append(
                {
                    "host_name": host_data.get("id"),
                    "folder": host_data.get("extensions", {}).get("folder", "/"),
                    "attributes": host_data.get("extensions", {}).get("attributes", {}),
                    "effective_attributes": host_data.get("extensions", {}).get(
                        "effective_attributes"
                    )
                    if effective_attributes
                    else None,
                }
            )

        return CheckMKHostListResponse(hosts=hosts, total=len(hosts))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting hosts: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get hosts: {str(e)}",
        )


@router.get("/hosts/{hostname}", response_model=CheckMKOperationResponse)
async def get_host(
    hostname: str,
    effective_attributes: bool = False,
    current_user: dict = Depends(verify_admin_token),
):
    """Get specific host configuration"""
    try:
        from checkmk.client import CheckMKAPIError

        client = _get_checkmk_client()
        result = client.get_host(hostname, effective_attributes)

        return CheckMKOperationResponse(
            success=True, message=f"Host {hostname} retrieved successfully", data=result
        )
    except CheckMKAPIError as e:
        if e.status_code == 404:
            logger.info(f"Host {hostname} not found in CheckMK")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Host '{hostname}' not found in CheckMK",
            )
        else:
            logger.error(
                f"CheckMK API error getting host {hostname}: {str(e)} (status: {e.status_code})"
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"CheckMK API error: {str(e)}",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting host {hostname}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get host {hostname}: {str(e)}",
        )


@router.post("/hosts", response_model=CheckMKOperationResponse)
async def create_host(
    request: CheckMKHostCreateRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Create new host in CheckMK"""
    try:
        client = _get_checkmk_client()
        result = client.create_host(
            hostname=request.host_name,
            folder=request.folder,
            attributes=request.attributes,
            bake_agent=request.bake_agent,
        )

        return CheckMKOperationResponse(
            success=True,
            message=f"Host {request.host_name} created successfully",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating host {request.host_name}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create host {request.host_name}: {str(e)}",
        )


@router.post("/hosts/create", response_model=CheckMKOperationResponse)
async def create_host_v2(
    request: CheckMKHostCreateRequest,
    bake_agent: bool = False,
    current_user: dict = Depends(verify_token),
):
    """Create new host in CheckMK (v2 endpoint with query parameter support)"""
    try:
        client = _get_checkmk_client()

        # Override bake_agent from query parameter if provided
        final_bake_agent = bake_agent if bake_agent is not None else request.bake_agent

        result = client.create_host(
            hostname=request.host_name,
            folder=request.folder,
            attributes=request.attributes,
            bake_agent=final_bake_agent,
        )

        return CheckMKOperationResponse(
            success=True,
            message=f"Host {request.host_name} created successfully",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating host {request.host_name}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create host {request.host_name}: {str(e)}",
        )


@router.put("/hosts/{hostname}", response_model=CheckMKOperationResponse)
async def update_host(
    hostname: str,
    request: CheckMKHostUpdateRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Update existing host configuration"""
    try:
        client = _get_checkmk_client()
        result = client.update_host(hostname, request.attributes)

        return CheckMKOperationResponse(
            success=True, message=f"Host {hostname} updated successfully", data=result
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating host {hostname}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update host {hostname}: {str(e)}",
        )


@router.delete("/hosts/{hostname}", response_model=CheckMKOperationResponse)
async def delete_host(
    hostname: str,
    current_user: dict = Depends(verify_admin_token),
):
    """Delete host from CheckMK"""
    try:
        client = _get_checkmk_client()
        client.delete_host(hostname)

        return CheckMKOperationResponse(
            success=True, message=f"Host {hostname} deleted successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting host {hostname}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete host {hostname}: {str(e)}",
        )


@router.post("/hosts/{hostname}/move", response_model=CheckMKOperationResponse)
async def move_host(
    hostname: str,
    request: CheckMKHostMoveRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Move host to different folder"""
    try:
        from checkmk.client import CheckMKAPIError

        client = _get_checkmk_client()
        # Convert folder path format: CheckMK uses ~ instead of /
        # First normalize double slashes, then convert / to ~
        normalized_folder = (
            request.target_folder.replace("//", "/") if request.target_folder else "/"
        )
        checkmk_folder = (
            normalized_folder.replace("/", "~") if normalized_folder else "~"
        )
        result = client.move_host(hostname, checkmk_folder)

        return CheckMKOperationResponse(
            success=True,
            message=f"Host {hostname} moved to {request.target_folder} successfully",
            data=result,
        )
    except CheckMKAPIError as e:
        # Handle specific CheckMK API errors
        if e.status_code == 428:
            raise HTTPException(
                status_code=status.HTTP_428_PRECONDITION_REQUIRED,
                detail=f"Cannot move host '{hostname}' - CheckMK changes need to be activated first",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST
                if e.status_code == 400
                else status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to move host '{hostname}': {str(e)}",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error moving host {hostname}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to move host {hostname}: {str(e)}",
        )


@router.post("/hosts/{hostname}/rename", response_model=CheckMKOperationResponse)
async def rename_host(
    hostname: str,
    request: CheckMKHostRenameRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Rename host"""
    try:
        client = _get_checkmk_client()
        result = client.rename_host(hostname, request.new_name)

        return CheckMKOperationResponse(
            success=True,
            message=f"Host {hostname} renamed to {request.new_name} successfully",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error renaming host {hostname}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to rename host {hostname}: {str(e)}",
        )


# Bulk Host Operations


@router.post("/hosts/bulk-create", response_model=CheckMKOperationResponse)
async def bulk_create_hosts(
    request: CheckMKBulkHostCreateRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Create multiple hosts in one request"""
    try:
        client = _get_checkmk_client()

        # Convert request to format expected by CheckMK client
        hosts = []
        for host_req in request.entries:
            hosts.append(
                {
                    "host_name": host_req.host_name,
                    "folder": host_req.folder,
                    "attributes": host_req.attributes,
                }
            )

        result = client.bulk_create_hosts(hosts)

        return CheckMKOperationResponse(
            success=True,
            message=f"Created {len(request.entries)} hosts successfully",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error bulk creating hosts: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to bulk create hosts: {str(e)}",
        )


@router.post("/hosts/bulk-update", response_model=CheckMKOperationResponse)
async def bulk_update_hosts(
    request: CheckMKBulkHostUpdateRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Update multiple hosts in one request"""
    try:
        client = _get_checkmk_client()

        # Convert request to format expected by CheckMK client
        hosts = {}
        for hostname, update_req in request.entries.items():
            hosts[hostname] = {"attributes": update_req.attributes}

        result = client.bulk_update_hosts(hosts)

        return CheckMKOperationResponse(
            success=True,
            message=f"Updated {len(request.entries)} hosts successfully",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error bulk updating hosts: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to bulk update hosts: {str(e)}",
        )


@router.post("/hosts/bulk-delete", response_model=CheckMKOperationResponse)
async def bulk_delete_hosts(
    request: CheckMKBulkHostDeleteRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Delete multiple hosts in one request"""
    try:
        client = _get_checkmk_client()
        result = client.bulk_delete_hosts(request.entries)

        return CheckMKOperationResponse(
            success=True,
            message=f"Deleted {len(request.entries)} hosts successfully",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error bulk deleting hosts: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to bulk delete hosts: {str(e)}",
        )


# Host Monitoring & Status Endpoints


@router.get("/monitoring/hosts", response_model=CheckMKOperationResponse)
async def get_all_monitored_hosts(
    request: CheckMKServiceQueryRequest = None,
    current_user: dict = Depends(verify_admin_token),
):
    """Get all monitored hosts with status information"""
    try:
        client = _get_checkmk_client()

        columns = request.columns if request else None
        query = request.query if request else None

        result = client.get_all_monitored_hosts(columns=columns, query=query)

        return CheckMKOperationResponse(
            success=True, message="Retrieved monitored hosts successfully", data=result
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting monitored hosts: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get monitored hosts: {str(e)}",
        )


@router.get("/monitoring/hosts/{hostname}", response_model=CheckMKOperationResponse)
async def get_monitored_host(
    hostname: str,
    request: CheckMKServiceQueryRequest = None,
    current_user: dict = Depends(verify_admin_token),
):
    """Get monitored host with status information"""
    try:
        client = _get_checkmk_client()

        columns = request.columns if request else None
        result = client.get_monitored_host(hostname, columns=columns)

        return CheckMKOperationResponse(
            success=True,
            message=f"Retrieved monitoring data for host {hostname} successfully",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting monitored host {hostname}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get monitored host {hostname}: {str(e)}",
        )


@router.get("/hosts/{hostname}/services", response_model=CheckMKOperationResponse)
async def get_host_services(
    hostname: str,
    request: CheckMKServiceQueryRequest = None,
    current_user: dict = Depends(verify_admin_token),
):
    """Get services for a specific host"""
    try:
        client = _get_checkmk_client()

        columns = request.columns if request else None
        query = request.query if request else None

        result = client.get_host_services(hostname, columns=columns, query=query)

        return CheckMKOperationResponse(
            success=True,
            message=f"Retrieved services for host {hostname} successfully",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting services for host {hostname}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get services for host {hostname}: {str(e)}",
        )


@router.post(
    "/hosts/{hostname}/services/{service}/show", response_model=CheckMKOperationResponse
)
async def show_service(
    hostname: str,
    service: str,
    request: CheckMKServiceQueryRequest = None,
    current_user: dict = Depends(verify_admin_token),
):
    """Show specific service details"""
    try:
        client = _get_checkmk_client()

        columns = request.columns if request else None
        result = client.show_service(hostname, service, columns=columns)

        return CheckMKOperationResponse(
            success=True,
            message=f"Retrieved service {service} details for host {hostname} successfully",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error showing service {service} for host {hostname}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to show service {service} for host {hostname}: {str(e)}",
        )


# Service Discovery Endpoints


@router.get("/hosts/{hostname}/discovery", response_model=CheckMKOperationResponse)
async def get_service_discovery(
    hostname: str,
    current_user: dict = Depends(verify_admin_token),
):
    """Get service discovery status for a host"""
    try:
        client = _get_checkmk_client()
        result = client.get_service_discovery(hostname)

        return CheckMKOperationResponse(
            success=True,
            message=f"Retrieved service discovery status for host {hostname} successfully",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting service discovery for host {hostname}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get service discovery for host {hostname}: {str(e)}",
        )


@router.post(
    "/hosts/{hostname}/discovery/start", response_model=CheckMKOperationResponse
)
async def start_service_discovery(
    hostname: str,
    request: CheckMKServiceDiscoveryRequest = CheckMKServiceDiscoveryRequest(),
    current_user: dict = Depends(verify_admin_token),
):
    """Start service discovery for a host"""
    try:
        client = _get_checkmk_client()
        result = client.start_service_discovery(hostname, request.mode)

        return CheckMKOperationResponse(
            success=True,
            message=f"Started service discovery for host {hostname} successfully",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting service discovery for host {hostname}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start service discovery for host {hostname}: {str(e)}",
        )


@router.post(
    "/hosts/{hostname}/discovery/wait", response_model=CheckMKOperationResponse
)
async def wait_for_service_discovery(
    hostname: str,
    current_user: dict = Depends(verify_admin_token),
):
    """Wait for service discovery completion"""
    try:
        client = _get_checkmk_client()
        result = client.wait_for_service_discovery(hostname)

        return CheckMKOperationResponse(
            success=True,
            message=f"Service discovery completed for host {hostname}",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error waiting for service discovery for host {hostname}: {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to wait for service discovery for host {hostname}: {str(e)}",
        )


@router.post(
    "/hosts/{hostname}/discovery/update-phase", response_model=CheckMKOperationResponse
)
async def update_discovery_phase(
    hostname: str,
    request: CheckMKDiscoveryPhaseUpdateRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Update discovery phase for a host"""
    try:
        client = _get_checkmk_client()

        kwargs = {"phase": request.phase}
        if request.services:
            kwargs["services"] = request.services

        result = client.update_discovery_phase(hostname, **kwargs)

        return CheckMKOperationResponse(
            success=True,
            message=f"Updated discovery phase for host {hostname} successfully",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating discovery phase for host {hostname}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update discovery phase for host {hostname}: {str(e)}",
        )


# Problem Management Endpoints


@router.post("/acknowledge/host", response_model=CheckMKOperationResponse)
async def acknowledge_host_problem(
    request: CheckMKAcknowledgeHostRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Acknowledge host problem"""
    try:
        client = _get_checkmk_client()
        result = client.acknowledge_host_problem(
            hostname=request.host_name,
            comment=request.comment,
            sticky=request.sticky,
            persistent=request.persistent,
            notify=request.notify,
        )

        return CheckMKOperationResponse(
            success=True,
            message=f"Acknowledged problem for host {request.host_name} successfully",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            f"Error acknowledging problem for host {request.host_name}: {str(e)}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to acknowledge problem for host {request.host_name}: {str(e)}",
        )


@router.post("/acknowledge/service", response_model=CheckMKOperationResponse)
async def acknowledge_service_problem(
    request: CheckMKAcknowledgeServiceRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Acknowledge service problem"""
    try:
        client = _get_checkmk_client()
        result = client.acknowledge_service_problem(
            hostname=request.host_name,
            service_description=request.service_description,
            comment=request.comment,
            sticky=request.sticky,
            persistent=request.persistent,
            notify=request.notify,
        )

        return CheckMKOperationResponse(
            success=True,
            message=f"Acknowledged problem for service {request.service_description} on host {request.host_name} successfully",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error acknowledging service problem: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to acknowledge service problem: {str(e)}",
        )


@router.delete("/acknowledge/{ack_id}", response_model=CheckMKOperationResponse)
async def delete_acknowledgment(
    ack_id: str,
    current_user: dict = Depends(verify_admin_token),
):
    """Delete acknowledgment"""
    try:
        client = _get_checkmk_client()
        client.delete_acknowledgment(ack_id)

        return CheckMKOperationResponse(
            success=True, message=f"Deleted acknowledgment {ack_id} successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting acknowledgment {ack_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete acknowledgment {ack_id}: {str(e)}",
        )


@router.post("/downtime/host", response_model=CheckMKOperationResponse)
async def create_host_downtime(
    request: CheckMKDowntimeRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Create downtime for host"""
    try:
        client = _get_checkmk_client()
        result = client.create_host_downtime(
            hostname=request.host_name,
            start_time=request.start_time,
            end_time=request.end_time,
            comment=request.comment,
            downtime_type=request.downtime_type,
        )

        return CheckMKOperationResponse(
            success=True,
            message=f"Created downtime for host {request.host_name} successfully",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating downtime for host {request.host_name}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create downtime for host {request.host_name}: {str(e)}",
        )


@router.post("/comments/host", response_model=CheckMKOperationResponse)
async def add_host_comment(
    request: CheckMKCommentRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Add comment to host"""
    try:
        client = _get_checkmk_client()
        result = client.add_host_comment(
            hostname=request.host_name,
            comment=request.comment,
            persistent=request.persistent,
        )

        return CheckMKOperationResponse(
            success=True,
            message=f"Added comment to host {request.host_name} successfully",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding comment to host {request.host_name}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add comment to host {request.host_name}: {str(e)}",
        )


@router.post("/comments/service", response_model=CheckMKOperationResponse)
async def add_service_comment(
    request: CheckMKCommentRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Add comment to service"""
    try:
        client = _get_checkmk_client()
        result = client.add_service_comment(
            hostname=request.host_name,
            service_description=request.service_description,
            comment=request.comment,
            persistent=request.persistent,
        )

        return CheckMKOperationResponse(
            success=True,
            message=f"Added comment to service {request.service_description} on host {request.host_name} successfully",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding comment to service: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add comment to service: {str(e)}",
        )


# Configuration Management Endpoints


@router.get("/changes/pending", response_model=CheckMKOperationResponse)
async def get_pending_changes(
    current_user: dict = Depends(verify_admin_token),
):
    """Get pending configuration changes"""
    try:
        client = _get_checkmk_client()
        result = client.get_pending_changes()

        return CheckMKOperationResponse(
            success=True, message="Retrieved pending changes successfully", data=result
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting pending changes: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get pending changes: {str(e)}",
        )


@router.post("/changes/activate", response_model=CheckMKOperationResponse)
async def activate_changes(
    request: CheckMKActivateChangesRequest = CheckMKActivateChangesRequest(),
    current_user: dict = Depends(verify_admin_token),
):
    """Activate pending configuration changes"""
    try:
        client = _get_checkmk_client()
        result = client.activate_changes(
            sites=request.sites,
            force_foreign_changes=request.force_foreign_changes,
            redirect=request.redirect,
        )

        return CheckMKOperationResponse(
            success=True,
            message="Activated configuration changes successfully",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error activating changes: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to activate changes: {str(e)}",
        )


@router.get("/activation/{activation_id}", response_model=CheckMKOperationResponse)
async def get_activation_status(
    activation_id: str,
    current_user: dict = Depends(verify_admin_token),
):
    """Get activation status"""
    try:
        client = _get_checkmk_client()
        result = client.get_activation_status(activation_id)

        return CheckMKOperationResponse(
            success=True,
            message=f"Retrieved activation status for {activation_id} successfully",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting activation status for {activation_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get activation status for {activation_id}: {str(e)}",
        )


@router.post(
    "/activation/{activation_id}/wait", response_model=CheckMKOperationResponse
)
async def wait_for_activation_completion(
    activation_id: str,
    current_user: dict = Depends(verify_admin_token),
):
    """Wait for activation completion"""
    try:
        client = _get_checkmk_client()
        result = client.wait_for_activation_completion(activation_id)

        return CheckMKOperationResponse(
            success=True,
            message=f"Activation {activation_id} completed successfully",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error waiting for activation {activation_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to wait for activation {activation_id}: {str(e)}",
        )


@router.get("/activation/running", response_model=CheckMKOperationResponse)
async def get_running_activations(
    current_user: dict = Depends(verify_admin_token),
):
    """Get currently running activations"""
    try:
        client = _get_checkmk_client()
        result = client.get_running_activations()

        return CheckMKOperationResponse(
            success=True,
            message="Retrieved running activations successfully",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting running activations: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get running activations: {str(e)}",
        )


# Host Groups Endpoints


@router.get("/host-groups", response_model=CheckMKOperationResponse)
async def get_host_groups(
    current_user: dict = Depends(verify_admin_token),
):
    """Get all host groups"""
    try:
        client = _get_checkmk_client()
        result = client.get_host_groups()

        return CheckMKOperationResponse(
            success=True, message="Retrieved host groups successfully", data=result
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting host groups: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get host groups: {str(e)}",
        )


@router.get("/host-groups/{group_name}", response_model=CheckMKOperationResponse)
async def get_host_group(
    group_name: str,
    current_user: dict = Depends(verify_admin_token),
):
    """Get specific host group"""
    try:
        client = _get_checkmk_client()
        result = client.get_host_group(group_name)

        return CheckMKOperationResponse(
            success=True,
            message=f"Retrieved host group {group_name} successfully",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting host group {group_name}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get host group {group_name}: {str(e)}",
        )


@router.post("/host-groups", response_model=CheckMKOperationResponse)
async def create_host_group(
    request: CheckMKHostGroupCreateRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Create host group"""
    try:
        client = _get_checkmk_client()
        result = client.create_host_group(request.name, request.alias)

        return CheckMKOperationResponse(
            success=True,
            message=f"Created host group {request.name} successfully",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating host group {request.name}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create host group {request.name}: {str(e)}",
        )


@router.put("/host-groups/{name}", response_model=CheckMKOperationResponse)
async def update_host_group(
    name: str,
    request: CheckMKHostGroupUpdateRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Update existing host group"""
    try:
        client = _get_checkmk_client()
        result = client.update_host_group(name, alias=request.alias)

        return CheckMKOperationResponse(
            success=True, message=f"Updated host group {name} successfully", data=result
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating host group {name}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update host group {name}: {str(e)}",
        )


@router.delete("/host-groups/{name}", response_model=CheckMKOperationResponse)
async def delete_host_group(
    name: str,
    current_user: dict = Depends(verify_admin_token),
):
    """Delete host group"""
    try:
        client = _get_checkmk_client()
        client.delete_host_group(name)

        return CheckMKOperationResponse(
            success=True, message=f"Deleted host group {name} successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting host group {name}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete host group {name}: {str(e)}",
        )


@router.put("/host-groups/bulk-update", response_model=CheckMKOperationResponse)
async def bulk_update_host_groups(
    request: CheckMKHostGroupBulkUpdateRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Update multiple host groups in one request"""
    try:
        client = _get_checkmk_client()
        result = client.bulk_update_host_groups(request.entries)

        return CheckMKOperationResponse(
            success=True,
            message=f"Updated {len(request.entries)} host groups successfully",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error bulk updating host groups: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to bulk update host groups: {str(e)}",
        )


@router.delete("/host-groups/bulk-delete", response_model=CheckMKOperationResponse)
async def bulk_delete_host_groups(
    request: CheckMKHostGroupBulkDeleteRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Delete multiple host groups in one request"""
    try:
        client = _get_checkmk_client()
        result = client.bulk_delete_host_groups(request.entries)

        return CheckMKOperationResponse(
            success=True,
            message=f"Deleted {len(request.entries)} host groups successfully",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error bulk deleting host groups: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to bulk delete host groups: {str(e)}",
        )


# Folder Management Endpoints


@router.get("/folders", response_model=CheckMKFolderListResponse)
async def get_all_folders(
    parent: str = None,
    recursive: bool = False,
    show_hosts: bool = False,
    current_user: dict = Depends(verify_admin_token),
):
    """Get all folders"""
    try:
        from checkmk.client import CheckMKAPIError

        client = _get_checkmk_client()
        result = client.get_all_folders(
            parent=parent, recursive=recursive, show_hosts=show_hosts
        )

        folders = []
        for folder_data in result.get("value", []):
            folder_info = folder_data.get("extensions", {})
            folders.append(
                {
                    "name": folder_data.get("id", ""),
                    "title": folder_data.get("title", ""),
                    "parent": folder_info.get("parent", "/"),
                    "path": folder_info.get("path", "/"),
                    "attributes": folder_info.get("attributes", {}),
                    "hosts": folder_info.get("hosts", []) if show_hosts else None,
                }
            )

        return CheckMKFolderListResponse(folders=folders, total=len(folders))
    except CheckMKAPIError as e:
        # Log CheckMK API error for debugging
        logger.error(
            f"CheckMK API error getting folders: status={e.status_code}, parent={parent}"
        )
        if hasattr(e, "response_data") and e.response_data:
            logger.error(f"CheckMK error details: {e.response_data}")

        if e.status_code == 400:
            # Extract the specific CheckMK error message
            checkmk_error_detail = "Invalid folder request"
            if hasattr(e, "response_data") and e.response_data:
                response_data = e.response_data
                if "fields" in response_data and "parent" in response_data["fields"]:
                    # Get the specific error message for the parent field
                    parent_errors = response_data["fields"]["parent"]
                    if parent_errors:
                        checkmk_error_detail = parent_errors[
                            0
                        ]  # Use the first error message
                elif "detail" in response_data:
                    checkmk_error_detail = response_data["detail"]

            # Check if this is actually a "not found" error disguised as 400
            if "could not be found" in checkmk_error_detail.lower():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=checkmk_error_detail,
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=checkmk_error_detail,
                )
        elif e.status_code == 404:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Parent folder '{parent}' not found in CheckMK",
            )
        else:
            logger.error(
                f"CheckMK API error getting folders: {str(e)} (status: {e.status_code})"
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"CheckMK API error: {str(e)}",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting folders: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get folders: {str(e)}",
        )


@router.get("/folders/{folder_path}", response_model=CheckMKOperationResponse)
async def get_folder(
    folder_path: str,
    show_hosts: bool = False,
    current_user: dict = Depends(verify_admin_token),
):
    """Get specific folder"""
    try:
        from checkmk.client import CheckMKAPIError

        client = _get_checkmk_client()
        # Convert folder path format: CheckMK uses ~ instead of /
        # First normalize double slashes, then convert / to ~
        normalized_folder_path = folder_path.replace("//", "/") if folder_path else "/"
        checkmk_folder_path = (
            normalized_folder_path.replace("/", "~") if normalized_folder_path else "~"
        )
        result = client.get_folder(checkmk_folder_path, show_hosts=show_hosts)

        return CheckMKOperationResponse(
            success=True,
            message=f"Retrieved folder {folder_path} successfully",
            data=result,
        )
    except CheckMKAPIError as e:
        if e.status_code == 404:
            logger.info(f"Folder {folder_path} not found in CheckMK")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Folder '{folder_path}' not found in CheckMK",
            )
        else:
            logger.error(
                f"CheckMK API error getting folder {folder_path}: {str(e)} (status: {e.status_code})"
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"CheckMK API error: {str(e)}",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting folder {folder_path}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get folder {folder_path}: {str(e)}",
        )


@router.post("/folders", response_model=CheckMKOperationResponse)
async def create_folder(
    request: CheckMKFolderCreateRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Create new folder"""
    try:
        from checkmk.client import CheckMKAPIError

        client = _get_checkmk_client()
        # Convert folder path format: CheckMK uses ~ instead of /
        # First normalize double slashes, then convert / to ~
        normalized_parent = request.parent.replace("//", "/") if request.parent else "/"
        checkmk_parent = (
            normalized_parent.replace("/", "~") if normalized_parent else "~"
        )
        result = client.create_folder(
            name=request.name,
            title=request.title,
            parent=checkmk_parent,
            attributes=request.attributes,
        )

        return CheckMKOperationResponse(
            success=True,
            message=f"Created folder {request.name} successfully",
            data=result,
        )
    except CheckMKAPIError as e:
        # Extract specific error message from CheckMK response
        checkmk_error_detail = str(e)
        validation_errors = []

        if hasattr(e, "response_data") and e.response_data:
            response_data = e.response_data

            if isinstance(response_data, dict):
                # Handle the specific CheckMK 400 response format
                if "detail" in response_data:
                    checkmk_error_detail = response_data["detail"]

                if "fields" in response_data and response_data["fields"]:
                    # Handle field-specific validation errors
                    for field, errors in response_data["fields"].items():
                        if errors is not None:
                            if isinstance(errors, list):
                                for error in errors:
                                    validation_errors.append(f"{field}: {error}")
                            else:
                                validation_errors.append(f"{field}: {errors}")

                if "ext" in response_data and response_data["ext"]:
                    # Handle extended error information
                    for field, error in response_data["ext"].items():
                        if error is not None:
                            validation_errors.append(f"ext.{field}: {error}")

        # Combine all error information
        if validation_errors:
            checkmk_error_detail = (
                f"{checkmk_error_detail} - {'; '.join(validation_errors)}"
            )

        logger.error(f"CheckMK folder creation failed: {checkmk_error_detail}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST
            if e.status_code == 400
            else status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to create folder: {checkmk_error_detail}",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating folder {request.name}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create folder {request.name}: {str(e)}",
        )


@router.put("/folders/{folder_path}", response_model=CheckMKOperationResponse)
async def update_folder(
    folder_path: str,
    request: CheckMKFolderUpdateRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Update existing folder"""
    try:
        client = _get_checkmk_client()
        # Convert folder path format: CheckMK uses ~ instead of /
        # First normalize double slashes, then convert / to ~
        normalized_folder_path = folder_path.replace("//", "/") if folder_path else "/"
        checkmk_folder_path = (
            normalized_folder_path.replace("/", "~") if normalized_folder_path else "~"
        )
        result = client.update_folder(
            folder_path=checkmk_folder_path,
            title=request.title,
            attributes=request.attributes,
            remove_attributes=request.remove_attributes,
        )

        return CheckMKOperationResponse(
            success=True,
            message=f"Updated folder {folder_path} successfully",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating folder {folder_path}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update folder {folder_path}: {str(e)}",
        )


@router.delete("/folders/{folder_path}", response_model=CheckMKOperationResponse)
async def delete_folder(
    folder_path: str,
    delete_mode: str = "recursive",
    current_user: dict = Depends(verify_admin_token),
):
    """Delete folder"""
    try:
        client = _get_checkmk_client()
        # Convert folder path format: CheckMK uses ~ instead of /
        # First normalize double slashes, then convert / to ~
        normalized_folder_path = folder_path.replace("//", "/") if folder_path else "/"
        checkmk_folder_path = (
            normalized_folder_path.replace("/", "~") if normalized_folder_path else "~"
        )
        client.delete_folder(checkmk_folder_path, delete_mode=delete_mode)

        return CheckMKOperationResponse(
            success=True, message=f"Deleted folder {folder_path} successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting folder {folder_path}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete folder {folder_path}: {str(e)}",
        )


@router.post("/folders/{folder_path}/move", response_model=CheckMKOperationResponse)
async def move_folder(
    folder_path: str,
    request: CheckMKFolderMoveRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Move folder to different location"""
    try:
        client = _get_checkmk_client()
        # Convert folder path format: CheckMK uses ~ instead of /
        # First normalize double slashes, then convert / to ~
        normalized_folder_path = folder_path.replace("//", "/") if folder_path else "/"
        normalized_destination = (
            request.destination.replace("//", "/") if request.destination else "/"
        )
        checkmk_folder_path = (
            normalized_folder_path.replace("/", "~") if normalized_folder_path else "~"
        )
        checkmk_destination = (
            normalized_destination.replace("/", "~") if normalized_destination else "~"
        )
        result = client.move_folder(checkmk_folder_path, checkmk_destination)

        return CheckMKOperationResponse(
            success=True,
            message=f"Moved folder {folder_path} to {request.destination} successfully",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error moving folder {folder_path}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to move folder {folder_path}: {str(e)}",
        )


@router.put("/folders/bulk-update", response_model=CheckMKOperationResponse)
async def bulk_update_folders(
    request: CheckMKFolderBulkUpdateRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Update multiple folders in one request"""
    try:
        client = _get_checkmk_client()
        result = client.bulk_update_folders(request.entries)

        return CheckMKOperationResponse(
            success=True,
            message=f"Updated {len(request.entries)} folders successfully",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error bulk updating folders: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to bulk update folders: {str(e)}",
        )


@router.get("/folders/{folder_path}/hosts", response_model=CheckMKOperationResponse)
async def get_hosts_in_folder(
    folder_path: str,
    effective_attributes: bool = False,
    current_user: dict = Depends(verify_admin_token),
):
    """Get all hosts in a specific folder"""
    try:
        client = _get_checkmk_client()
        # Convert folder path format: CheckMK uses ~ instead of /
        # First normalize double slashes, then convert / to ~
        normalized_folder_path = folder_path.replace("//", "/") if folder_path else "/"
        checkmk_folder_path = (
            normalized_folder_path.replace("/", "~") if normalized_folder_path else "~"
        )
        result = client.get_hosts_in_folder(
            checkmk_folder_path, effective_attributes=effective_attributes
        )

        return CheckMKOperationResponse(
            success=True,
            message=f"Retrieved hosts in folder {folder_path} successfully",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting hosts in folder {folder_path}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get hosts in folder {folder_path}: {str(e)}",
        )


# Host Tag Groups Endpoints


@router.get("/host-tag-groups", response_model=CheckMKHostTagGroupListResponse)
async def get_all_host_tag_groups(
    current_user: dict = Depends(verify_admin_token),
):
    """Get all host tag groups"""
    try:
        client = _get_checkmk_client()
        result = client.get_all_host_tag_groups()

        tag_groups = []
        for group_data in result.get("value", []):
            group_info = group_data.get("extensions", {})
            tag_groups.append(
                {
                    "id": group_data.get("id", ""),
                    "title": group_data.get("title", ""),
                    "topic": group_info.get("topic"),
                    "help": group_info.get("help"),
                    "tags": group_info.get("tags", []),
                }
            )

        return CheckMKHostTagGroupListResponse(
            tag_groups=tag_groups, total=len(tag_groups)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting host tag groups: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get host tag groups: {str(e)}",
        )


@router.get("/host-tag-groups/{name}", response_model=CheckMKOperationResponse)
async def get_host_tag_group(
    name: str,
    current_user: dict = Depends(verify_admin_token),
):
    """Get specific host tag group"""
    try:
        client = _get_checkmk_client()
        result = client.get_host_tag_group(name)

        return CheckMKOperationResponse(
            success=True,
            message=f"Retrieved host tag group {name} successfully",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting host tag group {name}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get host tag group {name}: {str(e)}",
        )


@router.post("/host-tag-groups", response_model=CheckMKOperationResponse)
async def create_host_tag_group(
    request: CheckMKHostTagGroupCreateRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Create new host tag group"""
    try:
        client = _get_checkmk_client()

        # Convert tags to format expected by CheckMK API
        tags = [tag.dict() for tag in request.tags]

        result = client.create_host_tag_group(
            id=request.id,
            title=request.title,
            tags=tags,
            topic=request.topic,
            help=request.help,
        )

        return CheckMKOperationResponse(
            success=True,
            message=f"Created host tag group {request.id} successfully",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating host tag group {request.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create host tag group {request.id}: {str(e)}",
        )


@router.put("/host-tag-groups/{name}", response_model=CheckMKOperationResponse)
async def update_host_tag_group(
    name: str,
    request: CheckMKHostTagGroupUpdateRequest,
    current_user: dict = Depends(verify_admin_token),
):
    """Update existing host tag group"""
    try:
        client = _get_checkmk_client()

        # Convert tags to format expected by CheckMK API if provided
        tags = None
        if request.tags is not None:
            tags = [tag.dict() for tag in request.tags]

        result = client.update_host_tag_group(
            name=name,
            title=request.title,
            tags=tags,
            topic=request.topic,
            help=request.help,
            repair=request.repair,
        )

        return CheckMKOperationResponse(
            success=True,
            message=f"Updated host tag group {name} successfully",
            data=result,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating host tag group {name}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update host tag group {name}: {str(e)}",
        )


@router.delete("/host-tag-groups/{name}", response_model=CheckMKOperationResponse)
async def delete_host_tag_group(
    name: str,
    repair: bool = False,
    mode: str = None,
    current_user: dict = Depends(verify_admin_token),
):
    """Delete host tag group"""
    try:
        client = _get_checkmk_client()
        client.delete_host_tag_group(name, repair=repair, mode=mode)

        return CheckMKOperationResponse(
            success=True, message=f"Deleted host tag group {name} successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting host tag group {name}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete host tag group {name}: {str(e)}",
        )
