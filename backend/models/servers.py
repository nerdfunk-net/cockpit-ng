import json
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator
from pydantic.networks import IPvAnyAddress

_ANSIBLE_FACTS_MAX_BYTES = 512 * 1024  # 512 KB
_OPEN_PORTS_MAX_BYTES = 512 * 1024  # 512 KB

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


class ServerContactRole(BaseModel):
    id: str
    name: str

    @field_validator("id", mode="before")
    @classmethod
    def validate_id(cls, v: Any) -> Any:
        if not _UUID_RE.match(str(v)):
            raise ValueError(f"contact.role.id must be a valid UUID, got: {v!r}")
        return v


def normalize_contacts(value: Any) -> Optional[List["ServerContact"]]:
    """Normalize legacy single-object or array JSON into a contact list."""
    if value is None:
        return None
    if isinstance(value, list):
        return [ServerContact.model_validate(item) for item in value]
    if isinstance(value, dict):
        return [ServerContact.model_validate(value)]
    raise ValueError("contact must be an object or a list of objects")


def _validate_contacts_have_roles(contacts: Optional[List["ServerContact"]]) -> None:
    if contacts is None:
        return
    for entry in contacts:
        if entry.role is None:
            raise ValueError("contact.role is required for every contact in the list")


class ServerContact(BaseModel):
    id: str
    name: str
    role: Optional[ServerContactRole] = None
    association_id: Optional[str] = None

    @field_validator("id", mode="before")
    @classmethod
    def validate_id(cls, v: Any) -> Any:
        if not _UUID_RE.match(str(v)):
            raise ValueError(f"contact.id must be a valid UUID, got: {v!r}")
        return v

    @field_validator("association_id", mode="before")
    @classmethod
    def validate_association_id(cls, v: Any) -> Any:
        if v is None:
            return v
        if not _UUID_RE.match(str(v)):
            raise ValueError(f"contact.association_id must be a valid UUID, got: {v!r}")
        return v

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
    contact: Optional[List[ServerContact]] = None
    is_virtual: bool = False

    @field_validator("contact", mode="before")
    @classmethod
    def normalize_contact_field(cls, v: Any) -> Any:
        return normalize_contacts(v)

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
    contact: Optional[List[ServerContact]] = None
    nautobot_uuid: Optional[str] = None
    is_virtual: bool = False
    ansible_facts: Optional[Dict[str, Any]] = None
    ansible_credentials: Optional[AnsibleCredentials] = None
    selected_interfaces: Optional[List[Dict[str, Any]]] = None
    open_ports: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @field_validator("contact", mode="before")
    @classmethod
    def normalize_contact_field(cls, v: Any) -> Any:
        return normalize_contacts(v)

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
    contact: Optional[List[ServerContact]] = None
    nautobot_uuid: Optional[str] = Field(None, max_length=36)
    is_virtual: Optional[bool] = None
    ansible_facts: Optional[Dict[str, Any]] = None
    ansible_credentials: Optional[AnsibleCredentials] = None
    open_ports: Optional[Dict[str, Any]] = None

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

    @field_validator("contact", mode="before")
    @classmethod
    def normalize_contact_input(cls, v: Any) -> Any:
        return normalize_contacts(v)

    @model_validator(mode="after")
    def validate_contact_roles(self) -> "CreateServerRequest":
        _validate_contacts_have_roles(self.contact)
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

    @field_validator("open_ports", mode="before")
    @classmethod
    def validate_open_ports_size(cls, v: Any) -> Any:
        if v is None:
            return v
        size = len(json.dumps(v).encode())
        if size > _OPEN_PORTS_MAX_BYTES:
            raise ValueError(
                f"open_ports exceeds maximum allowed size of {_OPEN_PORTS_MAX_BYTES // 1024} KB"
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
    contact: Optional[List[ServerContact]] = None
    nautobot_uuid: Optional[str] = Field(None, max_length=36)
    is_virtual: Optional[bool] = None
    ansible_facts: Optional[Dict[str, Any]] = None
    ansible_credentials: Optional[AnsibleCredentials] = None
    selected_interfaces: Optional[List[Dict[str, Any]]] = None
    open_ports: Optional[Dict[str, Any]] = None
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

    @field_validator("contact", mode="before")
    @classmethod
    def normalize_contact_input(cls, v: Any) -> Any:
        return normalize_contacts(v)

    @model_validator(mode="after")
    def validate_contact_roles(self) -> "UpdateServerRequest":
        if "contact" in self.model_fields_set:
            _validate_contacts_have_roles(self.contact)
        return self

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

    @field_validator("open_ports", mode="before")
    @classmethod
    def validate_open_ports_size(cls, v: Any) -> Any:
        if v is None:
            return v
        size = len(json.dumps(v).encode())
        if size > _OPEN_PORTS_MAX_BYTES:
            raise ValueError(
                f"open_ports exceeds maximum allowed size of {_OPEN_PORTS_MAX_BYTES // 1024} KB"
            )
        return v


class ListServersResponse(BaseModel):
    servers: List[ServerSummaryResponse]
    total: int
    total_all: int


class ServerFactsHistoryEntry(BaseModel):
    """Lightweight history row for the facts-history list (excludes the facts blob)."""

    id: int
    recorded_at: datetime

    model_config = {"from_attributes": True}


class ServerFactsHistoryDetail(BaseModel):
    """A single historical Ansible facts snapshot."""

    id: int
    recorded_at: datetime
    ansible_facts: Optional[Dict[str, Any]] = None

    model_config = {"from_attributes": True}


class ServerFactsHistoryListResponse(BaseModel):
    entries: List[ServerFactsHistoryEntry]


class ServerOpenPortsHistoryEntry(BaseModel):
    """Lightweight history row for the open-ports-history list (excludes the ports blob)."""

    id: int
    recorded_at: datetime

    model_config = {"from_attributes": True}


class ServerOpenPortsHistoryDetail(BaseModel):
    """A single historical open-ports snapshot."""

    id: int
    recorded_at: datetime
    open_ports: Optional[Dict[str, Any]] = None

    model_config = {"from_attributes": True}


class ServerOpenPortsHistoryListResponse(BaseModel):
    entries: List[ServerOpenPortsHistoryEntry]
