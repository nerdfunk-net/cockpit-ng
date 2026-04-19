from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from core.database import Base


class SnapshotCommandTemplate(Base):
    """Command templates for network snapshots."""

    __tablename__ = "snapshot_command_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    scope = Column(
        String(50), nullable=False, default="global"
    )  # 'global' or 'private'
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

    # Relationships
    commands = relationship(
        "SnapshotCommand",
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="SnapshotCommand.order",
    )

    __table_args__ = (
        Index("idx_snapshot_template_scope_created_by", "scope", "created_by"),
        Index("idx_snapshot_template_active", "is_active"),
    )


class SnapshotCommand(Base):
    """Individual commands within a snapshot template."""

    __tablename__ = "snapshot_commands"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(
        Integer,
        ForeignKey("snapshot_command_templates.id", ondelete="CASCADE"),
        nullable=False,
    )
    command = Column(Text, nullable=False)
    use_textfsm = Column(Boolean, nullable=False, default=True)
    order = Column(Integer, nullable=False, default=0)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    template = relationship("SnapshotCommandTemplate", back_populates="commands")

    __table_args__ = (Index("idx_snapshot_command_template", "template_id"),)


class Snapshot(Base):
    """Snapshot execution records."""

    __tablename__ = "snapshots"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    template_id = Column(
        Integer, ForeignKey("snapshot_command_templates.id", ondelete="SET NULL")
    )
    template_name = Column(String(255))  # Snapshot of template name at execution time
    git_repository_id = Column(
        Integer, ForeignKey("git_repositories.id", ondelete="SET NULL")
    )
    snapshot_path = Column(
        String(500), nullable=False
    )  # Path template with placeholders
    executed_by = Column(String(255), nullable=False, index=True)
    status = Column(
        String(50), nullable=False, default="pending"
    )  # pending, running, completed, failed
    device_count = Column(Integer, nullable=False, default=0)
    success_count = Column(Integer, nullable=False, default=0)
    failed_count = Column(Integer, nullable=False, default=0)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
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
    results = relationship(
        "SnapshotResult", back_populates="snapshot", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_snapshot_status", "status"),
        Index("idx_snapshot_executed_by", "executed_by"),
        Index("idx_snapshot_created_at", "created_at"),
    )


class SnapshotResult(Base):
    """Per-device snapshot results with parsed JSON data."""

    __tablename__ = "snapshot_results"

    id = Column(Integer, primary_key=True, index=True)
    snapshot_id = Column(
        Integer, ForeignKey("snapshots.id", ondelete="CASCADE"), nullable=False
    )
    device_name = Column(String(255), nullable=False, index=True)
    device_ip = Column(String(45))
    status = Column(
        String(50), nullable=False, default="pending"
    )  # pending, running, success, failed
    git_file_path = Column(String(1000))  # Path to JSON file in Git
    git_commit_hash = Column(String(255))  # Git commit SHA
    parsed_data = Column(Text)  # JSON string of all parsed command outputs
    error_message = Column(Text)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
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
    snapshot = relationship("Snapshot", back_populates="results")

    __table_args__ = (
        Index("idx_snapshot_result_snapshot", "snapshot_id"),
        Index("idx_snapshot_result_device", "device_name"),
        Index("idx_snapshot_result_status", "status"),
    )
