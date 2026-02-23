"""
Migration 015: Re-encrypt credentials from SHA-256 to PBKDF2-HMAC-SHA256 key derivation

The original `credentials_manager._build_key()` derived the Fernet encryption key with
a single SHA-256 hash of SECRET_KEY. This is fast to brute-force. Migration 015 upgrades
to PBKDF2-HMAC-SHA256 with 100 000 iterations, matching the new `_build_key()` in
`credentials_manager.py`.

This migration:
  1. Reads every row in the `credentials` table that has at least one encrypted field.
  2. Decrypts each field with the old SHA-256-based key.
  3. Re-encrypts it with the new PBKDF2-based key.
  4. Writes the updated ciphertext back to the database.

The migration is idempotent regarding the migration tracking table (the runner will
not re-run it). However, running _this upgrade() method when the credentials are
already encrypted with PBKDF2 would corrupt them, so the migration framework's
deduplication is essential.

Pre-requisites:
  - SECRET_KEY environment variable must be set (application fails to start without it
    since the fix for issue 1.1).
  - The `credentials` table must exist (created by SQLAlchemy `create_all` on startup).
"""

from __future__ import annotations

import base64
import hashlib
import logging
import os

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from sqlalchemy import text

from migrations.base import BaseMigration

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Key derivation – both old and new must be defined here so the migration is
# self-contained and does not break if credentials_manager.py changes again.
# ---------------------------------------------------------------------------

_ENCRYPTED_COLUMNS = [
    "password_encrypted",
    "ssh_key_encrypted",
    "ssh_passphrase_encrypted",
]


def _old_key(secret: str) -> bytes:
    """Original SHA-256-based key derivation (fast, now replaced)."""
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


_NEW_KDF_SALT = b"cockpit-credential-encryption-v2"
_NEW_KDF_ITERATIONS = 100_000


def _new_key(secret: str) -> bytes:
    """New PBKDF2-HMAC-SHA256-based key derivation (slow, brute-force resistant)."""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=_NEW_KDF_SALT,
        iterations=_NEW_KDF_ITERATIONS,
    )
    return base64.urlsafe_b64encode(kdf.derive(secret.encode("utf-8")))


class Migration(BaseMigration):
    """Re-encrypt all credential ciphertext from SHA-256 to PBKDF2 key derivation."""

    @property
    def name(self) -> str:
        return "015_migrate_credential_encryption"

    @property
    def description(self) -> str:
        return (
            "Re-encrypt credentials table from single-SHA-256 key derivation to "
            "PBKDF2-HMAC-SHA256 (100 000 iterations) for brute-force resistance"
        )

    def upgrade(self) -> dict:
        secret = os.getenv("SECRET_KEY", "")
        if not secret:
            raise RuntimeError(
                "[015] SECRET_KEY is not set. Cannot re-encrypt credentials."
            )

        old_fernet = Fernet(_old_key(secret))
        new_fernet = Fernet(_new_key(secret))

        rows_updated = 0
        rows_skipped = 0
        errors = 0

        with self.engine.connect() as conn:
            # Fetch all credential rows that have at least one encrypted field.
            result = conn.execute(
                text(
                    "SELECT id, password_encrypted, ssh_key_encrypted, "
                    "ssh_passphrase_encrypted FROM credentials"
                )
            )
            rows = result.fetchall()
            self.log_info(f"Found {len(rows)} credential row(s) to process")

            for row in rows:
                cred_id = row[0]
                updates: dict[str, bytes | None] = {}

                fields = {
                    "password_encrypted": row[1],
                    "ssh_key_encrypted": row[2],
                    "ssh_passphrase_encrypted": row[3],
                }

                has_data = False
                for col, ciphertext in fields.items():
                    if ciphertext is None:
                        continue

                    has_data = True
                    try:
                        plaintext = old_fernet.decrypt(bytes(ciphertext))
                        updates[col] = new_fernet.encrypt(plaintext)
                    except InvalidToken:
                        # Ciphertext is not decryptable with the old key.
                        # This can happen if the credential was encrypted by a
                        # different SECRET_KEY or is already using the new key.
                        logger.warning(
                            "[015] credential id=%s col=%s: cannot decrypt with "
                            "old key – skipping field (may already be re-encrypted)",
                            cred_id,
                            col,
                        )
                        errors += 1

                if not has_data:
                    rows_skipped += 1
                    continue

                if updates:
                    set_clauses = ", ".join(f"{col} = :{col}" for col in updates)
                    params = {"id": cred_id, **updates}
                    conn.execute(
                        text(
                            f"UPDATE credentials SET {set_clauses} WHERE id = :id"
                        ),
                        params,
                    )
                    rows_updated += 1

            conn.commit()

        self.log_info(
            f"Re-encryption complete: {rows_updated} updated, "
            f"{rows_skipped} skipped (no encrypted fields), "
            f"{errors} field(s) with decryption errors"
        )

        return {
            "rows_updated": rows_updated,
            "rows_skipped": rows_skipped,
            "decryption_errors": errors,
            "message": (
                f"Re-encrypted {rows_updated} credential row(s) from SHA-256 to "
                "PBKDF2-HMAC-SHA256 key derivation"
            ),
        }
