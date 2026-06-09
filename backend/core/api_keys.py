"""API key hashing utilities.

API keys are high-entropy random tokens (42 chars), so a fast cryptographic
hash (SHA-256) is sufficient — a slow password hash is unnecessary here.
Only the hash is persisted; the raw key is shown to the user once at creation.
"""

from __future__ import annotations

import hashlib
import string

_HEX_DIGITS = set(string.hexdigits.lower())
_SHA256_HEX_LENGTH = 64


def hash_api_key(api_key: str) -> str:
    """Return the hex SHA-256 digest of an API key."""
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()


def is_api_key_hash(value: str) -> bool:
    """True if ``value`` already looks like a stored sha256 hex digest.

    Raw API keys are exactly 42 chars, so a 64-char hex string can only be
    a digest. Used to keep the plaintext-to-hash data migration idempotent.
    """
    return len(value) == _SHA256_HEX_LENGTH and set(value.lower()) <= _HEX_DIGITS
