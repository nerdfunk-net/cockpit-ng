"""
SQLAlchemy models for all database tables.
Defines the schema for PostgreSQL database.
"""

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    Index,
    LargeBinary,
)
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func
from core.database import Base


# ============================================================================
# User Management Models
# ============================================================================


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(255), unique=True, nullable=False, index=True)
    realname = Column(String(255), nullable=False)
    email = Column(String(255))
    password = Column(String(255), nullable=False)
    permissions = Column(Integer, nullable=False, default=1)
    debug = Column(Boolean, nullable=False, default=False)
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
    user_roles = relationship(
        "UserRole", back_populates="user", cascade="all, delete-orphan"
    )
    user_permissions = relationship(
        "UserPermission", back_populates="user", cascade="all, delete-orphan"
    )


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(255), unique=True, nullable=False, index=True)
    realname = Column(String(255))
    email = Column(String(255))
    debug_mode = Column(Boolean, nullable=False, default=False)
    api_key = Column(String(255))
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


# ============================================================================
# RBAC Models
# ============================================================================


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


# ============================================================================
# Settings Models
# ============================================================================


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


# ============================================================================
# Credentials Models
# ============================================================================


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


# ============================================================================
# Git Repository Models
# ============================================================================


class GitRepository(Base):
    __tablename__ = "git_repositories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False)
    category = Column(
        String(50), nullable=False
    )  # configs, templates, onboarding, inventory
    url = Column(String(1000), nullable=False)
    branch = Column(String(255), nullable=False, default="main")
    auth_type = Column(
        String(50), nullable=False, default="token"
    )  # token, ssh_key, none
    credential_name = Column(String(255))
    path = Column(String(1000))
    verify_ssl = Column(Boolean, nullable=False, default=True)
    git_author_name = Column(String(255))  # Git user.name for commits
    git_author_email = Column(String(255))  # Git user.email for commits
    description = Column(Text)
    is_active = Column(Boolean, nullable=False, default=True)
    last_sync = Column(DateTime(timezone=True))
    sync_status = Column(String(255))
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
        Index("idx_git_repos_category", "category"),
        Index("idx_git_repos_active", "is_active"),
    )


# ============================================================================
# Job Models
# ============================================================================


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    job_type = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False, default="pending")
    progress = Column(Integer, nullable=False, default=0)
    message = Column(Text)
    result = Column(Text)  # JSON string
    created_by = Column(String(255))
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))

    __table_args__ = (
        Index("idx_jobs_status", "status"),
        Index("idx_jobs_type", "job_type"),
        Index("idx_jobs_created_at", "created_at"),
    )


class JobSchedule(Base):
    __tablename__ = "job_schedules"

    id = Column(Integer, primary_key=True, index=True)
    job_identifier = Column(String(255), nullable=False, index=True)
    job_template_id = Column(Integer, ForeignKey("job_templates.id"), nullable=False)
    schedule_type = Column(String(50), nullable=False)
    cron_expression = Column(String(255))
    interval_minutes = Column(Integer)
    start_time = Column(String(50))
    start_date = Column(String(50))
    is_active = Column(Boolean, nullable=False, default=True)
    is_global = Column(Boolean, nullable=False, default=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    credential_id = Column(Integer)
    job_parameters = Column(Text)  # JSON string
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    last_run = Column(DateTime(timezone=True))
    next_run = Column(DateTime(timezone=True))

    # Relationship to JobTemplate
    template = relationship(
        "JobTemplate", backref=backref("schedules", cascade="all, delete-orphan")
    )


class JobTemplate(Base):
    """Job templates define reusable job configurations"""

    __tablename__ = "job_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    job_type = Column(
        String(50), nullable=False
    )  # backup, compare_devices, run_commands, cache_devices, sync_devices
    description = Column(Text)
    config_repository_id = Column(
        Integer
    )  # Reference to git repository for config (type=config)
    inventory_source = Column(
        String(50), nullable=False, default="all"
    )  # all, inventory
    inventory_repository_id = Column(
        Integer
    )  # Reference to git repository for inventory
    inventory_name = Column(String(255))  # Name of the stored inventory
    command_template_name = Column(
        String(255)
    )  # Name of command template (for run_commands)
    backup_running_config_path = Column(
        String(500)
    )  # Path template for running config backups (supports Nautobot variables)
    backup_startup_config_path = Column(
        String(500)
    )  # Path template for startup config backups (supports Nautobot variables)
    write_timestamp_to_custom_field = Column(
        Boolean, nullable=False, default=False
    )  # Whether to write backup timestamp to a Nautobot custom field
    timestamp_custom_field_name = Column(
        String(255)
    )  # Name of the Nautobot custom field to write the timestamp to
    activate_changes_after_sync = Column(
        Boolean, nullable=False, default=True
    )  # Whether to activate CheckMK changes after sync_devices job completes
    scan_resolve_dns = Column(
        Boolean, nullable=False, default=False
    )  # Whether to resolve DNS names during network scanning (scan_prefixes type)
    scan_ping_count = Column(Integer)  # Number of ping attempts (scan_prefixes type)
    scan_timeout_ms = Column(
        Integer
    )  # Timeout in milliseconds for network operations (scan_prefixes type)
    scan_retries = Column(
        Integer
    )  # Number of retry attempts for failed operations (scan_prefixes type)
    scan_interval_ms = Column(
        Integer
    )  # Interval in milliseconds between scan operations (scan_prefixes type)
    scan_custom_field_name = Column(
        String(255)
    )  # Name of custom field for prefix selection (scan_prefixes type)
    scan_custom_field_value = Column(
        String(255)
    )  # Value of custom field to filter prefixes (scan_prefixes type)
    scan_response_custom_field_name = Column(
        String(255)
    )  # Name of custom field to write scan results to (scan_prefixes type)
    scan_max_ips = Column(
        Integer
    )  # Maximum number of IPs to scan per job (scan_prefixes type)
    parallel_tasks = Column(
        Integer, nullable=False, default=1
    )  # Number of parallel tasks for backup execution (backup type)
    is_global = Column(Boolean, nullable=False, default=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    created_by = Column(String(255))  # Username of creator
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
        Index("idx_job_templates_type", "job_type"),
        Index("idx_job_templates_user", "user_id"),
    )


class JobRun(Base):
    """Tracks individual job executions"""

    __tablename__ = "job_runs"

    id = Column(Integer, primary_key=True, index=True)
    job_schedule_id = Column(
        Integer,
        ForeignKey("job_schedules.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    job_template_id = Column(
        Integer,
        ForeignKey("job_templates.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    celery_task_id = Column(String(255), unique=True, index=True)  # Celery task UUID

    # Job info snapshot (in case template/schedule is deleted)
    job_name = Column(
        String(255), nullable=False
    )  # Snapshot of schedule's job_identifier
    job_type = Column(String(50), nullable=False)  # Snapshot of template's job_type

    # Execution status
    status = Column(
        String(50), nullable=False, default="pending", index=True
    )  # pending, running, completed, failed, cancelled
    triggered_by = Column(
        String(50), nullable=False, default="schedule"
    )  # schedule, manual

    # Timing
    queued_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))

    # Results
    error_message = Column(Text)
    result = Column(Text)  # JSON string for structured results

    # Execution context snapshot
    target_devices = Column(Text)  # JSON array of device names targeted
    executed_by = Column(String(255))  # Username who triggered (for manual runs)

    # Relationships
    schedule = relationship("JobSchedule", backref="runs")
    template = relationship("JobTemplate", backref="runs")

    __table_args__ = (
        Index("idx_job_runs_status", "status"),
        Index("idx_job_runs_queued_at", "queued_at"),
        Index("idx_job_runs_triggered_by", "triggered_by"),
    )


# ============================================================================
# NB2CMK Models
# ============================================================================


class NB2CMKSync(Base):
    __tablename__ = "nb2cmk_sync"

    id = Column(Integer, primary_key=True, index=True)
    sync_type = Column(String(50), nullable=False)
    status = Column(String(50), nullable=False, default="pending")
    message = Column(Text)
    devices_processed = Column(Integer, default=0)
    devices_succeeded = Column(Integer, default=0)
    devices_failed = Column(Integer, default=0)
    started_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at = Column(DateTime(timezone=True))

    __table_args__ = (
        Index("idx_nb2cmk_sync_status", "status"),
        Index("idx_nb2cmk_sync_type", "sync_type"),
    )


# ============================================================================
# Compliance Models
# ============================================================================


class ComplianceRule(Base):
    __tablename__ = "compliance_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False)
    description = Column(Text)
    rule_type = Column(String(100), nullable=False)
    pattern = Column(Text, nullable=False)
    severity = Column(String(50), nullable=False, default="medium")
    is_active = Column(Boolean, nullable=False, default=True)
    tags = Column(Text)  # JSON string
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
    checks = relationship(
        "ComplianceCheck", back_populates="rule", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_compliance_rules_type", "rule_type"),
        Index("idx_compliance_rules_active", "is_active"),
    )


class ComplianceCheck(Base):
    __tablename__ = "compliance_checks"

    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(
        Integer, ForeignKey("compliance_rules.id", ondelete="CASCADE"), nullable=False
    )
    device_name = Column(String(255), nullable=False)
    config_file = Column(String(1000))
    status = Column(String(50), nullable=False)
    message = Column(Text)
    checked_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    rule = relationship("ComplianceRule", back_populates="checks")

    __table_args__ = (
        Index("idx_compliance_checks_rule", "rule_id"),
        Index("idx_compliance_checks_device", "device_name"),
        Index("idx_compliance_checks_status", "status"),
    )


class RegexPattern(Base):
    __tablename__ = "regex_patterns"

    id = Column(Integer, primary_key=True, index=True)
    pattern = Column(Text, nullable=False)
    description = Column(Text)
    pattern_type = Column(
        String(50), nullable=False
    )  # 'must_match' or 'must_not_match'
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
        Index("idx_regex_patterns_type", "pattern_type"),
        Index("idx_regex_patterns_active", "is_active"),
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


# ============================================================================
# NB2CMK Job Tracking Models
# ============================================================================


class NB2CMKJob(Base):
    """NB2CMK background job tracking."""

    __tablename__ = "nb2cmk_jobs"

    job_id = Column(String(255), primary_key=True)
    status = Column(
        String(50), nullable=False
    )  # pending, running, completed, failed, cancelled
    created_at = Column(DateTime(timezone=True), nullable=False)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    total_devices = Column(Integer, default=0, nullable=False)
    processed_devices = Column(Integer, default=0, nullable=False)
    progress_message = Column(Text, default="")
    user_id = Column(String(255))
    error_message = Column(Text)

    # Relationship to job results
    results = relationship(
        "NB2CMKJobResult", back_populates="job", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_nb2cmk_jobs_created_at", "created_at"),
        Index("idx_nb2cmk_jobs_status", "status"),
    )


class NB2CMKJobResult(Base):
    """Individual device comparison result within a NB2CMK job."""

    __tablename__ = "nb2cmk_job_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(
        String(255),
        ForeignKey("nb2cmk_jobs.job_id", ondelete="CASCADE"),
        nullable=False,
    )
    device_id = Column(String(255), nullable=False)
    device_name = Column(String(255), nullable=False)
    checkmk_status = Column(String(50), nullable=False)  # equal, diff, missing, error
    diff = Column(Text)
    normalized_config = Column(Text)  # JSON
    checkmk_config = Column(Text)  # JSON
    ignored_attributes = Column(Text)  # JSON array of ignored attribute names
    processed_at = Column(DateTime(timezone=True), nullable=False)

    # Relationship to job
    job = relationship("NB2CMKJob", back_populates="results")

    __table_args__ = (
        Index("idx_nb2cmk_job_results_job_id", "job_id"),
        Index("idx_nb2cmk_job_results_device_id", "device_id"),
    )


# ============================================================================
# Template Management Models
# ============================================================================


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
    pre_run_command = Column(
        Text
    )  # Command to execute before rendering (output available as context)

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


# ============================================================================
# Settings Models
# ============================================================================


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


class CacheSetting(Base):
    """Cache configuration for Git data and Nautobot resources."""

    __tablename__ = "cache_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    enabled = Column(Boolean, nullable=False, default=True)
    ttl_seconds = Column(Integer, nullable=False, default=600)
    prefetch_on_startup = Column(Boolean, nullable=False, default=True)
    refresh_interval_minutes = Column(Integer, nullable=False, default=15)
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
    # Result expiry
    result_expires_hours = Column(Integer, nullable=False, default=24)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class DeviceOffboardingSetting(Base):
    """Device offboarding settings."""

    __tablename__ = "device_offboarding_settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    remove_all_custom_fields = Column(Boolean, nullable=False, default=False)
    clear_device_name = Column(Boolean, nullable=False, default=False)
    keep_serial = Column(Boolean, nullable=False, default=False)
    location_id = Column(String(255))
    status_id = Column(String(255))
    role_id = Column(String(255))
    custom_field_settings = Column(Text)  # JSON string
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


# ============================================================================
# Ansible Inventory Models
# ============================================================================


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
    )
