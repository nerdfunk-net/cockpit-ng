"""
Network scanning task endpoints.

Covers: ping-network, scan-prefixes, and IP-address management tasks.
All endpoints are under /api/celery/*.
"""

import ipaddress
import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from core.celery_error_handler import handle_celery_errors
from models.celery import (
    IPAddressesTaskRequest,
    PingNetworkRequest,
    ScanPrefixesRequest,
    TaskResponse,
    TaskWithJobResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/celery", tags=["celery-network-tasks"])


@router.post("/tasks/ping-network", response_model=TaskWithJobResponse)
@handle_celery_errors("ping network")
async def trigger_ping_network(
    request: PingNetworkRequest,
    current_user: dict = Depends(require_permission("network.ping", "execute")),
):
    """
    Ping CIDR network ranges and optionally resolve DNS names.

    This endpoint triggers a background task that:
    1. Expands CIDR networks to individual IP addresses
    2. Pings all IPs using fping for efficiency
    3. Optionally resolves DNS names for reachable hosts
    4. Condenses unreachable IP ranges for compact display

    The task is tracked in the job database and can be viewed in the Jobs/Views app.

    Request Body:
        cidrs: List of CIDR networks to ping (e.g., ['192.168.1.0/24'])
        resolve_dns: Whether to resolve DNS names for reachable IPs (default: False)
        count: Number of pings per host (default: 3)
        timeout: Individual target timeout in ms (default: 500)
        retry: Number of retries (default: 3)
        interval: Interval between packets in ms (default: 10)

    Returns:
        TaskWithJobResponse with task_id (for Celery) and job_id (for Jobs/Views tracking)
    """
    from tasks.ping_network_task import ping_network_task

    if not request.cidrs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="cidrs list cannot be empty",
        )

    for cidr in request.cidrs:
        try:
            network = ipaddress.ip_network(cidr, strict=False)
            if network.prefixlen < 19:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"CIDR network too large (minimum /19): {cidr}",
                )
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid CIDR format: {cidr}",
            )

    task = ping_network_task.delay(
        cidrs=request.cidrs,
        resolve_dns=request.resolve_dns,
        executed_by=current_user.get("username", "unknown"),
        count=request.count,
        timeout=request.timeout,
        retry=request.retry,
        interval=request.interval,
    )

    job_id = f"ping_network_{task.id}"

    return TaskWithJobResponse(
        task_id=task.id,
        job_id=job_id,
        status="queued",
        message=f"Ping network task queued for {len(request.cidrs)} network(s): {task.id}",
    )


@router.post("/tasks/scan-prefixes", response_model=TaskWithJobResponse)
@handle_celery_errors("scan prefixes")
async def trigger_scan_prefixes(
    request: ScanPrefixesRequest,
    current_user: dict = Depends(require_permission("network.scan", "execute")),
):
    """
    Scan network prefixes from Nautobot filtered by custom field value.

    This endpoint triggers a background task that:
    1. Queries Nautobot for prefixes with specific custom field value using GraphQL
    2. Expands prefixes to individual IP addresses
    3. Pings all IPs using fping for efficiency
    4. Optionally resolves DNS names for reachable hosts
    5. Condenses unreachable IP ranges for compact display

    The task is tracked in the job database and can be viewed in the Jobs/Views app.

    Request Body:
        custom_field_name: Name of custom field on ipam.prefix (without 'cf_' prefix)
        custom_field_value: Value to filter prefixes by (e.g., 'true')
        resolve_dns: Whether to resolve DNS names for reachable IPs (default: False)
        ping_count: Number of pings per host (default: 3, range: 1-10)
        timeout_ms: Individual target timeout in ms (default: 500, range: 100-30000)
        retries: Number of retries (default: 3, range: 0-5)
        interval_ms: Interval between packets in ms (default: 10, range: 0-10000)

    Returns:
        TaskWithJobResponse with task_id (for Celery) and job_id (for Jobs/Views tracking)
    """
    from tasks.scan_prefixes_task import scan_prefixes_task

    if not request.custom_field_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="custom_field_name cannot be empty",
        )

    if not request.custom_field_value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="custom_field_value cannot be empty",
        )

    task = scan_prefixes_task.delay(
        custom_field_name=request.custom_field_name,
        custom_field_value=request.custom_field_value,
        response_custom_field_name=request.response_custom_field_name,
        resolve_dns=request.resolve_dns,
        ping_count=request.ping_count,
        timeout_ms=request.timeout_ms,
        retries=request.retries,
        interval_ms=request.interval_ms,
        executed_by=current_user.get("username", "unknown"),
    )

    job_id = f"scan_prefixes_{task.id}"

    return TaskWithJobResponse(
        task_id=task.id,
        job_id=job_id,
        status="queued",
        message=(
            f"Scan prefixes task queued "
            f"(field: {request.custom_field_name}={request.custom_field_value}): {task.id}"
        ),
    )


@router.post("/tasks/ip-addresses", response_model=TaskResponse)
@handle_celery_errors("ip addresses task")
async def trigger_ip_addresses_task(
    request: IPAddressesTaskRequest,
    current_user: dict = Depends(require_permission("nautobot.locations", "write")),
):
    """
    Trigger an IP address query or deletion task via Celery.

    Supports listing or deleting Nautobot IP addresses filtered by any field,
    including custom fields (prefix with cf_) and built-in fields.

    Request Body:
        action: 'list' to return matching IPs, 'delete' to delete them
        filter_field: Nautobot field name (e.g. 'cf_last_scan', 'address', 'status')
        filter_value: Value to compare against (e.g. '2026-02-19')
        filter_type: Optional operator suffix ('lte', 'lt', 'gte', 'gt', 'contains').
                     Omit for equality comparison.
        include_null: When True, also include IPs where filter_field is null

    Returns:
        TaskResponse with task_id to poll for results
    """
    from tasks import ip_addresses_task

    if request.action not in ("list", "delete"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="action must be 'list' or 'delete'",
        )

    task = ip_addresses_task.delay(
        action=request.action,
        filter_field=request.filter_field,
        filter_value=request.filter_value,
        filter_type=request.filter_type,
        include_null=request.include_null,
        executed_by=current_user.get("sub", "unknown"),
    )

    return TaskResponse(
        task_id=task.id,
        status="queued",
        message=f"IP addresses task ({request.action}) submitted: {task.id}",
    )
