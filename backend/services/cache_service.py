"""
Cache service to prefetch and serve Git commit lists and file history with TTL.
"""
from __future__ import annotations
import time
import threading
from typing import Dict, Any, Optional, Tuple
from dataclasses import dataclass

@dataclass
class CacheEntry:
    data: Any
    expires_at: float

class CacheService:
    def __init__(self):
        self._cache: Dict[str, CacheEntry] = {}
        self._lock = threading.RLock()

    def _key(self, namespace: str, *parts: str) -> str:
        return f"{namespace}:" + ":".join(parts)

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._cache.get(key)
            now = time.time()
            if entry and entry.expires_at > now:
                return entry.data
            if entry:
                # expired
                del self._cache[key]
            return None

    def set(self, key: str, data: Any, ttl_seconds: int) -> None:
        with self._lock:
            self._cache[key] = CacheEntry(data=data, expires_at=time.time() + ttl_seconds)

    def clear_namespace(self, namespace: str) -> None:
        with self._lock:
            keys = [k for k in self._cache if k.startswith(namespace + ":")]
            for k in keys:
                del self._cache[k]

    def clear_all(self) -> None:
        """Remove all cache entries."""
        with self._lock:
            self._cache.clear()

    def stats(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "items": len(self._cache),
                "keys": list(self._cache.keys())
            }

cache_service = CacheService()
