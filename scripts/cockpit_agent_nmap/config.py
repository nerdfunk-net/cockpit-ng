"""
Configuration management for Cockpit Nmap Agent
"""

import logging
import os
import shutil
import socket
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

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

        # Agent identity — must match Cockpit configuration
        self.agent_id = os.getenv("AGENT_ID") or socket.gethostname()

        # Nmap settings
        self.nmap_path = os.getenv("NMAP_PATH") or shutil.which("nmap") or "nmap"
        self.nmap_default_ports = os.getenv("NMAP_DEFAULT_PORTS", "1-1024")
        self.nmap_default_scan_type = os.getenv("NMAP_DEFAULT_SCAN_TYPE", "connect")
        self.nmap_service_detection = os.getenv(
            "NMAP_SERVICE_DETECTION", "false"
        ).lower() in ("true", "1", "yes")
        self.nmap_timeout = int(os.getenv("NMAP_TIMEOUT", "300"))

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
        return f"cockpit-agent:{self.agent_id}"

    def get_response_channel(self) -> str:
        return f"cockpit-agent-response:{self.agent_id}"

    def get_agent_key(self) -> str:
        return f"agents:{self.agent_id}"

    def validate(self) -> tuple[bool, Optional[str]]:
        if not self.redis_host:
            return False, "REDIS_HOST is required"
        if not self.shared_secret:
            return False, "COCKPIT_SHARED_SECRET is required"
        if self.nmap_timeout < 1:
            return False, "NMAP_TIMEOUT must be >= 1"
        if self.nmap_default_scan_type not in ("syn", "connect", "udp"):
            return False, "NMAP_DEFAULT_SCAN_TYPE must be syn, connect, or udp"
        if not self.nmap_path:
            return False, "nmap binary not found — install nmap or set NMAP_PATH"
        return True, None


config = AgentConfig()
