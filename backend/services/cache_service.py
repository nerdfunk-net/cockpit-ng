"""
Cache service to prefetch and serve Git commit lists and file history with TTL.
Enhanced with detailed statistics and performance tracking.
"""

from __future__ import annotations
import time
import threading
import sys
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field


@dataclass
class CacheEntry:
    data: Any
    expires_at: float
    created_at: float = field(default_factory=time.time)
    last_accessed: float = field(default_factory=time.time)
    access_count: int = 0
    size_bytes: int = 0

    def __post_init__(self):
        """Calculate size estimate after initialization."""
        if self.size_bytes == 0:
            self.size_bytes = self._estimate_size(self.data)

    def _estimate_size(self, obj: Any) -> int:
        """Rough estimate of object size in bytes."""
        try:
            return sys.getsizeof(obj)
        except (TypeError, OSError):
            return 0


class CacheService:
    def __init__(self):
        self._cache: Dict[str, CacheEntry] = {}
        self._lock = threading.RLock()

        # Performance tracking
        self._stats = {
            "hits": 0,
            "misses": 0,
            "expired": 0,
            "created": 0,
            "cleared": 0,
            "start_time": time.time(),
        }

    def _key(self, namespace: str, *parts: str) -> str:
        return f"{namespace}:" + ":".join(parts)

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._cache.get(key)
            now = time.time()
            if entry and entry.expires_at > now:
                # Cache hit - update access stats
                entry.last_accessed = now
                entry.access_count += 1
                self._stats["hits"] += 1
                return entry.data
            if entry:
                # Expired entry
                del self._cache[key]
                self._stats["expired"] += 1

            # Cache miss
            self._stats["misses"] += 1
            return None

    def set(self, key: str, data: Any, ttl_seconds: int) -> None:
        with self._lock:
            now = time.time()
            self._cache[key] = CacheEntry(
                data=data,
                expires_at=now + ttl_seconds,
                created_at=now,
                last_accessed=now,
            )
            self._stats["created"] += 1

    def delete(self, key: str) -> bool:
        """Delete a specific cache entry by key.

        Args:
            key: The cache key to delete

        Returns:
            bool: True if the key existed and was deleted, False if key didn't exist
        """
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                self._stats["cleared"] += 1
                return True
            return False

    def clear_namespace(self, namespace: str) -> int:
        """Clear entries by namespace and return count of cleared items."""
        with self._lock:
            keys = [k for k in self._cache if k.startswith(namespace + ":")]
            for k in keys:
                del self._cache[k]
            cleared_count = len(keys)
            self._stats["cleared"] += cleared_count
            return cleared_count

    def clear_all(self) -> int:
        """Remove all cache entries and return count of cleared items."""
        with self._lock:
            cleared_count = len(self._cache)
            self._cache.clear()
            self._stats["cleared"] += cleared_count
            return cleared_count

    def stats(self) -> Dict[str, Any]:
        """Get comprehensive cache statistics."""
        with self._lock:
            now = time.time()

            # Calculate total memory usage and entry details
            total_size = 0
            expired_count = 0
            valid_entries = []

            for key, entry in self._cache.items():
                total_size += entry.size_bytes
                if entry.expires_at <= now:
                    expired_count += 1
                else:
                    valid_entries.append(
                        {
                            "key": key,
                            "expires_in": entry.expires_at - now,
                            "age": now - entry.created_at,
                            "last_accessed": now - entry.last_accessed,
                            "access_count": entry.access_count,
                            "size_bytes": entry.size_bytes,
                        }
                    )

            # Calculate hit rate
            total_requests = self._stats["hits"] + self._stats["misses"]
            hit_rate = (
                (self._stats["hits"] / total_requests * 100)
                if total_requests > 0
                else 0
            )

            # Group entries by namespace
            namespaces = {}
            for entry in valid_entries:
                namespace = (
                    entry["key"].split(":")[0] if ":" in entry["key"] else "default"
                )
                if namespace not in namespaces:
                    namespaces[namespace] = {"count": 0, "size_bytes": 0}
                namespaces[namespace]["count"] += 1
                namespaces[namespace]["size_bytes"] += entry["size_bytes"]

            return {
                "overview": {
                    "total_items": len(self._cache),
                    "valid_items": len(valid_entries),
                    "expired_items": expired_count,
                    "total_size_bytes": total_size,
                    "total_size_mb": round(total_size / 1024 / 1024, 2),
                    "uptime_seconds": round(now - self._stats["start_time"], 1),
                },
                "performance": {
                    "cache_hits": self._stats["hits"],
                    "cache_misses": self._stats["misses"],
                    "hit_rate_percent": round(hit_rate, 2),
                    "expired_entries": self._stats["expired"],
                    "entries_created": self._stats["created"],
                    "entries_cleared": self._stats["cleared"],
                },
                "namespaces": namespaces,
                "keys": list(self._cache.keys()),
            }

    def get_entries(self, include_expired: bool = False) -> List[Dict[str, Any]]:
        """Get detailed information about all cache entries."""
        with self._lock:
            now = time.time()
            entries = []

            for key, entry in self._cache.items():
                is_expired = entry.expires_at <= now

                # Skip expired entries unless requested
                if is_expired and not include_expired:
                    continue

                entries.append(
                    {
                        "key": key,
                        "namespace": key.split(":")[0] if ":" in key else "default",
                        "created_at": entry.created_at,
                        "expires_at": entry.expires_at,
                        "last_accessed": entry.last_accessed,
                        "access_count": entry.access_count,
                        "size_bytes": entry.size_bytes,
                        "age_seconds": round(now - entry.created_at, 1),
                        "ttl_seconds": round(entry.expires_at - now, 1)
                        if not is_expired
                        else 0,
                        "last_accessed_ago": round(now - entry.last_accessed, 1),
                        "is_expired": is_expired,
                    }
                )

            # Sort by most recently accessed first
            entries.sort(key=lambda x: x["last_accessed"], reverse=True)
            return entries

    def get_namespace_info(self, namespace: str) -> Dict[str, Any]:
        """Get detailed information about a specific namespace."""
        with self._lock:
            now = time.time()
            entries = []
            total_size = 0
            valid_count = 0
            expired_count = 0

            for key, entry in self._cache.items():
                if key.startswith(namespace + ":") or (
                    namespace == "default" and ":" not in key
                ):
                    is_expired = entry.expires_at <= now
                    total_size += entry.size_bytes

                    if is_expired:
                        expired_count += 1
                    else:
                        valid_count += 1

                    entries.append(
                        {
                            "key": key,
                            "created_at": entry.created_at,
                            "expires_at": entry.expires_at,
                            "last_accessed": entry.last_accessed,
                            "access_count": entry.access_count,
                            "size_bytes": entry.size_bytes,
                            "ttl_seconds": round(entry.expires_at - now, 1)
                            if not is_expired
                            else 0,
                            "is_expired": is_expired,
                        }
                    )

            return {
                "namespace": namespace,
                "total_entries": len(entries),
                "valid_entries": valid_count,
                "expired_entries": expired_count,
                "total_size_bytes": total_size,
                "total_size_mb": round(total_size / 1024 / 1024, 2),
                "entries": entries,
            }

    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get detailed performance metrics."""
        with self._lock:
            now = time.time()
            uptime = now - self._stats["start_time"]
            total_requests = self._stats["hits"] + self._stats["misses"]

            return {
                "uptime_seconds": round(uptime, 1),
                "total_requests": total_requests,
                "requests_per_second": round(total_requests / uptime, 2)
                if uptime > 0
                else 0,
                "cache_hits": self._stats["hits"],
                "cache_misses": self._stats["misses"],
                "hit_rate_percent": round(
                    (self._stats["hits"] / total_requests * 100)
                    if total_requests > 0
                    else 0,
                    2,
                ),
                "expired_entries": self._stats["expired"],
                "entries_created": self._stats["created"],
                "entries_cleared": self._stats["cleared"],
                "current_entries": len(self._cache),
            }

    def cleanup_expired(self) -> int:
        """Remove expired entries and return count of removed items."""
        with self._lock:
            now = time.time()
            expired_keys = [
                key for key, entry in self._cache.items() if entry.expires_at <= now
            ]

            for key in expired_keys:
                del self._cache[key]

            removed_count = len(expired_keys)
            self._stats["expired"] += removed_count
            return removed_count


cache_service = CacheService()
