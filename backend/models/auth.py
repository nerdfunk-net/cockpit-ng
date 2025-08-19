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
