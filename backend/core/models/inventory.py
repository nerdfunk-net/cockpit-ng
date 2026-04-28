from sqlalchemy import Boolean, Column, DateTime, Index, Integer, String, Text
from sqlalchemy.sql import func

from core.database import Base


class Inventory(Base):
    """Stored Ansible inventory configurations."""

    __tablename__ = "inventories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    conditions = Column(Text, nullable=False)  # JSON array of LogicalConditions
    template_category = Column(String(255))  # Optional: Last used template category
    template_name = Column(String(255))  # Optional: Last used template name
    scope = Column(
        String(50), nullable=False, default="global"
    )  # 'global' or 'private'
    group_path = Column(
        String(1000), nullable=True, default=None
    )  # e.g. "group_a/sub_b"
    created_by = Column(String(255), nullable=False, index=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (
        Index("idx_inventory_scope_created_by", "scope", "created_by"),
        Index("idx_inventory_active_scope", "is_active", "scope"),
        Index("idx_inventory_group_path", "group_path"),
    )
