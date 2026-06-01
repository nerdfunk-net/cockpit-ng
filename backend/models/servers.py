import json
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator
from pydantic.networks import IPvAnyAddress

_ANSIBLE_FACTS_MAX_BYTES = 512 * 1024  # 512 KB

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


class ServerLocation(BaseModel):
    id: str
    name: str
    hierarchical_path: Optional[str] = None

    model_config = {"from_attributes": True}


class ServerCluster(BaseModel):
    id: str
    name: str

    model_config = {"from_attributes": True}


class ServerResponse(BaseModel):
    id: int
    hostname: str
    location: Optional[ServerLocation] = None
    cluster: Optional[ServerCluster] = None
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
    nautobot_uuid: Optional[str] = Field(None, max_length=36)
    is_virtual: Optional[bool] = None
    ansible_facts: Optional[Dict[str, Any]] = None

    @field_validator("primary_ipv4", mode="before")
    @classmethod
    def validate_ipv4(cls, v: Any) -> Any:
        if v is None:
            return v
        try:
            IPvAnyAddress(v)
        except Exception:
            raise ValueError(f"primary_ipv4 must be a valid IP address, got: {v!r}")
        return v

    @field_validator("nautobot_uuid", mode="before")
    @classmethod
    def validate_uuid(cls, v: Any) -> Any:
        if v is None:
            return v
        if not _UUID_RE.match(str(v)):
            raise ValueError(f"nautobot_uuid must be a valid UUID, got: {v!r}")
        return v

    @field_validator("ansible_facts", mode="before")
    @classmethod
    def validate_ansible_facts_size(cls, v: Any) -> Any:
        if v is None:
            return v
        size = len(json.dumps(v).encode())
        if size > _ANSIBLE_FACTS_MAX_BYTES:
            raise ValueError(
                f"ansible_facts exceeds maximum allowed size of {_ANSIBLE_FACTS_MAX_BYTES // 1024} KB"
            )
        return v


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
    nautobot_uuid: Optional[str] = Field(None, max_length=36)
    is_virtual: Optional[bool] = None
    ansible_facts: Optional[Dict[str, Any]] = None
    selected_interfaces: Optional[List[Dict[str, Any]]] = None
    cluster: Optional[ServerCluster] = None

    @field_validator("primary_ipv4", mode="before")
    @classmethod
    def validate_ipv4(cls, v: Any) -> Any:
        if v is None:
            return v
        try:
            IPvAnyAddress(v)
        except Exception:
            raise ValueError(f"primary_ipv4 must be a valid IP address, got: {v!r}")
        return v

    @field_validator("nautobot_uuid", mode="before")
    @classmethod
    def validate_uuid(cls, v: Any) -> Any:
        if v is None:
            return v
        if not _UUID_RE.match(str(v)):
            raise ValueError(f"nautobot_uuid must be a valid UUID, got: {v!r}")
        return v

    @field_validator("ansible_facts", mode="before")
    @classmethod
    def validate_ansible_facts_size(cls, v: Any) -> Any:
        if v is None:
            return v
        size = len(json.dumps(v).encode())
        if size > _ANSIBLE_FACTS_MAX_BYTES:
            raise ValueError(
                f"ansible_facts exceeds maximum allowed size of {_ANSIBLE_FACTS_MAX_BYTES // 1024} KB"
            )
        return v


class ListServersResponse(BaseModel):
    servers: List[ServerResponse]
    total: int
