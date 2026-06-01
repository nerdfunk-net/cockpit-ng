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


class Template(Base):
    """Configuration templates stored in database or linked to git/file sources."""

    __tablename__ = "templates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, index=True)
    source = Column(
        String(50), nullable=False, index=True
    )  # 'git', 'file', 'webeditor'
    template_type = Column(
        String(50), nullable=False, default="jinja2"
    )  # 'jinja2', 'text', 'yaml', 'json', 'textfsm'
    category = Column(String(255), index=True)
    description = Column(Text)

    # File/WebEditor-specific fields
    content = Column(Text)
    filename = Column(String(255))
    content_hash = Column(String(64))

    # Metadata
    variables = Column(Text, default="{}", nullable=False)  # JSON string
    tags = Column(Text, default="[]", nullable=False)  # JSON string
    use_nautobot_context = Column(
        Boolean, default=False, nullable=False
    )  # Whether to use Nautobot context when rendering
    pass_snmp_mapping = Column(
        Boolean, default=False, nullable=False
    )  # Whether to include SNMP mapping in context (agent templates)
    inventory_id = Column(
        Integer, ForeignKey("inventories.id", ondelete="SET NULL"), nullable=True
    )  # ID of saved inventory to use for agent templates
    pre_run_command = Column(
        Text
    )  # Command to execute before rendering (output available as context)
    credential_id = Column(
        Integer
    )  # ID of stored credential to use for pre-run command execution
    execution_mode = Column(
        String(50), default="run_on_device", nullable=False
    )  # 'run_on_device', 'write_to_file', 'sync_to_nautobot'
    file_path = Column(
        Text
    )  # File path when execution_mode is 'write_to_file', supports variables like {device_name}, {template_name}

    # Ownership and scope
    created_by = Column(String(255), index=True)
    scope = Column(
        String(50), default="global", nullable=False, index=True
    )  # 'global', 'private'

    # Status
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    last_sync = Column(DateTime(timezone=True))
    sync_status = Column(String(255))

    # Timestamps
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationship to versions
    versions = relationship(
        "TemplateVersion", back_populates="template", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index(
            "idx_templates_active_name",
            "name",
            unique=True,
            postgresql_where=(is_active),
        ),
    )


class TemplateVersion(Base):
    """Version history for templates."""

    __tablename__ = "template_versions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    template_id = Column(
        Integer,
        ForeignKey("templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version_number = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    content_hash = Column(String(64), nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_by = Column(String(255))
    change_notes = Column(Text)

    # Relationship to template
    template = relationship("Template", back_populates="versions")

    __table_args__ = (Index("idx_template_versions_template_id", "template_id"),)
