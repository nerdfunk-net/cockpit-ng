"""
Pydantic models for the Cockpit application.
"""

from .auth import UserLogin, UserCreate, Token, LoginResponse, TokenData
from .nautobot import (
    CheckIPRequest,
    DeviceOnboardRequest,
    SyncNetworkDataRequest,
    DeviceFilter
)
from .files import FileCompareRequest, FileExportRequest
from .git import GitCommitRequest, GitBranchRequest
from .settings import (
    NautobotSettingsRequest,
    GitSettingsRequest,
    AllSettingsRequest,
    ConnectionTestRequest,
    GitTestRequest
)

__all__ = [
    # Auth models
    "LoginRequest",
    "Token", 
    "TokenData",

    # Nautobot models
    "CheckIPRequest",
    "DeviceOnboardRequest", 
    "SyncNetworkDataRequest",
    "DeviceFilter",

    # File models
    "FileCompareRequest",
    "FileExportRequest",

    # Git models
    "GitCommitRequest",
    "GitBranchRequest",

    # Settings models
    "NautobotSettingsRequest",
    "GitSettingsRequest",
    "AllSettingsRequest", 
    "ConnectionTestRequest",
    "GitTestRequest"
]
