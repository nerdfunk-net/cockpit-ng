"""
Virtual machine interface sync workflow for Nautobot.

Handles create/update/delete of VM interfaces and IP assignments.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from services.nautobot import NautobotService
from services.nautobot.devices.common import DeviceCommonService
from services.nautobot.devices.types import InterfaceUpdateResult
from services.nautobot.managers import IPManager
from services.nautobot.managers.vm_manager import VirtualMachineManager
from services.nautobot.resolvers import MetadataResolver, NetworkResolver

logger = logging.getLogger(__name__)


def _parse_tagged_vlan_ids(tagged_vlans: Any) -> Optional[list[str]]:
    if tagged_vlans is None:
        return None
    if isinstance(tagged_vlans, list):
        return [str(v) for v in tagged_vlans if v]
    if isinstance(tagged_vlans, str) and tagged_vlans.strip():
        return [v.strip() for v in tagged_vlans.split(",") if v.strip()]
    return None


def _parse_tag_ids(tags: Any) -> Optional[list[str]]:
    if tags is None:
        return None
    if isinstance(tags, list):
        return [str(t) for t in tags if t]
    if isinstance(tags, str) and tags.strip():
        return [t.strip() for t in tags.split(",") if t.strip()]
    return None


class VirtualMachineInterfaceWorkflow:
    """Sync virtual interfaces and IPs for a VM."""

    def __init__(self, nautobot_service: NautobotService):
        self.nautobot = nautobot_service
        self.vm_manager = VirtualMachineManager(nautobot_service)
        self.common = DeviceCommonService(nautobot_service)
        network_resolver = NetworkResolver(nautobot_service)
        metadata_resolver = MetadataResolver(nautobot_service)
        self.ip_manager = IPManager(
            nautobot_service, network_resolver, metadata_resolver
        )

    async def sync_vm_interfaces(
        self,
        vm_id: str,
        interfaces: List[Dict[str, Any]],
        *,
        sync_interfaces: bool = True,
        add_prefixes_automatically: bool = True,
    ) -> InterfaceUpdateResult:
        """Create, update, or delete VM interfaces to match the desired list."""
        warnings: List[str] = []
        created_names: List[str] = []
        updated_names: List[str] = []
        failed_names: List[str] = []
        deleted_count = 0
        primary_ip_id: Optional[str] = None

        desired_names = {
            (iface.get("name") or "").strip()
            for iface in interfaces
            if (iface.get("name") or "").strip()
        }

        existing_by_name: Dict[str, Dict[str, Any]] = {}
        for existing in await self.vm_manager.list_virtual_interfaces(vm_id):
            name = (existing.get("name") or "").strip()
            if name:
                existing_by_name[name] = existing

        if sync_interfaces:
            for name, existing in list(existing_by_name.items()):
                if name in desired_names:
                    continue
                interface_id = existing.get("id")
                if not interface_id:
                    continue
                try:
                    await self.vm_manager.delete_virtual_interface(interface_id)
                    deleted_count += 1
                    del existing_by_name[name]
                    logger.info("Deleted orphan VM interface %s", name)
                except Exception as exc:
                    warnings.append(f"Failed to delete interface {name}: {str(exc)}")

        ip_address_map = await self._ensure_ip_addresses(
            interfaces=interfaces,
            warnings=warnings,
            add_prefixes_automatically=add_prefixes_automatically,
        )

        for interface in interfaces:
            iface_name = (interface.get("name") or "").strip()
            if not iface_name:
                continue

            status_id = interface.get("status")
            if not status_id:
                warnings.append(f"Interface {iface_name}: missing status, skipping")
                failed_names.append(iface_name)
                continue

            try:
                existing = existing_by_name.get(iface_name)
                tagged_vlan_ids = _parse_tagged_vlan_ids(interface.get("tagged_vlans"))
                tag_ids = _parse_tag_ids(interface.get("tags"))

                if existing and existing.get("id"):
                    interface_id = existing["id"]
                    await self.vm_manager.update_virtual_interface(
                        interface_id,
                        status_id=status_id,
                        enabled=interface.get("enabled")
                        if interface.get("enabled") is not None
                        else True,
                        mac_address=interface.get("mac_address"),
                        mtu=interface.get("mtu"),
                        description=interface.get("description"),
                        mode=interface.get("mode"),
                        untagged_vlan_id=interface.get("untagged_vlan"),
                        tagged_vlan_ids=tagged_vlan_ids,
                        tags=tag_ids,
                    )
                    updated_names.append(iface_name)
                else:
                    result = await self.vm_manager.create_virtual_interface(
                        name=iface_name,
                        virtual_machine_id=vm_id,
                        status_id=status_id,
                        enabled=interface.get("enabled")
                        if interface.get("enabled") is not None
                        else True,
                        mac_address=interface.get("mac_address"),
                        mtu=interface.get("mtu"),
                        description=interface.get("description"),
                        mode=interface.get("mode"),
                        untagged_vlan_id=interface.get("untagged_vlan"),
                        tagged_vlan_ids=tagged_vlan_ids,
                        tags=tag_ids,
                    )
                    interface_id = result.get("id")
                    if not interface_id:
                        raise RuntimeError(
                            f"Interface '{iface_name}' created but no ID returned"
                        )
                    created_names.append(iface_name)
                    existing_by_name[iface_name] = result

                await self.vm_manager.clean_virtual_interface_ips(interface_id)

                ip_addresses = interface.get("ip_addresses") or []
                for ip_data in ip_addresses:
                    address = ip_data.get("address")
                    if not address:
                        continue

                    namespace = ip_data.get("namespace")
                    if not namespace:
                        warnings.append(
                            f"Interface {iface_name}: namespace required for {address}"
                        )
                        continue

                    namespace_id = await self.common.resolve_namespace_id(namespace)
                    ip_kwargs: Dict[str, Any] = {}
                    if ip_data.get("ip_role"):
                        ip_kwargs["role"] = {"id": ip_data["ip_role"]}

                    ip_id = await self.ip_manager.ensure_ip_address_exists(
                        ip_address=address,
                        namespace_id=namespace_id,
                        status_name="active",
                        add_prefixes_automatically=add_prefixes_automatically,
                        **ip_kwargs,
                    )

                    await self.vm_manager.assign_ip_to_virtual_interface(
                        ip_address_id=ip_id,
                        virtual_interface_id=interface_id,
                    )

                    if ip_data.get("is_primary") and not primary_ip_id:
                        primary_ip_id = ip_id

            except Exception as exc:
                logger.error(
                    "Failed to sync VM interface %s: %s",
                    iface_name,
                    exc,
                    exc_info=True,
                )
                failed_names.append(iface_name)
                warnings.append(f"Interface {iface_name}: {str(exc)}")

        if primary_ip_id:
            try:
                await self.vm_manager.assign_primary_ip_to_vm(vm_id, primary_ip_id)
            except Exception as exc:
                warnings.append(f"Failed to set primary IP: {str(exc)}")

        return InterfaceUpdateResult(
            interfaces_created=len(created_names),
            interfaces_updated=len(updated_names),
            interfaces_failed=len(failed_names),
            interfaces_deleted=deleted_count,
            ip_addresses_created=len(ip_address_map),
            primary_ip4_id=primary_ip_id,
            warnings=warnings,
        )

    async def _ensure_ip_addresses(
        self,
        interfaces: List[Dict[str, Any]],
        warnings: List[str],
        add_prefixes_automatically: bool,
    ) -> Dict[str, str]:
        """Build map of interface_name:address -> IP UUID."""
        ip_address_map: Dict[str, str] = {}

        for interface in interfaces:
            iface_name = (interface.get("name") or "").strip()
            if not iface_name:
                continue

            ip_addresses = interface.get("ip_addresses") or []
            for ip_data in ip_addresses:
                address = ip_data.get("address")
                if not address:
                    continue

                namespace = ip_data.get("namespace")
                if not namespace:
                    warnings.append(
                        f"Interface {iface_name}: namespace required for {address}"
                    )
                    continue

                try:
                    namespace_id = await self.common.resolve_namespace_id(namespace)
                    ip_kwargs: Dict[str, Any] = {}
                    if ip_data.get("ip_role"):
                        ip_kwargs["role"] = {"id": ip_data["ip_role"]}

                    ip_id = await self.ip_manager.ensure_ip_address_exists(
                        ip_address=address,
                        namespace_id=namespace_id,
                        status_name=interface.get("status") or "active",
                        add_prefixes_automatically=add_prefixes_automatically,
                        **ip_kwargs,
                    )
                    ip_address_map[f"{iface_name}:{address}"] = ip_id
                except Exception as exc:
                    warnings.append(
                        f"Interface {iface_name}: failed to ensure IP {address}: {exc}"
                    )

        return ip_address_map
