"""
RBAC repository for role and permission database operations.
"""

from typing import Optional, List
from sqlalchemy import and_
from repositories.base import BaseRepository
from core.models import Role, Permission, RolePermission, UserRole, UserPermission
from core.database import get_db_session


class RBACRepository(BaseRepository):
    """Repository for RBAC operations."""

    def __init__(self):
        # RBAC has multiple models, so we don't call super().__init__()
        pass

    # ========================================================================
    # Permission Operations
    # ========================================================================

    def create_permission(
        self, resource: str, action: str, description: str = ""
    ) -> Permission:
        """Create a new permission."""
        db = get_db_session()
        try:
            permission = Permission(
                resource=resource, action=action, description=description
            )
            db.add(permission)
            db.commit()
            db.refresh(permission)
            return permission
        finally:
            db.close()

    def get_permission(self, resource: str, action: str) -> Optional[Permission]:
        """Get permission by resource and action."""
        db = get_db_session()
        try:
            return (
                db.query(Permission)
                .filter(
                    and_(Permission.resource == resource, Permission.action == action)
                )
                .first()
            )
        finally:
            db.close()

    def get_permission_by_id(self, permission_id: int) -> Optional[Permission]:
        """Get permission by ID."""
        db = get_db_session()
        try:
            return db.query(Permission).filter(Permission.id == permission_id).first()
        finally:
            db.close()

    def list_permissions(self) -> List[Permission]:
        """Get all permissions."""
        db = get_db_session()
        try:
            return (
                db.query(Permission)
                .order_by(Permission.resource, Permission.action)
                .all()
            )
        finally:
            db.close()

    def delete_permission(self, permission_id: int) -> bool:
        """Delete a permission."""
        db = get_db_session()
        try:
            permission = (
                db.query(Permission).filter(Permission.id == permission_id).first()
            )
            if permission:
                db.delete(permission)
                db.commit()
                return True
            return False
        finally:
            db.close()

    # ========================================================================
    # Role Operations
    # ========================================================================

    def create_role(
        self, name: str, description: str = "", is_system: bool = False
    ) -> Role:
        """Create a new role."""
        db = get_db_session()
        try:
            role = Role(name=name, description=description, is_system=is_system)
            db.add(role)
            db.commit()
            db.refresh(role)
            return role
        finally:
            db.close()

    def get_role(self, role_id: int) -> Optional[Role]:
        """Get role by ID."""
        db = get_db_session()
        try:
            return db.query(Role).filter(Role.id == role_id).first()
        finally:
            db.close()

    def get_role_by_name(self, name: str) -> Optional[Role]:
        """Get role by name."""
        db = get_db_session()
        try:
            return db.query(Role).filter(Role.name == name).first()
        finally:
            db.close()

    def list_roles(self) -> List[Role]:
        """Get all roles."""
        db = get_db_session()
        try:
            return db.query(Role).order_by(Role.name).all()
        finally:
            db.close()

    def update_role(self, role_id: int, **kwargs) -> Optional[Role]:
        """Update a role."""
        db = get_db_session()
        try:
            role = db.query(Role).filter(Role.id == role_id).first()
            if role:
                for key, value in kwargs.items():
                    if hasattr(role, key):
                        setattr(role, key, value)
                db.commit()
                db.refresh(role)
            return role
        finally:
            db.close()

    def delete_role(self, role_id: int) -> bool:
        """Delete a role."""
        db = get_db_session()
        try:
            role = db.query(Role).filter(Role.id == role_id).first()
            if role:
                db.delete(role)
                db.commit()
                return True
            return False
        finally:
            db.close()

    def role_name_exists(self, name: str) -> bool:
        """Check if role name exists."""
        db = get_db_session()
        try:
            return db.query(Role).filter(Role.name == name).count() > 0
        finally:
            db.close()

    # ========================================================================
    # Role-Permission Operations
    # ========================================================================

    def assign_permission_to_role(
        self, role_id: int, permission_id: int, granted: bool = True
    ) -> RolePermission:
        """Assign permission to role."""
        db = get_db_session()
        try:
            # Check if already exists
            existing = (
                db.query(RolePermission)
                .filter(
                    and_(
                        RolePermission.role_id == role_id,
                        RolePermission.permission_id == permission_id,
                    )
                )
                .first()
            )

            if existing:
                existing.granted = granted
                db.commit()
                db.refresh(existing)
                return existing

            # Create new
            role_perm = RolePermission(
                role_id=role_id, permission_id=permission_id, granted=granted
            )
            db.add(role_perm)
            db.commit()
            db.refresh(role_perm)
            return role_perm
        finally:
            db.close()

    def remove_permission_from_role(self, role_id: int, permission_id: int) -> bool:
        """Remove permission from role."""
        db = get_db_session()
        try:
            role_perm = (
                db.query(RolePermission)
                .filter(
                    and_(
                        RolePermission.role_id == role_id,
                        RolePermission.permission_id == permission_id,
                    )
                )
                .first()
            )

            if role_perm:
                db.delete(role_perm)
                db.commit()
                return True
            return False
        finally:
            db.close()

    def get_role_permissions(self, role_id: int) -> List[Permission]:
        """Get all permissions for a role."""
        db = get_db_session()
        try:
            role_perms = (
                db.query(RolePermission)
                .filter(and_(RolePermission.role_id == role_id, RolePermission.granted))
                .all()
            )

            permission_ids = [rp.permission_id for rp in role_perms]
            if not permission_ids:
                return []

            return db.query(Permission).filter(Permission.id.in_(permission_ids)).all()
        finally:
            db.close()

    # ========================================================================
    # User-Role Operations
    # ========================================================================

    def assign_role_to_user(self, user_id: int, role_id: int) -> UserRole:
        """Assign role to user."""
        db = get_db_session()
        try:
            # Check if already exists
            existing = (
                db.query(UserRole)
                .filter(and_(UserRole.user_id == user_id, UserRole.role_id == role_id))
                .first()
            )

            if existing:
                return existing

            # Create new
            user_role = UserRole(user_id=user_id, role_id=role_id)
            db.add(user_role)
            db.commit()
            db.refresh(user_role)
            return user_role
        finally:
            db.close()

    def remove_role_from_user(self, user_id: int, role_id: int) -> bool:
        """Remove role from user."""
        db = get_db_session()
        try:
            user_role = (
                db.query(UserRole)
                .filter(and_(UserRole.user_id == user_id, UserRole.role_id == role_id))
                .first()
            )

            if user_role:
                db.delete(user_role)
                db.commit()
                return True
            return False
        finally:
            db.close()

    def get_user_roles(self, user_id: int) -> List[Role]:
        """Get all roles for a user."""
        db = get_db_session()
        try:
            user_roles = db.query(UserRole).filter(UserRole.user_id == user_id).all()
            role_ids = [ur.role_id for ur in user_roles]

            if not role_ids:
                return []

            return db.query(Role).filter(Role.id.in_(role_ids)).all()
        finally:
            db.close()

    def get_users_with_role(self, role_id: int) -> List[int]:
        """Get all user IDs with a specific role."""
        db = get_db_session()
        try:
            user_roles = db.query(UserRole).filter(UserRole.role_id == role_id).all()
            return [ur.user_id for ur in user_roles]
        finally:
            db.close()

    # ========================================================================
    # User-Permission Operations
    # ========================================================================

    def assign_permission_to_user(
        self, user_id: int, permission_id: int, granted: bool = True
    ) -> UserPermission:
        """Assign permission directly to user."""
        db = get_db_session()
        try:
            # Check if already exists
            existing = (
                db.query(UserPermission)
                .filter(
                    and_(
                        UserPermission.user_id == user_id,
                        UserPermission.permission_id == permission_id,
                    )
                )
                .first()
            )

            if existing:
                existing.granted = granted
                db.commit()
                db.refresh(existing)
                return existing

            # Create new
            user_perm = UserPermission(
                user_id=user_id, permission_id=permission_id, granted=granted
            )
            db.add(user_perm)
            db.commit()
            db.refresh(user_perm)
            return user_perm
        finally:
            db.close()

    def remove_permission_from_user(self, user_id: int, permission_id: int) -> bool:
        """Remove permission from user."""
        db = get_db_session()
        try:
            user_perm = (
                db.query(UserPermission)
                .filter(
                    and_(
                        UserPermission.user_id == user_id,
                        UserPermission.permission_id == permission_id,
                    )
                )
                .first()
            )

            if user_perm:
                db.delete(user_perm)
                db.commit()
                return True
            return False
        finally:
            db.close()

    def get_user_permissions(self, user_id: int) -> List[Permission]:
        """Get all direct permissions for a user."""
        db = get_db_session()
        try:
            user_perms = (
                db.query(UserPermission)
                .filter(and_(UserPermission.user_id == user_id, UserPermission.granted))
                .all()
            )

            permission_ids = [up.permission_id for up in user_perms]
            if not permission_ids:
                return []

            return db.query(Permission).filter(Permission.id.in_(permission_ids)).all()
        finally:
            db.close()

    def get_user_permission_override(
        self, user_id: int, permission_id: int
    ) -> Optional[bool]:
        """Get user's permission override (True=granted, False=denied, None=no override)."""
        db = get_db_session()
        try:
            user_perm = (
                db.query(UserPermission)
                .filter(
                    and_(
                        UserPermission.user_id == user_id,
                        UserPermission.permission_id == permission_id,
                    )
                )
                .first()
            )

            if user_perm:
                return user_perm.granted
            return None
        finally:
            db.close()

    def get_user_permission_overrides_with_status(
        self, user_id: int
    ) -> List[tuple[Permission, bool]]:
        """Get all permission overrides for a user with their granted status.

        Returns:
            List of tuples (Permission, granted) for all user permission overrides
        """
        db = get_db_session()
        try:
            # Join UserPermission with Permission to get both the permission and granted status
            results = (
                db.query(Permission, UserPermission.granted)
                .join(UserPermission, UserPermission.permission_id == Permission.id)
                .filter(UserPermission.user_id == user_id)
                .all()
            )
            return results
        finally:
            db.close()
