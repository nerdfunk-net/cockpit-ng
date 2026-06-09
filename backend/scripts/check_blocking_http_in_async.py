#!/usr/bin/env python3
"""Regression guard: no blocking HTTP client calls inside ``async def`` bodies.

Synchronous ``requests`` calls executed directly on the event loop block the
entire FastAPI worker. Wrap them in ``asyncio.to_thread`` or use an async
client (``httpx.AsyncClient``) instead.

Run alongside the other guards::

    cd backend && python scripts/check_blocking_http_in_async.py

Exit code ``1`` if a blocking call is found directly inside an ``async def``.
"""

from __future__ import annotations

import ast
import sys
from pathlib import Path

_BLOCKING = {
    ("requests", "get"),
    ("requests", "post"),
    ("requests", "put"),
    ("requests", "patch"),
    ("requests", "delete"),
    ("requests", "head"),
    ("requests", "request"),
}

ALLOWED_PREFIXES = ("tests/", "tools/", "scripts/", "migrations/")


def _backend_root() -> Path:
    return Path(__file__).resolve().parent.parent


class _Visitor(ast.NodeVisitor):
    def __init__(self) -> None:
        self.kind_stack: list = []
        self.hits: list = []

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> None:
        self.kind_stack.append("async")
        self.generic_visit(node)
        self.kind_stack.pop()

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:
        # A nested sync def (e.g. the `_fetch` passed to asyncio.to_thread)
        # breaks the "directly in async" chain — push "sync".
        self.kind_stack.append("sync")
        self.generic_visit(node)
        self.kind_stack.pop()

    def visit_Call(self, node: ast.Call) -> None:
        f = node.func
        if (
            isinstance(f, ast.Attribute)
            and isinstance(f.value, ast.Name)
            and (f.value.id, f.attr) in _BLOCKING
            and self.kind_stack
            and self.kind_stack[-1] == "async"
        ):
            self.hits.append((node.lineno, f"{f.value.id}.{f.attr}"))
        self.generic_visit(node)


def main() -> int:
    root = _backend_root()
    failures = []
    for py in root.rglob("*.py"):
        rel = py.relative_to(root).as_posix()
        if rel.startswith(ALLOWED_PREFIXES):
            continue
        if "__pycache__" in rel or rel.startswith((".venv/", "venv/")):
            continue
        try:
            tree = ast.parse(py.read_text(encoding="utf-8"))
        except (SyntaxError, UnicodeDecodeError, OSError):
            continue
        visitor = _Visitor()
        visitor.visit(tree)
        for lineno, call in visitor.hits:
            failures.append((py, lineno, call))

    if not failures:
        print("[OK] no blocking HTTP calls directly inside async def")
        return 0

    print(
        "[FAIL] blocking HTTP call inside async def (wrap in asyncio.to_thread "
        "or use httpx.AsyncClient):",
        file=sys.stderr,
    )
    for path, lineno, call in failures:
        print(f"  {path.relative_to(root)}:{lineno}: {call}(...)", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
