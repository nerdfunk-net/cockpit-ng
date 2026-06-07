#!/usr/bin/env python3
"""Regression guard: no hardcoded secrets in backend production code.

Detects string literals (≥ 8 chars) assigned to, or used as the value of,
variables/dict-keys whose names suggest they hold a credential.

Two patterns are checked per line:
  A) Bare assignment:   password = "value"  /  api_key = f"value"
  B) Quoted dict key:   "password": "value" /  'api_key': 'value'

Lines are skipped when the context makes clear the value is not a real
credential: os.getenv/environ look-ups, equality comparisons, exception raises.
Values are skipped when they contain known placeholder markers.

Allow-list format: "routers/foo/bar.py:42"  (relative path + line number).
Keep the allow-list empty.  A non-empty entry means an audited exception.

Usage::

    python backend/scripts/check_hardcoded_secrets.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

# ── Sensitive keyword list ────────────────────────────────────────────────────

_KW = (
    r"password|passwd|secret(?:_key)?|api[_\-]?(?:key|secret)|"
    r"auth[_\-]?token|access[_\-]?token|private[_\-]?key|signing[_\-]?key|"
    r"bearer[_\-]?token|encryption[_\-]?key"
)

# ── Detection patterns ────────────────────────────────────────────────────────

# A) keyword = "value"  /  keyword = f"value"
_PAT_ASSIGN = re.compile(
    r"\b(" + _KW + r")\s*=\s*f?[\"']([^\"'\n]{8,})[\"']",
    re.IGNORECASE,
)

# B) "keyword": "value"  /  'keyword': 'value'
_PAT_DICT = re.compile(
    r"[\"'](" + _KW + r")[\"']\s*:\s*f?[\"']([^\"'\n]{8,})[\"']",
    re.IGNORECASE,
)

# ── Safe-value filter ─────────────────────────────────────────────────────────
# A value containing any of these substrings is an obvious placeholder,
# not a real credential.

_SAFE_VALUE = re.compile(
    r"(?i)change|your[_\-]?|example|placeholder|<[^>]*>|\{[^}]+\}|"
    r"\bxxx+\b|todo|dummy|fake|mock|sample|replace|insert[_\-]?here",
)

# ── Safe-line context filter ──────────────────────────────────────────────────
# If the line contains any of these, the keyword+value is not a hardcoded
# secret but rather an env-var look-up, a comparison, or an error raise.

_SAFE_CONTEXT = re.compile(
    r"os\.(?:getenv|environ)|"  # value comes from environment
    r"==\s*[\"']|[\"']\s*==|"  # equality comparison
    r"!=\s*[\"']|[\"']\s*!=|"  # inequality comparison
    r"\braise\b",               # exception message, not a binding
)

# ── Scan scope ────────────────────────────────────────────────────────────────

SCANNED_DIRS = ("routers", "services", "repositories", "core", "models")

# ── Allow-list ────────────────────────────────────────────────────────────────
# Format: "relative/path.py:line_number"
# Must remain empty.  Add an entry only after auditing the value and
# confirming it is NOT a real credential (e.g., a test sentinel).

ALLOW_LIST: frozenset[str] = frozenset()


def _backend_root() -> Path:
    return Path(__file__).resolve().parent.parent


def _scan_line(line: str) -> list[tuple[str, str]]:
    """Return (keyword, truncated_value) pairs if the line looks like a hardcoded secret."""
    stripped = line.strip()
    if stripped.startswith("#") or stripped.startswith(">>>"):
        return []
    if _SAFE_CONTEXT.search(line):
        return []

    hits: list[tuple[str, str]] = []
    for pat in (_PAT_ASSIGN, _PAT_DICT):
        for m in pat.finditer(line):
            keyword, value = m.group(1), m.group(2)
            if _SAFE_VALUE.search(value):
                continue
            display = value[:40] + ("..." if len(value) > 40 else "")
            hits.append((keyword, display))
    return hits


def main() -> int:
    root = _backend_root()
    failures: list[tuple[str, int, str, str]] = []

    scan_roots = [root / d for d in SCANNED_DIRS if (root / d).is_dir()]
    for scan_root in scan_roots:
        for py in sorted(scan_root.rglob("*.py")):
            if py.name.startswith("test_") or py.name.endswith("_test.py"):
                continue
            try:
                src = py.read_text(encoding="utf-8")
            except (UnicodeDecodeError, OSError):
                continue
            rel = py.relative_to(root).as_posix()
            for lineno, line in enumerate(src.splitlines(), start=1):
                entry = f"{rel}:{lineno}"
                if entry in ALLOW_LIST:
                    continue
                for keyword, value in _scan_line(line):
                    failures.append((entry, lineno, keyword, value))

    if not failures:
        print("[OK] no hardcoded secrets detected in backend production code")
        return 0

    print("[FAIL] potential hardcoded secrets found:")
    for entry, _lineno, keyword, value in failures:
        print(f"  {entry}: {keyword} = '{value}'")
    print(
        "\nIf a match is a false positive, add its 'path:lineno' key to "
        "ALLOW_LIST in this script with a comment confirming the value is "
        "not a real credential."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
