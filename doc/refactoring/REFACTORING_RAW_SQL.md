# Refactoring plan — Runtime raw SQL (`text()`) vs ORM (P3)

Companion implementation plan for **P3 — Data access policy** from
`doc/refactoring/CURSOR_REFACTOR_1.md`. It records the **pragmatic**
position for runtime SQLAlchemy use and how D–H were moved to ORM/Core
or repository-only maintenance helpers. **`CLAUDE.md`**, CI
(`.github/workflows/backend-tests.yml`), and `backend/scripts/check_text_sql.py`
encode the outcome.

---

## 1. Goal & non-goals

### 1.1 Goal

For every runtime `text()` call under `backend/`:

1. Lives in **repository layer only** (no `text()` in routers, services,
   or tasks).
2. Uses **bound parameters** (no f-string assembly of values).
3. Is **read-only**, OR is a documented bulk maintenance statement
   (e.g. periodic cleanup) executed inside a dedicated maintenance
   service.
4. SQL strings are **module-level named constants**, not inlined into
   methods.
5. Is covered by an integration test against PostgreSQL (Testcontainers
   or a dev PG instance) — not just SQLite.
6. The policy is reflected in `CLAUDE.md` so future PR reviews can
   point to a written rule.

### 1.2 Non-goals

- Migrating to SQLAlchemy 2.0 async sessions (separate, larger effort).
- Rewriting migration scripts (`backend/migrations/**`) — those are
  schema management and are excluded from "runtime" by definition.
- Rewriting `core/schema_manager.py` (still schema-management) or the
  `SELECT 1` health-check ping in `core/database.py`.
- Adding a database view or materialized view for the dashboard (a
  follow-up performance task; in scope for this plan is moving the SQL
  to the right layer, not changing physical schema).

---

## 2. Current state (verified)

### 2.1 Runtime `text()` inventory (excluding migrations / tests / tools / scripts)

| # | Location | Status |
|---|----------|--------|
| A | `backend/core/database.py` — `SELECT 1` health ping | **Exempt** (infra). |
| B | `backend/core/schema_manager.py` | **Exempt** (schema management). |
| C | `backend/migrations/**`, `migrations/auto_schema.py`, `migrations/runner.py` | **Out of scope** (schema tooling). |
| D–F | `ClientDataRepository` (`get_device_names`, `delete_old_sessions`, `get_client_history`) | **Done** — SQLAlchemy ORM/Core only; PostgreSQL integration tests in `tests/integration/repositories/test_client_data_repository_pg.py`. |
| G | `JobRunService.get_dashboard_stats` | **Done** — SQL lives in `JobRunRepository.aggregate_status_counts` / `recent_backup_results`; PG tests in `test_job_run_repository_pg.py`. |
| H | `tasks.cleanup_client_data_task` | **Done** — `ClientDataRepository.delete_records_older_than`; covered by unit + PG cleanup test in `test_client_data_repository_pg.py`. |

**Enforcement:** `backend/scripts/check_text_sql.py` fails CI if `text(` appears outside the allow-list under `backend/` (excluding migrations, tests, tools, scripts, static, and the two infra files above).

### 2.2 Implemented ORM surface (`ClientDataRepository`)

- `get_client_data` — CTE pipeline `_client_data_combined_cte` with `bindparam` filters.
- Shared session ranking — `_ranked_session_ids_statement()`, `_latest_session_cte()`, `_keep_sessions_cte(keep)`.
- `get_device_names`, `delete_old_sessions`, `get_client_history` — Core `select` / `delete` / PostgreSQL `DISTINCT ON` via `.distinct(...)`.
- `delete_records_older_than` — ORM `.delete(synchronize_session=False)` for IP, MAC, hostname tables.

### 2.3 Follow-ups (optional)

- Optional **Testcontainers** profile if teams want PG tests without a managed `TEST_DATABASE_URL`.
- Revisit **performance** (`EXPLAIN ANALYZE`) if dashboard aggregates ever become hot paths.

---

## 3. Policy decision (P3.A) — write this down first

### 3.1 Proposal: **Pragmatic strict**

> Application code (services, routers, tasks) MUST NOT call
> `sqlalchemy.text()`. **Repositories** MAY call `text()` ONLY for
> read-only queries that are clearer or measurably faster in raw SQL
> (typically PostgreSQL features such as `DISTINCT ON`, lateral joins,
> CTEs that don't map cleanly to ORM). Every such query must:
>
> 1. Live in a **module-level named constant** at the top of the
>    repository file, with a one-line docstring above it explaining
>    the shape (inputs, ordering, intent).
> 2. Use only **bound parameters** for any value coming from outside
>    the constant — never f-string composition of values.
> 3. Be covered by an integration test running against **PostgreSQL**
>    (the production dialect), not just SQLite.
>
> Bulk maintenance DELETEs (cleanup tasks) live on a **dedicated
> repository method** and use ORM `.delete()` when possible; if
> performance demands `text()`, follow the same rules as read-only
> queries and tag the method `@maintenance_query`.
>
> Health checks (`SELECT 1`) and schema management code
> (`core/schema_manager.py`, `backend/migrations/**`) are exempt.

If product owners reject the pragmatic stance and insist on strict
ORM, the only items that change are F (`get_client_history`) and the
maintenance methods — everything else already converts cleanly.

### 3.2 `CLAUDE.md` edit

Replace the two existing strict lines:

> `❌ NEVER use SQLite or raw SQL queries`
> `❌ Writing raw SQL instead of SQLAlchemy ORM`

with:

> `✅ Prefer SQLAlchemy ORM/Core for all runtime data access.`
> `✅ Raw SQL via sqlalchemy.text() is allowed only inside the repository layer, read-only, with bound parameters, named constants, and PostgreSQL integration tests. See doc/refactoring/REFACTORING_RAW_SQL.md §3.`
> `❌ Never call text() from routers, services, or tasks.`
> `❌ Never compose values into raw SQL via f-strings or string concatenation.`

This wording is **landed** in `CLAUDE.md` alongside the P3 implementation below.

---

## 4. Phased execution plan

PRs are sequenced so each one is independently shippable and reviewable.

### Phase 0 — Policy + tooling — ✅ done

1. ✅ `CLAUDE.md` edit from §3.2 (pragmatic policy).
2. ✅ `backend/scripts/check_text_sql.py` runs in CI with `check_asyncio_run.py` / `check_http_500_leaks.py`.
3. ✅ Initial shrink-list captured in git history; `TEMPORARY_ALLOW_LIST` was removed once D–H landed.

### Phase 1 — Move dashboard stats into the repository (P3.C)

**Files:** `backend/services/jobs/job_run_service.py`,
`backend/repositories/jobs/job_run_repository.py`.

**Steps:**

1. In `JobRunRepository`, add two new methods:

   ```python
   def aggregate_status_counts(self) -> dict[str, int]:
       """Counts of job runs by status (total/completed/failed/running)."""
       from sqlalchemy import case, func
       from core.database import get_db_session

       with get_db_session() as session:
           total = func.count().label("total")
           completed = func.sum(case((self.model.status == "completed", 1), else_=0)).label("completed")
           failed = func.sum(case((self.model.status == "failed", 1), else_=0)).label("failed")
           running = func.sum(case((self.model.status == "running", 1), else_=0)).label("running")
           row = session.execute(
               select(total, completed, failed, running).select_from(self.model)
           ).one()
       return {
           "total": int(row.total or 0),
           "completed": int(row.completed or 0),
           "failed": int(row.failed or 0),
           "running": int(row.running or 0),
       }

   def recent_backup_results(self, days: int = 30) -> list[dict | str]:
       """Raw `result` payloads for completed backup runs queued in the last N days."""
       from datetime import datetime, timedelta, timezone
       from core.database import get_db_session

       cutoff = datetime.now(timezone.utc) - timedelta(days=days)
       with get_db_session() as session:
           rows = session.execute(
               select(self.model.result)
               .where(self.model.job_type == "backup")
               .where(self.model.status == "completed")
               .where(self.model.queued_at >= cutoff)
           ).all()
       return [row[0] for row in rows if row[0] is not None]
   ```

2. In `JobRunService.get_dashboard_stats`, delete the `text()` blocks
   and the manual `get_db_session()` opening; replace with:

   ```python
   def get_dashboard_stats(self) -> Dict[str, Any]:
       counts = self._repo.aggregate_status_counts()
       backup_payloads = self._repo.recent_backup_results(days=30)
       total_ok, total_fail = 0, 0
       for payload in backup_payloads:
           parsed = payload if isinstance(payload, dict) else _safe_json_loads(payload)
           if not parsed:
               continue
           total_ok += int(parsed.get("devices_backed_up", 0) or 0)
           total_fail += int(parsed.get("devices_failed", 0) or 0)
       return {
           "job_runs": counts,
           "backup_devices": {
               "total_devices": total_ok + total_fail,
               "successful_devices": total_ok,
               "failed_devices": total_fail,
           },
       }
   ```

3. Add unit tests in
   `backend/tests/unit/services/test_job_run_service.py` (file already
   exists) for the empty-DB shape and one populated scenario, using a
   fake repository (mocks already exist under
   `tests/mocks/fake_job_repositories.py`).

4. Add an integration test (see §6) that exercises
   `aggregate_status_counts` against PostgreSQL.

**Exit criteria:**

- `rg "text\(" backend/services/jobs/` → empty.
- `pytest backend/tests/unit/services/test_job_run_service.py` passes.
- Dashboard endpoint manually verified to return the same shape as
  before.

### Phase 2 — Move client-data cleanup out of the task (item H)

**Files:** `backend/tasks/periodic_tasks.py`,
`backend/repositories/client_data_repository.py`.

**Steps:**

1. Add a single repository method:

   ```python
   def delete_records_older_than(self, cutoff: datetime) -> ClientDataCleanupResult:
       """Bulk delete from all three client-data tables; returns counts."""
       from core.database import get_db_session

       with get_db_session() as session:
           ip = session.query(ClientIpAddress).filter(ClientIpAddress.collected_at < cutoff).delete(synchronize_session=False)
           mac = session.query(ClientMacAddress).filter(ClientMacAddress.collected_at < cutoff).delete(synchronize_session=False)
           host = session.query(ClientHostname).filter(ClientHostname.collected_at < cutoff).delete(synchronize_session=False)
           session.commit()
       return ClientDataCleanupResult(ip=ip, mac=mac, host=host)
   ```

   `ClientDataCleanupResult` is a small `NamedTuple` or `dataclass`
   at module level so the task code reads cleanly.

2. In `tasks/periodic_tasks.py`, replace the three `text(…)` calls
   and the manual `get_db_session()` with:

   ```python
   from repositories.client_data_repository import ClientDataRepository

   result = ClientDataRepository().delete_records_older_than(cutoff_time)
   removed_ip, removed_mac, removed_host = result.ip, result.mac, result.host
   ```

3. Re-run the existing
   `backend/tests/unit/tasks/test_periodic_tasks.py` — add a case
   that asserts the task calls the repository method (mock it) and
   logs the returned counts.

**Exit criteria:**

- `rg "text\(" backend/tasks/` → empty.
- Periodic task test passes.

### Phase 3 — `delete_old_sessions` (item E)

**File:** `backend/repositories/client_data_repository.py`.

**Steps:**

1. Replace the three `session.execute(text("DELETE … WHERE session_id
   NOT IN (…)"))` blocks with ORM `.delete(synchronize_session=False)`
   driven by a `select` of the "sessions to keep" CTE
   (`_latest_session_cte` analogue parameterized by `keep`):

   ```python
   def _keep_sessions_cte(keep: int):
       mac = select(ClientMacAddress.session_id, func.max(ClientMacAddress.collected_at).label("ts")).group_by(ClientMacAddress.session_id)
       ip  = select(ClientIpAddress.session_id,  func.max(ClientIpAddress.collected_at).label("ts")).group_by(ClientIpAddress.session_id)
       combined = union_all(mac, ip).subquery("combined")
       return (
           select(combined.c.session_id)
           .group_by(combined.c.session_id)
           .order_by(func.max(combined.c.ts).desc())
           .limit(keep)
       ).cte("keep_sessions")
   ```

2. Three deletes:

   ```python
   keep_sessions = _keep_sessions_cte(keep)
   for model in (ClientHostname, ClientMacAddress, ClientIpAddress):
       session.execute(
           delete(model).where(model.session_id.notin_(select(keep_sessions.c.session_id)))
           .execution_options(synchronize_session=False)
       )
   ```

3. Add integration test verifying that after multiple insert cycles,
   `delete_old_sessions(keep=2)` retains exactly the two newest
   sessions across both tables (including the L2-only-session edge
   case the original `text()` was designed for).

**Exit criteria:**

- The three `text(` occurrences in `delete_old_sessions` are gone.
- New integration test passes against PostgreSQL.

### Phase 4 — `get_device_names` (item D)

**File:** `backend/repositories/client_data_repository.py`.

**Steps:**

1. Reuse `_latest_session_cte()` already defined in the file.
2. Rewrite as ORM:

   ```python
   def get_device_names(self) -> list[str]:
       ls = _latest_session_cte()
       mac = select(ClientMacAddress.device_name, ClientMacAddress.session_id).select_from(ClientMacAddress)
       ip = (
           select(ClientIpAddress.device_name, ClientIpAddress.session_id)
           .select_from(ClientIpAddress)
           .where(ClientIpAddress.mac_address.isnot(None))
       )
       combined = union(mac, ip).subquery("combined")
       stmt = (
           select(combined.c.device_name)
           .where(combined.c.session_id == select(ls.c.session_id).scalar_subquery())
           .distinct()
           .order_by(combined.c.device_name)
       )
       with get_db_session() as session:
           rows = session.execute(stmt).all()
       return [row[0] for row in rows]
   ```

3. Integration test verifying L2-only device visibility (one device
   present **only** in `client_mac_addresses`).

**Exit criteria:**

- `get_device_names` contains no `text(` call.
- Test passes; UI smoke test confirms the device dropdown matches the
  pre-refactor result.

### Phase 5 — `get_client_history` (item F)

**File:** `backend/repositories/client_data_repository.py`.

This is the largest method — three branches (IP / MAC / hostname),
each using PostgreSQL `DISTINCT ON`.

**Steps:**

1. Pick one branch per PR (start with `ip_address` since it has the
   `LEFT JOIN client_mac_addresses` complication).
2. Translate `DISTINCT ON (session_id, device_name)` into:

   ```python
   from sqlalchemy import select

   stmt = (
       select(
           ClientIpAddress.ip_address,
           ClientIpAddress.mac_address,
           func.coalesce(ClientMacAddress.port, ClientIpAddress.interface).label("port"),
           ClientMacAddress.vlan,
           ClientIpAddress.device_name,
           ClientIpAddress.collected_at,
       )
       .outerjoin(
           ClientMacAddress,
           and_(
               ClientMacAddress.mac_address == ClientIpAddress.mac_address,
               ClientMacAddress.device_name == ClientIpAddress.device_name,
               ClientMacAddress.session_id == ClientIpAddress.session_id,
           ),
       )
       .where(ClientIpAddress.ip_address == ip_address)
       .order_by(
           ClientIpAddress.session_id,
           ClientIpAddress.device_name,
           ClientIpAddress.collected_at.desc(),
       )
       .distinct(ClientIpAddress.session_id, ClientIpAddress.device_name)
   )
   ```

   SQLAlchemy emits PostgreSQL `DISTINCT ON` when you pass column
   arguments to `.distinct()`.

3. If a branch resists conversion (e.g. unusual aliasing), keep its
   SQL as a **module-level named constant** under the pragmatic
   policy, but wrap it in a private method so the public contract
   doesn't change.

4. Integration test for each branch: same fixture data, assert the
   shape and ordering match the pre-refactor implementation.

**Exit criteria:**

- All three branches converted, OR explicitly retained as named
  constants with policy comment and an integration test.
- `repositories/client_data_repository.py` has at most one named
  module-level SQL constant remaining (the legacy
  `_LATEST_SESSION_SUBQUERY` should be removable once D and E are
  done — confirm during Phase 4 cleanup).

### Phase 6 — Lock the policy in (½ day)

1. Move `check_text_sql.py` from allow-list mode to **strict mode**:
   any `text(` outside the documented infrastructure list fails CI.
2. Update `CURSOR_REFACTOR_1.md` section 0 table: rows P3.A → ✅,
   P3.B → ✅, P3.C → ✅; section-4 checklist boxes flipped.
3. Add a short FAQ to `CLAUDE.md` linking back to this document so the
   next reviewer can find the policy without grepping commit history.

---

## 5. Conversion sketches (per call site)

These are intended as a starting point for the implementer — adjust to
match the surrounding helpers in the file.

### 5.1 `get_device_names`

See Phase 4. The shared `_latest_session_cte()` already exists in
`client_data_repository.py:40` and matches the legacy
`_LATEST_SESSION_SUBQUERY` exactly, so this is a mechanical
substitution.

### 5.2 `delete_old_sessions`

See Phase 3. Note the `synchronize_session=False` is required because
the WHERE clause uses a subquery the in-memory session can't expire
correctly.

### 5.3 `get_client_history`

See Phase 5. PostgreSQL parity is critical here; SQLite (used in some
tests) does not implement `DISTINCT ON`, so add `@pytest.mark.postgres`
or a fixture that points at PostgreSQL only.

### 5.4 `JobRunService.get_dashboard_stats`

See Phase 1. The current implementation uses
`SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)` per status —
this is exactly what `sqlalchemy.case` produces, and PostgreSQL emits
identical plans.

### 5.5 `tasks/periodic_tasks` cleanup

See Phase 2. The destination repository method belongs next to
`bulk_insert_*` so all client-data mutations are colocated.

---

## 6. Test strategy

### 6.1 Existing fixture footprint

- `backend/tests/conftest.py` ships `db_session` (in-memory SQLite at
  line ~289) used by the existing repository tests.
- Mock repositories live under `backend/tests/mocks/`.

### 6.2 Why SQLite is insufficient for P3

- `DISTINCT ON` (PostgreSQL-only).
- `NOW() - INTERVAL '30 days'` (works in SQLite via the dialect but
  semantics differ for timezone-aware comparisons).
- `synchronize_session=False` + subquery deletes (SQLite may still
  succeed but rowcount semantics can diverge).

### 6.3 Add a `pg_session` fixture

Pick **one** of the following:

1. **Testcontainers** (recommended): spin up `postgres:16` in CI; add
   `testcontainers[postgresql]` to `backend/requirements-dev.txt`.
2. **CI-managed PG service**: rely on the CI runner's
   `services: postgres` block; map `DATABASE_URL` for the test job.

The plan recommends Testcontainers because it works equally well on
laptops and CI, and removes the "works on my CI but not locally" class
of bugs.

### 6.4 New test files

| File | What it covers |
|------|----------------|
| `backend/tests/integration/repositories/test_client_data_repository_pg.py` | `get_device_names`, `delete_old_sessions`, `get_client_history`, `delete_records_older_than` — PostgreSQL. |
| `backend/tests/integration/repositories/test_job_run_repository_pg.py` | `aggregate_status_counts`, `recent_backup_results` — PostgreSQL. |
| `backend/tests/unit/services/test_job_run_service.py` | `get_dashboard_stats` composition via `FakeJobRunRepository`. |

Tests are marked `@pytest.mark.postgres` and **skip** when `TEST_DATABASE_URL` is unset (local). **GitHub Actions** (`.github/workflows/backend-tests.yml`) provisions PostgreSQL, runs `init_db`, sets `TEST_DATABASE_URL`, and runs `pytest tests/unit tests/integration/repositories`.

---

## 7. Lint script (`backend/scripts/check_text_sql.py`)

**Implemented** in-repo (not a template). The script walks `backend/**/*.py`, skips allow-listed prefixes (`migrations/`, `tests/`, `tools/`, `scripts/`, `static/`) and files `core/database.py` and `core/schema_manager.py`, then flags lines containing `text(` in modules that import SQLAlchemy while ignoring obvious `Path.read_text` / `write_text` false positives.

Run::

    cd backend && python scripts/check_text_sql.py

There is **no temporary allow-list**; new `text(` call sites must either land in an allow-listed path or extend the policy in this document first.

---

## 8. Acceptance criteria for the whole P3 phase

- [x] `CLAUDE.md` updated with pragmatic wording and pointer to this document (§3).
- [x] `backend/scripts/check_text_sql.py` exists, runs in CI (`.github/workflows/backend-tests.yml`); no temporary allow-list entries.
- [x] `rg "text\\(" backend/services/ backend/tasks/ backend/repositories/` returns no matches.
- [x] `JobRunRepository.aggregate_status_counts` and `recent_backup_results` exist with unit (`FakeJobRunRepository`) + PostgreSQL integration coverage.
- [x] `ClientDataRepository.delete_records_older_than` exists and is called from `tasks/periodic_tasks.py` (with tests).
- [x] `ClientDataRepository.get_device_names`, `delete_old_sessions`, and `get_client_history` use ORM/Core; repository file contains no `text()`.
- [x] `pytest backend/tests/integration/repositories/ -q` is green when `TEST_DATABASE_URL` points at an initialized PostgreSQL database (see `README.md` in that folder).
- [x] Section 0 status rows P3.A, P3.B, P3.C in `CURSOR_REFACTOR_1.md` flipped to ✅; section-4 checklist updated.

---

## 9. Risks & mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| ORM rewrite changes query plan / regresses performance for dashboard | Medium | Capture `EXPLAIN ANALYZE` of the current `text()` queries before Phase 1 (paste into the PR description); compare after. If performance regresses, accept the `text()` as a named pragmatic exception and document it. |
| `DISTINCT ON` translation in SQLAlchemy doesn't match PG output | Medium | Phase-5 PRs run the new ORM query and the old `text()` query against the same fixture and assert identical rowsets. Keep the old query as a fallback constant until the new one is signed off. |
| Existing tests rely on SQLite quirks | Low | New PG integration tests use Testcontainers; existing SQLite-based unit tests remain but no longer cover the SQL itself, only the surrounding Python logic. |
| Bulk DELETE rowcount semantics change | Low | Phase 2 + 3 integration tests assert the returned counts equal the inserted-then-deleted records. |
| Implementer can't run Docker locally (no Testcontainers) | Low | Tests gated by `RUN_PG_TESTS=1`; CI always runs them. Document the env var in `backend/tests/integration/repositories/README.md`. |

---

## 10. References

- `doc/refactoring/CURSOR_REFACTOR_1.md` §3 P3 — origin of this work.
- `backend/repositories/client_data_repository.py` — partially converted
  reference for CTE-driven ORM queries (`_client_data_combined_cte`).
- `backend/repositories/jobs/job_run_repository.py` — destination for
  dashboard SQL; already uses ORM `.delete()` and `.query()` patterns.
- `backend/core/database.py:155-169` — accepted exception
  (`SELECT 1` health check).
- `backend/core/schema_manager.py` — accepted exception (schema
  management).
- `backend/scripts/check_asyncio_run.py` — template for the lint
  script shape and CI wiring.
