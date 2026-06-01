import json
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator
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


class AnsibleCredentials(BaseModel):
    """Parameters used to gather Ansible facts (passwords are not stored)."""

    target: str = Field(..., min_length=1, description="Hostname or IP used for SSH")
    agent_id: str = Field(..., min_length=1, description="Cockpit agent ID")
    use_sshkey: bool = Field(..., description="True when SSH key auth was used")
    ansible_user: str = Field(..., min_length=1, description="SSH username")
    credential_id: Optional[int] = Field(
        None,
        description="Login credential ID when password auth was used (password fetched at runtime)",
    )

    model_config = {"from_attributes": True}


class ServerSummaryResponse(BaseModel):
    """Lightweight server row for inventory lists (excludes large JSON blobs)."""

    id: int
    hostname: str
    location: Optional[ServerLocation] = None
    cluster: Optional[ServerCluster] = None
    distribution_release: Optional[str] = None
    distribution_version: Optional[str] = None
    contact: Optional[str] = None
    is_virtual: bool = False

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
    ansible_credentials: Optional[AnsibleCredentials] = None
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
    ansible_credentials: Optional[AnsibleCredentials] = None

    @model_validator(mode="after")
    def validate_ansible_credentials_auth(self) -> "CreateServerRequest":
        creds = self.ansible_credentials
        if creds is None:
            return self
        if creds.use_sshkey and creds.credential_id is not None:
            raise ValueError("credential_id must not be set when use_sshkey is true")
        if not creds.use_sshkey and creds.credential_id is None:
            raise ValueError("credential_id is required when use_sshkey is false")
        return self

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
    ansible_credentials: Optional[AnsibleCredentials] = None
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
    servers: List[ServerSummaryResponse]
    total: int
    total_all: int
