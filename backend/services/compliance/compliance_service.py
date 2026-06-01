"""Compliance service — manages regex patterns, login credentials, and SNMP mappings."""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional

import yaml

from config import settings as config_settings
from core.crypto import EncryptionService
from repositories.compliance.compliance_repository import (
    LoginCredentialRepository,
    RegexPatternRepository,
    SNMPMappingRepository,
)

logger = logging.getLogger(__name__)


class ComplianceService:
    """Business logic for compliance configuration: regex patterns, login credentials, SNMP."""

    def __init__(self) -> None:
        secret = os.getenv("SECRET_KEY") or config_settings.secret_key
        self._encryption = EncryptionService(secret)
        self._regex_repo = RegexPatternRepository()
        self._login_repo = LoginCredentialRepository()
        self._snmp_repo = SNMPMappingRepository()

    # -------------------------------------------------------------------------
    # Regex Patterns
    # -------------------------------------------------------------------------

    def get_all_regex_patterns(self) -> List[Dict[str, Any]]:
        return [self._regex_to_dict(p) for p in self._regex_repo.get_all()]

    def get_regex_patterns_by_type(self, pattern_type: str) -> List[Dict[str, Any]]:
        return [self._regex_to_dict(p) for p in self._regex_repo.get_by_type(pattern_type, is_active=True)]

    def get_regex_pattern_by_id(self, pattern_id: int) -> Optional[Dict[str, Any]]:
        p = self._regex_repo.get_by_id(pattern_id)
        return self._regex_to_dict(p) if p else None

    def create_regex_pattern(self, pattern: str, pattern_type: str, description: Optional[str] = None) -> int:
        if pattern_type not in ("must_match", "must_not_match"):
            raise ValueError("Invalid pattern_type. Must be 'must_match' or 'must_not_match'")
        new = self._regex_repo.create(
            pattern=pattern,
            description=description,
            pattern_type=pattern_type,
            is_active=True,
        )
        return new.id

    def update_regex_pattern(
        self,
        pattern_id: int,
        pattern: Optional[str] = None,
        description: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> bool:
        data: Dict[str, Any] = {}
        if pattern is not None:
            data["pattern"] = pattern
        if description is not None:
            data["description"] = description
        if is_active is not None:
            data["is_active"] = is_active
        if not data:
            return False
        return self._regex_repo.update(pattern_id, **data) is not None

    def delete_regex_pattern(self, pattern_id: int) -> bool:
        return self._regex_repo.delete(pattern_id)

    # -------------------------------------------------------------------------
    # Login Credentials
    # -------------------------------------------------------------------------

    def get_all_login_credentials(self, decrypt_passwords: bool = False) -> List[Dict[str, Any]]:
        creds = self._login_repo.get_all()
        result = []
        for cred in creds:
            d = self._login_cred_to_dict(cred, decrypt_password=decrypt_passwords)
            if not decrypt_passwords:
                d["password"] = "********"
            result.append(d)
        return result

    def get_login_credential_by_id(
        self, credential_id: int, decrypt_password: bool = False
    ) -> Optional[Dict[str, Any]]:
        cred = self._login_repo.get_by_id(credential_id)
        if not cred:
            return None
        d = self._login_cred_to_dict(cred, decrypt_password=decrypt_password)
        if not decrypt_password:
            d["password"] = "********"
        return d

    def create_login_credential(
        self,
        name: str,
        username: str,
        password: str,
        description: Optional[str] = None,
    ) -> int:
        new = self._login_repo.create(
            name=name,
            username=username,
            password_encrypted=self._encryption.encrypt(password),
            description=description,
            is_active=True,
        )
        return new.id

    def update_login_credential(
        self,
        credential_id: int,
        name: Optional[str] = None,
        username: Optional[str] = None,
        password: Optional[str] = None,
        description: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> bool:
        data: Dict[str, Any] = {}
        if name is not None:
            data["name"] = name
        if username is not None:
            data["username"] = username
        if password is not None:
            data["password_encrypted"] = self._encryption.encrypt(password)
        if description is not None:
            data["description"] = description
        if is_active is not None:
            data["is_active"] = is_active
        if not data:
            return False
        return self._login_repo.update(credential_id, **data) is not None

    def delete_login_credential(self, credential_id: int) -> bool:
        return self._login_repo.delete(credential_id)

    # -------------------------------------------------------------------------
    # SNMP Mappings
    # -------------------------------------------------------------------------

    def get_all_snmp_mappings(self, decrypt_passwords: bool = False) -> List[Dict[str, Any]]:
        result = []
        for mapping in self._snmp_repo.get_all():
            d = self._snmp_to_dict(mapping, decrypt_passwords=decrypt_passwords)
            if not decrypt_passwords:
                d["snmp_v3_auth_password"] = "********" if mapping.snmp_v3_auth_password_encrypted else None
                d["snmp_v3_priv_password"] = "********" if mapping.snmp_v3_priv_password_encrypted else None
            result.append(d)
        return result

    def get_snmp_mapping_by_id(self, mapping_id: int, decrypt_passwords: bool = False) -> Optional[Dict[str, Any]]:
        mapping = self._snmp_repo.get_by_id(mapping_id)
        if not mapping:
            return None
        d = self._snmp_to_dict(mapping, decrypt_passwords=decrypt_passwords)
        if not decrypt_passwords:
            d["snmp_v3_auth_password"] = "********" if mapping.snmp_v3_auth_password_encrypted else None
            d["snmp_v3_priv_password"] = "********" if mapping.snmp_v3_priv_password_encrypted else None
        return d

    def get_snmp_mapping_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        mapping = self._snmp_repo.get_by_name(name)
        if not mapping:
            return None
        d = self._snmp_to_dict(mapping, decrypt_passwords=False)
        d["snmp_v3_auth_password"] = "********" if mapping.snmp_v3_auth_password_encrypted else None
        d["snmp_v3_priv_password"] = "********" if mapping.snmp_v3_priv_password_encrypted else None
        return d

    def create_snmp_mapping(
        self,
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
        if snmp_version not in ("v1", "v2c", "v3"):
            raise ValueError("Invalid snmp_version. Must be 'v1', 'v2c', or 'v3'")
        new = self._snmp_repo.create(
            name=name,
            snmp_community=snmp_community,
            snmp_version=snmp_version,
            snmp_v3_user=snmp_v3_user,
            snmp_v3_auth_protocol=snmp_v3_auth_protocol,
            snmp_v3_auth_password_encrypted=(
                self._encryption.encrypt(snmp_v3_auth_password) if snmp_v3_auth_password else None
            ),
            snmp_v3_priv_protocol=snmp_v3_priv_protocol,
            snmp_v3_priv_password_encrypted=(
                self._encryption.encrypt(snmp_v3_priv_password) if snmp_v3_priv_password else None
            ),
            description=description,
            is_active=True,
        )
        return new.id

    def update_snmp_mapping(
        self,
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
        data: Dict[str, Any] = {}
        if name is not None:
            data["name"] = name
        if snmp_version is not None:
            if snmp_version not in ("v1", "v2c", "v3"):
                raise ValueError("Invalid snmp_version. Must be 'v1', 'v2c', or 'v3'")
            data["snmp_version"] = snmp_version
        if snmp_community is not None:
            data["snmp_community"] = snmp_community
        if snmp_v3_user is not None:
            data["snmp_v3_user"] = snmp_v3_user
        if snmp_v3_auth_protocol is not None:
            data["snmp_v3_auth_protocol"] = snmp_v3_auth_protocol
        if snmp_v3_auth_password is not None:
            data["snmp_v3_auth_password_encrypted"] = self._encryption.encrypt(snmp_v3_auth_password)
        if snmp_v3_priv_protocol is not None:
            data["snmp_v3_priv_protocol"] = snmp_v3_priv_protocol
        if snmp_v3_priv_password is not None:
            data["snmp_v3_priv_password_encrypted"] = self._encryption.encrypt(snmp_v3_priv_password)
        if description is not None:
            data["description"] = description
        if is_active is not None:
            data["is_active"] = is_active
        if not data:
            return False
        return self._snmp_repo.update(mapping_id, **data) is not None

    def delete_snmp_mapping(self, mapping_id: int) -> bool:
        return self._snmp_repo.delete(mapping_id)

    def import_snmp_mappings_from_yaml(self, yaml_content: str) -> Dict[str, Any]:
        """Import SNMP mappings from YAML content (CheckMK format)."""
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
                "error_details": [f"YAML parsing error: {e}"],
            }

        imported = 0
        skipped = 0
        errors: List[str] = []

        for snmp_id, snmp_config in yaml_data.items():
            try:
                existing = self.get_snmp_mapping_by_name(snmp_id)
                if existing:
                    skipped += 1
                    errors.append(f"Skipped {snmp_id}: Name already exists")
                    continue

                version_str = snmp_config.get("version", "v2c")
                if version_str not in ("v1", "v2c", "v3"):
                    type_field = snmp_config.get("type", "")
                    version_str = "v3" if "v3" in type_field else "v2c" if "v2c" in type_field else "v2c"

                snmp_community = snmp_config.get("community") or None
                description = snmp_config.get("description", f"Imported from CheckMK: {snmp_id}")
                snmp_v3_user = snmp_config.get("username") or None
                auth_protocol = snmp_config.get("auth_protocol") or None
                auth_password = snmp_config.get("auth_password") or None
                priv_protocol = snmp_config.get("privacy_protocol") or snmp_config.get("priv_protocol") or None
                priv_password = snmp_config.get("privacy_password") or snmp_config.get("priv_password") or None

                self.create_snmp_mapping(
                    name=snmp_id,
                    snmp_version=version_str,
                    snmp_community=snmp_community,
                    snmp_v3_user=snmp_v3_user,
                    snmp_v3_auth_protocol=auth_protocol,
                    snmp_v3_auth_password=auth_password,
                    snmp_v3_priv_protocol=priv_protocol,
                    snmp_v3_priv_password=priv_password,
                    description=description,
                )
                imported += 1
            except Exception as e:
                errors.append(f"Error importing {snmp_id}: {e}")

        return {
            "imported": imported,
            "skipped": skipped,
            "errors": len(errors) - skipped,
            "error_details": errors,
        }

    # -------------------------------------------------------------------------
    # Private helpers
    # -------------------------------------------------------------------------

    def _regex_to_dict(self, pattern) -> Dict[str, Any]:
        return {
            "id": pattern.id,
            "pattern": pattern.pattern,
            "description": pattern.description,
            "pattern_type": pattern.pattern_type,
            "is_active": pattern.is_active,
            "created_at": pattern.created_at.isoformat() if pattern.created_at else None,
            "updated_at": pattern.updated_at.isoformat() if pattern.updated_at else None,
        }

    def _login_cred_to_dict(self, cred, decrypt_password: bool = False) -> Dict[str, Any]:
        result: Dict[str, Any] = {
            "id": cred.id,
            "name": cred.name,
            "username": cred.username,
            "description": cred.description,
            "is_active": cred.is_active,
            "created_at": cred.created_at.isoformat() if cred.created_at else None,
            "updated_at": cred.updated_at.isoformat() if cred.updated_at else None,
        }
        if decrypt_password and cred.password_encrypted:
            result["password"] = self._encryption.decrypt(cred.password_encrypted)
        return result

    def _snmp_to_dict(self, mapping, decrypt_passwords: bool = False) -> Dict[str, Any]:
        result: Dict[str, Any] = {
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
                result["snmp_v3_auth_password"] = self._encryption.decrypt(mapping.snmp_v3_auth_password_encrypted)
            if mapping.snmp_v3_priv_password_encrypted:
                result["snmp_v3_priv_password"] = self._encryption.decrypt(mapping.snmp_v3_priv_password_encrypted)
        return result
