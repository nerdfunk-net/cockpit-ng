"""
Pydantic models for the Cockpit application.
"""

from .auth import LoginResponse, Token, TokenData, UserCreate, UserLogin
from .files import FileCompareRequest, FileExportRequest
from .nautobot import (
    CheckIPRequest,
    DeviceFilter,
    DeviceOnboardRequest,
    SyncNetworkDataRequest,
)
from .settings import (
    AllSettingsRequest,
    ConnectionTestRequest,
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
    # Settings models
    "NautobotSettingsRequest",
    "AllSettingsRequest",
    "ConnectionTestRequest",
]
