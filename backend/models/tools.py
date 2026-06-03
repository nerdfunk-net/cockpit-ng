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


class ImportBaselineRequest(BaseModel):
    directory: Optional[str] = None


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

    profile: Optional[str] = None
    layout: Literal["default", "pytest_legacy"] = "default"
    naming_scheme: Literal["ip", "sequential"] = "ip"
    network_device_prefix: str = "lab"
    network_device_index_width: int = Field(ge=1, default=3)
    server_device_prefix: str = "server"
    server_device_index_width: int = Field(ge=1, default=2)
    tag_quotas: Optional[dict[str, int]] = None
    status_quotas: Optional[dict[str, int]] = None
    metadata_mode: Literal["generated", "golden_parity"] = "generated"
    golden_reference_path: Optional[str] = None

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

    @model_validator(mode="after")
    def validate_pytest_layout(self) -> CreateBaselineRequest:
        if self.metadata_mode == "golden_parity" and not self.golden_reference_path:
            raise ValueError(
                "golden_reference_path is required when metadata_mode is golden_parity"
            )
        if self.metadata_mode != "golden_parity" and self.golden_reference_path:
            raise ValueError(
                "golden_reference_path is only allowed when metadata_mode is golden_parity"
            )

        total_devices = self.number_of_network_devices + self.number_of_servers
        if self.tag_quotas is not None:
            tag_sum = sum(self.tag_quotas.values())
            if tag_sum != total_devices:
                raise ValueError(
                    f"tag_quotas must sum to {total_devices}, got {tag_sum}"
                )
        if self.status_quotas is not None:
            status_sum = sum(self.status_quotas.values())
            if status_sum != total_devices:
                raise ValueError(
                    f"status_quotas must sum to {total_devices}, got {status_sum}"
                )

        if self.layout != "pytest_legacy":
            return self

        if self.number_of_locations != 6:
            raise ValueError("pytest_legacy layout requires number_of_locations == 6")
        dist = self.distribution
        if not dist or dist.mode != "manual":
            raise ValueError(
                "pytest_legacy layout requires distribution.mode == manual"
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


class BaselineProfileSummary(BaseModel):
    id: str
    label: str
    description: str


class CreateBaselineResponse(BaseModel):
    success: bool = True
    message: str
    path: str
    filename: str
    stats: BaselineStats
    distribution: dict[str, int] = Field(default_factory=dict)
    profile: Optional[str] = None
    warnings: list[str] = Field(default_factory=list)
