"""Map database integrity errors to user-facing messages."""

from __future__ import annotations

from sqlalchemy.exc import IntegrityError

_SERVERS_HOSTNAME_UNIQUE = "uq_servers_hostname"


def duplicate_server_hostname_message(hostname: str) -> str:
    """User-facing message when hostname violates the servers unique constraint."""
    name = hostname.strip() or "this hostname"
    return f'A server named "{name}" already exists in Cockpit.'


def is_duplicate_server_hostname_error(exc: BaseException) -> bool:
    """Return True if *exc* (or its cause chain) is a duplicate servers.hostname violation."""
    current: BaseException | None = exc
    seen: set[int] = set()
    while current is not None and id(current) not in seen:
        seen.add(id(current))
        if isinstance(current, IntegrityError):
            text = str(current).lower()
            orig = getattr(current, "orig", None)
            if orig is not None:
                text = f"{text} {orig}".lower()
            if _SERVERS_HOSTNAME_UNIQUE in text:
                return True
            if "duplicate key" in text and "hostname" in text:
                return True
        current = current.__cause__ or current.__context__
    return False
