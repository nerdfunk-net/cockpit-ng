"""
MCP Server Configuration.
"""

from pydantic import BaseSettings
from typing import List


class Settings(BaseSettings):
    """MCP server configuration settings."""
    
    # Server settings
    mcp_server_host: str = "127.0.0.1"
    mcp_server_port: int = 8001
    log_level: str = "INFO"
    
    # Cockpit backend settings
    cockpit_api_url: str = "http://127.0.0.1:8000"
    cockpit_api_timeout: int = 30
    
    # Security settings
    mcp_api_keys: str = ""  # Comma-separated list of valid API keys
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
    
    @property
    def api_keys_list(self) -> List[str]:
        """Get list of valid API keys."""
        if not self.mcp_api_keys:
            return []
        return [key.strip() for key in self.mcp_api_keys.split(",") if key.strip()]


# Global settings instance
settings = Settings()