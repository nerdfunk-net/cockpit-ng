"""
Manual configuration module for Cockpit backend.
Simple approach without complex pydantic parsing.
"""

import os
from dotenv import load_dotenv

# Load environment variables from .env file
# Try to load from backend directory first, then from current directory
backend_env_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(backend_env_path):
	load_dotenv(backend_env_path)
	print(f"Loaded .env from: {backend_env_path}")
else:
	load_dotenv()
	print("Loaded .env from current directory")

def get_env_bool(key: str, default: bool = False) -> bool:
	"""Get boolean environment variable."""
	value = os.getenv(key, str(default)).lower()
	return value in ('true', '1', 'yes', 'on')

def get_env_list(key: str, default: list = None) -> list:
	"""Get list from comma-separated environment variable."""
	if default is None:
		default = []
	value = os.getenv(key, '')
	if not value:
		return default
	return [item.strip() for item in value.split(',') if item.strip()]

class Settings:
	# Server Configuration
	host: str = os.getenv('SERVER_HOST', '127.0.0.1')
	port: int = int(os.getenv('SERVER_PORT', '8000'))
	debug: bool = get_env_bool('DEBUG', True)
	log_level: str = os.getenv('LOG_LEVEL', 'INFO')

	# Nautobot Configuration
	nautobot_url: str = os.getenv('NAUTOBOT_HOST', 'http://localhost:8080')
	nautobot_token: str = os.getenv('NAUTOBOT_TOKEN', 'your-nautobot-token-here')
	nautobot_timeout: int = int(os.getenv('NAUTOBOT_TIMEOUT', '30'))

	# Authentication Configuration
	secret_key: str = os.getenv('SECRET_KEY', 'your-secret-key-change-in-production')
	algorithm: str = os.getenv('ALGORITHM', 'HS256')
	access_token_expire_minutes: int = int(os.getenv('ACCESS_TOKEN_EXPIRE_MINUTES', '10'))

	# Demo credentials
	demo_username: str = os.getenv('DEMO_USERNAME', 'admin')
	demo_password: str = os.getenv('DEMO_PASSWORD', 'admin')

	# SSL/TLS Configuration for Git operations
	git_ssl_verify: bool = os.getenv('GIT_SSL_VERIFY', 'true').lower() == 'true'
	git_ssl_cert: str = os.getenv('GIT_SSL_CERT', '')
	git_ssl_ca_info: str = os.getenv('GIT_SSL_CA_INFO', '')

	# File storage configuration
	config_files_directory: str = os.getenv('CONFIG_FILES_DIRECTORY', 'config_files')
	allowed_file_extensions: list = get_env_list('ALLOWED_FILE_EXTENSIONS', ['.txt', '.conf', '.cfg', '.config', '.ini'])
	max_file_size_mb: int = int(os.getenv('MAX_FILE_SIZE_MB', '10'))

	# Data directory configuration - use project-relative path for Docker compatibility
	data_directory: str = os.getenv('DATA_DIRECTORY', os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data'))

# Global settings instance
settings = Settings()

if __name__ == "__main__":
	print("Cockpit Backend Configuration:")
	print(f"  Server: http://{settings.host}:{settings.port}")
	print(f"  Debug Mode: {settings.debug}")
	print(f"  Nautobot URL: {settings.nautobot_url}")
