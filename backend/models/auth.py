"""
Authentication-related Pydantic models.
"""

from __future__ import annotations
from pydantic import BaseModel
from typing import Dict, Any, Optional


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


class TokenData(BaseModel):
    """Token data for JWT processing."""

    username: Optional[str] = None


class OIDCAuthRequest(BaseModel):
    """OIDC authentication request parameters."""

    redirect_uri: Optional[str] = None
    state: Optional[str] = None


class OIDCCallbackRequest(BaseModel):
    """OIDC callback request with authorization code."""

    code: str
    state: Optional[str] = None


class OIDCConfig(BaseModel):
    """OIDC provider configuration from discovery endpoint."""

    issuer: str
    authorization_endpoint: str
    token_endpoint: str
    userinfo_endpoint: str
    jwks_uri: str
    end_session_endpoint: Optional[str] = None
