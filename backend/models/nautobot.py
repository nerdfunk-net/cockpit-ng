"""
Nautobot-related Pydantic models.
"""

from __future__ import annotations
from pydantic import BaseModel
from typing import Any, Dict, Literal, Optional


class CheckIPRequest(BaseModel):
    """Request to check if IP address exists in Nautobot."""

    ip_address: str


class DeviceOnboardRequest(BaseModel):
    """Device onboarding request model."""

    ip_address: str
    location_id: str
    namespace_id: str
    role_id: str
    status_id: str
    platform_id: str
    secret_groups_id: str
    interface_status_id: str
    ip_address_status_id: str
    prefix_status_id: Optional[str] = None
    port: int = 22
    timeout: int = 30
    tags: Optional[list[str]] = None
    custom_fields: Optional[Dict[str, str]] = None


class SyncNetworkDataRequest(BaseModel):
    """Network data synchronization request model."""

    data: Dict[str, Any]


class DeviceFilter(BaseModel):
    """Device filtering model."""

    location: Optional[str] = None
    device_type: Optional[str] = None
    status: Optional[str] = None


class OffboardDeviceRequest(BaseModel):
    """Device offboarding request model."""

    remove_primary_ip: bool = True
    remove_interface_ips: bool = True
    remove_from_checkmk: bool = True
    nautobot_integration_mode: Literal["remove", "set-offboarding"] = "remove"


class IpAddressData(BaseModel):
    """IP address data model for interface IP addresses."""

    id: Optional[str] = None  # Frontend ID for tracking
    address: str
    namespace: str
    ip_role: Optional[str] = None  # IP address role (e.g., 'Secondary', 'Anycast')
    is_primary: Optional[bool] = None  # Mark as primary IPv4 for the device


class InterfaceData(BaseModel):
    """Interface data model for add device request."""

    id: Optional[str] = None  # Frontend interface ID for LAG mapping
    name: str
    type: str
    status: str
    ip_addresses: list[IpAddressData] = []  # Multiple IP addresses per interface
    # Optional properties
    enabled: Optional[bool] = None
    mgmt_only: Optional[bool] = None
    description: Optional[str] = None
    mac_address: Optional[str] = None
    mtu: Optional[int] = None
    mode: Optional[str] = None
    untagged_vlan: Optional[str] = None
    tagged_vlans: Optional[str] = None
    parent_interface: Optional[str] = None
    bridge: Optional[str] = None
    lag: Optional[str] = None
    tags: Optional[str] = None


class AddDeviceRequest(BaseModel):
    """Request model for adding a device with interfaces."""

    # Device fields
    name: str
    role: str
    status: str
    location: str
    device_type: str
    platform: Optional[str] = None
    software_version: Optional[str] = None
    serial: Optional[str] = None
    asset_tag: Optional[str] = None
    # Tags (list of tag IDs)
    tags: Optional[list[str]] = None
    # Custom fields (key-value pairs)
    custom_fields: Optional[dict[str, str]] = None
    # Prefix configuration
    add_prefix: bool = True
    default_prefix_length: str = "/24"
    # Interfaces array
    interfaces: list[InterfaceData] = []


class UpdateDeviceRequest(BaseModel):
    """Request model for updating an existing device with interfaces.

    All fields are optional - only provided fields will be updated.
    """

    # Device fields (all optional for updates)
    name: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    location: Optional[str] = None
    device_type: Optional[str] = None
    platform: Optional[str] = None
    software_version: Optional[str] = None
    serial: Optional[str] = None
    asset_tag: Optional[str] = None
    # Tags (list of tag IDs)
    tags: Optional[list[str]] = None
    # Custom fields (key-value pairs)
    custom_fields: Optional[dict[str, str]] = None
    # Prefix configuration
    add_prefix: bool = True
    default_prefix_length: str = "/24"
    # Interfaces array
    interfaces: Optional[list[InterfaceData]] = None


# Virtualization models
class VirtualMachine(BaseModel):
    """Virtual machine model."""

    id: str
    name: str


class ClusterDevice(BaseModel):
    """Device assigned to a cluster."""

    id: str
    name: str


class ClusterDeviceAssignment(BaseModel):
    """Device assignment to a cluster."""

    id: str
    device: ClusterDevice


class Cluster(BaseModel):
    """Cluster model for virtualization."""

    id: str
    name: str
    virtual_machines: list[VirtualMachine] = []
    device_assignments: list[ClusterDeviceAssignment] = []


class AddVirtualMachineRequest(BaseModel):
    """Request model for adding a virtual machine to Nautobot."""

    # Required fields
    name: str
    status: str  # Status UUID
    cluster: str  # Cluster UUID

    # Optional VM configuration
    role: Optional[str] = None  # Role UUID
    platform: Optional[str] = None  # Platform UUID
    vcpus: Optional[int] = None
    memory: Optional[int] = None  # Memory in MB
    disk: Optional[int] = None  # Disk size in GB

    # Software version and image
    softwareVersion: Optional[str] = None  # Software version UUID
    softwareImageFile: Optional[str] = None  # Software image file UUID

    # Tags
    tags: Optional[list[str]] = None  # List of tag UUIDs

    # Interface configuration (for the first interface)
    interfaceName: Optional[str] = None
    primaryIpv4: Optional[str] = None  # IPv4 address (e.g., "10.0.0.1/24")
    namespace: Optional[str] = (
        None  # Namespace UUID (defaults to "Global" if not provided)
    )


class AddVirtualInterfaceRequest(BaseModel):
    """Request model for adding a virtual interface to a VM."""

    # Required fields
    name: str
    virtual_machine: str  # VM UUID
    status: str  # Status UUID

    # Optional fields
    enabled: bool = True
    mac_address: Optional[str] = None
    mtu: Optional[int] = None
    description: Optional[str] = None
    mode: Optional[str] = None  # 'access', 'tagged', etc.
    untagged_vlan: Optional[str] = None  # VLAN UUID
    tagged_vlans: Optional[list[str]] = None  # List of VLAN UUIDs
    tags: Optional[list[str]] = None  # List of tag UUIDs
