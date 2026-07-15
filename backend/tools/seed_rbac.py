"""Seed script for RBAC system.

This script initializes the RBAC system with:
- Default permissions for all resources
- System roles (admin, operator, network_engineer, viewer)
- Permission assignments to roles
"""

import argparse
import sys

import service_factory as _sf
from services.auth.exceptions import RBACConflictError, RBACConstraintError

rbac = _sf.build_rbac_service()
user_db = _sf.build_user_service()


# Canonical list of all permissions the application uses. This is the single
# source of truth: anything not present here is considered stale/unused and is
# reported (and, when listed in OBSOLETE_RESOURCES, removed) by the repair pass.
DEFAULT_PERMISSIONS = [
    # Dashboard permissions
    ("dashboard.settings", "read", "Access to Settings menu and pages"),
    # Nautobot permissions
    ("nautobot.devices", "read", "View Nautobot devices"),
    ("nautobot.devices", "write", "Create/update Nautobot devices"),
    ("nautobot.devices", "delete", "Delete Nautobot devices"),
    ("nautobot.locations", "read", "View Nautobot locations"),
    ("nautobot.locations", "write", "Create/update Nautobot locations"),
    ("nautobot.export", "execute", "Export Nautobot device data"),
    ("nautobot.export", "read", "Download exported device files"),
    ("nautobot.csv_updates", "read", "View CSV updates"),
    ("nautobot.csv_updates", "write", "Create/modify CSV updates"),
    ("nautobot.csv_updates", "execute", "Execute CSV update operations"),
    ("settings.nautobot", "read", "View Nautobot settings"),
    ("settings.nautobot", "write", "Modify Nautobot settings"),
    ("settings.server", "read", "View server default settings"),
    ("settings.server", "write", "Modify server default settings"),
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
    ("configs.search", "execute", "Search configuration file content"),
    # Network backup permissions
    ("network.backup", "read", "View device backup status and history"),
    ("network.backup", "write", "Execute device configuration backups"),
    # General inventory permissions (moved from network.inventory)
    ("general.inventory", "read", "View device inventory"),
    ("general.inventory", "write", "Modify device inventory"),
    ("general.inventory", "delete", "Delete device inventory"),
    # Network automation permissions
    ("network.templates", "read", "View configuration templates"),
    ("network.templates", "write", "Create/modify templates"),
    ("network.templates", "delete", "Delete templates"),
    ("network.netmiko", "execute", "Execute Netmiko commands"),
    ("network.ping", "execute", "Execute network ping operations"),
    (
        "network.scan",
        "execute",
        "Execute network port scan operations (nmap, prefix scan)",
    ),
    ("network.clients", "read", "View collected client data (ARP/MAC/hostname)"),
    # Server & Clients permissions
    ("servers", "read", "View managed servers and their Ansible facts"),
    ("servers", "write", "Create/update managed servers"),
    ("servers", "delete", "Delete managed servers"),
    # Snapshot permissions
    ("snapshots", "read", "View network snapshots"),
    ("snapshots", "write", "Create/execute network snapshots"),
    ("snapshots", "delete", "Delete network snapshots"),
    # Git permissions
    ("git.repositories", "read", "View git repositories"),
    ("git.repositories", "write", "Create/modify git repositories"),
    ("git.repositories", "delete", "Delete git repositories"),
    ("git.operations", "execute", "Execute git operations (commit, push, pull)"),
    # Scan & Add permissions
    ("scan", "execute", "Execute network scans"),
    ("nautobot.onboard", "execute", "Onboard new devices"),
    ("nautobot.offboard", "execute", "Offboard devices"),
    # Settings permissions
    ("settings.cache", "read", "View cache settings"),
    ("settings.cache", "write", "Modify cache settings"),
    ("settings.celery", "read", "View Celery task queue status"),
    ("settings.celery", "write", "Manage Celery tasks and workers"),
    ("settings.credentials", "read", "View credentials"),
    ("settings.credentials", "write", "Create/modify credentials"),
    ("settings.credentials", "delete", "Delete credentials"),
    (
        "settings.defaults",
        "read",
        "View defaults settings (SNMP mapping with passwords, and default-value profiles)",
    ),
    (
        "settings.defaults",
        "write",
        "Modify defaults settings (SNMP mapping, default-value profiles)",
    ),
    ("settings.templates", "read", "View template settings"),
    ("settings.templates", "write", "Modify template settings"),
    # User management permissions
    ("users", "read", "View users"),
    ("users", "write", "Create/modify users"),
    ("users", "delete", "Delete users"),
    ("users.roles", "write", "Assign roles to users"),
    ("users.permissions", "write", "Assign permissions to users"),
    # RBAC management permissions
    ("rbac.roles", "read", "View roles"),
    ("rbac.roles", "write", "Create/modify roles"),
    ("rbac.roles", "delete", "Delete roles"),
    ("rbac.permissions", "read", "View all permissions"),
    # Jobs permissions
    ("jobs", "read", "View scheduled jobs"),
    ("jobs", "write", "Create/modify scheduled jobs"),
    ("jobs", "delete", "Delete scheduled jobs"),
    ("jobs", "execute", "Execute jobs manually"),
    # Cockpit Agent permissions
    ("cockpit_agents", "read", "View Cockpit agents and their status"),
    ("cockpit_agents", "execute", "Execute commands on Cockpit agents"),
    # General logs permissions
    ("general.logs", "read", "View audit logs"),
]


# Resources that older seed runs created but the application no longer uses.
# Permissions whose resource matches any of these are deleted by the repair
# pass (cleanup_obsolete_permissions). Cascading FKs remove any role/user
# assignments tied to them automatically.
#
# - network.inventory: replaced by general.inventory (assignments migrated first
#   by migrate_inventory_permissions)
# - devices.onboard / devices.offboard: never valid; the correct permissions are
#   nautobot.onboard / nautobot.offboard
# - settings.common: renamed to settings.defaults (assignments migrated first
#   by migrate_common_settings_permissions)
OBSOLETE_RESOURCES = [
    "network.inventory",
    "devices.onboard",
    "devices.offboard",
    "settings.common",
]


def migrate_inventory_permissions(verbose: bool = True):
    """Migrate network.inventory permissions to general.inventory.

    This function handles migration for existing systems that have
    network.inventory permissions assigned to roles or users.
    """
    if verbose:
        print(
            "\nMigrating inventory permissions from network.inventory to general.inventory..."
        )

    # Get all permissions
    all_permissions = rbac.list_permissions()

    # Find old network.inventory permissions
    old_perms = {
        p["id"]: p for p in all_permissions if p["resource"] == "network.inventory"
    }

    if not old_perms and verbose:
        print("  - No network.inventory permissions found to migrate")
        return

    # Get all roles
    all_roles = rbac.list_roles()

    # For each role, check if it has network.inventory permissions
    migrated_count = 0
    for role in all_roles:
        role_perms = rbac.get_role_permissions(role["id"])

        for old_perm_id, old_perm in old_perms.items():
            # Check if this role has the old permission
            if any(p["id"] == old_perm_id for p in role_perms):
                # Find or create the corresponding general.inventory permission
                action = old_perm["action"]
                try:
                    # Create the new permission if it doesn't exist
                    new_perm_id = None
                    for p in all_permissions:
                        if (
                            p["resource"] == "general.inventory"
                            and p["action"] == action
                        ):
                            new_perm_id = p["id"]
                            break

                    if new_perm_id:
                        # Assign the new permission to the role
                        rbac.assign_permission_to_role(
                            role["id"], new_perm_id, granted=True
                        )
                        migrated_count += 1
                        if verbose:
                            print(
                                f"  ✓ Migrated {old_perm['resource']}:{action} -> general.inventory:{action} for role '{role['name']}'"
                            )
                except Exception as e:
                    if verbose:
                        print(
                            f"  ✗ Error migrating permission for role '{role['name']}': {e}"
                        )

    if verbose:
        if migrated_count > 0:
            print(f"\n  ✅ Migrated {migrated_count} permission assignments")
        else:
            print("  - No permissions needed migration")


def migrate_common_settings_permissions(verbose: bool = True):
    """Migrate settings.common permissions to settings.defaults.

    Unlike migrate_inventory_permissions (which only migrates role grants),
    this also migrates direct user-level permission overrides, since
    settings.common has historically been granted directly to individual
    users in addition to roles.
    """
    if verbose:
        print(
            "\nMigrating settings permissions from settings.common to settings.defaults..."
        )

    all_permissions = rbac.list_permissions()

    old_perms = {
        p["id"]: p for p in all_permissions if p["resource"] == "settings.common"
    }

    if not old_perms:
        if verbose:
            print("  - No settings.common permissions found to migrate")
        return

    def _new_perm_id(action):
        for p in all_permissions:
            if p["resource"] == "settings.defaults" and p["action"] == action:
                return p["id"]
        return None

    migrated_count = 0

    # Roles
    for role in rbac.list_roles():
        role_perms = rbac.get_role_permissions(role["id"])
        for old_perm_id, old_perm in old_perms.items():
            if any(p["id"] == old_perm_id for p in role_perms):
                new_perm_id = _new_perm_id(old_perm["action"])
                if new_perm_id:
                    try:
                        rbac.assign_permission_to_role(
                            role["id"], new_perm_id, granted=True
                        )
                        migrated_count += 1
                        if verbose:
                            print(
                                f"  ✓ Migrated settings.common:{old_perm['action']} -> "
                                f"settings.defaults:{old_perm['action']} for role '{role['name']}'"
                            )
                    except Exception as e:
                        if verbose:
                            print(
                                f"  ✗ Error migrating permission for role '{role['name']}': {e}"
                            )

    # Direct user-level permission overrides
    for user in user_db.get_all_users():
        try:
            overrides = rbac.get_user_permission_overrides(user["id"])
        except Exception as e:
            if verbose:
                print(
                    f"  ✗ Error reading permission overrides for user '{user.get('username', user['id'])}': {e}"
                )
            continue

        for override in overrides:
            if override["resource"] != "settings.common" or not override.get(
                "granted", False
            ):
                continue
            new_perm_id = _new_perm_id(override["action"])
            if new_perm_id:
                try:
                    rbac.assign_permission_to_user(
                        user["id"], new_perm_id, granted=True
                    )
                    migrated_count += 1
                    if verbose:
                        print(
                            f"  ✓ Migrated settings.common:{override['action']} -> "
                            f"settings.defaults:{override['action']} for user "
                            f"'{user.get('username', user['id'])}'"
                        )
                except Exception as e:
                    if verbose:
                        print(
                            f"  ✗ Error migrating permission for user "
                            f"'{user.get('username', user['id'])}': {e}"
                        )

    if verbose:
        if migrated_count > 0:
            print(f"\n  ✅ Migrated {migrated_count} permission assignments")
        else:
            print("  - No permissions needed migration")


def cleanup_obsolete_permissions(verbose: bool = True):
    """Remove obsolete permissions that are no longer used.

    Deletes every permission whose resource is listed in OBSOLETE_RESOURCES
    (e.g. network.inventory replaced by general.inventory, and the invalid
    devices.onboard / devices.offboard that should be nautobot.onboard /
    nautobot.offboard). Deleting a permission cascades to its role/user
    assignments via the ON DELETE CASCADE foreign keys.
    """
    if verbose:
        print("\nCleaning up obsolete permissions...")

    all_permissions = rbac.list_permissions()
    removed_count = 0

    for perm in all_permissions:
        if perm["resource"] in OBSOLETE_RESOURCES:
            try:
                rbac.delete_permission(perm["id"])
                removed_count += 1
                if verbose:
                    print(
                        f"  ✓ Removed obsolete permission: {perm['resource']}:{perm['action']}"
                    )
            except Exception as e:
                if verbose:
                    print(
                        f"  ✗ Error removing permission {perm['resource']}:{perm['action']}: {e}"
                    )

    if verbose:
        if removed_count > 0:
            print(f"\n  ✅ Removed {removed_count} obsolete permissions")
        else:
            print("  - No obsolete permissions found")


def report_unknown_permissions(verbose: bool = True):
    """Report permissions present in the database but absent from the canonical
    DEFAULT_PERMISSIONS list.

    These are not deleted automatically — they may be legitimate custom
    permissions created through the UI, or genuine leftovers from a removed
    feature. Add a confirmed leftover to OBSOLETE_RESOURCES to have the repair
    pass delete it on the next run.
    """
    if verbose:
        print("\nChecking for unknown / potentially unused permissions...")

    known = {(resource, action) for resource, action, _ in DEFAULT_PERMISSIONS}
    all_permissions = rbac.list_permissions()

    unknown = [
        perm
        for perm in all_permissions
        if (perm["resource"], perm["action"]) not in known
        and perm["resource"] not in OBSOLETE_RESOURCES
    ]

    if not verbose:
        return unknown

    if unknown:
        print(
            f"  ⚠️  Found {len(unknown)} permission(s) not in the canonical list "
            "(review and add to OBSOLETE_RESOURCES if truly unused):"
        )
        for perm in unknown:
            print(f"     - {perm['resource']}:{perm['action']}")
    else:
        print("  - No unknown permissions found")

    return unknown


def remove_all_rbac_data(verbose: bool = True):
    """Remove all existing RBAC entries from the database.

    This function removes all RBAC data in the correct order to respect
    foreign key constraints:
    1. User-permission overrides
    2. User-role assignments
    3. Role-permission assignments
    4. Roles
    5. Permissions

    Args:
        verbose: If True, print progress messages
    """
    if verbose:
        print("\n" + "=" * 60)
        print("⚠️  REMOVING ALL EXISTING RBAC DATA")
        print("=" * 60 + "\n")

    # Step 1: Remove all user-permission overrides
    if verbose:
        print("Step 1: Removing user-permission overrides...")

    # Get all users and remove their permission overrides
    all_users: list = []
    try:
        all_users = user_db.get_all_users(include_inactive=True)
        override_count = 0

        for user in all_users:
            user_id = user["id"]
            overrides = rbac.get_user_permission_overrides(user_id)
            for override in overrides:
                rbac.remove_permission_from_user(user_id, override["id"])
                override_count += 1

        if verbose:
            print(f"  ✓ Removed {override_count} user-permission overrides\n")
    except Exception as e:
        if verbose:
            print(f"  ✗ Error removing user-permission overrides: {e}\n")

    # Step 2: Remove all user-role assignments
    if verbose:
        print("Step 2: Removing user-role assignments...")

    try:
        assignment_count = 0
        for user in all_users:
            user_id = user["id"]
            user_roles = rbac.get_user_roles(user_id)
            for role in user_roles:
                rbac.remove_role_from_user(user_id, role["id"])
                assignment_count += 1

        if verbose:
            print(f"  ✓ Removed {assignment_count} user-role assignments\n")
    except Exception as e:
        if verbose:
            print(f"  ✗ Error removing user-role assignments: {e}\n")

    # Step 3: Remove all role-permission assignments
    if verbose:
        print("Step 3: Removing role-permission assignments...")

    try:
        all_roles = rbac.list_roles()
        role_perm_count = 0

        for role in all_roles:
            role_permissions = rbac.get_role_permissions(role["id"])
            for perm in role_permissions:
                rbac.remove_permission_from_role(role["id"], perm["id"])
                role_perm_count += 1

        if verbose:
            print(f"  ✓ Removed {role_perm_count} role-permission assignments\n")
    except Exception as e:
        if verbose:
            print(f"  ✗ Error removing role-permission assignments: {e}\n")

    # Step 4: Delete all roles
    if verbose:
        print("Step 4: Deleting all roles...")

    try:
        all_roles = rbac.list_roles()
        deleted_roles = 0

        for role in all_roles:
            try:
                # Try to delete the role (will work for non-system roles)
                rbac.delete_role(role["id"])
                deleted_roles += 1
                if verbose:
                    print(f"  ✓ Deleted role: {role['name']}")
            except (ValueError, RBACConstraintError) as e:
                # System roles can't be deleted normally, bypass the service check
                if "Cannot delete system role" in str(e):
                    if rbac._rbac_repo.delete_role(role["id"]):
                        deleted_roles += 1
                        if verbose:
                            print(f"  ✓ Deleted system role: {role['name']}")
                else:
                    if verbose:
                        print(f"  ✗ Error deleting role {role['name']}: {e}")

        if verbose:
            print(f"\n  ✓ Deleted {deleted_roles} roles\n")
    except Exception as e:
        if verbose:
            print(f"  ✗ Error deleting roles: {e}\n")

    # Step 5: Delete all permissions
    if verbose:
        print("Step 5: Deleting all permissions...")

    try:
        all_permissions = rbac.list_permissions()
        deleted_perms = 0

        for perm in all_permissions:
            try:
                rbac.delete_permission(perm["id"])
                deleted_perms += 1
                if verbose:
                    print(
                        f"  ✓ Deleted permission: {perm['resource']}:{perm['action']}"
                    )
            except Exception as e:
                if verbose:
                    print(
                        f"  ✗ Error deleting permission {perm['resource']}:{perm['action']}: {e}"
                    )

        if verbose:
            print(f"\n  ✓ Deleted {deleted_perms} permissions\n")
    except Exception as e:
        if verbose:
            print(f"  ✗ Error deleting permissions: {e}\n")

    if verbose:
        print("=" * 60)
        print("✅ All RBAC data removed successfully!")
        print("=" * 60 + "\n")


def seed_permissions(verbose: bool = True):
    """Create all default permissions."""
    if verbose:
        print("Creating permissions...")

    created_count = 0
    for resource, action, description in DEFAULT_PERMISSIONS:
        try:
            rbac.create_permission(resource, action, description)
            created_count += 1
            if verbose:
                print(f"  ✓ Created permission: {resource}:{action}")
        except (ValueError, RBACConflictError) as e:
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
        except (ValueError, RBACConflictError) as e:
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
        "nautobot.csv_updates:read",
        "nautobot.csv_updates:execute",
        "settings.nautobot:read",
        "settings.server:read",
        "settings.server:write",
        # Defaults (read-only; needed for the CSV Updates profile picker,
        # granted explicitly here rather than via the settings.common
        # migration since operator never held settings.common)
        "settings.defaults:read",
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
        # Network Backup
        "network.backup:read",
        "network.backup:write",
        # Inventory
        "general.inventory:read",
        "general.inventory:write",
        # Network
        "network.templates:read",
        "network.clients:read",
        # Servers
        "servers:read",
        "servers:write",
        # Snapshots
        "snapshots:read",
        "snapshots:write",
        # Scan & Add
        "scan:execute",
        "nautobot.onboard:execute",
        "nautobot.offboard:execute",
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
        # Dashboard
        "dashboard.settings:read",
        # Nautobot
        "nautobot.devices:read",
        "nautobot.devices:write",
        "nautobot.locations:read",
        "nautobot.locations:write",
        "nautobot.export:execute",
        "nautobot.export:read",
        "nautobot.csv_updates:read",
        "nautobot.csv_updates:write",
        "nautobot.csv_updates:execute",
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
        "configs.search:execute",
        # Network Backup (full access)
        "network.backup:read",
        "network.backup:write",
        # Inventory (full access)
        "general.inventory:read",
        "general.inventory:write",
        "general.inventory:delete",
        # Network (full access)
        "network.templates:read",
        "network.templates:write",
        "network.templates:delete",
        "network.netmiko:execute",
        "network.ping:execute",
        "network.scan:execute",
        "network.clients:read",
        # Servers
        "servers:read",
        "servers:write",
        "servers:delete",
        # Snapshots (full access)
        "snapshots:read",
        "snapshots:write",
        "snapshots:delete",
        # Git
        "git.repositories:read",
        "git.operations:execute",
        # Scan & Add
        "scan:execute",
        "nautobot.onboard:execute",
        "nautobot.offboard:execute",
        # Settings (read-only)
        "settings.cache:read",
        "settings.credentials:read",
        "settings.templates:read",
        "settings.nautobot:read",
        "settings.server:read",
        "settings.server:write",
        # Defaults (read-only; needed for the CSV Updates profile picker,
        # granted explicitly here rather than via the settings.common
        # migration since network_engineer never held settings.common)
        "settings.defaults:read",
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

    # Viewer: Read-only access to everything except user management and sensitive settings
    if verbose:
        print("\n  Assigning permissions to 'viewer' role...")
    viewer_count = 0
    for perm_key, perm_id in perm_map.items():
        # Grant all read permissions, skip write/delete/execute
        # Exclude sensitive permissions: users, settings.credentials, settings.defaults
        if (
            (
                ":read" in perm_key
                or (
                    ":execute" not in perm_key
                    and ":write" not in perm_key
                    and ":delete" not in perm_key
                    and "users" not in perm_key
                )
            )
            and "settings.defaults" not in perm_key
            and "settings.credentials" not in perm_key
        ):
            rbac.assign_permission_to_role(roles["viewer"]["id"], perm_id, granted=True)
            viewer_count += 1
    if verbose:
        print(f"    ✓ Assigned {viewer_count} permissions")

    if verbose:
        print("\n✅ Permission assignment complete\n")


def assign_admin_user_to_admin_role(verbose: bool = True):
    """Assign the 'admin' user to the 'admin' role."""
    if verbose:
        print("Assigning admin user to admin role...")

    try:
        # Get admin user
        admin_user = user_db.get_user_by_username("admin")
        if not admin_user:
            if verbose:
                print("  ⚠️  Admin user not found, skipping role assignment")
            return

        # Get admin role
        admin_role = rbac.get_role_by_name("admin")
        if not admin_role:
            if verbose:
                print("  ⚠️  Admin role not found, skipping role assignment")
            return

        # Check if assignment already exists
        existing_roles = rbac.get_user_roles(admin_user["id"])
        if any(role["id"] == admin_role["id"] for role in existing_roles):
            if verbose:
                print("  - Admin user already has admin role")
            return

        # Assign admin role to admin user
        rbac.assign_role_to_user(admin_user["id"], admin_role["id"])
        if verbose:
            print(
                f"  ✓ Assigned 'admin' role to user 'admin' (user_id={admin_user['id']})"
            )

    except Exception as e:
        if verbose:
            print(f"  ⚠️  Error assigning admin role: {e}")


def main(verbose: bool = True, remove_existing: bool = False):
    """Run the seeding process.

    Args:
        verbose: If True, print progress messages. If False, run silently.
        remove_existing: If True, remove all existing RBAC data before seeding.
    """
    if verbose:
        print("\n" + "=" * 60)
        print("RBAC System Initialization")
        print("=" * 60 + "\n")

    # Remove existing RBAC data if requested
    if remove_existing:
        remove_all_rbac_data(verbose=verbose)

    # Create permissions
    seed_permissions(verbose=verbose)

    # Create roles
    roles = seed_roles(verbose=verbose)

    # Assign permissions to roles
    assign_permissions_to_roles(roles, verbose=verbose)

    # Assign admin user to admin role
    assign_admin_user_to_admin_role(verbose=verbose)

    # Run migration / repair for existing systems (only if not removing all data)
    if not remove_existing:
        migrate_inventory_permissions(verbose=verbose)
        migrate_common_settings_permissions(verbose=verbose)

        # Cleanup obsolete permissions (after migration is complete)
        cleanup_obsolete_permissions(verbose=verbose)

        # Surface any remaining permissions not in the canonical list
        report_unknown_permissions(verbose=verbose)

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
    parser = argparse.ArgumentParser(
        description="Seed the RBAC system with default permissions and roles"
    )
    parser.add_argument(
        "--remove-existing-permissions",
        action="store_true",
        help="Remove all existing RBAC data before seeding (WARNING: This will remove all roles, permissions, and assignments)",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Run silently without progress messages",
    )

    args = parser.parse_args()

    # Confirm removal if requested
    if args.remove_existing_permissions:
        print("\n⚠️  WARNING: This will remove ALL existing RBAC data including:")
        print("   - All user-role assignments")
        print("   - All user-permission overrides")
        print("   - All roles (including system roles)")
        print("   - All permissions")
        print("\n   The system will then be reseeded with default data.")
        print("\n   Users will need to be reassigned to roles after this operation.\n")

        response = (
            input("Are you sure you want to continue? (yes/no): ").strip().lower()
        )
        if response != "yes":
            print("\n❌ Operation cancelled.")
            sys.exit(0)

    main(verbose=not args.quiet, remove_existing=args.remove_existing_permissions)
