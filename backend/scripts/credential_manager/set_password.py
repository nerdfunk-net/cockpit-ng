#!/usr/bin/env python3
"""Set a new Cockpit login password for a named user.

Usage:
    python set_password.py --username USERNAME [--password PASSWORD]

If --password is not supplied, you will be prompted to enter and confirm it
interactively (input is hidden via getpass).

Passwords are hashed with passlib PBKDF2-SHA256 and a random per-user salt.
They are NOT tied to SECRET_KEY and are safe across key rotations.
"""

from __future__ import annotations

import sys
import argparse
import getpass
from pathlib import Path

# ---------------------------------------------------------------------------
# Add backend root to sys.path so all backend modules resolve correctly
# ---------------------------------------------------------------------------
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from user_db_manager import get_user_by_username, update_user  # noqa: E402

_MIN_PASSWORD_LENGTH = 8


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Set a new Cockpit login password for a named user."
    )
    parser.add_argument(
        "--username",
        required=True,
        help="The Cockpit username whose password will be updated.",
    )
    parser.add_argument(
        "--password",
        default=None,
        help=(
            "New plaintext password.  "
            "If omitted, you will be prompted interactively (input is hidden)."
        ),
    )
    args = parser.parse_args()

    # ------------------------------------------------------------------
    # Look up user
    # ------------------------------------------------------------------
    user = get_user_by_username(args.username)
    if not user:
        print(f"ERROR: User '{args.username}' not found or is inactive.")
        sys.exit(1)

    print(f"Setting password for user: {user['username']} (id={user['id']})")

    # ------------------------------------------------------------------
    # Obtain new password
    # ------------------------------------------------------------------
    if args.password:
        new_password = args.password
    else:
        while True:
            try:
                new_password = getpass.getpass("New password: ")
                confirm = getpass.getpass("Confirm password: ")
            except (EOFError, KeyboardInterrupt):
                print("\nAborted.")
                sys.exit(0)

            if new_password == confirm:
                break
            print("Passwords do not match. Please try again.\n")

    # ------------------------------------------------------------------
    # Validate
    # ------------------------------------------------------------------
    if len(new_password) < _MIN_PASSWORD_LENGTH:
        print(
            f"ERROR: Password must be at least {_MIN_PASSWORD_LENGTH} characters long."
        )
        sys.exit(1)

    # ------------------------------------------------------------------
    # Update — update_user hashes the plaintext password via get_password_hash()
    # ------------------------------------------------------------------
    result = update_user(user["id"], password=new_password)
    if not result:
        print("ERROR: Failed to update password.")
        sys.exit(1)

    print(f"Password updated successfully for '{args.username}'.")


if __name__ == "__main__":
    main()
