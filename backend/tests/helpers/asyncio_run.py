"""Helpers for mocking asyncio.run in unit tests without leaking coroutines."""

from __future__ import annotations

from typing import Callable, TypeVar

T = TypeVar("T")


def close_coroutine(coro: object) -> None:
    """Close a coroutine passed to a mocked asyncio.run (avoids ResourceWarning)."""
    close = getattr(coro, "close", None)
    if callable(close):
        close()


def mock_asyncio_run_returning(value: T) -> Callable[[object], T]:
    """Return a side_effect for patch(asyncio.run) that closes the coroutine."""

    def _run(coro: object) -> T:
        close_coroutine(coro)
        return value

    return _run


def mock_asyncio_run_raising(exc: BaseException) -> Callable[[object], None]:
    """Return a side_effect for patch(asyncio.run) that closes then raises."""

    def _run(coro: object) -> None:
        close_coroutine(coro)
        raise exc

    return _run


def mock_asyncio_run_sequence(values: list) -> Callable[[object], object]:
    """Return a side_effect that returns values in order (one per asyncio.run call)."""

    iterator = iter(values)

    def _run(coro: object) -> object:
        close_coroutine(coro)
        return next(iterator)

    return _run
