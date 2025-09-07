"""
Pydantic models for Nautobot to CheckMK device synchronization.
"""

from __future__ import annotations
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field


class DeviceExtensions(BaseModel):
    """Device configuration extensions for CheckMK."""
    
    folder: str = Field(description="CheckMK folder path for the device")
    attributes: Dict[str, Any] = Field(default_factory=dict, description="Device attributes for CheckMK")
    internal: Dict[str, Any] = Field(default_factory=dict, description="Internal data not used for comparison")


class DeviceComparison(BaseModel):
    """Result of comparing Nautobot and CheckMK device configurations."""
    
    result: str = Field(description="Comparison result: 'equal', 'diff', 'host_not_found', or 'error'")
    diff: str = Field(default="", description="Description of differences found")
    normalized_config: Dict[str, Any] = Field(default_factory=dict, description="Normalized Nautobot configuration")
    checkmk_config: Optional[Dict[str, Any]] = Field(default=None, description="CheckMK configuration")


class DeviceList(BaseModel):
    """List of devices from Nautobot."""
    
    devices: List[Dict[str, Any]] = Field(description="List of device data")
    total: int = Field(description="Total number of devices")
    message: str = Field(description="Status message")


class DeviceListWithStatus(BaseModel):
    """List of devices with CheckMK comparison status."""
    
    devices: List[Dict[str, Any]] = Field(description="List of device data with CheckMK status")
    total: int = Field(description="Total number of devices") 
    message: str = Field(description="Status message")


class DeviceOperationResult(BaseModel):
    """Result of a device operation (add/update) in CheckMK."""
    
    success: bool = Field(description="Whether the operation was successful")
    message: str = Field(description="Operation result message")
    device_id: str = Field(description="Nautobot device ID")
    hostname: str = Field(description="Device hostname")
    site: str = Field(description="CheckMK site used")
    folder: str = Field(description="CheckMK folder path")
    checkmk_response: Optional[Dict[str, Any]] = Field(default=None, description="Response from CheckMK API")


class DeviceUpdateResult(DeviceOperationResult):
    """Result of updating a device in CheckMK."""
    
    folder_changed: bool = Field(description="Whether the device folder was changed")


class DefaultSiteResponse(BaseModel):
    """Response containing the default CheckMK site."""
    
    default_site: str = Field(description="Default CheckMK site name")
