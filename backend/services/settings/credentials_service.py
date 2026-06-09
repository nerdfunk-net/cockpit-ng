"""Credentials service — encrypted credential storage and SSH key management."""

from __future__ import annotations

import logging
import os
import re
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from config import settings as config_settings
from core.crypto import EncryptionService, resolve_credential_secret
from core.models import Credential
from repositories import CredentialsRepository
from services.settings.exceptions import (
    CredentialMissingFieldError,
    CredentialNotFoundError,
)
from utils.time import utc_now_naive as _utc_now

logger = logging.getLogger(__name__)


class CredentialsService:
    def __init__(self) -> None:
        # Dedicated credential key (CREDENTIAL_ENCRYPTION_KEY) with SECRET_KEY
        # fallback for backward compatibility (including the config default).
        secret = resolve_credential_secret(
            config_settings.credential_encryption_key or config_settings.secret_key
        )
        self._encryption = EncryptionService(secret)
        self._repo = CredentialsRepository()

    # -------------------------------------------------------------------------
    # CRUD
    # -------------------------------------------------------------------------

    def list_credentials(
        self, include_expired: bool = False, source: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        creds = self._repo.get_by_source(source) if source else self._repo.get_all()
        items = [self._to_dict(c) for c in creds]
        if not include_expired:
            items = [i for i in items if i["status"] != "expired"]
        return items

    def get_credential_by_id(self, cred_id: int) -> Optional[Dict[str, Any]]:
        cred = self._repo.get_by_id(cred_id)
        return self._to_dict(cred) if cred else None

    def create_credential(
        self,
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
        now = _utc_now()
        new_cred = self._repo.create(
            name=name,
            username=username,
            type=cred_type,
            password_encrypted=self._encryption.encrypt(password) if password else None,
            ssh_key_encrypted=self._encryption.encrypt(ssh_private_key)
            if ssh_private_key
            else None,
            ssh_passphrase_encrypted=self._encryption.encrypt(ssh_passphrase)
            if ssh_passphrase
            else None,
            valid_until=valid_until,
            source=source,
            owner=owner,
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        if cred_type == "ssh_key" and ssh_private_key:
            self.export_single_ssh_key(new_cred.id)
        return self._to_dict(new_cred)

    def update_credential(
        self,
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
        existing = self._repo.get_by_id(cred_id)
        if not existing:
            raise CredentialNotFoundError(cred_id)
        kwargs: Dict[str, Any] = {"updated_at": _utc_now()}
        if name is not None:
            kwargs["name"] = name
        if username is not None:
            kwargs["username"] = username
        if cred_type is not None:
            kwargs["type"] = cred_type
        if valid_until is not None:
            kwargs["valid_until"] = valid_until
        if source is not None:
            kwargs["source"] = source
        if owner is not None:
            kwargs["owner"] = owner
        if password is not None:
            kwargs["password_encrypted"] = self._encryption.encrypt(password)
        if ssh_private_key is not None:
            kwargs["ssh_key_encrypted"] = self._encryption.encrypt(ssh_private_key)
        if ssh_passphrase is not None:
            kwargs["ssh_passphrase_encrypted"] = self._encryption.encrypt(
                ssh_passphrase
            )
        updated = self._repo.update(cred_id, **kwargs)
        final_type = cred_type if cred_type is not None else existing.type
        if final_type == "ssh_key" and ssh_private_key is not None:
            self.export_single_ssh_key(cred_id)
        return self._to_dict(updated)

    def delete_credential(self, cred_id: int) -> None:
        cred = self._repo.get_by_id(cred_id)
        if cred and cred.type == "ssh_key":
            self._delete_ssh_key_file(cred.name, cred.source, cred.owner)
        self._repo.delete(cred_id)

    def delete_credentials_by_owner(self, owner: str) -> int:
        return self._repo.delete_by_owner(owner)

    # -------------------------------------------------------------------------
    # Decryption helpers
    # -------------------------------------------------------------------------

    def get_decrypted_password(self, cred_id: int) -> str:
        cred = self._repo.get_by_id(cred_id)
        if not cred:
            raise CredentialNotFoundError(cred_id)
        if not cred.password_encrypted:
            raise CredentialMissingFieldError("Credential has no password")
        return self._encryption.decrypt(cred.password_encrypted)

    def get_decrypted_ssh_key(self, cred_id: int) -> str:
        cred = self._repo.get_by_id(cred_id)
        if not cred:
            raise CredentialNotFoundError(cred_id)
        if not cred.ssh_key_encrypted:
            raise CredentialMissingFieldError("Credential has no SSH key")
        return self._encryption.decrypt(cred.ssh_key_encrypted)

    def get_decrypted_ssh_passphrase(self, cred_id: int) -> Optional[str]:
        cred = self._repo.get_by_id(cred_id)
        if not cred:
            raise CredentialNotFoundError(cred_id)
        if not cred.ssh_passphrase_encrypted:
            return None
        return self._encryption.decrypt(cred.ssh_passphrase_encrypted)

    def has_ssh_key(self, cred_id: int) -> bool:
        cred = self._repo.get_by_id(cred_id)
        return bool(cred and cred.ssh_key_encrypted)

    # -------------------------------------------------------------------------
    # SSH key filesystem management
    # -------------------------------------------------------------------------

    def get_ssh_key_credentials(self) -> List[Dict[str, Any]]:
        return [self._to_dict(c) for c in self._repo.get_by_type("ssh_key")]

    def get_ssh_key_path(self, cred_id: int) -> Optional[str]:
        cred = self._repo.get_by_id(cred_id)
        if not cred or cred.type != "ssh_key" or not cred.ssh_key_encrypted:
            return None
        output_dir = self._ssh_keys_directory()
        prefix = self._ssh_key_filename_prefix(cred.source, cred.owner)
        safe_name = re.sub(r"[^a-zA-Z0-9_-]", "_", cred.name)
        key_path = os.path.join(output_dir, f"{prefix}{safe_name}")
        if os.path.exists(key_path):
            return key_path
        return self.export_single_ssh_key(cred_id)

    def export_single_ssh_key(self, cred_id: int) -> Optional[str]:
        cred = self._repo.get_by_id(cred_id)
        if not cred:
            logger.warning("Credential with ID %s not found", cred_id)
            return None
        if cred.type != "ssh_key" or not cred.ssh_key_encrypted:
            return None
        output_dir = self._ssh_keys_directory()
        os.makedirs(output_dir, exist_ok=True)
        try:
            ssh_key_content = self._encryption.decrypt(cred.ssh_key_encrypted)
            prefix = self._ssh_key_filename_prefix(cred.source, cred.owner)
            safe_name = re.sub(r"[^a-zA-Z0-9_-]", "_", cred.name)
            key_filename = os.path.join(output_dir, f"{prefix}{safe_name}")
            with open(key_filename, "w") as f:
                f.write(ssh_key_content)
                if not ssh_key_content.endswith("\n"):
                    f.write("\n")
            os.chmod(key_filename, 0o600)
            logger.info("Exported SSH key '%s' to %s", cred.name, key_filename)
            return key_filename
        except Exception as e:
            logger.error("Failed to export SSH key '%s': %s", cred.name, e)
            return None

    def export_ssh_keys_to_filesystem(
        self, output_dir: Optional[str] = None
    ) -> List[str]:
        if output_dir is None:
            output_dir = self._ssh_keys_directory()
        os.makedirs(output_dir, exist_ok=True)
        exported: List[str] = []
        for cred in self._repo.get_by_type("ssh_key"):
            if not cred.ssh_key_encrypted:
                logger.warning(
                    "SSH key credential '%s' has no key data, skipping", cred.name
                )
                continue
            try:
                content = self._encryption.decrypt(cred.ssh_key_encrypted)
                prefix = self._ssh_key_filename_prefix(cred.source, cred.owner)
                safe_name = re.sub(r"[^a-zA-Z0-9_-]", "_", cred.name)
                key_filename = os.path.join(output_dir, f"{prefix}{safe_name}")
                with open(key_filename, "w") as f:
                    f.write(content)
                    if not content.endswith("\n"):
                        f.write("\n")
                os.chmod(key_filename, 0o600)
                exported.append(key_filename)
                logger.info("Exported SSH key '%s' to %s", cred.name, key_filename)
            except Exception as e:
                logger.error("Failed to export SSH key '%s': %s", cred.name, e)
        return exported

    # -------------------------------------------------------------------------
    # Private helpers
    # -------------------------------------------------------------------------

    def _ssh_keys_directory(self) -> str:
        return os.path.join(config_settings.data_directory, "ssh_keys")

    def _ssh_key_filename_prefix(self, source: str, owner: Optional[str] = None) -> str:
        if source == "general":
            return "global_"
        if source == "private" and owner:
            return re.sub(r"[^a-zA-Z0-9_-]", "_", owner) + "_"
        if source == "private":
            return "private_"
        return ""

    def _delete_ssh_key_file(
        self, cred_name: str, source: str, owner: Optional[str] = None
    ) -> bool:
        output_dir = self._ssh_keys_directory()
        prefix = self._ssh_key_filename_prefix(source, owner)
        safe_name = re.sub(r"[^a-zA-Z0-9_-]", "_", cred_name)
        key_filename = os.path.join(output_dir, f"{prefix}{safe_name}")
        try:
            if os.path.exists(key_filename):
                os.remove(key_filename)
                logger.info("Deleted SSH key file: %s", key_filename)
                return True
            return False
        except Exception as e:
            logger.error("Failed to delete SSH key file '%s': %s", key_filename, e)
            return False

    def _to_dict(self, cred: Credential) -> Dict[str, Any]:
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
