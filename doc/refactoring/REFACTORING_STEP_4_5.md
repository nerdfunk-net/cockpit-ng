# Refactoring Step 4.5 — `credentials_manager.py`

**Priority:** 4 — Manager Migration  
**Risk:** Medium–High (startup sequence, SSH key filesystem, encryption)  
**Estimated effort:** 1–2 days  
**Prerequisites:** Step 4.1 (profile_manager references credentials_manager) — ideally done first, but can be done independently if the lazy import is updated  
**Independent of:** Steps 4.2, 4.3, 4.4, 4.6, 4.7

---

## Goal

Migrate `backend/credentials_manager.py` (557 lines) →  
`backend/services/settings/credentials_service.py`

---

## What `credentials_manager.py` Does

Module-level functions with:
- Module-level `EncryptionService` instance (uses `core.crypto.EncryptionService`)
- Module-level `_creds_repo = CredentialsRepository()`
- Credential CRUD: `list_credentials`, `get_credential_by_id`, `create_credential`, `update_credential`, `delete_credential`, `delete_credentials_by_owner`
- Decryption helpers: `get_decrypted_password`, `get_decrypted_ssh_key`, `get_decrypted_ssh_passphrase`, `has_ssh_key`
- SSH key filesystem management: `export_single_ssh_key`, `export_ssh_keys_to_filesystem`, `get_ssh_key_path`, `get_ssh_key_credentials`

**Critical startup hook:** `main.py` calls `credentials_manager.export_ssh_keys_to_filesystem()` at startup to write SSH keys to disk. The new service must preserve this behavior.

---

## Callers

```bash
grep -rn "import credentials_manager\|from credentials_manager" backend/ --include="*.py" | grep -v __pycache__
```

| File | Import | Usage |
|---|---|---|
| `routers/settings/credentials.py` | `import credentials_manager as cred_mgr` (top-level) | CRUD endpoints |
| `routers/auth/profile.py` | `import credentials_manager` (top-level) | personal credential CRUD |
| `routers/network/automation/netmiko.py` | lazy × 2 | credential decryption |
| `main.py` | lazy `import credentials_manager` | startup SSH key export |
| `tasks/execution/command_executor.py` | lazy | credential decryption |
| `tasks/execution/client_data_executor.py` | lazy | credential decryption |
| `tasks/execution/backup_executor.py` | lazy | credential decryption |
| `services/network/snapshots/execution_service.py` | `import credentials_manager as cred_mgr` (top-level) | credential decryption + listing |
| `services/network/scanning/service.py` | `from credentials_manager import get_decrypted_password, list_credentials` | 2 functions |
| `services/nautobot/configs/backup.py` | lazy `import credentials_manager` | credential decryption |
| `services/network/automation/render.py` | lazy `import credentials_manager` | credential decryption |
| `services/settings/git/auth.py` | lazy `import credentials_manager as cred_mgr` | SSH key path |
| `scripts/credential_manager/rotate_key.py` | `from credentials_manager import EncryptionService` | re-encryption script |
| `rbac_manager.py` | lazy `import credentials_manager` | inside `delete_user_with_rbac` |
| `profile_manager.py` | lazy `import credentials_manager as cred_mgr` | password update |

---

## New File: `services/settings/credentials_service.py`

Convert to a class `CredentialsService`. All method signatures match the original module-level functions.

```python
"""Credentials service — encrypted credential storage and SSH key management."""

from __future__ import annotations
import logging
import os
import re
from datetime import datetime, date
from typing import Any, Dict, List, Optional

from core.crypto import EncryptionService
from config import settings as config_settings
from repositories import CredentialsRepository
from core.models import Credential

logger = logging.getLogger(__name__)


class CredentialsService:
    def __init__(self) -> None:
        secret = os.getenv("SECRET_KEY") or config_settings.secret_key
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
        now = datetime.utcnow()
        new_cred = self._repo.create(
            name=name,
            username=username,
            type=cred_type,
            password_encrypted=self._encryption.encrypt(password) if password else None,
            ssh_key_encrypted=self._encryption.encrypt(ssh_private_key) if ssh_private_key else None,
            ssh_passphrase_encrypted=self._encryption.encrypt(ssh_passphrase) if ssh_passphrase else None,
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
            raise ValueError("Credential not found")
        kwargs: Dict[str, Any] = {"updated_at": datetime.utcnow()}
        if name is not None: kwargs["name"] = name
        if username is not None: kwargs["username"] = username
        if cred_type is not None: kwargs["type"] = cred_type
        if valid_until is not None: kwargs["valid_until"] = valid_until
        if source is not None: kwargs["source"] = source
        if owner is not None: kwargs["owner"] = owner
        if password is not None: kwargs["password_encrypted"] = self._encryption.encrypt(password)
        if ssh_private_key is not None: kwargs["ssh_key_encrypted"] = self._encryption.encrypt(ssh_private_key)
        if ssh_passphrase is not None: kwargs["ssh_passphrase_encrypted"] = self._encryption.encrypt(ssh_passphrase)
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
            raise ValueError("Credential not found")
        if not cred.password_encrypted:
            raise ValueError("Credential has no password")
        return self._encryption.decrypt(cred.password_encrypted)

    def get_decrypted_ssh_key(self, cred_id: int) -> str:
        cred = self._repo.get_by_id(cred_id)
        if not cred:
            raise ValueError("Credential not found")
        if not cred.ssh_key_encrypted:
            raise ValueError("Credential has no SSH key")
        return self._encryption.decrypt(cred.ssh_key_encrypted)

    def get_decrypted_ssh_passphrase(self, cred_id: int) -> Optional[str]:
        cred = self._repo.get_by_id(cred_id)
        if not cred:
            raise ValueError("Credential not found")
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

    def export_ssh_keys_to_filesystem(self, output_dir: Optional[str] = None) -> List[str]:
        if output_dir is None:
            output_dir = self._ssh_keys_directory()
        os.makedirs(output_dir, exist_ok=True)
        exported: List[str] = []
        for cred in self._repo.get_by_type("ssh_key"):
            if not cred.ssh_key_encrypted:
                logger.warning("SSH key credential '%s' has no key data, skipping", cred.name)
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

    def _delete_ssh_key_file(self, cred_name: str, source: str, owner: Optional[str] = None) -> bool:
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
```

---

## Module-Level Compatibility Shim (Optional)

Several callers use `from credentials_manager import get_decrypted_password, list_credentials`. To make migration atomic, add a module-level shim at the end of `credentials_service.py` or in a separate file. **Do not add this shim** — instead, update each caller directly. The module-level function pattern is what we're moving away from.

---

## `service_factory.py` Addition

```python
def build_credentials_service():
    """Create a fresh CredentialsService instance."""
    from services.settings.credentials_service import CredentialsService
    return CredentialsService()
```

---

## `dependencies.py` Addition

```python
def get_credentials_service():
    """Provide a CredentialsService instance."""
    return service_factory.build_credentials_service()
```

---

## Caller Updates

### `routers/settings/credentials.py` (top-level import)

```python
# Before:
import credentials_manager as cred_mgr

# After:
from dependencies import get_credentials_service
from services.settings.credentials_service import CredentialsService
# Add to each endpoint: cred_mgr: CredentialsService = Depends(get_credentials_service)
```

All call sites stay the same (`cred_mgr.list_credentials(...)`) — only the import and function signature change.

### `routers/auth/profile.py` (top-level import)

```python
# Before:
import credentials_manager

# After:
import service_factory
credentials_manager = service_factory.build_credentials_service()
```

Or inject via `Depends()` if you refactor the router signatures. The instance-per-call approach works since `CredentialsService.__init__` only reads config (no I/O).

### Lazy imports in tasks and services

For all lazy imports like:
```python
import credentials_manager
# or
from credentials_manager import get_decrypted_password, list_credentials
```

Replace with:
```python
import service_factory
credentials_manager = service_factory.build_credentials_service()
# or for the function imports:
_svc = service_factory.build_credentials_service()
get_decrypted_password = _svc.get_decrypted_password
list_credentials = _svc.list_credentials
```

Files requiring this change:
- `routers/network/automation/netmiko.py` (lazy, 2 places)
- `tasks/execution/command_executor.py` (lazy)
- `tasks/execution/client_data_executor.py` (lazy)
- `tasks/execution/backup_executor.py` (lazy)
- `services/network/snapshots/execution_service.py` (top-level)
- `services/network/scanning/service.py` (module-level function import)
- `services/nautobot/configs/backup.py` (lazy)
- `services/network/automation/render.py` (lazy)
- `services/settings/git/auth.py` (lazy)

### `main.py` startup

```python
# Before (in startup/lifespan):
import credentials_manager
credentials_manager.export_ssh_keys_to_filesystem()

# After:
import service_factory
service_factory.build_credentials_service().export_ssh_keys_to_filesystem()
```

### `scripts/credential_manager/rotate_key.py`

This script imports `EncryptionService` directly:
```python
# Before:
from credentials_manager import EncryptionService

# After:
from core.crypto import EncryptionService
```

The script can then construct its own `EncryptionService` instances directly (it's a standalone key rotation script, not using the service).

### `rbac_manager.py` (before Step 4.4)

The lazy import in `delete_user_with_rbac` stays pointing at `credentials_manager` until Step 4.4 migrates `rbac_manager` to `RBACService`, at which point `RBACService.delete_user_with_rbac` will use `CredentialsService` instead.

### `profile_manager.py` (before Step 4.1 completes)

The lazy import stays pointing at `credentials_manager` until `profile_manager` is replaced by `profile_service.py` in Step 4.1.

---

## Ordering Note

If doing Step 4.1 and 4.5 in sequence:
- Do Step 4.1 first: `profile_service.py` is written to lazily import from `services.settings.credentials_service`
- Do Step 4.5 next: creates `credentials_service.py`, so the lazy import resolves

If doing Step 4.5 before 4.1, `profile_manager.py`'s lazy import still points at `credentials_manager` — that's fine since `credentials_manager.py` still exists until Step 4.5 is complete.

---

## Steps

1. Create `backend/services/settings/credentials_service.py`
2. Add `build_credentials_service()` to `service_factory.py`
3. Add `get_credentials_service()` to `dependencies.py`
4. Update `routers/settings/credentials.py`
5. Update `routers/auth/profile.py`
6. Update all task lazy imports (8 files)
7. Update all service lazy imports (5 files)
8. Update `main.py` startup call
9. Update `scripts/credential_manager/rotate_key.py`
10. Delete `backend/credentials_manager.py`
11. Verify:
    ```bash
    grep -rn "credentials_manager" backend/ --include="*.py" | grep -v __pycache__
    # Should return 0 results
    ```

---

## Verification Checklist

- [ ] `grep -rn "credentials_manager" backend/` → 0 results
- [ ] `credentials_manager.py` deleted
- [ ] SSH keys are exported to filesystem on startup (check `data/ssh_keys/`)
- [ ] Credentials CRUD endpoints work
- [ ] Personal credentials in profile work
- [ ] Netmiko credential decryption works
- [ ] Backend starts: `python -c "import main"`
