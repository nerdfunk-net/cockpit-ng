"""Seed script for RBAC system.

This script initializes the RBAC system with:
- Default permissions for all resources
- System roles (admin, operator, network_engineer, viewer)
- Permission assignments to roles
"""

import rbac_manager as rbac


def seed_permissions(verbose: bool = True):
    """Create all default permissions."""
    if verbose:
        print("Creating permissions...")

    permissions = [
        # Nautobot permissions
        ("nautobot.devices", "read", "View Nautobot devices"),
        ("nautobot.devices", "write", "Create/update Nautobot devices"),
        ("nautobot.devices", "delete", "Delete Nautobot devices"),
        ("nautobot.locations", "read", "View Nautobot locations"),
        ("nautobot.locations", "write", "Create/update Nautobot locations"),
        ("nautobot.export", "execute", "Export Nautobot device data"),
        ("nautobot.export", "read", "Download exported device files"),
        ("settings.nautobot", "read", "View Nautobot settings"),
        ("settings.nautobot", "write", "Modify Nautobot settings"),
        # CheckMK permissions
        ("checkmk.devices", "read", "View CheckMK devices"),
        ("checkmk.devices", "write", "Create/update CheckMK devices"),
        ("checkmk.devices", "delete", "Delete CheckMK devices"),
        ("settings.checkmk", "read", "View CheckMK settings"),
        ("settings.checkmk", "write", "Modify CheckMK settings"),
        # Compliance permissions
        ("settings.compliance", "read", "View compliance settings"),
        ("settings.compliance", "write", "Modify compliance settings"),
        ("compliance.check", "execute", "Execute compliance checks"),
        # Config permissions
        ("configs", "read", "View device configurations"),
        ("configs.backup", "execute", "Execute configuration backups"),
        ("configs.compare", "execute", "Compare configurations"),
        # Network automation permissions
        ("network.inventory", "read", "View Ansible inventory"),
        ("network.inventory", "write", "Modify Ansible inventory"),
        ("network.templates", "read", "View configuration templates"),
        ("network.templates", "write", "Create/modify templates"),
        ("network.templates", "delete", "Delete templates"),
        ("network.netmiko", "execute", "Execute Netmiko commands"),
        # Git permissions
        ("git.repositories", "read", "View git repositories"),
        ("git.repositories", "write", "Create/modify git repositories"),
        ("git.repositories", "delete", "Delete git repositories"),
        ("git.operations", "execute", "Execute git operations (commit, push, pull)"),
        # Scan & Add permissions
        ("scan", "execute", "Execute network scans"),
        ("devices.onboard", "execute", "Onboard new devices"),
        ("devices.offboard", "execute", "Offboard devices"),
        # Settings permissions
        ("settings.cache", "read", "View cache settings"),
        ("settings.cache", "write", "Modify cache settings"),
        ("settings.celery", "read", "View Celery task queue status"),
        ("settings.celery", "write", "Manage Celery tasks and workers"),
        ("settings.credentials", "read", "View credentials"),
        ("settings.credentials", "write", "Create/modify credentials"),
        ("settings.credentials", "delete", "Delete credentials"),
        ("settings.templates", "read", "View template settings"),
        ("settings.templates", "write", "Modify template settings"),
        # User management permissions
        ("users", "read", "View users"),
        ("users", "write", "Create/modify users"),
        ("users", "delete", "Delete users"),
        ("users.roles", "write", "Assign roles to users"),
        ("users.permissions", "write", "Assign permissions to users"),
        # Jobs permissions
        ("jobs", "read", "View scheduled jobs"),
        ("jobs", "write", "Create/modify scheduled jobs"),
        ("jobs", "delete", "Delete scheduled jobs"),
        ("jobs", "execute", "Execute jobs manually"),
    ]

    created_count = 0
    for resource, action, description in permissions:
        try:
            rbac.create_permission(resource, action, description)
            created_count += 1
            if verbose:
                print(f"  ✓ Created permission: {resource}:{action}")
        except ValueError as e:
            if verbose:
                print(f"  - Skipped: {e}")

    if verbose:
        print(f"\nCreated {created_count} permissions\n")


def seed_roles(verbose: bool = True):
    """Create default system roles."""
    if verbose:
        print("Creating roles...")

    roles = [
        ("admin", "Full system administrator with all permissions", True),
        (
            "operator",
            "Can manage devices and configurations but not system settings",
            True,
        ),
        (
            "network_engineer",
            "Full access to network tools, read-only for settings",
            True,
        ),
        ("viewer", "Read-only access to all resources", True),
    ]

    role_objects = {}
    for name, description, is_system in roles:
        try:
            role = rbac.create_role(name, description, is_system)
            role_objects[name] = role
            if verbose:
                print(f"  ✓ Created role: {name}")
        except ValueError as e:
            if verbose:
                print(f"  - Skipped: {e}")
            role = rbac.get_role_by_name(name)
            role_objects[name] = role

    if verbose:
        print(f"\nCreated {len(role_objects)} roles\n")
    return role_objects


def assign_permissions_to_roles(roles, verbose: bool = True):
    """Assign permissions to roles."""
    if verbose:
        print("Assigning permissions to roles...")

    # Get all permissions
    all_permissions = rbac.list_permissions()
    perm_map = {f"{p['resource']}:{p['action']}": p["id"] for p in all_permissions}

    # Admin: Full access to everything
    if verbose:
        print("\n  Assigning permissions to 'admin' role...")
    admin_count = 0
    for perm_id in perm_map.values():
        rbac.assign_permission_to_role(roles["admin"]["id"], perm_id, granted=True)
        admin_count += 1
    if verbose:
        print(f"    ✓ Assigned {admin_count} permissions")

    # Operator: Manage devices and configs, read settings
    if verbose:
        print("\n  Assigning permissions to 'operator' role...")
    operator_perms = [
        # Nautobot
        "nautobot.devices:read",
        "nautobot.devices:write",
        "nautobot.devices:delete",
        "nautobot.locations:read",
        "nautobot.locations:write",
        "nautobot.export:execute",
        "nautobot.export:read",
        "settings.nautobot:read",
        # CheckMK
        "checkmk.devices:read",
        "checkmk.devices:write",
        "checkmk.devices:delete",
        "settings.checkmk:read",
        # Compliance
        "settings.compliance:read",
        "settings.compliance:write",
        "compliance.check:execute",
        # Configs
        "configs:read",
        "configs.backup:execute",
        "configs.compare:execute",
        # Network
        "network.inventory:read",
        "network.templates:read",
        # Scan & Add
        "scan:execute",
        "devices.onboard:execute",
        "devices.offboard:execute",
        # Settings (read-only)
        "settings.cache:read",
        "settings.credentials:read",
        "settings.templates:read",
        # Jobs
        "jobs:read",
        "jobs:write",
        "jobs:execute",
    ]
    operator_count = 0
    for perm_key in operator_perms:
        if perm_key in perm_map:
            rbac.assign_permission_to_role(
                roles["operator"]["id"], perm_map[perm_key], granted=True
            )
            operator_count += 1
    if verbose:
        print(f"    ✓ Assigned {operator_count} permissions")

    # Network Engineer: Full network tools, read-only for system
    if verbose:
        print("\n  Assigning permissions to 'network_engineer' role...")
    network_engineer_perms = [
        # Nautobot
        "nautobot.devices:read",
        "nautobot.devices:write",
        "nautobot.locations:read",
        "nautobot.locations:write",
        "nautobot.export:execute",
        "nautobot.export:read",
        # CheckMK
        "checkmk.devices:read",
        "checkmk.devices:write",
        # Compliance
        "settings.compliance:read",
        "compliance.check:execute",
        # Configs (full access)
        "configs:read",
        "configs.backup:execute",
        "configs.compare:execute",
        # Network (full access)
        "network.inventory:read",
        "network.inventory:write",
        "network.templates:read",
        "network.templates:write",
        "network.templates:delete",
        "network.netmiko:execute",
        # Git
        "git.repositories:read",
        "git.operations:execute",
        # Scan & Add
        "scan:execute",
        "devices.onboard:execute",
        # Settings (read-only)
        "settings.cache:read",
        "settings.credentials:read",
        "settings.templates:read",
        # Jobs
        "jobs:read",
        "jobs:execute",
    ]
    network_count = 0
    for perm_key in network_engineer_perms:
        if perm_key in perm_map:
            rbac.assign_permission_to_role(
                roles["network_engineer"]["id"], perm_map[perm_key], granted=True
            )
            network_count += 1
    if verbose:
        print(f"    ✓ Assigned {network_count} permissions")

    # Viewer: Read-only access to everything except user management
    if verbose:
        print("\n  Assigning permissions to 'viewer' role...")
    viewer_count = 0
    for perm_key, perm_id in perm_map.items():
        # Grant all read permissions, skip write/delete/execute
        if ":read" in perm_key or (
            ":execute" not in perm_key
            and ":write" not in perm_key
            and ":delete" not in perm_key
            and "users" not in perm_key
        ):
            rbac.assign_permission_to_role(roles["viewer"]["id"], perm_id, granted=True)
            viewer_count += 1
    if verbose:
        print(f"    ✓ Assigned {viewer_count} permissions")

    if verbose:
        print("\n✅ Permission assignment complete\n")


def main(verbose: bool = True):
    """Run the seeding process.

    Args:
        verbose: If True, print progress messages. If False, run silently.
    """
    if verbose:
        print("\n" + "=" * 60)
        print("RBAC System Initialization")
        print("=" * 60 + "\n")

    # Create permissions
    seed_permissions(verbose=verbose)

    # Create roles
    roles = seed_roles(verbose=verbose)

    # Assign permissions to roles
    assign_permissions_to_roles(roles, verbose=verbose)

    if verbose:
        print("=" * 60)
        print("✅ RBAC system seeded successfully!")
        print("=" * 60 + "\n")

        # Print summary
        print("Summary:")
        print(f"  - Permissions: {len(rbac.list_permissions())}")
        print(f"  - Roles: {len(rbac.list_roles())}")
        print("\nAvailable roles:")
        for role in rbac.list_roles():
            perms = rbac.get_role_permissions(role["id"])
            print(f"  - {role['name']}: {len(perms)} permissions")
        print()


if __name__ == "__main__":
    main()
