"""
Nautobot-related Pydantic models.
"""

from __future__ import annotations

import ipaddress
from typing import Any, Dict, List, Literal, Optional, Union
from uuid import UUID

from pydantic import BaseModel, Field, ValidationInfo, field_validator


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
    # Virtual chassis fields — only set when the device is part of a VC
    virtual_chassis_action: Optional[Literal["remove_all", "remove_single"]] = None
    virtual_chassis_id: Optional[str] = None
    chassis_member_ids: Optional[List[str]] = None
    new_master_id: Optional[str] = None
    new_master_name: Optional[str] = None


class IpAddressData(BaseModel):
    """IP address data model for interface IP addresses."""

    id: Optional[str] = None  # Frontend ID for tracking
    address: str
    namespace: str
    ip_role: Optional[str] = None  # IP address role (e.g., 'Secondary', 'Anycast')
    is_primary: Optional[bool] = None  # Mark as primary IPv4 for the device


class InterfaceData(BaseModel):
    """Interface data model for add device/VM request.

    All fields are optional. For VM creation, interfaces themselves are optional.
    IP addresses are also optional - an interface can be created without any IPs.
    """

    id: Optional[str] = None  # Frontend interface ID for LAG mapping
    name: Optional[str] = None  # Interface name (required for actual creation)
    type: Optional[str] = None  # Required for physical devices, not used for VMs
    status: Optional[str] = None  # Interface status (required for actual creation)
    ip_addresses: list[
        IpAddressData
    ] = []  # Multiple IP addresses per interface (optional)
    # Optional properties
    enabled: Optional[bool] = None
    mgmt_only: Optional[bool] = None
    description: Optional[str] = None
    mac_address: Optional[str] = None
    mtu: Optional[int] = None
    mode: Optional[str] = None
    untagged_vlan: Optional[str] = None
    tagged_vlans: Optional[Union[str, list[str]]] = None
    parent_interface: Optional[str] = None
    bridge: Optional[str] = None
    lag: Optional[str] = None
    tags: Optional[Union[str, list[str]]] = None

    @field_validator("tagged_vlans", mode="before")
    @classmethod
    def convert_tagged_vlans_to_string(
        cls, v: Optional[Union[str, list[str]]]
    ) -> Optional[str]:
        """Convert tagged_vlans array to comma-separated string."""
        if v is None:
            return None
        if isinstance(v, list):
            return ",".join(str(vlan) for vlan in v if vlan)
        return v

    @field_validator("tags", mode="before")
    @classmethod
    def convert_tags_to_string(
        cls, v: Optional[Union[str, list[str]]]
    ) -> Optional[str]:
        """Convert tags array to comma-separated string."""
        if v is None:
            return None
        if isinstance(v, list):
            return ",".join(str(tag) for tag in v if tag)
        return v


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
    # Rack placement (all optional; omit to skip)
    rack: Optional[str] = None  # Rack UUID or name
    face: Optional[str] = None  # Rack face: "front" or "rear"
    position: Optional[int] = None  # Rack U position (1 to u_height)
    # Prefix configuration
    add_prefix: bool = True
    default_prefix_length: str = "/24"
    # Virtual chassis membership (optional)
    virtual_chassis_id: Optional[str] = None
    # Create a new virtual chassis and join it as master (mutually exclusive with virtual_chassis_id)
    new_virtual_chassis_name: Optional[str] = None
    # Interfaces array
    interfaces: list[InterfaceData] = []
    # Dry run: validate without creating
    dry_run: bool = False


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
    # Rack assignment
    rack: Optional[str] = None
    position: Optional[int] = None
    face: Optional[str] = None
    # Set to True to explicitly clear rack/position/face (send null to Nautobot)
    clear_rack_assignment: bool = False
    # Set to True to clear only position and face, keeping rack assignment intact
    clear_position_only: bool = False
    # Prefix configuration
    add_prefix: bool = True
    default_prefix_length: str = "/24"
    # Interfaces array
    interfaces: Optional[list[InterfaceData]] = None
    # When True, delete device interfaces not present in the interfaces list
    sync_interfaces: bool = False


# Virtualization models
class VirtualMachine(BaseModel):
    """Virtual machine model."""

    id: str
    name: str


class ClusterGroup(BaseModel):
    """Cluster group model for organizing clusters."""

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
    cluster_group: Optional[ClusterGroup] = None
    virtual_machines: list[VirtualMachine] = []
    device_assignments: list[ClusterDeviceAssignment] = []


class AddVirtualMachineRequest(BaseModel):
    """Request model for adding a virtual machine to Nautobot.

    Only name, status, and cluster are required.
    All other fields (including interfaces and IP addresses) are optional.
    """

    # Required fields (only these three are mandatory)
    name: str
    status: str  # Status UUID
    cluster: str  # Cluster UUID

    # Optional VM configuration
    role: Optional[str] = None  # Role UUID
    clusterGroup: Optional[str] = (
        None  # Cluster Group UUID (informational, not used in creation)
    )
    platform: Optional[str] = None  # Platform UUID
    vcpus: Optional[int] = None
    memory: Optional[int] = None  # Memory in MB
    disk: Optional[int] = None  # Disk size in GB

    # Software version and image
    softwareVersion: Optional[str] = None  # Software version UUID
    softwareImageFile: Optional[str] = None  # Software image file UUID

    # Tags
    tags: Optional[list[str]] = None  # List of tag UUIDs

    # Custom fields (key-value pairs)
    customFieldValues: Optional[dict[str, str]] = None

    # Interfaces array (optional: can be empty list if no interfaces needed)
    interfaces: list[InterfaceData] = []

    # Legacy interface configuration (for backward compatibility)
    # DEPRECATED: Use 'interfaces' array instead
    interfaceName: Optional[str] = None
    primaryIpv4: Optional[str] = None  # IPv4 address (e.g., "10.0.0.1/24")
    namespace: Optional[str] = (
        None  # Namespace UUID (defaults to "Global" if not provided)
    )

    @field_validator(
        "role",
        "clusterGroup",
        "platform",
        "softwareVersion",
        "softwareImageFile",
        "interfaceName",
        "primaryIpv4",
        "namespace",
        mode="before",
    )
    @classmethod
    def convert_empty_string_to_none(cls, v: Optional[str]) -> Optional[str]:
        """Convert empty strings to None for optional string fields."""
        if v is None or (isinstance(v, str) and v.strip() == ""):
            return None
        return v


class UpdateVirtualMachineRequest(BaseModel):
    """Request model for updating an existing virtual machine in Nautobot.

    All fields are optional; only provided fields are updated.
    VM identity comes from the path parameter (not ``name``).
    """

    status: Optional[str] = None  # Status UUID
    cluster: Optional[str] = None  # Cluster UUID
    role: Optional[str] = None  # Role UUID
    clusterGroup: Optional[str] = None  # Informational, not sent to Nautobot
    platform: Optional[str] = None  # Platform UUID
    vcpus: Optional[int] = None
    memory: Optional[int] = None  # Memory in MB
    disk: Optional[int] = None  # Disk size in GB
    softwareVersion: Optional[str] = None  # Software version UUID
    softwareImageFile: Optional[str] = None  # Software image file UUID
    tags: Optional[list[str]] = None  # List of tag UUIDs
    customFieldValues: Optional[dict[str, str]] = None
    interfaces: Optional[list[InterfaceData]] = None
    sync_interfaces: bool = True

    @field_validator(
        "role",
        "clusterGroup",
        "platform",
        "softwareVersion",
        "softwareImageFile",
        "status",
        "cluster",
        mode="before",
    )
    @classmethod
    def convert_empty_string_to_none(cls, v: Optional[str]) -> Optional[str]:
        """Convert empty strings to None for optional string fields."""
        if v is None or (isinstance(v, str) and v.strip() == ""):
            return None
        return v


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


class VirtualChassisListItem(BaseModel):
    """A single virtual chassis entry returned by the list endpoint."""

    id: str
    name: str


class CreateVirtualChassisRequest(BaseModel):
    """Request model for creating a Virtual Chassis in Nautobot."""

    name: str
    domain: Optional[str] = None


class VirtualChassisResponse(BaseModel):
    """Response model for a Virtual Chassis object."""

    id: str
    name: str
    master: Optional[dict] = None
    domain: Optional[str] = None


class VirtualChassisMember(BaseModel):
    """A single member device of a virtual chassis."""

    id: str
    name: str


class VirtualChassisInfo(BaseModel):
    """Virtual chassis details returned by the VC status check."""

    id: str
    name: str
    members: List[VirtualChassisMember]
    master: Optional[VirtualChassisMember] = None


class VcDeviceType(BaseModel):
    """Device type info within a virtual chassis detail."""

    id: str
    model: str


class VcSoftwareVersion(BaseModel):
    """Software version info within a virtual chassis detail."""

    id: str
    version: str


class VcMaster(BaseModel):
    """Master device details within a virtual chassis detail response."""

    id: str
    name: str
    location: Optional[VirtualChassisMember] = None
    role: Optional[VirtualChassisMember] = None
    status: Optional[VirtualChassisMember] = None
    platform: Optional[VirtualChassisMember] = None
    device_type: Optional[VcDeviceType] = None
    software_version: Optional[VcSoftwareVersion] = None


class VirtualChassisDetailResponse(BaseModel):
    """Detailed virtual chassis response including master device attributes."""

    id: str
    name: str
    members: List[VirtualChassisMember] = []
    master: Optional[VcMaster] = None


class DeviceVirtualChassisStatus(BaseModel):
    """Whether a device belongs to a virtual chassis and whether it is the master."""

    is_in_chassis: bool
    is_master: bool
    virtual_chassis: Optional[VirtualChassisInfo] = None


class UpdateVirtualChassisRequest(BaseModel):
    """Request model for updating the master of a virtual chassis."""

    new_master_id: str


# --- Stacks ---


class StackDeviceInfo(BaseModel):
    id: str
    name: str
    serial: str
    location: Optional[Dict[str, Any]] = None
    device_type: Optional[Dict[str, Any]] = None


class ProcessStacksRequest(BaseModel):
    device_ids: List[str] = Field(..., min_length=1)
    separator: str = Field(default=",")


class StackProcessingResult(BaseModel):
    device_id: str
    device_name: str
    success: bool
    message: str
    created_devices: List[str] = Field(default_factory=list)
    virtual_chassis_id: Optional[str] = None
    virtual_chassis_name: Optional[str] = None


class ProcessStacksResponse(BaseModel):
    results: List[StackProcessingResult]
    total: int
    succeeded: int
    failed: int


# --- Rack Mappings ---


class RackMappingItem(BaseModel):
    origin_name: str
    mapped_name: str


class RackMappingsCreate(BaseModel):
    rack_name: str
    location_id: str
    mappings: List[RackMappingItem]


# --- Rack Reservations ---


class RackReservationCreate(BaseModel):
    rack_id: str
    units: List[int]
    description: str
    location_id: str


# --- Contact Associations ---

ContactAssociationObjectType = Literal[
    "dcim.device",
    "virtualization.virtualmachine",
]


class ContactAssociationNamedRef(BaseModel):
    """Nautobot nested lookup by name (role/status)."""

    name: str


ContactAssociationRef = Union[str, UUID, ContactAssociationNamedRef, Dict[str, str]]


def contact_association_ref_to_nautobot(
    value: ContactAssociationRef,
) -> Union[str, Dict[str, str]]:
    """Serialize a role/status reference for the Nautobot REST API."""
    if isinstance(value, ContactAssociationNamedRef):
        return value.model_dump()
    if isinstance(value, dict):
        return value
    return str(value)


class ContactAssociationCreate(BaseModel):
    """Create a contact association on a device or virtual machine."""

    contact_id: UUID
    associated_object_type: ContactAssociationObjectType
    associated_object_id: UUID
    role: ContactAssociationRef = Field(
        default_factory=lambda: ContactAssociationNamedRef(name="Administrative")
    )
    status: ContactAssociationRef = Field(
        default_factory=lambda: ContactAssociationNamedRef(name="Active")
    )

    def to_nautobot_payload(self) -> Dict[str, Any]:
        return {
            "contact": str(self.contact_id),
            "associated_object_type": self.associated_object_type,
            "associated_object_id": str(self.associated_object_id),
            "role": contact_association_ref_to_nautobot(self.role),
            "status": contact_association_ref_to_nautobot(self.status),
        }


class ContactAssociationBulkUpdateItem(BaseModel):
    """Partial update of an existing contact association (requires association id)."""

    id: UUID
    contact_id: Optional[UUID] = None
    associated_object_type: Optional[ContactAssociationObjectType] = None
    associated_object_id: Optional[UUID] = None
    role: Optional[ContactAssociationRef] = None
    status: Optional[ContactAssociationRef] = None

    def to_nautobot_payload(self) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"id": str(self.id)}
        if self.contact_id is not None:
            payload["contact"] = str(self.contact_id)
        if self.associated_object_type is not None:
            payload["associated_object_type"] = self.associated_object_type
        if self.associated_object_id is not None:
            payload["associated_object_id"] = str(self.associated_object_id)
        if self.role is not None:
            payload["role"] = contact_association_ref_to_nautobot(self.role)
        if self.status is not None:
            payload["status"] = contact_association_ref_to_nautobot(self.status)
        return payload


class ContactAssociationBulkUpdateRequest(BaseModel):
    """Bulk partial update of contact associations."""

    items: List[ContactAssociationBulkUpdateItem] = Field(..., min_length=1)


# --- Network Scan and Add ---


class ScanStartRequest(BaseModel):
    cidrs: List[str] = Field(..., max_length=10)
    credential_ids: Optional[List[int]] = Field(default=None)
    discovery_mode: str = Field(default="netmiko")
    ping_mode: str = Field(default="fping")
    parser_template_ids: Optional[List[int]] = Field(default=None)

    @field_validator("cidrs")
    @classmethod
    def validate_cidrs(cls, v: List[str]) -> List[str]:
        if not v:
            raise ValueError("At least one CIDR required")
        cleaned = []
        seen: set = set()
        for cidr in v:
            try:
                network = ipaddress.ip_network(cidr, strict=False)
            except Exception:
                raise ValueError(f"Invalid CIDR format: {cidr}")
            if network.prefixlen < 22:
                raise ValueError(f"CIDR too large (minimum /22): {cidr}")
            if cidr not in seen:
                seen.add(cidr)
                cleaned.append(cidr)
        return cleaned

    @field_validator("credential_ids")
    @classmethod
    def validate_credentials(cls, v: Optional[List[int]]) -> List[int]:
        if v is None or len(v) == 0:
            return []
        return v

    @field_validator("discovery_mode")
    @classmethod
    def validate_discovery_mode(cls, v: str) -> str:
        if v not in ["napalm", "ssh-login", "netmiko"]:
            raise ValueError(
                "discovery_mode must be 'napalm', 'ssh-login', or 'netmiko'"
            )
        return v

    @field_validator("ping_mode")
    @classmethod
    def validate_ping_mode_for_no_credentials(cls, v: str, info: ValidationInfo) -> str:
        if v not in ["ping", "fping"]:
            raise ValueError("ping_mode must be 'ping' or 'fping'")
        credential_ids = info.data.get("credential_ids")
        if (credential_ids is None or len(credential_ids) == 0) and v != "fping":
            return "fping"
        return v


class ScanStartResponse(BaseModel):
    job_id: str
    total_targets: int
    state: str


class ScanProgress(BaseModel):
    total: int
    scanned: int
    alive: int
    authenticated: int
    unreachable: int
    auth_failed: int
    driver_not_supported: int


class ScanStatusResponse(BaseModel):
    job_id: str
    state: str
    progress: ScanProgress
    results: List[Dict[str, Any]]
