"""
Settings Database Management for Cockpit
Handles PostgreSQL database operations for application settings
"""

import os
import logging
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, asdict, field
import json
import yaml
from repositories.settings.settings_repository import (
    NautobotSettingRepository,
    GitSettingRepository,
    CheckMKSettingRepository,
    CacheSettingRepository,
    CelerySettingRepository,
    NautobotDefaultRepository,
    DeviceOffboardingSettingRepository,
    SettingsMetadataRepository,
)

# Import config to get environment variable defaults
try:
    from config import settings as env_settings
except ImportError:
    env_settings = None

logger = logging.getLogger(__name__)


@dataclass
class NautobotSettings:
    """Nautobot connection settings"""

    url: str = "http://localhost:8080"  # More common Nautobot port
    token: str = ""  # Must be configured by user
    timeout: int = 30
    verify_ssl: bool = True


@dataclass
class GitSettings:
    """Git repository settings for configs"""

    repo_url: str = ""
    branch: str = "main"
    username: str = ""
    token: str = ""
    config_path: str = "configs/"
    sync_interval: int = 15
    verify_ssl: bool = True


@dataclass
class CheckMKSettings:
    """CheckMK connection settings"""

    url: str = ""  # Must be configured by user
    site: str = ""  # Must be configured by user
    username: str = ""  # Must be configured by user
    password: str = ""  # Must be configured by user
    verify_ssl: bool = True


@dataclass
class CacheSettings:
    """Cache configuration for Git data and Nautobot resources"""

    enabled: bool = True
    ttl_seconds: int = 600  # 10 minutes
    prefetch_on_startup: bool = True
    refresh_interval_minutes: int = 15  # DEPRECATED: Use Celery Beat intervals instead
    max_commits: int = 500  # limit per branch
    # Map of items to prefetch on startup, e.g., {"git": true, "locations": false}
    prefetch_items: Dict[str, bool] = None

    # Cache task intervals (in minutes) - 0 means disabled
    devices_cache_interval_minutes: int = 60  # Cache devices every hour
    locations_cache_interval_minutes: int = 10  # Cache locations every 10 minutes
    git_commits_cache_interval_minutes: int = 15  # Cache git commits every 15 minutes


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

    max_workers: int = 4  # Worker concurrency (requires restart)
    cleanup_enabled: bool = True  # Enable automatic cleanup
    cleanup_interval_hours: int = 6  # Run cleanup every 6 hours
    cleanup_age_hours: int = 24  # Remove data older than 24 hours
    result_expires_hours: int = 24  # Celery result expiry
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
    )  # Queue configuration: [{"name": "backup", "description": "...", "built_in": true}]


@dataclass
class NautobotDefaults:
    """Default values for Nautobot device creation"""

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
class DeviceOffboardingSettings:
    """Device offboarding settings"""

    remove_all_custom_fields: bool = False
    clear_device_name: bool = False
    keep_serial: bool = False
    location_id: Optional[str] = None
    status_id: Optional[str] = None
    role_id: Optional[str] = None
    custom_field_settings: Dict[str, str] = field(default_factory=dict)


@dataclass
@dataclass
class AgentsSettings:
    """Agents deployment settings"""

    deployment_method: str = "local"  # local, sftp, or git
    # Local deployment
    local_root_path: str = ""
    # SFTP deployment
    sftp_hostname: str = ""
    sftp_port: int = 22
    sftp_path: str = ""
    sftp_username: str = ""
    sftp_password: str = ""
    use_global_credentials: bool = False
    global_credential_id: Optional[int] = None
    # Git deployment
    git_repository_id: Optional[int] = None
    # Agents array
    agents: Optional[List] = None


class SettingsManager:
    """Manages application settings in PostgreSQL database"""

    def __init__(self):
        # Use environment settings as defaults if available
        if env_settings:
            self.default_nautobot = NautobotSettings(
                url=env_settings.nautobot_url,
                token=env_settings.nautobot_token,
                timeout=env_settings.nautobot_timeout,
                verify_ssl=True,
            )
        else:
            self.default_nautobot = NautobotSettings()

        self.default_git = GitSettings()
        self.default_checkmk = CheckMKSettings()
        self.default_agents = AgentsSettings()
        self.default_nautobot_defaults = NautobotDefaults()
        self.default_cache = CacheSettings()
        self.default_celery = CelerySettings()

        # PostgreSQL tables are created by alembic/SQLAlchemy
        # No database initialization needed

    def get_nautobot_settings(self) -> Optional[Dict[str, Any]]:
        """Get current Nautobot settings"""
        try:
            repo = NautobotSettingRepository()
            settings = repo.get_settings()

            if settings:
                return {
                    "url": settings.url,
                    "token": settings.token,
                    "timeout": settings.timeout,
                    "verify_ssl": settings.verify_ssl,
                }
            else:
                # Fallback to defaults
                return asdict(self.default_nautobot)

        except Exception as e:
            logger.error("Error getting Nautobot settings: %s", e)
            return asdict(self.default_nautobot)

    def get_git_settings(self) -> Optional[Dict[str, Any]]:
        """Get current Git settings"""
        try:
            repo = GitSettingRepository()
            settings = repo.get_settings()

            if settings:
                return {
                    "repo_url": settings.repo_url,
                    "branch": settings.branch,
                    "username": settings.username or "",
                    "token": settings.token or "",
                    "config_path": settings.config_path,
                    "sync_interval": settings.sync_interval,
                    "verify_ssl": settings.verify_ssl,
                }
            else:
                # Fallback to defaults
                return asdict(self.default_git)

        except Exception as e:
            logger.error("Error getting Git settings: %s", e)
            return asdict(self.default_git)

    def get_checkmk_settings(self) -> Optional[Dict[str, Any]]:
        """Get current CheckMK settings"""
        try:
            repo = CheckMKSettingRepository()
            settings = repo.get_settings()

            if settings:
                return {
                    "url": settings.url,
                    "site": settings.site,
                    "username": settings.username,
                    "password": settings.password,
                    "verify_ssl": settings.verify_ssl,
                }
            else:
                # Fallback to defaults
                return asdict(self.default_checkmk)

        except Exception as e:
            logger.error("Error getting CheckMK settings: %s", e)
            return asdict(self.default_checkmk)

    def get_agents_settings(self) -> Optional[Dict[str, Any]]:
        """Get current Agents settings"""
        try:
            from repositories.settings.settings_repository import (
                AgentsSettingRepository,
            )

            repo = AgentsSettingRepository()
            settings = repo.get_settings()

            if settings:
                return {
                    "deployment_method": settings.deployment_method,
                    "local_root_path": settings.local_root_path,
                    "sftp_hostname": settings.sftp_hostname,
                    "sftp_port": settings.sftp_port,
                    "sftp_path": settings.sftp_path,
                    "sftp_username": settings.sftp_username,
                    "sftp_password": settings.sftp_password,
                    "use_global_credentials": settings.use_global_credentials,
                    "global_credential_id": settings.global_credential_id,
                    "git_repository_id": settings.git_repository_id,
                    "agents": settings.agents if settings.agents else [],
                }
            else:
                # Fallback to defaults
                defaults = asdict(self.default_agents)
                defaults["agents"] = []
                return defaults

        except Exception as e:
            logger.error("Error getting Agents settings: %s", e)
            defaults = asdict(self.default_agents)
            defaults["agents"] = []
            return defaults

    def get_all_settings(self) -> Dict[str, Any]:
        """Get all settings combined"""
        return {
            "nautobot": self.get_nautobot_settings(),
            "git": self.get_git_settings(),
            "checkmk": self.get_checkmk_settings(),
            "cache": self.get_cache_settings(),
            "metadata": self._get_metadata(),
        }

    def get_cache_settings(self) -> Dict[str, Any]:
        """Get current Cache settings"""
        try:
            repo = CacheSettingRepository()
            settings = repo.get_settings()

            if settings:
                return {
                    "enabled": settings.enabled,
                    "ttl_seconds": settings.ttl_seconds,
                    "prefetch_on_startup": settings.prefetch_on_startup,
                    "refresh_interval_minutes": settings.refresh_interval_minutes,
                    "max_commits": settings.max_commits,
                    "prefetch_items": json.loads(settings.prefetch_items)
                    if settings.prefetch_items
                    else {"git": True, "locations": False},
                    "devices_cache_interval_minutes": getattr(
                        settings,
                        "devices_cache_interval_minutes",
                        self.default_cache.devices_cache_interval_minutes,
                    ),
                    "locations_cache_interval_minutes": getattr(
                        settings,
                        "locations_cache_interval_minutes",
                        self.default_cache.locations_cache_interval_minutes,
                    ),
                    "git_commits_cache_interval_minutes": getattr(
                        settings,
                        "git_commits_cache_interval_minutes",
                        self.default_cache.git_commits_cache_interval_minutes,
                    ),
                }
            return asdict(self.default_cache)
        except Exception as e:
            logger.error("Error getting Cache settings: %s", e)
            return asdict(self.default_cache)

    def update_cache_settings(self, settings: Dict[str, Any]) -> bool:
        """Update Cache settings"""
        try:
            repo = CacheSettingRepository()
            existing = repo.get_settings()

            prefetch_items_json = json.dumps(
                settings.get("prefetch_items") or {"git": True, "locations": False}
            )

            update_kwargs = {
                "enabled": settings.get("enabled", self.default_cache.enabled),
                "ttl_seconds": settings.get(
                    "ttl_seconds", self.default_cache.ttl_seconds
                ),
                "prefetch_on_startup": settings.get(
                    "prefetch_on_startup", self.default_cache.prefetch_on_startup
                ),
                "refresh_interval_minutes": settings.get(
                    "refresh_interval_minutes",
                    self.default_cache.refresh_interval_minutes,
                ),
                "max_commits": settings.get(
                    "max_commits", self.default_cache.max_commits
                ),
                "prefetch_items": prefetch_items_json,
                "devices_cache_interval_minutes": settings.get(
                    "devices_cache_interval_minutes",
                    self.default_cache.devices_cache_interval_minutes,
                ),
                "locations_cache_interval_minutes": settings.get(
                    "locations_cache_interval_minutes",
                    self.default_cache.locations_cache_interval_minutes,
                ),
                "git_commits_cache_interval_minutes": settings.get(
                    "git_commits_cache_interval_minutes",
                    self.default_cache.git_commits_cache_interval_minutes,
                ),
            }

            if existing:
                repo.update(existing.id, **update_kwargs)
            else:
                repo.create(**update_kwargs)

            logger.info("Cache settings updated successfully")
            return True
        except Exception as e:
            logger.error("Error updating Cache settings: %s", e)
            return False

    def get_celery_settings(self) -> Dict[str, Any]:
        """Get current Celery settings"""
        try:
            repo = CelerySettingRepository()
            settings = repo.get_settings()

            if settings:
                # Parse queues from JSON if present
                queues = []
                if settings.queues:
                    try:
                        queues = json.loads(settings.queues)
                    except json.JSONDecodeError:
                        logger.warning("Failed to parse queues JSON, using empty list")
                        queues = []

                return {
                    "max_workers": settings.max_workers,
                    "cleanup_enabled": settings.cleanup_enabled,
                    "cleanup_interval_hours": settings.cleanup_interval_hours,
                    "cleanup_age_hours": settings.cleanup_age_hours,
                    "result_expires_hours": settings.result_expires_hours,
                    "queues": queues,
                }
            return asdict(self.default_celery)
        except Exception as e:
            logger.error("Error getting Celery settings: %s", e)
            return asdict(self.default_celery)

    def update_celery_settings(self, settings: Dict[str, Any]) -> bool:
        """Update Celery settings"""
        try:
            repo = CelerySettingRepository()
            existing = repo.get_settings()

            # Serialize queues to JSON if present
            queues_json = None
            if "queues" in settings:
                queues = settings.get("queues", [])
                if queues:
                    queues_json = json.dumps(queues)

            update_kwargs = {
                "max_workers": settings.get(
                    "max_workers", self.default_celery.max_workers
                ),
                "cleanup_enabled": settings.get(
                    "cleanup_enabled", self.default_celery.cleanup_enabled
                ),
                "cleanup_interval_hours": settings.get(
                    "cleanup_interval_hours", self.default_celery.cleanup_interval_hours
                ),
                "cleanup_age_hours": settings.get(
                    "cleanup_age_hours", self.default_celery.cleanup_age_hours
                ),
                "result_expires_hours": settings.get(
                    "result_expires_hours", self.default_celery.result_expires_hours
                ),
                "queues": queues_json,
            }

            if existing:
                repo.update(existing.id, **update_kwargs)
            else:
                repo.create(**update_kwargs)

            logger.info("Celery settings updated successfully")
            return True
        except Exception as e:
            logger.error("Error updating Celery settings: %s", e)
            return False

    def ensure_builtin_queues(self) -> bool:
        """
        Ensure built-in queues (default, backup, network, heavy) exist in database.

        This is called on application startup to restore any missing built-in queues.
        Built-in queues are required for the system to function properly.

        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Define built-in queues
            BUILTIN_QUEUES = [
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

            # Get current settings
            current = self.get_celery_settings()
            current_queues = current.get("queues", [])

            # Build set of existing queue names
            existing_names = {q["name"] for q in current_queues}

            # Add missing built-in queues
            queues_added = []
            for builtin_queue in BUILTIN_QUEUES:
                if builtin_queue["name"] not in existing_names:
                    current_queues.append(builtin_queue)
                    queues_added.append(builtin_queue["name"])
                    logger.info(
                        "Restored missing built-in queue: %s", builtin_queue['name']
                    )
                else:
                    # Ensure existing built-in queue has built_in flag set
                    for q in current_queues:
                        if q["name"] == builtin_queue["name"]:
                            if not q.get("built_in"):
                                q["built_in"] = True
                                logger.info(
                                    "Set built_in flag for queue: %s", builtin_queue['name']
                                )

            # Update settings if changes were made
            if queues_added or any(
                not q.get("built_in")
                for q in current_queues
                if q["name"] in {bq["name"] for bq in BUILTIN_QUEUES}
            ):
                current["queues"] = current_queues
                success = self.update_celery_settings(current)

                if success and queues_added:
                    logger.info(
                        "Restored %s built-in queue(s): %s", len(queues_added), ', '.join(queues_added)
                    )

                return success
            else:
                logger.debug("All built-in queues present and configured correctly")
                return True

        except Exception as e:
            logger.error("Error ensuring built-in queues: %s", e)
            return False

    def update_nautobot_settings(self, settings: Dict[str, Any]) -> bool:
        """Update Nautobot settings"""
        try:
            repo = NautobotSettingRepository()
            existing = repo.get_settings()

            if existing:
                repo.update(
                    existing.id,
                    url=settings.get("url", self.default_nautobot.url),
                    token=settings.get("token", self.default_nautobot.token),
                    timeout=settings.get("timeout", self.default_nautobot.timeout),
                    verify_ssl=settings.get(
                        "verify_ssl", self.default_nautobot.verify_ssl
                    ),
                )
            else:
                repo.create(
                    url=settings.get("url", self.default_nautobot.url),
                    token=settings.get("token", self.default_nautobot.token),
                    timeout=settings.get("timeout", self.default_nautobot.timeout),
                    verify_ssl=settings.get(
                        "verify_ssl", self.default_nautobot.verify_ssl
                    ),
                )

            logger.info("Nautobot settings updated successfully")
            return True

        except Exception as e:
            logger.error("Error updating Nautobot settings: %s", e)
            return False

    def update_git_settings(self, settings: Dict[str, Any]) -> bool:
        """Update Git settings"""
        try:
            repo = GitSettingRepository()
            existing = repo.get_settings()

            if existing:
                repo.update(
                    existing.id,
                    repo_url=settings.get("repo_url", self.default_git.repo_url),
                    branch=settings.get("branch", self.default_git.branch),
                    username=settings.get("username", self.default_git.username),
                    token=settings.get("token", self.default_git.token),
                    config_path=settings.get(
                        "config_path", self.default_git.config_path
                    ),
                    sync_interval=settings.get(
                        "sync_interval", self.default_git.sync_interval
                    ),
                    verify_ssl=settings.get("verify_ssl", self.default_git.verify_ssl),
                )
            else:
                repo.create(
                    repo_url=settings.get("repo_url", self.default_git.repo_url),
                    branch=settings.get("branch", self.default_git.branch),
                    username=settings.get("username", self.default_git.username),
                    token=settings.get("token", self.default_git.token),
                    config_path=settings.get(
                        "config_path", self.default_git.config_path
                    ),
                    sync_interval=settings.get(
                        "sync_interval", self.default_git.sync_interval
                    ),
                    verify_ssl=settings.get("verify_ssl", self.default_git.verify_ssl),
                )

            logger.info("Git settings updated successfully")
            return True

        except Exception as e:
            logger.error("Error updating Git settings: %s", e)
            return False

    def update_checkmk_settings(self, settings: Dict[str, Any]) -> bool:
        """Update CheckMK settings"""
        try:
            repo = CheckMKSettingRepository()
            existing = repo.get_settings()

            update_data = {
                "url": settings.get("url", self.default_checkmk.url),
                "site": settings.get("site", self.default_checkmk.site),
                "username": settings.get("username", self.default_checkmk.username),
                "password": settings.get("password", self.default_checkmk.password),
                "verify_ssl": settings.get(
                    "verify_ssl", self.default_checkmk.verify_ssl
                ),
            }

            if existing:
                repo.update(existing.id, **update_data)
            else:
                repo.create(**update_data)

            logger.info("CheckMK settings updated successfully")
            return True

        except Exception as e:
            logger.error("Error updating CheckMK settings: %s", e)
            return False

    def update_agents_settings(self, settings: Dict[str, Any]) -> bool:
        """Update Agents settings"""
        try:
            from repositories.settings.settings_repository import (
                AgentsSettingRepository,
            )

            repo = AgentsSettingRepository()
            existing = repo.get_settings()

            update_data = {
                "deployment_method": settings.get(
                    "deployment_method", self.default_agents.deployment_method
                ),
                "local_root_path": settings.get(
                    "local_root_path", self.default_agents.local_root_path
                ),
                "sftp_hostname": settings.get(
                    "sftp_hostname", self.default_agents.sftp_hostname
                ),
                "sftp_port": settings.get("sftp_port", self.default_agents.sftp_port),
                "sftp_path": settings.get("sftp_path", self.default_agents.sftp_path),
                "sftp_username": settings.get(
                    "sftp_username", self.default_agents.sftp_username
                ),
                "sftp_password": settings.get(
                    "sftp_password", self.default_agents.sftp_password
                ),
                "use_global_credentials": settings.get(
                    "use_global_credentials",
                    self.default_agents.use_global_credentials,
                ),
                "global_credential_id": settings.get(
                    "global_credential_id", self.default_agents.global_credential_id
                ),
                "git_repository_id": settings.get(
                    "git_repository_id", self.default_agents.git_repository_id
                ),
                "agents": settings.get("agents", []),
            }

            if existing:
                repo.update(existing.id, **update_data)
            else:
                repo.create(**update_data)

            logger.info("Agents settings updated successfully")
            return True

        except Exception as e:
            logger.error("Error updating Agents settings: %s", e)
            return False

    def update_all_settings(self, settings: Dict[str, Any]) -> bool:
        """Update all settings"""
        success = True

        if "nautobot" in settings:
            success &= self.update_nautobot_settings(settings["nautobot"])

        if "git" in settings:
            success &= self.update_git_settings(settings["git"])

        if "checkmk" in settings:
            success &= self.update_checkmk_settings(settings["checkmk"])

        if "cache" in settings:
            success &= self.update_cache_settings(settings["cache"])

        return success

    def _get_metadata(self) -> Dict[str, Any]:
        """Get database metadata"""
        try:
            repo = SettingsMetadataRepository()
            schema_version = repo.get_by_key("schema_version")

            metadata = {
                "schema_version": schema_version.value if schema_version else "1.0",
                "database_type": "postgresql",
            }

            return metadata

        except Exception as e:
            logger.error("Error getting metadata: %s", e)
            return {"error": str(e)}

    def _handle_database_corruption(self) -> Dict[str, str]:
        """Handle database corruption - not applicable for PostgreSQL"""
        logger.warning(
            "Database corruption handler called - not applicable for PostgreSQL"
        )
        return {
            "status": "not_applicable",
            "message": "PostgreSQL manages corruption internally",
        }

    def reset_to_defaults(self) -> bool:
        """Reset all settings to defaults"""
        try:
            # Clear existing settings by deleting records
            from core.database import get_db_session
            from core.models import (
                NautobotSetting,
                GitSetting,
                CheckMKSetting,
                CacheSetting,
            )

            session = get_db_session()
            try:
                session.query(NautobotSetting).delete()
                session.query(GitSetting).delete()
                session.query(CheckMKSetting).delete()
                session.query(CacheSetting).delete()
                session.commit()
                logger.info("Settings reset to defaults")
                return True
            finally:
                session.close()

        except Exception as e:
            logger.error("Error resetting settings: %s", e)
            return False

    def health_check(self) -> Dict[str, Any]:
        """Check database health"""
        try:
            nautobot_repo = NautobotSettingRepository()
            git_repo = GitSettingRepository()

            nautobot_count = 1 if nautobot_repo.get_settings() else 0
            git_count = 1 if git_repo.get_settings() else 0

            return {
                "status": "healthy",
                "database_type": "postgresql",
                "nautobot_settings_count": nautobot_count,
                "git_settings_count": git_count,
            }

        except Exception as e:
            logger.error("Database health check failed: %s", e)
            return {"status": "unhealthy", "error": str(e), "recovery_needed": False}

    def get_selected_git_repository(self) -> Optional[int]:
        """Get the currently selected Git repository ID for configuration comparison."""
        try:
            repo = SettingsMetadataRepository()
            result = repo.get_by_key("selected_git_repository")
            return int(result.value) if result and result.value else None

        except Exception as e:
            logger.error("Error getting selected Git repository: %s", e)
            return None

    def set_selected_git_repository(self, repository_id: int) -> bool:
        """Set the selected Git repository ID for configuration comparison."""
        try:
            repo = SettingsMetadataRepository()
            repo.set_metadata("selected_git_repository", str(repository_id))
            logger.info("Selected Git repository set to ID: %s", repository_id)
            return True

        except Exception as e:
            logger.error("Error setting selected Git repository: %s", e)
            return False

    def get_nautobot_defaults(self) -> Dict[str, Any]:
        """Get current Nautobot defaults"""
        try:
            repo = NautobotDefaultRepository()
            settings = repo.get_defaults()

            if settings:
                return {
                    "location": settings.location,
                    "platform": settings.platform,
                    "interface_status": settings.interface_status,
                    "device_status": settings.device_status,
                    "ip_address_status": settings.ip_address_status,
                    "ip_prefix_status": settings.ip_prefix_status,
                    "namespace": settings.namespace,
                    "device_role": settings.device_role,
                    "secret_group": settings.secret_group,
                    "csv_delimiter": settings.csv_delimiter or ",",
                    "csv_quote_char": settings.csv_quote_char or '"',
                }
            else:
                # Return default values if no record exists
                return asdict(self.default_nautobot_defaults)

        except Exception as e:
            logger.error("Error getting Nautobot defaults: %s", e, exc_info=True)
            return asdict(self.default_nautobot_defaults)

    def update_nautobot_defaults(self, defaults: Dict[str, Any]) -> bool:
        """Update Nautobot defaults"""
        try:
            repo = NautobotDefaultRepository()
            existing = repo.get_defaults()

            update_data = {
                "location": defaults.get("location", ""),
                "platform": defaults.get("platform", ""),
                "interface_status": defaults.get("interface_status", ""),
                "device_status": defaults.get("device_status", ""),
                "ip_address_status": defaults.get("ip_address_status", ""),
                "ip_prefix_status": defaults.get("ip_prefix_status", ""),
                "namespace": defaults.get("namespace", ""),
                "device_role": defaults.get("device_role", ""),
                "secret_group": defaults.get("secret_group", ""),
                "csv_delimiter": defaults.get("csv_delimiter", ","),
                "csv_quote_char": defaults.get("csv_quote_char", '"'),
            }

            if existing:
                repo.update(existing.id, **update_data)
            else:
                repo.create(**update_data)

            logger.info("Nautobot defaults updated successfully")
            return True

        except Exception as e:
            logger.error("Error updating Nautobot defaults: %s", e)
            return False

    def get_device_offboarding_settings(self) -> Dict[str, Any]:
        """Get device offboarding settings"""
        try:
            repo = DeviceOffboardingSettingRepository()
            settings = repo.get_settings()

            if settings:
                custom_field_settings = settings.custom_field_settings
                if isinstance(custom_field_settings, str):
                    try:
                        custom_field_settings = (
                            json.loads(custom_field_settings)
                            if custom_field_settings
                            else {}
                        )
                    except json.JSONDecodeError:
                        custom_field_settings = {}
                elif custom_field_settings is None:
                    custom_field_settings = {}

                return {
                    "remove_all_custom_fields": bool(settings.remove_all_custom_fields),
                    "clear_device_name": bool(settings.clear_device_name),
                    "keep_serial": bool(settings.keep_serial),
                    "location_id": settings.location_id,
                    "status_id": settings.status_id,
                    "role_id": settings.role_id,
                    "custom_field_settings": custom_field_settings,
                }
            else:
                return {
                    "remove_all_custom_fields": False,
                    "clear_device_name": False,
                    "keep_serial": False,
                    "location_id": None,
                    "status_id": None,
                    "role_id": None,
                    "custom_field_settings": {},
                }

        except Exception as e:
            logger.error("Error getting device offboarding settings: %s", e)
            return {
                "remove_all_custom_fields": False,
                "clear_device_name": False,
                "keep_serial": False,
                "location_id": None,
                "status_id": None,
                "role_id": None,
                "custom_field_settings": {},
            }

    def update_device_offboarding_settings(self, settings: Dict[str, Any]) -> bool:
        """Update device offboarding settings"""
        try:
            repo = DeviceOffboardingSettingRepository()
            existing = repo.get_settings()

            custom_field_settings_json = json.dumps(
                settings.get("custom_field_settings", {})
            )

            update_data = {
                "remove_all_custom_fields": settings.get(
                    "remove_all_custom_fields", False
                ),
                "clear_device_name": settings.get("clear_device_name", False),
                "keep_serial": settings.get("keep_serial", False),
                "location_id": settings.get("location_id"),
                "status_id": settings.get("status_id"),
                "role_id": settings.get("role_id"),
                "custom_field_settings": custom_field_settings_json,
            }

            if existing:
                repo.update(existing.id, **update_data)
            else:
                repo.create(**update_data)

            logger.info("Device offboarding settings updated successfully")
            return True

        except Exception as e:
            logger.error("Error updating device offboarding settings: %s", e)
            return False

    # OIDC Provider Management
    def get_oidc_providers_config_path(self) -> str:
        """Get path to OIDC providers YAML configuration file"""
        from pathlib import Path

        # Use Path-based navigation like CheckMK config service
        # Navigate from backend/settings_manager.py -> backend/ -> project_root/ -> config/
        config_path = Path(__file__).parent.parent / "config" / "oidc_providers.yaml"
        return str(config_path)

    def load_oidc_providers(self) -> Dict[str, Any]:
        """Load OIDC providers configuration from YAML file"""
        config_path = self.get_oidc_providers_config_path()

        if not os.path.exists(config_path):
            logger.warning("OIDC providers config not found at %s", config_path)
            return {"providers": {}, "global": {"allow_traditional_login": True}}

        try:
            with open(config_path, "r") as f:
                config = yaml.safe_load(f)

            if not config:
                logger.warning("OIDC providers config is empty")
                return {"providers": {}, "global": {"allow_traditional_login": True}}

            # Validate structure
            if "providers" not in config:
                config["providers"] = {}
            if "global" not in config:
                config["global"] = {"allow_traditional_login": True}

            logger.info(
                "Loaded %s OIDC provider(s) from config", len(config.get('providers', {}))
            )
            return config

        except yaml.YAMLError as e:
            logger.error("Error parsing OIDC providers YAML: %s", e)
            return {"providers": {}, "global": {"allow_traditional_login": True}}
        except Exception as e:
            logger.error("Error loading OIDC providers config: %s", e)
            return {"providers": {}, "global": {"allow_traditional_login": True}}

    def get_oidc_providers(self) -> Dict[str, Dict[str, Any]]:
        """Get all OIDC providers from config"""
        config = self.load_oidc_providers()
        return config.get("providers", {})

    def get_enabled_oidc_providers(self) -> List[Dict[str, Any]]:
        """Get list of enabled OIDC providers sorted by display_order"""
        providers = self.get_oidc_providers()

        enabled_providers = []
        for provider_id, provider_config in providers.items():
            if provider_config.get("enabled", False):
                # Add provider_id to the config for reference
                provider_data = provider_config.copy()
                provider_data["provider_id"] = provider_id
                enabled_providers.append(provider_data)

        # Sort by display_order
        enabled_providers.sort(key=lambda p: p.get("display_order", 999))

        logger.info("Found %s enabled OIDC provider(s)", len(enabled_providers))
        return enabled_providers

    def get_oidc_provider(self, provider_id: str) -> Optional[Dict[str, Any]]:
        """Get specific OIDC provider configuration by ID"""
        providers = self.get_oidc_providers()
        provider = providers.get(provider_id)

        if provider:
            # Add provider_id to the config
            provider_data = provider.copy()
            provider_data["provider_id"] = provider_id
            return provider_data

        logger.warning("OIDC provider '%s' not found in config", provider_id)
        return None

    def get_oidc_global_settings(self) -> Dict[str, Any]:
        """Get global OIDC settings"""
        config = self.load_oidc_providers()
        return config.get("global", {"allow_traditional_login": True})

    def is_oidc_enabled(self) -> bool:
        """Check if at least one OIDC provider is enabled"""
        enabled_providers = self.get_enabled_oidc_providers()
        return len(enabled_providers) > 0


# Global settings manager instance
settings_manager = SettingsManager()
