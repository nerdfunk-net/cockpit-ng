# Refactoring Plan — Python Code Review Findings

**Date:** 2026-03-22
**Source:** [FINDING_PYTHON_REVIEW.md](./FINDING_PYTHON_REVIEW.md)
**Findings verified:** All 14 confirmed against codebase
**Status:** Phase 1 (CRITICAL) and Phase 2 (HIGH) completed, plus 3.2 and 3.6 from Phase 3

---

## Phase 1 — CRITICAL (Security)

### 1.1 URL Parameter Injection via Unencoded Query Strings

**Finding:** CRITICAL-1
**Files:**
- `backend/routers/nautobot/interfaces.py:81–82`
- `backend/routers/nautobot/ip_addresses.py:77–78`
- `backend/routers/nautobot/prefixes.py:66–67`

**Problem:** Query parameters are joined via f-string (`f"{k}={v}"`) without percent-encoding. Special characters in values (e.g., `/` in CIDR notation, `&`, `=`, `#`) corrupt or inject parameters into upstream Nautobot REST requests.

**Fix:**
1. Replace the manual query string construction in all three files:
   ```python
   # Remove
   query_string = "&".join([f"{k}={v}" for k, v in params.items()])
   endpoint = f"{endpoint}?{query_string}"

   # Replace with
   from urllib.parse import urlencode
   endpoint = f"{endpoint}?{urlencode(params)}"
   ```
2. Add `from urllib.parse import urlencode` at module level in each file.

**Scope:** 3 files, ~2 lines each
**Verification:** Unit test with a parameter containing `/` (e.g., `10.0.0.0/8`) — confirm the upstream URL is correctly encoded.

---

### 1.2 paramiko.AutoAddPolicy() — SFTP Host Key Never Verified

**Finding:** CRITICAL-2
**File:** `backend/routers/settings/common.py:599`

**Problem:** `ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())` silently accepts any host key, enabling MITM attacks. The endpoint handles user-provided SFTP credentials.

**Fix:**
1. Replace `AutoAddPolicy()` with `RejectPolicy()` as the default.
2. Load system host keys first:
   ```python
   ssh.load_system_host_keys()
   ssh.set_missing_host_key_policy(paramiko.RejectPolicy())
   ```
3. Consider adding a `known_hosts` file path to the SFTP configuration model so admins can supply trusted host keys.
4. Optionally add a `skip_host_key_check: bool` field (default `False`) for development/testing with a clear warning log.

**Scope:** 1 file, ~5 lines changed + possible model addition
**Verification:** Test with a known host (should succeed) and an unknown host (should raise exception). Confirm credentials are not sent before host key verification.

---

## Phase 2 — HIGH (Correctness & Maintainability)

### 2.1 `except Exception` Swallows `HTTPException`

**Finding:** HIGH-1
**File:** `backend/routers/settings/rbac.py:451`

**Problem:** In `assign_permission_to_user`, a 404 `HTTPException` raised at line 444 is caught by the broad `except Exception` at line 451, converting it to a 500 error.

**Fix:**
Add `except HTTPException: raise` before the broad `except`, matching the pattern already used in `get_user`, `update_user`, `delete_user` in the same file:
```python
except HTTPException:
    raise
except Exception as e:
    logger.error(...)
    raise HTTPException(status_code=500, ...)
```

**Scope:** 1 file, 2 lines added
**Verification:** Call the endpoint with a non-existent permission ID — confirm it returns 404, not 500.

---

### 2.2 Fragile `"404" in str(e)` Error Detection

**Finding:** HIGH-2
**Files:**
- `backend/routers/nautobot/interfaces.py:122, 279, 322`
- `backend/routers/nautobot/ip_addresses.py:504, 638, 681`
- `backend/routers/nautobot/prefixes.py:105, 242, 285`

**Problem:** 404 detection relies on string matching (`"404" in str(e)`) which can false-positive on IPs, UUIDs, or unrelated messages, and false-negative on differently formatted 404 responses.

**Fix (two-part):**
1. **NautobotService client** (`backend/services/nautobot/client.py`): Raise a typed `NautobotNotFoundError` when the upstream HTTP response is 404.
   ```python
   # In backend/services/nautobot/common/exceptions.py
   class NautobotNotFoundError(Exception):
       pass
   ```
2. **Router files**: Replace `"404" in str(e)` with `except NautobotNotFoundError`:
   ```python
   except NautobotNotFoundError:
       raise HTTPException(status_code=404, detail="Resource not found")
   except Exception as e:
       raise HTTPException(status_code=500, detail=str(e))
   ```

**Scope:** 1 new exception class, 1 client change, 9 catch sites across 3 files
**Verification:** Mock a 404 from Nautobot — confirm `NautobotNotFoundError` is raised. Mock a non-404 error whose message contains "404" — confirm it returns 500.

---

### 2.3 Excessive `logger.info` in `create_virtual_machine`

**Finding:** HIGH-3
**File:** `backend/routers/nautobot/clusters.py:215–648`

**Problem:** ~98 `logger.info()` calls including banner separators (`"=" * 80`) in a single function. This floods production logs and violates the CLAUDE.md rule against f-strings in logging.

**Fix:**
1. Downgrade all banner/phase/step messages to `logger.debug()`.
2. Keep only 2–3 `logger.info()` calls: request received, VM created (with ID), and error summary.
3. Fix any f-string logging calls to use `%s` formatting.

**Scope:** 1 file, ~95 line changes (level change only)
**Verification:** Set log level to INFO — confirm only entry/exit messages appear. Set to DEBUG — confirm full trace is available.

---

### 2.4 `audit_log_repo` Imported Inside Function Bodies

**Finding:** HIGH-4
**Files:** `rbac.py`, `credentials.py`, `common.py`, `clusters.py`, `interfaces.py`, `ip_addresses.py`, `prefixes.py`, `ip_interface_mapping.py` (19+ call sites across 8+ files)

**Problem:** `from repositories.audit_log_repository import audit_log_repo` appears inside function bodies, violating PEP 8 and hiding the dependency from static analysis.

**Fix:**
Move the import to module level in each file that uses it. If the import was placed inside functions to avoid circular imports, resolve the cycle (likely not the case here — the repository has no dependency on routers).

**Scope:** 8+ files, 1 import addition + 19 inline import deletions
**Verification:** Run `ruff check` and confirm no import errors. Run existing tests to confirm no circular import issues.

---

### 2.5 Functions with 18–21 Parameters

**Finding:** HIGH-5
**File:** `backend/tasks/import_or_update_from_csv_task.py:544, 708`

**Problem:** `_process_single_object` has 18 parameters; `_process_cockpit_rows` has 21. Mutable accumulator lists (`created`, `updated`, `skipped`, `failures`) are passed by reference, making state flow implicit.

**Fix:**
Introduce an `ImportContext` dataclass to bundle related parameters:
```python
@dataclass
class ImportContext:
    nautobot_service: NautobotService
    device_import_service: DeviceImportService
    device_update_service: DeviceUpdateService
    created: list[dict]
    updated: list[dict]
    skipped: list[dict]
    failures: list[dict]
    dry_run: bool
    add_prefixes: bool
    default_prefix_length: str | None
```
Update both functions and all call sites to pass `ctx: ImportContext` instead of individual parameters.

**Scope:** 1 file, ~50 lines refactored + dataclass definition
**Verification:** Run existing CSV import unit tests (`test_import_or_update_from_csv_task.py`). All must pass unchanged.

---

### 2.6 `typing.List` on Python 3.9+ Project

**Finding:** HIGH-6
**File:** `backend/routers/settings/rbac.py:12` (and other files)

**Problem:** `from typing import List` and `List[X]` annotations are used inconsistently. Python 3.9+ supports `list[X]` natively.

**Fix:**
1. Remove `from typing import List` imports.
2. Replace `List[X]` with `list[X]` throughout.
3. Do the same for `Dict`, `Tuple`, `Set`, `Optional` where applicable.

**Scope:** Multiple files, mechanical find-and-replace
**Verification:** Run `ruff check` to confirm no type annotation errors. Run tests.

---

## Phase 3 — MEDIUM (Code Quality)

### 3.1 `print()` in Startup Scripts

**Finding:** MEDIUM-1
**Files:** `backend/cert_installer.py:30–87`, `backend/start_celery.py:73–215`

**Problem:** Diagnostic output uses `print()` instead of `logging`, bypassing structured log streams in containerized deployments.

**Fix:**
1. Configure logging early in each script.
2. Replace `print()` with `logging.info()` / `logging.warning()`.
3. Exception: `print()` is acceptable in `start_celery.py` before logging is configured (pre-boot banner only).

**Scope:** 2 files, ~20 print replacements
**Verification:** Run each script and confirm output appears in structured log format.

---

### 3.2 Unreachable `return None`

**Finding:** MEDIUM-2
**File:** `backend/tasks/import_or_update_from_csv_task.py:1004`

**Problem:** Dead code — `return None` follows exhaustive branches that all return.

**Fix:** Delete line 1004.

**Scope:** 1 file, 1 line
**Verification:** Run tests. Optionally confirm with coverage that the line was never reached.

---

### 3.3 Duplicated Admin-Check Across 3 Endpoints

**Finding:** MEDIUM-3
**File:** `backend/routers/settings/rbac.py:331–338, 393–399, 421–427`

**Problem:** Identical self-or-admin guard is copy-pasted across three endpoints with an extra DB round-trip each time.

**Fix:**
Extract a reusable FastAPI dependency:
```python
def require_self_or_admin(user_id: int, current_user: dict = Depends(verify_token)):
    if current_user["user_id"] != user_id:
        user_roles = rbac.get_user_roles(current_user["user_id"])
        if not any(role["name"] == "admin" for role in user_roles):
            raise HTTPException(status_code=403, detail="Forbidden")
    return current_user
```
Apply as a dependency in the three endpoints.

**Scope:** 1 file, ~20 lines changed
**Verification:** Test each endpoint as self-user, admin, and non-admin — confirm correct 200/403 responses.

---

### 3.4 PUT and PATCH Both Send PATCH Upstream

**Finding:** MEDIUM-4
**Files:**
- `backend/routers/nautobot/interfaces.py:218–219`
- `backend/routers/nautobot/prefixes.py:187–188`
- `backend/routers/nautobot/ip_addresses.py:585–586`

**Problem:** Both HTTP verbs route to the same function which unconditionally calls `method="PATCH"` on the Nautobot client.

**Fix:**
Use `fastapi.Request` to detect the inbound method and forward it:
```python
from fastapi import Request

async def update_resource(..., request: Request):
    method = request.method  # "PUT" or "PATCH"
    result = await nautobot_service.rest_request(endpoint, method=method, data=data)
```

**Scope:** 3 files, ~3 lines each
**Verification:** Send a PUT request — confirm Nautobot receives PUT. Send PATCH — confirm Nautobot receives PATCH.

---

### 3.5 Delete Audit Logs Store Integer ID as `resource_name`

**Finding:** MEDIUM-5
**Files:**
- `backend/routers/settings/credentials.py:149`
- `backend/routers/settings/rbac.py:199–200, 685–686, 718–723`

**Problem:** `resource_name=str(cred_id)` or `str(role_id)` makes audit logs unreadable.

**Fix:**
Fetch the resource name before deletion and pass it to the audit log:
```python
credential = credential_repo.get_by_id(cred_id)
# ... delete ...
audit_log_repo.create_log(resource_name=credential.name if credential else str(cred_id), ...)
```
Apply the same pattern for role and user deletions.

**Scope:** 2 files, ~10 lines changed
**Verification:** Delete a resource, check audit log — confirm human-readable name is stored.

---

### 3.6 `group: str = None` Missing `Optional`

**Finding:** MEDIUM-6
**File:** `backend/routers/nautobot/clusters.py:38`

**Problem:** Type annotation `str` with default `None` is incorrect — mypy/type checkers flag this.

**Fix:**
```python
group: str | None = None
```

**Scope:** 1 file, 1 line
**Verification:** Run `ruff check` or `mypy` — confirm no type annotation warning.

---

## Implementation Order

| Order | ID | Phase | Scope | Risk | Status |
|-------|----|-------|-------|------|--------|
| 1 | 1.1 | Critical | 3 files | Low (mechanical) | ✅ Done |
| 2 | 1.2 | Critical | 1 file | Medium (behavior change) | ✅ Done |
| 3 | 2.1 | High | 1 file | Low (2-line addition) | ✅ Done |
| 4 | 2.2 | High | 4 files | Medium (new exception type) | ✅ Done |
| 5 | 2.4 | High | 8 files | Low (mechanical) | ✅ Done |
| 6 | 2.3 | High | 1 file | Low (level changes only) | ✅ Done |
| 7 | 2.5 | High | 1 file | Medium (refactor) | ✅ Done |
| 8 | 2.6 | High | Multiple | Low (mechanical) | ✅ Done |
| 9 | 3.2 | Medium | 1 file | None | ✅ Done |
| 10 | 3.6 | Medium | 1 file | None | ✅ Done |
| 11 | 3.1 | Medium | 2 files | Low | Pending |
| 12 | 3.3 | Medium | 1 file | Low | Pending |
| 13 | 3.4 | Medium | 3 files | Low | Pending |
| 14 | 3.5 | Medium | 2 files | Low | Pending |

## Verification (End-to-End)

After all changes:
1. `ruff check backend/` — no new warnings
2. `pytest` — all existing tests pass
3. Manual smoke test: start backend, exercise Nautobot CRUD endpoints, SFTP connection test, CSV import, RBAC user/role/permission operations
4. Review audit log table for human-readable names after delete operations
