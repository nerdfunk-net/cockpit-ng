"""
Settings-related Pydantic models.
"""

from __future__ import annotations
from pydantic import BaseModel
from typing import Optional, Dict


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


class AllSettingsRequest(BaseModel):
    """All settings request model."""
    nautobot: NautobotSettingsRequest
    git: GitSettingsRequest
    cache: Optional['CacheSettingsRequest'] = None


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


class GitTestRequest(BaseModel):
    """Git connection test request model."""
    repo_url: str
    branch: str = "main"
    username: Optional[str] = ""
    token: Optional[str] = ""
    verify_ssl: bool = True
