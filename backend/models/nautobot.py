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


class InterfaceData(BaseModel):
    """Interface data model for add device request."""

    id: Optional[str] = None  # Frontend interface ID for LAG mapping
    name: str
    type: str
    status: str
    ip_address: Optional[str] = None
    namespace: Optional[str] = None  # Required if ip_address is provided
    is_primary_ipv4: Optional[bool] = None  # Set this interface's IP as device primary
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
