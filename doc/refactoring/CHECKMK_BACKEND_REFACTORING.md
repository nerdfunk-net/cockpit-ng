# CheckMK Backend Refactoring Plan

## Context

`routers/checkmk/main.py` is 2,168 lines containing 63 endpoints across 9 domains. It violates every
project standard: business logic embedded in route handlers, URL parsing duplicated in 5+ places,
folder-path conversion (`/` → `~`) duplicated in 6+ places, three inconsistent client-construction
approaches, and settings loading scattered across 3+ call sites.

**Goal:** Decompose the monolith into thin domain routers (HTTP plumbing only) backed by proper
service classes (business logic), all sharing a single client factory. `backend/main.py` requires
**zero changes** — the public `checkmk_router` surface is preserved.

---

## Current State

### The Monolith

| File | Lines | Endpoints |
|------|-------|-----------|
| `routers/checkmk/main.py` | 2,168 | 63 |

### Existing Services (anemic — need enriching)

| File | Class | Methods today |
|------|-------|---------------|
| `services/checkmk/client.py` | `CheckMKService` | `test_connection()` only |
| `services/checkmk/host_service.py` | `CheckMKHostService` | `delete_host()` only |
| `services/checkmk/folder.py` | `CheckMKFolderService` | `create_path()` only |
| `services/checkmk/exceptions.py` | `CheckMKClientError`, `HostNotFoundError` | — |
| `services/checkmk/normalization.py` | normalization logic | keep as-is |
| `checkmk/client.py` | `CheckMKClient` | 60+ API methods (keep as-is) |

### Known Duplication

- **URL parsing** (`urlparse` + scheme detection): `main.py` (×2), `host_service.py`, `client.py` → 4 copies
- **Client construction** (`CheckMKClient(...)`): 3 different patterns in `main.py` alone
- **Folder path conversion** (`/` → `~`): 6 inline copies across `main.py`
- **Settings retrieval** (`settings_manager.get_checkmk_settings()`): 3 call sites in router

### Bad `__init__.py` Exports

`routers/checkmk/__init__.py` currently exports `get_host`, `delete_host`, `_get_checkmk_client`
(internal route functions). These will be removed from the public API.

---

## Target Architecture

```
services/checkmk/
├── base.py                  # NEW — CheckMKConfig, CheckMKClientFactory, slash_to_tilde()
├── client.py                # EXTEND — CheckMKConnectionService (rename + add methods)
├── host_service.py          # EXTEND — all 11 host operations
├── monitoring_service.py    # NEW
├── discovery_service.py     # NEW
├── problems_service.py      # NEW
├── activation_service.py    # NEW
├── folder.py                # EXTEND — all 8 folder operations
├── host_group_service.py    # NEW
├── tag_group_service.py     # NEW
├── exceptions.py            # unchanged
└── normalization.py         # unchanged

routers/checkmk/
├── __init__.py              # REWRITE — aggregate router only, clean exports
├── connection.py            # NEW — 5 endpoints, ~100 lines
├── hosts.py                 # NEW — 11 endpoints, ~200 lines
├── monitoring.py            # NEW — 4 endpoints, ~80 lines
├── discovery.py             # NEW — 5 endpoints, ~120 lines
├── problems.py              # NEW — 6 endpoints, ~120 lines
├── activation.py            # NEW — 6 endpoints, ~120 lines
├── folders.py               # NEW — 8 endpoints, ~160 lines
├── host_groups.py           # NEW — 7 endpoints, ~140 lines
├── tag_groups.py            # NEW — 5 endpoints, ~100 lines
├── main.py                  # DELETE after Phase 8
└── sync.py                  # unchanged
```

---

## Part 1 — Shared Foundation: `services/checkmk/base.py` (NEW)

This is the **first file to create**. Everything else depends on it.

### `CheckMKConfig` dataclass

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class CheckMKConfig:
    host: str        # parsed netloc only, no scheme
    site: str
    username: str
    password: str
    protocol: str    # "http" or "https"
    verify_ssl: bool
    timeout: int = 30
```

Replaces 4 independent copies of the `urlparse` + dict-validation block.

### `get_checkmk_config() -> CheckMKConfig`

```python
def get_checkmk_config() -> CheckMKConfig:
    """Load and validate CheckMK settings into a typed config object."""
```

1. Calls `settings_manager.get_checkmk_settings()`
2. Validates required keys: `url`, `site`, `username`, `password`
3. Parses URL (strips scheme, detects http/https)
4. Returns immutable `CheckMKConfig`
5. Raises `CheckMKClientError` on missing settings

### `CheckMKClientFactory`

```python
class CheckMKClientFactory:
    @staticmethod
    def build_client(config: CheckMKConfig) -> "CheckMKClient": ...

    @staticmethod
    def build_client_from_settings(site_name: str | None = None) -> "CheckMKClient": ...
```

`build_client_from_settings` replaces `service_factory.build_checkmk_client()` internally.
The existing `service_factory` function becomes a thin shim.

### `slash_to_tilde(path: str) -> str`

Pure function replacing 6 inline copies of:
```python
normalized = path.replace("//", "/") if path else "/"
checkmk_path = normalized.replace("/", "~") if normalized else "~"
```

### FastAPI dependency (add to `dependencies.py`)

```python
def get_checkmk_config() -> CheckMKConfig:
    from services.checkmk.base import get_checkmk_config as _get_config
    return _get_config()
```

---

## Part 2 — Service Classes

All services use `CheckMKClientFactory.build_client_from_settings()` from `base.py`. No service
may import `service_factory` directly (avoids circular dependency direction).

### 2.1 `CheckMKConnectionService` — extend `services/checkmk/client.py`

Rename `CheckMKService` → `CheckMKConnectionService`. Add:

```python
async def get_stats(self, cache_service) -> dict[str, Any]
    # Extract: ~70 lines of cache + client + host-count logic from get_checkmk_stats()

async def get_version(self) -> dict[str, Any]
    # Extract: client.get_version() + response mapping

async def get_host_inventory(self, hostname: str) -> dict[str, Any]
    # Extract: ~70 lines — settings load, URL build, requests.get, status-code mapping
```

Update `service_factory.build_checkmk_service()` and `dependencies.get_checkmk_service()` shims.

### 2.2 `CheckMKHostService` — extend `services/checkmk/host_service.py`

Remove `_get_client()` (replaced by `CheckMKClientFactory`). Add 10 new methods:

```python
async def get_all_hosts(self, effective_attributes: bool, include_links: bool, site: str | None) -> dict[str, Any]
async def get_host(self, hostname: str, effective_attributes: bool) -> dict[str, Any]
async def create_host(self, request: CheckMKHostCreateRequest) -> dict[str, Any]
async def create_host_v2(self, request: CheckMKHostCreateRequest, bake_agent: bool) -> dict[str, Any]
async def update_host(self, hostname: str, attributes: dict[str, Any]) -> dict[str, Any]
async def move_host(self, hostname: str, target_folder: str) -> dict[str, Any]
    # Uses slash_to_tilde(); handles CheckMKAPIError 428
async def rename_host(self, hostname: str, new_name: str) -> dict[str, Any]
async def bulk_create_hosts(self, request: CheckMKBulkHostCreateRequest) -> dict[str, Any]
async def bulk_update_hosts(self, request: CheckMKBulkHostUpdateRequest) -> dict[str, Any]
async def bulk_delete_hosts(self, request: CheckMKBulkHostDeleteRequest) -> dict[str, Any]
```

Note: `create_host_v2` can delegate to `create_host` with a `bake_agent` override to
eliminate duplication between the two similar endpoints.

### 2.3 `CheckMKMonitoringService` — new `services/checkmk/monitoring_service.py`

```python
async def get_all_monitored_hosts(self, columns: list[str] | None, query: str | None) -> dict[str, Any]
async def get_monitored_host(self, hostname: str, columns: list[str] | None) -> dict[str, Any]
async def get_host_services(self, hostname: str, columns: list[str] | None, query: str | None) -> dict[str, Any]
async def show_service(self, hostname: str, service: str, columns: list[str] | None) -> dict[str, Any]
```

### 2.4 `CheckMKDiscoveryService` — new `services/checkmk/discovery_service.py`

```python
async def get_service_discovery(self, hostname: str) -> dict[str, Any]
async def start_service_discovery(self, hostname: str, mode: str) -> dict[str, Any]
async def wait_for_service_discovery(self, hostname: str) -> dict[str, Any]
async def update_discovery_phase(self, hostname: str, phase: str, services: list[str] | None) -> dict[str, Any]
async def start_bulk_discovery(self, request: CheckMKBulkDiscoveryRequest) -> dict[str, Any]
```

### 2.5 `CheckMKProblemsService` — new `services/checkmk/problems_service.py`

```python
async def acknowledge_host_problem(self, request: CheckMKAcknowledgeHostRequest) -> dict[str, Any]
async def acknowledge_service_problem(self, request: CheckMKAcknowledgeServiceRequest) -> dict[str, Any]
async def delete_acknowledgment(self, ack_id: str) -> dict[str, Any]
async def create_host_downtime(self, request: CheckMKDowntimeRequest) -> dict[str, Any]
async def add_host_comment(self, request: CheckMKCommentRequest) -> dict[str, Any]
async def add_service_comment(self, request: CheckMKCommentRequest) -> dict[str, Any]
```

### 2.6 `CheckMKActivationService` — new `services/checkmk/activation_service.py`

```python
async def get_pending_changes(self) -> dict[str, Any]
    # Extract: client._make_request() call + ETag header extraction + etag strip-quote logic
    # (lines 1280–1290 of main.py) — the only endpoint calling private client methods

async def activate_changes(self, request: CheckMKActivateChangesRequest, etag: str = "*") -> dict[str, Any]
async def activate_changes_with_etag(self, etag: str, request: CheckMKActivateChangesRequest) -> dict[str, Any]
async def get_activation_status(self, activation_id: str) -> dict[str, Any]
async def wait_for_activation_completion(self, activation_id: str) -> dict[str, Any]
async def get_running_activations(self) -> dict[str, Any]
```

### 2.7 `CheckMKFolderService` — extend `services/checkmk/folder.py`

Replace `import service_factory` inside `create_path()` with `CheckMKClientFactory`. Add:

```python
async def get_all_folders(self, parent: str | None, recursive: bool, show_hosts: bool) -> dict[str, Any]
    # Extract: response mapping + 40+ line error handling (response_data["fields"], ["ext"] parsing)
async def get_folder(self, folder_path: str, show_hosts: bool) -> dict[str, Any]
async def create_folder(self, request: CheckMKFolderCreateRequest) -> dict[str, Any]
    # Extract: slash_to_tilde() + 40-line nested error extraction logic
async def update_folder(self, folder_path: str, request: CheckMKFolderUpdateRequest) -> dict[str, Any]
async def delete_folder(self, folder_path: str, delete_mode: str) -> dict[str, Any]
async def move_folder(self, folder_path: str, destination: str) -> dict[str, Any]
    # Extract: two slash_to_tilde() conversions
async def bulk_update_folders(self, request: CheckMKFolderBulkUpdateRequest) -> dict[str, Any]
async def get_hosts_in_folder(self, folder_path: str, effective_attributes: bool) -> dict[str, Any]
```

### 2.8 `CheckMKHostGroupService` — new `services/checkmk/host_group_service.py`

```python
async def get_host_groups(self) -> dict[str, Any]
async def get_host_group(self, group_name: str) -> dict[str, Any]
async def create_host_group(self, name: str, alias: str) -> dict[str, Any]
async def update_host_group(self, name: str, alias: str) -> dict[str, Any]
async def delete_host_group(self, name: str) -> dict[str, Any]
async def bulk_update_host_groups(self, entries: list[dict[str, Any]]) -> dict[str, Any]
async def bulk_delete_host_groups(self, entries: list[str]) -> dict[str, Any]
```

### 2.9 `CheckMKTagGroupService` — new `services/checkmk/tag_group_service.py`

```python
async def get_all_host_tag_groups(self) -> dict[str, Any]
    # Extract: response mapping (group_data → dict with id/title/topic/help/tags)
async def get_host_tag_group(self, name: str) -> dict[str, Any]
async def create_host_tag_group(self, request: CheckMKHostTagGroupCreateRequest) -> dict[str, Any]
    # Extract: [tag.dict() for tag in request.tags] transformation
async def update_host_tag_group(self, name: str, request: CheckMKHostTagGroupUpdateRequest) -> dict[str, Any]
async def delete_host_tag_group(self, name: str, repair: bool, mode: str | None) -> dict[str, Any]
```

---

## Part 3 — Thin Router Pattern

Each router imports its service via `Depends()`. **No business logic. No client construction.
No settings loading.** Only: parse request → call service → return response → handle exceptions.

### Dependency providers (add to `dependencies.py`)

```python
def get_checkmk_connection_service() -> "CheckMKConnectionService": ...
def get_checkmk_host_service() -> "CheckMKHostService": ...       # already exists — update
def get_checkmk_monitoring_service() -> "CheckMKMonitoringService": ...
def get_checkmk_discovery_service() -> "CheckMKDiscoveryService": ...
def get_checkmk_problems_service() -> "CheckMKProblemsService": ...
def get_checkmk_activation_service() -> "CheckMKActivationService": ...
def get_checkmk_folder_service() -> "CheckMKFolderService": ...
def get_checkmk_host_group_service() -> "CheckMKHostGroupService": ...
def get_checkmk_tag_group_service() -> "CheckMKTagGroupService": ...
```

### Router template

```python
"""
CheckMK <domain> router.
"""
from __future__ import annotations
import logging

from fastapi import APIRouter, Depends, HTTPException, status

from core.auth import require_permission
from dependencies import get_checkmk_<domain>_service
from services.checkmk.exceptions import CheckMKClientError

logger = logging.getLogger(__name__)
router = APIRouter(tags=["checkmk"])


@router.get("/<path>")
async def handler_name(
    ...,
    current_user: dict = Depends(require_permission("checkmk.devices", "read")),
    service=Depends(get_checkmk_<domain>_service),
):
    try:
        return await service.method(...)
    except CheckMKClientError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error in <operation>: %s", str(e))   # NO f-strings in logging
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed: {str(e)}",
        )
```

### Endpoint distribution

| Router file | Endpoints | Target lines |
|-------------|-----------|-------------|
| `connection.py` | 5 | ~100 |
| `hosts.py` | 11 | ~200 |
| `monitoring.py` | 4 | ~80 |
| `discovery.py` | 5 | ~120 |
| `problems.py` | 6 | ~120 |
| `activation.py` | 6 | ~120 |
| `folders.py` | 8 | ~160 |
| `host_groups.py` | 7 | ~140 |
| `tag_groups.py` | 5 | ~100 |
| `__init__.py` | — | ~40 |

---

## Part 4 — New `routers/checkmk/__init__.py`

The aggregate router keeps `backend/main.py` unchanged:

```python
"""CheckMK integration routers."""
from fastapi import APIRouter

from .connection import router as _connection_router
from .hosts import router as _hosts_router
from .monitoring import router as _monitoring_router
from .discovery import router as _discovery_router
from .problems import router as _problems_router
from .activation import router as _activation_router
from .folders import router as _folders_router
from .host_groups import router as _host_groups_router
from .tag_groups import router as _tag_groups_router
from .sync import router as nb2cmk_router

checkmk_router = APIRouter()
for _sub in [
    _connection_router, _hosts_router, _monitoring_router,
    _discovery_router, _problems_router, _activation_router,
    _folders_router, _host_groups_router, _tag_groups_router,
]:
    checkmk_router.include_router(_sub)

__all__ = ["checkmk_router", "nb2cmk_router"]
```

Removed from public exports: `get_host`, `delete_host`, `_get_checkmk_client`.

---

## Part 5 — Migration Sequence

Each phase is independently verifiable. Never leave broken imports between phases.

### Phase 1 — Create `services/checkmk/base.py`

**Files:** `services/checkmk/base.py` (new), `dependencies.py` (+`get_checkmk_config`),
`service_factory.py` (update `build_checkmk_client` to delegate to factory)

**Verify:**
```bash
python -c "from services.checkmk.base import get_checkmk_config, slash_to_tilde, CheckMKClientFactory"
python -c "from service_factory import build_checkmk_client; print('ok')"
pytest backend/tests/
```

### Phase 2 — Enrich `host_service.py`

Remove `_get_client()`, switch to `CheckMKClientFactory`. Add all 10 new methods.

**Verify:** `DELETE /api/checkmk/hosts/{hostname}` still works end-to-end.

### Phase 3 — Enrich `folder.py`

Replace `import service_factory` inside `create_path()`. Add all 8 folder methods using
`slash_to_tilde` from `base.py`.

**Verify:** No `service_factory` import in `services/checkmk/folder.py`.

### Phase 4 — Create 6 new service files

In any order (no inter-dependencies):
`monitoring_service.py`, `discovery_service.py`, `problems_service.py`,
`activation_service.py`, `host_group_service.py`, `tag_group_service.py`

For each: add factory function to `service_factory.py` + dependency provider to `dependencies.py`.

**Verify:** Import each in a Python REPL. Full test suite green.

### Phase 5 — Rename and extend `client.py` (`CheckMKConnectionService`)

Rename class. Add `get_stats`, `get_version`, `get_host_inventory`. Update shims.

**Verify:** `POST /api/checkmk/test` still works.

### Phase 6 — Create the 9 thin router files

Create all files under `routers/checkmk/`. Do **not** wire into `__init__.py` yet.
`main.py` remains the live router.

**Verify:** `python -m py_compile routers/checkmk/<each_file>.py`

### Phase 7 — Wire new `__init__.py` (switch-over)

Replace `routers/checkmk/__init__.py`. `main.py` becomes dead code.

**Verify:**
```bash
python start.py  # starts without error
# Check /docs: all 63 endpoints present with correct paths
# Smoke test one endpoint per domain (9 curl/httpx requests)
```

### Phase 8 — Delete `main.py` content

Remove the `router` object and all 63 handler functions. Update any test that patches
`routers.checkmk.main.get_host` → `routers.checkmk.hosts.get_host`.

**Verify:**
```bash
grep -r "from routers.checkmk.main import\|from .main import" backend/
# Must return zero results
pytest backend/tests/
```

### Phase 9 — Remove remaining duplication

- `services/background_jobs/diff_viewer_jobs.py`: replace its local `_get_checkmk_client` with
  `service_factory.build_checkmk_client()`
- Confirm no `urlparse` / `parsed_url.scheme` / `parsed_url.netloc` in `services/checkmk/` or
  `routers/checkmk/` outside `base.py`
- Confirm no inline folder-path conversion outside `base.py`

**Verify:**
```bash
grep -rn "urlparse" backend/services/checkmk/ backend/routers/checkmk/
# Should show only base.py
grep -rn 'replace.*"/", "~"' backend/routers/checkmk/
# Should show zero results
```

---

## Part 6 — Special Cases

### `get_pending_changes` — private client method access

Lines 1280–1290 of `main.py` call `client._make_request()` and `client._handle_response()`
directly (private methods). The ETag extraction logic must move into
`CheckMKActivationService.get_pending_changes()`. If `CheckMKClient.get_pending_changes()`
doesn't return the ETag, the service is the correct place to call the private method —
not the router.

### `create_host_v2` duplication

Nearly identical to `create_host`. In `CheckMKHostService`, implement `create_host_v2` as a
thin wrapper delegating to `create_host` with a `bake_agent=True` override.

### `folder.py` circular import risk

`services/checkmk/folder.py` currently `import service_factory`. Since `service_factory`
imports from `services/`, this creates a potential cycle. Phase 3 fixes this by importing
`CheckMKClientFactory` from `services.checkmk.base` instead.

### Test patch target update (Phase 8)

```python
# Before (broken after Phase 8):
@patch("routers.checkmk.main.get_host")

# After:
@patch("routers.checkmk.hosts.get_host")
```

Search: `grep -rn "routers.checkmk.main" backend/tests/`

---

## Part 7 — File Size Targets (All within 800-line limit)

| File | Estimated lines |
|------|----------------|
| `services/checkmk/base.py` | ~100 |
| `services/checkmk/client.py` (extended) | ~180 |
| `services/checkmk/host_service.py` (extended) | ~300 |
| `services/checkmk/monitoring_service.py` | ~80 |
| `services/checkmk/discovery_service.py` | ~120 |
| `services/checkmk/problems_service.py` | ~130 |
| `services/checkmk/activation_service.py` | ~120 |
| `services/checkmk/folder.py` (extended) | ~280 |
| `services/checkmk/host_group_service.py` | ~120 |
| `services/checkmk/tag_group_service.py` | ~110 |
| `routers/checkmk/connection.py` | ~100 |
| `routers/checkmk/hosts.py` | ~200 |
| `routers/checkmk/monitoring.py` | ~80 |
| `routers/checkmk/discovery.py` | ~120 |
| `routers/checkmk/problems.py` | ~120 |
| `routers/checkmk/activation.py` | ~120 |
| `routers/checkmk/folders.py` | ~160 |
| `routers/checkmk/host_groups.py` | ~140 |
| `routers/checkmk/tag_groups.py` | ~100 |
| `routers/checkmk/__init__.py` | ~40 |

**Before:** 2,168 lines in 1 file  
**After:** ~2,620 lines across 20 files (increase is normal: class boilerplate, imports,
and docstrings replace inline duplication while eliminating all duplicated patterns)

---

## Critical Files

| File | Role |
|------|------|
| `services/checkmk/base.py` | New foundation — implement first |
| `routers/checkmk/main.py` | Source of all extracted logic — delete last |
| `service_factory.py` | Touched every phase — keep free of FastAPI imports |
| `dependencies.py` | Touched every phase — add `Depends()` providers per service |
| `routers/checkmk/__init__.py` | Public interface — must preserve `checkmk_router` |
| `backend/main.py` | Must remain unchanged |
