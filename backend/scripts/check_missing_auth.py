#!/usr/bin/env python3
"""Regression guard: every router endpoint must declare an auth dependency.

Auth is satisfied by any of:
  - A parameter default of Depends(<auth_func>) in the function signature
  - A dependencies=[Depends(<auth_func>)] kwarg on the @router.* decorator

Known auth functions:
    verify_token, verify_admin_token, require_permission,
    get_current_username, get_api_key_user, require_role

Intentionally-public endpoints (login, OIDC flows, health checks) must be
listed in ALLOW_LIST below so the exception is explicit and reviewed.

Usage::

    python backend/scripts/check_missing_auth.py
"""

from __future__ import annotations

import ast
import sys
from pathlib import Path

# Format: "routers/relative/path.py:function_name"
# Each entry must have a comment explaining why it is public.
ALLOW_LIST: frozenset[str] = frozenset(
    {
        # ── Login / token endpoints ──────────────────────────────────────────
        "routers/auth/auth.py:login",           # credential submission, no token yet
        "routers/auth/auth.py:refresh_token",   # refresh uses cookie, no Bearer required
        "routers/auth/auth.py:logout",          # clears cookie; no Bearer required
        # ── OIDC flow (browser redirect, no token yet) ───────────────────────
        "routers/auth/oidc.py:check_oidc_enabled",  # UI feature-flag probe
        "routers/auth/oidc.py:get_oidc_providers",  # login-page provider list
        "routers/auth/oidc.py:oidc_login",          # redirect to IdP
        "routers/auth/oidc.py:oidc_test_login",     # test IdP redirect
        "routers/auth/oidc.py:oidc_callback",       # IdP posts back here
        "routers/auth/oidc.py:oidc_logout",         # OIDC session teardown
        "routers/auth/oidc.py:get_oidc_debug_info", # OIDC config debug probe
    }
)

_AUTH_FUNC_NAMES: frozenset[str] = frozenset(
    {
        "verify_token",
        "verify_admin_token",
        "require_permission",
        "get_current_username",
        "get_api_key_user",
        "require_role",
    }
)

_ROUTER_METHODS: frozenset[str] = frozenset(
    {"get", "post", "put", "delete", "patch", "head", "options"}
)


def _is_auth_depends(node: ast.expr) -> bool:
    """Return True if *node* is Depends(<auth_func>) or Depends(<auth_func>(...))."""
    if not isinstance(node, ast.Call):
        return False
    func = node.func
    if not (isinstance(func, ast.Name) and func.id == "Depends"):
        return False
    if not node.args:
        return False
    arg = node.args[0]
    # Depends(verify_token)  /  Depends(get_current_username)
    if isinstance(arg, ast.Name) and arg.id in _AUTH_FUNC_NAMES:
        return True
    # Depends(require_permission("res", "act"))  /  Depends(require_role("admin"))
    if isinstance(arg, ast.Call) and isinstance(arg.func, ast.Name):
        if arg.func.id in _AUTH_FUNC_NAMES:
            return True
    return False


def _decorator_has_auth(decorator: ast.expr) -> bool:
    """Check for dependencies=[Depends(auth)] on the @router.* decorator."""
    if not isinstance(decorator, ast.Call):
        return False
    for kw in decorator.keywords:
        if kw.arg == "dependencies" and isinstance(kw.value, ast.List):
            if any(_is_auth_depends(elt) for elt in kw.value.elts):
                return True
    return False


def _func_has_auth(func_def: ast.FunctionDef | ast.AsyncFunctionDef) -> bool:
    """Return True if any parameter default is Depends(<auth_func>)."""
    defaults = list(func_def.args.defaults) + [
        d for d in func_def.args.kw_defaults if d is not None
    ]
    return any(_is_auth_depends(d) for d in defaults)


def _is_router_decorator(decorator: ast.expr) -> bool:
    if not isinstance(decorator, ast.Call):
        return False
    func = decorator.func
    return isinstance(func, ast.Attribute) and func.attr in _ROUTER_METHODS


def _scan_file(
    path: Path, backend_root: Path
) -> list[tuple[str, int, str]]:
    try:
        src = path.read_text(encoding="utf-8")
        tree = ast.parse(src)
    except (SyntaxError, UnicodeDecodeError, OSError) as exc:
        print(f"[WARN] skip {path}: {exc}", file=sys.stderr)
        return []

    rel = path.relative_to(backend_root).as_posix()
    hits: list[tuple[str, int, str]] = []

    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        router_decorators = [d for d in node.decorator_list if _is_router_decorator(d)]
        if not router_decorators:
            continue
        key = f"{rel}:{node.name}"
        if key in ALLOW_LIST:
            continue
        if any(_decorator_has_auth(d) for d in router_decorators):
            continue
        if _func_has_auth(node):
            continue
        hits.append((key, node.lineno, node.name))

    return hits


def _routers_dir() -> Path:
    return Path(__file__).resolve().parent.parent / "routers"


def main() -> int:
    backend_root = _routers_dir().parent
    routers = _routers_dir()
    if not routers.is_dir():
        print(f"routers directory not found at {routers}", file=sys.stderr)
        return 2

    all_hits: list[tuple[str, int, str]] = []
    for py in sorted(routers.rglob("*.py")):
        all_hits.extend(_scan_file(py, backend_root))

    if not all_hits:
        print("[OK] all router endpoints declare an auth dependency")
        return 0

    print("[FAIL] router endpoints missing auth dependency:")
    for key, lineno, name in all_hits:
        print(f"  {key}:{lineno}: {name}()")
    print(
        "\nIf an endpoint is intentionally public, add it to ALLOW_LIST "
        "in this script with a comment explaining why."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
