"""
Application settings routers.

This package contains routers for:
- Common application settings
- Cache configuration
- Credentials management
- Template management
- RBAC (roles and permissions)
- Compliance settings
- External system connections
- Git repository management
"""

# Import all settings routers
from .common import router as common_router
from .cache import router as cache_router
from .credentials import router as credentials_router
from .templates import router as templates_router
from .rbac import router as rbac_router

# Import from subdirectories
from .compliance.rules import router as compliance_router
from .connections.config import router as config_router
from .git import router as git_router

# Export all routers
__all__ = [
    "common_router",
    "cache_router",
    "credentials_router",
    "templates_router",
    "rbac_router",
    "compliance_router",
    "config_router",
    "git_router",
]
