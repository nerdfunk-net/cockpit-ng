"""Compliance settings and credential storage manager.

Manages compliance configurations including regex patterns, login credentials, and SNMP settings.
"""

from __future__ import annotations
import base64
import hashlib
import os
import sqlite3
import yaml
from datetime import datetime
from typing import Any, Dict, List, Optional
from cryptography.fernet import Fernet, InvalidToken
from config import settings as config_settings

DB_PATH = os.path.join(config_settings.data_directory, "settings", "compliance.db")


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _build_key(secret: str) -> bytes:
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


class EncryptionService:
    def __init__(self, secret_key: Optional[str] = None):
        secret = secret_key or os.getenv("SECRET_KEY") or config_settings.secret_key
        if not secret:
            raise RuntimeError("SECRET_KEY not set for credential encryption")
        self.fernet = Fernet(_build_key(secret))

    def encrypt(self, plaintext: str) -> bytes:
        return self.fernet.encrypt(plaintext.encode("utf-8"))

    def decrypt(self, encrypted: bytes) -> str:
        try:
            return self.fernet.decrypt(encrypted).decode("utf-8")
        except InvalidToken:
            raise ValueError("Decryption failed: invalid token or key")


encryption_service = EncryptionService()


def _ensure_tables() -> None:
    """Create compliance database tables if they don't exist."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with _get_conn() as conn:
        # Regex patterns table - for must match and must not match patterns
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS regex_patterns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pattern TEXT NOT NULL,
                description TEXT,
                pattern_type TEXT NOT NULL CHECK(pattern_type IN ('must_match','must_not_match')),
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

        # Login credentials table - for compliance testing
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS login_credentials (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                username TEXT NOT NULL,
                password_encrypted BLOB NOT NULL,
                description TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

        # SNMP mapping table - similar to CheckMK SNMP mapping
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS snmp_mapping (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                device_type TEXT NOT NULL,
                snmp_community TEXT,
                snmp_version TEXT NOT NULL CHECK(snmp_version IN ('v1','v2c','v3')),
                snmp_v3_user TEXT,
                snmp_v3_auth_protocol TEXT,
                snmp_v3_auth_password_encrypted BLOB,
                snmp_v3_priv_protocol TEXT,
                snmp_v3_priv_password_encrypted BLOB,
                description TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

        # Migrate existing tables to add 'name' column if it doesn't exist
        _migrate_add_name_columns(conn)

        conn.commit()


def _migrate_add_name_columns(conn) -> None:
    """Add 'name' column to existing tables if they don't have it."""
    try:
        # Check if login_credentials has 'name' column
        cursor = conn.execute("PRAGMA table_info(login_credentials)")
        columns = [row[1] for row in cursor.fetchall()]
        if 'name' not in columns:
            # Add name column and populate with username
            conn.execute("ALTER TABLE login_credentials ADD COLUMN name TEXT")
            conn.execute("UPDATE login_credentials SET name = username WHERE name IS NULL")
            conn.execute("UPDATE login_credentials SET name = username || ' (' || id || ')' WHERE name IS NULL OR name = ''")
    except Exception as e:
        # Table might not exist yet, which is fine
        pass

    try:
        # Check if snmp_mapping has 'name' column
        cursor = conn.execute("PRAGMA table_info(snmp_mapping)")
        columns = [row[1] for row in cursor.fetchall()]
        if 'name' not in columns:
            # Add name column and populate with device_type
            conn.execute("ALTER TABLE snmp_mapping ADD COLUMN name TEXT")
            conn.execute("UPDATE snmp_mapping SET name = device_type WHERE name IS NULL")
            conn.execute("UPDATE snmp_mapping SET name = device_type || ' (' || id || ')' WHERE name IS NULL OR name = ''")
    except Exception as e:
        # Table might not exist yet, which is fine
        pass


# Initialize database on module import
_ensure_tables()


# ============================================================================
# Regex Pattern Management
# ============================================================================


def get_all_regex_patterns() -> List[Dict[str, Any]]:
    """Get all regex patterns."""
    with _get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, pattern, description, pattern_type, is_active, created_at, updated_at
            FROM regex_patterns
            ORDER BY pattern_type, created_at DESC
            """
        ).fetchall()
        return [dict(row) for row in rows]


def get_regex_patterns_by_type(pattern_type: str) -> List[Dict[str, Any]]:
    """Get regex patterns filtered by type (must_match or must_not_match)."""
    with _get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, pattern, description, pattern_type, is_active, created_at, updated_at
            FROM regex_patterns
            WHERE pattern_type = ? AND is_active = 1
            ORDER BY created_at DESC
            """,
            (pattern_type,),
        ).fetchall()
        return [dict(row) for row in rows]


def get_regex_pattern_by_id(pattern_id: int) -> Optional[Dict[str, Any]]:
    """Get a specific regex pattern by ID."""
    with _get_conn() as conn:
        row = conn.execute(
            """
            SELECT id, pattern, description, pattern_type, is_active, created_at, updated_at
            FROM regex_patterns
            WHERE id = ?
            """,
            (pattern_id,),
        ).fetchone()
        return dict(row) if row else None


def create_regex_pattern(
    pattern: str, pattern_type: str, description: Optional[str] = None
) -> int:
    """Create a new regex pattern."""
    if pattern_type not in ["must_match", "must_not_match"]:
        raise ValueError("Invalid pattern_type. Must be 'must_match' or 'must_not_match'")

    now = datetime.utcnow().isoformat()
    with _get_conn() as conn:
        cursor = conn.execute(
            """
            INSERT INTO regex_patterns (pattern, description, pattern_type, is_active, created_at, updated_at)
            VALUES (?, ?, ?, 1, ?, ?)
            """,
            (pattern, description, pattern_type, now, now),
        )
        conn.commit()
        return cursor.lastrowid


def update_regex_pattern(
    pattern_id: int,
    pattern: Optional[str] = None,
    description: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> bool:
    """Update an existing regex pattern."""
    updates = []
    values = []

    if pattern is not None:
        updates.append("pattern = ?")
        values.append(pattern)
    if description is not None:
        updates.append("description = ?")
        values.append(description)
    if is_active is not None:
        updates.append("is_active = ?")
        values.append(1 if is_active else 0)

    if not updates:
        return False

    updates.append("updated_at = ?")
    values.append(datetime.utcnow().isoformat())
    values.append(pattern_id)

    with _get_conn() as conn:
        conn.execute(
            f"UPDATE regex_patterns SET {', '.join(updates)} WHERE id = ?", values
        )
        conn.commit()
        return True


def delete_regex_pattern(pattern_id: int) -> bool:
    """Delete a regex pattern."""
    with _get_conn() as conn:
        cursor = conn.execute("DELETE FROM regex_patterns WHERE id = ?", (pattern_id,))
        conn.commit()
        return cursor.rowcount > 0


# ============================================================================
# Login Credentials Management
# ============================================================================


def get_all_login_credentials(decrypt_passwords: bool = False) -> List[Dict[str, Any]]:
    """Get all login credentials. Optionally decrypt passwords."""
    with _get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, name, username, password_encrypted, description, is_active, created_at, updated_at
            FROM login_credentials
            ORDER BY created_at DESC
            """
        ).fetchall()

        credentials = []
        for row in rows:
            cred = dict(row)
            if decrypt_passwords:
                try:
                    cred["password"] = encryption_service.decrypt(
                        cred["password_encrypted"]
                    )
                except Exception as e:
                    cred["password"] = f"[Decryption Error: {str(e)}]"
            else:
                cred["password"] = "********"
            del cred["password_encrypted"]
            credentials.append(cred)

        return credentials


def get_login_credential_by_id(
    credential_id: int, decrypt_password: bool = False
) -> Optional[Dict[str, Any]]:
    """Get a specific login credential by ID."""
    with _get_conn() as conn:
        row = conn.execute(
            """
            SELECT id, name, username, password_encrypted, description, is_active, created_at, updated_at
            FROM login_credentials
            WHERE id = ?
            """,
            (credential_id,),
        ).fetchone()

        if not row:
            return None

        cred = dict(row)
        if decrypt_password:
            try:
                cred["password"] = encryption_service.decrypt(cred["password_encrypted"])
            except Exception as e:
                cred["password"] = f"[Decryption Error: {str(e)}]"
        else:
            cred["password"] = "********"
        del cred["password_encrypted"]

        return cred


def create_login_credential(
    name: str, username: str, password: str, description: Optional[str] = None
) -> int:
    """Create a new login credential with encrypted password."""
    encrypted_password = encryption_service.encrypt(password)
    now = datetime.utcnow().isoformat()

    with _get_conn() as conn:
        cursor = conn.execute(
            """
            INSERT INTO login_credentials (name, username, password_encrypted, description, is_active, created_at, updated_at)
            VALUES (?, ?, ?, ?, 1, ?, ?)
            """,
            (name, username, encrypted_password, description, now, now),
        )
        conn.commit()
        return cursor.lastrowid


def update_login_credential(
    credential_id: int,
    name: Optional[str] = None,
    username: Optional[str] = None,
    password: Optional[str] = None,
    description: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> bool:
    """Update an existing login credential."""
    updates = []
    values = []

    if name is not None:
        updates.append("name = ?")
        values.append(name)
    if username is not None:
        updates.append("username = ?")
        values.append(username)
    if password is not None:
        encrypted_password = encryption_service.encrypt(password)
        updates.append("password_encrypted = ?")
        values.append(encrypted_password)
    if description is not None:
        updates.append("description = ?")
        values.append(description)
    if is_active is not None:
        updates.append("is_active = ?")
        values.append(1 if is_active else 0)

    if not updates:
        return False

    updates.append("updated_at = ?")
    values.append(datetime.utcnow().isoformat())
    values.append(credential_id)

    with _get_conn() as conn:
        conn.execute(
            f"UPDATE login_credentials SET {', '.join(updates)} WHERE id = ?", values
        )
        conn.commit()
        return True


def delete_login_credential(credential_id: int) -> bool:
    """Delete a login credential."""
    with _get_conn() as conn:
        cursor = conn.execute(
            "DELETE FROM login_credentials WHERE id = ?", (credential_id,)
        )
        conn.commit()
        return cursor.rowcount > 0


# ============================================================================
# SNMP Mapping Management
# ============================================================================


def get_all_snmp_mappings(decrypt_passwords: bool = False) -> List[Dict[str, Any]]:
    """Get all SNMP mappings. Optionally decrypt passwords."""
    with _get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, name, device_type, snmp_community, snmp_version,
                   snmp_v3_user, snmp_v3_auth_protocol, snmp_v3_auth_password_encrypted,
                   snmp_v3_priv_protocol, snmp_v3_priv_password_encrypted,
                   description, is_active, created_at, updated_at
            FROM snmp_mapping
            ORDER BY name
            """
        ).fetchall()

        mappings = []
        for row in rows:
            mapping = dict(row)
            if decrypt_passwords:
                try:
                    if mapping["snmp_v3_auth_password_encrypted"]:
                        mapping["snmp_v3_auth_password"] = encryption_service.decrypt(
                            mapping["snmp_v3_auth_password_encrypted"]
                        )
                    if mapping["snmp_v3_priv_password_encrypted"]:
                        mapping["snmp_v3_priv_password"] = encryption_service.decrypt(
                            mapping["snmp_v3_priv_password_encrypted"]
                        )
                except Exception as e:
                    mapping["snmp_v3_auth_password"] = f"[Decryption Error: {str(e)}]"
                    mapping["snmp_v3_priv_password"] = f"[Decryption Error: {str(e)}]"
            else:
                mapping["snmp_v3_auth_password"] = (
                    "********" if mapping["snmp_v3_auth_password_encrypted"] else None
                )
                mapping["snmp_v3_priv_password"] = (
                    "********" if mapping["snmp_v3_priv_password_encrypted"] else None
                )

            del mapping["snmp_v3_auth_password_encrypted"]
            del mapping["snmp_v3_priv_password_encrypted"]
            mappings.append(mapping)

        return mappings


def get_snmp_mapping_by_id(
    mapping_id: int, decrypt_passwords: bool = False
) -> Optional[Dict[str, Any]]:
    """Get a specific SNMP mapping by ID."""
    with _get_conn() as conn:
        row = conn.execute(
            """
            SELECT id, name, device_type, snmp_community, snmp_version,
                   snmp_v3_user, snmp_v3_auth_protocol, snmp_v3_auth_password_encrypted,
                   snmp_v3_priv_protocol, snmp_v3_priv_password_encrypted,
                   description, is_active, created_at, updated_at
            FROM snmp_mapping
            WHERE id = ?
            """,
            (mapping_id,),
        ).fetchone()

        if not row:
            return None

        mapping = dict(row)
        if decrypt_passwords:
            try:
                if mapping["snmp_v3_auth_password_encrypted"]:
                    mapping["snmp_v3_auth_password"] = encryption_service.decrypt(
                        mapping["snmp_v3_auth_password_encrypted"]
                    )
                if mapping["snmp_v3_priv_password_encrypted"]:
                    mapping["snmp_v3_priv_password"] = encryption_service.decrypt(
                        mapping["snmp_v3_priv_password_encrypted"]
                    )
            except Exception as e:
                mapping["snmp_v3_auth_password"] = f"[Decryption Error: {str(e)}]"
                mapping["snmp_v3_priv_password"] = f"[Decryption Error: {str(e)}]"
        else:
            mapping["snmp_v3_auth_password"] = (
                "********" if mapping["snmp_v3_auth_password_encrypted"] else None
            )
            mapping["snmp_v3_priv_password"] = (
                "********" if mapping["snmp_v3_priv_password_encrypted"] else None
            )

        del mapping["snmp_v3_auth_password_encrypted"]
        del mapping["snmp_v3_priv_password_encrypted"]

        return mapping


def create_snmp_mapping(
    name: str,
    device_type: str,
    snmp_version: str,
    snmp_community: Optional[str] = None,
    snmp_v3_user: Optional[str] = None,
    snmp_v3_auth_protocol: Optional[str] = None,
    snmp_v3_auth_password: Optional[str] = None,
    snmp_v3_priv_protocol: Optional[str] = None,
    snmp_v3_priv_password: Optional[str] = None,
    description: Optional[str] = None,
) -> int:
    """Create a new SNMP mapping."""
    if snmp_version not in ["v1", "v2c", "v3"]:
        raise ValueError("Invalid snmp_version. Must be 'v1', 'v2c', or 'v3'")

    # Encrypt passwords if provided
    auth_password_encrypted = (
        encryption_service.encrypt(snmp_v3_auth_password)
        if snmp_v3_auth_password
        else None
    )
    priv_password_encrypted = (
        encryption_service.encrypt(snmp_v3_priv_password)
        if snmp_v3_priv_password
        else None
    )

    now = datetime.utcnow().isoformat()
    with _get_conn() as conn:
        cursor = conn.execute(
            """
            INSERT INTO snmp_mapping (
                name, device_type, snmp_community, snmp_version,
                snmp_v3_user, snmp_v3_auth_protocol, snmp_v3_auth_password_encrypted,
                snmp_v3_priv_protocol, snmp_v3_priv_password_encrypted,
                description, is_active, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
            """,
            (
                name,
                device_type,
                snmp_community,
                snmp_version,
                snmp_v3_user,
                snmp_v3_auth_protocol,
                auth_password_encrypted,
                snmp_v3_priv_protocol,
                priv_password_encrypted,
                description,
                now,
                now,
            ),
        )
        conn.commit()
        return cursor.lastrowid


def update_snmp_mapping(
    mapping_id: int,
    name: Optional[str] = None,
    device_type: Optional[str] = None,
    snmp_version: Optional[str] = None,
    snmp_community: Optional[str] = None,
    snmp_v3_user: Optional[str] = None,
    snmp_v3_auth_protocol: Optional[str] = None,
    snmp_v3_auth_password: Optional[str] = None,
    snmp_v3_priv_protocol: Optional[str] = None,
    snmp_v3_priv_password: Optional[str] = None,
    description: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> bool:
    """Update an existing SNMP mapping."""
    updates = []
    values = []

    if name is not None:
        updates.append("name = ?")
        values.append(name)
    if device_type is not None:
        updates.append("device_type = ?")
        values.append(device_type)
    if snmp_version is not None:
        if snmp_version not in ["v1", "v2c", "v3"]:
            raise ValueError("Invalid snmp_version. Must be 'v1', 'v2c', or 'v3'")
        updates.append("snmp_version = ?")
        values.append(snmp_version)
    if snmp_community is not None:
        updates.append("snmp_community = ?")
        values.append(snmp_community)
    if snmp_v3_user is not None:
        updates.append("snmp_v3_user = ?")
        values.append(snmp_v3_user)
    if snmp_v3_auth_protocol is not None:
        updates.append("snmp_v3_auth_protocol = ?")
        values.append(snmp_v3_auth_protocol)
    if snmp_v3_auth_password is not None:
        encrypted = encryption_service.encrypt(snmp_v3_auth_password)
        updates.append("snmp_v3_auth_password_encrypted = ?")
        values.append(encrypted)
    if snmp_v3_priv_protocol is not None:
        updates.append("snmp_v3_priv_protocol = ?")
        values.append(snmp_v3_priv_protocol)
    if snmp_v3_priv_password is not None:
        encrypted = encryption_service.encrypt(snmp_v3_priv_password)
        updates.append("snmp_v3_priv_password_encrypted = ?")
        values.append(encrypted)
    if description is not None:
        updates.append("description = ?")
        values.append(description)
    if is_active is not None:
        updates.append("is_active = ?")
        values.append(1 if is_active else 0)

    if not updates:
        return False

    updates.append("updated_at = ?")
    values.append(datetime.utcnow().isoformat())
    values.append(mapping_id)

    with _get_conn() as conn:
        conn.execute(
            f"UPDATE snmp_mapping SET {', '.join(updates)} WHERE id = ?", values
        )
        conn.commit()
        return True


def delete_snmp_mapping(mapping_id: int) -> bool:
    """Delete an SNMP mapping."""
    with _get_conn() as conn:
        cursor = conn.execute("DELETE FROM snmp_mapping WHERE id = ?", (mapping_id,))
        conn.commit()
        return cursor.rowcount > 0


def import_snmp_mappings_from_yaml(yaml_content: str) -> Dict[str, Any]:
    """Import SNMP mappings from YAML content (CheckMK format or custom format).
    
    Expected YAML format:
    snmp-id-1:
      version: v3
      type: v3_auth_privacy
      username: user
      group: group
      auth_protocol: SHA
      auth_password: authpass
      privacy_protocol: AES
      privacy_password: privpass
    
    Args:
      yaml_content: YAML string content to parse
    
    Returns:
      Dict with success count, error count, and list of errors
    """
    _ensure_tables()
    
    try:
        yaml_data = yaml.safe_load(yaml_content)
        if not isinstance(yaml_data, dict):
            return {
                "imported": 0,
                "errors": 1,
                "error_details": ["Invalid YAML format: expected dictionary"]
            }
    except yaml.YAMLError as e:
        return {
            "imported": 0,
            "errors": 1,
            "error_details": [f"YAML parsing error: {str(e)}"]
        }
    
    imported = 0
    errors = []
    
    for snmp_id, snmp_config in yaml_data.items():
        try:
            # Extract device type from SNMP ID or use the ID itself
            device_type = snmp_id
            
            # Determine SNMP version
            version_str = snmp_config.get('version', 'v2c')
            if version_str not in ['v1', 'v2c', 'v3']:
                # Try to parse from type field
                type_field = snmp_config.get('type', '')
                if 'v3' in type_field:
                    version_str = 'v3'
                elif 'v2c' in type_field:
                    version_str = 'v2c'
                else:
                    version_str = 'v2c'
            
            # Common fields
            snmp_community = snmp_config.get('community', '')
            description = snmp_config.get('description', f'Imported from YAML: {snmp_id}')
            
            # v3 specific fields
            snmp_v3_user = snmp_config.get('username', '')
            auth_protocol = snmp_config.get('auth_protocol', '')
            auth_password = snmp_config.get('auth_password', '')
            priv_protocol = snmp_config.get('privacy_protocol', snmp_config.get('priv_protocol', ''))
            priv_password = snmp_config.get('privacy_password', snmp_config.get('priv_password', ''))
            
            # Create the SNMP mapping
            create_snmp_mapping(
                device_type=device_type,
                snmp_version=version_str,
                snmp_community=snmp_community if snmp_community else None,
                snmp_v3_user=snmp_v3_user if snmp_v3_user else None,
                snmp_v3_auth_protocol=auth_protocol if auth_protocol else None,
                snmp_v3_auth_password=auth_password if auth_password else None,
                snmp_v3_priv_protocol=priv_protocol if priv_protocol else None,
                snmp_v3_priv_password=priv_password if priv_password else None,
                description=description,
            )
            imported += 1
            
        except Exception as e:
            error_msg = f"Error importing {snmp_id}: {str(e)}"
            errors.append(error_msg)
    
    return {
        "imported": imported,
        "errors": len(errors),
        "error_details": errors
    }
