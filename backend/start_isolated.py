#!/usr/bin/env python3
"""
Isolated Cockpit Backend Startup Script
Runs Uvicorn from backend directory with strict file watching isolation.
"""

import uvicorn
import os
import sys

# Ensure we're running from the backend directory
if not os.path.basename(os.getcwd()) == 'backend':
    backend_dir = os.path.dirname(__file__)
    os.chdir(backend_dir)
    print(f"Changed to backend directory: {os.getcwd()}")

# Import settings after changing directory
from config import settings
from settings_manager import settings_manager
import logging

def initialize_database_settings():
    """Initialize database settings with environment variables if empty"""
    try:
        # Check if we have valid database settings
        db_settings = settings_manager.get_nautobot_settings()

        # If no valid token in database, initialize with environment settings
        if not db_settings or not db_settings.get('token') or db_settings.get('token') == '':
            logger.info("Initializing database with environment variable settings")
            nautobot_settings = {
                'url': settings.nautobot_url,
                'token': settings.nautobot_token,
                'timeout': settings.nautobot_timeout,
                'verify_ssl': True
            }

            success = settings_manager.update_nautobot_settings(nautobot_settings)
            if success:
                logger.info("Database settings initialized successfully")
            else:
                logger.warning("Failed to initialize database settings")
        else:
            logger.info("Using existing database settings")

    except Exception as e:
        logger.error(f"Error initializing database settings: {e}")

def main():
    """Start the FastAPI server with strict file watching isolation."""

    # Configure logging
    logging.basicConfig(
        level=getattr(logging, settings.log_level),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    global logger
    logger = logging.getLogger(__name__)

    # Initialize database settings
    initialize_database_settings()

    # Log startup information
    logger.info("Starting Cockpit Backend Server (Isolated Mode)")
    logger.info(f"Working Directory: {os.getcwd()}")
    logger.info(f"Server: {settings.host}:{settings.port}")
    logger.info(f"Debug: {settings.debug}")
    logger.info(f"Data Directory: {settings.data_directory}")
    logger.info(f"Nautobot (env): {settings.nautobot_url}")
    logger.info(f"Git SSL Verification: {settings.git_ssl_verify}")

    # Start the server with strict isolation
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        reload_dirs=["."],  # Only watch backend directory
        log_level=settings.log_level.lower(),
        access_log=True
    )

if __name__ == "__main__":
    main()
