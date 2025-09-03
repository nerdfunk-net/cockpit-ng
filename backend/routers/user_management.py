"""
User management router for CRUD operations.
"""

from __future__ import annotations
import logging
from fastapi import APIRouter, HTTPException, status, Depends
from core.auth import verify_admin_token
from models.user_management import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserListResponse,
    BulkUserAction,
    UserRole,
)
from services.user_management import (
    create_user,
    get_all_users,
    get_user_by_id,
    update_user,
    delete_user,
    bulk_hard_delete_users,
    bulk_update_permissions,
    toggle_user_status,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/user-management", tags=["user-management"])


def _check_admin_permission(current_user: str):
    """Check if current user has admin permissions."""
    # For now, all authenticated users are considered admin
    # In future, implement proper role-based access control
    pass


@router.get("", response_model=UserListResponse)
async def list_users(current_user: dict = Depends(verify_admin_token)):
    """Get all users."""
    _check_admin_permission(current_user)

    try:
        users = get_all_users(include_inactive=True)

        # Convert to response format
        user_responses = []
        for user in users:
            user_responses.append(
                UserResponse(
                    id=user["id"],
                    username=user["username"],
                    realname=user["realname"],
                    email=user["email"],
                    role=UserRole(user["role"]),
                    permissions=user["permissions"],
                    debug=user["debug"],
                    is_active=user["is_active"],
                    created_at=user["created_at"],
                    updated_at=user["updated_at"],
                )
            )

        return UserListResponse(users=user_responses, total=len(user_responses))

    except Exception as e:
        logger.error(f"Error listing users: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch users",
        )


@router.post("", response_model=UserResponse)
async def create_new_user(
    user_data: UserCreate, current_user: dict = Depends(verify_admin_token)
):
    """Create a new user."""
    _check_admin_permission(current_user)

    try:
        user = create_user(
            username=user_data.username,
            realname=user_data.realname,
            password=user_data.password,
            email=user_data.email,
            role=user_data.role,
            debug=user_data.debug,
        )

        return UserResponse(
            id=user["id"],
            username=user["username"],
            realname=user["realname"],
            email=user["email"],
            role=UserRole(user["role"]),
            permissions=user["permissions"],
            debug=user["debug"],
            is_active=user["is_active"],
            created_at=user["created_at"],
            updated_at=user["updated_at"],
        )

    except Exception as e:
        logger.error(f"Error creating user {user_data.username}: {e}")
        if "UNIQUE constraint failed" in str(e):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists",
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user",
        )


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(user_id: int, current_user: dict = Depends(verify_admin_token)):
    """Get a specific user by ID."""
    _check_admin_permission(current_user)

    try:
        user = get_user_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        return UserResponse(
            id=user["id"],
            username=user["username"],
            realname=user["realname"],
            email=user["email"],
            role=UserRole(user["role"]),
            permissions=user["permissions"],
            debug=user["debug"],
            is_active=user["is_active"],
            created_at=user["created_at"],
            updated_at=user["updated_at"],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch user",
        )


@router.put("/{user_id}", response_model=UserResponse)
async def update_existing_user(
    user_id: int,
    user_data: UserUpdate,
    current_user: dict = Depends(verify_admin_token),
):
    """Update an existing user."""
    _check_admin_permission(current_user)

    try:
        user = update_user(
            user_id=user_id,
            realname=user_data.realname,
            email=user_data.email,
            password=user_data.password,
            role=user_data.role,
            permissions=user_data.permissions,
            debug=user_data.debug,
            is_active=user_data.is_active,
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        return UserResponse(
            id=user["id"],
            username=user["username"],
            realname=user["realname"],
            email=user["email"],
            role=UserRole(user["role"]),
            permissions=user["permissions"],
            debug=user["debug"],
            is_active=user["is_active"],
            created_at=user["created_at"],
            updated_at=user["updated_at"],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user",
        )


@router.delete("/{user_id}")
async def delete_existing_user(
    user_id: int, current_user: dict = Depends(verify_admin_token)
):
    """Delete a user."""
    _check_admin_permission(current_user)

    try:
        success = delete_user(user_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        return {"message": "User deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete user",
        )


@router.post("/bulk-action")
async def perform_bulk_action(
    action_data: BulkUserAction, current_user: dict = Depends(verify_admin_token)
):
    """Perform bulk actions on multiple users."""
    _check_admin_permission(current_user)

    try:
        if action_data.action == "delete":
            success_count, errors = bulk_hard_delete_users(action_data.user_ids)
            return {
                "message": f"Successfully deleted {success_count} users",
                "success_count": success_count,
                "errors": errors,
            }

        elif action_data.action == "update_permissions":
            if action_data.permissions is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Permissions required for update_permissions action",
                )

            success_count, errors = bulk_update_permissions(
                action_data.user_ids, action_data.permissions
            )
            return {
                "message": f"Successfully updated permissions for {success_count} users",
                "success_count": success_count,
                "errors": errors,
            }

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown action: {action_data.action}",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error performing bulk action {action_data.action}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to perform bulk action",
        )


@router.patch("/{user_id}/toggle-status", response_model=UserResponse)
async def toggle_user_active_status(
    user_id: int, current_user: dict = Depends(verify_admin_token)
):
    """Toggle user active status (enable/disable login)."""
    logger.info(f"Toggle status called for user_id: {user_id}")
    _check_admin_permission(current_user)

    try:
        logger.info(f"Calling toggle_user_status({user_id})")
        user = toggle_user_status(user_id)
        logger.info(f"toggle_user_status returned: {user}")

        if not user:
            logger.warning(f"toggle_user_status returned None for user_id: {user_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        return UserResponse(
            id=user["id"],
            username=user["username"],
            realname=user["realname"],
            email=user["email"],
            role=UserRole(user["role"]),
            permissions=user["permissions"],
            debug=user["debug"],
            is_active=user["is_active"],
            created_at=user["created_at"],
            updated_at=user["updated_at"],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error toggling status for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to toggle user status",
        )
