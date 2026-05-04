"""Default value dataclasses for all settings domains."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

__all__ = [
    "NautobotSettings",
    "GitSettings",
    "CheckMKSettings",
    "CacheSettings",
    "CelerySettings",
    "NautobotDefaults",
    "AgentsSettings",
]


@dataclass
class NautobotSettings:
    url: str = "http://localhost:8080"
    token: str = ""
    timeout: int = 30
    verify_ssl: bool = True


@dataclass
class GitSettings:
    repo_url: str = ""
    branch: str = "main"
    username: str = ""
    token: str = ""
    config_path: str = "configs/"
    sync_interval: int = 15
    verify_ssl: bool = True


@dataclass
class CheckMKSettings:
    url: str = ""
    site: str = ""
    username: str = ""
    password: str = ""
    verify_ssl: bool = True


@dataclass
class CacheSettings:
    enabled: bool = True
    ttl_seconds: int = 600
    prefetch_on_startup: bool = True
    refresh_interval_minutes: int = 15  # DEPRECATED: Use Celery Beat intervals
    max_commits: int = 500
    prefetch_items: Optional[Dict[str, bool]] = None
    devices_cache_interval_minutes: int = 60
    locations_cache_interval_minutes: int = 10
    git_commits_cache_interval_minutes: int = 15


@dataclass
class CelerySettings:
    """
    Celery task queue settings.

    Queue System:
    -------------
    - Built-in queues (default, backup, network, heavy) are hardcoded in celery_app.py
    - Built-in queues have automatic task routing and cannot be deleted
    - Custom queues can be added here for documentation purposes
    - To use custom queues, configure CELERY_WORKER_QUEUE env var in docker-compose.yml
    - Tasks must be manually routed to custom queues: task.apply_async(queue='custom')

    Example: Adding a "monitoring" queue
    1. Add queue here: {"name": "monitoring", "description": "...", "built_in": false}
    2. Update docker-compose.yml: CELERY_WORKER_QUEUE=monitoring
    3. Route tasks: monitoring_task.apply_async(queue='monitoring')
    """

    max_workers: int = 4
    cleanup_enabled: bool = True
    cleanup_interval_hours: int = 6
    cleanup_age_hours: int = 24
    client_data_cleanup_enabled: bool = True
    client_data_cleanup_interval_hours: int = 24
    client_data_cleanup_age_hours: int = 168
    result_expires_hours: int = 24
    queues: List[Dict[str, Any]] = field(
        default_factory=lambda: [
            {
                "name": "default",
                "description": "Default queue for general tasks",
                "built_in": True,
            },
            {
                "name": "backup",
                "description": "Queue for device backup operations",
                "built_in": True,
            },
            {
                "name": "network",
                "description": "Queue for network scanning and discovery tasks",
                "built_in": True,
            },
            {
                "name": "heavy",
                "description": "Queue for bulk operations and heavy processing tasks",
                "built_in": True,
            },
        ]
    )


@dataclass
class NautobotDefaults:
    location: str = ""
    platform: str = ""
    interface_status: str = ""
    device_status: str = ""
    ip_address_status: str = ""
    ip_prefix_status: str = ""
    namespace: str = ""
    device_role: str = ""
    secret_group: str = ""
    csv_delimiter: str = ","
    csv_quote_char: str = '"'


@dataclass
class AgentsSettings:
    deployment_method: str = "local"
    local_root_path: str = ""
    sftp_hostname: str = ""
    sftp_port: int = 22
    sftp_path: str = ""
    sftp_username: str = ""
    sftp_password: str = ""
    use_global_credentials: bool = False
    global_credential_id: Optional[int] = None
    git_repository_id: Optional[int] = None
    agents: Optional[List] = None
