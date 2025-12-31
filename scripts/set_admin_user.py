#!/usr/bin/env python3
"""Create or add an admin user directly into the users.db.

This script does not call any backend HTTP endpoints and can be
run locally without authentication. It uses the project's
`user_db_manager` module to create the user so password hashing and
schema creation stay consistent.

Usage: python ./scripts/set_admin_user.py
"""

from __future__ import annotations

import getpass
import os
import sys
from typing import Optional


def _prepend_backend_to_path() -> None:
    """Ensure the backend directory is importable so we can import
    project modules (user_db_manager) without installing the package.
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.path.dirname(script_dir)
    backend_path = os.path.join(repo_root, "backend")
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)


def prompt_non_empty(prompt: str, default: Optional[str] = None) -> str:
    while True:
        value = input(f"{prompt}" + (f" [{default}]" if default else "") + ": ").strip()
        if not value and default is not None:
            return default
        if value:
            return value


def main() -> None:
    _prepend_backend_to_path()

    try:
        import user_db_manager
    except Exception as e:  # pragma: no cover - defensive message
        print("Failed to import backend user manager:", e)
        sys.exit(2)

    print("Create admin user for cockpit-ng (writes directly to users.db)")

    # Check for existing admin users and offer to remove them
    try:
        admins = [
            u
            for u in user_db_manager.get_all_users(include_inactive=True)
            if u.get("permissions") == user_db_manager.PERMISSIONS_ADMIN
        ]
    except Exception:
        admins = []

    if admins:
        print("Found existing admin user(s):")
        for a in admins:
            print(f"  - {a['username']} (id={a['id']})")
        resp = (
            input("Remove existing admin user(s) before creating a new one? (y/N): ")
            .strip()
            .lower()
        )
        if resp == "y":
            for a in admins:
                try:
                    # Permanently remove admin user
                    user_db_manager.hard_delete_user(a["id"])
                    print(f"Removed admin user {a['username']} (id={a['id']})")
                except Exception as e:
                    print(f"Failed to remove user {a['username']} (id={a['id']}): {e}")
        else:
            print(
                "Keeping existing admin user(s). You can still create another admin if desired."
            )

    username = prompt_non_empty("Enter username")
    realname = (
        input("Enter real name (optional, press Enter to use username): ").strip()
        or username
    )
    email = input("Enter email (optional): ").strip() or None

    # Password prompt with confirmation
    while True:
        password = getpass.getpass("Enter password: ")
        if not password:
            print("Password cannot be empty")
            continue
        if len(password) < 4:
            print("Password must be at least 4 characters long")
            continue
        password_confirm = getpass.getpass("Confirm password: ")
        if password != password_confirm:
            print("Passwords do not match, try again")
            continue
        break

    try:
        # Check if user already exists
        existing = user_db_manager.get_user_by_username(username)
        if existing:
            print(f"User '{username}' already exists (id={existing['id']}).")
            overwrite = (
                input("Do you want to overwrite the existing user (y/N)? ")
                .strip()
                .lower()
            )
            if overwrite != "y":
                print("Aborting.")
                sys.exit(0)
            # If overwrite, update the user using update_user
            user_id = existing["id"]
            user_db_manager.update_user(
                user_id=user_id,
                realname=realname,
                email=email,
                password=password,
                permissions=user_db_manager.PERMISSIONS_ADMIN,
                debug=False,
                is_active=True,
            )
            print(f"Updated existing user '{username}' (id={user_id}) as admin.")
        else:
            # Create new admin user
            user_db_manager.create_user(
                username=username,
                realname=realname,
                password=password,
                email=email,
                permissions=user_db_manager.PERMISSIONS_ADMIN,
                debug=False,
            )
            print(f"Created admin user '{username}'")

    except Exception as e:
        print("Error creating/updating admin user:", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
