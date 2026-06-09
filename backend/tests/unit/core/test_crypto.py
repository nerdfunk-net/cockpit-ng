"""Unit tests for core/crypto.py.

Locks in the key-derivation contract relied on by the credential rotation
tooling (scripts/credential_manager/rotate_key.py):
  * same secret + same iterations -> round-trip succeeds
  * different secret or different iteration count -> decryption fails
"""

from __future__ import annotations

import os

import pytest

from core.crypto import (
    LEGACY_KDF_ITERATIONS,
    RECOMMENDED_KDF_ITERATIONS,
    EncryptionService,
    resolve_credential_secret,
)

_SECRET = "unit-test-secret"


@pytest.mark.unit
def test_encrypt_decrypt_round_trip() -> None:
    enc = EncryptionService(_SECRET, iterations=LEGACY_KDF_ITERATIONS)

    token = enc.encrypt("plaintext-password")

    assert enc.decrypt(token) == "plaintext-password"


@pytest.mark.unit
def test_iteration_constants() -> None:
    """The rotation tooling's defaults depend on these exact values."""
    assert LEGACY_KDF_ITERATIONS == 100_000
    assert RECOMMENDED_KDF_ITERATIONS == 600_000


@pytest.mark.unit
def test_default_iterations_matches_legacy_without_env_override() -> None:
    """Without KDF_ITERATIONS set, ciphertext stays compatible with legacy data.

    EncryptionService() (no explicit iterations) must round-trip with an
    explicitly legacy-configured instance — this is the backward-compat
    guarantee for existing installs. (KDF_ITERATIONS is read at import time,
    so this test reflects the test environment's effective configuration.)
    """
    expected = int(os.getenv("KDF_ITERATIONS", str(LEGACY_KDF_ITERATIONS)))
    default_enc = EncryptionService(_SECRET)
    explicit_enc = EncryptionService(_SECRET, iterations=expected)

    assert explicit_enc.decrypt(default_enc.encrypt("round-trip")) == "round-trip"


@pytest.mark.unit
def test_different_iteration_counts_are_incompatible() -> None:
    """A key derived with 600k iterations cannot decrypt 100k ciphertext.

    This is the contract the rotation runbook depends on: legacy data MUST be
    decrypted with the legacy iteration count and re-encrypted with the new one.
    """
    legacy_enc = EncryptionService(_SECRET, iterations=LEGACY_KDF_ITERATIONS)
    new_enc = EncryptionService(_SECRET, iterations=RECOMMENDED_KDF_ITERATIONS)

    legacy_token = legacy_enc.encrypt("legacy-data")
    new_token = new_enc.encrypt("new-data")

    with pytest.raises(ValueError, match="Failed to decrypt"):
        new_enc.decrypt(legacy_token)
    with pytest.raises(ValueError, match="Failed to decrypt"):
        legacy_enc.decrypt(new_token)


@pytest.mark.unit
def test_different_secrets_are_incompatible() -> None:
    enc_a = EncryptionService("key-a", iterations=LEGACY_KDF_ITERATIONS)
    enc_b = EncryptionService("key-b", iterations=LEGACY_KDF_ITERATIONS)

    token = enc_a.encrypt("data")

    with pytest.raises(ValueError, match="Failed to decrypt"):
        enc_b.decrypt(token)


@pytest.mark.unit
def test_resolve_credential_secret_priority(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CREDENTIAL_ENCRYPTION_KEY", "dedicated")
    monkeypatch.setenv("SECRET_KEY", "jwt-secret")

    assert resolve_credential_secret("explicit") == "explicit"
    assert resolve_credential_secret() == "dedicated"

    monkeypatch.delenv("CREDENTIAL_ENCRYPTION_KEY")
    assert resolve_credential_secret() == "jwt-secret"


@pytest.mark.unit
def test_resolve_credential_secret_raises_without_any_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("CREDENTIAL_ENCRYPTION_KEY", raising=False)
    monkeypatch.delenv("SECRET_KEY", raising=False)

    with pytest.raises(RuntimeError, match="CREDENTIAL_ENCRYPTION_KEY"):
        resolve_credential_secret()
