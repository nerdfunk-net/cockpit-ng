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
#
# Changing the salt or iteration count changes the derived Fernet key, which
# makes ALL stored ciphertext unreadable until re-encrypted. Run the
# re-encryption migration (scripts/credential_manager/rotate_key.py) whenever
# these values change. See doc/refactoring/FABLE_HIGH_1.md §3 for the runbook.
_KDF_SALT = b"cockpit-credential-encryption-v2"

# Iteration count used by all ciphertext created before KDF_ITERATIONS existed.
LEGACY_KDF_ITERATIONS = 100_000

# OWASP 2023 recommends >= 600k iterations for PBKDF2-HMAC-SHA256. The input
# here is a high-entropy secret (not a user password), but aligning with the
# recommendation is defense in depth. Adopt it via the rotation runbook.
RECOMMENDED_KDF_ITERATIONS = 600_000

# PBKDF2 iteration count, configurable via the KDF_ITERATIONS env var.
#
# WARNING: this value is part of the derived encryption key. Changing it on an
# existing install WITHOUT running scripts/credential_manager/rotate_key.py
# makes all stored credentials undecryptable. It must be set identically on
# every process that touches encryption (backend, Celery worker, beat).
#
# The default stays at the legacy value so upgrades are non-breaking; migrate
# to RECOMMENDED_KDF_ITERATIONS with the rotation runbook, then set
# KDF_ITERATIONS=600000 in the environment.
_KDF_ITERATIONS = int(os.getenv("KDF_ITERATIONS", str(LEGACY_KDF_ITERATIONS)))


def _build_key(secret: str, iterations: int = _KDF_ITERATIONS) -> bytes:
    """Derive a Fernet-compatible 32-byte key using PBKDF2-HMAC-SHA256."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=_KDF_SALT,
        iterations=iterations,
    )
    return base64.urlsafe_b64encode(kdf.derive(secret.encode("utf-8")))


def resolve_credential_secret(explicit: Optional[str] = None) -> str:
    """Resolve the secret used for credential-at-rest encryption.

    Priority:
      1. explicit argument (used by rotation scripts),
      2. CREDENTIAL_ENCRYPTION_KEY env var (dedicated key),
      3. SECRET_KEY env var (backward-compatible fallback).

    Raises RuntimeError if none is available.
    """
    secret = (
        explicit or os.getenv("CREDENTIAL_ENCRYPTION_KEY") or os.getenv("SECRET_KEY")
    )
    if not secret:
        raise RuntimeError(
            "No credential encryption secret available. Set "
            "CREDENTIAL_ENCRYPTION_KEY (preferred) or SECRET_KEY."
        )
    return secret


class EncryptionService:
    """Fernet-based symmetric encryption backed by a PBKDF2-derived key.

    Instantiate with an explicit *secret_key* for rotation scripts; in
    application code prefer constructing via the credential service which
    resolves the dedicated credential key (with SECRET_KEY fallback).

    The optional *iterations* parameter lets rotation tooling decrypt
    ciphertext produced with one iteration count (e.g. legacy 100_000) while
    re-encrypting with another (e.g. recommended 600_000). When omitted, the
    KDF_ITERATIONS env var (default: legacy 100_000) applies.
    """

    def __init__(
        self,
        secret_key: Optional[str] = None,
        *,
        iterations: int = _KDF_ITERATIONS,
    ) -> None:
        secret = secret_key or os.getenv("SECRET_KEY")
        if not secret:
            raise RuntimeError("SECRET_KEY not set for credential encryption")
        self._fernet = Fernet(_build_key(secret, iterations))

    def encrypt(self, plaintext: str) -> bytes:
        return self._fernet.encrypt(plaintext.encode("utf-8"))

    def decrypt(self, token: bytes) -> str:
        try:
            return self._fernet.decrypt(token).decode("utf-8")
        except InvalidToken as exc:
            raise ValueError("Failed to decrypt stored credential") from exc
