"""RBAC user management endpoints."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_role, verify_token
from core.safe_http_errors import raise_internal_server_error
from dependencies import get_audit_log_service, get_rbac_service
from models.rbac import (
    BulkUserDelete,
    UserCreate,
    UserListResponse,
    UserResponse,
    UserUpdate,
)
from services.audit.audit_log_service import AuditLogService
from services.auth.exceptions import RBACNotFoundError
from services.auth.rbac_service import RBACService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    current_user: dict = Depends(require_role("admin")),
    rbac: RBACService = Depends(get_rbac_service),
    audit_log: AuditLogService = Depends(get_audit_log_service),
):
    """Create a new user with initial role assignments (admin only)."""
    try:
        user = rbac.create_user_with_roles(
            username=user_data.username,
            realname=user_data.realname,
            password=user_data.password,
            email=user_data.email,
            role_ids=user_data.role_ids,
            is_active=user_data.is_active,
        )

        # Get full user with roles and permissions
        user_with_rbac = rbac.get_user_with_rbac(user["id"])

        audit_log.log_event(
            username=current_user.get("username"),
            user_id=current_user.get("user_id"),
            event_type="rbac-user-created",
            message=f"User '{user_data.username}' created",
            resource_type="user",
            resource_id=str(user["id"]),
            resource_name=user_data.username,
            severity="info",
        )

        return user_with_rbac
    except RBACNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more specified roles not found",
        )
    except Exception as e:
        raise_internal_server_error(logger, "Failed to create user: ", e)


@router.get("/users", response_model=UserListResponse)
async def list_users(
    include_inactive: bool = True,
    current_user: dict = Depends(verify_token),
    rbac: RBACService = Depends(get_rbac_service),
):
    """List all users with their roles."""
    try:
        users = rbac.list_users_with_rbac(include_inactive)
        return UserListResponse(users=users, total=len(users))
    except Exception as e:
        logger.error("Error listing users: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list users",
        )


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: dict = Depends(verify_token),
    rbac: RBACService = Depends(get_rbac_service),
):
    """Get user details with roles and permissions."""
    try:
        user = rbac.get_user_with_rbac(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )
        return user
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error getting user %s: %s", user_id, str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user",
        )


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    current_user: dict = Depends(require_role("admin")),
    rbac: RBACService = Depends(get_rbac_service),
    audit_log: AuditLogService = Depends(get_audit_log_service),
):
    """Update user profile (admin only)."""
    try:
        user = rbac.update_user_profile(
            user_id=user_id,
            realname=user_data.realname,
            email=user_data.email,
            password=user_data.password,
            is_active=user_data.is_active,
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        # Get full user with roles and permissions (include inactive in case we just deactivated)
        user_with_rbac = rbac.get_user_with_rbac(user_id, include_inactive=True)

        if not user_with_rbac:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User {user_id} not found after update",
            )

        audit_log.log_event(
            username=current_user.get("username"),
            user_id=current_user.get("user_id"),
            event_type="rbac-user-updated",
            message=f"User '{user_id}' updated",
            resource_type="user",
            resource_id=str(user_id),
            resource_name=str(user_id),
            severity="info",
        )

        return user_with_rbac
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error updating user %s: %s", user_id, str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user",
        )


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    current_user: dict = Depends(require_role("admin")),
    rbac: RBACService = Depends(get_rbac_service),
    audit_log: AuditLogService = Depends(get_audit_log_service),
):
    """Delete a user and all RBAC associations (admin only)."""
    try:
        success = rbac.delete_user_with_rbac(user_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )
        audit_log.log_event(
            username=current_user.get("username"),
            user_id=current_user.get("user_id"),
            event_type="rbac-user-deleted",
            message=f"User '{user_id}' deleted",
            resource_type="user",
            resource_id=str(user_id),
            resource_name=str(user_id),
            severity="info",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error deleting user %s: %s", user_id, str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete user",
        )


@router.patch("/users/{user_id}/activate", response_model=UserResponse)
async def toggle_user_activation(
    user_id: int,
    current_user: dict = Depends(require_role("admin")),
    rbac: RBACService = Depends(get_rbac_service),
):
    """Toggle user active status (admin only)."""
    try:
        user = rbac.toggle_user_activation(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        # Get full user with roles and permissions
        user_with_rbac = rbac.get_user_with_rbac(user_id, include_inactive=True)
        return user_with_rbac
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Error toggling activation for user %s: %s", user_id, str(e), exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to toggle user activation",
        )


@router.patch("/users/{user_id}/debug", response_model=UserResponse)
async def toggle_user_debug(
    user_id: int,
    current_user: dict = Depends(require_role("admin")),
    rbac: RBACService = Depends(get_rbac_service),
):
    """Toggle user debug mode (admin only)."""
    try:
        user = rbac.toggle_user_debug(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        # Get full user with roles and permissions
        user_with_rbac = rbac.get_user_with_rbac(user_id)
        return user_with_rbac
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Error toggling debug for user %s: %s", user_id, str(e), exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to toggle user debug mode",
        )


@router.post("/users/bulk-delete", status_code=status.HTTP_200_OK)
async def bulk_delete_users(
    bulk_data: BulkUserDelete,
    current_user: dict = Depends(require_role("admin")),
    rbac: RBACService = Depends(get_rbac_service),
):
    """Bulk delete users with RBAC cleanup (admin only)."""
    try:
        success_count, errors = rbac.bulk_delete_users_with_rbac(bulk_data.user_ids)
        return {
            "success_count": success_count,
            "errors": errors,
            "message": f"Successfully deleted {success_count} user(s)",
        }
    except Exception as e:
        logger.error("Error bulk deleting users: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to bulk delete users",
        )
