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
