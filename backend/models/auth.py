"""
Authentication-related Pydantic models.
"""

from __future__ import annotations
from pydantic import BaseModel
from typing import Dict, Any, Optional, List


class UserLogin(BaseModel):
    """User login request model."""

    username: str
    password: str


class UserCreate(BaseModel):
    """User creation request model."""

    username: str
    password: str
    email: Optional[str] = None


class Token(BaseModel):
    """JWT token response model."""

    access_token: str
    token_type: str


class LoginResponse(BaseModel):
    """Enhanced login response model."""

    access_token: str
    token_type: str
    expires_in: int
    user: Dict[str, Any]
    oidc_provider: Optional[str] = None  # Track which OIDC provider was used


class ApprovalPendingResponse(BaseModel):
    """Response for users awaiting admin approval."""

    status: str = "approval_pending"
    message: str
    username: str
    email: Optional[str] = None
    oidc_provider: Optional[str] = None


class TokenData(BaseModel):
    """Token data for JWT processing."""

    username: Optional[str] = None


class OIDCProvider(BaseModel):
    """OIDC provider information for frontend display."""

    provider_id: str
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    display_order: int = 999


class OIDCProvidersResponse(BaseModel):
    """Response model for list of OIDC providers."""

    providers: List[OIDCProvider]
    allow_traditional_login: bool = True


class OIDCAuthRequest(BaseModel):
    """OIDC authentication request parameters."""

    redirect_uri: Optional[str] = None
    state: Optional[str] = None


class OIDCCallbackRequest(BaseModel):
    """OIDC callback request with authorization code."""

    code: str
    state: Optional[str] = None
    provider_id: Optional[str] = None  # Optional provider tracking
    redirect_uri: Optional[str] = None  # Optional redirect URI for token exchange


class OIDCConfig(BaseModel):
    """OIDC provider configuration from discovery endpoint."""

    issuer: str
    authorization_endpoint: str
    token_endpoint: str
    userinfo_endpoint: str
    jwks_uri: str
    end_session_endpoint: Optional[str] = None


class OIDCTestLoginRequest(BaseModel):
    """OIDC test login request with optional parameter overrides."""

    redirect_uri: Optional[str] = None
    scopes: Optional[List[str]] = None
    response_type: Optional[str] = None
    client_id: Optional[str] = None
