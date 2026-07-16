# Refactoring Plan: Remove Dead Backend `DeviceImportService` / `import_devices_task.py`

Addresses item 1 of `doc/TODO_LEGACY_CODE.md` (2026-07-16). **Plan only — not yet
implemented.**

## Goal

Delete the superseded CSV device-import path (`DeviceImportService`,
`import_devices_from_csv_task`, its router endpoint) after porting its one
remaining live consumer — `BaselineImportService` (the Tools → Tests Baseline
feature that seeds the pytest integration-test Nautobot) — onto
`DeviceCreationService`, the unified device-creation path already used by:

- the **Add Device** form (`routers/nautobot/devices.py`),
- the **CSV Updates** tool's "Add Missing Devices"
  (`frontend/src/components/features/nautobot/tools/csv-updates/`),
- the **CSV Import job template**
  (`services/nautobot/imports/csv_import_service.py`).

After this refactoring there is exactly **one** device-creation code path in the
backend.

## Current state (verified 2026-07-16)

### Dead code

| Artifact | Location | Evidence it is dead |
|---|---|---|
| Celery task `tasks.import_devices_from_csv` | `backend/tasks/import_devices_task.py` | Not imported in `backend/tasks/__init__.py` → **never registered on the worker**; queued tasks could not even execute. |
| Endpoint `POST /api/celery/tasks/import-devices-from-csv` | `backend/routers/jobs/import_update.py:249-303` (`trigger_import_devices_from_csv`) | `grep -rn "import-devices-from-csv" frontend/src` → no hits. Only caller of the dead task above. |
| Request model `ImportDevicesRequest` | `backend/models/celery.py:204` | Used only by the dead endpoint. |
| Unit tests for the dead task | `backend/tests/unit/tasks/test_import_devices_task.py` | Tests dead code. |
| Unit tests for the service | `backend/tests/test_device_import_service.py` | Tests code to be removed (see below). |

### `DeviceImportService` consumers

`backend/services/nautobot/devices/import_service.py` is imported by:

1. `backend/tasks/import_devices_task.py` — dead (above).
2. `backend/services/network/tools/baseline.py` (`BaselineImportService.create_devices`,
   lines 207-321) — **live**. Reachable via
   `POST /api/tools/tests-baseline` (`backend/routers/tools/schema.py:145`) and the
   frontend Tools pages (`/tools/tests-baseline`, `/tools/baseline-management`).
   This is what seeds the Nautobot test baseline consumed by the pytest
   integration suite.
3. `backend/tests/integration/test_import_devices_from_csv.py` — integration test
   that calls `DeviceImportService` **directly** (per its own docstring). It
   validates the *old* CSV import path, which production code no longer uses —
   the CSV Import job template goes through
   `CsvImportService → DeviceCreationService` since the 2026-07-16 rework.
4. `backend/tests/unit/services/test_baseline_import_service.py` — patches
   `services.network.tools.baseline.DeviceImportService` /
   `...devices.import_service.DeviceImportService.import_device`.
5. `backend/tests/test_device_import_service.py` — unit tests of the service itself.

Shared building blocks (`DeviceCommonService`, `InterfaceManagerService` in
`interface_workflow.py`) are used by `DeviceCreationService` too — **keep**.

### Decision: port baseline, don't keep `DeviceImportService`

The TODO left open whether `baseline.py` should keep its "own simpler path".
Recommendation: **port it**. `DeviceImportService` and `DeviceCreationService`
duplicate the same workflow (validate/resolve names → create device → interfaces
via `InterfaceManagerService` → primary IP). The only capability
`DeviceCreationService` lacks is `skip_if_exists`, which is a small pre-check in
the caller (see Phase 1). Keeping a whole parallel service for that is not
justified, and item 1's purpose is to end up with a single creation path.

## Phase 0 — Preconditions (no code changes)

1. Confirm no external/API consumers of
   `POST /api/celery/tasks/import-devices-from-csv` beyond the repo greps already
   done (frontend: none). Check anything project-external you know of (agents,
   Ansible playbooks, ops scripts, API docs). The fact that the task is not
   registered on the worker means any such caller would already be broken —
   strong evidence there are none.
2. Ensure a test Nautobot (`.env.test`) is available so the baseline port can be
   verified end-to-end (Phase 4). Never point verification at the dev `.env`.

## Phase 1 — Port `BaselineImportService.create_devices` to `DeviceCreationService`

File: `backend/services/network/tools/baseline.py`

### 1.1 Replace the import and instantiation

- Drop `from services.nautobot.devices.import_service import DeviceImportService`.
- Add `from services.nautobot.devices.creation import DeviceCreationService` and
  `from models.nautobot import AddDeviceRequest, InterfaceData, IpAddressData`.
- In `create_devices()`, instantiate `DeviceCreationService()` once (it builds
  its own `NautobotService` via `service_factory`, same instance semantics as
  the CSV import path — `csv_import_service.py:226`).

### 1.2 Replicate `skip_if_exists=True` with an explicit pre-check

`DeviceCreationService._step1_create_device` raises on duplicates; baseline
relies on skip-if-exists (re-runs against an already-seeded Nautobot must be
idempotent). Before creating each device:

```python
existing_id = await self.common.resolve_device_by_name(device_name)
if existing_id:
    created[device_name] = existing_id
    logger.info("Device '%s' already exists, skipped", device_name)
    continue
```

`self.common` (`DeviceCommonService`) already exists on `BaselineImportService`.
Note this changes behaviour slightly vs. today: existing devices are detected
*before* the POST instead of via duplicate-error handling — same outcome, fewer
API calls, and it also skips interface re-creation for existing devices exactly
as the old `skip_if_exists` path did.

### 1.3 Build `AddDeviceRequest` instead of the loose dicts

Use `CsvImportService._build_add_device_request()`
(`backend/services/nautobot/imports/csv_import_service.py:1097-1159`) as the
template. Field mapping from baseline YAML → `AddDeviceRequest`:

| Baseline YAML (`devices[]`) | `AddDeviceRequest` | Notes |
|---|---|---|
| `name` | `name` | required |
| `device_type` | `device_type` | name is fine — `_resolve_request_names_to_ids` resolves names → UUIDs |
| `location` | `location` | same |
| `status` (default `"active"`) | `status` | same |
| `roles[0]` / `role` | `role` | keep the existing roles-list → singular normalization and the "no role → log error + continue" guard |
| `platform` | `platform` | optional; unresolvable platform is skipped with a warning (same behaviour as before) |
| `serial` | `serial` | optional |
| `tags` | `tags` | list of names; `DeviceCreationService` forwards them |
| `custom_fields` | `custom_fields` | keep the existing date/datetime → `isoformat()` conversion (YAML may parse unquoted dates as `date` objects) |
| — | `add_prefix=False` | **Important:** `AddDeviceRequest` defaults to `add_prefix=True`. Baseline creates its prefixes explicitly (step 8 of `create_baseline`), and the old `import_device(...)` call used `add_prefixes_automatically=False` (default). Must pass `False` to preserve behaviour. |
| — | `dry_run=False` | explicit |

Interfaces (`devices[].interfaces[]`) → `InterfaceData` / `IpAddressData`:

| Baseline YAML | `InterfaceData` | Notes |
|---|---|---|
| `name` | `name` | |
| `type` (default `"other"`) | `type` | |
| `status` (default `"active"`) | `status` | |
| `enabled` (default `True`) | `enabled` | |
| `description` | `description` | |
| `mac_address` | `mac_address` | supported by `InterfaceData` |
| `mtu` | `mtu` | supported by `InterfaceData` |
| `ip_address` + `namespace` (default `"Global"`) | `ip_addresses=[IpAddressData(address=…, namespace=…, is_primary=…)]` | one IP per interface, as today |

Primary-IP flag: keep the existing rule — `is_primary=True` when the device's
`primary_ip4` (stripped of CIDR) equals the interface's `ip_address` (stripped
of CIDR). While porting, fix the latent bug at `baseline.py:283-288`: the
`primary_ip4` comparison reads `iface["ip_address"]` without checking the key
exists — an interface without an IP on a device that has `primary_ip4` raises
`KeyError` today. Guard it (`if "primary_ip4" in device and "ip_address" in iface`).

### 1.4 Call and result handling

```python
result = await creation_service.create_device_with_interfaces(request)
```

- Pass no `username`/`user_id` (or `username="baseline"` if audit entries for
  baseline seeding are wanted — recommendation: **omit**, matching the CSV
  import job path which also passes none; keeps audit logs free of test noise).
- Success: `result["success"]` is `True` → `created[device_name] = result["device_id"]`.
- Failure: `create_device_with_interfaces` raises on device-creation failure
  (name-resolution `ValueError`, `NautobotAPIError`) — the existing
  `except … raise` in the device loop already propagates, keep it. Also treat
  `result["success"] is False` (partial interface failure) as an error for
  baseline purposes: raise, because integration tests depend on interfaces/IPs
  existing exactly as declared.

### 1.5 Return shape

`create_devices()` keeps returning `Dict[str, str]` (`name → device_id`) so
`create_baseline()` and its summary counting are untouched.

### Caveat noted, no action needed

`AddDeviceRequest.custom_fields` is `dict[str, str]`. All current baseline YAML
custom-field values are strings (dates are quoted), and the date/datetime
conversion in 1.3 stringifies the rest. If baseline profiles ever add
boolean/integer custom fields, `AddDeviceRequest.custom_fields` must be widened
to `dict[str, Any]` — flag in a code comment, don't change the model now.

## Phase 2 — Update tests

1. **`backend/tests/unit/services/test_baseline_import_service.py`**
   - Update the patch targets: `services.network.tools.baseline.DeviceImportService`
     → `services.network.tools.baseline.DeviceCreationService`, and
     `...import_service.DeviceImportService.import_device` →
     `services.nautobot.devices.creation.DeviceCreationService.create_device_with_interfaces`.
   - `test_create_devices_imports_via_import_service` (line 360): rewrite to
     assert the constructed `AddDeviceRequest` (name/role normalization, tags,
     custom-field date conversion, `add_prefix=False`, interface/IP mapping,
     `is_primary` flag) and the skip-if-exists pre-check (mock
     `DeviceCommonService.resolve_device_by_name` returning an ID → no create
     call, name still present in the returned dict).
2. **`backend/tests/integration/test_import_devices_from_csv.py`**
   - Currently exercises the dead path (`DeviceImportService` directly). Rewrite
     it to exercise the **live** CSV-import path: parse the same two fixtures
     (`nautobot_devices_utf.csv`, `nautobot_devices_generic.csv`) with the
     `CsvImportService` static helpers it already uses
     (`_apply_column_mapping`, `_filter_nautobot_nulls`,
     `_extract_interface_config`, `_apply_default_prefix_length`), then create
     via `CsvImportService._build_add_device_request` +
     `DeviceCreationService.create_device_with_interfaces`. Assertions
     (device/interface/IP/primary-IP state in test Nautobot) stay the same.
   - Alternative if that seam feels too internal: drive
     `CsvImportService.run_import()` end-to-end. Larger test rewrite (needs
     source plumbing for repo/agent input); the helper-level rewrite is the
     pragmatic first step.
3. **Delete** `backend/tests/test_device_import_service.py` (unit tests of the
   removed service). Coverage of the shared workflow lives in
   `DeviceCreationService`/`InterfaceManagerService` tests; if a gap shows up in
   the coverage report after deletion, port the missing cases onto
   `DeviceCreationService` tests instead of keeping the file.
4. **Delete** `backend/tests/unit/tasks/test_import_devices_task.py`.

## Phase 3 — Delete the dead code

Order matters only in that Phases 1-2 must land first (or in the same change set).

1. Delete `backend/services/nautobot/devices/import_service.py`.
2. Delete `backend/tasks/import_devices_task.py`.
3. `backend/routers/jobs/import_update.py`:
   - Remove `trigger_import_devices_from_csv` (lines 249-303).
   - Remove `ImportDevicesRequest` from the `models.celery` import block.
   - Update the module docstring (drop "import-devices-from-csv" from the
     endpoint list).
4. `backend/models/celery.py`: delete `ImportDevicesRequest` (line 204).
5. Check `backend/services/nautobot/devices/__init__.py` (and
   `services/nautobot/__init__.py`) for re-exports of `DeviceImportService` /
   `import_service`; remove if present.
6. No `tasks/__init__.py` change needed — the task was never exported there
   (that's how it escaped worker registration).
7. Leftover sweep (must all come back empty, excluding `doc/`):
   ```bash
   grep -rn "DeviceImportService" backend frontend --include="*.py" --include="*.ts" --include="*.tsx" | grep -v __pycache__
   grep -rn "import_devices_task\|import_devices_from_csv\|import-devices-from-csv" backend frontend | grep -v __pycache__
   grep -rn "ImportDevicesRequest" backend | grep -v __pycache__
   ```
   Note: historical `job_runs` rows with `job_type="import_devices_from_csv"`
   may exist in databases; that's display data only, no migration needed.

## Phase 4 — Verification (Definition of Done)

```bash
cd backend
ruff format .
ruff check --fix .
pytest -q                                   # unit suite, incl. updated baseline tests
```

Runtime verification against the **test** Nautobot (`.env.test`):

1. Reset/prepare the test Nautobot, then run the baseline import through the
   real feature (not just the service): start the backend, open
   `/tools/tests-baseline`, trigger the import (or
   `POST /api/tools/tests-baseline`), and confirm the summary reports the
   expected device count with no errors.
2. Spot-check in Nautobot that a baseline device (e.g. from
   `contributing-data/tests_baseline/baseline.yaml`) has its interfaces, IPs,
   primary IPv4, tags, and custom fields.
3. Re-run the same import a second time → all devices reported as
   existing/skipped, no duplicates (idempotency = the ported skip-if-exists).
4. Run the integration suite that consumes the baseline:
   `pytest -m "integration and nautobot" -v` (at minimum the rewritten
   `tests/integration/test_import_devices_from_csv.py`).

Frontend is untouched by this item (`npm run lint` only if any frontend file is
touched after all — none is planned).

## Explicitly out of scope (tracked separately in `doc/TODO_LEGACY_CODE.md`)

- Item 2: `update-devices-from-csv` endpoint / dead `'devices'` case in
  `use-csv-updates-mutations.ts`.
- Items 3-4: dead components in `csv-updates/components/` and the duplicate
  `CsvFieldMappingPanel`.
- Item 5: consolidating the two CSV parsing/row-grouping pipelines.

## Risk notes

- **Biggest behavioural risk:** forgetting `add_prefix=False` — baseline would
  start auto-creating `/24` prefixes for every interface IP, polluting the test
  Nautobot and potentially breaking prefix-related integration-test assertions.
- `DeviceCreationService` resolves `status` with content type `dcim.device`,
  same as `DeviceImportService` did — no behaviour change for baseline statuses.
- Baseline device creation gains virtual-chassis/rack capabilities it doesn't
  use; harmless (fields stay `None`).
- The endpoint removal is safe even if an unknown external caller exists: the
  task it queues is already unregistered on the worker, so such a caller has
  been silently broken for some time already.
