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
from .cache_settings import router as cache_settings_router
from .credentials import router as credentials_router
from .templates import router as templates_router
from .rbac import router as rbac_router
from .nautobot import router as nautobot_settings_router
from .git_settings import router as git_settings_router
from .checkmk_settings import router as checkmk_settings_router
from .agents_settings import router as agents_settings_router

# Import from subdirectories
from .compliance.rules import router as compliance_router
from .connections.config import router as config_router
from .git import router as git_router

# Export all routers
__all__ = [
    "common_router",
    "cache_router",
    "cache_settings_router",
    "credentials_router",
    "templates_router",
    "rbac_router",
    "nautobot_settings_router",
    "git_settings_router",
    "checkmk_settings_router",
    "agents_settings_router",
    "compliance_router",
    "config_router",
    "git_router",
]
