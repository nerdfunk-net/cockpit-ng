#!/usr/bin/env python3
"""
Phase 2 Import Verification Test

This script verifies that all new directory structures can be imported correctly.
"""

import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent
sys.path.insert(0, str(backend_path))


def test_router_imports():
    """Test that all new router packages can be imported."""
    print("Testing router imports...")

    imports = [
        "routers.auth",
        "routers.nautobot",
        "routers.nautobot.tools",
        "routers.checkmk",
        "routers.network",
        "routers.network.configs",
        "routers.network.automation",
        "routers.network.compliance",
        "routers.network.tools",
        "routers.jobs",
        "routers.settings",
        "routers.settings.compliance",
        "routers.settings.connections",
        "routers.settings.git",
        "routers.inventory",
    ]

    failed = []
    for module_name in imports:
        try:
            __import__(module_name)
            print(f"  ✓ {module_name}")
        except Exception as e:
            print(f"  ✗ {module_name}: {e}")
            failed.append(module_name)

    return len(failed) == 0, failed


def test_service_imports():
    """Test that all new service packages can be imported."""
    print("\nTesting service imports...")

    imports = [
        "services.auth",
        "services.nautobot",
        "services.nautobot.devices",
        "services.nautobot.configs",
        "services.nautobot.helpers",
        "services.checkmk",
        "services.checkmk.sync",
        "services.network",
        "services.network.automation",
        "services.network.compliance",
        "services.network.scanning",
        "services.settings",
        "services.settings.git",
    ]

    failed = []
    for module_name in imports:
        try:
            __import__(module_name)
            print(f"  ✓ {module_name}")
        except Exception as e:
            print(f"  ✗ {module_name}: {e}")
            failed.append(module_name)

    return len(failed) == 0, failed


def test_repository_imports():
    """Test that all new repository packages can be imported."""
    print("\nTesting repository imports...")

    imports = [
        "repositories.auth",
        "repositories.jobs",
        "repositories.settings",
        "repositories.compliance",
        "repositories.inventory",
        "repositories.checkmk",
    ]

    failed = []
    for module_name in imports:
        try:
            __import__(module_name)
            print(f"  ✓ {module_name}")
        except Exception as e:
            print(f"  ✗ {module_name}: {e}")
            failed.append(module_name)

    return len(failed) == 0, failed


def main():
    """Run all import tests."""
    print("=" * 60)
    print("Phase 2: Import Verification Test")
    print("=" * 60)

    router_success, router_failed = test_router_imports()
    service_success, service_failed = test_service_imports()
    repo_success, repo_failed = test_repository_imports()

    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)

    all_success = router_success and service_success and repo_success

    if all_success:
        print("✅ All imports successful!")
        print("\nDirectory structure is ready for Phase 3 migration.")
        return 0
    else:
        print("❌ Some imports failed:")
        if router_failed:
            print(f"  Routers: {', '.join(router_failed)}")
        if service_failed:
            print(f"  Services: {', '.join(service_failed)}")
        if repo_failed:
            print(f"  Repositories: {', '.join(repo_failed)}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
