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
from sqlalchemy.orm import backref
from sqlalchemy.sql import func

from core.database import Base


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
    scan_set_reachable_ip_active = Column(
        Boolean, nullable=False, default=True
    )  # Whether to set reachable IPs to Active status (scan_prefixes type)
    scan_max_ips = Column(
        Integer
    )  # Maximum number of IPs to scan per job (scan_prefixes type)
    parallel_tasks = Column(
        Integer, nullable=False, default=1
    )  # Number of parallel tasks for backup execution (backup type)
    deploy_template_id = Column(
        Integer, nullable=True
    )  # ID of the agent template to deploy (deploy_agent type)
    deploy_agent_id = Column(
        String(255), nullable=True
    )  # ID of the agent to deploy to (deploy_agent type)
    deploy_path = Column(
        String(500), nullable=True
    )  # File path for deployment (deploy_agent type)
    deploy_custom_variables = Column(
        Text, nullable=True
    )  # JSON string of user variable overrides (deploy_agent type)
    deploy_templates = Column(
        Text, nullable=True
    )  # JSON array of template entries [{template_id, inventory_id, path, custom_variables}] (deploy_agent type)
    activate_after_deploy = Column(
        Boolean, nullable=False, default=True
    )  # Whether to activate (pull and restart) the agent after deployment (deploy_agent type)
    # Maintain IP-Addresses (ip_addresses type)
    ip_action = Column(String(50), nullable=True)  # "list", "mark", "remove"
    ip_filter_field = Column(String(255), nullable=True)  # e.g. "cf_last_scan"
    ip_filter_type = Column(String(50), nullable=True)  # e.g. "lte", None for equality
    ip_filter_value = Column(String(255), nullable=True)  # e.g. "2026-02-19"
    ip_include_null = Column(Boolean, nullable=False, default=False)
    # Mark action options (only relevant when ip_action == "mark")
    ip_mark_status = Column(String(255), nullable=True)  # Nautobot status UUID
    ip_mark_tag = Column(String(255), nullable=True)  # Nautobot tag UUID
    ip_mark_description = Column(Text, nullable=True)  # Description to write
    # CSV Import (csv_import type)
    csv_import_repo_id = Column(Integer, nullable=True)
    csv_import_file_path = Column(String(500), nullable=True)
    csv_import_type = Column(
        String(50), nullable=True
    )  # "devices" | "ip-prefixes" | "ip-addresses"
    csv_import_primary_key = Column(String(255), nullable=True)
    csv_import_update_existing = Column(Boolean, nullable=False, default=True)
    csv_import_delimiter = Column(String(10), nullable=True)
    csv_import_quote_char = Column(String(10), nullable=True)
    csv_import_column_mapping = Column(
        Text, nullable=True
    )  # JSON: {"csv_col": "nautobot_field" | null}
    csv_import_file_filter = Column(
        String(255), nullable=True
    )  # glob pattern like "*.csv"
    csv_import_defaults = Column(
        Text, nullable=True
    )  # JSON: {"location": "Amsterdam", ...}
    csv_import_format = Column(
        String(50), nullable=True
    )  # "cockpit", "nautobot", "generic"
    csv_import_add_prefixes = Column(
        Boolean, nullable=True, default=False
    )  # auto-create missing prefixes
    csv_import_default_prefix_length = Column(
        String(10), nullable=True
    )  # e.g. "24" applied when IP has no mask
    # CSV Export (csv_export type)
    csv_export_repo_id = Column(Integer, nullable=True)
    csv_export_file_path = Column(String(500), nullable=True)
    csv_export_properties = Column(Text, nullable=True)  # JSON list of property names
    csv_export_delimiter = Column(String(10), nullable=True)
    csv_export_quote_char = Column(String(10), nullable=True)
    csv_export_include_headers = Column(Boolean, nullable=True, default=True)
    # Ping Agent (ping_agent type)
    ping_agent_id = Column(
        String(255), nullable=True
    )  # ID of the cockpit agent to ping through
    # Set Primary IP (set_primary_ip type)
    set_primary_ip_strategy = Column(
        String(50), nullable=True
    )  # "ip_reachable" or "interface_name"
    set_primary_ip_agent_id = Column(
        String(255), nullable=True
    )  # cockpit agent ID used for reachability ping
    # Get Client Data (get_client_data type)
    collect_ip_address = Column(
        Boolean, nullable=False, default=True
    )  # Collect IP addresses from ARP table (get_client_data type)
    collect_mac_address = Column(
        Boolean, nullable=False, default=True
    )  # Collect MAC addresses from MAC address table (get_client_data type)
    collect_hostname = Column(
        Boolean, nullable=False, default=True
    )  # Resolve hostnames via DNS (get_client_data type)
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
