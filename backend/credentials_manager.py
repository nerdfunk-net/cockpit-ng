"""Credential storage and encryption manager.

Encrypted credential storage using SECRET_KEY-derived key.
Database: PostgreSQL (cockpit database)
Table: credentials
"""

from __future__ import annotations
import base64
import hashlib
import os
from datetime import datetime, date
from typing import Any, Dict, List, Optional
from cryptography.fernet import Fernet, InvalidToken
from config import settings as config_settings
from repositories import CredentialsRepository
from core.models import Credential

# Initialize repository
_creds_repo = CredentialsRepository()


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


def _credential_to_dict(cred: Credential) -> Dict[str, Any]:
    """Convert Credential model to dictionary with computed status."""
    valid_until = cred.valid_until
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
        "id": cred.id,
        "name": cred.name,
        "username": cred.username,
        "type": cred.type,
        "valid_until": cred.valid_until,
        "is_active": cred.is_active,
        "source": cred.source,
        "owner": cred.owner,
        "created_at": cred.created_at.isoformat() if cred.created_at else None,
        "updated_at": cred.updated_at.isoformat() if cred.updated_at else None,
        "status": status,
        "has_password": True,
    }


def list_credentials(
    include_expired: bool = False, source: Optional[str] = None
) -> List[Dict[str, Any]]:
    """List all credentials, optionally filtered by source.
    
    Args:
        include_expired: If False, filter out expired credentials
        source: Optional source filter ('general', 'private')
        
    Returns:
        List of credential dictionaries with computed status
    """
    if source:
        creds = _creds_repo.get_by_source(source)
    else:
        creds = _creds_repo.get_all()
    
    items = [_credential_to_dict(c) for c in creds]
    
    if not include_expired:
        items = [i for i in items if i["status"] != "expired"]
    
    return items


def create_credential(
    name: str,
    username: str,
    cred_type: str,
    password: str,
    valid_until: Optional[str],
    source: str = "general",
    owner: Optional[str] = None,
) -> Dict[str, Any]:
    """Create a new credential with encrypted password.
    
    Args:
        name: Credential name
        username: Username for the credential
        cred_type: Type of credential (ssh, tacacs, generic, token)
        password: Plain text password to encrypt
        valid_until: ISO8601 datetime string or None
        source: 'general' or 'private'
        owner: Username of owner (for private credentials)
        
    Returns:
        Dictionary representation of created credential
    """
    encrypted = encryption_service.encrypt(password)
    now = datetime.utcnow()
    
    new_cred = _creds_repo.create(
        name=name,
        username=username,
        type=cred_type,
        password_encrypted=encrypted,
        valid_until=valid_until,
        source=source,
        owner=owner,
        is_active=True,
        created_at=now,
        updated_at=now
    )
    return _credential_to_dict(new_cred)


def update_credential(
    cred_id: int,
    name: Optional[str] = None,
    username: Optional[str] = None,
    cred_type: Optional[str] = None,
    password: Optional[str] = None,
    valid_until: Optional[str] = None,
    source: Optional[str] = None,
    owner: Optional[str] = None,
) -> Dict[str, Any]:
    """Update an existing credential.
    
    Args:
        cred_id: ID of credential to update
        name: New name (optional)
        username: New username (optional)
        cred_type: New type (optional)
        password: New password to encrypt (optional)
        valid_until: New expiration date (optional)
        source: New source (optional)
        owner: New owner (optional)
        
    Returns:
        Dictionary representation of updated credential
        
    Raises:
        ValueError: If credential not found
    """
    existing = _creds_repo.get_by_id(cred_id)
    if not existing:
        raise ValueError("Credential not found")
    
    # Build update kwargs with only provided values
    update_kwargs = {}
    if name is not None:
        update_kwargs["name"] = name
    if username is not None:
        update_kwargs["username"] = username
    if cred_type is not None:
        update_kwargs["type"] = cred_type
    if valid_until is not None:
        update_kwargs["valid_until"] = valid_until
    if source is not None:
        update_kwargs["source"] = source
    if owner is not None:
        update_kwargs["owner"] = owner
    if password is not None:
        update_kwargs["password_encrypted"] = encryption_service.encrypt(password)
    
    update_kwargs["updated_at"] = datetime.utcnow()
    
    updated = _creds_repo.update(cred_id, **update_kwargs)
    return _credential_to_dict(updated)


def delete_credential(cred_id: int) -> None:
    """Delete a credential by ID.
    
    Args:
        cred_id: ID of credential to delete
    """
    _creds_repo.delete(cred_id)


def delete_credentials_by_owner(owner: str) -> int:
    """Delete all private credentials owned by a specific user.

    Args:
        owner: Username of the credential owner

    Returns:
        Number of credentials deleted
    """
    return _creds_repo.delete_by_owner(owner)


def get_decrypted_password(cred_id: int) -> str:
    """Get the decrypted password for a credential.
    
    Args:
        cred_id: ID of credential
        
    Returns:
        Decrypted password as plain text
        
    Raises:
        ValueError: If credential not found or decryption fails
    """
    cred = _creds_repo.get_by_id(cred_id)
    if not cred:
        raise ValueError("Credential not found")
    return encryption_service.decrypt(cred.password_encrypted)
