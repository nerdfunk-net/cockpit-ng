"""Thread-safe session cancellation registry for Netmiko operations."""

from __future__ import annotations

import threading
from typing import Set


class SessionRegistry:
    """Tracks active and cancelled Netmiko execution sessions."""

    def __init__(self) -> None:
        self._cancelled: Set[str] = set()
        self._active: Set[str] = set()
        self._lock = threading.Lock()

    def register(self, session_id: str) -> None:
        with self._lock:
            self._active.add(session_id)

    def unregister(self, session_id: str) -> None:
        with self._lock:
            self._active.discard(session_id)
            self._cancelled.discard(session_id)

    def cancel(self, session_id: str) -> None:
        with self._lock:
            self._cancelled.add(session_id)

    def is_cancelled(self, session_id: str) -> bool:
        with self._lock:
            return session_id in self._cancelled
