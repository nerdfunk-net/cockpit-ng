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
        "has_password": cred.password_encrypted is not None,
        "has_ssh_key": cred.ssh_key_encrypted is not None,
        "has_ssh_passphrase": cred.ssh_passphrase_encrypted is not None,
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


def get_credential_by_id(cred_id: int) -> Optional[Dict[str, Any]]:
    """Get a credential by ID.

    Args:
        cred_id: The credential ID

    Returns:
        Credential dictionary or None if not found
    """
    cred = _creds_repo.get_by_id(cred_id)
    if not cred:
        return None
    return _credential_to_dict(cred)


def create_credential(
    name: str,
    username: str,
    cred_type: str,
    password: Optional[str] = None,
    valid_until: Optional[str] = None,
    source: str = "general",
    owner: Optional[str] = None,
    ssh_private_key: Optional[str] = None,
    ssh_passphrase: Optional[str] = None,
) -> Dict[str, Any]:
    """Create a new credential with encrypted password or SSH key.

    Args:
        name: Credential name
        username: Username for the credential
        cred_type: Type of credential (ssh, tacacs, generic, token, ssh_key)
        password: Plain text password to encrypt (for non-ssh_key types)
        valid_until: ISO8601 datetime string or None
        source: 'general' or 'private'
        owner: Username of owner (for private credentials)
        ssh_private_key: Plain text SSH private key (for ssh_key type)
        ssh_passphrase: Plain text passphrase for SSH key (optional)

    Returns:
        Dictionary representation of created credential
    """
    now = datetime.utcnow()

    # Encrypt password if provided
    encrypted_password = None
    if password:
        encrypted_password = encryption_service.encrypt(password)

    # Encrypt SSH key if provided
    encrypted_ssh_key = None
    if ssh_private_key:
        encrypted_ssh_key = encryption_service.encrypt(ssh_private_key)

    # Encrypt SSH passphrase if provided
    encrypted_ssh_passphrase = None
    if ssh_passphrase:
        encrypted_ssh_passphrase = encryption_service.encrypt(ssh_passphrase)

    new_cred = _creds_repo.create(
        name=name,
        username=username,
        type=cred_type,
        password_encrypted=encrypted_password,
        ssh_key_encrypted=encrypted_ssh_key,
        ssh_passphrase_encrypted=encrypted_ssh_passphrase,
        valid_until=valid_until,
        source=source,
        owner=owner,
        is_active=True,
        created_at=now,
        updated_at=now,
    )

    # Immediately export SSH key to filesystem if this is an ssh_key credential
    if cred_type == "ssh_key" and ssh_private_key:
        export_single_ssh_key(new_cred.id)

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
    ssh_private_key: Optional[str] = None,
    ssh_passphrase: Optional[str] = None,
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
        ssh_private_key: New SSH private key to encrypt (optional)
        ssh_passphrase: New SSH passphrase to encrypt (optional)

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
    if ssh_private_key is not None:
        update_kwargs["ssh_key_encrypted"] = encryption_service.encrypt(ssh_private_key)
    if ssh_passphrase is not None:
        update_kwargs["ssh_passphrase_encrypted"] = encryption_service.encrypt(
            ssh_passphrase
        )

    update_kwargs["updated_at"] = datetime.utcnow()

    updated = _creds_repo.update(cred_id, **update_kwargs)

    # Immediately export SSH key to filesystem if SSH key was updated
    # Check both if type is ssh_key and if a new ssh_private_key was provided
    final_type = cred_type if cred_type is not None else existing.type
    if final_type == "ssh_key" and ssh_private_key is not None:
        export_single_ssh_key(cred_id)

    return _credential_to_dict(updated)


def _delete_ssh_key_file(
    cred_name: str, source: str, owner: Optional[str] = None
) -> bool:
    """Delete an SSH key file from the filesystem.

    Args:
        cred_name: Name of the credential (used to derive filename)
        source: 'general' or 'private' (used to derive filename prefix)
        owner: Username of the credential owner (used for private credentials)

    Returns:
        True if file was deleted, False if not found or error occurred
    """
    import re
    import logging

    logger = logging.getLogger(__name__)

    output_dir = _get_ssh_keys_directory()
    prefix = _get_ssh_key_filename_prefix(source, owner)
    safe_name = re.sub(r"[^a-zA-Z0-9_-]", "_", cred_name)
    key_filename = os.path.join(output_dir, f"{prefix}{safe_name}")

    try:
        if os.path.exists(key_filename):
            os.remove(key_filename)
            logger.info(f"Deleted SSH key file: {key_filename}")
            return True
        return False
    except Exception as e:
        logger.error(f"Failed to delete SSH key file '{key_filename}': {e}")
        return False


def delete_credential(cred_id: int) -> None:
    """Delete a credential by ID.

    Args:
        cred_id: ID of credential to delete
    """
    # Get credential info before deleting to check if it's an SSH key
    cred = _creds_repo.get_by_id(cred_id)
    if cred and cred.type == "ssh_key":
        _delete_ssh_key_file(cred.name, cred.source, cred.owner)

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
    if not cred.password_encrypted:
        raise ValueError("Credential has no password")
    return encryption_service.decrypt(cred.password_encrypted)


def get_decrypted_ssh_key(cred_id: int) -> str:
    """Get the decrypted SSH private key for a credential.

    Args:
        cred_id: ID of credential

    Returns:
        Decrypted SSH private key as plain text

    Raises:
        ValueError: If credential not found, not an ssh_key type, or decryption fails
    """
    cred = _creds_repo.get_by_id(cred_id)
    if not cred:
        raise ValueError("Credential not found")
    if not cred.ssh_key_encrypted:
        raise ValueError("Credential has no SSH key")
    return encryption_service.decrypt(cred.ssh_key_encrypted)


def get_decrypted_ssh_passphrase(cred_id: int) -> Optional[str]:
    """Get the decrypted SSH passphrase for a credential.

    Args:
        cred_id: ID of credential

    Returns:
        Decrypted SSH passphrase as plain text, or None if no passphrase

    Raises:
        ValueError: If credential not found or decryption fails
    """
    cred = _creds_repo.get_by_id(cred_id)
    if not cred:
        raise ValueError("Credential not found")
    if not cred.ssh_passphrase_encrypted:
        return None
    return encryption_service.decrypt(cred.ssh_passphrase_encrypted)


def has_ssh_key(cred_id: int) -> bool:
    """Check if a credential has an SSH key stored.

    Args:
        cred_id: ID of credential

    Returns:
        True if credential has an SSH key, False otherwise
    """
    cred = _creds_repo.get_by_id(cred_id)
    if not cred:
        return False
    return cred.ssh_key_encrypted is not None and len(cred.ssh_key_encrypted) > 0


def get_ssh_key_credentials() -> List[Dict[str, Any]]:
    """Get all SSH key credentials.

    Returns:
        List of credential dictionaries for ssh_key type
    """
    creds = _creds_repo.get_by_type("ssh_key")
    return [_credential_to_dict(c) for c in creds]


def get_ssh_key_path(cred_id: int) -> Optional[str]:
    """Get the filesystem path to an SSH key file.

    Args:
        cred_id: ID of the SSH key credential

    Returns:
        Absolute path to the SSH key file, or None if not found
    """
    import re

    cred = _creds_repo.get_by_id(cred_id)
    if not cred:
        return None

    if cred.type != "ssh_key" or not cred.ssh_key_encrypted:
        return None

    output_dir = _get_ssh_keys_directory()
    prefix = _get_ssh_key_filename_prefix(cred.source, cred.owner)
    safe_name = re.sub(r"[^a-zA-Z0-9_-]", "_", cred.name)
    key_path = os.path.join(output_dir, f"{prefix}{safe_name}")

    if os.path.exists(key_path):
        return key_path

    # If file doesn't exist, try to export it
    exported_path = export_single_ssh_key(cred_id)
    return exported_path


def _get_ssh_keys_directory() -> str:
    """Get the SSH keys directory path from config.

    Returns:
        Absolute path to SSH keys directory (project_root/data/ssh_keys)
    """
    return os.path.join(config_settings.data_directory, "ssh_keys")


def _get_ssh_key_filename_prefix(source: str, owner: Optional[str] = None) -> str:
    """Get the filename prefix based on credential source and owner.

    Args:
        source: 'general' or 'private'
        owner: Username of the credential owner (used for private credentials)

    Returns:
        Prefix string for the filename (e.g., 'global_' or 'username_')
    """
    if source == "general":
        return "global_"
    elif source == "private" and owner:
        # Use the owner's username as prefix for private credentials
        # Sanitize the username to be safe for filenames
        import re

        safe_owner = re.sub(r"[^a-zA-Z0-9_-]", "_", owner)
        return f"{safe_owner}_"
    elif source == "private":
        return "private_"
    return ""


def export_single_ssh_key(cred_id: int) -> Optional[str]:
    """Export a single SSH key to the filesystem.

    Args:
        cred_id: ID of the SSH key credential to export

    Returns:
        Path to the exported key file, or None if export failed
    """
    import re
    import logging

    logger = logging.getLogger(__name__)

    cred = _creds_repo.get_by_id(cred_id)
    if not cred:
        logger.warning(f"Credential with ID {cred_id} not found")
        return None

    if cred.type != "ssh_key" or not cred.ssh_key_encrypted:
        logger.debug(f"Credential '{cred.name}' is not an SSH key or has no key data")
        return None

    output_dir = _get_ssh_keys_directory()
    os.makedirs(output_dir, exist_ok=True)

    try:
        # Decrypt the SSH key
        ssh_key_content = encryption_service.decrypt(cred.ssh_key_encrypted)

        # Sanitize the credential name for use as a filename
        # Add prefix based on source (global_ for general, username_ for private)
        prefix = _get_ssh_key_filename_prefix(cred.source, cred.owner)
        safe_name = re.sub(r"[^a-zA-Z0-9_-]", "_", cred.name)
        key_filename = os.path.join(output_dir, f"{prefix}{safe_name}")

        # Write the SSH key file
        with open(key_filename, "w") as f:
            f.write(ssh_key_content)
            if not ssh_key_content.endswith("\n"):
                f.write("\n")

        # Set proper permissions (read/write for owner only)
        os.chmod(key_filename, 0o600)

        logger.info(f"Exported SSH key '{cred.name}' to {key_filename}")
        return key_filename

    except Exception as e:
        logger.error(f"Failed to export SSH key '{cred.name}': {e}")
        return None


def export_ssh_keys_to_filesystem(output_dir: Optional[str] = None) -> List[str]:
    """Export all SSH keys to the filesystem.

    Creates SSH key files in the specified directory using the credential name
    as the filename. Existing files are overwritten.

    Args:
        output_dir: Directory to export SSH keys to (default: from config data_directory/ssh_keys)

    Returns:
        List of exported file paths
    """
    import re
    import logging

    logger = logging.getLogger(__name__)

    # Use config-based directory if not specified
    if output_dir is None:
        output_dir = _get_ssh_keys_directory()

    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)

    exported_files = []
    ssh_key_creds = _creds_repo.get_by_type("ssh_key")

    for cred in ssh_key_creds:
        if not cred.ssh_key_encrypted:
            logger.warning(
                f"SSH key credential '{cred.name}' has no key data, skipping"
            )
            continue

        try:
            # Decrypt the SSH key
            ssh_key_content = encryption_service.decrypt(cred.ssh_key_encrypted)

            # Sanitize the credential name for use as a filename
            # Add prefix based on source (global_ for general, username_ for private)
            prefix = _get_ssh_key_filename_prefix(cred.source, cred.owner)
            safe_name = re.sub(r"[^a-zA-Z0-9_-]", "_", cred.name)
            key_filename = os.path.join(output_dir, f"{prefix}{safe_name}")

            # Write the SSH key file
            with open(key_filename, "w") as f:
                f.write(ssh_key_content)
                # Ensure the file ends with a newline
                if not ssh_key_content.endswith("\n"):
                    f.write("\n")

            # Set proper permissions (read/write for owner only)
            os.chmod(key_filename, 0o600)

            exported_files.append(key_filename)
            logger.info(f"Exported SSH key '{cred.name}' to {key_filename}")

        except Exception as e:
            logger.error(f"Failed to export SSH key '{cred.name}': {e}")

    return exported_files
