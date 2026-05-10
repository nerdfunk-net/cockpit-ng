"""
Configuration management for Cockpit Ansible Agent
"""

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

        # Agent identity - must match Cockpit configuration
        self.agent_id = os.getenv("AGENT_ID") or socket.gethostname()

        # Ansible settings
        self.ansible_playbook_dir = os.getenv(
            "ANSIBLE_PLAYBOOK_DIR", str(Path(__file__).parent)
        )
        self.ansible_timeout = int(os.getenv("ANSIBLE_TIMEOUT", "60"))
        self.ansible_host_key_checking = (
            os.getenv("ANSIBLE_HOST_KEY_CHECKING", "False").lower() in ("true", "1", "yes")
        )

        # Operational settings
        self.heartbeat_interval = int(os.getenv("HEARTBEAT_INTERVAL", "30"))

        # Logging configuration
        loglevel_str = os.getenv("LOGLEVEL", "INFO").upper()
        self.loglevel = getattr(logging, loglevel_str, logging.INFO)

        # Agent metadata
        self.agent_version = "1.0.0"

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
        if self.ansible_timeout < 1:
            return False, "ANSIBLE_TIMEOUT must be >= 1"
        return True, None


# Global config instance
config = AgentConfig()
