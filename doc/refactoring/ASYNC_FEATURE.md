# Async feature — audit & remediation plan

Static analysis of the backend after the recent async-enabled features
(VM management, server management, Nautobot infrastructure endpoints)
revealed **7 classes of defects** across 15+ files.  This document records
the precise findings, the exact changes required for each, and the
acceptance criteria to verify the fix.  All file paths are relative to
`backend/`.

---

## 1. Issue inventory

| # | Severity | Category | Files |
|---|----------|----------|-------|
| A | **CRITICAL** | `async def` handlers block event loop with sync DB calls | `routers/servers/servers.py` |
| B | **CRITICAL** | Duplicate Nautobot API calls — every IP fetched twice on VM update | `services/nautobot/virtualization/vm_interface_workflow.py` |
| C | **MEDIUM** | Deprecated `asyncio.get_event_loop()` inside `async def` | `services/network/automation/netmiko.py`, `connection_tester.py` |
| D | **MEDIUM** | Raw `str(e)` / exception text exposed in JSON response bodies | `routers/settings/` (8 files) |
| E | **MEDIUM** | Debug-era visual separator calls left in production logger | `routers/nautobot/clusters.py` |
| F | **LOW** | `raise Exception(...)` instead of typed exceptions in router | `routers/nautobot/clusters.py` |
| G | **LOW** | Module-level imports deferred inside `async def` handler bodies | `routers/nautobot/infrastructure.py` |

---

## 2. Root-cause analysis

### A — `async def` with blocking synchronous I/O (servers router)

FastAPI dispatches endpoint functions in two modes:

- `async def` → runs directly on the **asyncio event loop**.  Any
  blocking call (e.g., synchronous SQLAlchemy ORM) freezes every
  concurrently running coroutine until it returns.
- `def` (sync) → FastAPI wraps it in
  `asyncio.get_event_loop().run_in_executor(None, ...)`, running it in
  the default `ThreadPoolExecutor`.  Other coroutines can proceed while
  the synchronous work runs in a thread.

`routers/servers/servers.py` declares **all five handlers** as
`async def`, but every handler body calls only synchronous code:

```python
# servers.py:34-54  — actual code
async def list_servers(...) -> ListServersResponse:
    servers = service.get_all()          # ← sync SQLAlchemy ORM
    return ListServersResponse(...)

async def create_server(...) -> ServerResponse:
    server = service.create(request)     # ← sync SQLAlchemy ORM
    return ServerResponse.model_validate(server)
```

`ServersService` (`services/servers/servers_service.py`) and
`ServersRepository` (`repositories/servers/servers_repository.py`)
inherit from `BaseRepository` — every method is synchronous:
`get_all`, `get_by_id`, `create`, `update`, `delete`.  None of these
are awaited, so the `async def` keyword buys nothing and instead
removes the thread-pool wrapper FastAPI would otherwise provide.

### B — Duplicate Nautobot API calls in `vm_interface_workflow.py`

`VirtualMachineInterfaceWorkflow.sync_vm_interfaces` calls
`_ensure_ip_addresses` (line 98), which iterates every interface's
IP list and calls `ensure_ip_address_exists` for each address, storing
results in `ip_address_map: Dict[str, str]` keyed by
`"{interface_name}:{address}"`.

Then the main loop (starting at line 104) iterates the same interfaces
again.  Inside that loop (lines 163–187) it calls **`resolve_namespace_id`
and `ensure_ip_address_exists` again** for every IP — ignoring the
`ip_address_map` that was just built.  The map is only referenced at
line 218 to count `ip_addresses_created=len(ip_address_map)`.

Result: for a VM with N interfaces each having M IPs, the method
performs `N×M` extra Nautobot REST calls for no benefit.

### C — `asyncio.get_event_loop()` deprecated inside coroutines

`asyncio.get_event_loop()` was deprecated in Python 3.10 when called
in contexts where no running event loop is set as the current loop.
Inside an `async def` coroutine there is always a running loop, so
this currently works — but the correct API to retrieve it from
coroutine context has been `asyncio.get_running_loop()` since
Python 3.7.  `get_running_loop()` raises `RuntimeError` immediately if
called outside a running loop, making misuse auditable at test time.
Python 3.12 emits `DeprecationWarning` for `get_event_loop()` even
inside running loops; a future patch release may promote this to an
error.

Affected locations:
- `services/network/automation/netmiko.py:319` — inside
  `execute_commands_on_device` (`async def`)
- `services/network/automation/netmiko.py:379` — inside
  `execute_commands` (`async def`)
- `connection_tester.py:72` — inside an `async def` block

### D — `str(e)` in JSON response bodies (settings routers)

`CLAUDE.md` security rule:

> Never embed raw exception text (`str(e)`, `{exc}`, …) in
> `HTTPException(detail=…)` for server errors. Use
> `core.safe_http_errors.raise_internal_server_error`.

This rule was written to cover `HTTPException`, but the same
information-leakage risk applies when `str(e)` is embedded in any
client-visible JSON field.  The following settings routers return
`{"success": False, "message": f"... {str(e)}"}` patterns:

| File | Lines |
|------|-------|
| `routers/settings/checkmk_settings.py` | 37, 67, 98 |
| `routers/settings/git_settings.py` | 39, 115, 143 |
| `routers/settings/network_defaults.py` | 35, 63 |
| `routers/settings/server_defaults.py` | 35, 63 |
| `routers/settings/cache_settings.py` | 35, 94 |
| `routers/settings/agents_settings.py` | 68, 188, 233 |
| `routers/settings/cache.py` | 45, 61, 75, 88, 122, 139, 171, 192 |
| `routers/settings/common.py` | 136 |

### E — Debug separator log calls in production code (clusters router)

`routers/nautobot/clusters.py` contains repeated blocks of debug-era
visual separators emitted through `logger.error`:

```python
logger.error("")
logger.error("=" * 60)
logger.error("❌ FAILED TO PROCESS IP: %s", ip_data.address)
logger.error("=" * 60)
logger.error("  Error: %s", ip_error)
```

These appear at lines 414–421, 530–537, and 615–619.  Problems:
- Three empty/separator `logger.error("")` calls per error path emit
  noise into structured logging.
- Emoji characters (`❌`, `✗`) are not renderable in all log
  collectors and grep workflows.
- The same information is conveyed by a single `logger.error("...",
  ..., exc_info=True)` call; the separator lines add nothing.

### F — Bare `raise Exception(...)` in router code

`routers/nautobot/clusters.py` raises bare `Exception` at lines 250,
318, 458, and 487:

```python
raise Exception("VM creation succeeded but no ID returned")
raise Exception(f"Interface '{interface_data.name}' created but no ID returned")
raise Exception("Interface creation succeeded but no ID returned")
raise Exception("Could not resolve 'Global' namespace")
```

Bare `Exception` cannot be caught selectively.  The outer
`except Exception as e` block catches everything including
`KeyboardInterrupt`, `SystemExit` subclasses re-routed through
`BaseException`, and genuine programming errors.  Using `RuntimeError`
(or a domain-specific exception) keeps intent clear and allows future
callers to handle specific cases.

### G — Deferred module imports inside `async def` handler bodies

`routers/nautobot/infrastructure.py` places import statements inside
three handler bodies (lines 69, 107, 143):

```python
async def get_racks(...):
    try:
        from services.settings.manager import SettingsManager   # ← inside handler
        settings_manager = SettingsManager()
        ...
```

Python's import system caches modules in `sys.modules` after the first
import, so re-entering the import machinery is cheap — but it still
re-evaluates the import path on every request.  More importantly,
function-scoped imports obscure the handler's dependencies from static
analysis, linters, and `check_router_repositories.py`.

---

## 3. Phased implementation plan

Phases are ordered by severity.  Each phase can be shipped independently.

### Phase 1 — Fix `async def` servers router (Issue A)

**Files changed:** `routers/servers/servers.py` only.

**Rule:** A FastAPI handler should be `async def` if and only if it
contains at least one `await` expression.  Handlers that call only
synchronous code must be `def` so FastAPI runs them in a thread pool.

**Exact changes — replace every `async def` with `def`:**

```python
# BEFORE (routers/servers/servers.py:34)
async def list_servers(
    group_by: Optional[str] = Query(...),
    _: dict = Depends(require_permission("servers", "read")),
    service: ServersService = Depends(get_servers_service),
) -> ListServersResponse:

# AFTER
def list_servers(
    group_by: Optional[str] = Query(...),
    _: dict = Depends(require_permission("servers", "read")),
    service: ServersService = Depends(get_servers_service),
) -> ListServersResponse:
```

Apply the same `async def` → `def` change to:
- `get_server` (line 58)
- `create_server` (line 76)
- `update_server` (line 90)
- `delete_server` (line 109)

No logic changes.  The `async def` keyword is the only edit on each
function signature line.

**Why this is safe:** `require_permission`, `get_servers_service`, and all
`Depends`-injected objects are synchronous.  FastAPI resolves `Depends`
before the handler runs regardless of `async def` vs `def`.  Removing
`async` only changes the dispatch mechanism; no `await` expression
exists in any handler body to break.

**Exit criteria:**
- `grep "async def" routers/servers/servers.py` → no output.
- `python scripts/check_asyncio_run.py` → still passes (no `asyncio.run`
  added).
- `cd backend && python -c "from routers.servers.servers import router"` →
  no import errors.
- Manual smoke test: `GET /api/servers`, `POST /api/servers`,
  `PUT /api/servers/{id}`, `DELETE /api/servers/{id}` all return expected
  status codes.

---

### Phase 2 — Eliminate duplicate Nautobot API calls (Issue B)

**File changed:**
`services/nautobot/virtualization/vm_interface_workflow.py`.

**Root cause recap:** `_ensure_ip_addresses` at line 98 creates every
IP address in Nautobot and returns `ip_address_map: Dict[str, str]`
(`"{iface_name}:{address}" → ip_uuid`).  The main loop at lines 163–187
then calls `ensure_ip_address_exists` again for each IP, ignoring the
map.

**Fix — use `ip_address_map` as a cache in the main loop:**

The main loop's inner IP block (lines 163–192) currently reads:

```python
# CURRENT (lines 163–192)
ip_addresses = interface.get("ip_addresses") or []
for ip_data in ip_addresses:
    address = ip_data.get("address")
    if not address:
        continue

    namespace = ip_data.get("namespace")
    if not namespace:
        warnings.append(...)
        continue

    namespace_id = await self.common.resolve_namespace_id(namespace)
    ip_kwargs: Dict[str, Any] = {}
    if ip_data.get("ip_role"):
        ip_kwargs["role"] = {"id": ip_data["ip_role"]}

    ip_id = await self.ip_manager.ensure_ip_address_exists(
        ip_address=address,
        namespace_id=namespace_id,
        status_name="active",
        add_prefixes_automatically=add_prefixes_automatically,
        **ip_kwargs,
    )

    await self.vm_manager.assign_ip_to_virtual_interface(
        ip_address_id=ip_id,
        virtual_interface_id=interface_id,
    )

    if ip_data.get("is_primary") and not primary_ip_id:
        primary_ip_id = ip_id
```

Replace the block that resolves the namespace and ensures the IP with a
cache lookup:

```python
# AFTER
ip_addresses = interface.get("ip_addresses") or []
for ip_data in ip_addresses:
    address = ip_data.get("address")
    if not address:
        continue

    map_key = f"{iface_name}:{address}"
    ip_id = ip_address_map.get(map_key)
    if not ip_id:
        # _ensure_ip_addresses already warned about this address; skip.
        logger.warning(
            "IP %s on interface %s not in pre-built map, skipping assignment",
            address,
            iface_name,
        )
        continue

    await self.vm_manager.assign_ip_to_virtual_interface(
        ip_address_id=ip_id,
        virtual_interface_id=interface_id,
    )

    if ip_data.get("is_primary") and not primary_ip_id:
        primary_ip_id = ip_id
```

**Verify `ip_addresses_created` counter is still accurate:**  
`ip_address_map` is built in `_ensure_ip_addresses`; its length already
equals the count of successfully created/retrieved IPs, so
`ip_addresses_created=len(ip_address_map)` at line 218 is correct.

**Update `_ensure_ip_addresses` to propagate `ip_role`:**  
`_ensure_ip_addresses` (line 223) already handles `ip_role`:

```python
ip_kwargs: Dict[str, Any] = {}
if ip_data.get("ip_role"):
    ip_kwargs["role"] = {"id": ip_data["ip_role"]}

ip_id = await self.ip_manager.ensure_ip_address_exists(
    ip_address=address,
    namespace_id=namespace_id,
    status_name=interface.get("status") or "active",
    add_prefixes_automatically=add_prefixes_automatically,
    **ip_kwargs,
)
```

Confirm this is already passing `ip_role` before removing the duplicate
block — it is (line 256–260), so no additional change needed there.

**Exit criteria:**
- `grep "ensure_ip_address_exists" services/nautobot/virtualization/vm_interface_workflow.py`
  returns exactly **one** occurrence (inside `_ensure_ip_addresses`,
  line ~256).
- `grep "resolve_namespace_id" services/nautobot/virtualization/vm_interface_workflow.py`
  returns exactly **one** occurrence (inside `_ensure_ip_addresses`,
  line ~248).
- Existing unit tests for `VirtualMachineInterfaceWorkflow` still pass.
- Manual integration test: update a VM with 2 interfaces × 2 IPs;
  observe Nautobot audit log shows exactly 4 IP-related API calls, not 8.

---

### Phase 3 — Replace `asyncio.get_event_loop()` (Issue C)

**Files changed:**
- `services/network/automation/netmiko.py` (lines 319, 379)
- `connection_tester.py` (line 72)

**Rule:** Inside `async def` functions, always use
`asyncio.get_running_loop()` to get the event loop.  It raises
`RuntimeError` immediately if called outside a running loop (fast
failure), unlike `get_event_loop()` which silently creates a new loop in
some Python versions.

**`netmiko.py:319` — `execute_commands_on_device`:**

```python
# BEFORE (line 319)
loop = asyncio.get_event_loop()
result = await loop.run_in_executor(
    self.executor,
    self._connect_and_execute,
    ...
)

# AFTER
loop = asyncio.get_running_loop()
result = await loop.run_in_executor(
    self.executor,
    self._connect_and_execute,
    ...
)
```

**`netmiko.py:379` — `execute_commands`:**

```python
# BEFORE (line 379)
loop = asyncio.get_event_loop()

for device in devices:
    ...
    task = loop.run_in_executor(
        self.executor,
        self._connect_and_execute,
        ...
    )
    tasks.append(task)

# AFTER
loop = asyncio.get_running_loop()

for device in devices:
    ...
    task = loop.run_in_executor(...)
    tasks.append(task)
```

**`connection_tester.py:72`:**

```python
# BEFORE (line 72)
loop = asyncio.get_event_loop()
response = await loop.run_in_executor(executor, make_request, ...)

# AFTER
loop = asyncio.get_running_loop()
response = await loop.run_in_executor(executor, make_request, ...)
```

**Exit criteria:**
- `grep "get_event_loop()" services/network/automation/netmiko.py connection_tester.py`
  → no output.
- `grep "get_running_loop()" services/network/automation/netmiko.py connection_tester.py`
  → 3 matches.
- `python -W error::DeprecationWarning -c "import services.network.automation.netmiko"`
  → no `DeprecationWarning`.

---

### Phase 4 — Remove raw exception text from JSON response bodies (Issue D)

**Files changed:** 8 settings routers listed in §2.D.

These routers return a `{"success": bool, "message": str}` envelope rather
than raising `HTTPException`.  The message should describe what failed
without embedding the Python exception string.  The fix is to replace
`str(e)` in the message with a static description, and to log the full
exception server-side.

**Pattern — apply to every affected line:**

```python
# BEFORE (example: routers/settings/checkmk_settings.py:33-37)
except Exception as e:
    logger.error("Error getting CheckMK settings: %s", e)
    return {
        "success": False,
        "message": f"Failed to get CheckMK settings: {str(e)}",
    }

# AFTER
except Exception as e:
    logger.error("Error getting CheckMK settings", exc_info=True)
    return {
        "success": False,
        "message": "Failed to get CheckMK settings",
    }
```

The change is mechanical on every affected site:
1. Remove `{str(e)}` / `f"... {str(e)}"` from the `"message"` value.
2. Change the `logger.error` call to pass `exc_info=True` (so the full
   traceback is recorded server-side) instead of interpolating `e` or
   `str(e)`.

**Full list of files and lines requiring the change:**

`routers/settings/checkmk_settings.py`
- Line 37: `"message": f"Failed to get CheckMK settings: {str(e)}"` →
  `"message": "Failed to get CheckMK settings"`
- Line 67: `"message": f"Failed to update CheckMK settings: {str(e)}"` →
  `"message": "Failed to update CheckMK settings"`
- Line 98: `"message": f"Test failed: {str(e)}"` →
  `"message": "CheckMK connection test failed"`

`routers/settings/git_settings.py`
- Line 39: `"message": f"Failed to retrieve Git settings: {str(e)}"` →
  `"message": "Failed to retrieve Git settings"`
- Line 115: `"message": f"Failed to update Git settings: {str(e)}"` →
  `"message": "Failed to update Git settings"`
- Line 143: `"message": f"Test failed: {str(e)}"` →
  `"message": "Git connection test failed"`

`routers/settings/network_defaults.py`
- Line 35: `"message": f"Failed to retrieve network defaults: {str(e)}"` →
  `"message": "Failed to retrieve network defaults"`
- Line 63: `"message": f"Failed to update network defaults: {str(e)}"` →
  `"message": "Failed to update network defaults"`

`routers/settings/server_defaults.py`
- Line 35: `"message": f"Failed to retrieve server defaults: {str(e)}"` →
  `"message": "Failed to retrieve server defaults"`
- Line 63: `"message": f"Failed to update server defaults: {str(e)}"` →
  `"message": "Failed to update server defaults"`

`routers/settings/cache_settings.py`
- Line 35: → `"message": "Failed to retrieve cache settings"`
- Line 94: → `"message": "Failed to update cache settings"`

`routers/settings/agents_settings.py`
- Line 68: → `"message": "Failed to update Agents settings"`
- Line 188: → `"message": "Agents connection test failed"`
- Line 233: → `"message": "Failed to read Telegraf config"`

`routers/settings/cache.py`
- Lines 45, 61, 75, 88, 122, 139, 171, 192: all `str(exc)` in
  `{"success": False, "message": str(exc)}` → change to
  `{"success": False, "message": "Cache operation failed"}`

`routers/settings/common.py`
- Line 136: `"message": f"Health check failed: {str(e)}"` →
  `"message": "Health check failed"`

**Note on `logger.error` calls:** wherever the current code does
`logger.error("Error doing X: %s", e)`, change to
`logger.error("Error doing X", exc_info=True)` so the full traceback
lands in the log.  This satisfies the rule from `CLAUDE.md` about no
f-strings in logging.

**Exit criteria:**
- `grep -rn "str(e)\|str(exc)" routers/settings/` → no output.
- `python scripts/check_http_500_leaks.py` → still passes (the script
  checks `HTTPException.detail`; this change is additional hardening).
- Manual test: trigger a settings save with bad DB credentials; confirm
  the response body contains `"message": "..."` with no Python traceback
  or exception class name.

---

### Phase 5 — Clean up debug logging in `clusters.py` (Issue E)

**File changed:** `routers/nautobot/clusters.py`.

Three locations contain multi-line separator blocks.  Collapse each to a
single structured `logger.error` with `exc_info=True`.

**Location 1 — lines 413–424 (inside IP creation per-interface loop):**

```python
# BEFORE
except Exception as ip_error:
    logger.error("")
    logger.error("=" * 60)
    logger.error("❌ FAILED TO PROCESS IP: %s", ip_data.address)
    logger.error("=" * 60)
    logger.error("  Error: %s", ip_error)
    logger.error("=" * 60)
    response_data["warnings"].append(
        f"Failed to create/assign IP {ip_data.address} on interface {interface_data.name}: {str(ip_error)}"
    )

# AFTER
except Exception as ip_error:
    logger.error(
        "Failed to create/assign IP %s on interface %s",
        ip_data.address,
        interface_data.name,
        exc_info=True,
    )
    response_data["warnings"].append(
        f"Failed to create/assign IP {ip_data.address} on interface {interface_data.name}"
    )
```

**Location 2 — lines 529–540 (legacy format IP error):**

```python
# BEFORE
except Exception as ip_error:
    logger.error("")
    logger.error("=" * 60)
    logger.error("❌ FAILED TO PROCESS IP: %s", vm_request.primaryIpv4)
    logger.error("=" * 60)
    logger.error("  Error: %s", ip_error)
    logger.error("=" * 60)
    response_data["warnings"].append(
        f"VM and interface created, but IP assignment failed: {str(ip_error)}"
    )

# AFTER
except Exception as ip_error:
    logger.error(
        "Failed to process legacy primary IP %s", vm_request.primaryIpv4, exc_info=True
    )
    response_data["warnings"].append(
        "VM and interface created, but IP assignment failed"
    )
```

**Location 3 — lines 614–619 (outer catch-all in `create_virtual_machine`):**

```python
# BEFORE
except Exception as e:
    logger.error("")
    logger.error("=" * 80)
    logger.error("======= FATAL ERROR =======")
    logger.error("=" * 80)
    logger.error("Error: %s", e, exc_info=True)
    raise_internal_server_error(...)

# AFTER
except Exception as e:
    logger.error("Fatal error creating virtual machine %s", vm_request.name, exc_info=True)
    raise_internal_server_error(
        logger,
        "Failed to create virtual machine",
        e,
        extra={"vm_name": vm_request.name},
    )
```

**Additional — warnings list still must not contain `str(ip_error)` or
`str(iface_error)`:**  
In the same handler, `response_data["warnings"].append(f"... {str(ip_error)}")` 
patterns appear at lines 423, 434, 539, 548, 574.  These are client-visible
strings (same concern as Issue D).  Apply the same fix: remove `{str(...)}` 
from the warning message, keep the static prefix only.

**Exit criteria:**
- `grep "logger.error(\"\")\|logger.error(\"=\|logger.error(\"❌\|logger.error(\"✗" routers/nautobot/clusters.py`
  → no output.
- `grep "str(ip_error)\|str(iface_error)\|str(primary_error)" routers/nautobot/clusters.py`
  → no output.
- `python scripts/check_http_500_leaks.py` → still passes.

---

### Phase 6 — Replace bare `raise Exception(...)` with `RuntimeError` (Issue F)

**File changed:** `routers/nautobot/clusters.py` (lines 250, 318, 458, 487).

These four sites check that a just-created Nautobot resource returned an
ID.  They should raise `RuntimeError` (indicates a programming/contract
violation) rather than `Exception` (too broad):

```python
# BEFORE (line 250)
raise Exception("VM creation succeeded but no ID returned")

# AFTER
raise RuntimeError("VM creation succeeded but no ID returned")
```

Apply the same `Exception` → `RuntimeError` substitution to lines 318,
458, and 487.

**Line 487 specifically:**

```python
# BEFORE (line 487)
raise Exception("Could not resolve 'Global' namespace")

# AFTER — prefer the domain exception
from services.nautobot.common.exceptions import NautobotNotFoundError
raise NautobotNotFoundError("Could not resolve 'Global' namespace")
```

`NautobotNotFoundError` is already imported in this file (used at line
722 for the `delete_virtual_machine` handler).  Using it here allows the
outer `except NautobotNotFoundError` block to surface a 404 rather than a
500 if the Global namespace genuinely does not exist in Nautobot.

**Exit criteria:**
- `grep "raise Exception(" routers/nautobot/clusters.py` → no output.
- `grep "raise RuntimeError(\|raise NautobotNotFoundError(" routers/nautobot/clusters.py`
  → 4 matches.
- The `delete_virtual_machine` 404 branch (line 722) remains unchanged.

---

### Phase 7 — Move deferred imports to module level (Issue G)

**File changed:** `routers/nautobot/infrastructure.py`.

Three handler bodies contain the same import:

```python
# BEFORE — repeated at lines 69, 107, 143
from services.settings.manager import SettingsManager
settings_manager = SettingsManager()
```

Move the import to the top of the file alongside existing imports and
remove the three inline `from services.settings.manager import ...` lines.

**After — module-level import block (add after existing imports ~line 13):**

```python
from services.settings.manager import SettingsManager
```

**After — inside each handler, keep only the instantiation:**

```python
# AFTER (each of the three handlers)
settings_manager = SettingsManager()
```

Note: `SettingsManager()` must remain inside the handler body because it
reads live database settings at construction time; it cannot be a
module-level singleton.

**Exit criteria:**
- `grep "from services.settings.manager import" routers/nautobot/infrastructure.py`
  → exactly 1 match (module-level).
- `grep "from services.settings.manager" routers/nautobot/` → 1 match total
  in `infrastructure.py`.
- `python -c "from routers.nautobot.infrastructure import router"` → no
  import errors.

---

## 4. Validation checklist (all phases)

Run from `backend/` after completing all phases:

```bash
# Regression guards
python scripts/check_asyncio_run.py
python scripts/check_http_500_leaks.py
python scripts/check_router_repositories.py
python scripts/check_text_sql.py

# No raw exception strings exposed in response bodies
grep -rn "str(e)\|str(exc)\|str(err)" routers/settings/
# → must be empty (or only in non-response contexts)

# No asyncio.get_event_loop() in async contexts
grep -rn "get_event_loop()" services/network/automation/netmiko.py connection_tester.py
# → must be empty

# No async def handlers with only sync bodies in servers router
grep "async def" routers/servers/servers.py
# → must be empty

# Single ensure_ip_address_exists call in vm_interface_workflow
grep "ensure_ip_address_exists" services/nautobot/virtualization/vm_interface_workflow.py
# → must return exactly 1 match

# Ruff clean
ruff format .
ruff check --fix .
```

---

## 5. Risks & mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| Phase 1: changing `async def` → `def` breaks a middleware or dependency that expects a coroutine | Low | FastAPI supports both; `Depends(...)` resolves the same way for sync and async handlers. Verify with smoke tests. |
| Phase 2: `ip_address_map` miss causes a silent skip instead of retry | Low | The warning log in the main loop will surface the gap. Add a unit test that asserts an IP absent from the map generates the warning. |
| Phase 4/5: removing `str(e)` from responses breaks frontend error display | Low | Frontend settings pages currently display the raw `message` field in toast notifications. The new static messages remain equally readable; specific error context moves to server logs. |
| Phase 6: changing `Exception` → `NautobotNotFoundError` changes HTTP status code from 500 to 404 | Intentional | If the Global namespace doesn't exist, 404 is more correct than 500. Verify the frontend handles this gracefully. |
| Phase 3: `get_running_loop()` raises `RuntimeError` if called outside a running loop | Desired | This is the point — it makes misuse fail fast at test time rather than silently. |

---

## 6. References

- `doc/refactoring/REFACTORING_RAW_SQL.md` — companion refactor plan,
  style reference for this document.
- `backend/scripts/check_asyncio_run.py` — CI guard; confirms no
  `asyncio.run()` in routers.
- `backend/scripts/check_http_500_leaks.py` — CI guard; confirms no raw
  exception text in `HTTPException.detail`.
- `backend/core/safe_http_errors.py` — canonical 5xx response helper.
- FastAPI docs on sync vs async endpoints:
  https://fastapi.tiangolo.com/async/ — §"Very Technical Details".
- CPython issue #91351 — `asyncio.get_event_loop()` deprecation timeline.
