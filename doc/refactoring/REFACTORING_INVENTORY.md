# Inventory backend refactoring analysis

## Overview

The inventory system is one of the more complex domains in the backend. It handles dynamic device queries against Nautobot (via logical operations), CRUD for saved inventories in PostgreSQL, and resolution of saved inventories to device lists. The code works, but the architecture has grown inconsistently and contains several violations of the project's stated layering conventions.

This document covers what is wrong, why it matters, and what to do about it.

---

## Current architecture

The inventory system spans these layers:

| Layer | File |
|---|---|
| SQLAlchemy model | `core/models.py` → `Inventory` class |
| Pydantic models | `models/inventory.py` (partial) and `routers/inventory/main.py` (duplicated remainder) |
| Repository | `repositories/inventory/inventory_repository.py` |
| **Manager (extra layer)** | `inventory_manager.py` ← root of backend |
| Service | `services/inventory/inventory.py` + sub-services |
| Routers | `routers/inventory/main.py` and `routers/inventory/inventory.py` |

There are two routers and an extra "manager" layer that sits outside the defined architecture. This is the core of the problem.

### Two subsystems

The inventory domain actually contains **two independent subsystems** sharing the same URL prefix:

1. **Persistence layer** (database-backed) — CRUD for saved inventories in PostgreSQL. Uses `InventoryManager` → `InventoryRepository`.
2. **Query/preview layer** (Nautobot-integrated) — Dynamic device filtering with logical operations. Uses `InventoryService` → sub-services (evaluator, query_service, metadata, export, git_storage).

These have different data sources, different service classes, and different dependency patterns. The refactoring must preserve this separation.

### Dual persistence: PostgreSQL and Git

`InventoryService` has its own persistence via `InventoryGitStorage` (`save_inventory()`, `list_inventories()`, `load_inventory()`). This is **separate from** the PostgreSQL-backed CRUD in `InventoryManager`. Both coexist and serve different purposes. The refactoring must not merge or confuse these two persistence paths.

### Complete list of `inventory_manager` consumers

The manager singleton is imported in **7 files**, not just the two routers:

| File | Import style | Usage |
|---|---|---|
| `routers/inventory/main.py` | Top-level | All CRUD endpoints |
| `routers/inventory/inventory.py` | Lazy (2 endpoints) | `resolve-devices`, `resolve-devices/detailed` |
| `services/inventory/inventory.py` | Lazy | `analyze_inventory()` |
| `services/agents/template_render_service.py` | Lazy | Resolving inventory for template rendering |
| `utils/inventory_resolver.py` | Lazy | `resolve_inventory_to_device_ids()` shared utility |
| `tasks/execution/deploy_agent_executor.py` | `import inventory_manager as inv_mgr` | Resolving inventory name → ID for deployments |
| `routers/settings/templates.py` | Lazy | Inventory resolution during template operations |

All 7 must be migrated. The plan must define migration order for each.

---

## Finding 1 — Manager file in the wrong directory (critical)

`inventory_manager.py` lives in the **root of the backend directory**, alongside `celery_app.py`, `config.py`, and `main.py`. The project's architecture explicitly defines that business logic and data access belong under `services/` or `repositories/`.

Other manager files with the same problem exist (`credentials_manager.py`, `settings_manager.py`, `git_repositories_manager.py`, `job_template_manager.py`). The inventory manager is not unique, but that makes it a systemic issue rather than an isolated one.

The `InventoryManager` class wraps `InventoryRepository` and adds serialization helpers (`_model_to_dict`, JSON encode/decode for the `conditions` field). It is essentially a service that should live at `services/inventory/database_service.py` or be merged into the existing `InventoryService`.

**What is wrong:**
- Violates the `services/{domain}/{name}.py` convention.
- Creates an extra layer (`Router → Manager → Repository`) that is not part of the defined pattern (`Router → Service → Repository`).
- The global singleton `inventory_manager = InventoryManager()` is imported directly in routers, bypassing FastAPI's dependency injection entirely.

---

## Finding 2 — Two routers sharing the same prefix (critical)

Two router files are registered in `main.py` and both use `/api/inventory` as their prefix:

- `routers/inventory/main.py` — CRUD endpoints (create, list, get, update, delete)
- `routers/inventory/inventory.py` — operational endpoints (preview, field options, resolve, analyze)

Both are registered:

```python
app.include_router(general_inventory_router)  # inventory.py
app.include_router(inventory_router)          # main.py
```

This works because route paths do not actually overlap, but the organization is confusing. The name `general_inventory_router` is vague and gives no hint about what it handles. There is no clear rule for which router a new endpoint should go into.

**What is wrong:**
- No clear separation of concerns between the two routers.
- `/api/inventory` is both a resource collection (CRUD) and a service namespace (preview, analyze).
- Adding new endpoints requires guessing which file to use.

---

## Finding 3 — Direct manager imports inside async route handlers (critical)

`routers/inventory/main.py` imports and uses the global singleton directly at module level:

```python
from inventory_manager import inventory_manager

@router.post("")
async def create_inventory(...):
    inventory_id = inventory_manager.create_inventory(inventory_data)
```

`routers/inventory/inventory.py` uses lazy imports inside async functions:

```python
@router.get("/resolve-devices/{inventory_id}")
async def resolve_inventory_to_devices(...):
    from inventory_manager import inventory_manager          # inside async function
    from utils.inventory_converter import convert_saved_inventory_to_operations
    inventory = inventory_manager.get_inventory(inventory_id)
```

This pattern exists in at least two endpoints: `/resolve-devices/{inventory_id}` and `/resolve-devices/detailed/{inventory_id}`.

`routers/inventory/inventory.py` uses `Depends(get_inventory_service)` for `InventoryService` but then bypasses that same pattern for inventory loading. The inconsistency within a single file is significant.

**What is wrong:**
- Bypasses the service layer entirely for CRUD operations.
- Prevents proper testing (cannot inject a mock `inventory_manager`).
- Lazy imports inside async functions are a code smell and hide dependencies.
- Mixed dependency patterns within one file are hard to follow.

---

## Finding 4 — Duplicate Pydantic models (high)

`models/inventory.py` defines models for the operational API (preview, analysis). `routers/inventory/main.py` defines its own CRUD models locally:

| Model | `models/inventory.py` | `routers/inventory/main.py` |
|---|---|---|
| `SavedInventoryCondition` | yes | yes (duplicate) |
| `CreateInventoryRequest` | no | yes |
| `UpdateInventoryRequest` | no | yes |
| `InventoryResponse` | no | yes |
| `ListInventoriesResponse` | yes | yes (duplicate) |
| `InventoryDeleteResponse` | no | yes |

The router defines its own `SavedInventoryCondition` and `ListInventoriesResponse` instead of importing from `models/inventory.py`.

**What is wrong:**
- Any change to a shared model requires updating two places.
- The canonical definition of `SavedInventoryCondition` is ambiguous.
- Violates the convention that all Pydantic models live in `models/{domain}.py`.

---

## Finding 5 — Repository instantiation per method call (high)

Every method in `InventoryManager` creates a new `InventoryRepository()` instance:

```python
def get_inventory(self, inventory_id: int):
    repo = InventoryRepository()     # new instance
    inventory = repo.get_by_id(inventory_id)

def list_inventories(self, username: str, ...):
    repo = InventoryRepository()     # new instance again
    ...
```

This pattern appears eight times in the same file.

**What is wrong:**
- No dependency injection — the repository is tightly coupled.
- The repository itself calls `get_db_session()` in every method, meaning each repository method independently opens and closes a database connection.
- You cannot share a single transaction across multiple manager method calls.
- There is no way to inject a mock repository for testing.

---

## Finding 6 — Synchronous I/O in async context (high)

The repository and manager are fully synchronous. The service layer and router are async. SQLAlchemy's synchronous `Session` uses blocking I/O.

When a route handler `await`s the service and the service eventually calls a synchronous repository method, the thread pool is blocked. Under high load this reduces FastAPI's concurrency advantages.

**What is wrong:**
- Synchronous database calls in an async application block the event loop's thread.
- The existing codebase already uses synchronous SQLAlchemy throughout, so this is a systemic issue, but the inventory code makes it most visible because the service is explicitly `async` while the data layer is not.

---

## Finding 7 — Manual JSON serialization for conditions field (medium)

The `conditions` column in the `Inventory` model is stored as `Text` (or `String`). `InventoryManager` manually serializes on write and deserializes on read:

```python
# Write
conditions_json = json.dumps(inventory_data["conditions"])
repo.create(..., conditions=conditions_json, ...)

# Read
result["conditions"] = json.loads(inventory.conditions)
```

If `json.loads` fails, the error is silently swallowed and an empty list is returned:

```python
except json.JSONDecodeError:
    logger.error("Failed to parse conditions for inventory %s", inventory.id)
    result["conditions"] = []
```

This means corrupted condition data is silently lost.

**What is wrong:**
- Manual JSON round-tripping is unnecessary. PostgreSQL supports `JSON` and `JSONB` column types natively. SQLAlchemy's `JSON` type handles serialization automatically.
- Silent data loss on parse failure is a latent correctness bug.
- The conditions structure is not schema-validated at the persistence layer.

---

## Finding 8 — Access control split across layers (medium)

Who checks whether a user can access a private inventory?

- `InventoryRepository.list_inventories()` filters at the SQL level: global inventories plus private inventories owned by the user.
- `InventoryRepository.get_by_name()` also filters at SQL level.
- `InventoryRepository.get_by_id()` does **no filtering** — it returns any inventory by ID.
- `InventoryManager` does not check access.
- `routers/inventory/main.py` adds an ownership check for `GET /{inventory_id}`.
- `routers/inventory/inventory.py` adds ownership checks in `resolve-devices` and `resolve-devices/detailed`.
- `services/inventory/inventory.py` adds an ownership check inside `analyze_inventory`.

The same check (`scope == 'private' and created_by != username`) is implemented in three different places using three different approaches.

**What is wrong:**
- Access control logic is fragmented across the router, service, and repository.
- `get_by_id()` returns private inventories to any caller — the protection is entirely dependent on the router layer remembering to check.
- New endpoints can accidentally bypass the access check.

---

## Finding 9 — Missing pagination (medium)

`InventoryRepository.list_inventories()` returns all records with `.all()` and no limit. The router passes no pagination parameters.

**What is wrong:**
- For users with many inventories, this loads all records into memory.
- No `skip` or `limit` parameters exist on the API.

---

## Finding 10 — Insufficient input validation (low)

`InventoryManager.create_inventory()` validates only that `name`, `created_by`, and `conditions` are non-empty. There is no validation of:

- `name` length
- `description` length
- `scope` values (any string is accepted; should be `global` or `private`)
- `conditions` structure beyond "is not empty"

`scope` should use an `Enum` type (`global`, `private`) in both the Pydantic model and the SQLAlchemy model.

---

## Summary of issues

| # | Issue | Severity |
|---|---|---|
| 1 | `inventory_manager.py` in backend root instead of `services/inventory/` | Critical |
| 2 | Two routers with the same prefix and no clear ownership boundary | Critical |
| 3 | Direct manager singleton imports in route handlers, bypassing DI | Critical |
| 4 | Pydantic models duplicated between `models/inventory.py` and router | High |
| 5 | New `InventoryRepository()` instance created in every manager method | High |
| 6 | Synchronous repository called from async context | High |
| 7 | Manual JSON serialize/deserialize for `conditions` field with silent failure | Medium |
| 8 | Access control check duplicated across repository, service, and router | Medium |
| 9 | No pagination on `list_inventories` | Medium |
| 10 | No `scope` enum or length validation on inputs | Low |

---

## Recommendations

### Implementation order

The steps below are ordered by dependency. Each step should be completed and tested before starting the next. Steps that can be parallelized are noted.

---

### Step 1 — Consolidate all Pydantic models (safe, no behavior change)

Move all inventory Pydantic models (`CreateInventoryRequest`, `UpdateInventoryRequest`, `InventoryResponse`, `InventoryDeleteResponse`, `ImportInventoryRequest`) from `routers/inventory/main.py` into `models/inventory.py`. Remove the duplicate `SavedInventoryCondition` and `ListInventoriesResponse` from the router. Import everything from `models/inventory.py` in the router.

Add a `ScopeEnum` (`global`, `private`) and use it in `CreateInventoryRequest`, `UpdateInventoryRequest`, and `InventoryResponse`.

**Verification:** All existing tests pass. Router endpoints return identical responses.

---

### Step 2 — Rename and clarify the two routers (safe, no behavior change)

Rename files and exports:
- `routers/inventory/main.py` → `routers/inventory/crud.py` (exports `inventory_crud_router`)
- `routers/inventory/inventory.py` → `routers/inventory/ops.py` (exports `inventory_ops_router`)
- Update `routers/inventory/__init__.py` to export the new names
- Update `main.py` router registration

**Critical constraint:** `inventory_ops_router` must be registered **before** `inventory_crud_router` in `main.py`. Otherwise, the `/{inventory_id}` path parameter in CRUD routes catches `/preview`, `/field-options`, `/custom-fields`, etc. This is the current registration order and must be preserved.

**Verification:** All endpoints respond at the same paths. No 404s or route conflicts.

---

### Step 3 — Create `InventoryPersistenceService` (new file, no deletions yet)

Create `services/inventory/persistence_service.py` containing `InventoryPersistenceService`. This class absorbs all CRUD logic from `InventoryManager`:
- `create_inventory()`, `get_inventory()`, `get_inventory_by_name()`, `update_inventory()`, `delete_inventory()`, `list_inventories()`, `search_inventories()`, `health_check()`
- The `_model_to_dict()` helper and JSON serialization logic

**Design decision:** Do NOT merge CRUD into the existing `InventoryService`. That class is a Nautobot query facade with completely different dependencies (evaluator, query_service, metadata_service, export_service, git_storage). Merging would create a god object. Keep them separate:
- `InventoryPersistenceService` — PostgreSQL CRUD (uses `InventoryRepository`)
- `InventoryService` — Nautobot queries, preview, analysis (uses sub-services)

The new service receives the repository via constructor injection:

```python
class InventoryPersistenceService:
    def __init__(self, repository: InventoryRepository):
        self.repository = repository
```

Register in `service_factory.py`:

```python
def build_inventory_persistence_service() -> InventoryPersistenceService:
    from repositories.inventory.inventory_repository import InventoryRepository
    return InventoryPersistenceService(repository=InventoryRepository())
```

Add to `dependencies.py`:

```python
def get_inventory_persistence_service() -> InventoryPersistenceService:
    return service_factory.build_inventory_persistence_service()
```

**Do not delete `inventory_manager.py` yet.** Both the old manager and new service exist in parallel during this step.

**Verification:** Unit test the new service directly. Confirm it returns identical results to `InventoryManager` for all operations.

---

### Step 4 — Migrate all consumers from manager to service

Replace `inventory_manager` imports with `InventoryPersistenceService` injection in all 7 consumer files. Migration order:

**4a. Routers (use `Depends()`):**
- `routers/inventory/crud.py` — Replace top-level `from inventory_manager import inventory_manager` with `Depends(get_inventory_persistence_service)` on each endpoint
- `routers/inventory/ops.py` — Replace lazy imports in `resolve-devices` and `resolve-devices/detailed` with `Depends(get_inventory_persistence_service)`

**4b. Services (use constructor injection):**
- `services/inventory/inventory.py` — Add `InventoryPersistenceService` as a constructor parameter. Replace the lazy `inventory_manager` import in `analyze_inventory()`. **Critical:** The existing `build_inventory_service()` in `service_factory.py` (line 80) currently calls `InventoryService()` with no arguments. Adding a constructor parameter to `InventoryService` **breaks this factory**. Update `build_inventory_service()` at the same time to pass the persistence service:

```python
def build_inventory_service() -> "InventoryService":
    from services.inventory.inventory import InventoryService
    persistence = build_inventory_persistence_service()
    return InventoryService(persistence_service=persistence)
```

**4c. Utilities and tasks (use `service_factory` directly):**
- `utils/inventory_resolver.py` — Replace `from inventory_manager import inventory_manager` with `service_factory.build_inventory_persistence_service()`
- `tasks/execution/deploy_agent_executor.py` — Replace `import inventory_manager as inv_mgr` with `service_factory.build_inventory_persistence_service()`. **Note:** This file uses an unusual double-attribute pattern (`inv_mgr.inventory_manager.get_inventory_by_name(...)`) that accesses the module's global through an alias. The replacement call is simply `persistence_service.get_inventory_by_name(...)`.
- `services/agents/template_render_service.py` — Replace lazy import with `service_factory.build_inventory_persistence_service()`
- `routers/settings/templates.py` — Replace lazy import with `Depends(get_inventory_persistence_service)` or `service_factory`

**Mixed-state warning:** Three files (`template_render_service.py`, `inventory_resolver.py`, `routers/settings/templates.py`) already use `service_factory` or `Depends()` for `InventoryService` (Nautobot queries) but still use `inventory_manager` for CRUD lookups. After migration, each file should use two services: `InventoryPersistenceService` for loading saved inventories and `InventoryService` for preview/resolution. Don't accidentally remove the existing `InventoryService` usage.

**Sync caller constraint:** `utils/inventory_resolver.py` provides `resolve_inventory_to_device_ids_sync()` for Celery tasks. `deploy_agent_executor.py` also calls synchronously. The new `InventoryPersistenceService` must remain **synchronous** (same as the current manager) so these callers work without an async wrapper.

**Verification:** After each file migration, run the relevant tests. After all 7 are done, grep for `from inventory_manager` and `import inventory_manager` — zero results expected.

---

### Step 5 — Delete `inventory_manager.py`

Remove the file. Run full test suite. Grep confirms no remaining references.

**Verification:** `grep -r "inventory_manager" backend/` returns zero results (excluding this plan document and any migration notes).

---

### Step 6 — Centralize access control in `InventoryPersistenceService`

Add a `_assert_access()` method:

```python
def _assert_access(self, inventory: dict, username: str) -> None:
    if inventory.get("scope") == "private" and inventory.get("created_by") != username:
        raise PermissionError(f"Access denied to inventory {inventory['id']}")
```

Call it from `get_inventory()`, `get_inventory_by_name()`, `update_inventory()`, and `delete_inventory()`. Remove the duplicate access checks from:
- `routers/inventory/crud.py` (GET `/{inventory_id}`)
- `routers/inventory/ops.py` (`resolve-devices`, `resolve-devices/detailed`)
- `services/inventory/inventory.py` (`analyze_inventory`)

**Verification:** Test that private inventories are still inaccessible to non-owners. Test that global inventories remain accessible to all.

---

### Step 7 — Change `conditions` column type to JSON

Update `core/models.py`: change `conditions` from `Text`/`String` to `JSON`.

Write a database migration using the project's migration framework (see `doc/MIGRATION_SYSTEM.md`). The migration must:
1. Convert existing `Text` data (JSON strings) to native `JSON` column values
2. Handle any rows where `conditions` is `NULL` or empty string
3. Be reversible

Remove `json.dumps()` and `json.loads()` calls from `InventoryPersistenceService`. Pass Python dicts/lists directly.

Remove the silent `except json.JSONDecodeError` handler — with a native JSON column, invalid JSON is rejected at write time.

**Verification:** Existing inventories load correctly after migration. Create/update operations store conditions without manual serialization. Invalid JSON is rejected.

---

### Step 8 — Add pagination (new feature, optional)

Add `skip` and `limit` query parameters to the list endpoint in `routers/inventory/crud.py`. Pass through to `InventoryPersistenceService.list_inventories()` and down to the repository.

Default: `skip=0, limit=100`.

**Note:** This is new feature work, not a refactoring fix. It can be deferred or done independently.

---

### Out of scope for this plan

- **Finding 6 (sync I/O in async context):** This is a systemic codebase issue. All repositories use synchronous SQLAlchemy. Fixing it for inventory alone would be inconsistent. Track this as a separate initiative.
- **Other `*_manager.py` files:** There are ~12 manager files in the backend root following the same pattern. This plan covers `inventory_manager.py` only. The same pattern can be applied to each manager as a follow-up, but attempting all at once is too large.

---

## Suggested file layout after refactoring

```
backend/
  core/
    models.py                              # Inventory SQLAlchemy model (conditions → JSON type)
  models/
    inventory.py                           # ALL Pydantic models (consolidated from router)
  repositories/
    inventory/
      inventory_repository.py             # Data access (unchanged structure)
  services/
    inventory/
      persistence_service.py              # InventoryPersistenceService (was inventory_manager.py)
      inventory.py                         # InventoryService (Nautobot query facade, unchanged role)
      evaluator.py                         # Logical operation execution
      query_service.py                     # Nautobot GraphQL queries
      metadata_service.py                  # Custom field definitions
      export_service.py                    # Template rendering
      git_storage_service.py               # Git-based storage
  routers/
    inventory/
      crud.py                              # CRUD endpoints (was main.py)
      ops.py                               # Preview, resolve, analyze (was inventory.py)
      __init__.py                          # Exports inventory_crud_router, inventory_ops_router
  service_factory.py                       # build_inventory_persistence_service(), build_inventory_service()
  dependencies.py                          # get_inventory_persistence_service(), get_inventory_service()
```

`inventory_manager.py` is deleted. Other root-level manager files remain (out of scope for this plan).

---

## Risk register

| Risk | Mitigation |
|---|---|
| Route ordering breaks after router rename | Explicitly document and test that ops router is registered before CRUD router in `main.py` |
| Sync callers (Celery tasks, utils) break if service becomes async | Keep `InventoryPersistenceService` synchronous. Only the Nautobot `InventoryService` is async |
| `analyze_inventory` circular dependency (service importing persistence service) | Use constructor injection, not import-time dependency. `service_factory` builds both and wires them |
| Database migration corrupts existing `conditions` data | Write reversible migration. Test on a copy of production data first. Handle NULL and empty string cases |
| Frontend breaks due to changed response shapes | Steps 1-5 change no HTTP behavior. Steps 6-7 are internal. Step 8 (pagination) is additive only |
| Git-backed storage confused with PostgreSQL CRUD | These are separate services with separate callers. Document the distinction clearly |
