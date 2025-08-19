"""
Nautobot-related Pydantic models.
"""

from __future__ import annotations
from pydantic import BaseModel
from typing import Dict, Any, Optional


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
    port: int = 22
    timeout: int = 30


class SyncNetworkDataRequest(BaseModel):
    """Network data synchronization request model."""
    data: Dict[str, Any]


class DeviceFilter(BaseModel):
    """Device filtering model."""
    location: Optional[str] = None
    device_type: Optional[str] = None
    status: Optional[str] = None
