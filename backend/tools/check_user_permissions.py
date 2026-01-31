#!/usr/bin/env python3
"""
Diagnostic tool to check a user's roles and permissions.
Usage: python tools/check_user_permissions.py <username>
"""

import sys
import rbac_manager as rbac
import user_db_manager as user_db


def check_user(username: str):
    """Check user's roles and permissions."""
    print(f"\n{'=' * 60}")
    print(f"Checking permissions for user: {username}")
    print(f"{'=' * 60}\n")

    # Get user
    user = user_db.get_user_by_username(username)
    if not user:
        print(f"✗ User '{username}' not found")
        return

    print("✓ User found:")
    print(f"  ID: {user['id']}")
    print(f"  Username: {user['username']}")
    print(f"  Real name: {user['realname']}")
    print(f"  Email: {user.get('email', 'N/A')}")
    print(f"  Active: {user['is_active']}")

    # Get roles
    print("\n📋 Roles:")
    user_roles = rbac.get_user_roles(user["id"])
    if user_roles:
        for role in user_roles:
            print(f"  - {role['name']} (ID: {role['id']})")
    else:
        print("  (No roles assigned)")

    # Get permissions
    print("\n🔐 Effective Permissions:")
    user_perms = rbac.get_user_permissions(user["id"])
    print(f"  Total: {len(user_perms)} permissions")

    # Check for dashboard.settings:read specifically
    has_dashboard = any(
        p["resource"] == "dashboard.settings" and p["action"] == "read"
        for p in user_perms
    )
    print(f"\n  ✓ Has dashboard.settings:read: {has_dashboard}")

    if has_dashboard:
        dashboard_perm = next(
            p
            for p in user_perms
            if p["resource"] == "dashboard.settings" and p["action"] == "read"
        )
        print(f"    Source: {dashboard_perm.get('source', 'unknown')}")

    # List all permissions
    print("\n  All permissions:")
    for perm in user_perms:
        source = perm.get("source", "unknown")
        print(f"    - {perm['resource']}:{perm['action']} (from {source})")

    # Get user with full RBAC data (as returned by login)
    print("\n📦 User object (as returned by login API):")
    user_with_rbac = rbac.get_user_with_rbac(user["id"])
    if user_with_rbac:
        print(f"  Roles: {[r['name'] for r in user_with_rbac.get('roles', [])]}")
        print(f"  Permissions: {len(user_with_rbac.get('permissions', []))} total")

        # Show first 10 permissions
        perms = user_with_rbac.get("permissions", [])
        if perms:
            print("\n  First 10 permissions in login response:")
            for p in perms[:10]:
                print(f"    - {p['resource']}:{p['action']}")

    print(f"\n{'=' * 60}\n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python tools/check_user_permissions.py <username>")
        sys.exit(1)

    check_user(sys.argv[1])
