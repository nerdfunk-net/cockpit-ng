from sqlalchemy import Boolean, Column, DateTime, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.sql import func

from core.database import Base


class Setting(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(255), nullable=False, index=True)
    key = Column(String(255), nullable=False)
    value = Column(Text)
    value_type = Column(String(50), nullable=False, default="string")
    description = Column(Text)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (UniqueConstraint("category", "key", name="uix_category_key"),)


class NautobotSetting(Base):
    """Nautobot connection settings."""

    __tablename__ = "nautobot_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    url = Column(String(500), nullable=False)
    token = Column(String(500), nullable=False)
    timeout = Column(Integer, nullable=False, default=30)
    verify_ssl = Column(Boolean, nullable=False, default=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class GitSetting(Base):
    """Git repository settings for configs."""

    __tablename__ = "git_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    repo_url = Column(String(500), nullable=False)
    branch = Column(String(255), nullable=False, default="main")
    username = Column(String(255))
    token = Column(String(500))
    config_path = Column(String(500), nullable=False, default="configs/")
    sync_interval = Column(Integer, nullable=False, default=15)
    verify_ssl = Column(Boolean, nullable=False, default=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class CheckMKSetting(Base):
    """CheckMK connection settings."""

    __tablename__ = "checkmk_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    url = Column(String(500), nullable=False)
    site = Column(String(255), nullable=False)
    username = Column(String(255), nullable=False)
    password = Column(String(500), nullable=False)
    verify_ssl = Column(Boolean, nullable=False, default=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class AgentsSetting(Base):
    """Agents deployment settings."""

    __tablename__ = "agents_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    deployment_method = Column(
        String(50), nullable=False, default="local"
    )  # local, sftp, git
    # Local deployment
    local_root_path = Column(String(1000))
    # SFTP deployment
    sftp_hostname = Column(String(500))
    sftp_port = Column(Integer, default=22)
    sftp_path = Column(String(1000))
    sftp_username = Column(String(255))
    sftp_password = Column(String(500))
    use_global_credentials = Column(Boolean, default=False)
    global_credential_id = Column(Integer)
    # Git deployment
    git_repository_id = Column(Integer)
    # Agents array
    agents = Column(JSON, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class CacheSetting(Base):
    """Cache configuration for Git data and Nautobot resources."""

    __tablename__ = "cache_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    enabled = Column(Boolean, nullable=False, default=True)
    ttl_seconds = Column(Integer, nullable=False, default=600)
    prefetch_on_startup = Column(Boolean, nullable=False, default=True)
    refresh_interval_minutes = Column(
        Integer, nullable=False, default=15
    )  # DEPRECATED: No longer used
    max_commits = Column(Integer, nullable=False, default=500)
    prefetch_items = Column(Text)  # JSON string
    # Cache task intervals (in minutes) - 0 means disabled
    devices_cache_interval_minutes = Column(Integer, nullable=False, default=60)
    locations_cache_interval_minutes = Column(Integer, nullable=False, default=10)
    git_commits_cache_interval_minutes = Column(Integer, nullable=False, default=15)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class NautobotDefault(Base):
    """Default values for Nautobot device creation."""

    __tablename__ = "nautobot_defaults"

    id = Column(Integer, primary_key=True, autoincrement=True)
    location = Column(String(255))
    platform = Column(String(255))
    interface_status = Column(String(255))
    device_status = Column(String(255))
    ip_address_status = Column(String(255))
    ip_prefix_status = Column(String(255))
    namespace = Column(String(255))
    device_role = Column(String(255))
    secret_group = Column(String(255))
    csv_delimiter = Column(String(10), default=",")
    csv_quote_char = Column(String(10), default='"')
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class CelerySetting(Base):
    """Celery task queue settings."""

    __tablename__ = "celery_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    # Worker settings (require restart to take effect)
    max_workers = Column(Integer, nullable=False, default=4)
    # Cleanup settings
    cleanup_enabled = Column(Boolean, nullable=False, default=True)
    cleanup_interval_hours = Column(
        Integer, nullable=False, default=6
    )  # Run cleanup every 6 hours
    cleanup_age_hours = Column(
        Integer, nullable=False, default=24
    )  # Remove data older than 24 hours
    # Client data cleanup settings
    client_data_cleanup_enabled = Column(Boolean, nullable=False, default=True)
    client_data_cleanup_interval_hours = Column(
        Integer, nullable=False, default=24
    )  # Run cleanup every 24 hours
    client_data_cleanup_age_hours = Column(
        Integer, nullable=False, default=168
    )  # Remove client data older than 7 days
    # Result expiry
    result_expires_hours = Column(Integer, nullable=False, default=24)
    # Queue configuration - stores list of configured queues as JSON
    # Format: [{"name": "backup", "description": "Backup queue for device configs"}, ...]
    queues = Column(Text, nullable=True)  # JSON array of queue objects
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class SettingsMetadata(Base):
    """Settings metadata for versioning and status."""

    __tablename__ = "settings_metadata"

    key = Column(String(255), primary_key=True)
    value = Column(Text)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
