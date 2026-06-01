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
"""

# Import all settings routers
from .agents_settings import router as agents_settings_router
from .cache import router as cache_router
from .cache_settings import router as cache_settings_router
from .checkmk_settings import router as checkmk_settings_router
from .common import router as common_router

# Import from subdirectories
from .compliance.rules import router as compliance_router
from .connections.config import router as config_router
from .credentials import router as credentials_router
from .git_settings import router as git_settings_router
from .nautobot import router as nautobot_settings_router
from .network_defaults import router as network_defaults_router
from .server_defaults import router as server_defaults_router
from .rbac import router as rbac_router
from .templates import router as templates_router

# Export all routers
__all__ = [
    "common_router",
    "cache_router",
    "cache_settings_router",
    "credentials_router",
    "templates_router",
    "rbac_router",
    "nautobot_settings_router",
    "network_defaults_router",
    "server_defaults_router",
    "git_settings_router",
    "checkmk_settings_router",
    "agents_settings_router",
    "compliance_router",
    "config_router",
]
