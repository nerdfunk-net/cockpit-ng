"""
Configuration management for Cockpit Agent
"""

import logging
import os
import socket
from typing import Optional
from pathlib import Path

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

        # Agent identity - used to connect to Redis and must match Cockpit configuration
        self.agent_id = os.getenv("AGENT_ID") or socket.gethostname()

        # Command configuration (support comma-separated lists)
        git_paths = os.getenv("GIT_REPO_PATH", "/opt/app/config")
        self.git_repo_paths = [p.strip() for p in git_paths.split(",") if p.strip()]

        docker_names = os.getenv("DOCKER_CONTAINER_NAME", "app")
        self.docker_container_names = [
            n.strip() for n in docker_names.split(",") if n.strip()
        ]

        # Operational settings
        self.heartbeat_interval = int(os.getenv("HEARTBEAT_INTERVAL", "30"))
        self.command_timeout = int(os.getenv("COMMAND_TIMEOUT", "30"))
        self.docker_timeout = int(os.getenv("DOCKER_TIMEOUT", "60"))

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

        if not self.git_repo_paths:
            return False, "GIT_REPO_PATH is required"

        if not self.docker_container_names:
            return False, "DOCKER_CONTAINER_NAME is required"

        return True, None


# Global config instance
config = AgentConfig()
