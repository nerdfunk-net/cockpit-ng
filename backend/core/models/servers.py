from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func

from core.database import Base


class Server(Base):
    """Managed server with Ansible-gathered facts."""

    __tablename__ = "servers"

    id = Column(Integer, primary_key=True, index=True)
    hostname = Column(String(255), nullable=False, index=True, unique=True)
    location = Column(JSONB, nullable=True)
    cluster = Column(JSONB, nullable=True)
    primary_ipv4 = Column(String(50), nullable=True)
    primary_interface = Column(String(100), nullable=True)
    os_family = Column(String(100), nullable=True, index=True)
    processor_count = Column(Integer, nullable=True, index=True)
    memtotal_mb = Column(Integer, nullable=True, index=True)
    disk_count = Column(Integer, nullable=True, index=True)
    disk_total_gb = Column(Integer, nullable=True, index=True)
    disk_usage_pct = Column(Integer, nullable=True, index=True)
    architecture = Column(String(100), nullable=True)
    distribution = Column(String(100), nullable=True, index=True)
    distribution_release = Column(String(100), nullable=True)
    distribution_version = Column(String(100), nullable=True, index=True)
    contact = Column(JSONB, nullable=True)
    nautobot_uuid = Column(String(36), nullable=True)
    is_virtual = Column(
        Boolean, nullable=False, server_default="false", default=False, index=True
    )
    ansible_facts = Column(JSONB, nullable=True)
    ansible_credentials = Column(JSONB, nullable=True)
    open_ports = Column(JSONB, nullable=True)
    selected_interfaces = Column(JSONB, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class ServerFactsHistory(Base):
    """Historical snapshots of Ansible facts gathered for a server."""

    __tablename__ = "server_facts_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    server_id = Column(
        Integer,
        ForeignKey("servers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ansible_facts = Column(JSONB, nullable=False)
    content_hash = Column(String(64), nullable=False)
    recorded_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (Index("idx_server_facts_history_server_id", "server_id"),)


class ServerOpenPortsHistory(Base):
    """Historical snapshots of open TCP/UDP ports scanned for a server."""

    __tablename__ = "server_open_ports_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    server_id = Column(
        Integer,
        ForeignKey("servers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    open_ports = Column(JSONB, nullable=False)
    content_hash = Column(String(64), nullable=False)
    recorded_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (Index("idx_server_open_ports_history_server_id", "server_id"),)
