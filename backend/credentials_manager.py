"""Credential storage and encryption manager.

Encrypted credential storage using SECRET_KEY-derived key.
"""
from __future__ import annotations
import base64
import hashlib
import os
import sqlite3
from datetime import datetime, date
from typing import Any, Dict, List, Optional
from cryptography.fernet import Fernet, InvalidToken
from config import settings as config_settings

DB_PATH = os.path.join(config_settings.data_directory, "settings", "cockpit_settings.db")

def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def _ensure_table() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with _get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS credentials (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                username TEXT NOT NULL,
                type TEXT NOT NULL CHECK(type IN ('ssh','tacacs','generic','token')),
                password_encrypted BLOB NOT NULL,
                valid_until TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


def _create_initial_credential() -> None:
    """Create initial credential on first startup if none exist."""
    try:
        with _get_conn() as conn:
            # Check if any credentials exist
            cursor = conn.execute("SELECT COUNT(*) FROM credentials")
            count = cursor.fetchone()[0]
            
            if count == 0:
                # No credentials exist, create initial one from environment
                initial_username = config_settings.initial_username
                initial_password = config_settings.initial_password
                
                if initial_username and initial_password:
                    encrypted = encryption_service.encrypt(initial_password)
                    now = datetime.utcnow().isoformat()
                    
                    conn.execute("""
                        INSERT INTO credentials (name, username, type, password_encrypted, valid_until, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (
                        "Initial Admin Credential",
                        initial_username,
                        "generic",
                        encrypted,
                        None,  # No expiration
                        now,
                        now
                    ))
                    conn.commit()
                    print(f"Created initial credential for user: {initial_username}")
                else:
                    print("Warning: INITIAL_USERNAME or INITIAL_PASSWORD not set, skipping initial credential creation")
    except Exception as e:
        print(f"Warning: Failed to create initial credential: {e}")


def _build_key(secret: str) -> bytes:
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)

class EncryptionService:
    def __init__(self, secret_key: Optional[str] = None):
        secret = secret_key or os.getenv("SECRET_KEY") or config_settings.secret_key
        if not secret:
            raise RuntimeError("SECRET_KEY not set for credential encryption")
        self._fernet = Fernet(_build_key(secret))
    def encrypt(self, plaintext: str) -> bytes:
        return self._fernet.encrypt(plaintext.encode("utf-8"))
    def decrypt(self, token: bytes) -> str:
        try:
            return self._fernet.decrypt(token).decode("utf-8")
        except InvalidToken as e:
            raise ValueError("Failed to decrypt stored credential") from e

encryption_service = EncryptionService()

# Initialize database and create initial credential after encryption service is ready
_ensure_table()
_create_initial_credential()

def _row_to_dict(row: sqlite3.Row) -> Dict[str, Any]:
    valid_until = row["valid_until"]
    status = "active"
    if valid_until:
        try:
            d = datetime.fromisoformat(valid_until).date()
            today = date.today()
            if d < today:
                status = "expired"
            elif (d - today).days <= 7:
                status = "expiring"
        except Exception:
            status = "unknown"
    return {
        "id": row["id"],
        "name": row["name"],
        "username": row["username"],
        "type": row["type"],
        "valid_until": row["valid_until"],
        "is_active": bool(row["is_active"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "status": status,
        "has_password": True,
    }

def list_credentials(include_expired: bool = False) -> List[Dict[str, Any]]:
    with _get_conn() as conn:
        rows = conn.execute("SELECT * FROM credentials ORDER BY name").fetchall()
    items = [_row_to_dict(r) for r in rows]
    if not include_expired:
        items = [i for i in items if i["status"] != "expired"]
    return items

def create_credential(name: str, username: str, cred_type: str, password: str, valid_until: Optional[str]) -> Dict[str, Any]:
    encrypted = encryption_service.encrypt(password)
    now = datetime.utcnow().isoformat()
    with _get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO credentials (name, username, type, password_encrypted, valid_until, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?)
            """,
            (name, username, cred_type, encrypted, valid_until, now, now),
        )
        conn.commit()
        new_id = cur.lastrowid
        row = conn.execute("SELECT * FROM credentials WHERE id = ?", (new_id,)).fetchone()
    return _row_to_dict(row)

def update_credential(cred_id: int, name: Optional[str] = None, username: Optional[str] = None, cred_type: Optional[str] = None, password: Optional[str] = None, valid_until: Optional[str] = None) -> Dict[str, Any]:
    with _get_conn() as conn:
        row = conn.execute("SELECT * FROM credentials WHERE id = ?", (cred_id,)).fetchone()
        if not row:
            raise ValueError("Credential not found")
        new_name = name if name is not None else row["name"]
        new_user = username if username is not None else row["username"]
        new_type = cred_type if cred_type is not None else row["type"]
        new_valid = valid_until if valid_until is not None else row["valid_until"]
        encrypted = row["password_encrypted"]
        if password:
            encrypted = encryption_service.encrypt(password)
        now = datetime.utcnow().isoformat()
        conn.execute(
            """
            UPDATE credentials SET name=?, username=?, type=?, password_encrypted=?, valid_until=?, updated_at=? WHERE id=?
            """,
            (new_name, new_user, new_type, encrypted, new_valid, now, cred_id),
        )
        conn.commit()
        new_row = conn.execute("SELECT * FROM credentials WHERE id = ?", (cred_id,)).fetchone()
    return _row_to_dict(new_row)

def delete_credential(cred_id: int) -> None:
    with _get_conn() as conn:
        conn.execute("DELETE FROM credentials WHERE id = ?", (cred_id,))
        conn.commit()

def get_decrypted_password(cred_id: int) -> str:
    with _get_conn() as conn:
        row = conn.execute("SELECT password_encrypted FROM credentials WHERE id = ?", (cred_id,)).fetchone()
        if not row:
            raise ValueError("Credential not found")
        return encryption_service.decrypt(row["password_encrypted"])
