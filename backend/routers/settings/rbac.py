"""RBAC (Role-Based Access Control) API endpoints.

Aggregates the RBAC sub-routers:
- rbac_permissions: Permission CRUD
- rbac_roles: Role CRUD and role-permission assignments
- rbac_user_access: User-role assignments, overrides, and permission checks
- rbac_users: User management
"""

from __future__ import annotations

from fastapi import APIRouter

from routers.settings.rbac_permissions import router as permissions_router
from routers.settings.rbac_roles import router as roles_router
from routers.settings.rbac_user_access import router as user_access_router
from routers.settings.rbac_users import router as users_router

router = APIRouter(prefix="/api/rbac", tags=["rbac"])

router.include_router(permissions_router)
router.include_router(roles_router)
router.include_router(user_access_router)
router.include_router(users_router)
