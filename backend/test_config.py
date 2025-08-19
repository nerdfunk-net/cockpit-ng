#!/usr/bin/env python3
"""
Test script to verify Nautobot configuration is working
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

from settings_manager import settings_manager
from config import settings as env_settings

def main():
    print("=== Cockpit Nautobot Configuration Test ===\n")

    # Test environment settings
    print("Environment Settings:")
    print(f"  URL: {env_settings.nautobot_url}")
    print(f"  Token: {env_settings.nautobot_token[:20]}...")
    print(f"  Timeout: {env_settings.nautobot_timeout}")

    # Test database settings
    print("\nDatabase Settings:")
    try:
        db_settings = settings_manager.get_nautobot_settings()
        if db_settings:
            print(f"  URL: {db_settings['url']}")
            print(f"  Token: {db_settings['token'][:20] if db_settings['token'] else 'Not set'}...")
            print(f"  Timeout: {db_settings['timeout']}")
            print(f"  Verify SSL: {db_settings['verify_ssl']}")
        else:
            print("  No database settings found")
    except Exception as e:
        print(f"  Error reading database settings: {e}")

    # Test health check
    print("\nDatabase Health Check:")
    health = settings_manager.health_check()
    print(f"  Status: {health['status']}")
    if health['status'] == 'healthy':
        print(f"  Nautobot settings count: {health['nautobot_settings_count']}")
        print(f"  Database size: {health['database_size']} bytes")

    print("\n=== Test Complete ===")

if __name__ == "__main__":
    main()
