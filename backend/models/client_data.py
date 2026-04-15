"""
Pydantic models for client data collected by the get_client_data job type.

Three tables are used:
  - ClientIpAddress  — ARP table entries
  - ClientMacAddress — MAC address table entries
  - ClientHostname   — DNS-resolved hostnames

All three share a session_id (UUID string) as the cross-table join key.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


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
    id: int
    collected_at: datetime

    class Config:
        from_attributes = True


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
    id: int
    collected_at: datetime

    class Config:
        from_attributes = True


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
    id: int
    collected_at: datetime

    class Config:
        from_attributes = True
