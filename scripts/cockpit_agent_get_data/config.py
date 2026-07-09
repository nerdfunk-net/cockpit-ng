"""
Configuration management for Cockpit Get Data Agent
"""

import hashlib
import logging
import os
import socket
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

# Load .env file if it exists
env_file = Path(__file__).parent / ".env"
if env_file.exists():
    load_dotenv(env_file)


class AgentConfig:
    """Agent configuration loaded from environment variables"""

    def __init__(self):
        # Redis configuration
        self.redis_host = os.getenv("REDIS_HOST", "localhost")
        self.redis_port = int(os.getenv("REDIS_PORT", "6379"))
        self.redis_password = os.getenv("REDIS_PASSWORD")
        self.redis_db = int(os.getenv("REDIS_DB", "0"))
        self.redis_ssl = os.getenv("REDIS_SSL", "false").lower() in ("true", "1", "yes")
        self.redis_tls_verify = os.getenv("REDIS_TLS_VERIFY", "true").lower() in (
            "true",
            "1",
            "yes",
        )
        self.redis_tls_ca_cert = os.getenv("REDIS_TLS_CA_CERT", "")
        self.redis_tls_cert = os.getenv("REDIS_TLS_CERT", "")
        self.redis_tls_key = os.getenv("REDIS_TLS_KEY", "")

        # Agent identity - must match Cockpit configuration
        self.agent_id = os.getenv("AGENT_ID") or socket.gethostname()

        # Pipeline config (commands are fixed at startup — not overridable via Redis)
        self.config_path = Path(
            os.getenv("CONFIG_PATH", str(Path(__file__).parent / "config.yaml"))
        )

        # SSH / command execution
        self.command_timeout = int(os.getenv("COMMAND_TIMEOUT", "60"))
        self.ssh_host_key_checking = os.getenv(
            "SSH_HOST_KEY_CHECKING", "False"
        ).lower() in ("true", "1", "yes")

        # Shared secret for HMAC authentication (required)
        self.shared_secret = os.getenv("COCKPIT_SHARED_SECRET", "")

        # Operational settings
        self.heartbeat_interval = int(os.getenv("HEARTBEAT_INTERVAL", "30"))

        # Logging configuration
        loglevel_str = os.getenv("LOGLEVEL", "INFO").upper()
        self.loglevel = getattr(logging, loglevel_str, logging.INFO)

        # Agent metadata
        self.agent_version = "1.0.0"

    @property
    def redis_ssl_kwargs(self) -> dict:
        """Return SSL kwargs for redis.Redis() when TLS is enabled."""
        if not self.redis_ssl:
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

    def get_command_channel(self) -> str:
        """Get the Redis channel name for receiving commands"""
        return f"cockpit-agent:{self.agent_id}"

    def get_response_channel(self) -> str:
        """Get the Redis channel name for sending responses"""
        return f"cockpit-agent-response:{self.agent_id}"

    def get_agent_key(self) -> str:
        """Get the Redis key for agent registry"""
        return f"agents:{self.agent_id}"

    def validate(self) -> tuple[bool, Optional[str]]:
        """Validate configuration"""
        if not self.redis_host:
            return False, "REDIS_HOST is required"
        if not self.shared_secret:
            return False, "COCKPIT_SHARED_SECRET is required"
        if self.command_timeout < 1:
            return False, "COMMAND_TIMEOUT must be >= 1"
        if not self.config_path.is_file():
            return False, f"Config file not found: {self.config_path}"
        return True, None


# Global config instance
config = AgentConfig()
