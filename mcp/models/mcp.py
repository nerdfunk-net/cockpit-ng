"""
MCP Request/Response models.
"""

from pydantic import BaseModel
from typing import Dict, Any, Optional, Literal


class MCPRequest(BaseModel):
    """MCP request message."""
    id: str
    action: str
    params: Dict[str, Any] = {}
    metadata: Dict[str, Any] = {}


class ErrorModel(BaseModel):
    """Error details for MCP responses."""
    code: str
    message: str
    details: Optional[Any] = None


class MCPResponse(BaseModel):
    """MCP response message."""
    id: str
    status: Literal["ok", "error"]
    result: Optional[Dict[str, Any]] = None
    error: Optional[ErrorModel] = None