"""
Nautobot virtualization cluster endpoints.

This module provides endpoints for managing virtualization clusters in Nautobot.
Clusters group devices and virtual machines together for virtualization infrastructure.
"""

from __future__ import annotations
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List

from core.auth import require_permission
from models.nautobot import (
    Cluster,
    AddVirtualMachineRequest,
    AddVirtualInterfaceRequest,
)
from services.nautobot import nautobot_service
from services.nautobot.resolvers import ClusterResolver, NetworkResolver, MetadataResolver
from services.nautobot.managers.vm_manager import VirtualMachineManager
from services.nautobot.managers import IPManager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/virtualization", tags=["nautobot-virtualization"])


@router.get("/clusters", response_model=List[Cluster], summary="🔷 GraphQL: List Clusters")
async def get_clusters(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
):
    """
    Get all virtualization clusters from Nautobot.

    Returns a list of clusters with their associated virtual machines and device assignments.
    Device assignments represent the physical devices that form the cluster infrastructure.

    **🔷 This endpoint uses GraphQL** to fetch cluster data.

    **Required Permission:** `nautobot.devices:read`

    **Returns:**
    - List of clusters with:
      - `id`: Cluster UUID
      - `name`: Cluster name
      - `virtual_machines`: List of VMs in the cluster
      - `device_assignments`: List of devices assigned to the cluster
    """
    try:
        resolver = ClusterResolver(nautobot_service)
        clusters = await resolver.get_all_clusters()
        return clusters
    except Exception as e:
        logger.error(f"Failed to fetch clusters: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch clusters: {str(e)}",
        )


@router.get(
    "/clusters/{cluster_id}", response_model=Cluster, summary="🔷 GraphQL: Get Cluster Details"
)
async def get_cluster_by_id(
    cluster_id: str,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
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
        logger.error(f"Failed to fetch cluster {cluster_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch cluster: {str(e)}",
        )


@router.post(
    "/virtual-machines",
    summary="🔧 REST: Create Virtual Machine",
    status_code=status.HTTP_201_CREATED,
)
async def create_virtual_machine(
    vm_request: AddVirtualMachineRequest,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
):
    """
    Create a new virtual machine in Nautobot.

    This endpoint creates a VM and optionally creates a virtual interface with an IP address.

    **🔧 This endpoint uses REST API** to create the virtual machine.

    **Required Permission:** `nautobot.devices:write`

    **Request Body:**
    - `name`: VM name (required)
    - `status`: Status UUID (required)
    - `cluster`: Cluster UUID (required)
    - `role`: Role UUID (optional)
    - `platform`: Platform UUID (optional)
    - `vcpus`: Number of virtual CPUs (optional)
    - `memory`: Memory in MB (optional)
    - `disk`: Disk size in GB (optional)
    - `softwareVersion`: Software version UUID (optional)
    - `softwareImageFile`: Software image file UUID (optional)
    - `tags`: List of tag UUIDs (optional)
    - `interfaceName`: Name for the first interface (optional)
    - `primaryIpv4`: Primary IPv4 address (optional)

    **Returns:**
    - Created VM object with ID
    - If an interface was created, also includes interface data

    **Raises:**
    - `400`: Invalid request data
    - `500`: VM creation failed
    """
    try:
        logger.info("=" * 80)
        logger.info("======= PHASE 1: CREATE VIRTUAL MACHINE =======")
        logger.info("=" * 80)
        logger.info(f"VM Name: {vm_request.name}")
        logger.info(f"Cluster: {vm_request.cluster}")
        logger.info(f"Status: {vm_request.status}")
        logger.info(f"Interface Name: {vm_request.interfaceName}")
        logger.info(f"Primary IPv4: {vm_request.primaryIpv4}")
        logger.info(f"Namespace: {vm_request.namespace}")

        # Initialize the VM manager
        vm_manager = VirtualMachineManager(nautobot_service)

        # Handle software image file (convert single ID to list if provided)
        software_image_file_ids = (
            [vm_request.softwareImageFile] if vm_request.softwareImageFile else None
        )

        logger.info("Calling create_virtual_machine...")
        vm_result = await vm_manager.create_virtual_machine(
            name=vm_request.name,
            cluster_id=vm_request.cluster,
            status_id=vm_request.status,
            role_id=vm_request.role,
            platform_id=vm_request.platform,
            vcpus=vm_request.vcpus,
            memory=vm_request.memory,
            disk=vm_request.disk,
            software_version_id=vm_request.softwareVersion,
            software_image_file_ids=software_image_file_ids,
            tags=vm_request.tags,
        )

        vm_id = vm_result.get("id")
        if not vm_id:
            raise Exception("VM creation succeeded but no ID returned")

        logger.info(f"✓ PHASE 1 COMPLETE: VM created with ID: {vm_id}")

        response_data = {
            "virtual_machine": vm_result,
            "interface": None,
            "ip_address": None,
            "message": f"Virtual machine '{vm_request.name}' created successfully",
        }

        # Create the interface if interfaceName is provided
        if vm_request.interfaceName:
            logger.info("")
            logger.info("=" * 80)
            logger.info("======= PHASE 2: CREATE VIRTUAL INTERFACE =======")
            logger.info("=" * 80)
            logger.info(f"Interface Name: {vm_request.interfaceName}")
            logger.info(f"VM ID: {vm_id}")
            logger.info(f"Status ID: {vm_request.status}")

            interface_result = await vm_manager.create_virtual_interface(
                name=vm_request.interfaceName,
                virtual_machine_id=vm_id,
                status_id=vm_request.status,
                enabled=True,
            )

            interface_id = interface_result.get("id")
            if not interface_id:
                raise Exception("Interface creation succeeded but no ID returned")

            logger.info(f"✓ PHASE 2 COMPLETE: Interface created with ID: {interface_id}")
            response_data["interface"] = interface_result
            response_data["message"] += f" with interface '{vm_request.interfaceName}'"

            # Handle IP address assignment if provided
            if vm_request.primaryIpv4:
                try:
                    logger.info("")
                    logger.info("=" * 80)
                    logger.info("======= PHASE 3: CREATE IP ADDRESS =======")
                    logger.info("=" * 80)
                    logger.info(f"IP Address: {vm_request.primaryIpv4}")
                    logger.info(f"Namespace (from request): {vm_request.namespace}")

                    # Initialize resolvers and managers
                    network_resolver = NetworkResolver(nautobot_service)
                    metadata_resolver = MetadataResolver(nautobot_service)
                    ip_manager = IPManager(
                        nautobot_service, network_resolver, metadata_resolver
                    )

                    # Resolve namespace (use "Global" as default if not specified)
                    namespace_id = vm_request.namespace
                    if not namespace_id:
                        logger.info("No namespace UUID provided, resolving 'Global' namespace...")
                        namespace_id = await network_resolver.resolve_namespace_id("Global")
                        if not namespace_id:
                            raise Exception(
                                "Could not resolve 'Global' namespace. Please specify a namespace."
                            )
                        logger.info(f"Resolved 'Global' namespace to UUID: {namespace_id}")
                    else:
                        logger.info(f"Using provided namespace UUID: {namespace_id}")

                    # Create or get the IP address
                    logger.info(f"Creating/ensuring IP address {vm_request.primaryIpv4} exists...")
                    ip_id = await ip_manager.ensure_ip_address_exists(
                        ip_address=vm_request.primaryIpv4,
                        namespace_id=namespace_id,
                        status_name="active",
                        add_prefixes_automatically=True,
                    )

                    logger.info(f"✓ PHASE 3 COMPLETE: IP address created/found with ID: {ip_id}")

                    logger.info("")
                    logger.info("=" * 80)
                    logger.info("======= PHASE 4: ASSIGN IP TO INTERFACE =======")
                    logger.info("=" * 80)
                    logger.info(f"IP ID: {ip_id}")
                    logger.info(f"Interface ID: {interface_id}")
                    logger.info(f"IP Address: {vm_request.primaryIpv4}")

                    # Assign IP to virtual interface
                    await vm_manager.assign_ip_to_virtual_interface(
                        ip_address_id=ip_id, virtual_interface_id=interface_id
                    )

                    logger.info(f"✓ PHASE 4 COMPLETE: IP assigned to interface")

                    logger.info("")
                    logger.info("=" * 80)
                    logger.info("======= PHASE 5: SET PRIMARY IP FOR VM =======")
                    logger.info("=" * 80)
                    logger.info(f"VM ID: {vm_id}")
                    logger.info(f"IP ID: {ip_id}")

                    # Set as primary IP for the VM
                    await vm_manager.assign_primary_ip_to_vm(
                        vm_id=vm_id, ip_address_id=ip_id
                    )

                    logger.info(f"✓ PHASE 5 COMPLETE: Primary IP set for VM")

                    response_data["ip_address"] = {
                        "id": ip_id,
                        "address": vm_request.primaryIpv4,
                    }
                    response_data["message"] += f" and primary IP {vm_request.primaryIpv4}"

                    logger.info("")
                    logger.info("=" * 80)
                    logger.info("======= ALL PHASES COMPLETE =======")
                    logger.info("=" * 80)
                    logger.info(f"VM ID: {vm_id}")
                    logger.info(f"Interface ID: {interface_id}")
                    logger.info(f"IP ID: {ip_id}")
                    logger.info(f"Primary IP: {vm_request.primaryIpv4}")

                except Exception as ip_error:
                    logger.error("")
                    logger.error("=" * 80)
                    logger.error("======= ERROR IN IP ASSIGNMENT =======")
                    logger.error("=" * 80)
                    logger.error(f"Error: {ip_error}", exc_info=True)
                    response_data["warning"] = (
                        f"VM and interface created, but IP assignment failed: {str(ip_error)}"
                    )

        return response_data

    except Exception as e:
        logger.error("")
        logger.error("=" * 80)
        logger.error("======= FATAL ERROR =======")
        logger.error("=" * 80)
        logger.error(f"Error: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create virtual machine: {str(e)}",
        )


@router.post(
    "/interfaces",
    summary="🔧 REST: Create Virtual Interface",
    status_code=status.HTTP_201_CREATED,
)
async def create_virtual_interface(
    interface_request: AddVirtualInterfaceRequest,
    current_user: dict = Depends(require_permission("nautobot.devices", "write")),
):
    """
    Create a new virtual interface for a VM in Nautobot.

    **🔧 This endpoint uses REST API** to create the virtual interface.

    **Required Permission:** `nautobot.devices:write`

    **Request Body:**
    - `name`: Interface name (required)
    - `virtual_machine`: VM UUID (required)
    - `status`: Status UUID (required)
    - `enabled`: Whether the interface is enabled (default: True)
    - `mac_address`: MAC address (optional)
    - `mtu`: MTU value (optional)
    - `description`: Description (optional)
    - `mode`: Mode like 'access', 'tagged' (optional)
    - `untagged_vlan`: Untagged VLAN UUID (optional)
    - `tagged_vlans`: List of tagged VLAN UUIDs (optional)
    - `tags`: List of tag UUIDs (optional)

    **Returns:**
    - Created interface object with ID

    **Raises:**
    - `400`: Invalid request data
    - `500`: Interface creation failed
    """
    try:
        logger.info(
            f"Creating virtual interface '{interface_request.name}' "
            f"for VM {interface_request.virtual_machine}"
        )

        # Initialize the VM manager
        vm_manager = VirtualMachineManager(nautobot_service)

        # Create the virtual interface
        result = await vm_manager.create_virtual_interface(
            name=interface_request.name,
            virtual_machine_id=interface_request.virtual_machine,
            status_id=interface_request.status,
            enabled=interface_request.enabled,
            mac_address=interface_request.mac_address,
            mtu=interface_request.mtu,
            description=interface_request.description,
            mode=interface_request.mode,
            untagged_vlan_id=interface_request.untagged_vlan,
            tagged_vlan_ids=interface_request.tagged_vlans,
            tags=interface_request.tags,
        )

        logger.info(
            f"Successfully created interface '{interface_request.name}' "
            f"with ID: {result.get('id')}"
        )
        return result

    except Exception as e:
        logger.error(f"Failed to create virtual interface: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create virtual interface: {str(e)}",
        )
