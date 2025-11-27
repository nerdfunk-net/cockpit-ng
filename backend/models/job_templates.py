"""
Pydantic models for job templates management
"""
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime


# Valid job template types (cache_devices removed - now handled by system tasks)
JobTemplateType = Literal["backup", "compare_devices", "run_commands", "sync_devices"]

# Inventory source options
InventorySource = Literal["all", "inventory"]


class JobTemplateBase(BaseModel):
    """Base model for job templates"""
    name: str = Field(..., min_length=1, max_length=255, description="Name of the job template")
    job_type: JobTemplateType = Field(..., description="Type of job this template represents")
    description: Optional[str] = Field(None, max_length=1000, description="Description of what this template does")
    inventory_source: InventorySource = Field("all", description="Whether to use all devices or a stored inventory")
    inventory_repository_id: Optional[int] = Field(None, description="Git repository ID for inventory (when inventory_source='inventory')")
    inventory_name: Optional[str] = Field(None, description="Name of the stored inventory to use")
    command_template_name: Optional[str] = Field(None, description="Name of the command template to execute (for run_commands type)")
    is_global: bool = Field(False, description="Whether this template is global (available to all users) or private")


class JobTemplateCreate(JobTemplateBase):
    """Model for creating a new job template"""
    pass


class JobTemplateUpdate(BaseModel):
    """Model for updating a job template"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    inventory_source: Optional[InventorySource] = None
    inventory_repository_id: Optional[int] = None
    inventory_name: Optional[str] = None
    command_template_name: Optional[str] = None
    is_global: Optional[bool] = None


class JobTemplateResponse(JobTemplateBase):
    """Model for job template response"""
    id: int
    user_id: Optional[int] = None
    created_by: Optional[str] = Field(None, description="Username of the creator")
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class JobTemplateListResponse(BaseModel):
    """Response model for listing job templates"""
    templates: list[JobTemplateResponse]
    total: int
