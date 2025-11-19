"""
Settings-related Pydantic models.
"""

from __future__ import annotations
from pydantic import BaseModel
from typing import Optional, Dict, Literal


class NautobotSettingsRequest(BaseModel):
    """Nautobot settings request model."""

    url: str
    token: str
    timeout: int = 30
    verify_ssl: bool = True


class GitSettingsRequest(BaseModel):
    """Git settings request model."""

    repo_url: str
    branch: str = "main"
    username: Optional[str] = ""
    token: Optional[str] = ""
    config_path: str = "configs/"
    sync_interval: int = 15
    verify_ssl: bool = True


class CheckMKSettingsRequest(BaseModel):
    """CheckMK settings request model."""

    url: str
    site: str
    username: str
    password: str
    verify_ssl: bool = True


class AllSettingsRequest(BaseModel):
    """All settings request model."""

    nautobot: NautobotSettingsRequest
    git: GitSettingsRequest
    checkmk: Optional[CheckMKSettingsRequest] = None
    cache: Optional["CacheSettingsRequest"] = None


class CacheSettingsRequest(BaseModel):
    """Cache settings request model."""

    enabled: bool = True
    ttl_seconds: int = 600
    prefetch_on_startup: bool = True
    refresh_interval_minutes: int = 15
    max_commits: int = 500
    # Optional map of prefetchable items toggles, e.g., {"git": true, "locations": false}
    prefetch_items: Optional[Dict[str, bool]] = None


class ConnectionTestRequest(BaseModel):
    """Connection test request model."""

    url: str
    token: str
    timeout: int = 30
    verify_ssl: bool = True


class CheckMKTestRequest(BaseModel):
    """CheckMK connection test request model."""

    url: str
    site: str
    username: str
    password: str
    verify_ssl: bool = True


class GitTestRequest(BaseModel):
    """Git connection test request model."""

    repo_url: str
    branch: str = "main"
    username: Optional[str] = ""
    token: Optional[str] = ""
    verify_ssl: bool = True


class NautobotDefaultsRequest(BaseModel):
    """Nautobot defaults settings request model."""

    location: Optional[str] = None
    platform: Optional[str] = None
    interface_status: Optional[str] = None
    device_status: Optional[str] = None
    ip_address_status: Optional[str] = None
    ip_prefix_status: Optional[str] = None
    namespace: Optional[str] = None
    device_role: Optional[str] = None
    secret_group: Optional[str] = None
    csv_delimiter: Optional[str] = ","


class DeviceOffboardingRequest(BaseModel):
    """Device offboarding settings request model."""

    remove_all_custom_fields: bool = False
    clear_device_name: bool = False
    keep_serial: bool = False
    location_id: Optional[str] = None
    status_id: Optional[str] = None
    role_id: Optional[str] = None
    custom_field_settings: Optional[Dict[str, str]] = (
        None  # custom_field_name -> value or "clear"
    )


# ============================================================================
# Compliance Settings Models
# ============================================================================


class RegexPatternRequest(BaseModel):
    """Regex pattern request model."""

    pattern: str
    description: Optional[str] = None
    pattern_type: Literal["must_match", "must_not_match"]
    is_active: bool = True


class RegexPatternUpdateRequest(BaseModel):
    """Regex pattern update request model."""

    pattern: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class LoginCredentialRequest(BaseModel):
    """Login credential request model."""

    username: str
    password: str
    description: Optional[str] = None
    is_active: bool = True


class LoginCredentialUpdateRequest(BaseModel):
    """Login credential update request model."""

    username: Optional[str] = None
    password: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class SNMPMappingRequest(BaseModel):
    """SNMP mapping request model."""

    device_type: str
    snmp_version: Literal["v1", "v2c", "v3"]
    snmp_community: Optional[str] = None
    snmp_v3_user: Optional[str] = None
    snmp_v3_auth_protocol: Optional[str] = None
    snmp_v3_auth_password: Optional[str] = None
    snmp_v3_priv_protocol: Optional[str] = None
    snmp_v3_priv_password: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True


class SNMPMappingUpdateRequest(BaseModel):
    """SNMP mapping update request model."""

    device_type: Optional[str] = None
    snmp_version: Optional[Literal["v1", "v2c", "v3"]] = None
    snmp_community: Optional[str] = None
    snmp_v3_user: Optional[str] = None
    snmp_v3_auth_protocol: Optional[str] = None
    snmp_v3_auth_password: Optional[str] = None
    snmp_v3_priv_protocol: Optional[str] = None
    snmp_v3_priv_password: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

