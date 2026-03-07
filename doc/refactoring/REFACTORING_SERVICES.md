# Refactoring Plan: Backend Services

This document details the comprehensive refactoring plan for the Cockpit-NG `backend/services` module to resolve architectural technical debt, Single Responsibility Principle violations, and Dependency Injection issues identified during code analysis.

## 1. Goal & Objectives
* Break down God Objects (e.g., `inventory.py`) into cohesive domains.
* Replace file-level singletons with robust dependency injection via FastAPI `Depends()`.
* Standardize on modern async clients (`httpx`) to remove unnecessary `ThreadPoolExecutor` usage.
* Separate repository concerns (data fetching) from business logic evaluation.
* Eliminate `asyncio.new_event_loop()` anti-pattern that causes macOS Celery SIGSEGV crashes.

---

## 2. Current State Assessment (Updated 2026-03-07)

### 2.1 Singleton Inventory

The codebase has **25+ global singleton instances** defined at module level. The following are the primary targets for DI migration. Full list:

| File | Singleton variable |
|---|---|
| `services/nautobot/client.py` | `nautobot_service` |
| `services/auth/oidc.py` | `oidc_service` |
| `services/inventory/inventory.py` | `inventory_service` |
| `services/checkmk/host_service.py` | `checkmk_host_service` |
| `services/checkmk/client.py` | `checkmk_service` |
| `services/checkmk/folder.py` | `checkmk_folder_service` |
| `services/checkmk/config.py` | `config_service` |
| `services/nautobot/devices/query.py` | `device_query_service` |
| `services/nautobot/devices/creation.py` | `device_creation_service` |
| `services/agents/template_render_service.py` | `agent_template_render_service` |
| `services/settings/git/service.py` | `git_service` |
| `services/settings/git/auth.py` | `git_auth_service` |
| `services/settings/git/cache.py` | `git_cache_service` |
| `services/settings/git/connection.py` | `git_connection_service` |
| `services/settings/git/diff.py` | `git_diff_service` |
| `services/settings/git/operations.py` | `git_operations_service` |
| `services/settings/git/shared_utils.py` | `git_repo_manager` |
| `services/network/scanning/network_scan.py` | `network_scan_service` |
| `services/network/scanning/scan.py` | `scan_service` |
| `services/network/automation/netmiko.py` | `netmiko_service` |
| `services/network/automation/render.py` | `render_service` |
| `services/checkmk/normalization.py` | `device_normalization_service` |
| `services/nautobot/offboarding/service.py` | `offboarding_service` |

### 2.2 Key Technical Debt Items

1. **`NautobotService` (client.py):** Uses `requests` (sync) wrapped in `ThreadPoolExecutor` — still present, unaddressed.
2. **`AgentDeploymentService` (deployment_service.py):** `deploy()` and `deploy_multi()` are sync methods that call async render code via `asyncio.new_event_loop()` — this is the exact cause of macOS Celery SIGSEGV crashes.
3. **`InventoryService` (inventory.py):** 2083-line God Object — still present, unaddressed.
4. **`backend/dependencies.py`:** Does not exist yet. Router path is `backend/routers/`, not `backend/api/routers/`.
5. **`OIDCService` (oidc.py):** Already uses `httpx.AsyncClient` — does NOT need the Phase 1 migration. Still has global singleton `oidc_service`.

---

## 3. Refactoring Phases

### Phase 1: Nautobot Client Modernization (Fast/Low Risk)
**File:** `backend/services/nautobot/client.py`
**Overview:** `NautobotService` relies on synchronous `requests` and executes network I/O in a `ThreadPoolExecutor`. This adds overhead and complexity (manual shutdown logic). Replace with `httpx.AsyncClient`.

> **Note:** `OIDCService` already uses `httpx` natively and does NOT need this migration.

#### Implementation Details:
1. **Client Replacement:** Replace `import requests` with `import httpx`. Remove `from concurrent.futures import ThreadPoolExecutor`.
2. **Initialization:** Remove `self.executor = ThreadPoolExecutor(max_workers=4)` and `self._shutdown`. Instantiate `self._client = httpx.AsyncClient(verify=verify_ssl, timeout=timeout)` lazily or via `__aenter__`.
3. **Migrate GraphQL Logic:** Delete `_sync_graphql_query`. Update `graphql_query` from thread-executor delegation to direct `await self._client.post(...)`. Handle errors via `httpx.HTTPStatusError`.
4. **Migrate REST Logic:** Delete `_sync_rest_request`. Update `rest_request` to direct `await self._client.request(method, ...)`. Migrate `test_connection` / `_sync_test_connection` similarly.
5. **Clean up Lifecycle Methods:** Remove `__del__`, `shutdown()`. Implement `__aenter__` / `__aexit__` to open/close the `httpx.AsyncClient` session.
6. **Update Callers:** Search all usages of `nautobot_service.graphql_query` / `nautobot_service.rest_request`. They are already `await`ed — verify nothing calls them synchronously. Key callers: `inventory.py`, `devices/query.py`, `devices/creation.py`.

---

### Phase 2: AgentDeploymentService Async & DI Fix (Medium Risk)
**File:** `backend/services/agents/deployment_service.py`
**Overview:** The original plan called for creating a `GitService` — this is already done (`backend/services/settings/git/service.py`). The remaining problems are:
- `deploy()` and `deploy_multi()` are **synchronous** methods that call async render code using `asyncio.new_event_loop()` (lines 228–241 and 546–547). This is the same anti-pattern that causes macOS Celery SIGSEGV crashes.
- The `__init__` method imports and stores global singletons (`template_manager`, `agent_template_render_service`, `git_service`) instead of receiving them as injected dependencies.
- `_activate_agent` creates a raw `SessionLocal()` DB session internally, bypassing DI.

#### Implementation Details:
1. **Convert to async:** Change `deploy()` and `deploy_multi()` from `def` to `async def`. Replace the `asyncio.new_event_loop()` / `loop.run_until_complete()` blocks with direct `await self.agent_template_render_service.render_agent_template(...)` calls. Remove the `loop.close()` cleanup.
2. **Inject dependencies via constructor:** Update `__init__` to accept `template_manager`, `agent_template_render_service`, and `git_service` as explicit parameters instead of importing global singletons inside `__init__`. This enables mocking in tests.
3. **Fix `_activate_agent`:** Change the method signature to accept a `db` session parameter, removing the internal `SessionLocal()` creation. The caller (router or task) becomes responsible for the DB session lifecycle.
4. **Update Celery task callers:** The Celery background tasks calling `deploy()` / `deploy_multi()` must switch from `service.deploy(...)` to `asyncio.run(service.deploy(...))` or restructure the task as `async def` using an async-compatible Celery worker setup.

---

### Phase 3: Inventory Service God Object Breakdown (High Risk)
**File:** `backend/services/inventory/inventory.py` (2083 lines)
**Overview:** This file handles GraphQL querying, Ansible logic tree building, AND/OR evaluation, string interpolation, REST API fetching for field values, and CRUD persistence. Splitting it allows independent testing of each concern.

#### Current method inventory:
- **Query methods (Repository):** `_query_all_devices`, `_query_devices_by_name`, `_query_devices_by_location`, `_query_devices_by_role`, `_query_devices_by_status`, `_query_devices_by_tag`, `_query_devices_by_devicetype`, `_query_devices_by_manufacturer`, `_query_devices_by_platform`, `_query_devices_by_has_primary`, `_query_devices_by_custom_field`, `_parse_device_data`
- **Evaluator (Logic):** `_execute_operation`, `_execute_condition`, `_intersect_sets`, `_union_sets`
- **Metadata (REST lookups):** `get_custom_fields`, `get_field_values`, `_get_custom_field_types`
- **Orchestration/CRUD:** `preview_inventory`, `generate_inventory`, `save_inventory`, `list_inventories`, `load_inventory`, `analyze_inventory`

#### Implementation Details:
1. **Extract Repository (`backend/services/inventory/repository.py`):**
   * Create class `NautobotInventoryRepository(nautobot_client: NautobotService)`.
   * Move all `_query_*` methods and `_parse_device_data` here.
   * The repository interface returns raw `List[DeviceInfo]`.
2. **Extract Evaluator (`backend/services/inventory/evaluator.py`):**
   * Create class `InventoryEvaluator()`.
   * Move `_intersect_sets`, `_union_sets`, `_execute_condition`, `_execute_operation` here.
   * The evaluator receives the repository as a parameter to `execute(operations, repository)`.
3. **Extract Metadata Service (`backend/services/inventory/metadata_service.py`):**
   * Create class `InventoryMetadataService(nautobot_client: NautobotService)`.
   * Move `get_custom_fields`, `get_field_values`, `_get_custom_field_types` here.
   * This concern is currently missing from the original plan but represents significant standalone functionality (~500 lines).
4. **Refactor `InventoryService` Orchestrator:**
   * Keep `InventoryService` as a thin facade requiring `repository: NautobotInventoryRepository`, `evaluator: InventoryEvaluator`, and `metadata_service: InventoryMetadataService` in its constructor.
   * Retain only `preview_inventory`, `generate_inventory`, `save_inventory`, `list_inventories`, `load_inventory`, `analyze_inventory`.

---

### Phase 4: Dependency Injection & Singleton Removal (Global Impact)
**Goal:** Replace the 25+ global module-level singletons with proper FastAPI dependency injection.

> **Note:** The target file is `backend/dependencies.py` (not `backend/api/dependencies.py`), since the router directory is `backend/routers/`, not `backend/api/routers/`.

#### Implementation Details:
1. **Prioritize by impact:** Focus Phase 4 on the services that are directly used in routers. The following singletons are imported in `backend/routers/`:
   - `inventory_service` (from `routers/inventory/inventory.py`)
   - `device_query_service` (from `routers/inventory/inventory.py`)
   - `checkmk_host_service`, `oidc_service` (from auth routers)

2. **Remove Singletons:** Delete global instantiations in target service files. Start with `inventory_service`, `nautobot_service`, `oidc_service`, `checkmk_host_service`, `device_query_service`.

3. **Create DI Providers (`backend/dependencies.py`):**
   ```python
   from fastapi import Depends
   from services.nautobot.client import NautobotService
   from services.inventory.repository import NautobotInventoryRepository
   from services.inventory.evaluator import InventoryEvaluator
   from services.inventory.metadata_service import InventoryMetadataService
   from services.inventory.inventory import InventoryService

   def get_nautobot_service() -> NautobotService:
       return NautobotService()

   def get_inventory_repository(
       nautobot: NautobotService = Depends(get_nautobot_service)
   ) -> NautobotInventoryRepository:
       return NautobotInventoryRepository(nautobot)

   def get_inventory_evaluator() -> InventoryEvaluator:
       return InventoryEvaluator()

   def get_inventory_metadata_service(
       nautobot: NautobotService = Depends(get_nautobot_service)
   ) -> InventoryMetadataService:
       return InventoryMetadataService(nautobot)

   def get_inventory_service(
       repo: NautobotInventoryRepository = Depends(get_inventory_repository),
       evaluator: InventoryEvaluator = Depends(get_inventory_evaluator),
       metadata: InventoryMetadataService = Depends(get_inventory_metadata_service),
   ) -> InventoryService:
       return InventoryService(repository=repo, evaluator=evaluator, metadata_service=metadata)
   ```

4. **Refactor API Routers (`backend/routers/`):**
   Replace imports of global singletons with DI parameters:
   ```python
   # Before:
   from services.inventory.inventory import inventory_service

   # After:
   from dependencies import get_inventory_service
   from services.inventory.inventory import InventoryService

   @router.post("/preview")
   async def preview_inventory(
       operations: List[LogicalOperation],
       service: InventoryService = Depends(get_inventory_service),
   ):
       return await service.preview_inventory(operations)
   ```

5. **Background Tasks / Celery (`backend/background_jobs/`):**
   For Celery tasks where `Depends()` is unavailable, implement a factory function pattern:
   ```python
   def build_inventory_service() -> InventoryService:
       nautobot = NautobotService()
       repo = NautobotInventoryRepository(nautobot)
       evaluator = InventoryEvaluator()
       metadata = InventoryMetadataService(nautobot)
       return InventoryService(repo, evaluator, metadata)
   ```

6. **Remaining singletons (lower priority):** The git service cluster (`git_service`, `git_auth_service`, `git_cache_service`, etc.), network scanning services, and normalization services are used mostly internally by other services — tackle these in a follow-up pass once the primary router-facing services are migrated.

---

## 4. Pre & Post-Rollout Checks
* Ensure the entire test suite `pytest backend/tests/` continues passing locally before executing Phase 1.
* After Phase 2: Verify agent deployment works end-to-end (template render + git push + activation). Specifically test on macOS to confirm the `asyncio.new_event_loop()` crash is gone.
* After Phase 3: Conduct manual inventory preview via UI and verify Ansible inventory generation and file save/load flows.
* After Phase 4: Confirm all affected router endpoints return correct responses. Run integration test against Nautobot preview + CheckMK sync.
