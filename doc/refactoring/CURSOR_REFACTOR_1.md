# Backend refactoring plan — CURSOR_REFACTOR_1

This document records findings from a backend architecture and Python best-practices review (relative to `CLAUDE.md` standards: Model → Repository → Service → Router, no raw SQL in application code, JWT/RBAC, logging style, etc.). It is written so a future implementation pass can execute the work without re-discovering context.

---

## 1. Findings summary (what is wrong or risky)

Use this section as the single overview before diving into phases.

| # | Area | Severity | What is wrong |
|---|------|----------|----------------|
| F1 | **Async vs blocking I/O** | **Critical** | Several `async def` routes call **synchronous, blocking** code (Redis pub/sub loops, `time.sleep`, SQLAlchemy sync sessions inside async handlers). That **blocks the FastAPI/Starlette event loop** and reduces throughput; under load it can cause widespread latency and timeouts. Example: `routers/cockpit_agent.py` → `CockpitAgentService.wait_for_response()` (blocking Redis subscription loop). |
| F2 | **`asyncio.run()` inside library/service code** | **High** | `asyncio.run()` starts a **new event loop** from a sync context. If called while an event loop is already running (e.g. from an async route or nested call), it can **fail or behave incorrectly**. Example: `services/nautobot/onboarding/onboarding_service.py` — `_get_device_id_from_ip` uses `asyncio.run(self._async_get_device_id(...))`. Similar patterns exist in tasks and other services (grep `asyncio.run(` under `backend/`). |
| F3 | **Raw SQL in runtime application code** | **High** (vs `CLAUDE.md`) | `CLAUDE.md` states: never use raw SQL; use SQLAlchemy ORM and repositories. **Runtime** code uses `sqlalchemy.text()` and hand-built SQL strings in repositories/services (e.g. `repositories/client_data_repository.py`, `services/jobs/job_run_service.py.get_dashboard_stats`). Migrations/schema tooling using `text()` is a **separate, acceptable** category. |
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

### P0 — Async/blocking and `asyncio.run` (do first)

#### P0.A — Inventory (before coding)

1. Run: `rg "async def" backend/routers -l` and for each file, check whether the body `await`s I/O or calls sync DB/Redis/HTTP/`time.sleep`.
2. Run: `rg "asyncio\\.run\\(" backend -g'*.py'` and list every call site with file + function name.
3. Classify each call site:
   - **Inside FastAPI request handler** (must fix).
   - **Inside Celery task** (often OK in worker process; still prefer one consistent async strategy).
   - **Inside sync script** (`start_celery.py`, `scripts/*`) — lower priority.

#### P0.B — `cockpit_agent` router and service (concrete example)

**Problem:** `backend/routers/cockpit_agent.py` defines `async def send_command`, `git_pull`, `docker_restart`, etc., but calls `CockpitAgentService.send_command`, `wait_for_response`, … which are **sync** and perform **blocking** Redis operations.

**Option B1 (minimal change):** Change affected route handlers from `async def` to `def` so FastAPI runs them in a **threadpool** (see Starlette docs: sync endpoints are not run on the event loop). Verify timeout behaviour still acceptable.

**Option B2 (recommended medium-term):** Introduce an async boundary:
- Use `redis.asyncio` client in a dedicated async service, or
- Wrap blocking calls with `anyio.to_thread.run_sync(...)` / `asyncio.to_thread(...)` (Python 3.9+) for **short** operations only; for **long** waits (agent response), prefer **background job + polling** (you already use Celery for ping) so the HTTP request returns immediately.

**Acceptance criteria:**

- Load test or manual parallel requests: event loop remains responsive (e.g. health endpoint stays fast while agent commands run).
- No `async def` route that blocks > ~50 ms without offload (document a numeric SLO if the team agrees).

#### P0.C — `asyncio.run` removal (`onboarding_service` and others)

**Problem:** `asyncio.run()` from sync code that may be invoked under an existing loop is fragile.

**Steps:**

1. For each `asyncio.run(...)` site, determine the **intended entry context** (Celery task only vs HTTP vs mixed).
2. **Preferred fix:** Make the **entire call chain async** up to the Celery task boundary, and use `await` (Celery supports async tasks in supported configurations; confirm your Celery/worker version and `celery_app` setup).
3. **Fallback fix:** If the chain must stay sync, inject a **sync** Nautobot client facade that does not require a running loop, or run async work in a **dedicated thread** with its own loop (documented helper), not `asyncio.run` from arbitrary threads.

**Acceptance criteria:**

- Grep: no `asyncio.run(` in code paths reachable from `async def` FastAPI routes.
- Onboarding and related tasks covered by unit tests that assert no nested-loop errors.

---

### P1 — Sanitize error responses (do second)

#### P1.A — Policy

- **5xx:** Return a **generic** message to clients, e.g. `"An internal error occurred"`, plus optional **opaque** `error_id` (UUID) that appears in server logs.
- **4xx:** Keep specific validation messages where safe.
- **Never** put raw `str(e)` in 500 responses for unauthenticated or broad endpoints.

#### P1.B — Central places to change first

1. `backend/core/error_handlers.py` — `handle_errors`, `handle_not_found`, `handle_validation_errors`: replace `detail=f"Failed to {operation}: {str(e)}"` with generic detail + log `exc_info` including `error_id`.
2. `backend/main.py` — `/api/nautobot/graphql` compatibility handler: do not return `str(e)` in 500 body; log full exception server-side.
3. Routers with explicit `raise HTTPException(..., detail=str(e))`: fix in batches (start with auth, settings, checkmk, cockpit_agent — high traffic / sensitive).

#### P1.C — Logging

- Keep rich logging server-side: `logger.exception("msg", extra={"error_id": ...})` or `logger.error("...", exc_info=True)`.
- Ensure request correlation if you have middleware (optional follow-up).

**Acceptance criteria:**

- Manual test: force a 500; response JSON contains no file paths or SQL; logs contain full traceback + `error_id`.

---

### P2 — Service layer for router bypasses (do third)

#### P2.A — Clients feature

**Current:** `backend/routers/clients.py` instantiates `ClientDataRepository()` at module level and calls it from route handlers.

**Target:**

1. Add `backend/services/clients/client_data_service.py` (name to match domain) with methods: `get_device_names()`, `get_client_data(...)`, `get_client_history(...)` delegating to `ClientDataRepository`.
2. Optionally add Pydantic response models under `backend/models/` for typed OpenAPI (today handlers return `dict`).
3. Router depends on service via `Depends()` factory or thin `get_client_data_service()` in `dependencies.py` for testability.
4. Remove module-level repository singleton from router.

#### P2.B — Auth router and audit logging

**Current:** `UserRepository().update_last_login`, `audit_log_repo.create_log` inside `routers/auth/auth.py`.

**Target:**

1. Extend `services/auth/...` (existing user management module) with `record_successful_login(user_id, username, ...)` that performs last_login update + audit log inside **one transaction** where appropriate (`core.database.db_transaction()`).
2. Router calls only that service method after `authenticate_user` / RBAC enrichment.

#### P2.C — `audit_log_repo` used across many routers

**Target (incremental):**

1. Introduce `AuditLogService` with `log_event(event_type, message, **kwargs)` used by routers **or** accept that routers may call audit service only (not repository).
2. Migrate routers file-by-file (settings, nautobot, jobs) to depend on the service.
3. Keep repository as internal implementation detail.

**Acceptance criteria:**

- Grep `from repositories` under `backend/routers/` trends to zero except where team explicitly allows (document exceptions).
- New endpoints follow Router → Service → Repository in reviews.

---

### P3 — Runtime raw SQL (`text()`) vs ORM (do fourth; largest)

#### P3.A — Clarify policy with stakeholders

`CLAUDE.md` says “never raw SQL”. Complex reporting (CTEs, `DISTINCT ON`, correlated aggregates) may be **legitimately** clearer or faster in SQL.

**Choose one:**

- **Strict:** Rewrite everything with SQLAlchemy Core/ORM expressions (may be verbose).
- **Pragmatic:** Allow **read-only** SQL in **repository-only** modules, with mandatory tests and named constants for SQL strings; update `CLAUDE.md` to match reality.

This plan assumes **Pragmatic** unless product owners insist on strict ORM.

#### P3.B — `ClientDataRepository`

**Files:** `backend/repositories/client_data_repository.py`

**Steps:**

1. Document each public method’s contract (inputs, sorting, pagination).
2. For `get_client_data` / `get_device_names` / `get_client_history`:
   - If staying with SQL: move large SQL strings to private module-level constants; ensure **all** user filters go through **bound parameters** (already partly true; review f-string composition for injection risk on any future change).
   - If rewriting to ORM: build query in stages; verify PostgreSQL-specific `DISTINCT ON` maps to `distinct(Model.col1, Model.col2)` or use subqueries.
3. Add integration tests against **PostgreSQL** (or Testcontainers) for at least one “latest session” scenario and one filter combination.

#### P3.C — `JobRunService.get_dashboard_stats`

**Current:** Opens `get_db_session()`, runs raw `text()` aggregates + JSON parsing in service.

**Target:**

1. Move SQL to `JobRunRepository` (or extend existing `job_run_repository`) with named methods: `aggregate_status_counts()`, `recent_backup_results(since=...)`.
2. Service composes dict response only.
3. Consider single query or database view if performance matters.

**Acceptance criteria:**

- No `text(` in `services/` except possibly a documented shim; repositories contain all SQL.
- Tests cover stats shape and empty DB edge case.

---

### P4 — Cleanup and consistency (do last)

1. **`main.py`:** Remove duplicate `if __name__ == "__main__":`; document single run command (`uvicorn main:app` vs `python start.py`).
2. **Git template router stubs:** Implement real behaviour or return **501 Not Implemented** with clear message until done (avoid fake success).
3. **Optional:** Add architecture tests — e.g. a simple script that fails CI if `routers/` imports `repositories.` (allow-list file for gradual migration).

---

## 4. Execution checklist (for the implementer)

Use this as a sprint board; tick when done.

- [ ] **P0:** List all blocking async routes; fix `cockpit_agent` (and any others found).
- [ ] **P0:** Eliminate or quarantine every `asyncio.run(` reachable from HTTP.
- [ ] **P1:** Update `core/error_handlers.py` + `main.py` GraphQL compatibility error handling.
- [ ] **P1:** Batch-fix router `detail=str(e)` for 5xx paths.
- [ ] **P2:** Add `ClientDataService`; refactor `routers/clients.py`.
- [ ] **P2:** Consolidate login/audit/last_login in auth service; refactor `routers/auth/auth.py`.
- [ ] **P2:** Introduce `AuditLogService`; migrate high-traffic routers first.
- [ ] **P3:** Policy decision documented in `CLAUDE.md`.
- [ ] **P3:** Refactor `client_data_repository` SQL per policy + tests.
- [ ] **P3:** Move dashboard stats SQL to repository; slim service.
- [ ] **P4:** `main.py` cleanup; stub endpoints honest status; optional import guard test.

---

## 5. Verification commands (after each phase)

```bash
cd backend && ruff check .
cd backend && pytest tests/ -q --tb=short   # adjust scope as needed
```

For P0 specifically, add a short concurrent smoke test (script or pytest) that hits `/health` or `/` while a long-running agent endpoint is in flight, and assert p95 latency of `/health` stays below an agreed threshold.

---

## 6. References (in-repo)

| Topic | Location |
|--------|----------|
| DB session + transactions | `backend/core/database.py` (`get_db`, `db_transaction`) |
| Repository base | `backend/repositories/base.py` |
| Auth / permissions | `backend/core/auth.py` |
| Error helper decorators | `backend/core/error_handlers.py` |
| Example blocking async route | `backend/routers/cockpit_agent.py` |
| Example router → repository bypass | `backend/routers/clients.py` |
| Example raw SQL repository | `backend/repositories/client_data_repository.py` |
| Example raw SQL in service | `backend/services/jobs/job_run_service.py` |
| `asyncio.run` smell | `backend/services/nautobot/onboarding/onboarding_service.py` |

---

*Document version: CURSOR_REFACTOR_1 — created for follow-up implementation; findings reflect review at authoring time.*
