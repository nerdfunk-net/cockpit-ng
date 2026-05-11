# CURSOR_ASYNC_PLAN — Async/blocking and `asyncio.run` refactoring

This document is an **implementation-ready plan** to address:

1. **`async def` FastAPI routes that execute long-running or blocking synchronous work** on the asyncio event loop (starving other requests on the same worker).
2. **`asyncio.run(...)` used from code that may run under an already-running event loop**, or from contexts where loop lifecycle and Celery pool model interact badly.

It is written so a developer (or agent) can execute work **in small, verifiable steps** without repeating a “big bang” refactor that destabilized the app previously.

**Related:** `doc/refactoring/CURSOR_REFACTOR_1.md` (broader backend cleanup). This file focuses **only** on async/blocking and `asyncio.run`.

---

## 1. Background (why this matters)

### 1.1 FastAPI / Starlette execution model

| Route signature | Where it runs | Blocking `time.sleep` / sync Redis / sync DB wait |
|-----------------|---------------|---------------------------------------------------|
| `async def`     | **Event loop thread** (cooperative multitasking) | **Blocks the entire loop** for that worker until the call returns. Other `async` requests on the same worker wait. |
| `def` (sync)    | **Thread pool** (default `anyio.to_thread`) | Blocks **one thread**, not the event loop. Throughput limited by thread pool size, not by starving every coroutine. |

**Implication:** If a handler is declared `async def` but does not `await` I/O and instead calls blocking APIs, that is a **design bug** for production concurrency.

### 1.2 `asyncio.run(coro)`

- `asyncio.run` creates a **new** event loop, runs `coro`, then closes the loop.
- **Safe** when called from a **sync** entrypoint with **no** running loop (e.g. `if __name__ == "__main__"`, or a Celery task body that is guaranteed sync and not nested).
- **Unsafe / fragile** when the same function might be called:
  - from an **`async def` route**,
  - from **middleware** or **dependencies** running on the loop,
  - or from code that **sometimes** runs inside another loop (nested `asyncio.run` → `RuntimeError` in Python 3.10+).

### 1.3 Celery + asyncio (project-specific)

`backend/start_celery.py` documents that on **macOS**, the worker uses the **`solo`** pool partly because **`asyncio.run()` / `new_event_loop()` interact badly with `fork()`** in prefork workers. On **Linux**, **prefork** is used.

**Implication:** Refactors that touch `asyncio.run` inside tasks must be validated on **both** pool types (or at least on the deployment target), not only on a developer Mac in solo mode.

### 1.4 Current documented pattern

`backend/services/nautobot/client.py` states that `NautobotService` is async and that **Celery tasks use `asyncio.run()`** to call it. That is an intentional bridge today; the plan below **replaces or constrains** that pattern without assuming all call sites can become async overnight.

---

## 2. Goals and non-goals

### 2.1 Goals

1. **No long blocking work on the event loop** for endpoints that matter for concurrency (agent wait, large sync CPU, blocking Redis pub/sub loops, etc.).
2. **No `asyncio.run` from code paths reachable from FastAPI `async def` routes** (or from sync routes that are already inside a worker thread in a ambiguous way — rare, but grep-driven).
3. **Predictable behavior** under Celery **solo** (macOS) and **prefork** (Linux).
4. **Small PRs** with tests and rollback points.

### 2.2 Non-goals (initial phases)

- Rewriting the entire codebase to `redis.asyncio` + fully async SQLAlchemy 2 style (optional later phase).
- Changing public API contracts (paths, JSON shapes) unless strictly necessary.
- Replacing `asyncio.run` in **CLI scripts** (`backend/scripts/*.py`) in the first wave — lowest risk if left as-is.

---

## 3. Inventory procedure (do this first, commit results)

### 3.1 Blocking `async def` routes

**Step A — List async route modules**

```bash
cd backend
rg -l "async def" routers/
```

**Step B — Manual triage (per file or per route)**

For each `async def` endpoint, record:

| Column | Question |
|--------|----------|
| Await? | Does the body **await** any I/O, or is it sync-only? |
| Block? | Any of: `redis` sync client, `requests`, `time.sleep`, sync `Session` queries, `subprocess`, file read/write heavy, `CockpitAgentService.wait_for_response`, etc.? |
| Duration | Typical p99 duration (ms / s) — rough estimate from logs or code. |

**Known high-priority example (from prior review):**

- `backend/routers/cockpit_agent.py` — `async def` + `CockpitAgentService` sync Redis pub/sub / blocking wait.

**Additional pattern:** `async def` routes that only call sync services/repositories with **no** `await` are still **blocking the loop** for the duration of those calls.

**Deliverable:** A short markdown table or spreadsheet: `router_file`, `function_name`, `blocking_yes_no`, `mitigation_choice` (see section 5).

### 3.2 All `asyncio.run(` call sites

**Command:**

```bash
cd backend
rg "asyncio\\.run\\(" -g'*.py' --no-heading
```

**Snapshot at plan authoring time** (regroup when executing; paths may drift):

| Bucket | Files (representative) |
|--------|-------------------------|
| **Tasks / executors** | `tasks/update_devices_task.py`, `update_devices_from_csv_task.py`, `update_ip_addresses_from_csv_task.py`, `import_devices_task.py`, `export_devices_task.py`, `csv_export_task.py`, `check_ip_task.py`, `agent_deploy_tasks.py`, `tasks/execution/*.py` |
| **Services (sync façade calling async)** | `services/nautobot/onboarding/onboarding_service.py`, `services/nautobot/imports/prefix_update_service.py`, `services/nautobot/imports/csv_import_service.py`, `services/nautobot/configs/backup.py`, `services/nautobot/configs/config.py`, `services/nautobot/ip_addresses/ip_address_query_service.py`, `services/network/scanning/prefix_scan_service.py`, `services/network/compliance/check.py` |
| **Background jobs** | `services/background_jobs/*.py` |
| **Utils** | `utils/inventory_resolver.py` |
| **Scripts (CLI)** | `scripts/locations2checkmk/sync.py`, `scripts/import_racks/import_locations.py`, `scripts/clear_racks/clear_racks.py` |
| **Worker entry** | `start_celery.py` (comments only — verify no accidental use) |

**Step C — Classify each call site**

| Class | Meaning | Refactor priority |
|-------|---------|-------------------|
| **H0** | Reachable from **HTTP** (`routers/` → service → `asyncio.run`) | **P0 — must fix or prove unreachable** |
| **H1** | **Only** Celery task / executor body, sync function, **solo or prefork** worker | **P1 — fix with Celery-safe pattern** |
| **H2** | **CLI script** `if __name__` | **P3 — optional** |

**Deliverable:** CSV or table: `file:line`, `class H0/H1/H2`, `caller_chain` (one sentence).

---

## 4. Risk mitigation principles (avoid “refactor then nothing runs”)

These are **non-negotiable** for this effort:

1. **One vertical slice per PR** (e.g. “cockpit_agent only” or “onboarding_service + its tests only”), not 30 files.
2. **Preserve behavior first**, performance second: same status codes, same JSON where possible.
3. **Do not pass SQLAlchemy `Session` across threads** without explicit design (see 5.4). Prefer “entire request handled in one thread” for phase 1.
4. **Test matrix:**
   - **Local:** hit changed endpoints + run targeted `pytest`.
   - **Celery:** run at least one affected task on **Linux prefork** (CI or Docker) if production is Linux; document if Mac-only validation is insufficient.
5. **Feature flag (optional):** for risky path splits, e.g. `USE_ASYNC_COCKPIT_AGENT=0` defaulting to old behavior until validated — only if the team accepts env-based toggles.
6. **Rollback:** each PR revertible; avoid merging “half” of a two-part change across releases.

---

## 5. Mitigation strategies (choose per endpoint / per call site)

### 5.1 Strategy S1 — **`async def` → `def`** (lowest code churn for blocking routes)

**When:** Route does **not** need `await` for its main work; body is sync blocking (Redis wait, sync service).

**How:**

1. Change handler from `async def endpoint(...):` to `def endpoint(...):`.
2. Remove spurious `async` from inner helpers only if they are route-local and unused elsewhere.
3. Keep dependencies (`Depends(get_db)`) — FastAPI supports sync routes with sync dependencies.

**Pros:** Minimal logic change; Starlette runs sync route in thread pool → **event loop stays free**.

**Cons:** Uses worker thread pool; under extreme concurrency, tune thread limits / worker count. Still usually **much safer** than blocking the loop.

**Acceptance:** Load test: N parallel “cheap” requests remain fast while M “slow” blocking requests run (see section 7).

### 5.2 Strategy S2 — **Keep `async def`, offload blocking block only**

**When:** Route must stay async (mixed await + one blocking call).

**How:**

- Wrap **only** the blocking call in `anyio.to_thread.run_sync` / `asyncio.to_thread` (Python 3.9+), with clear timeout policy.
- **Do not** pass `Session` into the thread without read-only snapshot or detached ORM pattern.

**Pros:** Single route stays async.

**Cons:** Easier to get wrong (session/thread); use **only** when S1 is impossible.

### 5.3 Strategy S3 — **Async I/O end-to-end** (later, higher reward / higher cost)

**When:** Hot path, long-lived connections, many concurrent waits.

**How:** e.g. `redis.asyncio`, async httpx usage, async SQLAlchemy — **out of scope for phase 1** unless one team owns the full migration.

### 5.4 Strategy S4 — **`asyncio.run` elimination / replacement**

Pick **one** pattern per subsystem (do not mix randomly).

| Sub-pattern | Description | When to use |
|-------------|-------------|--------------|
| **S4a — `def` route + sync service + `asyncio.run` in Celery only** | HTTP never calls `asyncio.run`; tasks keep a **single** top-level `asyncio.run` wrapping the whole async unit of work | Celery-only code; task entry is sync |
| **S4b — `async def` route + `await nautobot_service.graphql_query`** | Use **`request.app.state.nautobot_service`** (or injected async client) that is already started in lifespan | HTTP paths that need Nautobot |
| **S4c — Sync wrapper client** | Thin **sync** `requests`/`httpx.Client` wrapper used only from Celery/sync code; async `NautobotService` remains for FastAPI | Avoids `asyncio.run` in tasks entirely; duplication cost |
| **S4d — Celery async tasks** | If Celery version and worker pool support native async tasks, migrate task body to `async def` and `await` | Requires infra verification; bigger change |

**Critical rule:** After refactor, **grep** must show **no** `asyncio.run` on any path starting from `async def` routers.

### 5.5 Onboarding / `_get_device_id_from_ip` (concrete H0 risk)

`backend/services/nautobot/onboarding/onboarding_service.py` uses `asyncio.run(self._async_get_device_id(...))`.

**Implementation steps:**

1. Trace **all callers** of `_get_device_id_from_ip` / public methods that use it (jobs router, Celery tasks, etc.).
2. If **any** caller is async HTTP: **remove `asyncio.run`** — either make caller `await` a fully async method, or use **S4c** sync Nautobot query for that code path only.
3. If **only** Celery: keep one outer `asyncio.run` at **task** boundary **or** use S4d / S4c.

---

## 6. Phased execution plan (ordered)

### Phase 0 — Preparation (0.5–1 day)

- [ ] Run inventory sections 3.1–3.2; commit `doc/refactoring/CURSOR_ASYNC_INVENTORY.md` (optional) or attach tables to the PR.
- [ ] Agree p95/p99 SLO for one “cheap” endpoint under load with slow endpoints in flight (section 7).
- [ ] Confirm production Celery pool: prefork vs solo; CI OS.

### Phase 1 — HTTP event loop (P0)

**Objective:** Remove **blocking** work from **`async def`** routes that are user-facing or long.

1. [ ] **`cockpit_agent` router** (`backend/routers/cockpit_agent.py`):
   - Apply **S1** (`def` for endpoints that call `wait_for_response`, `send_git_pull`, etc.) **or** redesign to “enqueue + poll” only async returns (larger product change — defer unless required).
   - Verify auth dependencies still work (they do for sync routes).
2. [ ] **Grep triage:** any other `async def` in `routers/` that imports blocking agent/redis/netmiko code without `await` — same treatment.

**Exit criteria:** Under a simple concurrency script (section 7), baseline “cheap” endpoint latency does not collapse when agent endpoints run.

### Phase 2 — `asyncio.run` reachable from HTTP (P0)

**Objective:** Eliminate nested-loop / wrong-context failures.

1. [ ] From inventory **H0** list: for each chain, either:
   - move `await` to router using app-scoped async services, or
   - provide sync-only service for that path (**S4c**), or
   - change router to **`def`** and call sync stack that does not use `asyncio.run`.
2. [ ] **Re-grep:** `rg "asyncio\\.run\\(" routers/` → should be **empty** (or allow-listed with comment + test).

### Phase 3 — Celery tasks and executors (P1)

**Objective:** Single, documented asyncio boundary per task; no surprise nested `asyncio.run`.

1. [ ] For each file under `tasks/` and `tasks/execution/`:
   - Prefer **one** `asyncio.run(main_async())` wrapping the whole async workflow per task invocation, **or** migrate to Celery async tasks if supported.
2. [ ] Remove **scattered** `asyncio.run` for each tiny GraphQL call where possible — batch into one async helper called once.
3. [ ] Run tasks on **Docker Linux** CI job mirroring production prefork.

**Exit criteria:** Task integration tests pass; no `RuntimeError: asyncio.run() cannot be called from a running event loop` in staging logs.

### Phase 4 — Sync services that call `asyncio.run` internally (P1–P2)

**Files:** `services/nautobot/imports/*`, `services/network/*`, `utils/inventory_resolver.py`, etc.

**Objective:** Either:

- callers are **only** Celery → document and keep one loop boundary, **or**
- split **HTTP-safe** API vs **worker-only** API so static analysis / grep stays clean.

### Phase 5 — Scripts and docs (P3)

- [ ] Leave `asyncio.run(async_main())` in CLI scripts or replace with `uv run` / explicit entry — low risk.
- [ ] Update `NautobotService` class docstring in `client.py` once the canonical Celery pattern is no longer “always asyncio.run per call”.

---

## 7. Testing and verification playbook

### 7.1 Concurrency smoke (required after Phase 1)

**Purpose:** Prove the event loop is not starved.

**Procedure (example):**

1. Start API locally with **one** uvicorn worker (worst case for loop blocking).
2. Terminal A: loop `curl -s -o /dev/null -w "%{time_total}\n" http://127.0.0.1:8000/health` (or `/`) in parallel (e.g. 20 concurrent curls).
3. Terminal B: trigger one long-running cockpit-agent endpoint (or mock slow dependency).
4. **Pass:** cheap endpoint times stay roughly stable (define threshold, e.g. median `< 200ms` while slow runs).
5. **Fail (before fix):** cheap endpoint times spike to multi-second.

**Automation (optional):** add `pytest` + `httpx.AsyncClient` + `asyncio` tasks, or a small script under `backend/scripts/` (not enabled in prod).

### 7.2 Unit / integration tests

- For each changed route: at least one test that calls the endpoint with `TestClient` (sync client is fine for `def` routes).
- For changed Celery path: run task with eager mode or integration fixture if the project already supports it.

### 7.3 Regression grep (CI-friendly)

Add a **scheduled** or **manual** CI step:

```bash
# Example policy checks (tune allow-lists as debt burns down)
rg "asyncio\\.run\\(" backend/routers && exit 1 || true
```

(Strict mode: fail CI if any match in `routers/`.)

---

## 8. Rollback and PR sizing

| PR size | Contents | Rollback |
|---------|----------|----------|
| **XS** | One router file: `async def` → `def` only | Single revert |
| **S** | One service: remove `asyncio.run` for one method + caller update | Single revert |
| **M** | One Celery executor file: consolidate `asyncio.run` | Single revert |
| **L** | Multi-package async migration | **Avoid** until XS/S/M stable |

---

## 9. Definition of done (global)

- [ ] Inventory tables completed and reviewed.
- [ ] No **blocking** work identified in triage remains on **`async def`** routes without mitigation (S1/S2/S3).
- [ ] `rg "asyncio\\.run\\(" backend/routers` → **zero** matches (or documented exceptions with tests).
- [ ] Celery-sensitive changes validated on **Linux + prefork** (or documented waiver).
- [ ] Concurrency smoke (7.1) documented with numbers before/after in PR description.
- [ ] `ruff check` and targeted `pytest` green.

---

## 10. Appendix — Reference commands

```bash
cd backend

# Async routes
rg "async def" routers/ -n

# asyncio.run usage
rg "asyncio\.run\(" -g'*.py' -n

# Optional: find async routes that never use await (heuristic — review manually)
# (no one-line rg is perfect; use triage table)
```

---

## 11. Appendix — Files called out explicitly in this plan

| File | Issue | Phase |
|------|-------|-------|
| `backend/routers/cockpit_agent.py` | `async def` + blocking agent/Redis wait | 1 |
| `backend/services/nautobot/onboarding/onboarding_service.py` | `asyncio.run` in service | 2 / 4 |
| `backend/services/nautobot/client.py` | Doc says Celery uses `asyncio.run` per call — revise after pattern change | 5 |
| `backend/start_celery.py` | Pool choice vs asyncio — re-read after task changes | 3 |
| `backend/tasks/execution/*.py` | Many `asyncio.run` sites | 3 |
| `backend/utils/inventory_resolver.py` | `asyncio.run` | 2 or 4 (classify H0/H1) |

---

*End of CURSOR_ASYNC_PLAN — execute phases in order; update inventory tables when file list changes.*
