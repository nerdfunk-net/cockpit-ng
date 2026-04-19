from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Index,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.sql import func

from core.database import Base


class Credential(Base):
    __tablename__ = "credentials"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)  # Unique per source, not globally
    username = Column(String(255), nullable=False)
    type = Column(
        String(50), nullable=False, default="generic"
    )  # ssh, tacacs, generic, token, ssh_key
    password_encrypted = Column(LargeBinary, nullable=True)  # Nullable for ssh_key type
    ssh_key_encrypted = Column(LargeBinary, nullable=True)  # Encrypted SSH private key
    ssh_passphrase_encrypted = Column(
        LargeBinary, nullable=True
    )  # Encrypted passphrase
    valid_until = Column(String(255))  # ISO8601 datetime string
    is_active = Column(Boolean, nullable=False, default=True)
    source = Column(String(50), nullable=False, default="general")  # general or private
    owner = Column(String(255))
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
        UniqueConstraint("name", "source", name="uq_credentials_name_source"),
        Index("idx_credentials_source", "source"),
        Index("idx_credentials_owner", "owner"),
    )


class LoginCredential(Base):
    __tablename__ = "login_credentials"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    username = Column(String(255), nullable=False)
    password_encrypted = Column(LargeBinary, nullable=False)
    description = Column(Text)
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
        Index("idx_login_credentials_name", "name"),
        Index("idx_login_credentials_active", "is_active"),
    )


class SNMPMapping(Base):
    __tablename__ = "snmp_mapping"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, unique=True)
    snmp_community = Column(String(255))
    snmp_version = Column(String(10), nullable=False)  # 'v1', 'v2c', or 'v3'
    snmp_v3_user = Column(String(255))
    snmp_v3_auth_protocol = Column(String(50))
    snmp_v3_auth_password_encrypted = Column(LargeBinary)
    snmp_v3_priv_protocol = Column(String(50))
    snmp_v3_priv_password_encrypted = Column(LargeBinary)
    description = Column(Text)
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
        Index("idx_snmp_mapping_version", "snmp_version"),
        Index("idx_snmp_mapping_active", "is_active"),
    )
