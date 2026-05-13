"""
Pydantic models for the Cockpit application.
"""

from .auth import LoginResponse, Token, TokenData, UserCreate, UserLogin
from .files import FileCompareRequest, FileExportRequest
from .git import GitBranchRequest, GitCommitRequest
from .nautobot import (
    CheckIPRequest,
    DeviceFilter,
    DeviceOnboardRequest,
    SyncNetworkDataRequest,
)
from .settings import (
    AllSettingsRequest,
    ConnectionTestRequest,
    GitSettingsRequest,
    GitTestRequest,
    NautobotSettingsRequest,
)

__all__ = [
    # Auth models
    "UserLogin",
    "UserCreate",
    "LoginResponse",
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
    "GitTestRequest",
]
