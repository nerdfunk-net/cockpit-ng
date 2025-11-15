"""Migration script to convert existing users to RBAC system.

This script:
1. Reads all users from the existing user management system
2. Maps their old permission bits to new RBAC roles
3. Assigns appropriate roles to each user
4. Preserves admin status
"""

import rbac_manager as rbac
import user_db_manager as user_db


def map_permissions_to_role(permissions: int) -> str:
    """Map old permission bits to new role name.

    Old system:
    - PERMISSION_READ = 1
    - PERMISSION_WRITE = 2
    - PERMISSION_ADMIN = 4
    - PERMISSION_DELETE = 8
    - PERMISSION_USER_MANAGE = 16
    - PERMISSIONS_ADMIN = 31 (all permissions)
    - PERMISSIONS_USER = 3 (read + write)
    - PERMISSIONS_VIEWER = 1 (read only)
    """
    if permissions == user_db.PERMISSIONS_ADMIN:  # 31
        return "admin"
    elif permissions >= user_db.PERMISSION_WRITE:  # Has write permission
        # Check if they have more advanced permissions
        if permissions >= user_db.PERMISSION_DELETE:
            return "operator"  # Can delete, assign operator role
        else:
            return "network_engineer"  # Write but not delete
    elif permissions == user_db.PERMISSIONS_VIEWER:  # 1 - read only
        return "viewer"
    else:
        # Default to viewer for unknown combinations
        return "viewer"


def migrate_users():
    """Migrate all existing users to RBAC system."""
    print("\n" + "=" * 60)
    print("User Migration to RBAC System")
    print("=" * 60 + "\n")

    # Ensure RBAC is initialized
    try:
        roles = rbac.list_roles()
        if not roles:
            print(
                "ERROR: RBAC system not initialized. Please run seed_rbac.py first.\n"
            )
            return
    except Exception as e:
        print(f"ERROR: RBAC system not available: {e}\n")
        print("Please run: python seed_rbac.py\n")
        return

    # Get all users from old system
    try:
        users = user_db.get_all_users(include_inactive=True)
        print(f"Found {len(users)} users to migrate\n")
    except Exception as e:
        print(f"ERROR: Could not read users: {e}\n")
        return

    if not users:
        print("No users found to migrate.\n")
        return

    # Create role lookup
    role_lookup = {role["name"]: role["id"] for role in roles}

    migrated_count = 0
    skipped_count = 0

    for user in users:
        user_id = user["id"]
        username = user["username"]
        old_permissions = user["permissions"]

        print(f"Processing user: {username} (ID: {user_id})")
        print(f"  Old permissions: {old_permissions}")

        # Check if user already has roles assigned
        existing_roles = rbac.get_user_roles(user_id)
        if existing_roles:
            print(f"  ⚠ User already has {len(existing_roles)} role(s):")
            for role in existing_roles:
                print(f"    - {role['name']}")
            print("  Skipping migration for this user.\n")
            skipped_count += 1
            continue

        # Map to new role
        target_role_name = map_permissions_to_role(old_permissions)
        target_role_id = role_lookup.get(target_role_name)

        if not target_role_id:
            print(f"  ✗ Could not find role '{target_role_name}', skipping\n")
            skipped_count += 1
            continue

        # Assign role
        try:
            rbac.assign_role_to_user(user_id, target_role_id)
            print(f"  ✓ Assigned role: {target_role_name}")
            migrated_count += 1
        except Exception as e:
            print(f"  ✗ Error assigning role: {e}")
            skipped_count += 1

        print()

    # Print summary
    print("=" * 60)
    print("Migration Summary")
    print("=" * 60)
    print(f"Total users: {len(users)}")
    print(f"Migrated: {migrated_count}")
    print(f"Skipped: {skipped_count}")
    print()

    # Show role distribution
    print("Role Distribution:")
    for role_name in ["admin", "operator", "network_engineer", "viewer"]:
        role = rbac.get_role_by_name(role_name)
        if role:
            user_count = len(rbac.get_users_with_role(role["id"]))
            print(f"  - {role_name}: {user_count} users")
    print()

    if migrated_count > 0:
        print("✅ Migration completed successfully!")
    else:
        print("⚠ No users were migrated.")
    print()


def verify_migration():
    """Verify that all users have at least one role assigned."""
    print("\n" + "=" * 60)
    print("Verification")
    print("=" * 60 + "\n")

    users = user_db.get_all_users(include_inactive=True)
    users_without_roles = []

    for user in users:
        user_id = user["id"]
        username = user["username"]
        roles = rbac.get_user_roles(user_id)

        if not roles:
            users_without_roles.append(username)

    if users_without_roles:
        print(f"⚠ Warning: {len(users_without_roles)} users have no roles assigned:")
        for username in users_without_roles:
            print(f"  - {username}")
        print()
    else:
        print("✅ All users have at least one role assigned.\n")


def main():
    """Run migration and verification."""
    migrate_users()
    verify_migration()


if __name__ == "__main__":
    main()
