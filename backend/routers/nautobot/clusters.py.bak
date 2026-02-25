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
    ClusterGroup,
    AddVirtualMachineRequest,
    AddVirtualInterfaceRequest,
)
from services.nautobot import nautobot_service
from services.nautobot.resolvers import (
    ClusterResolver,
    NetworkResolver,
    MetadataResolver,
)
from services.nautobot.managers.vm_manager import VirtualMachineManager
from services.nautobot.managers import IPManager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/virtualization", tags=["nautobot-virtualization"])


@router.get(
    "/clusters", response_model=List[Cluster], summary="🔷 GraphQL: List Clusters"
)
async def get_clusters(
    group: str = None,
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
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
        logger.error(f"Failed to fetch clusters: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch clusters: {str(e)}",
        )


@router.get(
    "/cluster-groups",
    response_model=List[ClusterGroup],
    summary="🔷 GraphQL: List Cluster Groups",
)
async def get_cluster_groups(
    current_user: dict = Depends(require_permission("nautobot.devices", "read")),
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
        logger.error(f"Failed to fetch cluster groups: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch cluster groups: {str(e)}",
        )


@router.get(
    "/clusters/{cluster_id}",
    response_model=Cluster,
    summary="🔷 GraphQL: Get Cluster Details",
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
    Create a new virtual machine in Nautobot with interfaces and IP addresses.

    This endpoint creates a VM and optionally creates virtual interfaces with IP addresses.
    Supports both new interface array format and legacy single interface format.

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
    - `customFieldValues`: Dict of custom field key-value pairs (optional)
    - `interfaces`: List of interface configurations with properties (optional, new format)
    - `interfaceName`: Name for the first interface (optional, legacy format)
    - `primaryIpv4`: Primary IPv4 address (optional, legacy format)

    **Returns:**
    - Created VM object with ID
    - List of created interfaces
    - List of created IP addresses
    - Primary IP assignment status

    **Raises:**
    - `400`: Invalid request data
    - `500`: VM creation failed
    """
    try:
        logger.info("=" * 80)
        logger.info("======= RECEIVED VM CREATION REQUEST =======")
        logger.info("=" * 80)
        logger.info(f"Request data: {vm_request.model_dump()}")
        logger.info("=" * 80)
        logger.info("======= PHASE 1: CREATE VIRTUAL MACHINE =======")
        logger.info("=" * 80)
        logger.info(f"VM Name: {vm_request.name}")
        logger.info(f"Cluster: {vm_request.cluster}")
        logger.info(f"Status: {vm_request.status}")
        logger.info(f"Custom Fields: {vm_request.customFieldValues}")
        logger.info(f"Interfaces count: {len(vm_request.interfaces)}")
        # Legacy format logging
        if vm_request.interfaceName:
            logger.info(f"Legacy Interface Name: {vm_request.interfaceName}")
            logger.info(f"Legacy Primary IPv4: {vm_request.primaryIpv4}")

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
            custom_fields=vm_request.customFieldValues,
        )

        vm_id = vm_result.get("id")
        if not vm_id:
            raise Exception("VM creation succeeded but no ID returned")

        logger.info(f"✓ PHASE 1 COMPLETE: VM created with ID: {vm_id}")

        response_data = {
            "virtual_machine": vm_result,
            "interfaces": [],
            "ip_addresses": [],
            "primary_ip": None,
            "warnings": [],
            "message": f"Virtual machine '{vm_request.name}' created successfully",
        }

        # Initialize resolvers and managers for interface/IP operations
        network_resolver = NetworkResolver(nautobot_service)
        metadata_resolver = MetadataResolver(nautobot_service)
        ip_manager = IPManager(nautobot_service, network_resolver, metadata_resolver)

        # Track primary IP for the VM
        primary_ip_id = None

        # Determine which interface format to use
        use_new_format = len(vm_request.interfaces) > 0
        use_legacy_format = vm_request.interfaceName is not None

        # Check if we need to process interfaces at all
        if not use_new_format and not use_legacy_format:
            logger.info("")
            logger.info("=" * 80)
            logger.info(
                "======= SKIPPING INTERFACE CREATION: No interfaces provided ======="
            )
            logger.info("=" * 80)
            logger.info("VM created without interfaces (as requested)")

        if use_new_format:
            # NEW FORMAT: Process interfaces array
            logger.info("")
            logger.info("=" * 80)
            logger.info("======= PHASE 2: CREATE INTERFACES (NEW FORMAT) =======")
            logger.info("=" * 80)
            logger.info(f"Processing {len(vm_request.interfaces)} interfaces")

            for idx, interface_data in enumerate(vm_request.interfaces):
                try:
                    logger.info(
                        f"\n--- Interface {idx + 1}/{len(vm_request.interfaces)}: {interface_data.name} ---"
                    )

                    # Create the virtual interface with all properties
                    logger.info(f"Creating interface '{interface_data.name}'...")
                    interface_result = await vm_manager.create_virtual_interface(
                        name=interface_data.name,
                        virtual_machine_id=vm_id,
                        status_id=interface_data.status,
                        enabled=interface_data.enabled
                        if interface_data.enabled is not None
                        else True,
                        mac_address=interface_data.mac_address,
                        mtu=interface_data.mtu,
                        description=interface_data.description,
                        mode=interface_data.mode,
                        untagged_vlan_id=interface_data.untagged_vlan,
                        tagged_vlan_ids=interface_data.tagged_vlans.split(",")
                        if interface_data.tagged_vlans
                        else None,
                        tags=interface_data.tags.split(",")
                        if interface_data.tags
                        else None,
                    )

                    interface_id = interface_result.get("id")
                    if not interface_id:
                        raise Exception(
                            f"Interface '{interface_data.name}' created but no ID returned"
                        )

                    logger.info(
                        f"✓ Interface '{interface_data.name}' created with ID: {interface_id}"
                    )
                    response_data["interfaces"].append(
                        {
                            "name": interface_data.name,
                            "id": interface_id,
                            "status": "success",
                        }
                    )

                    # Process IP addresses for this interface (skip if none provided)
                    if (
                        interface_data.ip_addresses
                        and len(interface_data.ip_addresses) > 0
                    ):
                        logger.info("")
                        logger.info(
                            f"📍 Processing {len(interface_data.ip_addresses)} IP address(es) for interface '{interface_data.name}'"
                        )

                        for ip_idx, ip_data in enumerate(interface_data.ip_addresses):
                            try:
                                logger.info("")
                                logger.info("=" * 60)
                                logger.info(
                                    f"======== IP ADDRESS {ip_idx + 1}/{len(interface_data.ip_addresses)}: {ip_data.address} ========"
                                )
                                logger.info("=" * 60)
                                logger.info(f"  Interface: {interface_data.name}")
                                logger.info(f"  Namespace: {ip_data.namespace}")
                                logger.info(f"  IP Role: {ip_data.ip_role or 'None'}")
                                logger.info(
                                    f"  Is Primary: {ip_data.is_primary or False}"
                                )
                                logger.info("")

                                # Create or get the IP address
                                logger.info(
                                    "  → Step 1: Creating/ensuring IP address exists in Nautobot..."
                                )

                                # Prepare additional IP creation kwargs
                                ip_kwargs = {}
                                if ip_data.ip_role:
                                    ip_kwargs["role"] = {"id": ip_data.ip_role}
                                    logger.info(
                                        f"  → Including IP role: {ip_data.ip_role}"
                                    )

                                ip_id = await ip_manager.ensure_ip_address_exists(
                                    ip_address=ip_data.address,
                                    namespace_id=ip_data.namespace,
                                    status_name="active",
                                    add_prefixes_automatically=True,
                                    **ip_kwargs,
                                )

                                logger.info(
                                    f"  ✓ Step 1 Complete: IP address ID: {ip_id}"
                                )
                                logger.info("")

                                # Assign IP to virtual interface
                                logger.info(
                                    f"  → Step 2: Assigning IP to interface '{interface_data.name}'..."
                                )
                                await vm_manager.assign_ip_to_virtual_interface(
                                    ip_address_id=ip_id,
                                    virtual_interface_id=interface_id,
                                )

                                logger.info(
                                    "  ✓ Step 2 Complete: IP assigned to interface"
                                )
                                logger.info("")

                                response_data["ip_addresses"].append(
                                    {
                                        "address": ip_data.address,
                                        "id": ip_id,
                                        "interface": interface_data.name,
                                        "is_primary": ip_data.is_primary,
                                    }
                                )

                                # Track primary IP
                                if ip_data.is_primary and not primary_ip_id:
                                    primary_ip_id = ip_id
                                    logger.info("  🌟 Marked as PRIMARY IP for VM")
                                    logger.info("")

                                logger.info("=" * 60)
                                logger.info(
                                    f"✅ IP ADDRESS {ip_data.address} PROCESSED SUCCESSFULLY"
                                )
                                logger.info("=" * 60)

                            except Exception as ip_error:
                                logger.error("")
                                logger.error("=" * 60)
                                logger.error(
                                    f"❌ FAILED TO PROCESS IP: {ip_data.address}"
                                )
                                logger.error("=" * 60)
                                logger.error(f"  Error: {ip_error}")
                                logger.error("=" * 60)
                                response_data["warnings"].append(
                                    f"Failed to create/assign IP {ip_data.address} on interface {interface_data.name}: {str(ip_error)}"
                                )

                except Exception as iface_error:
                    logger.error(
                        f"✗ Failed to create interface '{interface_data.name}': {iface_error}",
                        exc_info=True,
                    )
                    response_data["warnings"].append(
                        f"Failed to create interface {interface_data.name}: {str(iface_error)}"
                    )

            logger.info("")
            logger.info(
                f"✓ PHASE 2 COMPLETE: Created {len(response_data['interfaces'])} interfaces"
            )

        elif use_legacy_format:
            # LEGACY FORMAT: Single interface with single IP
            logger.info("")
            logger.info("=" * 80)
            logger.info("======= PHASE 2: CREATE INTERFACE (LEGACY FORMAT) =======")
            logger.info("=" * 80)
            logger.info(f"Interface Name: {vm_request.interfaceName}")

            try:
                interface_result = await vm_manager.create_virtual_interface(
                    name=vm_request.interfaceName,
                    virtual_machine_id=vm_id,
                    status_id=vm_request.status,
                    enabled=True,
                )

                interface_id = interface_result.get("id")
                if not interface_id:
                    raise Exception("Interface creation succeeded but no ID returned")

                logger.info(f"✓ Interface created with ID: {interface_id}")
                response_data["interfaces"].append(
                    {
                        "name": vm_request.interfaceName,
                        "id": interface_id,
                        "status": "success",
                    }
                )

                # Handle IP address if provided
                if vm_request.primaryIpv4:
                    try:
                        logger.info("")
                        logger.info("=" * 60)
                        logger.info(
                            f"======== IP ADDRESS: {vm_request.primaryIpv4} ========"
                        )
                        logger.info("=" * 60)
                        logger.info(f"  Interface: {vm_request.interfaceName}")
                        logger.info(
                            f"  Namespace: {vm_request.namespace or 'Global (default)'}"
                        )
                        logger.info("  Is Primary: True")
                        logger.info("")

                        # Resolve namespace (use "Global" as default if not specified)
                        namespace_id = vm_request.namespace
                        if not namespace_id:
                            logger.info("  → Resolving 'Global' namespace...")
                            namespace_id = await network_resolver.resolve_namespace_id(
                                "Global"
                            )
                            if not namespace_id:
                                raise Exception("Could not resolve 'Global' namespace")
                            logger.info(f"  ✓ Resolved namespace ID: {namespace_id}")
                            logger.info("")

                        # Create or get the IP address
                        logger.info(
                            "  → Step 1: Creating/ensuring IP address exists in Nautobot..."
                        )
                        ip_id = await ip_manager.ensure_ip_address_exists(
                            ip_address=vm_request.primaryIpv4,
                            namespace_id=namespace_id,
                            status_name="active",
                            add_prefixes_automatically=True,
                        )

                        logger.info(f"  ✓ Step 1 Complete: IP address ID: {ip_id}")
                        logger.info("")

                        # Assign IP to virtual interface
                        logger.info(
                            f"  → Step 2: Assigning IP to interface '{vm_request.interfaceName}'..."
                        )
                        await vm_manager.assign_ip_to_virtual_interface(
                            ip_address_id=ip_id,
                            virtual_interface_id=interface_id,
                        )

                        logger.info("  ✓ Step 2 Complete: IP assigned to interface")
                        logger.info("")
                        logger.info("=" * 60)
                        logger.info(
                            f"✅ IP ADDRESS {vm_request.primaryIpv4} PROCESSED SUCCESSFULLY"
                        )
                        logger.info("=" * 60)

                        response_data["ip_addresses"].append(
                            {
                                "address": vm_request.primaryIpv4,
                                "id": ip_id,
                                "interface": vm_request.interfaceName,
                                "is_primary": True,
                            }
                        )

                        primary_ip_id = ip_id

                    except Exception as ip_error:
                        logger.error("")
                        logger.error("=" * 60)
                        logger.error(
                            f"❌ FAILED TO PROCESS IP: {vm_request.primaryIpv4}"
                        )
                        logger.error("=" * 60)
                        logger.error(f"  Error: {ip_error}")
                        logger.error("=" * 60)
                        response_data["warnings"].append(
                            f"VM and interface created, but IP assignment failed: {str(ip_error)}"
                        )

            except Exception as iface_error:
                logger.error(
                    f"✗ Interface creation failed: {iface_error}", exc_info=True
                )
                response_data["warnings"].append(
                    f"VM created, but interface creation failed: {str(iface_error)}"
                )

        # Set primary IP for the VM if one was marked as primary
        if primary_ip_id:
            try:
                logger.info("")
                logger.info("=" * 80)
                logger.info("======= PHASE 3: SET PRIMARY IP FOR VM =======")
                logger.info("=" * 80)
                logger.info(f"VM ID: {vm_id}")
                logger.info(f"Primary IP ID: {primary_ip_id}")

                await vm_manager.assign_primary_ip_to_vm(
                    vm_id=vm_id,
                    ip_address_id=primary_ip_id,
                )

                logger.info("✓ PHASE 3 COMPLETE: Primary IP set for VM")
                response_data["primary_ip"] = primary_ip_id

                # Find the primary IP address in response data
                for ip in response_data["ip_addresses"]:
                    if ip["id"] == primary_ip_id:
                        response_data["message"] += f" with primary IP {ip['address']}"
                        break

            except Exception as primary_error:
                logger.error(
                    f"✗ Failed to set primary IP: {primary_error}", exc_info=True
                )
                response_data["warnings"].append(
                    f"VM and interfaces created, but failed to set primary IP: {str(primary_error)}"
                )

        # Update final message
        if response_data["interfaces"]:
            response_data["message"] += (
                f" with {len(response_data['interfaces'])} interface(s)"
            )
        if response_data["ip_addresses"]:
            response_data["message"] += (
                f" and {len(response_data['ip_addresses'])} IP address(es)"
            )

        logger.info("")
        logger.info("=" * 80)
        logger.info("======= ALL PHASES COMPLETE =======")
        logger.info("=" * 80)
        logger.info(f"VM ID: {vm_id}")
        logger.info(f"Interfaces created: {len(response_data['interfaces'])}")
        logger.info(f"IP addresses created: {len(response_data['ip_addresses'])}")
        logger.info(f"Primary IP: {primary_ip_id}")
        logger.info(f"Warnings: {len(response_data['warnings'])}")

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
