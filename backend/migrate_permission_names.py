"""Migration script to rename permissions for consistency.

This script renames:
- nautobot.settings -> settings.nautobot
- checkmk.settings -> settings.checkmk

All settings permissions should now have the prefix 'settings.*'
"""

import rbac_manager as rbac


def migrate_permission_names():
    """Rename permissions to use consistent naming."""
    renames = [
        ("nautobot.settings", "settings.nautobot"),
        ("checkmk.settings", "settings.checkmk"),
    ]

    print("Migrating permission names...")

    for old_name, new_name in renames:
        # Get all permissions with the old resource name
        all_perms = rbac.list_permissions()
        perms_to_update = [p for p in all_perms if p["resource"] == old_name]

        for perm in perms_to_update:
            print(
                f"  Renaming: {old_name}:{perm['action']} -> {new_name}:{perm['action']}"
            )

            # Update the permission resource name directly in the database
            try:
                with rbac._get_conn() as conn:
                    conn.execute(
                        "UPDATE permissions SET resource = ? WHERE id = ?",
                        (new_name, perm["id"]),
                    )
                    conn.commit()
                print(f"    ✓ Renamed permission ID {perm['id']}")
            except Exception as e:
                print(f"    ✗ Error: {e}")

    print("\nMigration complete!")
    print("\nUpdated permissions:")
    settings_perms = [
        p for p in rbac.list_permissions() if p["resource"].startswith("settings.")
    ]
    for p in sorted(settings_perms, key=lambda x: (x["resource"], x["action"])):
        print(f"  - {p['resource']}:{p['action']}")


if __name__ == "__main__":
    migrate_permission_names()
