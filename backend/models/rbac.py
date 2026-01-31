"""Pydantic models for RBAC system."""

from pydantic import BaseModel, Field, field_validator
from typing import List, Optional


# ============================================================================
# Permission Models
# ============================================================================


class PermissionBase(BaseModel):
    """Base permission model."""

    resource: str = Field(
        ..., description="Resource identifier (e.g., 'nautobot.devices')"
    )
    action: str = Field(
        ..., description="Action type (e.g., 'read', 'write', 'delete', 'execute')"
    )
    description: Optional[str] = Field("", description="Human-readable description")


class PermissionCreate(PermissionBase):
    """Model for creating a new permission."""

    pass


class Permission(PermissionBase):
    """Full permission model with ID."""

    id: int
    created_at: str

    class Config:
        from_attributes = True


class PermissionWithGrant(Permission):
    """Permission with granted status (for role/user assignments)."""

    granted: bool = Field(
        ..., description="Whether permission is granted (True) or denied (False)"
    )
    source: Optional[str] = Field(
        None, description="Source of permission: 'role' or 'override'"
    )


# ============================================================================
# Role Models
# ============================================================================


class RoleBase(BaseModel):
    """Base role model."""

    name: str = Field(..., description="Role name (e.g., 'admin', 'operator')")
    description: Optional[str] = Field("", description="Human-readable description")


class RoleCreate(RoleBase):
    """Model for creating a new role."""

    is_system: bool = Field(
        False, description="Whether this is a system role (cannot be deleted)"
    )


class RoleUpdate(BaseModel):
    """Model for updating a role."""

    name: Optional[str] = Field(None, description="New role name")
    description: Optional[str] = Field(None, description="New description")


class Role(RoleBase):
    """Full role model with ID."""

    id: int
    is_system: bool
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class RoleWithPermissions(Role):
    """Role with its permissions."""

    permissions: List[PermissionWithGrant] = Field(default_factory=list)


# ============================================================================
# User-Role Assignment Models
# ============================================================================


class UserRoleAssignment(BaseModel):
    """Model for assigning a role to a user."""

    user_id: int = Field(..., description="User ID")
    role_id: int = Field(..., description="Role ID to assign")


class UserRoleRemoval(BaseModel):
    """Model for removing a role from a user."""

    user_id: int = Field(..., description="User ID")
    role_id: int = Field(..., description="Role ID to remove")


# ============================================================================
# Permission Assignment Models
# ============================================================================


class RolePermissionAssignment(BaseModel):
    """Model for assigning a permission to a role."""

    role_id: int = Field(..., description="Role ID")
    permission_id: int = Field(..., description="Permission ID to assign")
    granted: bool = Field(True, description="True to allow, False to deny")


class UserPermissionAssignment(BaseModel):
    """Model for assigning a permission directly to a user."""

    user_id: int = Field(..., description="User ID")
    permission_id: int = Field(..., description="Permission ID to assign")
    granted: bool = Field(True, description="True to allow, False to deny")


# ============================================================================
# Permission Check Models
# ============================================================================


class PermissionCheck(BaseModel):
    """Model for checking a permission."""

    resource: str = Field(..., description="Resource identifier")
    action: str = Field(..., description="Action type")


class PermissionCheckResult(BaseModel):
    """Result of a permission check."""

    has_permission: bool = Field(..., description="Whether user has the permission")
    resource: str
    action: str
    source: Optional[str] = Field(
        None, description="Source: 'role', 'override', or None if denied"
    )


# ============================================================================
# User Permission Models
# ============================================================================


class UserPermissions(BaseModel):
    """All permissions for a user."""

    user_id: int
    roles: List[Role] = Field(
        default_factory=list, description="Roles assigned to user"
    )
    permissions: List[PermissionWithGrant] = Field(
        default_factory=list,
        description="Effective permissions (from roles + overrides)",
    )
    overrides: List[PermissionWithGrant] = Field(
        default_factory=list, description="Direct permission overrides"
    )


# ============================================================================
# Bulk Assignment Models
# ============================================================================


class BulkRoleAssignment(BaseModel):
    """Assign multiple roles to a user."""

    user_id: int
    role_ids: List[int] = Field(..., description="List of role IDs to assign")


class BulkPermissionAssignment(BaseModel):
    """Assign multiple permissions to a role."""

    role_id: int
    permission_ids: List[int] = Field(
        ..., description="List of permission IDs to assign"
    )
    granted: bool = Field(True, description="True to allow, False to deny")


# ============================================================================
# User Management Models
# ============================================================================


class UserBase(BaseModel):
    """Base user model."""

    username: str = Field(..., min_length=3, max_length=50, description="Username")
    realname: str = Field(..., min_length=1, max_length=100, description="Real name")
    email: Optional[str] = Field(None, max_length=255, description="Email address")
    is_active: bool = Field(True, description="User account active status")


class UserCreate(UserBase):
    """Model for creating a new user."""

    password: str = Field(..., min_length=8, description="User password")
    role_ids: List[int] = Field(
        default_factory=list, description="Initial roles to assign to user"
    )


class UserUpdate(BaseModel):
    """Model for updating a user."""

    realname: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=255)
    password: Optional[str] = Field(None, min_length=8)
    is_active: Optional[bool] = Field(None, description="Enable/disable account")

    @field_validator("realname", "email", "password", mode="before")
    @classmethod
    def empty_str_to_none(cls, v):
        """Convert empty strings to None."""
        if v == "":
            return None
        return v


class UserResponse(UserBase):
    """Full user model with ID and metadata."""

    id: int
    created_at: str
    updated_at: str
    roles: List[Role] = Field(default_factory=list, description="User's assigned roles")
    permissions: List[PermissionWithGrant] = Field(
        default_factory=list, description="User's effective permissions"
    )

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    """User list response."""

    users: List[UserResponse]
    total: int


class BulkUserDelete(BaseModel):
    """Bulk delete users."""

    user_ids: List[int] = Field(
        ..., min_items=1, description="List of user IDs to delete"
    )
