#!/usr/bin/env python3
"""Test individual imports to find the issue."""

import sys
import traceback

def test_import(module_name, description):
    """Test importing a specific module."""
    try:
        print(f"Testing {description}...")
        __import__(module_name)
        print(f"✅ {description} imported successfully")
        return True
    except Exception as e:
        print(f"❌ {description} failed: {e}")
        traceback.print_exc()
        return False

def main():
    print("=== Testing Individual Imports ===")

    # Test basic imports
    test_import("logging", "logging")
    test_import("datetime", "datetime")
    test_import("fastapi", "FastAPI")
    test_import("fastapi.middleware.cors", "CORS middleware")

    # Test router imports
    print("\n=== Testing Router Imports ===")
    test_import("routers.auth", "auth router")
    test_import("routers.nautobot", "nautobot router")
    test_import("routers.git", "git router")
    test_import("routers.files", "files router")
    test_import("routers.settings", "settings router")

    # Test config
    print("\n=== Testing Config ===")
    test_import("config", "config")

    # Test services
    print("\n=== Testing Services ===")
    test_import("services.nautobot", "nautobot service")

    # Test core
    print("\n=== Testing Core ===")
    test_import("core.auth", "core auth")

    print("\n=== Testing Main Module ===")
    try:
        print("Importing main module...")
        import main
        print(f"Main module imported: {main}")
        print(f"Main module __dict__ keys: {list(main.__dict__.keys())}")
        if hasattr(main, 'app'):
            print(f"✅ App found: {main.app}")
        else:
            print("❌ App not found in main module")
    except Exception as e:
        print(f"❌ Main module import failed: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    main()
