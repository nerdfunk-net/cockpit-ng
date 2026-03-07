# Refactoring plan: backend services

This plan updates the original service refactor based on the current codebase state as of 2026-03-07. It focuses on reducing risk while fixing the real architectural problems in `backend/services`, `backend/routers`, and the Celery task entry points.

## 1. goals

- Break large service modules into clear, testable responsibilities.
- Replace import-time service singletons with explicitly factory-managed lifetimes.
- Modernize Nautobot I O to use `httpx` without breaking synchronous task paths.
- Remove local event-loop management from deployment and other async boundaries.
- Keep the existing repository pattern intact for PostgreSQL-backed data.
- Roll out changes in slices that keep routers, tasks, and tests working during the migration.

## 2. key findings from the current codebase

### 2.1 Main findings

1. `NautobotService` in `backend/services/nautobot/client.py` still uses `requests` and `ThreadPoolExecutor`.
2. Many modules call private sync Nautobot methods directly, including task code and helper services. You cannot delete `_sync_graphql_query` and `_sync_rest_request` in the first pass.
3. `AgentDeploymentService` in `backend/services/agents/deployment_service.py` still runs async rendering by creating event loops manually.
4. The same `asyncio.new_event_loop()` pattern appears in many task and background-job modules, not only in agent deployment.
5. `InventoryService` in `backend/services/inventory/inventory.py` mixes at least five concerns:
    - Nautobot device querying.
    - Logical evaluation.
    - Nautobot metadata lookup.
    - Git-backed inventory file persistence.
    - Analysis of saved inventories.
6. Inventory storage already has a PostgreSQL repository and manager layer in `backend/repositories/inventory/inventory_repository.py` and `backend/inventory_manager.py`.
7. Several services depend on package-level exports from `services.*.__init__` modules, so router refactors alone do not remove singleton coupling.
8. `OIDCService` already uses `httpx`, but it caches provider configuration, JWKS data, and SSL contexts. It must remain app-scoped, not request-scoped.
9. The FastAPI app already has a lifespan hook in `backend/main.py`. That is the correct place to manage long-lived async clients.

### 2.2 Constraints

- Do not break Celery workers while refactoring web routes.
- Do not create a second repository abstraction inside `backend/services` for PostgreSQL-backed data.
- Keep compatibility endpoints working until all internal callers migrate.
- Preserve testability by moving construction into factories instead of importing collaborators inside methods.

### 2.3 Non-goals for this plan

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

## 4. revised refactoring phases

### Phase 0: discovery and safety rails

**Goal:** Build a complete migration map before changing behavior.

#### Deliverables

1. Inventory all import-time singleton exports under `backend/services`.
2. Inventory all direct calls to `_sync_graphql_query` and `_sync_rest_request`.
3. Inventory all `asyncio.new_event_loop()` and `run_until_complete()` call sites.
4. Group findings by entry point:
    - FastAPI routers.
    - Celery tasks.
    - Internal helper services.
    - Compatibility endpoints in `backend/main.py`.
5. Capture a migration matrix that marks each caller as migrated, transitional, or blocked.

#### Exit criteria

- Every sync Nautobot caller is known.
- Every singleton import path is known.
- Every manual event-loop call site is known.

---

### Phase 1: Nautobot client modernization and lifecycle

**Primary files:** `backend/services/nautobot/client.py`, new `backend/services/nautobot/sync_client.py`

**Goal:** Split the Nautobot client into two classes with clear ownership, move async I/O to `httpx`, and manage the async client lifetime through the FastAPI lifespan.

#### Design decision: split into two classes

The current `NautobotService` mixes async methods (wrapping sync calls via `ThreadPoolExecutor`) with private sync methods that task code calls directly. This is replaced by two dedicated classes:

- **`NautobotService`** — pure async, owns an `httpx.AsyncClient`, app-scoped, lifespan-managed. Used by FastAPI routers and async services.
- **`NautobotSyncClient`** — pure sync, owns an `httpx.Client` (or `requests`), no lifecycle management. Used by Celery tasks and sync service helpers.

Each class has one HTTP client, one interface style, and one set of callers. Neither leaks into the other's domain. When Phase 6 converts tasks to async, `NautobotSyncClient` is deleted as a unit.

#### Implementation details

1. Rewrite `NautobotService` in `client.py` as pure async using `httpx.AsyncClient`.
    - Replace `requests.post` / `requests.request` with `await self.client.post` / `await self.client.request`.
    - Remove `ThreadPoolExecutor` and all `run_in_executor` calls.
    - Remove the private `_sync_graphql_query`, `_sync_rest_request`, and `_sync_test_connection` methods.
    - Public API: `async def graphql_query(...)`, `async def rest_request(...)`, `async def test_connection(...)`.
2. Create `backend/services/nautobot/sync_client.py` with `NautobotSyncClient`.
    - Contains the sync logic extracted from the removed private methods.
    - Uses `httpx.Client` (preferred) or `requests` — no asyncio dependency.
    - Stateless: constructed per task or per call site, no shared lifecycle.
    - Public API mirrors `NautobotService` but without `async`: `def graphql_query(...)`, `def rest_request(...)`.
3. Decide config lifecycle: `_get_config()` currently reads from the database on every call. For `NautobotService` as an app-scoped singleton, config should be loaded at startup and refreshed only on an explicit settings-change event. `NautobotSyncClient` continues to read config per-call since it has no shared state.
4. Register `NautobotService` startup and shutdown in the existing lifespan hook in `backend/main.py`. Store the instance on `app.state`.
5. Migrate all async callers from `NautobotService()` (per-request construction) to the app-scoped instance via dependency injection.
6. Migrate all sync task callers from `nautobot_service._sync_graphql_query` / `_sync_rest_request` to `NautobotSyncClient().graphql_query` / `.rest_request`.
    - Known callers from Phase 0 inventory: `tasks/export_devices_task.py`, `tasks/scan_prefixes_task.py`, `tasks/execution/backup_executor.py`, `tasks/execution/command_executor.py`, `services/nautobot/configs/config.py`, `services/nautobot/configs/backup.py`, `services/nautobot/ip_addresses/ip_address_query_service.py`.
7. Fix the router bug in `routers/jobs/device_tasks.py` as part of this phase: it constructs `NautobotService()` inline and calls `_sync_graphql_query()` from inside an `async def` handler, blocking the event loop. Migrate it to the async path.
8. Remove the module-level `nautobot_service` singleton from `client.py` after all callers migrate.

#### Important notes

- `NautobotSyncClient` is not a permanent part of the architecture. It is an explicit migration aid. Mark it as such in its module docstring with a reference to Phase 6.
- `tasks/update_ip_prefixes_from_csv_task.py` mixes both patterns: it creates a local `NautobotService()` and also calls `asyncio.run()` on async methods. Migrate it to `NautobotSyncClient` to remove both the local construction and the `asyncio.run()` calls.

#### Exit criteria

- `NautobotService` is pure async using `httpx.AsyncClient`.
- `NautobotSyncClient` exists and is used by all sync task callers.
- The `ThreadPoolExecutor` is gone from `NautobotService`.
- The app-scoped `NautobotService` instance is registered in the FastAPI lifespan.
- No caller constructs `NautobotService()` per-request or per-task.
- No caller calls private `_sync_*` methods on any object.
- The router bug in `routers/jobs/device_tasks.py` is fixed.

---

### Phase 2: composition root and dependency injection

**New files:** `backend/dependencies.py`, `backend/service_factory.py`

**Goal:** Replace import-time singleton construction with explicit service factories and correct lifetimes.

#### Design decision: plain factory functions, no DI library

This codebase uses FastAPI's built-in `Depends()` system, which is already a dependency injection mechanism. Adding a third-party DI library (such as `dependency-injector`) would introduce a second overlapping DI pattern, a learning curve, and declarative wiring that obscures what is actually constructed. Plain factory functions are sufficient for the service graph here and are easier to read and test.

Two files, strict separation:

- **`backend/dependencies.py`** — FastAPI `Depends()` providers only. Imports `fastapi.Request`. Used exclusively by routers. Retrieves app-scoped services from `app.state` and constructs request-scoped services around them.
- **`backend/service_factory.py`** — plain Python factory functions, no FastAPI imports. Used by Celery tasks and any non-router code that needs to construct a service. Tasks must not import from `dependencies.py` because that file depends on FastAPI internals.

`dependencies.py` calls `service_factory.py` internally, not the other way around. This keeps the dependency arrow pointing in one direction.

#### How Celery tasks access services

Celery workers run in separate OS processes with no FastAPI app object. Tasks do not share the app-scoped `NautobotService` instance from `app.state`. Instead:

- During Phases 1–5: sync tasks use `NautobotSyncClient` directly, which has no lifecycle dependency.
- During Phase 6: when a task converts to async, it calls `service_factory.build_nautobot_service()` and uses it within a single `asyncio.run()` call. Each task invocation opens and closes its own short-lived client. There is no pooled connection shared across task invocations in the worker.

#### Implementation details

1. Create `backend/service_factory.py` with factory functions for each service lifetime:
    - Functions that construct app-scoped services from config (used at lifespan startup and by async tasks in Phase 6).
    - Functions that construct request-scoped or task-scoped orchestrators from their dependencies.
2. Create `backend/dependencies.py` with FastAPI `Depends()` providers:
    - App-scoped services are read from `request.app.state` (set during lifespan).
    - Request-scoped services are constructed by calling the corresponding factory function.
3. Wire app-scoped services in the FastAPI lifespan hook in `backend/main.py` using `service_factory` functions.
4. Update routers to declare service dependencies via `Depends()` instead of importing singletons.
5. Keep service construction out of routers and out of task bodies.
6. Migrate package-level `__init__` exports last, after callers use factories instead of imports.

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
- No new code is written that constructs services outside of these two files.

---

### Phase 3: agent deployment and template rendering

**Primary files:**

- `backend/services/agents/deployment_service.py`
- `backend/services/agents/template_render_service.py`
- `backend/routers/agents/deploy.py`
- `backend/tasks/agent_deploy_tasks.py`
- `backend/tasks/execution/deploy_agent_executor.py`

**Goal:** Remove manual event-loop management and unify the deployment workflow across router and task entry points.

#### Implementation details

1. Convert `AgentDeploymentService.deploy()` and `deploy_multi()` to `async def`.
2. Replace `asyncio.new_event_loop()` and `run_until_complete()` with direct `await` calls.
3. Inject `template_manager`, `AgentTemplateRenderService`, git services, and repositories through the constructor.
4. Remove direct `SessionLocal()` creation from `_activate_agent`.
    - Accept a database session or cockpit-agent collaborator from the caller or factory.
5. Refactor `backend/routers/agents/deploy.py` so the direct deploy flow calls the same service instead of reimplementing the workflow.
6. Update task entry points to call the async deployment service through a controlled async boundary.
7. Refactor `AgentTemplateRenderService` in the same phase.
    - Inject inventory resolution, device querying, Nautobot metadata access, and config services.
    - Remove inline imports of singleton collaborators.

#### Important notes

- This phase fixes one important `asyncio.new_event_loop()` hotspot, but it does not eliminate the broader task-level pattern yet.
- Treat this as the first async-boundary cleanup slice, not the only one.

#### Exit criteria

- Agent deployment no longer creates event loops manually.
- Router and task deployment paths share the same orchestration service.
- Template rendering no longer imports singleton collaborators inside methods.

---

### Phase 4: inventory service decomposition

**Primary file:** `backend/services/inventory/inventory.py`

**Goal:** Split the current inventory God Object into clear responsibilities without colliding with the existing repository pattern.

#### Proposed target structure

- `backend/services/inventory/query_service.py`
  - Nautobot device queries.
  - Parsed `DeviceInfo` results.
- `backend/services/inventory/evaluator.py`
  - Logical operation execution.
  - Set intersection and union behavior.
- `backend/services/inventory/metadata_service.py`
  - Custom field definitions.
  - Field value lookups.
  - Custom field type lookups.
- `backend/services/inventory/git_storage_service.py`
  - `save_inventory`.
  - `list_inventories` for Git-backed files.
  - `load_inventory` for Git-backed files.
- `backend/services/inventory/analysis_service.py`
  - `analyze_inventory` for saved PostgreSQL inventories.
- `backend/services/inventory/inventory.py`
  - Thin orchestration facade only.

#### Naming rule

Do not name the Nautobot query component `repository.py`.

This codebase already uses `backend/repositories` for PostgreSQL repositories. The extracted inventory query component is a service or gateway, not a repository in the local database sense.

#### Important boundary

- Keep saved inventory CRUD in `backend/inventory_manager.py` and `backend/repositories/inventory/inventory_repository.py` separate from dynamic Nautobot inventory resolution.
- If saved inventory CRUD later moves into a service layer, it should still use the existing repository classes instead of creating a new service-local repository abstraction.

#### Exit criteria

- Each extracted inventory component has one clear reason to change.
- `InventoryService` becomes a thin facade.
- Saved inventory CRUD and dynamic device resolution stay distinct.

---

### Phase 5: singleton removal by migration slice

**Goal:** Remove import-time singletons in an order that does not strand internal callers.

#### Priority order

1. Router-facing services that already have clear factory paths.
    - `inventory_service`
    - `device_query_service`
    - `checkmk_host_service`
2. Services coupled to the deployment flow.
    - `agent_template_render_service`
    - git service helpers used directly by deployment code
3. App-scoped network clients.
    - `nautobot_service` module-level singleton (already replaced by app-scoped instance in Phase 1)
    - `oidc_service`
4. Lower-priority internal helpers.
    - CheckMK normalization and folder services
    - network scanning services
    - remaining git helper services

#### Implementation details

1. Remove direct singleton imports from routers first.
2. Remove direct singleton imports from task entry points second.
3. Remove package-level singleton exports from `services.*.__init__` modules only after callers migrate.
4. Keep temporary compatibility adapters if needed, but mark them deprecated in the plan and in code comments.

#### Exit criteria

- No router imports a mutable service singleton.
- No task entry point imports a mutable service singleton.
- Package `__init__` modules stop constructing service instances.

---

### Phase 6: broader async-boundary cleanup for Celery and background jobs

**Goal:** Remove manual event-loop creation from the rest of the worker code in controlled slices, and retire `NautobotSyncClient` once all task callers migrate to async.

#### Scope

This phase covers the remaining task and background-job modules that still call `asyncio.new_event_loop()` or `run_until_complete()`, and all remaining callers of `NautobotSyncClient`.

#### Implementation details

1. Start with the highest-volume or highest-risk tasks.
2. For each task, the target pattern is: convert the task's underlying service methods to `async def` and call them through a single standardized async boundary at the task entry point using `asyncio.run()`. Do not use `asyncio.new_event_loop()` or `run_until_complete()` — these are the patterns being replaced.
3. As each task migrates from `NautobotSyncClient` to `NautobotService` (via the app-scoped instance or a factory), update the migration matrix from Phase 0.
4. Delete `backend/services/nautobot/sync_client.py` once the migration matrix shows zero remaining callers.
5. Keep the macOS worker safety constraints from `backend/start_celery.py` in mind during every slice. On macOS, the solo pool means `asyncio.run()` at task entry is safe. On Linux prefork, each forked worker process starts without an event loop, so `asyncio.run()` at task entry is also safe — do not create loops manually.

#### Exit criteria

- Manual event-loop management is isolated to explicitly approved transitional code or removed entirely.
- Worker behavior is stable on macOS and Linux.

---

### Phase 7: tests, rollout, and cleanup

**Goal:** Finish the migration cleanly and prevent regressions.

#### Implementation details

1. Update unit tests to construct services through factories instead of patching singleton symbols.
2. Update tests that patch private Nautobot sync methods.
3. Add focused tests for:
    - FastAPI dependency providers.
    - service factories for Celery tasks.
    - Nautobot client lifecycle.
    - inventory decomposition boundaries.
    - agent deployment without manual event loops.
4. Remove transitional compatibility methods only after tests and call-site inventory confirm they are unused.

#### Exit criteria

- No test relies on deprecated singleton construction.
- No test relies on private Nautobot sync methods that no longer exist.
- Cleanup removes deprecated compatibility code in a final pass.

## 5. implementation order

Use this execution order.

1. Complete Phase 0 and produce the migration matrix.
2. Implement Phase 1: split Nautobot client into `NautobotService` (async) and `NautobotSyncClient` (sync), register lifespan.
3. Implement Phase 2 composition root and dependency providers.
4. Refactor agent deployment and template rendering in Phase 3.
5. Decompose inventory in Phase 4.
6. Remove singletons slice by slice in Phase 5.
7. Clean up the broader task async-boundary issues in Phase 6.
8. Complete final cleanup and test migration in Phase 7.

## 6. rollout checks

### Before coding

- Record all singleton imports, sync Nautobot callers, and manual event-loop callers.
- Confirm the baseline test command and a minimal smoke-test command for routers and Celery paths.

### After Phase 1

- Verify async Nautobot calls still work in router flows.
- Verify transitional sync Nautobot callers still work in task flows.
- Verify client startup and shutdown run through FastAPI lifespan.

### After Phase 2

- Verify router providers resolve the expected service graph.
- Verify Celery tasks can build the same graph through the factory layer.
- Verify `OIDCService` caches still behave as app-scoped state.

### After Phase 3

- Verify single-template and multi-template deployment work end to end.
- Verify template render, git write, git push, and activation still work.
- Verify macOS deployment no longer depends on local event-loop creation in deployment code.

### After Phase 4

- Verify inventory preview through the UI.
- Verify inventory generation still renders correctly.
- Verify Git-backed inventory file save and load flows.
- Verify saved inventory analysis still respects access control.

### After Phase 5

- Verify affected routers no longer import mutable singletons.
- Verify task entry points no longer import mutable singletons.
- Verify compatibility endpoints still work or are intentionally replaced.

### After Phase 6 and Phase 7

- Run the backend test suite.
- Run focused integration tests for Nautobot preview and CheckMK sync.
- Run smoke tests for Celery worker behavior on macOS and Linux.
- Remove deprecated compatibility code only after the migration matrix is fully green.

## 7. success criteria

This refactor is complete when these statements are true.

- Long-lived network clients are app-scoped and lifecycle-managed.
- Routers and tasks build services through one composition root.
- `InventoryService` is a thin orchestration facade.
- Saved inventory CRUD remains aligned with the repository pattern.
- Agent deployment and template rendering no longer create event loops manually.
- Remaining task async-boundary issues are tracked and migrated in explicit slices.
- Import-time service singletons are removed or reduced to temporary compatibility shims with a scheduled removal date.
