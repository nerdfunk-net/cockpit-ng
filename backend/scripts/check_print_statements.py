#!/usr/bin/env python3
"""Regression guard: no print() calls in backend production code.

Use the logging module for all output in routers, services, repositories,
and core modules. print() bypasses structured logging and silently discards
output in production environments.

Usage::

    python backend/scripts/check_print_statements.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

PATTERN = re.compile(r"\bprint\s*\(")

# Only scan production service code; root-level startup scripts are excluded
# by targeting these directories explicitly.
SCANNED_DIRS = ("routers", "services", "repositories", "core")

# Files in SCANNED_DIRS that are intentional test/CLI scripts, not service code.
EXCLUDED_FILENAMES = frozenset({"test_client.py"})


def _backend_root() -> Path:
    return Path(__file__).resolve().parent.parent


def main() -> int:
    root = _backend_root()
    failures: list[tuple[Path, int, str]] = []

    scan_roots = [root / d for d in SCANNED_DIRS if (root / d).is_dir()]
    for scan_root in scan_roots:
        for py in sorted(scan_root.rglob("*.py")):
            if py.name in EXCLUDED_FILENAMES:
                continue
            try:
                src = py.read_text(encoding="utf-8")
            except (UnicodeDecodeError, OSError):
                continue
            for lineno, line in enumerate(src.splitlines(), start=1):
                stripped = line.strip()
                # Skip comments and doctest examples (>>> print(...))
                if stripped.startswith("#") or stripped.startswith(">>>"):
                    continue
                if PATTERN.search(line):
                    failures.append((py, lineno, stripped))

    if not failures:
        print("[OK] no print() calls in backend production code")
        return 0

    print("[FAIL] print() calls found (use logging module instead):")
    for path, lineno, line in failures:
        rel = path.relative_to(root)
        snippet = line[:120] + ("..." if len(line) > 120 else "")
        print(f"  {rel}:{lineno}: {snippet}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
