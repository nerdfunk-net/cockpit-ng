"""
User management Pydantic models.
"""

from __future__ import annotations
from pydantic import BaseModel
from typing import List, Optional
from enum import Enum


class UserRole(str, Enum):
    """User role enumeration."""

    admin = "admin"
    user = "user"
    viewer = "viewer"
    custom = "custom"


class UserPermissions(BaseModel):
    """User permissions model using bitwise flags."""

    permissions: int = 1  # Default to READ permission (bit 0)

    @property
    def can_read(self) -> bool:
        return bool(self.permissions & 1)

    @property
    def can_write(self) -> bool:
        return bool(self.permissions & 2)

    @property
    def can_admin(self) -> bool:
        return bool(self.permissions & 4)

    @property
    def can_delete(self) -> bool:
        return bool(self.permissions & 8)

    @property
    def can_user_manage(self) -> bool:
        return bool(self.permissions & 16)

    def to_dict(self) -> dict:
        return {
            "can_read": self.can_read,
            "can_write": self.can_write,
            "can_admin": self.can_admin,
            "can_delete": self.can_delete,
            "can_user_manage": self.can_user_manage,
        }


class UserCreate(BaseModel):
    """User creation request model."""

    username: str
    realname: str
    email: Optional[str] = None
    password: str
    role: UserRole = UserRole.user


class UserUpdate(BaseModel):
    """User update request model."""

    realname: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[UserRole] = None
    permissions: Optional[int] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    """User response model."""

    id: int
    username: str
    realname: str
    email: Optional[str]
    role: UserRole
    permissions: int
    is_active: bool
    created_at: str
    updated_at: str


class UserListResponse(BaseModel):
    """User list response model."""

    users: List[UserResponse]
    total: int


class BulkUserAction(BaseModel):
    """Bulk user action request model."""

    user_ids: List[int]
    action: str  # "delete" or "update_permissions"
    permissions: Optional[int] = None
