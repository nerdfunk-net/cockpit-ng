# Refactoring Plan — FABLE MEDIUM Issues (Batch 1)

**Source analysis:** `doc/FABLE_ANALYSIS.md` §1.4, §1.5, §1.6, §2.1, §3.1, §3.4
**Date:** 2026-06-09
**Status:** Implemented (2026-06-10) — all six issues; see notes below
> Implementation deviations: §2 data migration runs as an idempotent startup step
> (`ProfileRepository.hash_plaintext_api_keys()` in `main.py`) because the versioned
> migration runner described in `migrations/README.md` is not implemented; §5.C
> VM-create orchestration went into `services/nautobot/virtualization/vm_create_service.py`
> (mirroring `VirtualMachineUpdateService`) rather than into `VirtualMachineManager`.

This plan covers the six **MEDIUM** issues from the backend analysis. Each section is self-contained with exact file locations, before/after code, rationale, and a verification checklist.

> **Important corrections discovered during planning** (the original analysis was slightly off on two items — read these before estimating):
> - **§1.6 (blocking I/O in async):** An AST scan found **zero** `requests.*` calls directly inside an `async def`. The codebase already handles this correctly — CheckMK clients use `asyncio.to_thread`, the device-onboard route is a **sync** `def` (FastAPI threadpool), and `onboarding_service.py` is a **worker-only** Celery module. This item is therefore a **regression-guard** task, not a refactor.
> - **§3.4 (coverage gate):** A gate **already exists** — `fail_under = 60` in `[tool.coverage.report]` (pyproject.toml:108). The task is to **raise** it toward the 80% standard, not add it from scratch.

| # | Issue | Type | Files |
|---|-------|------|-------|
| 1 | Path-containment prefix check | Security fix | `services/git/file_service.py` |
| 2 | API keys stored/looked up in plaintext | Security fix | `core/models/users.py`, `core/auth.py`, `repositories/auth/profile_repository.py`, `services/auth/profile_service.py`, `routers/auth/profile.py` |
| 3 | Blocking HTTP in async (verify + guard) | Hardening | new `scripts/check_blocking_http_in_async.py` |
| 4 | `datetime.utcnow()` deprecation | Correctness | 9 files (25 call sites) + new `utils/time.py` |
| 5 | Large-file refactors | Maintainability | `services/network/tools/baseline.py`, `services/git/file_service.py`, `routers/nautobot/clusters.py`, `routers/settings/rbac.py` |
| 6 | Coverage gate raise | Process | `pyproject.toml` |

The six are independent; ship as separate PRs (suggested order: 4 → 1 → 3 → 6 → 2 → 5).

---

## Issue 1 — Harden path containment to a path-boundary check

### Problem

`services/git/file_service.py` validates that a requested file stays inside the repo with `realpath` + **string `startswith`**. A bare prefix match allows a sibling-directory bypass: `/repos/myrepo-secret` starts with `/repos/myrepo`. There are **five** guarded sites (lines 391, 461, 537, 644, 1238) plus one **unguarded** join at line 942 that feeds user-influenced `path_filter` into `_list_candidate_paths`.

### 1.A — Add a shared containment helper

Add a module-level helper near the top of `services/git/file_service.py` (after the constants at line 31).

**BEFORE (lines 28–34):**
```python
MAX_CONTENT_SEARCH_FILE_SIZE = 1024 * 1024
MAX_CONTENT_SEARCH_FILES = 5000
DEFAULT_HISTORY_MAX_COMMITS = 500


class GitFileService:
    """Read-only operations on files within a managed Git repository."""
```

**AFTER:**
```python
MAX_CONTENT_SEARCH_FILE_SIZE = 1024 * 1024
MAX_CONTENT_SEARCH_FILES = 5000
DEFAULT_HISTORY_MAX_COMMITS = 500


def _resolve_within_repo(repo_path: str, rel_path: str) -> str:
    """Resolve ``rel_path`` against ``repo_path`` and enforce containment.

    Uses a path-boundary check (not a bare string prefix) so that sibling
    directories such as ``/repos/myrepo-secret`` cannot pass a ``/repos/myrepo``
    containment test.

    Returns the resolved absolute path. Raises HTTP 403 if the resolved path
    escapes the repository root.
    """
    repo_root = os.path.realpath(repo_path)
    candidate = os.path.realpath(os.path.join(repo_path, rel_path))

    # Equal to root, or strictly under root (commonpath guards the boundary).
    if candidate != repo_root and os.path.commonpath([repo_root, candidate]) != repo_root:
        raise HTTPException(
            status_code=403,
            detail="Access denied: file path is outside repository",
        )
    return candidate


class GitFileService:
    """Read-only operations on files within a managed Git repository."""
```

> `os.path.commonpath` normalizes separators and compares whole path components, so `myrepo-secret` vs `myrepo` no longer collides. `realpath` still resolves symlinks first, so symlink escapes are also covered.

### 1.B — Replace the five guarded sites

Each guarded site currently looks like this (line numbers: 387–395, 457–465, 533–537+, 640–644+, 1234–1238):

**BEFORE (representative — `get_file_content`, lines 387–395):**
```python
            file_path = os.path.join(repo_path, path)
            file_path_resolved = os.path.realpath(file_path)
            repo_path_resolved = os.path.realpath(repo_path)

            if not file_path_resolved.startswith(repo_path_resolved):
                raise HTTPException(
                    status_code=403,
                    detail="Access denied: file path is outside repository",
                )
```

**AFTER:**
```python
            file_path_resolved = _resolve_within_repo(repo_path, path)
```

Apply the equivalent replacement at all five sites. For the two **directory** sites (lines 533 and 640), the variable is `target_path_resolved` and the join is conditional (`os.path.join(repo_path, path) if path else repo_path`):

**BEFORE (directory site — lines 533–537):**
```python
            target_path = os.path.join(repo_path, path) if path else repo_path
            target_path_resolved = os.path.realpath(target_path)
            repo_path_resolved = os.path.realpath(repo_path)

            if not target_path_resolved.startswith(repo_path_resolved):
                raise HTTPException(
                    status_code=403,
                    detail="Access denied: directory path is outside repository",
                )
```

**AFTER:**
```python
            target_path_resolved = _resolve_within_repo(repo_path, path or "")
```

(`path or ""` makes the helper resolve to the repo root when `path` is empty, preserving the original behavior.)

For the `_read_file_content_at_path`-style site at **line 1234**, the repo var is `repo_path_str`:

**BEFORE:**
```python
            file_path = os.path.join(repo_path_str, path)
            file_path_resolved = os.path.realpath(file_path)
            repo_path_resolved = os.path.realpath(repo_path_str)

            if not file_path_resolved.startswith(repo_path_resolved):
                ...
```

**AFTER:**
```python
            file_path_resolved = _resolve_within_repo(repo_path_str, path)
```

### 1.C — Guard the unprotected search join (line 942)

**BEFORE:**
```python
        for rel_path in candidate_paths:
            abs_path = os.path.join(repo_path, rel_path)
            content = self._read_text_file(abs_path)
```

**AFTER:**
```python
        for rel_path in candidate_paths:
            try:
                abs_path = _resolve_within_repo(repo_path, rel_path)
            except HTTPException:
                logger.warning(
                    "Skipping candidate outside repo during search: %s", rel_path
                )
                continue
            content = self._read_text_file(abs_path)
```

> Candidate paths here come from directory listing inside the repo, so escape is unlikely — but `path_filter` is user input, so the defense-in-depth guard is cheap and correct. We `continue` rather than 403 because search should silently skip anomalies, not fail the whole request.

### Verification — Issue 1

1. **Unit test (add):** create `tests/unit/services/test_git_file_path_containment.py` covering:
   - `_resolve_within_repo(repo, "a/b.txt")` returns the joined path,
   - `_resolve_within_repo(repo, "../../etc/passwd")` raises 403,
   - sibling bypass: with `repo=/tmp/x/myrepo`, a `path` resolving to `/tmp/x/myrepo-secret/f` raises 403,
   - `_resolve_within_repo(repo, "")` returns the repo root (no raise).
2. **Regression:** existing git file read/list/search tests still pass:
   ```bash
   cd backend && python -m pytest tests -k "git and (file or content or search)" -q
   ```
3. `ruff format . && ruff check .`

---

## Issue 2 — Hash API keys at rest

### Problem

`user_profiles.api_key` (`core/models/users.py:47`) stores the API key **verbatim** (`String(255)`), and `ProfileRepository.get_by_api_key` matches by direct equality. A DB leak exposes all keys for immediate reuse, and equality lookup on a plaintext column is theoretically timing-observable. Keys are exactly 42 chars (validated in `routers/auth/profile.py:110`), i.e. high-entropy random tokens — so a fast hash (SHA-256) is appropriate; we do **not** need a slow password hash.

### Strategy

Store **`sha256(api_key)`** (hex, 64 chars) instead of the raw key. Look up by hash. The raw key is shown to the user only at set time (it already comes from the client in this design). This is backward-compatible via a one-time migration that hashes existing values.

### 2.A — Add a hashing helper

Create `backend/core/api_keys.py`:
```python
"""API key hashing utilities.

API keys are high-entropy random tokens (42 chars), so a fast cryptographic
hash (SHA-256) is sufficient — a slow password hash is unnecessary here.
Only the hash is persisted; the raw key is shown to the user once at creation.
"""

from __future__ import annotations

import hashlib


def hash_api_key(api_key: str) -> str:
    """Return the hex SHA-256 digest of an API key."""
    return hashlib.sha256(api_key.encode("utf-8")).hexdigest()
```

### 2.B — Widen the column and lookup by hash

**`core/models/users.py:47` — BEFORE:**
```python
    api_key = Column(String(255))
```

**AFTER:**
```python
    # Stores sha256(api_key) hex digest (64 chars), never the raw key.
    api_key = Column(String(255), index=True)
```

> Keep `String(255)` (already wide enough for 64 hex chars) but add an index since every API-key auth does an equality lookup on this column. The column name stays `api_key` to avoid a rename migration; its **contents** change to the digest.

**`repositories/auth/profile_repository.py` — BEFORE (lines 51–71):**
```python
    def get_by_api_key(self, api_key: str) -> Optional[UserProfile]:
        """Get profile by API key.

        Args:
            api_key: API key to search for

        Returns:
            UserProfile if found, None otherwise
        """
        db = get_db_session()
        try:
            return (
                db.query(UserProfile)
                .filter(
                    UserProfile.api_key == api_key,
                    UserProfile.api_key.isnot(None),
                )
                .first()
            )
        finally:
            db.close()
```

**AFTER:**
```python
    def get_by_api_key_hash(self, api_key_hash: str) -> Optional[UserProfile]:
        """Get profile by API key hash.

        Args:
            api_key_hash: sha256 hex digest of the presented API key

        Returns:
            UserProfile if found, None otherwise
        """
        db = get_db_session()
        try:
            return (
                db.query(UserProfile)
                .filter(
                    UserProfile.api_key == api_key_hash,
                    UserProfile.api_key.isnot(None),
                )
                .first()
            )
        finally:
            db.close()
```

### 2.C — Hash on verify

**`core/auth.py` — BEFORE (lines 103–115):**
```python
    try:
        from repositories.auth.profile_repository import ProfileRepository
        from services.auth.user_management import get_user_by_username

        profile_repo = ProfileRepository()
        profile = profile_repo.get_by_api_key(x_api_key)

        if not profile:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key",
                headers={"WWW-Authenticate": "ApiKey"},
            )
```

**AFTER:**
```python
    try:
        from core.api_keys import hash_api_key
        from repositories.auth.profile_repository import ProfileRepository
        from services.auth.user_management import get_user_by_username

        profile_repo = ProfileRepository()
        profile = profile_repo.get_by_api_key_hash(hash_api_key(x_api_key))

        if not profile:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid API key",
                headers={"WWW-Authenticate": "ApiKey"},
            )
```

### 2.D — Hash on write

Find where the profile is persisted with the raw key. `services/auth/profile_service.py:61-62` sets `update_kwargs["api_key"] = api_key`.

**BEFORE (`services/auth/profile_service.py`, around lines 48–62):**
```python
    api_key: Optional[str] = None,
    ...
        if api_key is not None:
            update_kwargs["api_key"] = api_key
```

**AFTER:**
```python
    api_key: Optional[str] = None,
    ...
        if api_key is not None:
            from core.api_keys import hash_api_key

            # Empty string clears the key; otherwise store only the hash.
            update_kwargs["api_key"] = hash_api_key(api_key) if api_key else ""
```

> **Read-back concern:** `services/auth/profile_service.py:24` (`"api_key": profile.api_key`) and `routers/auth/profile.py:78,302` return `profile.get("api_key")` to the client. After this change that value is a **hash**, which must **not** be displayed as if it were the usable key. Update the response mapping to return a boolean presence flag instead of the stored value:
>
> **BEFORE:** `"api_key": profile.api_key,`
> **AFTER:** `"api_key_set": bool(profile.api_key),` (and update the Pydantic response model + frontend to show "key configured" rather than the value). If the UI currently renders the stored key, this is a required coordinated frontend change — flag it in the PR.

### 2.E — Data migration

Add a migration under the project migration framework (`doc/MIGRATION_SYSTEM.md`) that hashes existing plaintext keys. Pseudocode for the migration step:

```python
# migrations/<timestamp>_hash_api_keys.py
import hashlib

def upgrade(session):
    rows = session.execute(
        "SELECT id, api_key FROM user_profiles WHERE api_key IS NOT NULL AND api_key != ''"
    ).fetchall()
    for row in rows:
        key = row.api_key
        # Skip values already 64-char hex (idempotent re-runs).
        if len(key) == 64 and all(c in "0123456789abcdef" for c in key.lower()):
            continue
        digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
        session.execute(
            "UPDATE user_profiles SET api_key = :h WHERE id = :id",
            {"h": digest, "id": row.id},
        )
    # add index on api_key if not present
```

> Use the project's actual migration API (not raw SQL in app code — this is migration tooling, which is exempt per CLAUDE.md). The idempotency check lets the migration re-run safely.

### Verification — Issue 2

1. **Migration:** run on a copy of prod data; confirm every `api_key` becomes 64-char hex and existing API-key logins still work afterward.
2. **Round-trip test (add):** set an API key via the profile endpoint, confirm the DB stores the **hash** (not the raw value), then authenticate with the raw key via `X-Api-Key` and get a 200.
3. **No raw-key leakage:** `GET /profile` no longer returns a usable key (returns `api_key_set` / boolean).
4. ```bash
   cd backend && python -m pytest tests -k "api_key or profile or auth" -q
   grep -rn "get_by_api_key\b" backend  # ensure no stale callers of the old method name
   ```
5. `ruff format . && ruff check .`

---

## Issue 3 — Verify "no blocking HTTP in async" and add a regression guard

### Problem (reframed)

The original concern was blocking `requests.*` calls on the event loop. **Current state is clean** (AST scan: 0 direct calls in `async def`). The real risk is **regression** — a future edit dropping a `requests.get(...)` straight into an `async def`. The team already ships guard scripts (`scripts/check_*.py`); add one for this pattern.

### 3.A — New guard script

Create `backend/scripts/check_blocking_http_in_async.py` (mirrors the style of `scripts/check_text_sql.py`):

```python
#!/usr/bin/env python3
"""Regression guard: no blocking HTTP client calls inside ``async def`` bodies.

Synchronous ``requests``/``urllib`` calls executed directly on the event loop
block the entire FastAPI worker. Wrap them in ``asyncio.to_thread`` or use an
async client (``httpx.AsyncClient``) instead.

Run alongside the other guards::

    cd backend && python scripts/check_blocking_http_in_async.py

Exit code ``1`` if a blocking call is found directly inside an ``async def``.
"""

from __future__ import annotations

import ast
import sys
from pathlib import Path

_BLOCKING = {
    ("requests", "get"), ("requests", "post"), ("requests", "put"),
    ("requests", "patch"), ("requests", "delete"), ("requests", "head"),
    ("requests", "request"),
}

ALLOWED_PREFIXES = ("tests/", "tools/", "scripts/", "migrations/")


def _backend_root() -> Path:
    return Path(__file__).resolve().parent.parent


class _Visitor(ast.NodeVisitor):
    def __init__(self) -> None:
        self.kind_stack: list[str] = []
        self.hits: list[tuple[int, str]] = []

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
    failures: list[tuple[Path, int, str]] = []
    for py in root.rglob("*.py"):
        rel = py.relative_to(root).as_posix()
        if rel.startswith(ALLOWED_PREFIXES):
            continue
        try:
            tree = ast.parse(py.read_text(encoding="utf-8"))
        except (SyntaxError, UnicodeDecodeError, OSError):
            continue
        v = _Visitor()
        v.visit(tree)
        for lineno, call in v.hits:
            failures.append((py, lineno, call))

    if not failures:
        print("[OK] no blocking HTTP calls directly inside async def")
        return 0

    print("[FAIL] blocking HTTP call inside async def (wrap in asyncio.to_thread "
          "or use httpx.AsyncClient):", file=sys.stderr)
    for path, lineno, call in failures:
        print(f"  {path.relative_to(root)}:{lineno}: {call}(...)", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
```

### 3.B — Register the guard

Add to the "Router regression guards" block in `CLAUDE.md` (Development Workflow section) and to whatever CI / pre-commit runs the other `check_*.py` scripts:

```bash
python scripts/check_blocking_http_in_async.py
```

### Verification — Issue 3

1. Run it now — must print `[OK]` (baseline is clean):
   ```bash
   cd backend && python scripts/check_blocking_http_in_async.py
   ```
2. Temporarily add `requests.get("http://x")` to any `async def`, re-run, confirm it exits `1` and points at the line; then revert.
3. Confirm it does **not** flag the existing `_fetch` pattern in `services/checkmk/client.py:170` (nested sync def → correctly ignored).

---

## Issue 4 — Replace `datetime.utcnow()` with timezone-aware equivalents

### Problem

`datetime.utcnow()` is deprecated as of Python 3.12 and returns **naive** datetimes, which can raise `TypeError` when compared against aware datetimes and sort incorrectly. There are **25 call sites across 9 files**. `core/auth.py` already does it right (`datetime.now(timezone.utc)`), and `services/settings/credentials_service.py` already has a local `_utc_now()` helper.

### 4.A — Add a shared helper

Create `backend/utils/time.py`:
```python
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
```

### 4.B — Per-file replacements

For each file, add `from utils.time import utc_now` (or `utc_now_naive`) and replace the calls. **Choosing which variant:** columns that are `DateTime(timezone=True)` or ISO-string outputs → `utc_now()`; columns previously written as naive (`DateTime` without tz) → `utc_now_naive()` to avoid changing stored representation. Below, string/ISO outputs use `utc_now()`; DB model fields use `utc_now_naive()` to stay byte-compatible with existing rows.

| File | Lines | Replace with |
|------|-------|--------------|
| `health.py` | 18 | `utc_now()` (ISO string output) |
| `set_admin_password.py` | 98 | `utc_now()` (ISO string) |
| `routers/auth/oidc.py` | 527 | `utc_now()` (ISO string) |
| `routers/inventory/crud.py` | 388 | `utc_now()` (ISO string) |
| `repositories/cockpit_agent/cockpit_agent_repository.py` | 37, 71 | `utc_now_naive()` (DB column) |
| `repositories/jobs/job_run_repository.py` | 317, 342, 368, 391, 410, 430 | `utc_now_naive()` (DB columns / cutoffs) |
| `services/network/snapshots/execution_service.py` | 270, 274, 366, 376, 388, 396, 404 | `utc_now_naive()` (DB) / `utc_now()` (274 is a filename timestamp string) |
| `services/network/scanning/network_scan.py` | 38, 83, 96, 132, 163 | `utc_now_naive()` (dataclass/DB) |
| `services/settings/credentials_service.py` | 23–24 | already has `_utc_now()` — replace its body to delegate to `utc_now_naive()` |

**Representative — `health.py:18` BEFORE:**
```python
        "timestamp": datetime.utcnow().isoformat() + "Z",
```
**AFTER:**
```python
        "timestamp": utc_now().isoformat(),
```
> Note: `utc_now()` is aware, so `.isoformat()` already yields `+00:00`. Dropping the manual `+ "Z"` avoids a double-suffix. If downstream consumers require the literal `Z`, use `.isoformat().replace("+00:00", "Z")` instead — check the frontend's parser before deciding.

**Representative — DB column, `repositories/jobs/job_run_repository.py:317` BEFORE:**
```python
                job_run.started_at = datetime.utcnow()
```
**AFTER:**
```python
                job_run.started_at = utc_now_naive()
```

**Representative — filename timestamp, `execution_service.py:274` BEFORE:**
```python
        timestamp = datetime.utcnow().isoformat().replace(":", "-").split(".")[0]
```
**AFTER:**
```python
        timestamp = utc_now().isoformat().replace(":", "-").split(".")[0]
```

**`services/network/scanning/network_scan.py:38` (dataclass default) BEFORE:**
```python
    started_at: datetime = field(default_factory=datetime.utcnow)
```
**AFTER:**
```python
    started_at: datetime = field(default_factory=utc_now_naive)
```

**`services/settings/credentials_service.py:23-26` BEFORE:**
```python
def _utc_now() -> datetime:
    """Naive UTC timestamp for DB columns (replaces deprecated datetime.utcnow())."""
    return datetime.now(timezone.utc).replace(tzinfo=None)
```
**AFTER:**
```python
def _utc_now() -> datetime:
    """Naive UTC timestamp for DB columns. Delegates to the shared helper."""
    from utils.time import utc_now_naive

    return utc_now_naive()
```

### 4.C — Add a lint rule to prevent regressions

ruff has the `DTZ` (flake8-datetimez) ruleset, which flags `datetime.utcnow()`. Enable it in `pyproject.toml` `[tool.ruff.lint]`:

**BEFORE (representative `select` in `[tool.ruff.lint]`):**
```toml
[tool.ruff.lint]
select = ["E", "F", "I", ...]
```
**AFTER:**
```toml
[tool.ruff.lint]
select = ["E", "F", "I", "DTZ", ...]
```
> `DTZ` will also flag bare `datetime.now()` without tz; if that produces noise in non-critical scripts, scope it via `[tool.ruff.lint.per-file-ignores]` rather than dropping the rule.

### Verification — Issue 4

1. ```bash
   cd backend
   grep -rn "datetime.utcnow\|\.utcnow()" --include="*.py" --exclude-dir=tests --exclude-dir=__pycache__ .  # expect 0
   ruff check .  # DTZ clean
   python -m pytest tests -k "job_run or snapshot or scan or credential or health" -q
   ```
2. Spot-check one job-run row and one snapshot row in the DB to confirm timestamps still store in the same format (naive) as before.

---

## Issue 5 — Split oversized files

### Problem

Files over the 800-line guideline. These are *fat-but-cohesive* (no God Object); the fix is **mechanical extraction**, not redesign. Do these as isolated, behavior-preserving refactors with no logic changes.

### 5.A — `services/network/tools/baseline.py` (1510 lines)

The file already separates module-level pure functions (lines 34–112: `normalize_content_types`, `content_types_from_api_record`, `sort_location_types_by_parent`, etc.) from `class BaselineImportService` (line 114, ~22 methods).

**Plan:**
1. Move the pure functions (lines 34–112) into a new `services/network/tools/baseline_normalizers.py`.
2. In `baseline.py`, add `from services.network.tools.baseline_normalizers import (...)`.
3. If `BaselineImportService` still exceeds ~800 lines, split its methods by phase into a mixin or helper module (e.g. `baseline_location_types.py`, `baseline_tags.py`) — keep the public class as the entry point so callers are unaffected.

**Before/after (import wiring):**
```python
# baseline.py — AFTER (top of file)
from services.network.tools.baseline_normalizers import (
    content_types_from_api_record,
    desired_tag_content_types,
    normalize_content_types,
    normalize_location_type_content_types,
    sort_location_types_by_parent,
    tag_content_types_from_api_record,
)
```
Keep names identical so no call site changes. Confirm no other module imports these directly from `baseline` (`grep -rn "from services.network.tools.baseline import" backend`); if they do, re-export them from `baseline.py` (the import above already brings them into its namespace).

### 5.B — `services/git/file_service.py` (1279 lines)

After Issue 1 centralizes the path guard, split by operation:
- `file_read_service.py` — content read/parse (`get_file_content`, `get_file_content_parsed`),
- `file_list_service.py` — tree/dir listing,
- `file_search_service.py` — content search + pagination,
- `file_history_service.py` — history/diff.

Keep `GitFileService` as a thin facade that composes these (mirrors the existing Nautobot facade pattern) so routers in `routers/git/files.py` keep calling the same object. **Do this after Issue 1 merges** to avoid conflicting edits on the same guard sites.

### 5.C — `routers/nautobot/clusters.py` (1000 lines, 18 endpoints)

Split one router into three by resource, then re-aggregate (matches the existing `routers/nautobot/main.py` `include_router` pattern):
- `routers/nautobot/clusters.py` — clusters, cluster-types, cluster-groups,
- `routers/nautobot/virtual_machines.py` — VM CRUD,
- `routers/nautobot/virtual_interfaces.py` — virtual interface ops.

**Wiring — `routers/nautobot/main.py` AFTER:**
```python
from routers.nautobot.virtual_machines import router as virtual_machines_router
from routers.nautobot.virtual_interfaces import router as virtual_interfaces_router
...
router.include_router(virtual_machines_router)
router.include_router(virtual_interfaces_router)
```
Also move per-endpoint orchestration (e.g. the request-field `logger.debug` block and software-image-file list coercion in `create_virtual_machine`, lines 339+) **into `VirtualMachineManager`** so the routers stay thin.

### 5.D — `routers/settings/rbac.py` (883 lines)

Audit for business logic in the handlers; push it into `services/.../rbac_service.py`. If still large after that, split endpoints by sub-resource (roles vs permissions vs user-role assignments) and aggregate.

### Verification — Issue 5

For each split (do one at a time, separate commits):
1. `grep -rn "import" ` for the moved symbols to update every caller.
2. App imports cleanly: `cd backend && python -c "import main"`.
3. Route inventory unchanged: compare `app.routes` paths before/after (no endpoint added/removed/renamed).
4. ```bash
   python -m pytest tests -q
   ruff format . && ruff check .
   ```
5. Confirm each resulting file is < 800 lines (`wc -l`).

> These are the **lowest-risk-to-defer** items. Prioritize 5.A and 5.C (clear seams); 5.B should follow Issue 1.

---

## Issue 6 — Raise the coverage gate toward 80%

### Problem

A gate exists (`fail_under = 60`, pyproject.toml:108) but is below the 80% project standard. The inline comment already signals a phased plan ("target 70").

### 6.A — Phased increase

**`pyproject.toml:107-108` BEFORE:**
```toml
# Phased gate: 60 after profile/priority/sync facade tests (2026-06); target 70
fail_under = 60
```
**AFTER (step 1 — bump to the already-stated next target):**
```toml
# Phased gate toward the 80% project standard.
# 2026-06: 60 → 70 after path-containment + api-key + time-helper tests land.
# Next: 70 → 80 once large-file splits (Issue 5) add focused unit tests.
fail_under = 70
```

> Do **not** jump straight to 80 — measure current coverage first and raise to the nearest achievable rung so CI doesn't redden on unrelated PRs. The new tests from Issues 1, 2, and 4 in this batch should lift coverage and make 70 comfortable; revisit 80 after Issue 5.

### 6.B — Measure before committing the bump

```bash
cd backend && python -m pytest tests -q
# read the "TOTAL ... %" line from --cov-report=term-missing
```
Set `fail_under` to a value at or just below the measured total (rounded down to a 5% rung). If measured ≥ 75%, set 75; if ≥ 80%, set 80 and update the comment.

### Verification — Issue 6

1. `python -m pytest tests -q` exits 0 with the new threshold.
2. Confirm CI runs the same pytest invocation (so the gate actually enforces in CI, not just locally).

---

## Cross-cutting checklist (whole batch)

```bash
cd backend

# Format + lint (DTZ now enforced after Issue 4)
ruff format .
ruff check --fix .

# Existing + new guards
python scripts/check_asyncio_run.py
python scripts/check_http_500_leaks.py
python scripts/check_router_repositories.py
python scripts/check_text_sql.py
python scripts/check_blocking_http_in_async.py   # new (Issue 3)

# No utcnow left (Issue 4)
! grep -rn "datetime.utcnow\|\.utcnow()" tasks services routers repositories core utils --include="*.py"

# No bare-prefix path check left (Issue 1)
! grep -rn "startswith(repo_path_resolved)" services/git --include="*.py"

# No stale plaintext api_key lookup (Issue 2)
! grep -rn "def get_by_api_key\b" repositories --include="*.py"

# Full suite + coverage gate (Issue 6)
python -m pytest tests -q
```

## Suggested PR breakdown & order

1. **`refactor: shared UTC time helper, drop datetime.utcnow()`** (Issue 4) — wide but mechanical, unblocks the DTZ lint rule. Merge first.
2. **`fix(git): path-boundary containment check in file_service`** (Issue 1) — small, security.
3. **`chore(ci): guard against blocking HTTP in async`** (Issue 3) — guard script only.
4. **`chore(test): raise coverage gate to 70`** (Issue 6) — after 1/2/4 add tests.
5. **`fix(auth): hash API keys at rest`** (Issue 2) — needs migration + frontend coordination; ship deliberately.
6. **`refactor: split oversized modules`** (Issue 5) — one file per commit; do last, after Issue 1 lands for 5.B.

## Rollback notes

- **Issues 1, 3, 4, 5, 6:** pure code/config — revert the commit.
- **Issue 2:** the data migration hashes keys in place. Rolling back the code without the data leaves the app comparing `sha256(presented)` logic removed but DB holding hashes → all API-key logins fail. To roll back, either keep the hashing code or restore the pre-migration DB snapshot. The migration is **one-way** (hashes are not reversible); document this and take a DB backup before running it.
