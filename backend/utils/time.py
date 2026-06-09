"""Time helpers — single source for UTC timestamps.

Replaces the deprecated ``datetime.utcnow()``. Use ``utc_now()`` for aware
timestamps; use ``utc_now_naive()`` only for DB columns declared without
timezone (to preserve existing stored representation).
"""

from __future__ import annotations

from datetime import datetime, timezone


def utc_now() -> datetime:
    """Timezone-aware current UTC time."""
    return datetime.now(timezone.utc)


def utc_now_naive() -> datetime:
    """Naive UTC time (tzinfo stripped) for legacy naive DB columns."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
