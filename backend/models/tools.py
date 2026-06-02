"""Pydantic models for tool endpoints (certificates, schema, etc.)."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


class CertificateInfo(BaseModel):
    filename: str
    path: str
    size: int
    exists_in_system: bool


class ScanResponse(BaseModel):
    success: bool
    certificates: list[CertificateInfo]
    certs_directory: str
    message: Optional[str] = None


class AddCertificateRequest(BaseModel):
    filename: str


class AddCertificateResponse(BaseModel):
    success: bool
    message: str
    output: Optional[str] = None
    error: Optional[str] = None
    command_output: Optional[str] = None


# --- Test baseline YAML generation ---


class LocationDistributionRow(BaseModel):
    location: str
    network: int = Field(ge=0, default=0)
    server: int = Field(ge=0, default=0)
    vm: int = Field(ge=0, default=0)


class DistributionConfig(BaseModel):
    mode: Literal["even", "random", "manual"] = "even"
    seed: int = 42
    by_location: list[LocationDistributionRow] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_manual_rows(self) -> DistributionConfig:
        if self.mode == "manual" and not self.by_location:
            raise ValueError("by_location is required when distribution mode is manual")
        return self


class CreateBaselineRequest(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    prefixes: str = Field(
        default="192.168.178.0/24,192.168.179.0/24,192.168.180.0/24,192.168.181.0/24"
    )
    network_device_role: str = "Network"
    server_role: str = "Server"
    vm_role: str = "Virtual Machine"
    tags: str = "Production,Staging,lab"
    custom_fields: str = ""
    location_hierarchy: str = Field(default="Country -> State -> City -> Building")
    number_of_locations: int = Field(ge=1, default=3)
    number_of_network_devices: int = Field(ge=0, default=10)
    number_of_servers: int = Field(ge=0, default=2)
    number_of_virtual_machines: int = Field(ge=0, default=0)
    number_of_clusters: int = Field(ge=0, default=1)
    distribution: Optional[DistributionConfig] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        sanitized = "".join(c for c in value.strip() if c.isalnum() or c in ("_", "-"))
        if not sanitized:
            raise ValueError("name must contain at least one alphanumeric character")
        return sanitized

    @model_validator(mode="after")
    def validate_cluster_and_vm_counts(self) -> CreateBaselineRequest:
        if self.number_of_virtual_machines > 0 and self.number_of_clusters < 1:
            raise ValueError(
                "number_of_clusters must be at least 1 when VMs are requested"
            )
        return self


class BaselineStats(BaseModel):
    total_devices: int
    network_devices: int
    server_devices: int
    virtual_machines: int
    clusters: int
    locations: dict[str, int] = Field(default_factory=dict)
    tags: dict[str, int] = Field(default_factory=dict)
    statuses: dict[str, int] = Field(default_factory=dict)


class CreateBaselineResponse(BaseModel):
    success: bool = True
    message: str
    path: str
    filename: str
    stats: BaselineStats
    distribution: dict[str, int] = Field(default_factory=dict)
