from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.sql import func

from core.database import Base


class Server(Base):
    """Managed server with Ansible-gathered facts."""

    __tablename__ = "servers"

    id = Column(Integer, primary_key=True, index=True)
    hostname = Column(String(255), nullable=False, index=True)
    location = Column(JSON, nullable=True)
    primary_ipv4 = Column(String(50), nullable=True)
    primary_interface = Column(String(100), nullable=True)
    os_family = Column(String(100), nullable=True)
    processor_count = Column(Integer, nullable=True)
    memtotal_mb = Column(Integer, nullable=True)
    disk_count = Column(Integer, nullable=True)
    architecture = Column(String(100), nullable=True)
    distribution_release = Column(String(100), nullable=True)
    distribution_version = Column(String(100), nullable=True)
    contact = Column(String(255), nullable=True)
    nautobot_uuid = Column(String(255), nullable=True)
    is_virtual = Column(Boolean, nullable=False, server_default="false", default=False)
    ansible_facts = Column(JSON, nullable=True)
    selected_interfaces = Column(JSON, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
