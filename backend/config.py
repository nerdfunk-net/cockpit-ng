"""
Manual configuration module for Cockpit backend.
Simple approach without complex pydantic parsing.
"""

import os

from dotenv import load_dotenv

# Load environment variables from .env file (optional)
# Docker environment variables take precedence - .env file won't override them
backend_env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(backend_env_path):
    load_dotenv(backend_env_path, override=False)


def get_env_bool(key: str, default: bool = False) -> bool:
    """Get boolean environment variable."""
    value = os.getenv(key)
    if value is None:
        return default
    return value.lower() in ("true", "1", "yes", "on")


def get_env_list(key: str, default: list = None) -> list:
    """Get list from comma-separated environment variable."""
    if default is None:
        default = []
    value = os.getenv(key, "")
    if not value:
        return default
    return [item.strip() for item in value.split(",") if item.strip()]


class Settings:
    # Server Configuration
    # Prefer backend-specific env vars, fall back to legacy SERVER_* names for compatibility
    host: str = os.getenv("BACKEND_SERVER_HOST", os.getenv("SERVER_HOST", "127.0.0.1"))
    port: int = int(os.getenv("BACKEND_SERVER_PORT", os.getenv("SERVER_PORT", "8000")))
    log_level: str = os.getenv("LOG_LEVEL", "INFO").upper()  # Normalize to uppercase

    # Nautobot Configuration
    nautobot_url: str = os.getenv("NAUTOBOT_HOST", "http://localhost:8080")
    nautobot_token: str = os.getenv("NAUTOBOT_TOKEN", "your-nautobot-token-here")
    nautobot_timeout: int = int(os.getenv("NAUTOBOT_TIMEOUT", "30"))

    # Authentication Configuration
    secret_key: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    algorithm: str = os.getenv("ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "10")
    )

    # Initial credentials for first-time setup
    initial_username: str = os.getenv("INITIAL_USERNAME", "admin")
    initial_password: str = os.getenv("INITIAL_PASSWORD", "admin")

    # OIDC Configuration - Now managed via config/oidc_providers.yaml
    # No environment variables needed - all OIDC settings are in the YAML file

    # File storage configuration
    config_files_directory: str = os.getenv("CONFIG_FILES_DIRECTORY", "config_files")
    allowed_file_extensions: list = get_env_list(
        "ALLOWED_FILE_EXTENSIONS", [".txt", ".conf", ".cfg", ".config", ".ini"]
    )
    max_file_size_mb: int = int(os.getenv("MAX_FILE_SIZE_MB", "10"))

    # Data directory configuration - use project-relative path for Docker compatibility
    data_directory: str = os.getenv(
        "DATA_DIRECTORY",
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "data"),
    )

    # Redis TLS Configuration (disabled by default)
    redis_tls: bool = get_env_bool("COCKPIT_REDIS_TLS", False)
    redis_tls_verify: bool = get_env_bool("COCKPIT_REDIS_TLS_VERIFY", True)
    redis_tls_ca_cert: str = os.getenv("COCKPIT_REDIS_TLS_CA_CERT", "")
    redis_tls_cert: str = os.getenv("COCKPIT_REDIS_TLS_CERT", "")
    redis_tls_key: str = os.getenv("COCKPIT_REDIS_TLS_KEY", "")

    # Celery and Redis Configuration
    # Build Redis URL from components or use direct URL if provided
    @property
    def redis_url(self) -> str:
        """Build Redis URL from individual components or use direct URL."""
        scheme = "rediss" if self.redis_tls else "redis"

        # If REDIS_URL is explicitly set, enforce the correct scheme
        if explicit := os.getenv("REDIS_URL"):
            if self.redis_tls and explicit.startswith("redis://"):
                return "rediss://" + explicit[8:]
            return explicit

        redis_host = os.getenv("COCKPIT_REDIS_HOST", "localhost")
        redis_port = os.getenv("COCKPIT_REDIS_PORT", "6379")
        redis_password = os.getenv("COCKPIT_REDIS_PASSWORD", "")

        if redis_password:
            return f"{scheme}://:{redis_password}@{redis_host}:{redis_port}/0"
        return f"{scheme}://{redis_host}:{redis_port}/0"

    @property
    def redis_ssl_params(self) -> dict:
        """Return SSL kwargs for redis client connections when TLS is enabled."""
        if not self.redis_tls:
            return {}
        params: dict = {
            "ssl_cert_reqs": "required" if self.redis_tls_verify else "none",
        }
        if self.redis_tls_ca_cert:
            params["ssl_ca_certs"] = self.redis_tls_ca_cert
        if self.redis_tls_cert:
            params["ssl_certfile"] = self.redis_tls_cert
        if self.redis_tls_key:
            params["ssl_keyfile"] = self.redis_tls_key
        return params

    @property
    def celery_broker_url(self) -> str:
        """Celery broker URL (uses Redis)."""
        return os.getenv("CELERY_BROKER_URL", self.redis_url)

    @property
    def celery_result_backend(self) -> str:
        """Celery result backend URL (uses Redis)."""
        return os.getenv("CELERY_RESULT_BACKEND", self.redis_url)

    celery_max_workers: int = int(os.getenv("CELERY_MAX_WORKERS", "4"))

    # Schema migration behaviour
    # Set to true to apply safe column type changes (e.g. VARCHAR widening) at startup.
    apply_safe_migrations: bool = get_env_bool("APPLY_SAFE_DATABASE_MIGRATION", False)
    # Set to true to also apply risky column changes (type casts, NOT NULL additions)
    # at startup.  Default is false — safe-only auto-sync runs regardless.
    apply_risky_migrations: bool = get_env_bool("APPLY_RISKY_DATABASE_MIGRATION", False)

    # Audit Log Cleanup (0 = disabled)
    purge_logs_days: int = int(os.getenv("PURGE_LOGS", "0"))

    # PostgreSQL Database Configuration
    database_host: str = os.getenv("COCKPIT_DATABASE_HOST", "localhost")
    database_port: int = int(os.getenv("COCKPIT_DATABASE_PORT", "5432"))
    database_name: str = os.getenv("COCKPIT_DATABASE_NAME", "cockpit")
    database_username: str = os.getenv("COCKPIT_DATABASE_USERNAME", "postgres")
    database_password: str = os.getenv("COCKPIT_DATABASE_PASSWORD", "postgres")
    database_ssl: bool = get_env_bool("COCKPIT_DATABASE_SSL", False)

    @property
    def database_url(self) -> str:
        """Build PostgreSQL database URL."""
        # Basic connection string
        url = f"postgresql://{self.database_username}:{self.database_password}@{self.database_host}:{self.database_port}/{self.database_name}"

        # Add SSL mode if required
        if self.database_ssl:
            url += "?sslmode=require"

        return url


# Global settings instance
settings = Settings()

if __name__ == "__main__":
    print("Cockpit Backend Configuration:")
    print(f"  Server: http://{settings.host}:{settings.port}")
    print(f"  Log Level: {settings.log_level}")
    print(f"  Nautobot URL: {settings.nautobot_url}")
