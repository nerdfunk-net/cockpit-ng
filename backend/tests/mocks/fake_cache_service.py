"""In-memory cache fake for unit testing.

Drop-in replacement for RedisCacheService's ``get``/``set``/``delete`` surface,
without a real Redis connection or TTL expiry. Keeps unit tests isolated from
each other (a real cache would leak state across test runs since it's backed
by a shared external process).
"""

from __future__ import annotations

from typing import Any, Dict, Optional


class FakeCacheService:
    def __init__(self) -> None:
        self._store: Dict[str, Any] = {}

    def get(self, key: str) -> Optional[Any]:
        return self._store.get(key)

    def set(self, key: str, data: Any, ttl_seconds: int) -> None:
        self._store[key] = data

    def delete(self, key: str) -> bool:
        return self._store.pop(key, None) is not None

    def clear_namespace(self, namespace: str) -> int:
        prefix = f"{namespace}:"
        keys = [k for k in self._store if k.startswith(prefix)]
        for k in keys:
            del self._store[k]
        return len(keys)
