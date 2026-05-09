# Refactoring Step 1 — Quick Wins

**Date:** 2026-05-09  
**Scope:** Priority 1 items from `doc/AUDIT_REPORT.md`  
**Risk level:** Low — no API surface changes, no migrations required  
**Estimated effort:** < 1 day

These four tasks are fully independent and can be done in any order. Each is
self-contained and verifiable with `grep` after completion.

---

## Task 1 — Fix f-string Logging Violations

**File:** `backend/user_db_manager.py`  
**Lines:** 333, 345–346, 350–352, 385, 405  
**Standard:** CLAUDE.md — `❌ using f-string in Logging`

### Why This Matters

Python's `logging` module accepts `%s`-style format strings and delays interpolation
until the message is actually emitted. f-strings evaluate eagerly — even when the
log level is disabled — wasting CPU on string formatting that will be discarded.

### Changes Required

Replace every f-string inside a `logging.*()` call with `%s`-style formatting.

```python
# BEFORE — line 333
logging.getLogger(__name__).warning(f"Failed to seed RBAC: {e}")

# AFTER
logging.getLogger(__name__).warning("Failed to seed RBAC: %s", e)
```

```python
# BEFORE — lines 345-346
logging.getLogger(__name__).info(
    f"Assigned admin role to user ID {user_id}"
)

# AFTER
logging.getLogger(__name__).info("Assigned admin role to user ID %s", user_id)
```

```python
# BEFORE — lines 350-352
logging.getLogger(__name__).warning(
    f"Failed to ensure admin role assignment: {e}"
)

# AFTER
logging.getLogger(__name__).warning("Failed to ensure admin role assignment: %s", e)
```

```python
# BEFORE — line 385
logging.getLogger(__name__).warning(f"Failed to create default admin: {e}")

# AFTER
logging.getLogger(__name__).warning("Failed to create default admin: %s", e)
```

```python
# BEFORE — line 405
logging.getLogger(__name__).warning(f"Failed to ensure admin RBAC role: {e}")

# AFTER
logging.getLogger(__name__).warning("Failed to ensure admin RBAC role: %s", e)
```

### Verification

```bash
grep -n 'logging.*f"' backend/user_db_manager.py
# Expected: no output
```

---

## Task 2 — Delete Dead `normalization.py` Monolith

**File to delete:** `backend/services/checkmk/normalization.py` (720 lines)  
**Reason:** Already superseded by the `normalization/` package  
**Risk:** None — Python package takes precedence over a same-named `.py` file

### Background

The directory `services/checkmk/normalization/` exists with a proper `__init__.py`:

```python
# services/checkmk/normalization/__init__.py  (current state)
from .device_normalizer import DeviceNormalizationService
__all__ = ["DeviceNormalizationService"]
```

When Python resolves `from services.checkmk.normalization import DeviceNormalizationService`,
it finds the **package** (directory) first and ignores the sibling `normalization.py` file.
The monolith has been dead since the package was created. It is never imported in practice.

### Verify Before Deleting

```bash
# Confirm the package's __init__.py already exports the correct class
grep "DeviceNormalizationService" backend/services/checkmk/normalization/__init__.py

# Confirm nothing imports the monolith directly by module path
grep -rn "checkmk.normalization.normalization\|checkmk/normalization.py" backend/ --include="*.py"
# Expected: no output

# Confirm all current importers will resolve to the package (not the file)
grep -rn "from services.checkmk.normalization import" backend/ --include="*.py"
# Expected: service_factory.py and tests only — both already work via the package
```

### Action

```bash
rm backend/services/checkmk/normalization.py
```

### Verification After Deletion

```bash
# Confirm the package import still resolves
cd backend && python -c "from services.checkmk.normalization import DeviceNormalizationService; print('OK')"

# Run the integration test that depends on this import
pytest tests/integration/test_snmp_mapping_comparison.py -v
```

---

## Task 3 — Extract Canonical `EncryptionService` to `core/crypto.py`

**Files to create:** `backend/core/crypto.py`  
**Files to update:** `backend/credentials_manager.py`, `backend/compliance_manager.py`

### Problem

Two separate `EncryptionService` classes exist with an important difference in
their key derivation function:

| File | KDF | Security |
|---|---|---|
| `credentials_manager.py` | PBKDF2-HMAC-SHA256, 100k iterations, fixed salt | **Stronger** |
| `compliance_manager.py` | Plain SHA-256 hash | **Weaker** |

These are **not interchangeable** — data encrypted by one cannot be decrypted by
the other. The canonical implementation must be PBKDF2-HMAC-SHA256 (from
`credentials_manager.py`). The compliance manager's SHA-256 variant is a
security regression that must be replaced.

> **IMPORTANT:** The compliance manager's `LoginCredential` and `SNMPMapping`
> records stored in the database were encrypted with the plain SHA-256 KDF.
> After switching to PBKDF2, existing records will fail to decrypt.
> A one-time re-encryption migration script must run before deploying this change
> to a production database that has existing compliance credentials.
> See `scripts/credential_manager/rotate_key.py` as a reference for the pattern.

### New File: `core/crypto.py`

```python
"""Shared cryptographic utilities.

All credential encryption in cockpit uses a single canonical key derivation
function (PBKDF2-HMAC-SHA256). Modules that need to encrypt or decrypt
sensitive values MUST import from here — never define local EncryptionService
classes.
"""

from __future__ import annotations

import base64
import os
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

# Fixed salt for deterministic key derivation.
# Changing this salt makes ALL stored ciphertext unreadable across the app.
# Run a re-encryption migration whenever this value changes.
_KDF_SALT = b"cockpit-credential-encryption-v2"
_KDF_ITERATIONS = 100_000


def _build_key(secret: str) -> bytes:
    """Derive a Fernet-compatible 32-byte key using PBKDF2-HMAC-SHA256."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=_KDF_SALT,
        iterations=_KDF_ITERATIONS,
    )
    return base64.urlsafe_b64encode(kdf.derive(secret.encode("utf-8")))


class EncryptionService:
    """Fernet-based symmetric encryption backed by a PBKDF2-derived key.

    Instantiate with an explicit *secret_key* for rotation scripts; in
    application code rely on the module-level singleton instead.
    """

    def __init__(self, secret_key: Optional[str] = None) -> None:
        secret = secret_key or os.getenv("SECRET_KEY")
        if not secret:
            raise RuntimeError("SECRET_KEY not set for credential encryption")
        self._fernet = Fernet(_build_key(secret))

    def encrypt(self, plaintext: str) -> bytes:
        return self._fernet.encrypt(plaintext.encode("utf-8"))

    def decrypt(self, token: bytes) -> str:
        try:
            return self._fernet.decrypt(token).decode("utf-8")
        except InvalidToken as exc:
            raise ValueError("Failed to decrypt stored credential") from exc
```

### Update `credentials_manager.py`

Replace the local `_build_key` function, `EncryptionService` class, and their
imports with a single import from `core.crypto`:

```python
# REMOVE these lines from credentials_manager.py:
import base64
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

_KDF_SALT = b"cockpit-credential-encryption-v2"
_KDF_ITERATIONS = 100_000

def _build_key(secret: str) -> bytes: ...

class EncryptionService: ...

# ADD at the top of credentials_manager.py:
from core.crypto import EncryptionService
```

The module-level singleton `encryption_service = EncryptionService()` stays in
`credentials_manager.py` unchanged — it is a manager-level convenience instance.

### Update `compliance_manager.py`

Same pattern. Additionally, the weaker `_build_key` using plain SHA-256 is removed:

```python
# REMOVE from compliance_manager.py:
import base64
import hashlib
from cryptography.fernet import Fernet, InvalidToken

def _build_key(secret: str) -> bytes: ...

class EncryptionService: ...

# ADD:
from core.crypto import EncryptionService
```

### Verification

```bash
# No local EncryptionService definitions remain in manager files
grep -n "class EncryptionService" backend/credentials_manager.py backend/compliance_manager.py
# Expected: no output

# Canonical source exists
grep -n "class EncryptionService" backend/core/crypto.py
# Expected: one match

# Imports resolve correctly
cd backend && python -c "
from core.crypto import EncryptionService
svc = EncryptionService.__new__(EncryptionService)
print('EncryptionService importable OK')
"

# Rotating-key script still references correct class
grep "from credentials_manager import EncryptionService" backend/scripts/credential_manager/rotate_key.py
# This still works because credentials_manager re-exports EncryptionService via its import
```

---

## Task 4 — Confirm `DeviceNormalizationService` Wiring (No Code Change Needed)

**File:** `backend/service_factory.py:221`

### Finding

The audit report flagged `service_factory.py` as importing from the old monolith.
After investigation: the import statement `from services.checkmk.normalization import DeviceNormalizationService`
resolves to the **package** (`normalization/__init__.py`), not `normalization.py`.
The `__init__.py` already re-exports the modular `DeviceNormalizationService` from
`device_normalizer.py`. No code change is required once Task 2 deletes the monolith.

### Verification

```bash
cd backend && python -c "
from services.checkmk.normalization import DeviceNormalizationService
import inspect, pathlib
src = pathlib.Path(inspect.getfile(DeviceNormalizationService))
print('Loaded from:', src)
assert 'normalization/device_normalizer' in str(src), f'Wrong source: {src}'
print('OK — package version loaded, not the monolith')
"
```

---

## Execution Checklist

```
[ ] Task 1: Fix f-string logging in user_db_manager.py (5 occurrences)
    [ ] Verify: grep -n 'logging.*f"' backend/user_db_manager.py → empty

[ ] Task 2: Delete backend/services/checkmk/normalization.py
    [ ] Pre-check: no direct imports of the .py file exist
    [ ] Action: rm backend/services/checkmk/normalization.py
    [ ] Verify: python -c "from services.checkmk.normalization import DeviceNormalizationService; print('OK')"
    [ ] Verify: pytest tests/integration/test_snmp_mapping_comparison.py -v → pass

[ ] Task 3: Create core/crypto.py, update credentials_manager.py, compliance_manager.py
    [ ] Note: requires re-encryption migration for compliance credentials in production
    [ ] Verify: grep "class EncryptionService" backend/credentials_manager.py backend/compliance_manager.py → empty
    [ ] Verify: grep "class EncryptionService" backend/core/crypto.py → one match
    [ ] Verify: cd backend && python -c "from core.crypto import EncryptionService; print('OK')"

[ ] Task 4: No action required — normalization wiring is already correct
    [ ] Verify (after Task 2): python -c "from services.checkmk.normalization import DeviceNormalizationService; ..." → package version loaded
```

---

## What Is NOT In This Document

The following are scoped to later steps:

- **Priority 2** — Moving Pydantic models out of routers → `REFACTORING_STEP_2.md`
- **Priority 3** — Service extraction (git files router, task business logic) → `REFACTORING_STEP_3.md`
- **Priority 4** — Root-level `*_manager.py` migration to `services/` → `REFACTORING_STEP_4.md`

Each step builds on the previous. Step 1 reduces noise so later diffs are clean.
