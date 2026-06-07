#!/usr/bin/env python3
"""Regression guard: no f-string arguments in logging calls.

Logging calls must use % formatting or positional args, never f-strings:
    logger.info("value is %s", var)   ✓
    logger.info(f"value is {var}")    ✗

Usage::

    python backend/scripts/check_fstring_logging.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

PATTERN = re.compile(r"""(?:logger|logging)\s*\.\s*\w+\s*\(\s*f['"]""")

# Only scan production service code; root-level startup scripts are excluded
# by targeting these directories explicitly.
SCANNED_DIRS = ("routers", "services", "repositories", "core")


def _backend_root() -> Path:
    return Path(__file__).resolve().parent.parent


def main() -> int:
    root = _backend_root()
    failures: list[tuple[Path, int, str]] = []

    scan_roots = [root / d for d in SCANNED_DIRS if (root / d).is_dir()]
    for scan_root in scan_roots:
        for py in sorted(scan_root.rglob("*.py")):
            try:
                src = py.read_text(encoding="utf-8")
            except (UnicodeDecodeError, OSError):
                continue
            for lineno, line in enumerate(src.splitlines(), start=1):
                stripped = line.strip()
                if stripped.startswith("#"):
                    continue
                if PATTERN.search(line):
                    failures.append((py, lineno, stripped))

    if not failures:
        print("[OK] no f-string logging calls in backend production code")
        return 0

    print("[FAIL] f-string logging calls found (use % formatting instead):")
    for path, lineno, line in failures:
        rel = path.relative_to(root)
        snippet = line[:120] + ("..." if len(line) > 120 else "")
        print(f"  {rel}:{lineno}: {snippet}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
