"""
Inventory models for request/response data.
"""

from __future__ import annotations
from typing import List, Optional
from pydantic import BaseModel, Field


# ============================================================================
# Database CRUD models (PostgreSQL-backed inventories)
# ============================================================================


class CreateInventoryRequest(BaseModel):
    """Request for creating a new inventory."""

    name: str = Field(..., description="Inventory name")
    description: Optional[str] = Field(None, description="Inventory description")
    conditions: List[dict] = Field(
        ..., description="List of logical conditions or tree structure"
    )
    template_category: Optional[str] = Field(
        None, description="Template category (optional)"
    )
    template_name: Optional[str] = Field(None, description="Template name (optional)")
    scope: str = Field(default="global", description="Scope: 'global' or 'private'")
    group_path: Optional[str] = Field(
        None, description="Slash-separated group path, e.g. 'group_a/sub_b'"
    )


class UpdateInventoryRequest(BaseModel):
    """Request for updating an inventory."""

    name: Optional[str] = Field(None, description="Inventory name")
    description: Optional[str] = Field(None, description="Inventory description")
    conditions: Optional[List[dict]] = Field(
        None, description="List of logical conditions or tree structure"
    )
    template_category: Optional[str] = Field(None, description="Template category")
    template_name: Optional[str] = Field(None, description="Template name")
    scope: Optional[str] = Field(None, description="Scope: 'global' or 'private'")
    group_path: Optional[str] = Field(
        None, description="Slash-separated group path; null moves to root"
    )


class InventoryResponse(BaseModel):
    """Response model for a single database-backed inventory."""

    id: int
    name: str
    description: Optional[str]
    conditions: List[dict]
    template_category: Optional[str]
    template_name: Optional[str]
    scope: str
    group_path: Optional[str] = None
    created_by: str
    is_active: bool
    created_at: Optional[str]
    updated_at: Optional[str]


class ListInventoriesResponse(BaseModel):
    """Response with list of database-backed inventories."""

    inventories: List[InventoryResponse]
    total: int


class GroupsResponse(BaseModel):
    """Response with all unique inventory group paths."""

    groups: List[str]


class InventoryDeleteResponse(BaseModel):
    """Response after deleting an inventory."""

    success: bool
    message: str


class ImportInventoryRequest(BaseModel):
    """Request for importing an inventory from JSON."""

    import_data: dict = Field(..., description="The JSON data to import")


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


class GitInventoryListResponse(BaseModel):
    """Response with list of git-backed saved inventories."""

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
    device_count: int = Field(..., description="Total number of devices analyzed")


class RenameGroupRequest(BaseModel):
    """Request body for bulk-renaming a group path."""

    old_path: str = Field(
        ..., description="Current group path to rename (must not be empty/root)"
    )
    new_name: str = Field(..., description="New name for the last segment only")


class RenameGroupResponse(BaseModel):
    """Response after bulk-renaming a group path."""

    updated_count: int = Field(..., description="Number of inventory rows updated")
    new_path: str = Field(..., description="Resulting full group path after rename")
