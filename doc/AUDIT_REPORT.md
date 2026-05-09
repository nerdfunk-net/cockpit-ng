# Backend Architecture Audit Report

**Date:** 2026-05-09  
**Auditor:** Claude Code (claude-sonnet-4-6)  
**Scope:** Full backend (`/backend/**/*.py`), excluding tests and migrations  
**Standard Reference:** `/CLAUDE.md`

---

## Executive Summary

The backend has a **dual-layer architecture problem**: new features follow the CLAUDE.md standard (Model → Repository → Service → Router via `service_factory.py`), but a large body of legacy code in root-level `*_manager.py` files bypasses this standard entirely. Additionally, several recently added files violate size limits, contain business logic in routers, define Pydantic models inside routers, and contain duplicate class definitions. The codebase has ~96,000 lines of production Python. The issues are structural but tractable.

---

## 1. Legacy Root-Level Manager Files

### Problem

11 `*_manager.py` files live at `/backend/*.py` (the root). They represent the original architecture before the CLAUDE.md standard was established. They are **not** registered in `service_factory.py` or `dependencies.py`, and routers import them directly with module-level imports — bypassing the service layer entirely.

These managers DO correctly use the repository layer internally, so the data access layer is not broken. The problem is the missing service abstraction and the direct router → manager coupling.

### Files and Their Correct Destination

| File | Lines | Should Become |
|---|---|---|
| `job_template_manager.py` | 669 | `services/jobs/job_template_service.py` |
| `job_run_manager.py` | 400 | `services/jobs/job_run_service.py` |
| `jobs_manager.py` | 416 | `services/jobs/job_schedule_service.py` |
| `credentials_manager.py` | 597 | `services/settings/credentials_service.py` |
| `rbac_manager.py` | 596 | `services/auth/rbac_service.py` |
| `compliance_manager.py` | 538 | `services/compliance/compliance_service.py` |
| `template_manager.py` | ~525 | `services/templates/template_service.py` |
| `user_db_manager.py` | 409 | `services/auth/user_service.py` |
| `git_repositories_manager.py` | 214 | `services/settings/git/repository_service.py` (partial: already has `services/settings/git/service.py`) |
| `profile_manager.py` | 152 | `services/auth/profile_service.py` |
| `settings_manager.py` | tiny | Already a shim to `services/settings/manager.py` — delete after migrating callers |

### Scope of Impact

The managers are imported by **50+ files** across the codebase:

**Routers importing managers directly:**
- `routers/settings/rbac.py` → `import rbac_manager as rbac`
- `routers/settings/credentials.py` → `import credentials_manager as cred_mgr`
- `routers/compliance_check.py` → `import compliance_manager as compliance`
- `routers/settings/compliance/rules.py` → `import compliance_manager as compliance`
- `routers/jobs/runs.py` → `import job_run_manager` (also lazy imports `jobs_manager`, `job_template_manager`)
- `routers/jobs/schedules.py` → `import jobs_manager`
- `routers/jobs/templates.py` → `import job_template_manager`
- `routers/jobs/import_update.py`, `check_ip.py`, `onboarding.py`, `client_data.py`, `export.py` → `import job_run_manager`
- `routers/settings/templates/crud.py` → lazy imports `template_manager`
- `routers/settings/templates/health.py` → lazy imports `template_manager`
- `routers/settings/checkmk_settings.py`, `cache_settings.py`, `git_settings.py`, `agents_settings.py`, `nautobot.py`, `common.py` → lazy imports `settings_manager`

**Tasks importing managers directly (lazy imports inside functions):**
- `tasks/scan_prefixes_task.py` → `import job_run_manager`
- `tasks/onboard_device_task.py` (via indirection)
- `tasks/import_devices_task.py` → `import job_run_manager`
- `tasks/import_or_update_from_csv_task.py` → `import job_run_manager`
- `tasks/update_ip_prefixes_from_csv_task.py` → `import job_run_manager`
- `tasks/update_ip_addresses_from_csv_task.py` → `import job_run_manager`
- `tasks/update_devices_from_csv_task.py` → `import job_run_manager`
- `tasks/update_devices_task.py` → `import job_run_manager`
- `tasks/ping_network_task.py` → `import job_run_manager`
- `tasks/csv_export_task.py` → `import job_run_manager`
- `tasks/export_devices_task.py` → `import job_run_manager`
- `tasks/bulk_onboard_task.py` → `import job_run_manager`
- `tasks/check_ip_task.py` → `import job_run_manager`
- `tasks/backup_tasks.py` → `import job_run_manager`
- `tasks/periodic_tasks.py` → `import job_run_manager` (3 places)
- `tasks/test_tasks.py` → `import job_run_manager`
- `tasks/scheduling/job_dispatcher.py` → `import job_run_manager`, `job_template_manager`
- `tasks/scheduling/schedule_checker.py` → `import jobs_manager`, `job_template_manager`
- `tasks/execution/backup_executor.py` → `import jobs_manager`, `job_template_manager`
- `tasks/execution/deploy_agent_executor.py` → `import job_template_manager`, `jobs_manager`

**Services importing managers directly:**
- `services/background_jobs/location_cache_jobs.py` → `import job_run_manager` (3 places)
- `services/background_jobs/device_cache_jobs.py` → `import job_run_manager` (2 places)
- `services/background_jobs/checkmk_device_jobs.py` → `import job_run_manager` (2 places)
- `services/templates/render_orchestrator.py` → `import job_run_manager`
- `services/settings/git/shared_utils.py` → `from git_repositories_manager import GitRepositoryManager`
- `services/network/snapshots/execution_service.py` → `from git_repositories_manager import GitRepositoryManager`
- `services/agents/template_render_service.py` → lazy `from git_repositories_manager import GitRepositoryManager`
- `services/inventory/git_storage_service.py` → lazy `from git_repositories_manager import GitRepositoryManager` (3 places)
- `services/network/scanning/service.py` → `from credentials_manager import get_decrypted_password, list_credentials`

---

## 2. Oversized Files (>800 Lines)

CLAUDE.md target: 200–400 lines typical, 800 max.

### `routers/settings/git/files.py` — 1002 lines

**Problem:** This is a router file containing full business logic — it is not a thin HTTP layer. The `search_repository_files` function (lines 27–150) contains ~125 lines of filesystem traversal, filtering, sorting, and pagination logic that belongs in a service. Same for `get_files`, `get_file_history`, `get_file_complete_history`, `get_file_content`, `get_directory_tree`, `get_directory_files`, `list_csv_files`, `get_csv_headers`.

**Endpoints (10 total):** `search_repository_files`, `get_files`, `get_file_history`, `get_file_complete_history`, `get_file_content`, `get_file_content_parsed`, `get_directory_tree`, `get_directory_files`, `list_csv_files`, `get_csv_headers`

**Fix:** Extract to `services/settings/git/file_service.py`. Router functions should be 10–20 lines each.

---

### `tasks/import_or_update_from_csv_task.py` — 992 lines

**Problem:** The Celery task itself contains all business logic inline. `_run_csv_import()` is ~400 lines. Helper functions `_process_single_object()`, `_process_cockpit_rows()`, `_extract_interface_config()`, `_apply_column_mapping()` are all co-located in the task file.

**Key functions:**
- `import_or_update_from_csv_task()` (lines 65–103) — Celery entry point, should be thin
- `_run_csv_import()` (lines 104–501) — 397-line business logic function
- `_filter_nautobot_nulls()`, `_apply_default_prefix_length()` (utility)
- `class ImportContext` (lines 544–558) — data class, fine to keep
- `_process_single_object()` (lines 559–714) — 155-line processing function
- `_process_cockpit_rows()` (lines 715–844) — 129-line batch processor
- `_extract_interface_config()` (lines 845–901) — 56-line extractor
- `_apply_column_mapping()` (lines 902–992) — 90-line mapper

**Fix:** Extract to `services/nautobot/import/csv_import_service.py`. Task becomes a thin wrapper.

---

### `tasks/update_ip_prefixes_from_csv_task.py` — 961 lines

**Problem:** Same pattern. The Celery task contains a 476-line `_execute_*` block and multiple helper functions for Nautobot prefix operations.

**Key functions:**
- `update_ip_prefixes_from_csv_task()` (lines 37–546) — 509-line monolith task entry point
- `_get_prefix_by_uuid()`, `_find_prefix_by_prefix_and_namespace_graphql()`, `_update_prefix()`, `_prepare_prefix_update_data()`, `_generate_field_comparison()` — all inline helpers

**Fix:** Extract to `services/nautobot/import/prefix_update_service.py`.

---

### `routers/network/automation/netmiko.py` — 928 lines

**Problem (two issues):**

1. **6 Pydantic models defined inside the router** (should be in `models/netmiko.py`):
   - `DeviceCommand` (line 21)
   - `CommandResult` (line 58)
   - `CommandExecutionResponse` (line 71)
   - `TemplateExecutionRequest` (line 82)
   - `TemplateExecutionResult` (line 130)
   - `TemplateExecutionResponse` (line 141)

2. **Credential resolution logic inside the router** — `execute_commands` (lines 152–329, ~177 lines) and `execute_template` (lines 407–915, ~508 lines) each contain full credential resolution, validation, and execution orchestration that should be in the service layer (`services/network/automation/netmiko.py` already exists — the router should delegate to it).

**Fix:** Move models to `models/netmiko.py`. Move business logic into `NetmikoService`.

---

### `services/agents/deployment_service.py` — 918 lines

**Problem:** `AgentDeploymentService` has only 5 methods but two of them are monoliths:
- `deploy()` (lines 37–398) — **362 lines** handling SSH connection, template rendering, file transfer, verification, activation, and progress updates all in one method
- `deploy_multi()` (lines 399–762) — **364 lines** parallel version of the same

**Fix:** Extract sub-responsibilities:
- `_connect_and_transfer()` — SSH + file upload logic
- `_verify_deployment()` — verification steps
- `_activate_agent()` already extracted (line 763) — good pattern to follow

---

### `services/nautobot/devices/creation.py` — 877 lines

Already modular internally (multiple methods), but large. Review if further extraction to sub-services is warranted (e.g., a dedicated `InterfaceCreationService` or `IPAssignmentService`).

---

### `services/inventory/query_service.py` — 839 lines

**Problem:** `InventoryQueryService` has 17 methods, several of which contain inline GraphQL queries. `_query_devices_by_ip_prefix()` (lines 503–607, ~104 lines) constructs a multi-level nested GraphQL query inline and contains branching namespace logic.

Also: the class uses `import service_factory` inside a method (`_query_devices_by_ip_prefix`), which is a circular import workaround — a sign the dependency should be injected instead.

---

### `tasks/scan_prefixes_task.py` — 814 lines

**Problem:** `_execute_scan_prefixes()` (lines 349–777) is a **429-line single function** that handles: job run creation, prefix fetching, CIDR expansion, ping execution, DNS resolution, Nautobot updates, sub-task splitting, and result reporting. This is an entire service compressed into one function.

**Fix:** Extract to `services/network/scanning/prefix_scan_service.py`.

---

## 3. Duplicate Class Definitions

### `EncryptionService` — defined in two files

**Location 1:** `credentials_manager.py:45`
```python
class EncryptionService:
    def __init__(self, secret: str):
        self._fernet = Fernet(_build_key(secret))
    def encrypt(self, plaintext: str) -> bytes:
        return self._fernet.encrypt(plaintext.encode("utf-8"))
    def decrypt(self, token: bytes) -> str:
        return self._fernet.decrypt(token).decode("utf-8")
```

**Location 2:** `compliance_manager.py:33`
```python
class EncryptionService:
    def __init__(self, secret: str):
        self.fernet = Fernet(_build_key(secret))  # public attribute vs private
    def encrypt(self, plaintext: str) -> bytes:
        return self.fernet.encrypt(plaintext.encode("utf-8"))
    def decrypt(self, encrypted: bytes) -> str:
        return self.fernet.decrypt(encrypted).decode("utf-8")  # different error handling
```

**Differences:** Private `_fernet` vs public `fernet`; different parameter names; different exception messages.

**Fix:** Extract a canonical `EncryptionService` to `core/crypto.py` or `services/crypto/encryption.py`. Both managers import from there.

---

### `DeviceNormalizationService` — defined in two files

**Location 1 (old monolith):** `services/checkmk/normalization.py:16` — 720-line file, contains the entire normalization logic in one class.

**Location 2 (new modular):** `services/checkmk/normalization/device_normalizer.py:19` — 289-line file, orchestrates sub-normalizers (`FieldNormalizer`, `IPNormalizer`, `SNMPNormalizer`, `TagNormalizer`).

**Critical:** `service_factory.py:221` imports from the **old monolith**:
```python
from services.checkmk.normalization import DeviceNormalizationService
```
This means the refactored `normalization/` package is **dead code** — nothing uses it.

**Fix:** 
1. Update `service_factory.py` to `from services.checkmk.normalization.device_normalizer import DeviceNormalizationService`
2. Delete `services/checkmk/normalization.py` (the 720-line monolith)
3. Verify `services/checkmk/normalization/__init__.py` exports the correct class

---

## 4. Pydantic Models Defined Inside Routers

CLAUDE.md mandates models in `models/{domain}.py`. **32 Pydantic `BaseModel` subclasses** are currently defined inside router files.

Full list by file:

| Router File | Model Classes |
|---|---|
| `routers/network/automation/netmiko.py` | `DeviceCommand`, `CommandResult`, `CommandExecutionResponse`, `TemplateExecutionRequest`, `TemplateExecutionResult`, `TemplateExecutionResponse` |
| `routers/nautobot/stacks.py` | `StackDeviceInfo`, `ProcessStacksRequest`, `DeviceResult`, `ProcessStacksResponse` |
| `routers/nautobot/rack_mappings.py` | `MappingEntry`, `RackMappingItem`, `RackMappingsCreate` |
| `routers/nautobot/rack_reservations.py` | `RackReservationCreate` |
| `routers/nautobot/tools/scan_and_add.py` | `ScanStartRequest`, `ScanStartResponse`, `ScanProgress`, `ScanStatusResponse` |
| `routers/tools/certificates.py` | `CertificateInfo`, `ScanResponse`, `AddCertificateRequest`, `AddCertificateResponse` |
| `routers/auth/profile.py` | `PersonalCredentialData`, `ProfileResponse`, `ProfileUpdateRequest` |
| `routers/settings/connections/config.py` | `ConfigFileContent` |

**Fix per file:**
- `netmiko.py` → `models/netmiko.py`
- `stacks.py` → `models/nautobot.py` (extend existing file)
- `rack_mappings.py` / `rack_reservations.py` → `models/nautobot.py`
- `scan_and_add.py` → `models/nautobot.py`
- `certificates.py` → `models/tools.py` (new)
- `profile.py` → `models/auth.py` (extend existing)
- `config.py` → `models/settings.py` (extend existing)

---

## 5. Business Logic Inside Celery Tasks

The Celery task should be a thin entry point (20–50 lines) that: validates inputs, creates a job run, delegates to a service, handles errors. Several tasks contain the entire implementation inline.

### `tasks/onboard_device_task.py` — 775 lines

Functions that should be in a service:
- `_process_single_device()` (lines 236–404) — 168 lines
- `_trigger_nautobot_onboarding()` (lines 405–462) — 57 lines
- `_wait_for_job_completion()` (lines 463–558) — 95 lines
- `_get_device_id_from_ip()`, `_async_get_device_id()`, `_update_device_tags()`, `_update_device_custom_fields()`, `_sync_network_data()` — all business functions

**Correct target:** `services/nautobot/onboarding/onboarding_service.py` (note: `services/nautobot/offboarding/service.py` exists as a pattern reference).

### `tasks/scan_prefixes_task.py` — 814 lines

`_execute_scan_prefixes()` at lines 349–777 is **429 lines** — an entire service compressed into one private function. It handles: job run lifecycle, prefix fetching from Nautobot, CIDR expansion, ping execution, DNS resolution, Nautobot IP status updates, sub-task spawning logic.

**Correct target:** `services/network/scanning/prefix_scan_service.py`

### `tasks/import_or_update_from_csv_task.py` — 992 lines

See section 2. `_run_csv_import()` alone is 397 lines.

---

## 6. f-String Logging Violations

CLAUDE.md: **"❌ using f-string in Logging"**

3 violations in `user_db_manager.py`:

```python
# Line 333
logging.getLogger(__name__).warning(f"Failed to seed RBAC: {e}")
# Line 385
logging.getLogger(__name__).warning(f"Failed to create default admin: {e}")
# Line 405
logging.getLogger(__name__).warning(f"Failed to ensure admin RBAC role: {e}")
```

**Fix:**
```python
logging.getLogger(__name__).warning("Failed to seed RBAC: %s", e)
logging.getLogger(__name__).warning("Failed to create default admin: %s", e)
logging.getLogger(__name__).warning("Failed to ensure admin RBAC role: %s", e)
```

---

## 7. Duplicate / Fragmented Pydantic Model Files for Jobs Domain

Three separate files cover the same domain:

| File | Lines | Contents |
|---|---|---|
| `models/job_models.py` | 125 | `JobStatus`, `JobType` enums; generic job models (`JobResponse`, etc.) |
| `models/jobs.py` | 184 | `JobScheduleBase`, `JobScheduleCreate`, `JobScheduleUpdate`, `JobScheduleResponse` |
| `models/job_templates.py` | 451 | `JobTemplateType`, `DeployTemplateEntry`, `JobTemplateCreate`, `JobTemplateResponse`, etc. |

These are logically related and should either be one `models/jobs.py` with clear sections, or named to reflect their specific sub-domains: `models/job_schedules.py`, `models/job_templates.py`, `models/job_runs.py`. Currently `job_models.py` is the odd one out (its enums are likely duplicated elsewhere).

---

## 8. Circular Import Workarounds (Symptom of Dependency Problems)

Several files use **lazy imports inside methods** to avoid circular imports — a sign of architectural coupling issues:

```python
# services/inventory/query_service.py:503
async def _query_devices_by_ip_prefix(self, ...):
    import service_factory  # lazy import to avoid circular
    nautobot_service = service_factory.build_nautobot_service()
```

This pattern appears in:
- `services/inventory/query_service.py` (inside method)
- `services/agents/template_render_service.py` (inside method)
- `services/inventory/git_storage_service.py` (3 methods)
- All tasks using `import job_run_manager` inside task body

**Fix:** Inject dependencies through constructor or `service_factory.py` instead of lazy importing inside methods.

---

## 9. What Is Well-Structured (Do Not Break)

These areas follow the CLAUDE.md standard correctly and should be used as reference patterns:

- **`services/checkmk/`** — well decomposed into `client/`, `sync/`, `normalization/` subdirectories with focused classes
- **`services/nautobot/`** — resolver/manager/facade pattern correctly implemented
- **`services/settings/git/`** — split into `service.py`, `auth.py`, `cache.py`, `operations.py`, `connection.py`, `diff.py`
- **`repositories/`** — complete coverage of all domains with proper `BaseRepository` inheritance
- **`service_factory.py`** — correct pattern for dependency wiring; new services should be registered here
- **`dependencies.py`** — correct FastAPI `Depends()` pattern
- **`tasks/execution/`** — executor pattern (`base_executor.py` + specialized executors) is good; some executors are still large

---

## Prioritized Refactoring Plan

### Priority 1 — Quick Wins (< 1 day each, low risk)

| Task | Files Affected | Risk |
|---|---|---|
| Fix 3 f-string logging violations | `user_db_manager.py:333,385,405` | None |
| Fix `service_factory.py` to use modular normalization | `service_factory.py:221` | Low |
| Delete dead `services/checkmk/normalization.py` monolith | 1 file deleted | Low (verify no other importers first) |
| Extract shared `EncryptionService` to `core/crypto.py` | `credentials_manager.py`, `compliance_manager.py` | Low |

### Priority 2 — Model Migration (1–2 days, low risk)

| Task | Files Affected |
|---|---|
| Move netmiko Pydantic models to `models/netmiko.py` | `routers/network/automation/netmiko.py`, new `models/netmiko.py` |
| Move remaining 26 inline models to proper `models/` files | 7 router files, ~5 model files |
| Consolidate `models/job_models.py` duplicates | `models/job_models.py`, `models/jobs.py`, `models/job_templates.py` |

### Priority 3 — Service Extraction (3–5 days each, medium risk)

| Task | New File | Impact |
|---|---|---|
| Extract git file operations from router | `services/settings/git/file_service.py` | `routers/settings/git/files.py` slims to ~200 lines |
| Extract scan prefixes business logic | `services/network/scanning/prefix_scan_service.py` | `tasks/scan_prefixes_task.py` slims to ~50 lines |
| Extract CSV import business logic | `services/nautobot/import/csv_import_service.py` | `tasks/import_or_update_from_csv_task.py` slims to ~80 lines |
| Extract prefix update business logic | `services/nautobot/import/prefix_update_service.py` | `tasks/update_ip_prefixes_from_csv_task.py` slims to ~80 lines |
| Extract device onboarding logic | `services/nautobot/onboarding/onboarding_service.py` | `tasks/onboard_device_task.py` slims to ~50 lines |
| Split `AgentDeploymentService.deploy()` | Sub-methods in existing file | 362-line method → 4–5 focused methods |

### Priority 4 — Manager Migration (1–2 weeks, high impact)

Migrate root-level managers to the `services/` layer. Recommended order (least to most coupled):

1. `profile_manager.py` → `services/auth/profile_service.py` (152 lines, few callers)
2. `git_repositories_manager.py` → `services/settings/git/repository_service.py` (214 lines)
3. `settings_manager.py` → already a shim, delete after updating callers
4. `compliance_manager.py` → `services/compliance/compliance_service.py` (538 lines)
5. `rbac_manager.py` → `services/auth/rbac_service.py` (596 lines)
6. `credentials_manager.py` → `services/settings/credentials_service.py` (597 lines)
7. `user_db_manager.py` → `services/auth/user_service.py` (409 lines)
8. `template_manager.py` → `services/templates/template_service.py` (525 lines)
9. `jobs_manager.py` → `services/jobs/job_schedule_service.py` (416 lines)
10. `job_template_manager.py` → `services/jobs/job_template_service.py` (669 lines)
11. `job_run_manager.py` → `services/jobs/job_run_service.py` (400 lines, 40+ callers in tasks)

**Migration pattern for each:**
1. Create `services/{domain}/{name}_service.py` wrapping or replacing the manager
2. Register factory function in `service_factory.py`
3. Add `Depends()` in `dependencies.py` for FastAPI callers
4. Update all router imports to use `Depends(get_{name}_service)`
5. Update all task/service imports to use `service_factory.build_{name}_service()`
6. Delete old `*_manager.py` file
7. Verify with grep that no imports remain

---

## File-Level Reference

### Files To Delete (After Migration)
- `services/checkmk/normalization.py` (monolith, replaced by `normalization/` package)
- `settings_manager.py` (already a shim)
- All `*_manager.py` files after their services are created

### Files To Create (New Services)
- `core/crypto.py` — shared `EncryptionService`
- `models/netmiko.py` — Netmiko Pydantic models
- `models/tools.py` — Certificate and tool models
- `services/jobs/job_template_service.py`
- `services/jobs/job_run_service.py`
- `services/jobs/job_schedule_service.py`
- `services/auth/rbac_service.py`
- `services/auth/user_service.py`
- `services/auth/profile_service.py`
- `services/settings/credentials_service.py`
- `services/compliance/compliance_service.py`
- `services/settings/git/file_service.py`
- `services/settings/git/repository_service.py`
- `services/nautobot/onboarding/onboarding_service.py`
- `services/nautobot/import/csv_import_service.py`
- `services/nautobot/import/prefix_update_service.py`
- `services/network/scanning/prefix_scan_service.py`

### Files To Shrink (Business Logic Extraction)
- `routers/settings/git/files.py` 1002→~200 lines
- `routers/network/automation/netmiko.py` 928→~300 lines
- `tasks/scan_prefixes_task.py` 814→~50 lines
- `tasks/import_or_update_from_csv_task.py` 992→~80 lines
- `tasks/update_ip_prefixes_from_csv_task.py` 961→~80 lines
- `tasks/onboard_device_task.py` 775→~50 lines
- `services/agents/deployment_service.py` 918→~400 lines (method decomposition)
