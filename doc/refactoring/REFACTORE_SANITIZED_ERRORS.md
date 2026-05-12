# Refactoring plan — Sanitized error responses (P1)

Companion implementation plan for **P1 — Safe errors** from
`doc/refactoring/CURSOR_REFACTOR_1.md`. The shared infrastructure
(`core/safe_http_errors.raise_internal_server_error`, sanitized
decorators in `core/error_handlers.py`, generic `main.py` GraphQL
handler) is **already in place**; this document covers the **remaining
sweep** of routers that still leak exception text in 5xx responses, the
formal policy spec, and tests that lock the behaviour in.

---

## 1. Goal & non-goals

### 1.1 Goal

For every HTTP path under `backend/routers/`:

1. **5xx responses** carry a generic message + opaque `error_id` only.
2. **Full exception detail** is logged server-side with `exc_info=True`
   and the same `error_id` (so support can correlate logs to a client
   complaint).
3. **4xx responses** keep specific, user-actionable detail strings
   (validation messages, "not found", etc.) — they must NOT include
   stack traces, file paths, or raw SQL fragments, but they may quote
   the offending field/value or a known exception message that the
   handler explicitly maps.
4. No new code path may regress these rules; CI fails when it does.

### 1.2 Non-goals

- Designing a global error-response schema for clients (current shape
  `{detail: {...}}` is kept).
- Re-translating error messages into i18n — handled separately.
- Refactoring frontend error UIs.
- Touching Celery task error reporting; this plan is HTTP-only.

---

## 2. Current state (verified)

### 2.1 Helper

```5:22:backend/core/safe_http_errors.py
"""
Sanitized HTTP error payloads for server failures (see doc/refactoring/CURSOR_REFACTOR_1.md P1).

5xx responses use a generic client message plus an opaque error_id; full details are logged only.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, NoReturn

from fastapi import HTTPException, status

INTERNAL_ERROR_MESSAGE = "An internal error occurred"


def internal_error_detail(*, error_id: str | None = None) -> dict[str, str]:
    """JSON-serializable body fragment for HTTPException ``detail`` (FastAPI wraps as ``detail``)."""
    eid = error_id or str(uuid.uuid4())
    return {"message": INTERNAL_ERROR_MESSAGE, "error_id": eid}
```

### 2.2 Already done

- `core/error_handlers.py` decorators (`handle_errors`,
  `handle_not_found`, `handle_validation_errors`) route 5xx through
  `raise_internal_server_error`.
- `main.py` GraphQL compatibility endpoint uses the helper.
- Most routers were partially swept and now invoke the helper on the
  generic `except Exception` branch.

### 2.3 What still leaks (`rg "HTTP_500" -A 2 backend/routers/`)

The following files still construct `HTTPException(500, detail=f"...{e}…")`
or `detail=str(e)`/`{exc}`/`{error_msg}` where `error_msg = str(exc)`.
Each row is one PR-sized unit of work.

| # | File | Sites | Pattern | Notes |
|---|------|-------|---------|-------|
| 1 | `backend/routers/nautobot/virtual_chassis.py` | ~10 | `{exc}` + `{error_msg}` | Five endpoints (list/get/create/update/delete) each have two `HTTPException(500, …)` branches. |
| 2 | `backend/routers/nautobot/stacks.py` | 1 | `{str(exc)}` | Line ~215. |
| 3 | `backend/routers/nautobot/utils.py` | 1 | `{error_msg}` | Job-result fetch. |
| 4 | `backend/routers/nautobot/device_ops.py` | 2 | `str(e)` / `{str(e)}` | Lines ~82, ~171. |
| 5 | `backend/routers/nautobot/clusters.py` | 1 | `{str(e)}` | VM create at line ~616. |
| 6 | `backend/routers/settings/templates/content.py` | 2 | `{exc}` | Lines ~43, ~64 (line ~124 also leaks). |
| 7 | `backend/routers/settings/templates/crud.py` | 6 | `{exc}` | Lines ~59, ~95, ~115, ~144, ~173, ~221, ~252. |
| 8 | `backend/routers/settings/templates/git.py` | 1 | `{exc}` | Line ~75 (also see P4.2 — fake-success payload). |
| 9 | `backend/routers/settings/templates/render.py` | 2 | `{exc}` | Lines ~39, ~61. |
| 10 | `backend/routers/settings/templates/import_.py` | 2 | `{exc}` | Lines ~33, ~53. |
| 11 | `backend/routers/checkmk/discovery.py` | 3 | `{str(e)}` | Lines ~53, ~84, ~114 — hostname interpolation is safe; only the exception suffix must be dropped. |
| 12 | `backend/routers/checkmk/monitoring.py` | 1 | `{str(e)}` | Line ~129. |
| 13 | `backend/routers/checkmk/problems.py` | 2 | `{str(e)}` | Lines ~52, ~126. |
| 14 | `backend/routers/checkmk/activation.py` | 1 | `{str(e)}` | Line ~140. |
| 15 | `backend/routers/checkmk/sync.py` | 3 | `error_msg` derived from `str(exc)` | Lines ~74, ~148, ~222 (line ~384 already generic). |
| 16 | `backend/routers/tools/certificates.py` | 3 | `{e}` | Lines ~86, ~156, ~318. |
| 17 | `backend/routers/inventory/ops.py` | 2 | `{str(e)}` | Lines ~288, ~397. |
| 18 | `backend/routers/jobs/check_ip.py` | 1 | `{str(exc)}` | Line ~82. |
| 19 | `backend/routers/jobs/export.py` | 1 | `{str(exc)}` | Line ~121 (line ~67 generic). |

Total: **~45 leaky 5xx sites across 19 files**.

### 2.4 What already passes (do not touch)

- `routers/settings/git_settings.py`, `settings/nautobot.py`,
  `settings/common.py`, `settings/cache_settings.py`,
  `settings/rbac.py`, `auth/auth.py`, `auth/oidc.py` (interpolates
  `provider_id` only, no exception text), `auth/profile.py`,
  `inventory/crud.py`, `jobs/celery_admin.py`, `jobs/schedules.py`,
  `jobs/export.py` (the 500 path at line ~67),
  `routers/settings/templates/crud.py` (the three already-generic
  branches), `routers/cockpit_agent.py` (uses helper everywhere).

---

## 3. Policy specification (lock this in before coding)

Adopt these as the agreed rules and reference them in PR reviews.

### 3.1 Rule R1 — 5xx never echoes exception detail

```python
# ❌ Forbidden in any 5xx path
raise HTTPException(
    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    detail=f"Failed to do X: {exc}",
)

# ✅ Required form
from core.safe_http_errors import raise_internal_server_error

except Exception as exc:
    raise_internal_server_error(logger, "Failed to do X", exc)
```

The helper handles message + `error_id` + `exc_info` logging.

### 3.2 Rule R2 — Use the helper from every `except Exception`

The catch-all branch in any router handler MUST route through the
helper. Specific upstream exceptions (`ValueError`, `KeyError`,
`CheckMKClientError`, `HostNotFoundError`, …) can map to 4xx with a
contextual message before the catch-all runs.

### 3.3 Rule R3 — 4xx messages must be deterministic strings

4xx detail strings may interpolate **request inputs** (hostnames,
ids), **enum-like fields** ("must be one of: a, b, c"), or a
**mapped exception message that the handler controls**. They MUST
NOT pass raw `str(e)` for an exception originating from an internal
component (DB driver error, attribute error, etc.).

When in doubt, treat unknown exceptions as 5xx via R1 — do not
downgrade them to 4xx just to surface the text.

### 3.4 Rule R4 — Log full context server-side

`raise_internal_server_error(logger, msg, exc, extra={...})`
already attaches `error_id` and traceback. Add `extra={...}` with
useful structured fields (e.g. `device_id`, `inventory_id`,
`provider_id`) so support can find the row in logs by request
correlation, not by reading client output.

### 3.5 Update `CLAUDE.md`

Under the existing "Security Checklist" or "INCORRECT Practices"
section, add:

> ❌ Embedding raw exception text (`str(e)`, `{exc}`, etc.) in
> `HTTPException(detail=…)` for any 5xx response. Use
> `core.safe_http_errors.raise_internal_server_error` and let the
> client see only `{message, error_id}`.

Documentation-only change; ship it in the first PR of phase 1.

---

## 4. Execution phases

Designed as **small, isolated PRs** (1 router or 1 router-folder per PR)
so review effort stays small and rollbacks are cheap.

### Phase 0 — Documentation & guard (½ day)

1. Add the four rules to `CLAUDE.md`.
2. Add `backend/scripts/check_http_500_leaks.py` (template in §6) and
   wire it into the same lint step that already runs
   `check_asyncio_run.py`.
3. Run the script once; commit its **allow-list** with the 19 known
   files. The list shrinks as each PR lands.

**Exit criteria:** Script returns the expected non-zero exit on
unsanitized 5xx sites and zero exit when run on `routers/clients.py`,
`routers/cockpit_agent.py`, etc.

### Phase 1 — Templates routers (1 PR per file or one PR for the folder)

Files: `settings/templates/{content,crud,render,import_,git}.py`.
Reason to start here: highest concentration of `{exc}` interpolation,
single import of `service_factory`, no domain-specific exception
hierarchies — straightforward 1-for-1 conversions.

**Per file:**

1. Add `from core.safe_http_errors import raise_internal_server_error`.
2. Replace each `raise HTTPException(500, detail=f"…{exc}")` with:

   ```python
   except Exception as exc:
       raise_internal_server_error(logger, "Failed to <op>", exc)
   ```

3. Keep 4xx branches as-is when they wrap `ValueError` / domain
   exceptions; double-check that no 4xx branch passes a raw
   driver/internal exception (move it to 5xx if so — see R3).
4. Remove the entry from `check_http_500_leaks.py` allow-list.

**Exit criteria:** Allow-list shorter by 5 files; lint passes; manual
test against one template endpoint returns
`{"detail": {"message": "An internal error occurred", "error_id": "…"}}`
when a deliberate exception is raised.

### Phase 2 — Nautobot routers (1 PR per file)

Files: `nautobot/{virtual_chassis,stacks,utils,device_ops,clusters}.py`.

`virtual_chassis.py` is the largest (10 sites) — split it if review
load demands it: one PR for list/get reads, a second for
create/update/delete.

Special care:

- **`device_ops.py`** has a `str(e)` returned as **404** (line ~78).
  That's R3 territory — confirm the exception type is a real
  "not found" raised by the service and map explicitly:

  ```python
  except DeviceNotFoundError as exc:
      raise HTTPException(status_code=404, detail=str(exc))
  except Exception as exc:
      raise_internal_server_error(logger, "Failed to offboard device", exc)
  ```

  If the service raises a generic `Exception`, treat as 5xx.

**Exit criteria:** Allow-list shorter by 5 files; no `{exc}` /
`str(e)` remains in the touched files.

### Phase 3 — CheckMK routers (1 PR for the folder)

Files: `checkmk/{discovery,monitoring,problems,activation,sync}.py`.

Pattern is uniform: each handler already maps `CheckMKClientError →
400`, `HostNotFoundError → 404`, `CheckMKAPIError → 502`. The fallback
500 still leaks. Replace **only** that final `except Exception` /
`raise HTTPException(500, …)` with the helper.

**Special case — `checkmk/sync.py`**: lines ~74/148/222 use
`error_msg = f"…: {exc}"` then re-raise. Drop the f-string entirely:

```python
except Exception as exc:
    raise_internal_server_error(logger, "CheckMK sync failed", exc)
```

If callers depend on the exact string, audit and refactor them; this
sweep is the right place to break that coupling.

**Exit criteria:** Allow-list shorter by 5 files; CheckMK
client-error 4xx behaviour unchanged.

### Phase 4 — Misc (1 PR)

Files: `tools/certificates.py`, `inventory/ops.py`,
`jobs/check_ip.py`, `jobs/export.py`.

`inventory/ops.py` also has 403s with `detail=str(e)` (lines ~278,
~387). If those `Exception`s come from a permission check service,
map them explicitly (R3); otherwise treat as 5xx.

**Exit criteria:** Allow-list is **empty**; the script becomes a
guard against regressions instead of a TODO list.

### Phase 5 — Lock-in (½ day)

1. Flip `check_http_500_leaks.py` from allow-list mode to **strict
   mode** (no allow-list permitted).
2. Add a `pytest` smoke test (template in §7) that hits a known 5xx
   path via FastAPI's `TestClient`, forces an exception in a mock
   service, and asserts the response body matches
   `{"detail": {"message": "An internal error occurred", "error_id": "<uuid>"}}`.
3. Update `CURSOR_REFACTOR_1.md` section 0 table: row P1.B³ → ✅.

---

## 5. Per-site checklist (use during PR review)

Apply to every site you touch:

- [ ] `from core.safe_http_errors import raise_internal_server_error`
      added (once per file).
- [ ] No `detail=f"...{e}…"`, `detail=str(e)`, or `detail=f"…{exc}…"`
      remains for any **5xx** path in the file.
- [ ] Generic `except Exception` branches go through
      `raise_internal_server_error(logger, "Failed to <op>", exc)`.
- [ ] Domain-mapped 4xx exceptions (`ValueError`, `CheckMKClientError`,
      `HostNotFoundError`, …) still produce a contextual message
      (R3-compliant).
- [ ] Helpful structured context passed via `extra={…}` (only when
      easy — do not invent fields just to fill the slot).
- [ ] Allow-list entry in `check_http_500_leaks.py` removed.

---

## 6. Lint script template (`backend/scripts/check_http_500_leaks.py`)

Mirror `check_asyncio_run.py` so CI integration is trivial. Sketch:

```python
"""Regression guard: no leaky 5xx detail strings under backend/routers/.

Forbidden patterns within any `HTTPException` whose `status_code` is
HTTP_500_INTERNAL_SERVER_ERROR (or numeric 5xx):
  detail=str(e), detail=str(exc),
  detail=f"…{e}…", detail=f"…{exc}…", detail=f"…{str(e)}…", …

The script is intentionally regex-based (no AST) so it runs without
heavy deps; trade-off documented in the module docstring.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

# Tunable allow-list while the sweep is in flight; remove entries as
# you migrate each file. Final state should be `ALLOW_LIST = set()`.
ALLOW_LIST: set[str] = {
    # "routers/nautobot/virtual_chassis.py",  # remove after Phase 2
}

_HTTP_500_BLOCK = re.compile(
    r"HTTPException\([^)]*5\d\d[^)]*\)",
    re.DOTALL,
)
_LEAK_PATTERNS = (
    re.compile(r"detail\s*=\s*str\(\s*(?:e|exc|error)\s*\)"),
    re.compile(r"detail\s*=\s*f[\"'][^\"']*\{(?:e|exc|error)\}[^\"']*[\"']"),
    re.compile(r"detail\s*=\s*f[\"'][^\"']*\{str\(\s*(?:e|exc|error)\s*\)\}[^\"']*[\"']"),
)


def _routers_dir() -> Path:
    return Path(__file__).resolve().parent.parent / "routers"


def _scan(path: Path) -> list[tuple[int, str]]:
    text = path.read_text(encoding="utf-8")
    hits: list[tuple[int, str]] = []
    for block in _HTTP_500_BLOCK.finditer(text):
        if any(p.search(block.group(0)) for p in _LEAK_PATTERNS):
            line_no = text[: block.start()].count("\n") + 1
            hits.append((line_no, block.group(0).splitlines()[0]))
    return hits


def main() -> int:
    routers = _routers_dir()
    failures: list[tuple[Path, int, str]] = []
    for py in routers.rglob("*.py"):
        rel = py.relative_to(routers.parent).as_posix()
        if rel in ALLOW_LIST:
            continue
        for line_no, snippet in _scan(py):
            failures.append((py, line_no, snippet))

    if not failures:
        print("[OK] no leaky 5xx detail strings under backend/routers/")
        return 0

    print("[FAIL] leaky 5xx HTTPException detail in:")
    for path, line_no, snippet in failures:
        print(f"  {path}:{line_no}: {snippet}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
```

The regex approach is deliberately conservative: false negatives are
preferable to false positives during the sweep, and the per-file
allow-list lets you gate the script before the codebase is clean.

---

## 7. Test template

Two complementary tests; both live under `backend/tests/unit/core/`.

### 7.1 `test_safe_http_errors.py`

```python
"""Unit tests for the sanitized HTTP error helper."""

import logging
from unittest.mock import Mock

import pytest
from fastapi import HTTPException, status

from core.safe_http_errors import (
    INTERNAL_ERROR_MESSAGE,
    internal_error_detail,
    raise_internal_server_error,
)


def test_internal_error_detail_includes_uuid_error_id():
    body = internal_error_detail()
    assert body["message"] == INTERNAL_ERROR_MESSAGE
    assert "error_id" in body
    # Loose uuid shape check; helper uses uuid4().
    assert len(body["error_id"]) == 36


def test_raise_internal_server_error_returns_500_with_safe_body():
    logger = Mock(spec=logging.Logger)
    with pytest.raises(HTTPException) as excinfo:
        raise_internal_server_error(logger, "Failed to do X", ValueError("boom"))
    exc = excinfo.value
    assert exc.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    assert exc.detail["message"] == INTERNAL_ERROR_MESSAGE
    assert "error_id" in exc.detail
    logger.error.assert_called_once()
    args, kwargs = logger.error.call_args
    assert "Failed to do X" in args[0]
    assert kwargs["exc_info"] is True
    assert kwargs["extra"]["error_id"] == exc.detail["error_id"]
```

### 7.2 `test_router_5xx_sanitization.py` (one example router)

```python
"""End-to-end smoke test: a deliberately failing endpoint returns the safe shape."""

from unittest.mock import patch

from fastapi.testclient import TestClient

from main import app


def test_5xx_response_does_not_leak_exception_text():
    client = TestClient(app)
    with patch(
        "services.clients.client_data_service.ClientDataService.get_device_names",
        side_effect=RuntimeError("super-secret-detail"),
    ):
        # Authenticated request omitted for brevity — use an auth fixture.
        resp = client.get("/api/clients/devices", headers={"Authorization": "Bearer dev"})

    assert resp.status_code == 500
    body = resp.json()
    assert body["detail"]["message"] == "An internal error occurred"
    assert "error_id" in body["detail"]
    assert "super-secret-detail" not in resp.text
```

Both tests run under the existing in-memory SQLite fixture; no new
infrastructure is required.

---

## 8. Acceptance criteria for the whole P1 phase

- [ ] `CLAUDE.md` updated with the four rules from §3.
- [ ] `backend/scripts/check_http_500_leaks.py` exists, runs in CI,
      and has an empty allow-list.
- [ ] `rg "HTTP_500_INTERNAL_SERVER_ERROR" backend/routers/ -A 2 |
      rg "(str\(e?xc?\)|\{e\}|\{exc\}|\{error_msg\})"` returns no
      matches.
- [ ] `pytest backend/tests/unit/core/test_safe_http_errors.py` passes.
- [ ] At least one router-level smoke test verifies a forced 500
      returns `{message, error_id}` and no exception text in the body.
- [ ] Section 0 status row P1.B³ in `CURSOR_REFACTOR_1.md` flipped to
      ✅; section-4 checklist box `[~] P1 batch fix` → `[x]`.

---

## 9. Risks & mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| Frontend depends on the old leaky string (`detail` as a flat string) | Medium | The helper returns `detail` as an **object** `{message, error_id}`; frontend already needs to handle both shapes (4xx still returns strings). Add a follow-up frontend issue if any UI parses 5xx detail as a string. |
| A 4xx branch silently masked a real bug because the message leaked | Low | The PR review checklist (§5) explicitly asks whether a 4xx is justified; default to 5xx for unknown exceptions (R3). |
| Lint script has false positives (e.g. comments) | Low | Regex matches only inside the `HTTPException(…)` call body; comments and strings outside that call are not scanned. Allow-list provides an escape hatch during rollout. |
| Logging volume increases (one `logger.error` per 5xx) | Low | This is intentional; ops gets one log line per failure with `error_id` to grep on. No PII change. |

---

## 10. References

- `doc/refactoring/CURSOR_REFACTOR_1.md` §3 P1 — origin of this work.
- `backend/core/safe_http_errors.py` — the helper.
- `backend/core/error_handlers.py` — decorator versions that already
  honour the policy.
- `backend/scripts/check_asyncio_run.py` — template for the lint script
  shape and CI wiring.
- `backend/routers/cockpit_agent.py` — reference for an
  end-to-end-compliant router.
