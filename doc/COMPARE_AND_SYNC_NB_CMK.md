# Compare & Sync: Nautobot ↔ CheckMK

This document describes the **Compare Devices** and **Sync Devices** feature that synchronises device configurations from Nautobot into CheckMK. It lists every relevant file and explains all concepts you need to extend or debug the feature.

---

## Overview

The feature is **one-way**: Nautobot is the source of truth. CheckMK is the target.

Two operations exist:

| Operation | What it does |
|-----------|--------------|
| **Compare** | Reads each device from Nautobot, reads the matching host from CheckMK, and reports whether they match (`equal`), differ (`diff`), or the host is absent from CheckMK (`missing`). |
| **Sync** | Takes a list of Nautobot device IDs and pushes them into CheckMK. For each device it tries to **update** the existing CheckMK host first; if CheckMK returns 404 it **adds** a new host instead. Optionally activates all pending CheckMK changes when done. |

Sync is designed to run **only on devices that differ** from CheckMK — the caller (frontend job template) is expected to pass only the device IDs that were flagged as `diff` or `missing` by a prior compare run.

---

## Key Concepts

### Normalised Config

Before any comparison or sync, Nautobot device data is **normalised** into a canonical dict:

```python
{
  "folder": "/location/sublocation",   # CheckMK folder path
  "attributes": { ... },               # Host attributes (IP, SNMP, tags, …)
  "internal": {                        # Not sent to CheckMK; used for lookup only
    "hostname": "device-name",
    "device_id": "nautobot-uuid"
  }
}
```

The `internal` key is stripped before any comparison or push.

### Comparison Statuses

| Status | Meaning |
|--------|---------|
| `equal` | Normalised Nautobot config matches CheckMK host config exactly. |
| `diff` | At least one attribute or the folder path differs. |
| `missing` / `host_not_found` | Device exists in Nautobot but has no corresponding host in CheckMK. The router maps `host_not_found` → `missing` for frontend consistency. |
| `error` | Comparison failed (network error, missing hostname, …). |
| `synced` | Device was successfully updated in CheckMK during a sync job. |
| `added` | Device did not exist in CheckMK and was created during a sync job. |

### Job IDs

Every batch sync creates two tracking records:

- **Celery task ID** – returned by `task.id`; used for Celery progress polling.
- **NB2CMK job ID** – `sync_devices_{celery_task_id}`; used in `nb2cmk_jobs` table and surfaced in the Jobs/Views panel.

---

## Architecture

```
Frontend (Job Template)
   │  POST /api/celery/tasks/sync-devices-to-checkmk
   │  { device_ids: [...], activate_changes_after_sync: bool }
   ▼
Backend Router  (backend/routers/jobs/sync_tasks.py)
   │  validates request, fires Celery task
   ▼
Celery Task  (backend/services/background_jobs/checkmk_device_jobs.py)
   │  sync_devices_to_checkmk_task
   │    ├─ create NB2CMKJob row (nb2cmk_jobs)
   │    ├─ create JobRun row (job_runs)
   │    └─ for each device_id:
   │         try  update_device_in_checkmk()
   │         except 404 → add_device_to_checkmk()
   │         store NB2CMKJobResult row (nb2cmk_job_results)
   │    └─ if activate_changes_after_sync → activate CheckMK changes
   ▼
NautobotToCheckMKService facade  (backend/services/checkmk/sync/__init__.py)
   ├── DeviceQueryService       (backend/services/checkmk/sync/queries.py)
   │     get_device_normalized(device_id) → normalised config dict
   ├── DeviceComparisonService  (backend/services/checkmk/sync/comparison.py)
   │     compare_device_config(device_id) → DeviceComparison
   │     get_devices_diff()               → DeviceListWithStatus
   └── DeviceSyncOperations     (backend/services/checkmk/sync/operations.py)
         add_device_to_checkmk(device_id)    → DeviceOperationResult
         update_device_in_checkmk(device_id) → DeviceUpdateResult
```

---

## File Map

### Backend

| File | Purpose |
|------|---------|
| `backend/core/models/nb2cmk.py` | SQLAlchemy models: `NB2CMKJob`, `NB2CMKJobResult`, `NB2CMKSync` |
| `backend/models/nb2cmk.py` | Pydantic request/response schemas (`DeviceComparison`, `DeviceListWithStatus`, `SyncDevicesToCheckmkRequest`, …) |
| `backend/repositories/checkmk/nb2cmk_repository.py` | Data access for `nb2cmk_jobs` and `nb2cmk_job_results` |
| `backend/routers/jobs/sync_tasks.py` | All Celery-trigger endpoints under `/api/celery/tasks/` |
| `backend/routers/checkmk/sync.py` | Direct (non-Celery) compare/add/update endpoints under `/api/nb2cmk/` |
| `backend/services/background_jobs/checkmk_device_jobs.py` | Celery tasks: `add_device_to_checkmk_task`, `update_device_in_checkmk_task`, **`sync_devices_to_checkmk_task`** |
| `backend/services/checkmk/sync/__init__.py` | `NautobotToCheckMKService` facade — single entry point for callers |
| `backend/services/checkmk/sync/queries.py` | `DeviceQueryService` — Nautobot GraphQL queries + device normalisation |
| `backend/services/checkmk/sync/comparison.py` | `DeviceComparisonService` — diff logic between normalised config and CheckMK |
| `backend/services/checkmk/sync/operations.py` | `DeviceSyncOperations` — add / update host in CheckMK REST API |
| `backend/services/checkmk/sync/database.py` | `NB2CMKJobDatabaseService` — create/update job and result rows |
| `backend/services/checkmk/sync/background.py` | Background helper service |
| `backend/service_factory.py` | `build_nb2cmk_service()`, `build_nb2cmk_db_service()`, `build_checkmk_client()` |

### Frontend

| File | Purpose |
|------|---------|
| `frontend/src/components/features/jobs/templates/components/template-types/CompareDevicesJobTemplate.tsx` | UI card shown when a job template type is "compare_devices". Info-only, no config fields. |
| `frontend/src/components/features/jobs/templates/components/template-types/SyncDevicesJobTemplate.tsx` | UI card shown when a job template type is "sync_devices". Exposes the "Activate all changes after Sync" toggle. |
| `frontend/src/components/features/checkmk/diff-viewer/diff-viewer-page.tsx` | Main diff-viewer page. Loads Nautobot devices, runs comparison, overlays statuses, allows selecting and syncing mismatched devices. |
| `frontend/src/components/features/checkmk/diff-viewer/` | All sub-components, hooks, and types for the diff-viewer page. |
| `frontend/src/components/features/checkmk/shared/` | Shared hooks and components used across CheckMK features (job management, status messages, diff modal, …). |

---

## API Endpoints

### Celery-dispatched (async, preferred for batch operations)

```
POST /api/celery/tasks/sync-devices-to-checkmk
Permission: checkmk.devices:write

Request body:
{
  "device_ids": ["<nautobot-uuid>", ...],
  "activate_changes_after_sync": true
}

Response (TaskWithJobResponse):
{
  "task_id": "<celery-uuid>",
  "job_id": "sync_devices_<celery-uuid>",
  "status": "queued",
  "message": "Sync devices task queued for N devices: <celery-uuid>"
}
```

```
POST /api/celery/tasks/compare-nautobot-and-checkmk
Permission: jobs:read

Optional body: list of device IDs. If omitted, compares all devices.
Response: TaskResponse with task_id
```

```
POST /api/celery/tasks/get-diff-between-nb-checkmk
Permission: checkmk.devices:read

Compares device inventories between Nautobot and CheckMK (presence/absence).
Response: TaskResponse with task_id
```

```
POST /api/celery/tasks/add-device-to-checkmk?device_id=<uuid>
POST /api/celery/tasks/update-device-in-checkmk?device_id=<uuid>
Permission: checkmk.devices:write

Single-device operations. Response: TaskResponse.
```

### Direct (synchronous, used for single-device UI actions)

```
GET  /api/nb2cmk/device/{device_id}/compare
Permission: checkmk.devices:read
Response: DeviceComparison { result, diff, normalized_config, checkmk_config, ignored_attributes }

POST /api/nb2cmk/device/{device_id}/add
POST /api/nb2cmk/device/{device_id}/update
Permission: checkmk.devices:write

GET  /api/nb2cmk/get_default_site
Response: { default_site: "cmk" }
```

---

## Database Schema

### `nb2cmk_jobs`

Tracks one batch sync run.

| Column | Type | Notes |
|--------|------|-------|
| `job_id` | VARCHAR(255) PK | `sync_devices_<celery-task-id>` |
| `status` | VARCHAR(50) | `pending` → `running` → `completed` / `failed` / `cancelled` |
| `created_at` | TIMESTAMPTZ | |
| `started_at` | TIMESTAMPTZ | |
| `completed_at` | TIMESTAMPTZ | |
| `total_devices` | INT | |
| `processed_devices` | INT | Updated during run |
| `progress_message` | TEXT | Human-readable progress |
| `user_id` | VARCHAR(255) | Username that triggered the job |
| `error_message` | TEXT | Populated on failure |

Indexes: `idx_nb2cmk_jobs_created_at`, `idx_nb2cmk_jobs_status`

### `nb2cmk_job_results`

One row per device per job run.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INT PK | Auto-increment |
| `job_id` | VARCHAR(255) FK → `nb2cmk_jobs.job_id` | Cascade delete |
| `device_id` | VARCHAR(255) | Nautobot UUID |
| `device_name` | VARCHAR(255) | Hostname |
| `checkmk_status` | VARCHAR(50) | `equal` / `diff` / `missing` / `error` / `synced` / `added` |
| `diff` | TEXT | Human-readable diff description (or JSON error object) |
| `normalized_config` | TEXT | JSON — Nautobot normalised config |
| `checkmk_config` | TEXT | JSON — CheckMK host extensions |
| `ignored_attributes` | TEXT | JSON array of attribute names excluded from comparison |
| `processed_at` | TIMESTAMPTZ | |

Indexes: `idx_nb2cmk_job_results_job_id`, `idx_nb2cmk_job_results_device_id`

### `nb2cmk_sync` (legacy, do not use for new code)

Earlier tracking table; superseded by `nb2cmk_jobs` + `nb2cmk_job_results`.

---

## Sync Task — Detailed Flow

```
sync_devices_to_checkmk_task(device_ids, activate_changes_after_sync)
│
├─ reload config files (SNMP mapping, checkmk.yaml, …)
├─ create NB2CMKJob row  (status=pending → running)
├─ create JobRun row     (visible in Jobs/Views panel)
│
└─ for each device_id in device_ids:
     │
     ├─ try: update_device_in_checkmk(device_id)
     │    │  get_device_normalized() → normalised config
     │    │  client.get_host()       → current CheckMK state
     │    │  client.update_host()    → push new attributes
     │    │  if folder changed → create folder, move host
     │    │  start service discovery
     │    └─ store result: checkmk_status="synced"
     │
     └─ except 404/not-found:
          add_device_to_checkmk(device_id)
             get_device_normalized() → normalised config
             create folder structure if missing
             client.create_host()    → new host with attributes
             start service discovery (tabula_rasa mode)
             store result: checkmk_status="added"
     │
     └─ except any other error:
          store result: checkmk_status="error", diff=JSON error details
│
└─ if activate_changes_after_sync AND success_count > 0:
     client.activate_changes()
│
└─ update NB2CMKJob: status=completed/failed
   update JobRun:    status=completed/failed
```

---

## Comparison Logic

`DeviceComparisonService.compare_device_config(device_id)`:

1. Call `get_device_normalized(device_id)` — Nautobot GraphQL + normalisation.
2. Extract `hostname` from `normalized_config["internal"]["hostname"]`.
3. Call `client.get_host(hostname)` — CheckMK REST API.
4. If 404 → return `result="host_not_found"`.
5. Strip `meta_data` from CheckMK attributes (managed by CheckMK internally).
6. Build `nb_config_for_comparison` (normalised dict without `internal`).
7. Build `cmk_config_for_comparison` (CheckMK extensions without `internal`).
8. Deep-compare the two dicts, excluding attributes listed in `ignored_attributes`.
9. Return `DeviceComparison` with `result` = `equal` or `diff`.

`DeviceComparisonService.get_devices_diff()`:
- GraphQL query fetches all Nautobot devices (`id`, `name`, `role`, `location`, `status`).
- For each device, calls `compare_device_config()` and collects the status.
- Returns `DeviceListWithStatus`.

---

## Frontend — Diff Viewer

The diff-viewer page (`diff-viewer-page.tsx`) is the primary UI for the compare + sync workflow:

1. **Load Nautobot devices** — fetches the device list from Nautobot (via proxy).
2. **Run comparison** — dispatches `POST /api/celery/tasks/compare-nautobot-and-checkmk` (or uses a direct `GET /api/nb2cmk/device/{id}/compare` for individual devices).
3. **Overlay statuses** — maps `checkmk_status` from job results onto the device rows in the table.
4. **Filter mismatched** — the user can filter to show only `diff` / `missing` devices.
5. **Select & sync** — the user selects the devices to fix and clicks **Sync Selected**, which calls `POST /api/celery/tasks/sync-devices-to-checkmk` with the selected IDs.

### Job Templates (used in the Jobs app)

`CompareDevicesJobTemplate` — displayed when a scheduled/manual job has type `compare_devices`. Read-only info panel; no configuration needed.

`SyncDevicesJobTemplate` — displayed when a job has type `sync_devices`. Provides one boolean control:
- **Activate all changes after Sync** (`activate_changes_after_sync`) — forwarded as-is to the API request body.

---

## Extending the Feature

### Adding a new field to the comparison

1. Update the Nautobot GraphQL query in `DeviceQueryService` (or the normalisation logic) to include the new field.
2. Add it to the normalised config dict under `attributes`.
3. Verify that the comparison dict diff picks it up automatically (it should, since the compare is a deep dict diff).
4. If the field should be **ignored** during comparison, add it to the `ignored_attributes` config in `checkmk.yaml`.

### Filtering: only sync non-matching devices

The Celery task accepts whatever `device_ids` the frontend passes. To restrict sync to devices that do not match:

1. Run (or poll the result of) a compare job.
2. From the `nb2cmk_job_results` table, select rows where `checkmk_status IN ('diff', 'missing')`.
3. Pass only those `device_id` values in the sync request.

The diff-viewer page already does this interactively. For automated/scheduled sync, implement a Celery chain or a new task that calls `get_devices_diff()`, filters non-matching devices, and calls `sync_devices_to_checkmk_task` with the filtered list.

### Adding a new Celery endpoint

Follow the pattern in `backend/routers/jobs/sync_tasks.py`:

```python
@router.post("/tasks/my-new-task", response_model=TaskResponse)
@handle_celery_errors("my new task description")
async def trigger_my_new_task(
    current_user: dict = Depends(require_permission("checkmk.devices", "write")),
):
    from services.background_jobs.my_module import my_task
    task = my_task.delay()
    return TaskResponse(task_id=task.id, status="queued", message=f"Queued: {task.id}")
```

### Changing what gets activated in CheckMK

The `activate_changes_after_sync` flag in the request body controls whether `client.activate_changes()` is called at the end of `sync_devices_to_checkmk_task`. To activate only specific sites or add rollback handling, modify the final block in that task.

---

## Permission Summary

| Endpoint | Required permission |
|----------|---------------------|
| `GET /api/nb2cmk/device/{id}/compare` | `checkmk.devices:read` |
| `GET /api/nb2cmk/get_default_site` | `checkmk.devices:write` |
| `POST /api/nb2cmk/device/{id}/add` | `checkmk.devices:write` |
| `POST /api/nb2cmk/device/{id}/update` | `checkmk.devices:write` |
| `POST /api/celery/tasks/sync-devices-to-checkmk` | `checkmk.devices:write` |
| `POST /api/celery/tasks/add-device-to-checkmk` | `checkmk.devices:write` |
| `POST /api/celery/tasks/update-device-in-checkmk` | `checkmk.devices:write` |
| `POST /api/celery/tasks/compare-nautobot-and-checkmk` | `jobs:read` |
| `POST /api/celery/tasks/get-diff-between-nb-checkmk` | `checkmk.devices:read` |

---

## Error Handling

All errors per device are caught individually so one failing device does not abort the batch.

Error details are stored in `nb2cmk_job_results.diff` as a JSON string:

```json
{
  "error": "HTTP 500",
  "status_code": 500,
  "detail": "...",
  "title": "...",
  "fields": {}
}
```

Common error scenarios:

| Scenario | Handling |
|----------|---------|
| Device not in Nautobot | 404 caught → status `error` |
| Device has no hostname | Raises 400 → stored as `error` |
| Device not in CheckMK | Triggers `add` path → status `added` |
| Device already exists in CheckMK | Error captured → status `error` |
| Folder creation failure | Exception caught → status `error` |
| CheckMK API unreachable | Exception caught → status `error` |

---

## Configuration

CheckMK connection settings and ignored attributes are loaded from `config/checkmk.yaml`. The Celery task calls `config_service.reload_config()` at the start of each run, so config changes take effect without restarting the worker.

Key config knobs:

- `default_site` — CheckMK site name used when no site is specified.
- `ignored_attributes` — list of host attribute keys excluded from comparison (e.g. internal CheckMK metadata).
- SNMP mapping — loaded from `config/snmp_mapping.yaml`; maps Nautobot custom fields to CheckMK SNMP attributes.
