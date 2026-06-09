"""Unit tests for core/api_keys.py."""

import hashlib

import pytest

from core.api_keys import hash_api_key, is_api_key_hash


@pytest.mark.unit
class TestHashApiKey:
    def test_returns_sha256_hex_digest(self) -> None:
        key = "k" * 42
        assert hash_api_key(key) == hashlib.sha256(key.encode("utf-8")).hexdigest()

    def test_digest_is_64_char_hex(self) -> None:
        digest = hash_api_key("any-key")
        assert is_api_key_hash(digest)

    def test_deterministic(self) -> None:
        assert hash_api_key("same") == hash_api_key("same")


@pytest.mark.unit
class TestIsApiKeyHash:
    def test_raw_42_char_key_is_not_a_hash(self) -> None:
        assert not is_api_key_hash("A" * 42)

    def test_64_char_non_hex_is_not_a_hash(self) -> None:
        assert not is_api_key_hash("z" * 64)

    def test_uppercase_hex_digest_is_a_hash(self) -> None:
        assert is_api_key_hash(hash_api_key("x").upper())

    def test_empty_string_is_not_a_hash(self) -> None:
        assert not is_api_key_hash("")
