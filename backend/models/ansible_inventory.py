"""
Ansible Inventory models for request/response data.
"""

from __future__ import annotations
from typing import List, Dict, Any, Optional, Union
from pydantic import BaseModel, Field


class LogicalCondition(BaseModel):
    """Represents a single logical condition for device filtering."""
    field: str = Field(..., description="Device field to filter on")
    operator: str = Field(..., description="Logical operator (equals, contains, etc.)")
    value: str = Field(..., description="Value to filter by")


class LogicalOperation(BaseModel):
    """Represents a logical operation with conditions."""
    operation_type: str = Field(..., description="Type of operation: AND, OR, NOT")
    conditions: List[LogicalCondition] = Field(default_factory=list)
    nested_operations: List['LogicalOperation'] = Field(default_factory=list)


# Update forward references
LogicalOperation.model_rebuild()


class InventoryPreviewRequest(BaseModel):
    """Request for previewing inventory based on logical operations."""
    operations: List[LogicalOperation] = Field(..., description="List of logical operations")


class DeviceInfo(BaseModel):
    """Device information for inventory."""
    id: str = Field(..., description="Device UUID")
    name: str = Field(..., description="Device name")
    location: Optional[str] = Field(None, description="Device location")
    role: Optional[str] = Field(None, description="Device role")
    tags: List[str] = Field(default_factory=list, description="Device tags")
    device_type: Optional[str] = Field(None, description="Device type")
    manufacturer: Optional[str] = Field(None, description="Device manufacturer")
    platform: Optional[str] = Field(None, description="Device platform")
    primary_ip4: Optional[str] = Field(None, description="Primary IPv4 address")
    status: Optional[str] = Field(None, description="Device status")


class InventoryPreviewResponse(BaseModel):
    """Response for inventory preview."""
    devices: List[DeviceInfo] = Field(..., description="List of devices matching criteria")
    total_count: int = Field(..., description="Total number of devices")
    operations_executed: int = Field(..., description="Number of GraphQL operations executed")


class InventoryGenerateRequest(BaseModel):
    """Request for generating final Ansible inventory."""
    operations: List[LogicalOperation] = Field(..., description="List of logical operations")
    template_name: str = Field(..., description="Name of the Jinja2 template to use")
    template_category: str = Field(..., description="Category of the Jinja2 template")


class InventoryGenerateResponse(BaseModel):
    """Response for generated Ansible inventory."""
    inventory_content: str = Field(..., description="Generated inventory content")
    template_used: str = Field(..., description="Template name that was used")
    device_count: int = Field(..., description="Number of devices in inventory")
