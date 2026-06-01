from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.database import Base


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False)
    description = Column(Text)
    is_system = Column(Boolean, nullable=False, default=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    role_permissions = relationship(
        "RolePermission", back_populates="role", cascade="all, delete-orphan"
    )
    user_roles = relationship(
        "UserRole", back_populates="role", cascade="all, delete-orphan"
    )


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    resource = Column(String(255), nullable=False)
    action = Column(String(255), nullable=False)
    description = Column(Text)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    role_permissions = relationship(
        "RolePermission", back_populates="permission", cascade="all, delete-orphan"
    )
    user_permissions = relationship(
        "UserPermission", back_populates="permission", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("resource", "action", name="uix_resource_action"),
        Index("idx_permissions_resource", "resource", "action"),
    )


class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_id = Column(
        Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
    )
    permission_id = Column(
        Integer, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True
    )
    granted = Column(Boolean, nullable=False, default=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    role = relationship("Role", back_populates="role_permissions")
    permission = relationship("Permission", back_populates="role_permissions")

    __table_args__ = (Index("idx_role_permissions_role", "role_id"),)


class UserRole(Base):
    __tablename__ = "user_roles"

    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role_id = Column(
        Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
    )
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    user = relationship("User", back_populates="user_roles")
    role = relationship("Role", back_populates="user_roles")

    __table_args__ = (Index("idx_user_roles_user", "user_id"),)


class UserPermission(Base):
    __tablename__ = "user_permissions"

    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    permission_id = Column(
        Integer, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True
    )
    granted = Column(Boolean, nullable=False, default=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    user = relationship("User", back_populates="user_permissions")
    permission = relationship("Permission", back_populates="user_permissions")

    __table_args__ = (Index("idx_user_permissions_user", "user_id"),)
