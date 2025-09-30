#!/usr/bin/env python3
"""Script to reset admin password in users.db.

This script allows you to reset the admin user's password in the users database.
"""

from __future__ import annotations
import os
import sys
import getpass
from pathlib import Path

# Add backend directory to path for imports
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from config import settings as config_settings  # noqa: E402
from core.auth import get_password_hash  # noqa: E402
from user_db_manager import PERMISSIONS_ADMIN  # noqa: E402
import sqlite3  # noqa: E402


def main():
    """Reset admin password."""
    print("=" * 60)
    print("Admin Password Reset")
    print("=" * 60)
    print()

    # Get database path
    users_db_path = os.path.join(config_settings.data_directory, "settings", "users.db")

    # Check if database exists
    if not os.path.exists(users_db_path):
        print(f"Error: Users database not found at {users_db_path}")
        print("Please run the application at least once to initialize the database.")
        sys.exit(1)

    # Connect to database
    try:
        conn = sqlite3.connect(users_db_path)
        conn.row_factory = sqlite3.Row
    except Exception as e:
        print(f"Error: Failed to connect to database: {e}")
        sys.exit(1)

    # Check if admin user exists
    try:
        admin_user = conn.execute(
            "SELECT id, username FROM users WHERE username = 'admin'"
        ).fetchone()

        if not admin_user:
            print("Error: Admin user not found in database.")
            print("Creating admin user...")
            # User doesn't exist, we'll create it
            admin_exists = False
        else:
            admin_exists = True
            print(f"Found admin user (ID: {admin_user['id']})")
            print()
    except Exception as e:
        print(f"Error: Failed to query database: {e}")
        conn.close()
        sys.exit(1)

    # Prompt for new password
    print("Enter new admin password:")
    password = getpass.getpass("Password: ")

    if not password:
        print("Error: Password cannot be empty.")
        conn.close()
        sys.exit(1)

    print("Confirm password:")
    password_confirm = getpass.getpass("Password: ")

    if password != password_confirm:
        print("Error: Passwords do not match.")
        conn.close()
        sys.exit(1)

    # Hash the password
    try:
        hashed_password = get_password_hash(password)
    except Exception as e:
        print(f"Error: Failed to hash password: {e}")
        conn.close()
        sys.exit(1)

    # Update or create admin user
    try:
        from datetime import datetime

        now = datetime.utcnow().isoformat()

        if admin_exists:
            # Update existing admin user with password and admin permissions
            conn.execute(
                "UPDATE users SET password = ?, permissions = ?, updated_at = ? WHERE username = 'admin'",
                (hashed_password, PERMISSIONS_ADMIN, now),
            )
            conn.commit()
            print()
            print("✓ Admin password and permissions updated successfully!")
        else:
            # Create admin user with full permissions
            conn.execute(
                """
                INSERT INTO users (username, realname, email, password, permissions, debug, is_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "admin",
                    "System Administrator",
                    "admin@localhost",
                    hashed_password,
                    PERMISSIONS_ADMIN,
                    1,
                    1,
                    now,
                    now,
                ),
            )
            conn.commit()
            print()
            print("✓ Admin user created successfully!")

    except Exception as e:
        print(f"Error: Failed to update password: {e}")
        conn.close()
        sys.exit(1)

    conn.close()
    print()
    print("You can now login with:")
    print("  Username: admin")
    print("  Password: <your new password>")
    print()


if __name__ == "__main__":
    main()
