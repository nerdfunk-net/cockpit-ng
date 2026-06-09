"""Shared helpers for the RBAC routers."""

from __future__ import annotations

from typing import Any, Dict

from fastapi import HTTPException, status

from models.rbac import PermissionCheck
from services.auth.rbac_service import RBACService


def ensure_self_or_admin(
    rbac: RBACService, current_user: dict, user_id: int, detail: str
) -> None:
    """Allow access to one's own RBAC data; admins may access anyone's."""
    if current_user["user_id"] != user_id:
        user_roles = rbac.get_user_roles(current_user["user_id"])
        if not any(role["name"] == "admin" for role in user_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=detail,
            )


def permission_check_result(
    rbac: RBACService, user_id: int, check: PermissionCheck
) -> Dict[str, Any]:
    """Evaluate a permission check and report whether it came from a role or
    a per-user override."""
    has_perm = rbac.has_permission(user_id, check.resource, check.action)

    source = None
    if has_perm:
        overrides = rbac.get_user_permission_overrides(user_id)
        if any(
            p["resource"] == check.resource
            and p["action"] == check.action
            and p["granted"]
            for p in overrides
        ):
            source = "override"
        else:
            source = "role"

    return {
        "has_permission": has_perm,
        "resource": check.resource,
        "action": check.action,
        "source": source,
    }
