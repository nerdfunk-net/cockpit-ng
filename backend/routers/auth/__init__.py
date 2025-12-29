"""
Authentication and authorization routers.

This package contains routers for:
- User authentication (login, logout, token refresh)
- OIDC/SSO authentication
- User profile management
"""

from .auth import router as auth_router
from .oidc import router as oidc_router
from .profile import router as profile_router

__all__ = ["auth_router", "oidc_router", "profile_router"]
