"""User profile management system.

Extends the credentials system to include user profile information.
"""

from __future__ import annotations
import os
import sqlite3
from datetime import datetime
from typing import Any, Dict, Optional
from config import settings as config_settings

DB_PATH = os.path.join(
    config_settings.data_directory, "settings", "cockpit_settings.db"
)


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _ensure_profile_table() -> None:
    """Create user_profiles table if it doesn't exist."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with _get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                realname TEXT,
                email TEXT,
                debug_mode INTEGER NOT NULL DEFAULT 0,
                api_key TEXT DEFAULT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

        # Add api_key column if it doesn't exist (for existing installations)
        try:
            conn.execute("SELECT api_key FROM user_profiles LIMIT 1")
        except sqlite3.OperationalError:
            # Column doesn't exist, add it
            conn.execute(
                "ALTER TABLE user_profiles ADD COLUMN api_key TEXT DEFAULT NULL"
            )

        conn.commit()


def get_user_profile(username: str) -> Optional[Dict[str, Any]]:
    """Get user profile by username."""
    _ensure_profile_table()

    with _get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM user_profiles WHERE username = ?", (username,)
        ).fetchone()

        if row:
            return {
                "id": row["id"],
                "username": row["username"],
                "realname": row["realname"],
                "email": row["email"],
                "debug": bool(row["debug_mode"]),
                "api_key": row["api_key"],
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
            }

        # Return default profile if none exists
        return {
            "username": username,
            "realname": "",
            "email": "",
            "debug": False,
            "api_key": None,
        }


def update_user_profile(
    username: str,
    realname: Optional[str] = None,
    email: Optional[str] = None,
    debug_mode: Optional[bool] = None,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """Update or create user profile."""
    _ensure_profile_table()

    now = datetime.utcnow().isoformat()

    with _get_conn() as conn:
        # Check if profile exists
        existing = conn.execute(
            "SELECT id FROM user_profiles WHERE username = ?", (username,)
        ).fetchone()

        if existing:
            # Update existing profile
            updates = []
            params = []

            if realname is not None:
                updates.append("realname = ?")
                params.append(realname)

            if email is not None:
                updates.append("email = ?")
                params.append(email)

            if debug_mode is not None:
                updates.append("debug_mode = ?")
                params.append(1 if debug_mode else 0)

            if api_key is not None:
                updates.append("api_key = ?")
                params.append(api_key)

            updates.append("updated_at = ?")
            params.append(now)
            params.append(username)

            conn.execute(
                f"UPDATE user_profiles SET {', '.join(updates)} WHERE username = ?",
                params,
            )
        else:
            # Create new profile
            conn.execute(
                """
                INSERT INTO user_profiles (username, realname, email, debug_mode, api_key, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    username,
                    realname or "",
                    email or "",
                    1 if debug_mode else 0,
                    api_key,
                    now,
                    now,
                ),
            )

        conn.commit()

    # Return updated profile
    return get_user_profile(username)


def update_user_password(username: str, new_password: str) -> bool:
    """Update user password in credentials table."""
    import credentials_manager as cred_mgr

    try:
        # Find the user's credential
        credentials = cred_mgr.list_credentials(include_expired=False)
        user_cred = None

        for cred in credentials:
            if cred["username"] == username and cred["status"] == "active":
                user_cred = cred
                break

        if user_cred:
            # Update existing credential
            cred_mgr.update_credential(cred_id=user_cred["id"], password=new_password)
            return True
        else:
            # Create new credential if none exists
            cred_mgr.create_credential(
                name=f"{username} User Account",
                username=username,
                cred_type="generic",
                password=new_password,
                valid_until=None,
            )
            return True

    except Exception as e:
        print(f"Error updating password for {username}: {e}")
        return False


# Initialize profile table on import
_ensure_profile_table()
