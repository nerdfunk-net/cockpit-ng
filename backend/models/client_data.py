"""
Pydantic models for client data collected by the get_client_data job type.

Three tables are used:
  - ClientIpAddress  — ARP table entries
  - ClientMacAddress — MAC address table entries
  - ClientHostname   — DNS-resolved hostnames

All three share a session_id (UUID string) as the cross-table join key.
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


# ============================================================================
# Client IP Address (from ARP table)
# ============================================================================


class ClientIpAddressCreate(BaseModel):
    session_id: str
    ip_address: str
    mac_address: Optional[str] = None
    interface: Optional[str] = None
    device_name: str
    device_ip: Optional[str] = None


class ClientIpAddressResponse(ClientIpAddressCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    collected_at: datetime


# ============================================================================
# Client MAC Address (from MAC address table)
# ============================================================================


class ClientMacAddressCreate(BaseModel):
    session_id: str
    mac_address: str
    vlan: Optional[str] = None
    port: Optional[str] = None
    device_name: str
    device_ip: Optional[str] = None


class ClientMacAddressResponse(ClientMacAddressCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    collected_at: datetime


# ============================================================================
# Client Hostname (DNS resolved)
# ============================================================================


class ClientHostnameCreate(BaseModel):
    session_id: str
    ip_address: str
    hostname: str
    device_name: str
    device_ip: Optional[str] = None


class ClientHostnameResponse(ClientHostnameCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    collected_at: datetime


# ============================================================================
# API responses — GET /api/clients/* (OpenAPI / typed clients)
# ============================================================================


class ClientDevicesApiResponse(BaseModel):
    """Response for ``GET /api/clients/devices``."""

    devices: List[str] = Field(default_factory=list)


class ClientDataTableRow(BaseModel):
    """One correlated row from ``GET /api/clients/data``."""

    model_config = ConfigDict(extra="ignore")

    mac_address: Optional[str] = None
    port: Optional[str] = None
    vlan: Optional[str] = None
    ip_address: Optional[str] = None
    hostname: Optional[str] = None
    device_name: str
    session_id: str
    collected_at: Optional[str] = None


class ClientDataPageResponse(BaseModel):
    """Paginated response for ``GET /api/clients/data``."""

    items: List[ClientDataTableRow]
    total: int
    page: int
    page_size: int


class ClientIpHistoryRow(BaseModel):
    model_config = ConfigDict(extra="ignore")

    ip_address: str
    mac_address: Optional[str] = None
    port: Optional[str] = None
    vlan: Optional[str] = None
    device_name: str
    collected_at: Optional[str] = None


class ClientMacHistoryRow(BaseModel):
    model_config = ConfigDict(extra="ignore")

    mac_address: str
    port: Optional[str] = None
    vlan: Optional[str] = None
    device_name: str
    collected_at: Optional[str] = None
    ip_address: Optional[str] = None


class ClientHostnameHistoryRow(BaseModel):
    model_config = ConfigDict(extra="ignore")

    hostname: str
    ip_address: Optional[str] = None
    device_name: str
    collected_at: Optional[str] = None


class ClientHistoryApiResponse(BaseModel):
    """Response for ``GET /api/clients/history``."""

    ip_history: List[ClientIpHistoryRow] = Field(default_factory=list)
    mac_history: List[ClientMacHistoryRow] = Field(default_factory=list)
    hostname_history: List[ClientHostnameHistoryRow] = Field(default_factory=list)
