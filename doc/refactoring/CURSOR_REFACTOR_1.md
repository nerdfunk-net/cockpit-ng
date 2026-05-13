# Backend refactoring plan — CURSOR_REFACTOR_1

This document records findings from a backend architecture and Python best-practices review (relative to `CLAUDE.md` standards: Model → Repository → Service → Router, no raw SQL in application code, JWT/RBAC, logging style, etc.). It is written so a future implementation pass can execute the work without re-discovering context.

---

## 0. Implementation status (snapshot)

Status legend: ✅ **done** · 🟡 **partial** · ⬜ **not started**.

| Phase | Item | Status | Notes |
|-------|------|--------|-------|
| P0.A | Inventory of blocking async + `asyncio.run` | ✅ | Captured in companion doc `CURSOR_ASYNC_PLAN.md`; CI script `backend/scripts/check_asyncio_run.py` enforces "no `asyncio.run` in `routers/`". |
| P0.B | `cockpit_agent` router blocking routes | ✅ | All blocking handlers converted to sync `def` so Starlette runs them in its thread pool (see `backend/routers/cockpit_agent.py`). |
| P0.C | `asyncio.run` reachable from HTTP | ✅ | No `asyncio.run` remains in `routers/`. `services/nautobot/onboarding/onboarding_service.py` keeps its `asyncio.run` but is now documented as Celery-only (worker boundary). Other service-layer call sites are tracked in `CURSOR_ASYNC_PLAN.md` for later phases and are not reachable from `async def` routes. |
| P1.A | 5xx sanitization policy | ✅ | `backend/core/safe_http_errors.py` adds `raise_internal_server_error(logger, msg, exc)` returning `{message, error_id}` and logging `exc_info`. |
| P1.B¹ | `core/error_handlers.py` decorators | ✅ | `handle_errors`, `handle_not_found`, `handle_validation_errors` route 5xx through `raise_internal_server_error`. |
| P1.B² | `main.py` GraphQL compatibility handler | ✅ | Uses `raise_internal_server_error` instead of `detail=str(e)`. |
| P1.B³ | Batch-fix router `detail=str(e)` for 5xx | ✅ | Completed sweep per `doc/refactoring/REFACTORE_SANITIZED_ERRORS.md`; `backend/scripts/check_http_500_leaks.py` guards routers; optional `status_code` on `raise_internal_server_error` preserves 502/503 semantics with sanitized bodies. |
| P1.C | Logging with `error_id` | ✅ | Built into `safe_http_errors.py`. |
| P2.A | `ClientDataService` + clean clients router | ✅ | `backend/services/clients/client_data_service.py`, DI via `get_client_data_service`; `routers/clients.py` no longer instantiates the repository. |
| P2.B | Login/audit/last_login in single service + transaction | ✅ | `services/auth/login_recording_service.py` performs `update_last_login` + audit log in one `db_transaction()`; `routers/auth/auth.py` calls it. |
| P2.C | `AuditLogService` + migrate routers | ✅ | `services/audit/audit_log_service.py`; `get_audit_log_service` dependency; only `routers/agents/deploy.py` still imports a repository directly (settings + git repo lookups). |
| P3.A | Policy decision documented in `CLAUDE.md` | ✅ | Pragmatic repository `text()` rules + link to `REFACTORING_RAW_SQL.md` §3; `backend/scripts/check_text_sql.py` enforces allow-list. |
| P3.B | `ClientDataRepository` SQL refactor + tests | ✅ | `get_client_data`, `get_device_names`, `delete_old_sessions`, `get_client_history`, and `delete_records_older_than` use ORM/Core; PostgreSQL tests under `tests/integration/repositories/`. |
| P3.C | Move dashboard stats SQL into repository | ✅ | `JobRunRepository.aggregate_status_counts` / `recent_backup_results`; `JobRunService.get_dashboard_stats` composes JSON only. Client cleanup task calls `ClientDataRepository.delete_records_older_than`. |
| P4.1 | Single `if __name__ == "__main__"` in `main.py` | ⬜ | Two blocks remain (lines 315 and 592). |
| P4.2 | Git template stub endpoints honest status | ⬜ | `routers/settings/templates/git.py` still returns fake-success payloads and carries `TODO`. |
| P4.3 | Architecture import guard (routers → repositories) | 🟡 | `check_asyncio_run.py` enforces a similar guard for `asyncio.run`; no equivalent script yet bans `from repositories` inside `routers/` (one remaining hit: `routers/agents/deploy.py`). |

> Update this table when finishing a sub-item; the per-phase sections below carry the same status flags inline.

---

## 1. Findings summary (what is wrong or risky)

Use this section as the single overview before diving into phases.

| # | Area | Severity | What is wrong |
|---|------|----------|----------------|
| F1 | **Async vs blocking I/O** | **Critical** | Several `async def` routes call **synchronous, blocking** code (Redis pub/sub loops, `time.sleep`, SQLAlchemy sync sessions inside async handlers). That **blocks the FastAPI/Starlette event loop** and reduces throughput; under load it can cause widespread latency and timeouts. Example: `routers/cockpit_agent.py` → `CockpitAgentService.wait_for_response()` (blocking Redis subscription loop). |
| F2 | **`asyncio.run()` inside library/service code** | **High** | `asyncio.run()` starts a **new event loop** from a sync context. If called while an event loop is already running (e.g. from an async route or nested call), it can **fail or behave incorrectly**. Example: `services/nautobot/onboarding/onboarding_service.py` — `_get_device_id_from_ip` uses `asyncio.run(self._async_get_device_id(...))`. Similar patterns exist in tasks and other services (grep `asyncio.run(` under `backend/`). |
| F3 | **Raw SQL in runtime application code** | **Resolved (P3)** | Runtime `text()` was removed from services, tasks, and repositories; policy is documented in `CLAUDE.md` + `REFACTORING_RAW_SQL.md` §3 and enforced by `backend/scripts/check_text_sql.py`. Migrations/schema tooling using `text()` remains a **separate, acceptable** category. |
| F4 | **Routers bypass the service layer** | **Medium–High** | Standard is Router → Service → Repository. Some routers **import and call repositories directly** (e.g. `routers/clients.py` with `ClientDataRepository`; `routers/auth/auth.py` with `UserRepository`, `audit_log_repo`; multiple Nautobot/settings routers import `audit_log_repo`). That spreads orchestration and business rules across routers and makes testing and transactions harder. |
| F5 | **500 responses expose internal exception strings** | **Medium** (security / UX) | Many endpoints use `HTTPException(..., detail=str(e))` or `detail=f"... {exc}"`. That can leak stack context, SQL fragments, file paths, or integration details to API clients. Examples: `main.py` compatibility GraphQL handler; `core/error_handlers.py` decorators embed `str(e)` in `detail`; widespread pattern in routers (grep `detail=str(` / `Failed to {operation}: {str(e)}`). |
| F6 | **Duplicate `if __name__ == "__main__"` blocks in `main.py`** | **Low** | `backend/main.py` contains two `if __name__ == "__main__":` sections with different uvicorn entry styles. Confusing and error-prone for operators; one should be canonical. |
| F7 | **Placeholder / stub behaviour in production routers** | **Low** (until fixed) | e.g. `routers/settings/templates/git.py` documents TODO for real Git test/sync while returning success-shaped payloads. Risk: false positives in UI or automation. |
| F8 | **SQLite in tests** | **OK** | `tests/conftest.py` uses in-memory SQLite for repository tests. This does **not** violate production rules; no change required unless you want parity testing on PostgreSQL only. |

**Tooling note:** `ruff check .` under `backend/` passes today. Issues above are mostly **architectural and runtime behaviour**, not simple lint fixes.

---

## 2. Prioritization (what to do first, second, …)

Order is chosen by **user-visible risk**, **correctness under concurrency**, then **structural debt** and **policy alignment** with `CLAUDE.md`.

| Priority | Label | Focus | Rationale |
|----------|--------|--------|-----------|
| **P0** | Stop the bleeding | Blocking async routes + `asyncio.run` hot paths | Prevents production meltdown under concurrent requests and avoids subtle event-loop bugs. |
| **P1** | Safe errors | Sanitize `HTTPException.detail` for 5xx | Quick win: reduces information disclosure without large rewrites. |
| **P2** | Layering | Router → Service → Repository for identified bypasses | Aligns with team standard; enables transactions and unit tests at service boundaries. |
| **P3** | Data access policy | Replace or formally justify runtime `text()` SQL | Largest refactor; some queries may need raw SQL for performance—then document an **explicit exception policy** and confine it to a named module/layer. |
| **P4** | Cleanup | `main.py` uvicorn duplication; TODO stubs; grep-driven consistency | Polish after P0–P3. |

---

## 3. Detailed refactor plans by priority

### P0 — Async/blocking and `asyncio.run` (do first) — ✅ done (see notes)

> Detailed plan and remaining service-layer work tracked in `doc/refactoring/CURSOR_ASYNC_PLAN.md`. HTTP-reachable risk is closed; further `asyncio.run` cleanup in Celery/services is sequenced there.

#### P0.A — Inventory (before coding) — ✅ done

1. Run: `rg "async def" backend/routers -l` and for each file, check whether the body `await`s I/O or calls sync DB/Redis/HTTP/`time.sleep`.
2. Run: `rg "asyncio\\.run\\(" backend -g'*.py'` and list every call site with file + function name.
3. Classify each call site:
   - **Inside FastAPI request handler** (must fix).
   - **Inside Celery task** (often OK in worker process; still prefer one consistent async strategy).
   - **Inside sync script** (`start_celery.py`, `scripts/*`) — lower priority.

#### P0.B — `cockpit_agent` router and service (concrete example) — ✅ done

**Implemented:** All blocking handlers (`send_command`, `git_pull`, `docker_restart`, status/list/history reads) declared as sync `def`; docstrings note that the blocking Redis pub/sub wait runs in Starlette's thread pool. The remaining `async def` (`ping_devices`) only `await`s real I/O and dispatches a Celery job (no blocking work on the loop).

**Problem:** `backend/routers/cockpit_agent.py` defines `async def send_command`, `git_pull`, `docker_restart`, etc., but calls `CockpitAgentService.send_command`, `wait_for_response`, … which are **sync** and perform **blocking** Redis operations.

**Option B1 (minimal change):** Change affected route handlers from `async def` to `def` so FastAPI runs them in a **threadpool** (see Starlette docs: sync endpoints are not run on the event loop). Verify timeout behaviour still acceptable.

**Option B2 (recommended medium-term):** Introduce an async boundary:
- Use `redis.asyncio` client in a dedicated async service, or
- Wrap blocking calls with `anyio.to_thread.run_sync(...)` / `asyncio.to_thread(...)` (Python 3.9+) for **short** operations only; for **long** waits (agent response), prefer **background job + polling** (you already use Celery for ping) so the HTTP request returns immediately.

**Acceptance criteria:**

- Load test or manual parallel requests: event loop remains responsive (e.g. health endpoint stays fast while agent commands run).
- No `async def` route that blocks > ~50 ms without offload (document a numeric SLO if the team agrees).

#### P0.C — `asyncio.run` removal (`onboarding_service` and others) — ✅ done for HTTP paths

**Implemented:** `backend/scripts/check_asyncio_run.py` is the regression guard ("no `asyncio.run` under `backend/routers/`"). `services/nautobot/onboarding/onboarding_service.py` retains a single `asyncio.run` at line 369 but its module docstring now states it is **Celery-only** (invoked exclusively from `tasks/onboard_device_task.py`) — see also `CURSOR_ASYNC_PLAN.md §5.5`. Other service-layer `asyncio.run` sites are inventoried and sequenced in `CURSOR_ASYNC_PLAN.md` (Phase 3 onwards) and are not reachable from `async def` routes.

**Problem:** `asyncio.run()` from sync code that may be invoked under an existing loop is fragile.

**Steps:**

1. For each `asyncio.run(...)` site, determine the **intended entry context** (Celery task only vs HTTP vs mixed).
2. **Preferred fix:** Make the **entire call chain async** up to the Celery task boundary, and use `await` (Celery supports async tasks in supported configurations; confirm your Celery/worker version and `celery_app` setup).
3. **Fallback fix:** If the chain must stay sync, inject a **sync** Nautobot client facade that does not require a running loop, or run async work in a **dedicated thread** with its own loop (documented helper), not `asyncio.run` from arbitrary threads.

**Acceptance criteria:**

- Grep: no `asyncio.run(` in code paths reachable from `async def` FastAPI routes.
- Onboarding and related tasks covered by unit tests that assert no nested-loop errors.

---

### P1 — Sanitize error responses (do second) — ✅ done (see status table)

#### P1.A — Policy — ✅ done

- **5xx:** Return a **generic** message to clients, e.g. `"An internal error occurred"`, plus optional **opaque** `error_id` (UUID) that appears in server logs.
- **4xx:** Keep specific validation messages where safe.
- **Never** put raw `str(e)` in 500 responses for unauthenticated or broad endpoints.

#### P1.B — Central places to change first

1. ✅ `backend/core/error_handlers.py` — `handle_errors`, `handle_not_found`, `handle_validation_errors` now delegate 5xx to `raise_internal_server_error` (generic message + `error_id`, traceback logged).
2. ✅ `backend/main.py` — `/api/nautobot/graphql` compatibility handler routes its 500 path through `raise_internal_server_error`.
3. ✅ Routers: explicit `HTTPException` 5xx paths use `raise_internal_server_error` (or that helper with a non-500 `status_code` for sanitized 502/503). Regression guard: `backend/scripts/check_http_500_leaks.py`. Legitimate `str(e)` / `detail=str(exc)` remains on **4xx** paths only (e.g. `CheckMKClientError → 400`).

**Helper API** (for future fixes):

```python
from core.safe_http_errors import raise_internal_server_error

except Exception as e:
    raise_internal_server_error(logger, "Failed to <operation>", e)
```

#### P1.C — Logging — ✅ done

- Keep rich logging server-side: `logger.exception("msg", extra={"error_id": ...})` or `logger.error("...", exc_info=True)`.
- Ensure request correlation if you have middleware (optional follow-up).

**Acceptance criteria:**

- Manual test: force a 500; response JSON contains no file paths or SQL; logs contain full traceback + `error_id`.

---

### P2 — Service layer for router bypasses (do third) — ✅ done

#### P2.A — Clients feature — ✅ done

**Current:** `backend/routers/clients.py` instantiates `ClientDataRepository()` at module level and calls it from route handlers.

**Target:**

1. ✅ `backend/services/clients/client_data_service.py` provides `get_device_names()`, `get_client_data(...)`, `get_client_history(...)` and delegates to `ClientDataRepository`.
2. ⬜ Optional Pydantic response models for typed OpenAPI — not done; handlers still return `dict`.
3. ✅ Router uses `Depends(get_client_data_service)` from `dependencies.py`.
4. ✅ Module-level repository singleton removed from `routers/clients.py`.

#### P2.B — Auth router and audit logging — ✅ done

**Current:** `UserRepository().update_last_login`, `audit_log_repo.create_log` inside `routers/auth/auth.py`.

**Target:**

1. ✅ `services/auth/login_recording_service.py` exposes `record_successful_login(user_id, username, role_names, *, authentication_method, ...)` and runs `update_last_login` + `create_log` inside a single `db_transaction()` (`auto_commit=False`).
2. ✅ `routers/auth/auth.py` calls `login_recording.record_successful_login(...)` after RBAC enrichment; uses `Depends(get_login_recording_service)`.

#### P2.C — `audit_log_repo` used across many routers — ✅ done

**Target (incremental):**

1. ✅ `services/audit/audit_log_service.py` exposes `log_event(**kwargs)` over `AuditLogRepository`.
2. ✅ Routers consume it via `Depends(get_audit_log_service)`; auth router (api-key login, logout), audit-emitting settings/jobs routers, etc. now use the service.
3. ✅ Repository remains internal — only one router (`routers/agents/deploy.py`) still imports `from repositories.settings.*` for git-repo + agents-settings lookups; tracked as an exception.

**Acceptance criteria:**

- ✅ `rg "from repositories" backend/routers/` returns a single file (`routers/agents/deploy.py`); all other router→repository imports have been removed.
- New endpoints follow Router → Service → Repository in reviews.

---

### P3 — Runtime raw SQL (`text()`) vs ORM (do fourth; largest) — ✅ done

#### P3.A — Policy — ✅ done

**Pragmatic** policy is documented in `CLAUDE.md` (Database Requirements + Incorrect Practices) and expanded in `doc/refactoring/REFACTORING_RAW_SQL.md` §3. Regression guard: `backend/scripts/check_text_sql.py` (allow-list: migrations, tests, tools, scripts, static, `core/database.py`, `core/schema_manager.py`).

#### P3.B — `ClientDataRepository` — ✅ done

**Files:** `backend/repositories/client_data_repository.py`

1. ✅ `get_client_data` — SQLAlchemy CTEs (`_ranked_session_ids_statement` / `_latest_session_cte`, `_client_data_combined_cte`), filters via `bindparam`.
2. ✅ `get_device_names`, `delete_old_sessions`, `get_client_history` — ORM/Core (`distinct(...)`, `delete()`, no `text()`).
3. ✅ `delete_records_older_than` — ORM bulk deletes for periodic cleanup (task delegates here).
4. ✅ PostgreSQL integration tests: `tests/integration/repositories/test_client_data_repository_pg.py`.

#### P3.C — Dashboard stats + cleanup task — ✅ done

1. ✅ `JobRunRepository.aggregate_status_counts()` / `recent_backup_results(days=...)`.
2. ✅ `JobRunService.get_dashboard_stats` uses repository only.
3. ✅ `tasks.cleanup_client_data_task` calls `ClientDataRepository().delete_records_older_than(cutoff)`.
4. ✅ PostgreSQL integration tests: `tests/integration/repositories/test_job_run_repository_pg.py`; unit tests + fakes updated.

**Acceptance criteria:**

- ✅ No `text(` under `backend/services/`, `backend/tasks/`, or `backend/repositories/` (enforced by `check_text_sql.py` for app code paths).

---

### P4 — Cleanup and consistency (do last) — ⬜ not started

1. ⬜ **`main.py`:** Remove duplicate `if __name__ == "__main__":`; document single run command (`uvicorn main:app` vs `python start.py`). Two blocks remain at lines ~315 and ~592.
2. ⬜ **Git template router stubs:** `routers/settings/templates/git.py` still returns fake-success payloads with `TODO` markers. Implement real behaviour or return **501 Not Implemented**.
3. 🟡 **Optional architecture tests:** `backend/scripts/check_asyncio_run.py` already guards `asyncio.run` in routers; no equivalent script yet bans `from repositories` inside `routers/` (one remaining hit lives in `routers/agents/deploy.py`).

---

## 4. Execution checklist (for the implementer)

Use this as a sprint board; tick when done.

- [x] **P0:** List all blocking async routes; fix `cockpit_agent` (and any others found). _Inventory captured in `CURSOR_ASYNC_PLAN.md`; `cockpit_agent` handlers now sync._
- [x] **P0:** Eliminate or quarantine every `asyncio.run(` reachable from HTTP. _Enforced by `backend/scripts/check_asyncio_run.py`; `onboarding_service` documented as Celery-only._
- [x] **P1:** Update `core/error_handlers.py` + `main.py` GraphQL compatibility error handling. _Both delegate 5xx to `core/safe_http_errors.raise_internal_server_error`._
- [x] **P1:** Batch-fix router `detail=str(e)` for 5xx paths. _Sweep complete; `backend/scripts/check_http_500_leaks.py` enforces no leaky 5xx `HTTPException` detail under `routers/`._
- [x] **P2:** Add `ClientDataService`; refactor `routers/clients.py`. _`services/clients/client_data_service.py` + `get_client_data_service` DI._
- [x] **P2:** Consolidate login/audit/last_login in auth service; refactor `routers/auth/auth.py`. _`services/auth/login_recording_service.py` runs both writes in one `db_transaction()`._
- [x] **P2:** Introduce `AuditLogService`; migrate high-traffic routers first. _`services/audit/audit_log_service.py` + `get_audit_log_service`; only `routers/agents/deploy.py` still imports a repository directly._
- [x] **P3:** Policy decision documented in `CLAUDE.md`. _Pragmatic rules + `check_text_sql.py`._
- [x] **P3:** Refactor `client_data_repository` SQL per policy + tests. _ORM for D/E/F/H helpers; PG tests in `tests/integration/repositories/`._
- [x] **P3:** Move dashboard stats SQL to repository; slim service. _`JobRunRepository` dashboard methods + `FakeJobRunRepository`; CI runs PG-backed repository tests._
- [ ] **P4:** `main.py` cleanup; stub endpoints honest status; optional import guard test. _Two `if __name__` blocks remain; `routers/settings/templates/git.py` still returns fake-success payloads; no router→repository import guard script yet._

Legend: `[x]` done · `[~]` partial · `[ ]` not started.

---

## 5. Verification commands (after each phase)

```bash
cd backend && ruff check .
cd backend && python scripts/check_asyncio_run.py
cd backend && python scripts/check_http_500_leaks.py
cd backend && python scripts/check_text_sql.py
cd backend && pytest tests/ -q --tb=short   # adjust scope as needed
```

For P0 specifically, add a short concurrent smoke test (script or pytest) that hits `/health` or `/` while a long-running agent endpoint is in flight, and assert p95 latency of `/health` stays below an agreed threshold.

---

## 6. References (in-repo)

| Topic | Location |
|--------|----------|
| Companion plan (async / `asyncio.run`) | `doc/refactoring/CURSOR_ASYNC_PLAN.md` |
| DB session + transactions | `backend/core/database.py` (`get_db`, `db_transaction`) |
| Repository base | `backend/repositories/base.py` |
| Auth / permissions | `backend/core/auth.py` |
| Error helper decorators | `backend/core/error_handlers.py` |
| Safe 5xx helper (P1) | `backend/core/safe_http_errors.py` |
| Router→repository guard (asyncio variant) | `backend/scripts/check_asyncio_run.py` |
| Sanitized 5xx router `HTTPException` detail (P1) | `backend/scripts/check_http_500_leaks.py` |
| `cockpit_agent` (P0.B implementation) | `backend/routers/cockpit_agent.py` |
| Clients router (P2.A implementation) | `backend/routers/clients.py`, `backend/services/clients/client_data_service.py` |
| Auth login (P2.B implementation) | `backend/routers/auth/auth.py`, `backend/services/auth/login_recording_service.py` |
| Audit service (P2.C implementation) | `backend/services/audit/audit_log_service.py` |
| Repository `text()` guard (P3) | `backend/scripts/check_text_sql.py` |
| Client data repository (P3 — ORM) | `backend/repositories/client_data_repository.py` |
| Job run repository dashboard helpers (P3) | `backend/repositories/jobs/job_run_repository.py` |
| `asyncio.run` smell (P0.C — now Celery-only) | `backend/services/nautobot/onboarding/onboarding_service.py` |

---

*Document version: CURSOR_REFACTOR_1 — created for follow-up implementation; findings reflect review at authoring time.*
