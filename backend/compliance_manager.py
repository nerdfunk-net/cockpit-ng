"""Compliance settings and credential storage manager.

Manages compliance configurations including regex patterns, login credentials, and SNMP settings.
Migrated to PostgreSQL with repository pattern.
"""

from __future__ import annotations
import base64
import hashlib
import os
import yaml
from typing import Any, Dict, List, Optional
from cryptography.fernet import Fernet, InvalidToken
from config import settings as config_settings

from repositories.compliance_repository import (
    RegexPatternRepository,
    LoginCredentialRepository,
    SNMPMappingRepository,
)

# Initialize repositories
regex_repo = RegexPatternRepository()
login_repo = LoginCredentialRepository()
snmp_repo = SNMPMappingRepository()


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


# Database tables are now managed by SQLAlchemy models in core/models.py
# (RegexPattern, LoginCredential, SNMPMapping)


# ============================================================================
# Helper Functions
# ============================================================================


def _regex_pattern_to_dict(pattern) -> Dict[str, Any]:
    """Convert RegexPattern model to dictionary"""
    return {
        "id": pattern.id,
        "pattern": pattern.pattern,
        "description": pattern.description,
        "pattern_type": pattern.pattern_type,
        "is_active": pattern.is_active,
        "created_at": pattern.created_at.isoformat() if pattern.created_at else None,
        "updated_at": pattern.updated_at.isoformat() if pattern.updated_at else None,
    }


def _login_credential_to_dict(cred, decrypt_password: bool = False) -> Dict[str, Any]:
    """Convert LoginCredential model to dictionary"""
    result = {
        "id": cred.id,
        "name": cred.name,
        "username": cred.username,
        "description": cred.description,
        "is_active": cred.is_active,
        "created_at": cred.created_at.isoformat() if cred.created_at else None,
        "updated_at": cred.updated_at.isoformat() if cred.updated_at else None,
    }
    if decrypt_password and cred.password_encrypted:
        result["password"] = encryption_service.decrypt(cred.password_encrypted)
    return result


def _snmp_mapping_to_dict(mapping, decrypt_passwords: bool = False) -> Dict[str, Any]:
    """Convert SNMPMapping model to dictionary"""
    result = {
        "id": mapping.id,
        "name": mapping.name,
        "snmp_community": mapping.snmp_community,
        "snmp_version": mapping.snmp_version,
        "snmp_v3_user": mapping.snmp_v3_user,
        "snmp_v3_auth_protocol": mapping.snmp_v3_auth_protocol,
        "snmp_v3_priv_protocol": mapping.snmp_v3_priv_protocol,
        "description": mapping.description,
        "is_active": mapping.is_active,
        "created_at": mapping.created_at.isoformat() if mapping.created_at else None,
        "updated_at": mapping.updated_at.isoformat() if mapping.updated_at else None,
    }
    if decrypt_passwords:
        if mapping.snmp_v3_auth_password_encrypted:
            result["snmp_v3_auth_password"] = encryption_service.decrypt(
                mapping.snmp_v3_auth_password_encrypted
            )
        if mapping.snmp_v3_priv_password_encrypted:
            result["snmp_v3_priv_password"] = encryption_service.decrypt(
                mapping.snmp_v3_priv_password_encrypted
            )
    return result


# ============================================================================
# Regex Pattern Management
# ============================================================================


def get_all_regex_patterns() -> List[Dict[str, Any]]:
    """Get all regex patterns."""
    patterns = regex_repo.get_all()
    return [_regex_pattern_to_dict(p) for p in patterns]


def get_regex_patterns_by_type(pattern_type: str) -> List[Dict[str, Any]]:
    """Get regex patterns filtered by type (must_match or must_not_match)."""
    patterns = regex_repo.get_by_type(pattern_type, is_active=True)
    return [_regex_pattern_to_dict(p) for p in patterns]


def get_regex_pattern_by_id(pattern_id: int) -> Optional[Dict[str, Any]]:
    """Get a specific regex pattern by ID."""
    pattern = regex_repo.get_by_id(pattern_id)
    return _regex_pattern_to_dict(pattern) if pattern else None


def create_regex_pattern(
    pattern: str, pattern_type: str, description: Optional[str] = None
) -> int:
    """Create a new regex pattern."""
    if pattern_type not in ["must_match", "must_not_match"]:
        raise ValueError(
            "Invalid pattern_type. Must be 'must_match' or 'must_not_match'"
        )

    new_pattern = regex_repo.create(
        pattern=pattern,
        description=description,
        pattern_type=pattern_type,
        is_active=True,
    )
    return new_pattern.id


def update_regex_pattern(
    pattern_id: int,
    pattern: Optional[str] = None,
    description: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> bool:
    """Update an existing regex pattern."""
    update_data = {}

    if pattern is not None:
        update_data["pattern"] = pattern
    if description is not None:
        update_data["description"] = description
    if is_active is not None:
        update_data["is_active"] = is_active

    if not update_data:
        return False

    updated = regex_repo.update(pattern_id, **update_data)
    return updated is not None


def delete_regex_pattern(pattern_id: int) -> bool:
    """Delete a regex pattern."""
    return regex_repo.delete(pattern_id)


# ============================================================================
# Login Credentials Management
# ============================================================================


def get_all_login_credentials(decrypt_passwords: bool = False) -> List[Dict[str, Any]]:
    """Get all login credentials. Optionally decrypt passwords."""
    credentials = login_repo.get_all()
    result = []
    for cred in credentials:
        cred_dict = _login_credential_to_dict(cred, decrypt_password=decrypt_passwords)
        if not decrypt_passwords:
            cred_dict["password"] = "********"
        result.append(cred_dict)
    return result


def get_login_credential_by_id(
    credential_id: int, decrypt_password: bool = False
) -> Optional[Dict[str, Any]]:
    """Get a specific login credential by ID."""
    cred = login_repo.get_by_id(credential_id)
    if not cred:
        return None

    cred_dict = _login_credential_to_dict(cred, decrypt_password=decrypt_password)
    if not decrypt_password:
        cred_dict["password"] = "********"
    return cred_dict


def create_login_credential(
    name: str, username: str, password: str, description: Optional[str] = None
) -> int:
    """Create a new login credential with encrypted password."""
    encrypted_password = encryption_service.encrypt(password)

    new_cred = login_repo.create(
        name=name,
        username=username,
        password_encrypted=encrypted_password,
        description=description,
        is_active=True,
    )
    return new_cred.id


def update_login_credential(
    credential_id: int,
    name: Optional[str] = None,
    username: Optional[str] = None,
    password: Optional[str] = None,
    description: Optional[str] = None,
    is_active: Optional[bool] = None,
) -> bool:
    """Update an existing login credential."""
    update_data = {}

    if name is not None:
        update_data["name"] = name
    if username is not None:
        update_data["username"] = username
    if password is not None:
        update_data["password_encrypted"] = encryption_service.encrypt(password)
    if description is not None:
        update_data["description"] = description
    if is_active is not None:
        update_data["is_active"] = is_active

    if not update_data:
        return False

    updated = login_repo.update(credential_id, **update_data)
    return updated is not None


def delete_login_credential(credential_id: int) -> bool:
    """Delete a login credential."""
    return login_repo.delete(credential_id)


# ============================================================================
# SNMP Mapping Management
# ============================================================================


def get_all_snmp_mappings(decrypt_passwords: bool = False) -> List[Dict[str, Any]]:
    """Get all SNMP mappings. Optionally decrypt passwords."""
    mappings = snmp_repo.get_all()
    result = []
    for mapping in mappings:
        mapping_dict = _snmp_mapping_to_dict(
            mapping, decrypt_passwords=decrypt_passwords
        )
        if not decrypt_passwords:
            mapping_dict["snmp_v3_auth_password"] = (
                "********" if mapping.snmp_v3_auth_password_encrypted else None
            )
            mapping_dict["snmp_v3_priv_password"] = (
                "********" if mapping.snmp_v3_priv_password_encrypted else None
            )
        result.append(mapping_dict)
    return result


def get_snmp_mapping_by_id(
    mapping_id: int, decrypt_passwords: bool = False
) -> Optional[Dict[str, Any]]:
    """Get a specific SNMP mapping by ID."""
    mapping = snmp_repo.get_by_id(mapping_id)
    if not mapping:
        return None

    mapping_dict = _snmp_mapping_to_dict(mapping, decrypt_passwords=decrypt_passwords)
    if not decrypt_passwords:
        mapping_dict["snmp_v3_auth_password"] = (
            "********" if mapping.snmp_v3_auth_password_encrypted else None
        )
        mapping_dict["snmp_v3_priv_password"] = (
            "********" if mapping.snmp_v3_priv_password_encrypted else None
        )
    return mapping_dict


def create_snmp_mapping(
    name: str,
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

    new_mapping = snmp_repo.create(
        name=name,
        snmp_community=snmp_community,
        snmp_version=snmp_version,
        snmp_v3_user=snmp_v3_user,
        snmp_v3_auth_protocol=snmp_v3_auth_protocol,
        snmp_v3_auth_password_encrypted=auth_password_encrypted,
        snmp_v3_priv_protocol=snmp_v3_priv_protocol,
        snmp_v3_priv_password_encrypted=priv_password_encrypted,
        description=description,
        is_active=True,
    )
    return new_mapping.id


def update_snmp_mapping(
    mapping_id: int,
    name: Optional[str] = None,
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
    update_data = {}

    if name is not None:
        update_data["name"] = name
    if snmp_version is not None:
        if snmp_version not in ["v1", "v2c", "v3"]:
            raise ValueError("Invalid snmp_version. Must be 'v1', 'v2c', or 'v3'")
        update_data["snmp_version"] = snmp_version
    if snmp_community is not None:
        update_data["snmp_community"] = snmp_community
    if snmp_v3_user is not None:
        update_data["snmp_v3_user"] = snmp_v3_user
    if snmp_v3_auth_protocol is not None:
        update_data["snmp_v3_auth_protocol"] = snmp_v3_auth_protocol
    if snmp_v3_auth_password is not None:
        update_data["snmp_v3_auth_password_encrypted"] = encryption_service.encrypt(
            snmp_v3_auth_password
        )
    if snmp_v3_priv_protocol is not None:
        update_data["snmp_v3_priv_protocol"] = snmp_v3_priv_protocol
    if snmp_v3_priv_password is not None:
        update_data["snmp_v3_priv_password_encrypted"] = encryption_service.encrypt(
            snmp_v3_priv_password
        )
    if description is not None:
        update_data["description"] = description
    if is_active is not None:
        update_data["is_active"] = is_active

    if not update_data:
        return False

    updated = snmp_repo.update(mapping_id, **update_data)
    return updated is not None


def delete_snmp_mapping(mapping_id: int) -> bool:
    """Delete an SNMP mapping."""
    return snmp_repo.delete(mapping_id)


def get_snmp_mapping_by_name(name: str) -> Optional[Dict[str, Any]]:
    """Get a specific SNMP mapping by name.

    Args:
        name: The name of the SNMP mapping

    Returns:
        SNMP mapping dict if found, None otherwise
    """
    mapping = snmp_repo.get_by_name(name)
    if not mapping:
        return None

    # Don't decrypt passwords for this function
    mapping_dict = _snmp_mapping_to_dict(mapping, decrypt_passwords=False)
    mapping_dict["snmp_v3_auth_password"] = (
        "********" if mapping.snmp_v3_auth_password_encrypted else None
    )
    mapping_dict["snmp_v3_priv_password"] = (
        "********" if mapping.snmp_v3_priv_password_encrypted else None
    )
    return mapping_dict


def import_snmp_mappings_from_yaml(yaml_content: str) -> Dict[str, Any]:
    """Import SNMP mappings from YAML content (CheckMK format or custom format).

    Expected YAML format (CheckMK style):
    snmp-id-1:
      version: v3
      type: v3_auth_privacy
      username: user
      group: group
      auth_protocol: SHA
      auth_password: authpass
      privacy_protocol: AES
      privacy_password: privpass

    The YAML key (e.g., "snmp-id-1") is used as the SNMP mapping name identifier.
    SNMP credentials are device-type independent.

    Args:
      yaml_content: YAML string content to parse

    Returns:
      Dict with success count, error count, and list of errors
    """
    try:
        yaml_data = yaml.safe_load(yaml_content)
        if not isinstance(yaml_data, dict):
            return {
                "imported": 0,
                "errors": 1,
                "error_details": ["Invalid YAML format: expected dictionary"],
            }
    except yaml.YAMLError as e:
        return {
            "imported": 0,
            "errors": 1,
            "error_details": [f"YAML parsing error: {str(e)}"],
        }

    imported = 0
    skipped = 0
    errors = []

    for snmp_id, snmp_config in yaml_data.items():
        try:
            # Use the YAML key (snmp_id) as the SNMP mapping name identifier
            name = snmp_id

            # Check if this name already exists
            existing = get_snmp_mapping_by_name(name)
            if existing:
                skipped += 1
                errors.append(f"Skipped {snmp_id}: Name already exists")
                continue

            # Determine SNMP version
            version_str = snmp_config.get("version", "v2c")
            if version_str not in ["v1", "v2c", "v3"]:
                # Try to parse from type field
                type_field = snmp_config.get("type", "")
                if "v3" in type_field:
                    version_str = "v3"
                elif "v2c" in type_field:
                    version_str = "v2c"
                else:
                    version_str = "v2c"

            # Common fields
            snmp_community = snmp_config.get("community", "")
            description = snmp_config.get(
                "description", f"Imported from CheckMK: {snmp_id}"
            )

            # v3 specific fields
            snmp_v3_user = snmp_config.get("username", "")
            auth_protocol = snmp_config.get("auth_protocol", "")
            auth_password = snmp_config.get("auth_password", "")
            priv_protocol = snmp_config.get(
                "privacy_protocol", snmp_config.get("priv_protocol", "")
            )
            priv_password = snmp_config.get(
                "privacy_password", snmp_config.get("priv_password", "")
            )

            # Create the SNMP mapping with the YAML key as the name
            create_snmp_mapping(
                name=name,
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
        "skipped": skipped,
        "errors": len(errors) - skipped,  # Don't count skips as errors
        "error_details": errors,
    }
