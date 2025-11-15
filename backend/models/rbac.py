"""Pydantic models for RBAC system."""

from pydantic import BaseModel, Field
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
