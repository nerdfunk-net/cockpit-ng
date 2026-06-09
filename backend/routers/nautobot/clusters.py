"""
Nautobot virtualization cluster endpoints.

Clusters, cluster types, and cluster groups. Virtual machine and virtual
interface endpoints live in ``virtual_machines.py`` / ``virtual_interfaces.py``.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from core.safe_http_errors import raise_internal_server_error
from dependencies import get_audit_log_service, get_nautobot_service
from models.nautobot import (
    Cluster,
    ClusterGroup,
    CreateClusterRequest,
    CreateClusterTypeRequest,
)
from routers.nautobot.rest_errors import extract_nautobot_error_detail
from services.audit.audit_log_service import AuditLogService
from services.nautobot.client import NautobotService
from services.nautobot.common.exceptions import NautobotAPIError
from services.nautobot.managers import ClusterManager
from services.nautobot.resolvers import ClusterResolver

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/virtualization", tags=["nautobot-virtualization"])


@router.get(
    "/clusters", response_model=list[Cluster], summary="🔷 GraphQL: List Clusters"
)
async def get_clusters(
    group: str | None = None,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """
    Get all virtualization clusters from Nautobot, optionally filtered by cluster group.

    Returns a list of clusters with their associated virtual machines and device assignments.
    Device assignments represent the physical devices that form the cluster infrastructure.

    **🔷 This endpoint uses GraphQL** to fetch cluster data.

    **Required Permission:** `nautobot.devices:read`

    **Query Parameters:**
    - `group`: Optional cluster group ID to filter clusters

    **Returns:**
    - List of clusters with:
      - `id`: Cluster UUID
      - `name`: Cluster name
      - `cluster_group`: Cluster group information
      - `virtual_machines`: List of VMs in the cluster
      - `device_assignments`: List of devices assigned to the cluster
    """
    try:
        resolver = ClusterResolver(nautobot_service)
        group_filter = [group] if group else None
        clusters = await resolver.get_all_clusters(group=group_filter)
        return clusters
    except Exception as e:
        raise_internal_server_error(logger, "Failed to fetch clusters: ", e)


@router.post(
    "/clusters",
    status_code=status.HTTP_201_CREATED,
    summary="REST: Create Cluster",
)
async def create_cluster(
    request: CreateClusterRequest,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
    audit_log: AuditLogService = Depends(get_audit_log_service),
):
    """
    Create a new virtualization cluster in Nautobot.

    **REST API** proxies to Nautobot `POST /api/virtualization/clusters/`.

    **Required Permission:** `nautobot.devices:write`

    **Request Body:**
    - `name`: Cluster name (required)
    - `description`: Optional description
    - `cluster_type`: Cluster type UUID (required by Nautobot when creating clusters)
    - `cluster_group`: Optional cluster group UUID
    - `location`: Optional location UUID
    - `tags`: Optional list of tag UUIDs

    **Returns:**
    - Created cluster object from Nautobot (includes `id`, `name`, etc.)

    **Raises:**
    - `400`: Invalid request (e.g. validation error from Nautobot)
    - `500`: Internal server error
    """
    try:
        cluster_manager = ClusterManager(nautobot_service)
        result = await cluster_manager.create_cluster(
            name=request.name,
            description=request.description,
            cluster_type_id=request.cluster_type,
            cluster_group_id=request.cluster_group,
            location_id=request.location,
            tags=request.tags,
        )

        audit_log.log_event(
            username=current_user.get("username")
            or current_user.get("sub")
            or "unknown",
            user_id=current_user.get("user_id"),
            event_type="nautobot-cluster-created",
            message=f"Cluster '{request.name}' created in Nautobot",
            resource_type="cluster",
            resource_id=result.get("id"),
            resource_name=request.name,
            severity="info",
            extra_data={
                "cluster_type": request.cluster_type,
                "cluster_group": request.cluster_group,
                "location": request.location,
            },
        )

        return result

    except HTTPException:
        raise
    except NautobotAPIError as exc:
        error_msg = extract_nautobot_error_detail(str(exc))
        if "status 400" in str(exc):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_msg,
            )
        raise_internal_server_error(
            logger,
            "Failed to create cluster (Nautobot API error)",
            exc,
            extra={"cluster_name": request.name},
        )
    except Exception as exc:
        raise_internal_server_error(
            logger,
            "Failed to create cluster",
            exc,
            extra={"cluster_name": request.name},
        )


@router.post(
    "/cluster-type",
    status_code=status.HTTP_201_CREATED,
    summary="REST: Create Cluster Type",
)
async def create_cluster_type(
    request: CreateClusterTypeRequest,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
    audit_log: AuditLogService = Depends(get_audit_log_service),
):
    """
    Create a new virtualization cluster type in Nautobot.

    **REST API** proxies to Nautobot `POST /api/virtualization/cluster-types/`.

    **Required Permission:** `nautobot.devices:write`

    **Request Body:**
    - `name`: Cluster type name (required)
    - `slug`: Optional slug (derived from `name` when omitted)
    - `description`: Optional description
    - `tags`: Optional list of tag UUIDs

    **Returns:**
    - Created cluster type object from Nautobot (includes `id`, `name`, `slug`, etc.)

    **Raises:**
    - `400`: Invalid request (e.g. validation error from Nautobot)
    - `500`: Internal server error
    """
    try:
        cluster_manager = ClusterManager(nautobot_service)
        result = await cluster_manager.create_cluster_type(
            name=request.name,
            slug=request.slug,
            description=request.description,
            tags=request.tags,
        )

        audit_log.log_event(
            username=current_user.get("username")
            or current_user.get("sub")
            or "unknown",
            user_id=current_user.get("user_id"),
            event_type="nautobot-cluster-type-created",
            message=f"Cluster type '{request.name}' created in Nautobot",
            resource_type="cluster_type",
            resource_id=result.get("id"),
            resource_name=request.name,
            severity="info",
            extra_data={"slug": result.get("slug") or request.slug},
        )

        return result

    except HTTPException:
        raise
    except NautobotAPIError as exc:
        error_msg = extract_nautobot_error_detail(str(exc))
        if "status 400" in str(exc):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_msg,
            )
        raise_internal_server_error(
            logger,
            "Failed to create cluster type (Nautobot API error)",
            exc,
            extra={"cluster_type_name": request.name},
        )
    except Exception as exc:
        raise_internal_server_error(
            logger,
            "Failed to create cluster type",
            exc,
            extra={"cluster_type_name": request.name},
        )


@router.get(
    "/cluster-groups",
    response_model=list[ClusterGroup],
    summary="🔷 GraphQL: List Cluster Groups",
)
async def get_cluster_groups(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """
    Get all virtualization cluster groups from Nautobot.

    Returns a list of cluster groups that can be used to filter clusters.

    **🔷 This endpoint uses GraphQL** to fetch cluster group data.

    **Required Permission:** `nautobot.devices:read`

    **Returns:**
    - List of cluster groups with:
      - `id`: Cluster group UUID
      - `name`: Cluster group name
    """
    try:
        resolver = ClusterResolver(nautobot_service)
        cluster_groups = await resolver.get_all_cluster_groups()
        return cluster_groups
    except Exception as e:
        raise_internal_server_error(logger, "Failed to fetch cluster groups: ", e)


@router.get(
    "/clusters/{cluster_id}",
    response_model=Cluster,
    summary="🔷 GraphQL: Get Cluster Details",
)
async def get_cluster_by_id(
    cluster_id: str,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
    nautobot_service: NautobotService = Depends(get_nautobot_service),
):
    """
    Get details of a specific virtualization cluster from Nautobot.

    Returns detailed information about a cluster including its virtual machines
    and device assignments.

    **🔷 This endpoint uses GraphQL** to fetch cluster data.

    **Required Permission:** `nautobot.devices:read`

    **Path Parameters:**
    - `cluster_id`: UUID of the cluster

    **Returns:**
    - Cluster object with:
      - `id`: Cluster UUID
      - `name`: Cluster name
      - `virtual_machines`: List of VMs in the cluster
      - `device_assignments`: List of devices assigned to the cluster

    **Raises:**
    - `404`: Cluster not found
    - `500`: Internal server error
    """
    try:
        resolver = ClusterResolver(nautobot_service)
        cluster = await resolver.get_cluster_by_id(cluster_id)

        if not cluster:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Cluster with ID {cluster_id} not found",
            )

        return cluster
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        raise_internal_server_error(logger, "Failed to fetch cluster: ", e)
