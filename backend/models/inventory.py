"""
Inventory models for request/response data.
"""

from __future__ import annotations
from typing import List, Optional
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
    nested_operations: List["LogicalOperation"] = Field(default_factory=list)


# Update forward references
LogicalOperation.model_rebuild()


class InventoryPreviewRequest(BaseModel):
    """Request for previewing inventory based on logical operations."""

    operations: List[LogicalOperation] = Field(
        ..., description="List of logical operations"
    )


class DeviceInfo(BaseModel):
    """Device information for inventory."""

    id: str = Field(..., description="Device UUID")
    name: Optional[str] = Field(
        None, description="Device name (can be None for unnamed devices)"
    )
    serial: Optional[str] = Field(None, description="Device serial number")
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

    devices: List[DeviceInfo] = Field(
        ..., description="List of devices matching criteria"
    )
    total_count: int = Field(..., description="Total number of devices")
    operations_executed: int = Field(
        ..., description="Number of GraphQL operations executed"
    )


class InventoryGenerateRequest(BaseModel):
    """Request for generating final Ansible inventory."""

    operations: List[LogicalOperation] = Field(
        ..., description="List of logical operations"
    )
    template_name: str = Field(..., description="Name of the Jinja2 template to use")
    template_category: str = Field(..., description="Category of the Jinja2 template")


class InventoryGenerateResponse(BaseModel):
    """Response for generated Ansible inventory."""

    inventory_content: str = Field(..., description="Generated inventory content")
    template_used: str = Field(..., description="Template name that was used")
    device_count: int = Field(..., description="Number of devices in inventory")


class SavedInventoryCondition(BaseModel):
    """Saved inventory condition from the UI."""

    field: str = Field(..., description="Device field to filter on")
    operator: str = Field(..., description="Logical operator")
    value: str = Field(..., description="Value to filter by")
    logic: str = Field(..., description="Logic operator (AND, OR, NOT)")


class SavedInventory(BaseModel):
    """Saved inventory configuration."""

    name: str = Field(..., description="Inventory name")
    description: Optional[str] = Field(None, description="Inventory description")
    conditions: List[dict] = Field(
        ..., description="List of logical conditions or tree structure"
    )
    created_at: Optional[str] = Field(None, description="Creation timestamp")
    updated_at: Optional[str] = Field(None, description="Last update timestamp")


class SaveInventoryRequest(BaseModel):
    """Request for saving an inventory."""

    name: str = Field(..., description="Inventory name")
    description: Optional[str] = Field(None, description="Inventory description")
    conditions: List[SavedInventoryCondition] = Field(
        ..., description="List of logical conditions"
    )
    repository_id: int = Field(..., description="Git repository ID to save to")


class SaveInventoryResponse(BaseModel):
    """Response after saving an inventory."""

    success: bool = Field(..., description="Whether save was successful")
    message: str = Field(..., description="Status message")
    inventory_name: str = Field(..., description="Name of saved inventory")


class ListInventoriesResponse(BaseModel):
    """Response with list of saved inventories."""

    inventories: List[SavedInventory] = Field(
        ..., description="List of saved inventories"
    )
    total: int = Field(..., description="Total number of inventories")


class InventoryAnalysisResponse(BaseModel):
    """Response for inventory analysis with distinct values."""

    locations: List[str] = Field(
        default_factory=list, description="Distinct list of location names"
    )
    tags: List[str] = Field(
        default_factory=list, description="Distinct list of tag names"
    )
    custom_fields: dict[str, List[str]] = Field(
        default_factory=dict,
        description="Dictionary of custom field names to distinct value lists",
    )
    statuses: List[str] = Field(
        default_factory=list, description="Distinct list of status names"
    )
    roles: List[str] = Field(
        default_factory=list, description="Distinct list of role names"
    )
    device_count: int = Field(
        ..., description="Total number of devices analyzed"
    )
