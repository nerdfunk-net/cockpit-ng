# Python Code Review Findings

**Date:** 2026-03-22
**Commits reviewed:** 9d2053c, 7267cf1, a94b12c (plus 1f4a7d2 / 0b23aad — Python-free)
**Ruff status:** All checks passed
**Static analysis:** ruff only (mypy, bandit, black not installed)

---

## VERDICT: ❌ Block — 2 CRITICAL, 6 HIGH, 6 MEDIUM

---

## CRITICAL

### [CRITICAL-1] URL parameter injection via unencoded query strings

**Files:**
- `backend/routers/nautobot/interfaces.py:81–82`
- `backend/routers/nautobot/ip_addresses.py:77–78`
- `backend/routers/nautobot/prefixes.py:66–67`

**Issue:** Query parameters received from API callers are interpolated raw into URL strings via f-string concatenation without percent-encoding. Values like `10.0.0.0/8` (containing `/`), or anything with `&`, `=`, `#`, or spaces will silently corrupt or inject additional parameters into upstream Nautobot REST requests.

```python
# ❌ Current
query_string = "&".join([f"{k}={v}" for k, v in params.items()])
endpoint = f"{endpoint}?{query_string}"
```

```python
# ✅ Fix
from urllib.parse import urlencode
endpoint = f"dcim/interfaces/?{urlencode(params)}"
```

---

### [CRITICAL-2] `paramiko.AutoAddPolicy()` — SFTP host key never verified

**File:** `backend/routers/settings/common.py:599`

**Issue:** The SFTP connection test uses `ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())`, which silently accepts any host key. This enables man-in-the-middle attacks. The endpoint handles user-provided credentials (`test_request.sftp_password`), meaning an attacker who can reach this endpoint can exfiltrate credentials to a rogue server.

```python
# ❌ Current
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
```

```python
# ✅ Fix — load known hosts or reject unknown keys
ssh.load_system_host_keys()
# or: ssh.set_missing_host_key_policy(paramiko.RejectPolicy())
```

At minimum, restrict the endpoint to admin-only users (currently only requires `settings.nautobot:write`).

---

## HIGH

### [HIGH-1] `except Exception` swallows `HTTPException` in `assign_permission_to_user`

**File:** `backend/routers/settings/rbac.py:451`

**Issue:** The handler catches `Exception` after an explicit `HTTPException` guard. Because `HTTPException` is raised *inside* the `try` block (line 444–446) and is also an `Exception` subclass, it gets caught by the broad `except` — resulting in a 500 instead of a 404 when the permission is not found. The pattern `except HTTPException: raise` is used correctly elsewhere in the same file (`get_user`, `update_user`, `delete_user`) but missing here.

```python
# ✅ Fix — add before the broad except
except HTTPException:
    raise
except Exception as e:
    ...
```

---

### [HIGH-2] Fragile `"404" in str(e)` error detection

**Files:**
- `backend/routers/nautobot/interfaces.py:122, 279, 322`
- `backend/routers/nautobot/ip_addresses.py:504, 638, 681`
- `backend/routers/nautobot/prefixes.py:105, 242, 285`

**Issue:** 404 conditions are detected via `"404" in str(e)`. This is unreliable — the string `"404"` can appear in an IP address (e.g., `10.4.0.4`), a UUID fragment, or an unrelated error message. It can produce false 404 responses for unrelated errors and miss actual 404s from Nautobot.

**Fix:** `NautobotService` client should raise a typed exception (e.g., `NautobotNotFoundError`) for HTTP 404 responses:
```python
# ✅ Fix
except NautobotNotFoundError:
    raise HTTPException(status_code=404, detail="Resource not found")
```

---

### [HIGH-3] 50+ `logger.info` banner calls in `create_virtual_machine`

**File:** `backend/routers/nautobot/clusters.py:215–648`

**Issue:** The endpoint contains 50+ `logger.info(...)` calls including separator banners (`"=" * 80`), emoji characters, and phase announcements that appear in every production log stream for every VM creation request. At scale this fills log storage and obscures meaningful entries. The CLAUDE.md also prohibits f-strings in logging calls.

**Fix:** Downgrade all banner/phase/step messages to `logger.debug()`. Keep `logger.info()` only for high-value entry/exit messages (request received, VM created with ID).

---

### [HIGH-4] `audit_log_repo` imported inside 19 function bodies

**Files:** `rbac.py`, `credentials.py`, `common.py`, `clusters.py`, `interfaces.py`, `ip_addresses.py`, `prefixes.py`, `ip_interface_mapping.py` (19 call sites)

**Issue:** The import `from repositories.audit_log_repository import audit_log_repo` is placed inside every function body that logs an audit event. This violates PEP 8 (imports belong at module level), makes the dependency non-obvious, prevents IDE static analysis from tracking usages, and scatters 19 identical import lines across the codebase.

**Fix:** Move the import to module-level in each file that uses it.

---

### [HIGH-5] Functions with 12–15 parameters

**File:** `backend/tasks/import_or_update_from_csv_task.py:544, 708`

**Issue:** `_process_single_object` takes 15 parameters; `_process_cockpit_rows` takes 16. This makes call sites unreadable, increases coupling, and makes testing difficult. The `created`, `updated`, `skipped`, `failures` lists are mutable accumulators passed by reference — a pattern that makes state flow implicit.

**Fix:** Introduce an `ImportContext` dataclass:
```python
@dataclass
class ImportContext:
    nautobot_service: NautobotService
    device_import_service: DeviceImportService
    device_update_service: DeviceUpdateService
    created: list
    updated: list
    skipped: list
    failures: list
    dry_run: bool
    add_prefixes: bool
    default_prefix_length: int
```

---

### [HIGH-6] `typing.List` used on Python 3.9+ project

**File:** `backend/routers/settings/rbac.py:12` (and other changed files)

**Issue:** The project targets Python 3.9+. `from typing import List` and `List[X]` annotations are unnecessary; `list[X]` works natively. Several files mix both styles inconsistently.

**Fix:** Remove `from typing import List` and replace `List[X]` with `list[X]` throughout. Alternatively, add `from __future__ import annotations` consistently.

---

## MEDIUM

### [MEDIUM-1] `print()` in `cert_installer.py` and `start_celery.py`

**Files:** `backend/cert_installer.py:30–87`, `backend/start_celery.py:73–215`

**Issue:** Both startup scripts emit diagnostic output exclusively via `print()`. In containerised deployments this bypasses the structured log stream. CLAUDE.md explicitly prohibits `print()` in favour of `logging`.

**Fix:** Replace `print()` with `logging.info()` / `logging.warning()` etc. For pre-boot startup banners in `start_celery.py`, `print()` is acceptable only before the logging system is configured.

---

### [MEDIUM-2] Unreachable `return None` statement

**File:** `backend/tasks/import_or_update_from_csv_task.py:1004`

**Issue:** Line 1004 (`return None`) is dead code — it follows an exhaustive `if/elif/elif` with `return` in each branch and an `except` clause that also returns. Likely a copy-paste leftover.

**Fix:** Remove line 1004.

---

### [MEDIUM-3] Admin-check duplicated across 3 endpoints with extra DB round-trip

**File:** `backend/routers/settings/rbac.py:331–338, 393–399, 421–427`

**Issue:** The self-service access check fetches caller roles from the database via `rbac.get_user_roles(current_user["user_id"])` and does `any(role["name"] == "admin" ...)`. This pattern is repeated identically in three endpoints and adds an unnecessary DB query per request. The JWT token already carries permission information.

**Fix:** Centralise the self-or-admin guard as a reusable FastAPI dependency and check JWT claims instead of issuing a DB query.

---

### [MEDIUM-4] `PUT` and `PATCH` both call `PATCH` upstream

**Files:** `backend/routers/nautobot/interfaces.py:218–219`, `prefixes.py:187–188`, `ip_addresses.py` (same pattern)

**Issue:** Both HTTP verbs route to the same function which unconditionally calls `method="PATCH"` on the Nautobot REST client. A `PUT` call from the client receives a `PATCH` sent upstream — semantically incorrect (`PUT` is full replacement, `PATCH` is partial update).

**Fix:** Detect the HTTP method at runtime via `fastapi.Request.method` and forward it, or create separate endpoint functions for `PUT` and `PATCH`.

---

### [MEDIUM-5] Delete audit logs store integer ID as `resource_name`

**Files:** `credentials.py:149`, `rbac.py:199–200, 685–686, 718–723`

**Issue:** Delete operations set `resource_name=str(cred_id)` or `resource_name=str(role_id)`. An integer ID is meaningless as a human-readable name in an audit log.

**Fix:** Fetch the resource name before deletion and pass it to the audit log call. If unavailable, pass `None` explicitly rather than converting an ID to string.

---

### [MEDIUM-6] `group: str = None` missing `Optional`

**File:** `backend/routers/nautobot/clusters.py:38`

**Issue:** Query parameter declared as `group: str = None` assigns a `None` default to a non-optional type. FastAPI handles it at runtime but mypy and type checkers will flag it.

**Fix:**
```python
# ✅ Fix
from typing import Optional
group: Optional[str] = None
# or on Python 3.10+
group: str | None = None
```

---

## Priority Fix Order

| Priority | Issue | File(s) |
|----------|-------|---------|
| 1 | `urllib.parse.urlencode` for query strings | `interfaces.py`, `ip_addresses.py`, `prefixes.py` |
| 2 | `paramiko.AutoAddPolicy()` → `RejectPolicy()` / known-hosts | `common.py` |
| 3 | `except HTTPException: raise` guard | `rbac.py` |
| 4 | Move `audit_log_repo` imports to module level | 8 files |
| 5 | Reduce `logger.info` verbosity | `clusters.py` |
| 6 | Typed exceptions for Nautobot 404 detection | `interfaces.py`, `ip_addresses.py`, `prefixes.py` |
