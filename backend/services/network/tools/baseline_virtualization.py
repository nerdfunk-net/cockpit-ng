"""Virtualization resource creation phase of the baseline import.

Mixin for :class:`services.network.tools.baseline.BaselineImportService`;
expects ``self.nautobot``, ``self.created_resources`` and
``self.get_status_uuid`` from the host class.
"""

import logging
from typing import Any, Dict, List, Optional

from services.nautobot.managers.cluster_manager import ClusterManager
from services.nautobot.managers.ip_manager import IPManager
from services.nautobot.managers.vm_manager import VirtualMachineManager
from services.nautobot.resolvers.metadata_resolver import MetadataResolver
from services.nautobot.resolvers.network_resolver import NetworkResolver
from services.network.tools.baseline_normalizers import (
    DEFAULT_CLUSTER_TYPE_NAME,
    STATUS_CONTENT_TYPE_VM,
    STATUS_CONTENT_TYPE_VM_INTERFACE,
)

logger = logging.getLogger(__name__)


class BaselineVirtualizationMixin:
    """Creation of cluster groups, cluster types, clusters, and VMs."""

    async def create_cluster_groups(
        self, cluster_groups: List[Dict[str, Any]]
    ) -> Dict[str, str]:
        """Create virtualization cluster groups in Nautobot."""
        created: Dict[str, str] = {}
        for group in cluster_groups:
            name = group["name"]
            try:
                response = await self.nautobot.rest_request(
                    f"virtualization/cluster-groups/?name={name}",
                    method="GET",
                )
                if response.get("count", 0) > 0:
                    existing = response["results"][0]
                    created[name] = existing["id"]
                    logger.info("Cluster group '%s' already exists", name)
                    continue

                payload = {"name": name}
                if "description" in group:
                    payload["description"] = group["description"]

                result = await self.nautobot.rest_request(
                    "virtualization/cluster-groups/",
                    method="POST",
                    data=payload,
                )
                created[name] = result["id"]
                logger.info("Created cluster group: %s", name)
            except Exception as e:
                logger.error("Error creating cluster group '%s': %s", name, e)
                raise
        return created

    async def create_cluster_types(
        self, cluster_types: List[Dict[str, Any]]
    ) -> Dict[str, str]:
        """Create virtualization cluster types in Nautobot."""
        created: Dict[str, str] = {}
        cluster_manager = ClusterManager(self.nautobot)
        for cluster_type in cluster_types:
            name = cluster_type["name"]
            try:
                response = await self.nautobot.rest_request(
                    f"virtualization/cluster-types/?name={name}",
                    method="GET",
                )
                if response.get("count", 0) > 0:
                    existing = response["results"][0]
                    created[name] = existing["id"]
                    logger.info("Cluster type '%s' already exists", name)
                    continue

                result = await cluster_manager.create_cluster_type(
                    name=name,
                    slug=cluster_type.get("slug"),
                    description=cluster_type.get("description"),
                )
                created[name] = result["id"]
                logger.info("Created cluster type: %s", name)
            except Exception as e:
                logger.error("Error creating cluster type '%s': %s", name, e)
                raise
        return created

    async def create_clusters(self, clusters: List[Dict[str, Any]]) -> Dict[str, str]:
        """Create virtualization clusters in Nautobot."""
        created: Dict[str, str] = {}
        cluster_manager = ClusterManager(self.nautobot)
        for cluster in clusters:
            name = cluster["name"]
            try:
                response = await self.nautobot.rest_request(
                    f"virtualization/clusters/?name={name}",
                    method="GET",
                )
                if response.get("count", 0) > 0:
                    existing = response["results"][0]
                    created[name] = existing["id"]
                    logger.info("Cluster '%s' already exists", name)
                    continue

                group_id: Optional[str] = None
                group_name = cluster.get("cluster_group")
                if group_name:
                    group_id = self.created_resources["cluster_groups"].get(group_name)
                    if not group_id:
                        logger.warning(
                            "Cluster group '%s' not found for cluster '%s'",
                            group_name,
                            name,
                        )

                location_id: Optional[str] = None
                location_name = cluster.get("location")
                if location_name:
                    location_id = self.created_resources["locations"].get(location_name)
                    if not location_id:
                        logger.warning(
                            "Location '%s' not found for cluster '%s'",
                            location_name,
                            name,
                        )

                type_name = cluster.get("cluster_type", DEFAULT_CLUSTER_TYPE_NAME)
                type_id: Optional[str] = None
                if type_name:
                    type_id = self.created_resources["cluster_types"].get(type_name)
                    if not type_id:
                        logger.warning(
                            "Cluster type '%s' not found for cluster '%s'",
                            type_name,
                            name,
                        )

                description = cluster.get("description")
                result = await cluster_manager.create_cluster(
                    name=name,
                    description=description,
                    cluster_type_id=type_id,
                    cluster_group_id=group_id,
                    location_id=location_id,
                )
                created[name] = result["id"]
                logger.info("Created cluster: %s", name)
            except Exception as e:
                logger.error("Error creating cluster '%s': %s", name, e)
                raise
        return created

    async def create_virtual_machines(
        self, virtual_machines: List[Dict[str, Any]]
    ) -> Dict[str, str]:
        """Create virtual machines in Nautobot using VirtualMachineManager."""
        created: Dict[str, str] = {}
        vm_manager = VirtualMachineManager(self.nautobot)
        network_resolver = NetworkResolver(self.nautobot)
        metadata_resolver = MetadataResolver(self.nautobot)
        ip_manager = IPManager(self.nautobot, network_resolver, metadata_resolver)

        for vm in virtual_machines:
            vm_name = vm.get("name")
            if not vm_name:
                continue
            try:
                existing = await self.nautobot.rest_request(
                    f"virtualization/virtual-machines/?name={vm_name}",
                    method="GET",
                )
                if existing.get("count", 0) > 0:
                    created[vm_name] = existing["results"][0]["id"]
                    logger.info("Virtual machine '%s' already exists", vm_name)
                    continue

                cluster_name = vm.get("cluster")
                cluster_id = self.created_resources["clusters"].get(cluster_name)
                if not cluster_id:
                    logger.error(
                        "Cluster '%s' not found for VM '%s'", cluster_name, vm_name
                    )
                    continue

                status_name = vm.get("status", "active")
                status_uuid = await self.get_status_uuid(
                    status_name, STATUS_CONTENT_TYPE_VM
                )
                if not status_uuid:
                    logger.error(
                        "Status '%s' not found for VM '%s' (content_type=%s)",
                        status_name,
                        vm_name,
                        STATUS_CONTENT_TYPE_VM,
                    )
                    continue

                role_id = None
                if "roles" in vm and vm["roles"]:
                    role_name = (
                        vm["roles"][0] if isinstance(vm["roles"], list) else vm["roles"]
                    )
                    role_id = self.created_resources["roles"].get(role_name)
                elif "role" in vm:
                    role_id = self.created_resources["roles"].get(vm["role"])

                platform_id = None
                if "platform" in vm:
                    platform_id = self.created_resources["platforms"].get(
                        vm["platform"]
                    )

                tag_ids: List[str] = []
                if vm.get("tags"):
                    for tag_name in vm["tags"]:
                        tag_id = self.created_resources["tags"].get(tag_name)
                        if tag_id:
                            tag_ids.append(tag_id)

                custom_fields = vm.get("custom_fields") or {}

                vm_result = await vm_manager.create_virtual_machine(
                    name=vm_name,
                    cluster_id=cluster_id,
                    status_id=status_uuid,
                    role_id=role_id,
                    platform_id=platform_id,
                    tags=tag_ids or None,
                    custom_fields=custom_fields,
                )
                vm_id = vm_result.get("id")
                if not vm_id:
                    raise RuntimeError(f"VM '{vm_name}' created without ID")

                primary_ip_id = None
                if vm.get("interfaces"):
                    for iface in vm["interfaces"]:
                        iface_status_name = iface.get("status", status_name)
                        iface_status_uuid = await self.get_status_uuid(
                            iface_status_name, STATUS_CONTENT_TYPE_VM_INTERFACE
                        )
                        if (
                            not iface_status_uuid
                            and iface_status_name.lower() != "active"
                        ):
                            logger.warning(
                                "Status '%s' not found for VM interface on '%s'; "
                                "falling back to Active",
                                iface_status_name,
                                vm_name,
                            )
                            iface_status_uuid = await self.get_status_uuid(
                                "active", STATUS_CONTENT_TYPE_VM_INTERFACE
                            )
                        if not iface_status_uuid:
                            logger.error(
                                "No suitable status for VM interface on '%s' "
                                "(content_type=%s)",
                                vm_name,
                                STATUS_CONTENT_TYPE_VM_INTERFACE,
                            )
                            raise RuntimeError(
                                "Missing Active status for virtualization interface"
                            )

                        iface_result = await vm_manager.create_virtual_interface(
                            name=iface.get("name", "eth0"),
                            virtual_machine_id=vm_id,
                            status_id=iface_status_uuid,
                            enabled=iface.get("enabled", True),
                        )
                        interface_id = iface_result.get("id")
                        if not interface_id or "ip_address" not in iface:
                            continue

                        namespace = iface.get("namespace", "Global")
                        namespace_id = await network_resolver.resolve_namespace_id(
                            namespace
                        )
                        if not namespace_id:
                            raise ValueError(
                                f"Could not resolve namespace '{namespace}'"
                            )

                        ip_status_name = iface.get("ip_status", "active")
                        ip_id = await ip_manager.ensure_ip_address_exists(
                            ip_address=iface["ip_address"],
                            namespace_id=namespace_id,
                            status_name=ip_status_name,
                            add_prefixes_automatically=True,
                        )
                        await vm_manager.assign_ip_to_virtual_interface(
                            ip_address_id=ip_id,
                            virtual_interface_id=interface_id,
                        )

                        if "primary_ip4" in vm:
                            primary_ip = vm["primary_ip4"].split("/")[0]
                            iface_ip = iface["ip_address"].split("/")[0]
                            if primary_ip == iface_ip:
                                primary_ip_id = ip_id

                if primary_ip_id:
                    await vm_manager.assign_primary_ip_to_vm(vm_id, primary_ip_id)

                created[vm_name] = vm_id
                logger.info("Created virtual machine: %s", vm_name)
            except Exception as e:
                logger.error(
                    "Error creating virtual machine '%s': %s",
                    vm.get("name", "unknown"),
                    e,
                )
                raise

        return created
