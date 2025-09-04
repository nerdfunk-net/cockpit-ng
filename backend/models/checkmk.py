"""
CheckMK models for API requests and responses.
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any


class CheckMKSettings(BaseModel):
    """CheckMK connection settings"""
    url: str = Field(..., description="CheckMK server URL")
    site: str = Field(..., description="CheckMK site name")
    username: str = Field(..., description="CheckMK username")
    password: str = Field(..., description="CheckMK password")
    verify_ssl: bool = Field(default=True, description="Verify SSL certificates")


class CheckMKTestConnectionRequest(BaseModel):
    """Request model for testing CheckMK connection"""
    url: str = Field(..., description="CheckMK server URL")
    site: str = Field(..., description="CheckMK site name")
    username: str = Field(..., description="CheckMK username") 
    password: str = Field(..., description="CheckMK password")
    verify_ssl: bool = Field(default=True, description="Verify SSL certificates")


class CheckMKTestConnectionResponse(BaseModel):
    """Response model for CheckMK connection test"""
    success: bool = Field(..., description="Whether the connection was successful")
    message: str = Field(..., description="Connection result message")
    checkmk_url: Optional[str] = Field(None, description="CheckMK server URL")
    connection_source: Optional[str] = Field(None, description="Source of connection settings")