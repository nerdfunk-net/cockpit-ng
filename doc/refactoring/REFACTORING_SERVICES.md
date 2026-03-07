# Refactoring plan: backend services

This plan updates the original service refactor based on the current codebase state as of 2026-03-07. It focuses on reducing risk while fixing the real architectural problems in `backend/services`, `backend/routers`, and the Celery task entry points.

## 1. goals

- Break large service modules into clear, testable responsibilities.
- Replace import-time service singletons with explicitly factory-managed lifetimes.
- Modernize Nautobot I/O to use `httpx` without breaking synchronous task paths.
- Remove local event-loop management from deployment and other async boundaries.
- Keep the existing repository pattern intact for PostgreSQL-backed data.
- Roll out changes in slices that keep routers, tasks, and tests working during the migration.

## 2. current state inventory

This section captures the migration baseline. Update these tables as work progresses.

### 2.1 Module-level service singletons (26 total)

| # | Singleton | File | Line |
|---|-----------|------|------|
| 1 | `nautobot_service` | `services/nautobot/client.py` | 256 |
| 2 | `nautobot_metadata_service` | `services/nautobot/__init__.py` | 17 |
| 3 | `offboarding_service` | `services/nautobot/offboarding/service.py` | 133 |
| 4 | `checkmk_service` | `services/checkmk/client.py` | 129 |
| 5 | `checkmk_host_service` | `services/checkmk/host_service.py` | 99 |
| 6 | `config_service` | `services/checkmk/config.py` | 186 |
| 7 | `checkmk_folder_service` | `services/checkmk/folder.py` | 121 |
| 8 | `device_normalization_service` | `services/checkmk/normalization.py` | 720 |
| 9 | `nb2cmk_service` | `services/checkmk/sync/__init__.py` | 176 |
| 10 | `nb2cmk_background_service` | `services/checkmk/sync/background.py` | 433 |
| 11 | `nb2cmk_db_service` | `services/checkmk/sync/database.py` | 378 |
| 12 | `oidc_service` | `services/auth/oidc.py` | 720 |
| 13 | `device_creation_service` | `services/nautobot/devices/creation.py` | 566 |
| 14 | `device_query_service` | `services/nautobot/devices/query.py` | 630 |
| 15 | `inventory_service` | `services/inventory/inventory.py` | 2083 |
| 16 | `git_auth_service` | `services/settings/git/auth.py` | 345 |
| 17 | `git_service` | `services/settings/git/service.py` | 745 |
| 18 | `git_cache_service` | `services/settings/git/cache.py` | 412 |
| 19 | `git_operations_service` | `services/settings/git/operations.py` | 453 |
| 20 | `git_connection_service` | `services/settings/git/connection.py` | 318 |
| 21 | `git_diff_service` | `services/settings/git/diff.py` | 244 |
| 22 | `netmiko_service` | `services/network/automation/netmiko.py` | 472 |
| 23 | `render_service` | `services/network/automation/render.py` | 431 |
| 24 | `network_scan_service` | `services/network/scanning/network_scan.py` | 391 |
| 25 | `scan_service` | `services/network/scanning/scan.py` | 1060 |
| 26 | `agent_template_render_service` | `services/agents/template_render_service.py` | 483 |

### 2.2 Direct `_sync_graphql_query` / `_sync_rest_request` callers (10 problematic)

| # | File | Line | Context | Status |
|---|------|------|---------|--------|
| 1 | `routers/jobs/device_tasks.py` | 422 | async route calling sync — **blocks event loop** | TODO |
| 2 | `services/nautobot/ip_addresses/ip_address_query_service.py` | 61 | sync call in non-async function | TODO |
| 3 | `services/nautobot/ip_addresses/ip_address_query_service.py` | 229 | sync call | TODO |
| 4 | `services/nautobot/ip_addresses/ip_address_query_service.py` | 250 | sync call | TODO |
| 5 | `services/nautobot/configs/config.py` | 197 | sync call | TODO |
| 6 | `services/nautobot/configs/backup.py` | 281 | sync call | TODO |
| 7 | `tasks/export_devices_task.py` | 313 | Celery task | TODO |
| 8 | `tasks/execution/backup_executor.py` | 545 | backup executor | TODO |
| 9 | `tasks/execution/backup_executor.py` | 907 | backup REST | TODO |
| 10 | `tasks/execution/command_executor.py` | 341 | command executor | TODO |
| 11 | `tasks/scan_prefixes_task.py` | 48 | Celery task | TODO |

### 2.3 Manual event-loop call sites (55+ instances across 22 files)

All use the same fallback pattern:
```python
try:
    result = asyncio.run(async_function())
except RuntimeError:
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(async_function())
    finally:
        loop.close()
```

**Background jobs (21 instances):**

| File | Instances |
|------|-----------|
| `services/background_jobs/device_cache_jobs.py` | 6 |
| `services/background_jobs/checkmk_device_jobs.py` | 9 |
| `services/background_jobs/location_cache_jobs.py` | 3 |
| `services/background_jobs/diff_viewer_jobs.py` | 3 |

**Celery tasks (26 instances):**

| File | Instances |
|------|-----------|
| `tasks/import_or_update_from_csv_task.py` | 6 |
| `tasks/update_ip_prefixes_from_csv_task.py` | 4 |
| `tasks/execution/command_executor.py` | 4 |
| `tasks/execution/sync_executor.py` | 5 |
| `tasks/update_ip_addresses_from_csv_task.py` | 3 |
| `tasks/check_ip_task.py` | 2 |
| `tasks/onboard_device_task.py` | 2 |
| `tasks/execution/backup_executor.py` | 2 |
| `tasks/execution/compare_executor.py` | 4 |
| `tasks/execution/cache_executor.py` | 2 |
| `tasks/export_devices_task.py` | 1 |
| `tasks/update_devices_task.py` | 1 |
| `tasks/update_devices_from_csv_task.py` | 1 |
| `tasks/import_devices_task.py` | 1 |

**Services (4 instances):**

| File | Instances |
|------|-----------|
| `services/agents/deployment_service.py` | 2 |
| `services/network/compliance/check.py` | 2 |

**Utilities (2 instances):**

| File | Instances |
|------|-----------|
| `utils/inventory_resolver.py` | 2 |

### 2.4 Constraints

- Do not break Celery workers while refactoring web routes.
- Do not create a second repository abstraction inside `backend/services` for PostgreSQL-backed data.
- Keep compatibility endpoints working until all internal callers migrate.
- Preserve testability by moving construction into factories instead of importing collaborators inside methods.

### 2.5 Non-goals for this plan

- Do not rewrite all services in one pass.
- Do not migrate every singleton in one release.
- Do not merge dynamic Nautobot inventory resolution with saved inventory CRUD.

## 3. service lifetime model

This plan uses three lifetimes.

### 3.1 App-scoped services

Use one shared instance for the process lifetime.

- `NautobotService` after it owns an `httpx.AsyncClient`.
- `OIDCService` because it holds config, JWKS, and SSL caches.
- Any service that owns expensive network clients or long-lived caches.

### 3.2 Request-scoped services

Construct per request through FastAPI dependencies.

- Thin orchestration services.
- Services that only combine app-scoped clients and lightweight collaborators.
- Services that depend on request-only context.

### 3.3 Factory-built task services

Construct through a shared factory for Celery tasks and non-FastAPI entry points.

- Task code cannot use `Depends()`.
- Task services must be built through the same composition root as router services.

## 4. milestone structure

The plan is organized into two shippable milestones, each containing phases that must be completed together. After each milestone, the system is stable and can ship independently.

### Milestone A: foundation (Phases 1-2)

**Ship after completing both phases.** This delivers the composition root and the clean Nautobot client. It eliminates the worst architectural problems.

### Milestone B: decomposition and cleanup (Phases 3-6)

**Phases are independent after Milestone A ships.** Pick the order based on pain. Each phase can ship on its own. No phase in Milestone B depends on another Milestone B phase.

## 5. Milestone A — foundation

### Phase 1: Nautobot client modernization and lifecycle

**Primary files:** `backend/services/nautobot/client.py`, new `backend/services/nautobot/sync_client.py`

**Goal:** Split the Nautobot client into two classes with clear ownership, move async I/O to `httpx`, and manage the async client lifetime through the FastAPI lifespan.

#### Design decision: split into two classes

The current `NautobotService` (257 lines, `client.py:256` singleton) mixes async methods wrapping sync calls via `ThreadPoolExecutor` with private sync methods that task code calls directly. This is replaced by two dedicated classes:

- **`NautobotService`** — pure async, owns an `httpx.AsyncClient`, app-scoped, lifespan-managed. Used by FastAPI routers and async services.
- **`NautobotSyncClient`** — pure sync, owns an `httpx.Client` (or `requests`), no lifecycle management. Used by Celery tasks and sync service helpers.

Each class has one HTTP client, one interface style, and one set of callers. Neither leaks into the other's domain. `NautobotSyncClient` is deleted when Phase 6 converts its callers to async.

#### Config lifecycle decision

The current `_get_config()` reads from the database on every call. For this phase:

- **`NautobotService` (app-scoped):** Keep per-call config reads. Building a settings-change event system is out of scope. The database read is cheap compared to the HTTP call it precedes. Optimize later if profiling shows it matters.
- **`NautobotSyncClient`:** Per-call config reads, same as today.

This avoids a hidden prerequisite that would block the phase.

#### Step-by-step workflow

```
Step 1.1  Create `backend/services/nautobot/sync_client.py`
          - Extract `_sync_graphql_query`, `_sync_rest_request`, `_sync_test_connection`
            from `client.py` into `NautobotSyncClient` as public methods.
          - Use `httpx.Client` (preferred) or keep `requests`.
          - No asyncio dependency. Stateless. Constructed per call site.
          - Add module docstring: "Migration aid. Will be deleted when all callers
            migrate to async (see Phase 6)."
          - DO NOT change any callers yet.

Step 1.2  Migrate all `_sync_*` callers to `NautobotSyncClient`
          - For each caller in section 2.2 above:
            Replace `nautobot_service._sync_graphql_query(...)` with
            `NautobotSyncClient().graphql_query(...)`.
          - Update imports.
          - Run tests after each file.
          Callers (11 call sites in 7 files):
            - routers/jobs/device_tasks.py:422 — ALSO fix the async route bug:
              change this to use the async NautobotService path instead of sync.
            - services/nautobot/ip_addresses/ip_address_query_service.py:61,229,250
            - services/nautobot/configs/config.py:197
            - services/nautobot/configs/backup.py:281
            - tasks/export_devices_task.py:313
            - tasks/execution/backup_executor.py:545,907
            - tasks/execution/command_executor.py:341
            - tasks/scan_prefixes_task.py:48

Step 1.3  Rewrite `NautobotService` in `client.py` as pure async
          - Replace `requests.post` / `requests.request` with
            `await self.client.post` / `await self.client.request`.
          - Remove `ThreadPoolExecutor` and all `run_in_executor` calls.
          - Remove the private `_sync_*` methods (callers migrated in 1.2).
          - Public API: `async def graphql_query(...)`,
            `async def rest_request(...)`, `async def test_connection(...)`.
          - Add `async def startup()` and `async def shutdown()` for
            `httpx.AsyncClient` lifecycle.

Step 1.4  Register `NautobotService` in FastAPI lifespan
          - In `backend/main.py` lifespan hook:
            - Call `nautobot_service.startup()` during startup.
            - Store on `app.state.nautobot_service`.
            - Call `nautobot_service.shutdown()` during shutdown.
          - Keep the module-level singleton for now (callers still import it).
            It will be removed in Phase 2.

Step 1.5  Handle `tasks/update_ip_prefixes_from_csv_task.py`
          - This file mixes both patterns: creates a local `NautobotService()`
            and calls `asyncio.run()` on async methods.
          - Migrate to `NautobotSyncClient` for sync paths.
          - Remove the local `NautobotService()` construction.
          - Remove `asyncio.run()` calls on Nautobot methods.

Step 1.6  Verify
          - Run the full test suite.
          - Smoke test: start the FastAPI app, verify lifespan logs show
            NautobotService startup/shutdown.
          - Smoke test: run a Celery task that uses NautobotSyncClient.
```

#### Exit criteria

- `NautobotService` is pure async using `httpx.AsyncClient`.
- `NautobotSyncClient` exists and is used by all sync task callers.
- The `ThreadPoolExecutor` is gone from `NautobotService`.
- The app-scoped `NautobotService` instance is registered in the FastAPI lifespan.
- No caller calls private `_sync_*` methods on any object.
- The router bug in `routers/jobs/device_tasks.py` is fixed.

---

### Phase 2: composition root and dependency injection

**New files:** `backend/dependencies.py`, `backend/service_factory.py`

**Goal:** Replace import-time singleton construction with explicit service factories and correct lifetimes.

#### Design decision: plain factory functions, no DI library

This codebase uses FastAPI's built-in `Depends()` system, which is already a dependency injection mechanism. Adding a third-party DI library would introduce a second overlapping DI pattern. Plain factory functions are sufficient.

Two files, strict separation:

- **`backend/dependencies.py`** — FastAPI `Depends()` providers only. Imports `fastapi.Request`. Used exclusively by routers. Retrieves app-scoped services from `app.state` and constructs request-scoped services around them.
- **`backend/service_factory.py`** — plain Python factory functions, no FastAPI imports. Used by Celery tasks and any non-router code that needs to construct a service. Tasks must not import from `dependencies.py`.

`dependencies.py` calls `service_factory.py` internally, not the other way around.

#### How Celery tasks access services

Celery workers run in separate OS processes with no FastAPI app object.

- During Phases 1-5: sync tasks use `NautobotSyncClient` directly, which has no lifecycle dependency.
- During Phase 6: when a task converts to async, it calls `service_factory.build_nautobot_service()` and uses it within a single `asyncio.run()` call.

#### Step-by-step workflow

```
Step 2.1  Create `backend/service_factory.py`
          - Factory functions for each service that needs construction:
            - `build_nautobot_service() -> NautobotService`
            - `build_nautobot_sync_client() -> NautobotSyncClient`
            - `build_checkmk_client(site_name) -> CheckMKClient`
              (absorb logic from services/checkmk/client_factory.py)
            - `build_inventory_service() -> InventoryService`
            - `build_device_query_service() -> DeviceQueryService`
          - No FastAPI imports. No global state.
          - Start with the services that routers and tasks use most.
            Add more factory functions as needed in later phases.

Step 2.2  Create `backend/dependencies.py`
          - `get_nautobot_service(request: Request) -> NautobotService`
            reads from `request.app.state.nautobot_service`.
          - `get_inventory_service() -> InventoryService`
            calls `service_factory.build_inventory_service()`.
          - `get_device_query_service() -> DeviceQueryService`
            calls `service_factory.build_device_query_service()`.
          - Start with the providers needed by the routers you migrate first.

Step 2.3  Migrate routers to `Depends()` — start with highest-traffic
          Pick 2-3 routers to migrate first as proof of concept:
          - `routers/jobs/device_tasks.py` (already touched in Phase 1)
          - `routers/inventory/` (uses inventory_service singleton)
          - `routers/nautobot/devices.py` (uses device_query_service)
          For each router:
            - Replace `from services.x import x_service` with
              `x_service: XService = Depends(get_x_service)` in handler signature.
            - Verify tests still pass.
          DO NOT migrate all routers at once. Do 2-3, verify, then continue.

Step 2.4  Migrate task entry points to `service_factory`
          Pick 2-3 tasks to migrate first:
          - `tasks/export_devices_task.py`
          - `tasks/scan_prefixes_task.py`
          - `tasks/execution/backup_executor.py`
          For each task:
            - Replace `from services.x import x_service` with
              `x = service_factory.build_x()` at the start of the task function.
            - Verify tests still pass.

Step 2.5  Wire app-scoped services in lifespan
          - Move `NautobotService` construction from `client.py` module level
            into `main.py` lifespan, using `service_factory.build_nautobot_service()`.
          - Store on `app.state.nautobot_service`.
          - Remove the module-level `nautobot_service = NautobotService()` from
            `client.py`.
          - Update `services/nautobot/__init__.py` exports to remove the singleton
            re-export. Add a deprecation comment pointing to `dependencies.py`
            or `service_factory.py`.

Step 2.6  Migrate remaining routers and tasks
          - Work through the remaining routers and task files.
          - Update `__init__.py` singleton exports only after all their callers
            are migrated.

Step 2.7  Verify
          - Run the full test suite.
          - Verify no router imports a mutable service singleton directly.
          - Verify no task imports a mutable service singleton directly.
          - Smoke test router flows and Celery task flows.
```

#### Lifetime rules

- `NautobotService`: app-scoped in FastAPI; short-lived per `asyncio.run()` call in async tasks (Phase 6).
- `OIDCService`: app-scoped. Holds config, JWKS, and SSL caches. Must not be request-scoped.
- `CheckMKHostService`: request-scoped or factory-built unless it later gains long-lived client state.
- `DeviceQueryService`, `InventoryService`, `AgentDeploymentService`, `AgentTemplateRenderService`: factory-built or request-scoped depending on call path.

#### Exit criteria

- `backend/dependencies.py` and `backend/service_factory.py` exist with clear ownership.
- Routers request services through `Depends()` providers in `dependencies.py`.
- Tasks construct services through factory functions in `service_factory.py`.
- No router and no task body imports a service singleton directly.
- No new code constructs services outside of these two files.

#### Milestone A verification checklist

After Phases 1 and 2 are both complete:

- [ ] `NautobotService` is pure async, app-scoped, lifespan-managed.
- [ ] `NautobotSyncClient` is used by all sync callers.
- [ ] `ThreadPoolExecutor` is gone.
- [ ] Routers use `Depends()` for service injection.
- [ ] Tasks use `service_factory` for service construction.
- [ ] Module-level singletons are removed or marked deprecated with a removal date.
- [ ] All tests pass.
- [ ] Smoke test: start FastAPI, trigger a router flow, trigger a Celery task.

**Ship Milestone A. The system is stable. Phases 3-6 can proceed independently.**

---

## 6. Milestone B — decomposition and cleanup

Phases 3-6 are **independent of each other**. After Milestone A ships, pick the order based on which problems cause the most pain. Each phase ships on its own.

### Phase 3: agent deployment and template rendering

**When to prioritize:** When agent deployment bugs or test failures are blocking work.

**Primary files:**

- `backend/services/agents/deployment_service.py` (2 manual event-loop sites)
- `backend/services/agents/template_render_service.py` (singleton at line 483)
- `backend/routers/agents/deploy.py`
- `backend/tasks/agent_deploy_tasks.py`
- `backend/tasks/execution/deploy_agent_executor.py`

**Goal:** Remove manual event-loop management and unify the deployment workflow across router and task entry points.

#### Step-by-step workflow

```
Step 3.1  Convert `AgentDeploymentService.deploy()` and `deploy_multi()` to async def.
          Replace `asyncio.new_event_loop()` / `run_until_complete()` with await.

Step 3.2  Inject dependencies through the constructor:
          - `template_manager`
          - `AgentTemplateRenderService`
          - git services
          - repositories

Step 3.3  Remove direct `SessionLocal()` creation from `_activate_agent`.
          Accept a database session from the caller or factory.

Step 3.4  Refactor `routers/agents/deploy.py` to call the shared service
          instead of reimplementing the deployment workflow.

Step 3.5  Update task entry points to call the async deployment service
          through `asyncio.run()` at the task boundary.

Step 3.6  Refactor `AgentTemplateRenderService`:
          - Inject inventory resolution, device querying, Nautobot metadata,
            and config services through the constructor.
          - Remove inline imports of singleton collaborators.
          - Add to `service_factory.py` and `dependencies.py`.

Step 3.7  Verify
          - Single-template and multi-template deployment work end to end.
          - Template render, git write, git push, activation still work.
          - No manual event-loop creation in deployment code.
```

#### Exit criteria

- Agent deployment no longer creates event loops manually.
- Router and task deployment paths share the same orchestration service.
- Template rendering no longer imports singleton collaborators inside methods.

---

### Phase 4: inventory service decomposition

**When to prioritize:** When inventory bugs are hard to isolate or test because of the 2,083-line God Object.

**Primary file:** `backend/services/inventory/inventory.py` (2,083 lines)

**Goal:** Split the current inventory God Object into clear responsibilities without colliding with the existing repository pattern.

#### Size check

The current file has five distinct responsibility clusters. Before splitting, verify each cluster is large enough to justify a separate file. If a cluster is under ~80 lines, keep it inline.

#### Proposed target structure

- `backend/services/inventory/query_service.py`
  - 9 `_query_devices_by_*` methods.
  - Parsed `DeviceInfo` results.
- `backend/services/inventory/evaluator.py`
  - `_execute_operation`, `_execute_condition`, `_merge_results`, `_apply_filter`.
  - Logical operation execution.
- `backend/services/inventory/metadata_service.py`
  - `_get_custom_field_types`, `_get_custom_fields_for_device`, `_resolve_custom_field_type`.
  - Custom field definitions and lookups.
- `backend/services/inventory/export_service.py`
  - `export_ansible_inventory`, `export_json_inventory`, `export_csv_inventory`.
  - Export formatting methods.
- `backend/services/inventory/inventory.py`
  - Thin orchestration facade: `preview_inventory()` delegates to the above.

#### Naming rule

Do not name the Nautobot query component `repository.py`. This codebase uses `backend/repositories` for PostgreSQL repositories. The extracted component is a service, not a repository.

#### Important boundary

- Keep saved inventory CRUD in `backend/inventory_manager.py` and `backend/repositories/inventory/inventory_repository.py` separate from dynamic Nautobot inventory resolution.
- If saved inventory CRUD later moves into a service layer, it should still use the existing repository classes.

#### Step-by-step workflow

```
Step 4.1  Extract query methods into `query_service.py`.
          - Move all 9 `_query_devices_by_*` methods.
          - `InventoryService` calls `QueryService` instead of own methods.
          - Run tests.

Step 4.2  Extract evaluator into `evaluator.py`.
          - Move logical operation methods.
          - Run tests.

Step 4.3  Extract metadata methods into `metadata_service.py`.
          - Move custom field methods.
          - Run tests.

Step 4.4  Extract export methods into `export_service.py`.
          - Move export formatting methods.
          - Run tests.

Step 4.5  Clean up `inventory.py` as thin facade.
          - Constructor injects the extracted services.
          - Add to `service_factory.py` and `dependencies.py`.
          - Run tests.

Step 4.6  Verify
          - Inventory preview through the UI works.
          - Inventory generation renders correctly.
          - Git-backed inventory save/load works.
          - Saved inventory analysis respects access control.
```

#### Exit criteria

- Each extracted inventory component has one clear reason to change.
- `InventoryService` becomes a thin facade.
- Saved inventory CRUD and dynamic device resolution stay distinct.
- `inventory.py` is under 200 lines.

---

### Phase 5: async-boundary cleanup for Celery and background jobs

**When to prioritize:** When the fallback event-loop pattern causes bugs or when you need to test task code that uses it.

**Goal:** Replace the 55+ manual event-loop creation sites with a single standardized pattern, and retire `NautobotSyncClient` once all callers migrate.

#### The standard pattern

Every task that needs async should use exactly this:

```python
def my_celery_task():
    result = asyncio.run(_my_async_implementation())
    return result

async def _my_async_implementation():
    # all async work here
    ...
```

No `asyncio.new_event_loop()`. No `run_until_complete()`. No try/except RuntimeError fallback. `asyncio.run()` is safe in both `--pool=solo` (macOS) and `--pool=prefork` (Linux) because each task invocation starts without an existing event loop.

#### Concrete call site list

Work through these groups in order. Each group can ship independently.

**Group A: background jobs (21 instances, 4 files)**

| File | Instances | Notes |
|------|-----------|-------|
| `services/background_jobs/device_cache_jobs.py` | 6 | High-volume, triggered at startup |
| `services/background_jobs/checkmk_device_jobs.py` | 9 | CheckMK sync |
| `services/background_jobs/location_cache_jobs.py` | 3 | Location cache |
| `services/background_jobs/diff_viewer_jobs.py` | 3 | Git diff |

**Group B: executors (17 instances, 5 files)**

| File | Instances | Notes |
|------|-----------|-------|
| `tasks/execution/sync_executor.py` | 5 | Sync operations |
| `tasks/execution/command_executor.py` | 4 | Command execution |
| `tasks/execution/compare_executor.py` | 4 | Comparison |
| `tasks/execution/backup_executor.py` | 2 | Backup operations |
| `tasks/execution/cache_executor.py` | 2 | Cache operations |

**Group C: import/export tasks (17 instances, 7 files)**

| File | Instances | Notes |
|------|-----------|-------|
| `tasks/import_or_update_from_csv_task.py` | 6 | CSV import/update |
| `tasks/update_ip_prefixes_from_csv_task.py` | 4 | IP prefix CSV |
| `tasks/update_ip_addresses_from_csv_task.py` | 3 | IP address CSV |
| `tasks/check_ip_task.py` | 2 | IP checking |
| `tasks/onboard_device_task.py` | 2 | Device onboarding |
| `tasks/export_devices_task.py` | 1 | Device export |
| `tasks/update_devices_task.py` | 1 | Device update |
| `tasks/update_devices_from_csv_task.py` | 1 | CSV device update |
| `tasks/import_devices_task.py` | 1 | Device import |

**Group D: services and utilities (4 instances, 2 files)**

| File | Instances | Notes |
|------|-----------|-------|
| `services/network/compliance/check.py` | 2 | Compliance checks |
| `utils/inventory_resolver.py` | 2 | Inventory resolution |

#### NautobotSyncClient retirement

As each task in Groups A-C migrates from `NautobotSyncClient` to the async `NautobotService` (via `service_factory.build_nautobot_service()`), update the migration status in section 2.2. Delete `backend/services/nautobot/sync_client.py` once no callers remain.

#### Step-by-step workflow (per group)

```
Step 5.N.1  For each file in the group:
            - Replace the try/except RuntimeError fallback with plain asyncio.run().
            - If the file uses NautobotSyncClient, convert to async NautobotService.
            - Run tests after each file.

Step 5.N.2  After all files in the group are converted:
            - Smoke test on macOS (solo pool) and Linux (prefork pool).
            - Ship the group.
```

#### Exit criteria

- No `asyncio.new_event_loop()` or `run_until_complete()` outside of explicitly approved transitional code.
- `NautobotSyncClient` is deleted (zero callers remaining).
- Worker behavior is stable on macOS and Linux.

---

### Phase 6: singleton removal sweep

**When to prioritize:** When testability of service code is the main pain point.

**Goal:** Remove remaining import-time singletons not already handled by Phases 1-5.

This phase is mechanical: for each singleton, add a factory function, update callers to use injection, remove the module-level instance.

#### Priority order

1. **Router-facing services** (already have clear factory paths from Phase 2):
   - `inventory_service`, `device_query_service`, `checkmk_host_service`
2. **Deployment flow services** (if Phase 3 hasn't already handled them):
   - `agent_template_render_service`, git service helpers
3. **App-scoped network clients**:
   - `nautobot_service` module-level singleton (should be gone after Phase 2)
   - `oidc_service` — move to `app.state`, keep app-scoped lifetime
4. **Lower-priority internal helpers**:
   - CheckMK normalization and folder services
   - network scanning services
   - remaining git helper services

#### Step-by-step workflow

```
Step 6.1  For each singleton in priority order:
          - Add a factory function to `service_factory.py`.
          - Add a `Depends()` provider to `dependencies.py` if routers use it.
          - Update all callers (routers → Depends, tasks → service_factory).
          - Remove the module-level singleton.
          - Remove the `__init__.py` re-export if present.
          - Run tests.

Step 6.2  After each priority group, verify:
          - Affected routers still work.
          - Affected tasks still work.
          - No import errors from removed exports.
```

#### Exit criteria

- No router imports a mutable service singleton.
- No task entry point imports a mutable service singleton.
- Package `__init__` modules stop constructing service instances.

---

## 7. tests and cleanup

This is not a separate phase. Testing happens continuously:

- **During each step:** Run relevant tests after every file change.
- **After each phase:** Run the full test suite.
- **After Milestone A:** Full smoke test of router and Celery paths.
- **After each Milestone B phase:** Targeted integration test for the affected domain.

### Test migration checklist

As singletons are removed:

- [ ] Update unit tests that patch singleton symbols to patch factory functions instead.
- [ ] Update tests that patch `_sync_graphql_query` / `_sync_rest_request` to use `NautobotSyncClient` or mock the async client.
- [ ] Add focused tests for FastAPI dependency providers (verify correct service is resolved).
- [ ] Add focused tests for `service_factory` functions (verify correct construction).

### Final cleanup (after all Milestone B phases complete)

- [ ] Remove `NautobotSyncClient` if Phase 5 hasn't already.
- [ ] Remove deprecated compatibility exports from `__init__.py` files.
- [ ] Remove the CheckMK `client_factory.py` (absorbed into `service_factory.py`).
- [ ] Grep for any remaining `asyncio.new_event_loop` — should be zero.
- [ ] Grep for any remaining `_sync_graphql_query` / `_sync_rest_request` — should be zero.

## 8. implementation order summary

```
MILESTONE A (ship together)
│
├── Phase 1: Nautobot client split + httpx + lifespan
│   ├── 1.1  Create NautobotSyncClient
│   ├── 1.2  Migrate _sync_* callers (11 call sites, 7 files)
│   ├── 1.3  Rewrite NautobotService as pure async
│   ├── 1.4  Register in FastAPI lifespan
│   ├── 1.5  Fix update_ip_prefixes_from_csv_task.py
│   └── 1.6  Verify
│
├── Phase 2: Composition root + DI
│   ├── 2.1  Create service_factory.py
│   ├── 2.2  Create dependencies.py
│   ├── 2.3  Migrate 2-3 routers (proof of concept)
│   ├── 2.4  Migrate 2-3 tasks (proof of concept)
│   ├── 2.5  Wire app-scoped services in lifespan, remove singleton
│   ├── 2.6  Migrate remaining routers and tasks
│   └── 2.7  Verify
│
└── ✅ SHIP — system is stable, all tests pass
    │
    ▼
MILESTONE B (phases are independent, pick order by pain)
│
├── Phase 3: Agent deployment + template rendering
│   └── Remove 2 manual event-loop sites, unify deploy workflow
│
├── Phase 4: Inventory decomposition
│   └── Split 2,083-line God Object into ~5 focused services
│
├── Phase 5: Async-boundary cleanup
│   ├── Group A: background jobs (21 instances, 4 files)
│   ├── Group B: executors (17 instances, 5 files)
│   ├── Group C: import/export tasks (17 instances, 7 files)
│   └── Group D: services/utilities (4 instances, 2 files)
│
└── Phase 6: Singleton removal sweep
    └── Remove remaining 20+ singletons not handled by Phases 1-5
```

## 9. success criteria

This refactor is complete when these statements are true.

- Long-lived network clients are app-scoped and lifecycle-managed.
- Routers and tasks build services through one composition root.
- `InventoryService` is a thin orchestration facade.
- Saved inventory CRUD remains aligned with the repository pattern.
- Agent deployment and template rendering no longer create event loops manually.
- No `asyncio.new_event_loop()` or `run_until_complete()` remains in task code.
- Import-time service singletons are removed.
- `NautobotSyncClient` is deleted.
