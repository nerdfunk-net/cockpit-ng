from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ServerLocation(BaseModel):
    id: str
    name: str
    hierarchical_path: Optional[str] = None

    model_config = {"from_attributes": True}


class ServerResponse(BaseModel):
    id: int
    hostname: str
    location: Optional[ServerLocation] = None
    primary_ipv4: Optional[str] = None
    primary_interface: Optional[str] = None
    os_family: Optional[str] = None
    processor_count: Optional[int] = None
    memtotal_mb: Optional[int] = None
    disk_count: Optional[int] = None
    architecture: Optional[str] = None
    distribution_release: Optional[str] = None
    distribution_version: Optional[str] = None
    contact: Optional[str] = None
    nautobot_uuid: Optional[str] = None
    is_virtual: bool = False
    ansible_facts: Optional[Dict[str, Any]] = None
    selected_interfaces: Optional[List[Dict[str, Any]]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class CreateServerRequest(BaseModel):
    hostname: str = Field(..., min_length=1, max_length=255)
    location: Optional[ServerLocation] = None
    primary_ipv4: Optional[str] = Field(None, max_length=50)
    primary_interface: Optional[str] = Field(None, max_length=100)
    os_family: Optional[str] = Field(None, max_length=100)
    processor_count: Optional[int] = None
    memtotal_mb: Optional[int] = None
    disk_count: Optional[int] = None
    architecture: Optional[str] = Field(None, max_length=100)
    distribution_release: Optional[str] = Field(None, max_length=100)
    distribution_version: Optional[str] = Field(None, max_length=100)
    contact: Optional[str] = Field(None, max_length=255)
    nautobot_uuid: Optional[str] = Field(None, max_length=255)
    is_virtual: Optional[bool] = None
    ansible_facts: Optional[Dict[str, Any]] = None


class UpdateServerRequest(BaseModel):
    hostname: Optional[str] = Field(None, min_length=1, max_length=255)
    location: Optional[ServerLocation] = None
    primary_ipv4: Optional[str] = Field(None, max_length=50)
    primary_interface: Optional[str] = Field(None, max_length=100)
    os_family: Optional[str] = Field(None, max_length=100)
    processor_count: Optional[int] = None
    memtotal_mb: Optional[int] = None
    disk_count: Optional[int] = None
    architecture: Optional[str] = Field(None, max_length=100)
    distribution_release: Optional[str] = Field(None, max_length=100)
    distribution_version: Optional[str] = Field(None, max_length=100)
    contact: Optional[str] = Field(None, max_length=255)
    nautobot_uuid: Optional[str] = Field(None, max_length=255)
    is_virtual: Optional[bool] = None
    ansible_facts: Optional[Dict[str, Any]] = None
    selected_interfaces: Optional[List[Dict[str, Any]]] = None


class ListServersResponse(BaseModel):
    servers: List[ServerResponse]
    total: int
