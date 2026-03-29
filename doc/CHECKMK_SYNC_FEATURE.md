# CheckMK Sync Feature

This document describes the two approaches for synchronising Nautobot device inventory into CheckMK: the **Interactive Sync page** and the **Job Template ("Sync Devices")**.

---

## Overview

There are two separate user-facing entry points for the same underlying operation — pushing Nautobot device data into CheckMK:

|                       | Interactive Sync Page                  | Job Template: Sync Devices                      |
|-----------------------|----------------------------------------|-------------------------------------------------|
| **Location**          | `/checkmk/sync-devices`                | `/jobs/templates`                               |
| **Trigger**           | Manual, per-device or multi-select     | Manual execute or Celery Beat schedule          |
| **Celery task**       | `sync_devices_to_checkmk`              | `tasks.dispatch_job` → `execute_sync_devices()` |
| **Tracking**          | Active task panel (real-time polling)  | Job Runs history table                          |
| **NB2CMK legacy DB**  | Written | Not written                  |                                                 |
| **Shared service**    | `NB2CMKService`                        | Same `NB2CMKService`                            |

Both paths call the same `NB2CMKService` methods and ultimately perform identical CheckMK REST API calls.

---

## Architecture Diagram

```
┌──────────────────────────────────┐   ┌──────────────────────────────────┐
│   Interactive Sync Page          │   │   Job Templates Page             │
│   /checkmk/sync-devices          │   │   /jobs/templates                │
└─────────────┬────────────────────┘   └──────────────┬───────────────────┘
              │                                       │
       Manual sync action                  Manual execute / Celery Beat
              │                                       │
              ▼                                       ▼
┌─────────────────────────┐           ┌─────────────────────────────────────┐
│ POST /celery/tasks/     │           │ POST /api/job-schedules/execute     │
│ sync-devices-to-checkmk │           │ or Celery Beat every minute         │
└─────────────┬───────────┘           └──────────────┬──────────────────────┘
              │                                      │
              ▼                                      ▼
┌─────────────────────────┐           ┌─────────────────────────────────────┐
│ sync_devices_to_        │           │ tasks.dispatch_job                  │
│ checkmk_task            │           │ (tasks/scheduling/job_dispatcher.py)│
│ (checkmk_device_jobs.py)│           └──────────────┬──────────────────────┘
└─────────────┬───────────┘                          │
              │                                      ▼
              │                           ┌────────────────────────────┐
              │                           │ execute_sync_devices()     │
              │                           │ (tasks/execution/          │
              │                           │  sync_executor.py)         │
              │                           └──────────┬─────────────────┘
              │                                      │
              └──────────────────┬───────────────────┘
                                 │  Both call the same service:
                                 ▼
                  ┌──────────────────────────┐
                  │  NB2CMKService           │
                  │  .update_device_in_      │
                  │    checkmk(device_id)    │
                  │  .add_device_to_         │
                  │    checkmk(device_id)    │
                  └──────────────┬───────────┘
                                 │
                                 ▼
                  ┌──────────────────────────┐
                  │  CheckMKClient           │
                  │  (REST API calls to      │
                  │   CheckMK server)        │
                  └──────────────────────────┘
```

---

## Approach 1: Interactive Sync Page (`/checkmk/sync-devices`)

### Purpose

Provides an interactive, real-time view of all Nautobot devices and their CheckMK synchronisation status. Operators can sync individual devices, sync multiple selected devices, compare configurations, trigger service discovery, and activate pending CheckMK changes.

### Frontend

**Page:** [frontend/src/components/features/checkmk/sync-devices/sync-devices-page.tsx](../frontend/src/components/features/checkmk/sync-devices/sync-devices-page.tsx)

#### Hooks

| Hook | File | Responsibility |
|------|------|----------------|
| `useDeviceLoader` | `hooks/use-device-loader.ts` | Fetches device list from Nautobot |
| `useDeviceFilters` | `hooks/use-device-filters.ts` | Client-side filtering and filter state |
| `useDeviceSelection` | `hooks/use-device-selection.ts` | Multi-select state |
| `useTaskTracking` | `hooks/use-task-tracking.ts` | Polls Celery task status every 2 s |
| `useDeviceOperations` | `hooks/use-device-operations.ts` | Dispatches sync/add/discovery/activate API calls |
| `useDiffComparison` | `shared/hooks/use-diff-comparison.ts` | Fetches and parses per-device diff |
| `useJobManagement` | `shared/hooks/use-job-management.ts` | Loads historical comparison job results |
| `useStatusMessages` | `shared/hooks/use-status-messages.ts` | Manages status banner |

#### API Calls

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/proxy/nautobot/devices` | Load device list |
| `POST` | `/api/proxy/celery/tasks/sync-devices-to-checkmk` | Sync one or more devices |
| `POST` | `/api/proxy/celery/tasks/add-device-to-checkmk?device_id={id}` | Add a new device |
| `POST` | `/api/proxy/celery/tasks/compare-nautobot-and-checkmk` | Run bulk comparison job |
| `GET` | `/api/proxy/celery/tasks/{task_id}` | Poll task progress (every 2 s) |
| `DELETE` | `/api/proxy/celery/tasks/{task_id}` | Cancel a running task |
| `GET` | `/api/proxy/nb2cmk/device/{device_id}/compare` | Per-device config diff |
| `GET` | `/api/proxy/nb2cmk/jobs?limit=50` | List historical comparison jobs |
| `GET` | `/api/proxy/nb2cmk/jobs/{job_id}` | Load results of a comparison job |
| `POST` | `/api/proxy/checkmk/service-discovery/host/{hostname}/start` | Start service discovery |
| `POST` | `/api/proxy/checkmk/changes/activate` | Activate pending CheckMK changes |

#### Task Tracking Flow

1. User clicks **Sync** → `useDeviceOperations` posts to `/celery/tasks/sync-devices-to-checkmk`.
2. Backend returns `{ task_id, job_id }`.
3. `useTaskTracking` registers the task and starts polling `GET /celery/tasks/{task_id}` every 2 seconds.
4. While the task is `PROGRESS`, the active tasks panel shows a progress bar (`current/total`).
5. On `SUCCESS`, the task entry auto-removes after 1 second.
6. On `FAILURE`, the entry stays visible and shows the error message until the operator dismisses it.
7. Cancel button sends `DELETE /celery/tasks/{task_id}` via Celery task revocation.

#### Config Comparison (Diff)

1. Operator clicks **Diff** on a device row.
2. `useDiffComparison` calls `GET /nb2cmk/device/{id}/compare`.
3. Backend normalises the Nautobot device and fetches the CheckMK host config, compares them, and returns `{ result, diff, normalized_config, checkmk_config, ignored_attributes }`.
4. The diff modal renders a side-by-side table via `diff-helpers.ts` → `renderConfigComparison()`.
5. `ignored_attributes` (from `checkmk.yaml`) are flagged with a badge but not counted as a real discrepancy.

#### Overlay Comparison Results

Past **bulk comparison** job results can be loaded and overlaid onto the live device table:

1. User clicks "Load Latest Results".
2. `useJobManagement.fetchAvailableJobs()` fetches up to 50 jobs filtered to `status=completed`, `processed_devices>0`, and excludes `sync_devices_*` jobs (only compare jobs are shown).
3. Results from the selected job are transformed into a `Map<deviceName → checkmk_status>`.
4. `enrichedDevices` (via `useMemo`) overlays that status onto the live device array without a re-fetch.

---

## Approach 2: Job Template — "Sync Devices"

### Purpose

Provides a configurable, schedulable job that runs synchronisation automatically (via Celery Beat) or on demand. Supports scoping to a specific device inventory, setting the `activate_changes_after_sync` flag, and recording a full run history.

### Frontend

**Page:** [frontend/src/components/features/jobs/templates/components/job-templates-page.tsx](../frontend/src/components/features/jobs/templates/components/job-templates-page.tsx)

**Sync-specific form:** [frontend/src/components/features/jobs/templates/components/template-types/SyncDevicesJobTemplate.tsx](../frontend/src/components/features/jobs/templates/components/template-types/SyncDevicesJobTemplate.tsx)

#### Hooks

| Hook | File | Responsibility |
|------|------|----------------|
| `useJobTemplates` | `hooks/use-template-queries.ts` | Fetch template list |
| `useJobTypes` | `hooks/use-template-queries.ts` | Fetch available job type metadata |
| `useConfigRepos` | `hooks/use-template-queries.ts` | Fetch Git repositories |
| `useSavedInventories` | `hooks/use-template-queries.ts` | Fetch saved inventories |
| `useCommandTemplates` | `hooks/use-template-queries.ts` | Fetch Netmiko command templates |
| `useCustomFields` | `hooks/use-template-queries.ts` | Fetch Nautobot custom fields |
| `useTemplateMutations` | `hooks/use-template-mutations.ts` | Create / update / delete / copy templates |

#### API Calls

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/job-templates` | List templates |
| `GET` | `/api/job-templates/types` | Available job types and their metadata |
| `POST` | `/api/job-templates` | Create template |
| `PUT` | `/api/job-templates/{id}` | Update template |
| `DELETE` | `/api/job-templates/{id}` | Delete template |
| `GET/POST` | `/api/job-schedules` | List / create schedules |
| `PUT/DELETE` | `/api/job-schedules/{id}` | Update / delete a schedule |
| `POST` | `/api/job-schedules/execute` | Manually run a scheduled job now |
| `GET` | `/api/job-runs` | Paginated run history |
| `GET` | `/api/job-runs/{id}/progress` | Live progress for a running job |
| `POST` | `/api/job-runs/{id}/cancel` | Cancel a running job |

#### "Sync Devices" Template Configuration

A `sync_devices` job template stores these fields in the `job_templates` DB table:

| Field | Description |
|-------|-------------|
| `job_type` | `"sync_devices"` |
| `name` | Human-readable template name |
| `inventory_source` | `"all"` → every Nautobot device; `"inventory"` → a saved inventory list |
| `inventory_id` | ID of the saved inventory (if `inventory_source = "inventory"`) |
| `activate_changes_after_sync` | Whether to activate pending CheckMK changes after sync |

---

## Backend: Shared Service

Both approaches ultimately delegate to the same service layer:

**`NB2CMKService`** — assembled by `service_factory.build_nb2cmk_service()`:

```
NB2CMKService
├── .get_devices_for_sync()       → Nautobot GraphQL → device list
├── .update_device_in_checkmk()   → update existing CheckMK host attributes
├── .add_device_to_checkmk()      → create new CheckMK host
└── .compare_device_config()      → per-device config diff
```

The sync logic (try update → fall back to add) is implemented separately in two places:

| File | Used by |
|------|---------|
| [backend/services/background_jobs/checkmk_device_jobs.py](../backend/services/background_jobs/checkmk_device_jobs.py) | Interactive Sync Page (`sync_devices_to_checkmk_task`) |
| [backend/tasks/execution/sync_executor.py](../backend/tasks/execution/sync_executor.py) | Job Template path (`execute_sync_devices`) |

Both files implement the same algorithm — try `update_device_in_checkmk`, fall back to `add_device_to_checkmk` on 404 — using the same `NB2CMKService`.

---

## Backend: Execution Paths in Detail

### Interactive Sync Page — `sync_devices_to_checkmk_task`

```
POST /api/celery/tasks/sync-devices-to-checkmk
  body: { device_ids: string[], activate_changes_after_sync: bool }

  Router: backend/routers/jobs/sync_tasks.py
    → sync_devices_to_checkmk_task.delay(device_ids, activate_changes_after_sync)

  Celery task: backend/services/background_jobs/checkmk_device_jobs.py
    1. Create job entry in nb2cmk_jobs table (legacy NB2CMK DB)
    2. Create job entry in job_runs table
    3. For each device_id:
       a. nb2cmk_service.update_device_in_checkmk(device_id)
          → fallback to add_device_to_checkmk on 404
       b. Update Celery PROGRESS state {current, total, success, failed, job_id}
       c. Store result in nb2cmk_job_results table
    4. If activate_changes_after_sync and success_count > 0:
       → checkmk_client.activate_changes()
    5. Return {success_count, failed_count, results[], job_id}
```

### Job Template — `dispatch_job` → `execute_sync_devices`

```
POST /api/job-schedules/execute   (or Celery Beat trigger)

  Router: backend/routers/jobs/schedules.py
    → dispatch_job.delay(schedule_id, template_id, job_type="sync_devices", ...)

  Celery task: backend/tasks/scheduling/job_dispatcher.py
    1. Load template from DB (job_template_manager.get_job_template)
    2. Resolve inventory:
       - inventory_source="all"       → target_devices = None
       - inventory_source="inventory" → resolve saved inventory → list of device UUIDs
    3. Create JobRun record (job_run_manager.create_job_run)
    4. Mark job as started (job_run_manager.mark_started)
    5. → execute_job_type("sync_devices", ...)

  base_executor.py routes to:
  backend/tasks/execution/sync_executor.py → execute_sync_devices()
    1. Reload config files (SNMP mapping etc.)
    2. If target_devices is None: nb2cmk_service.get_devices_for_sync()
    3. For each device_id:
       a. nb2cmk_service.update_device_in_checkmk(device_id)
          → fallback to add_device_to_checkmk on 404
    4. Read template["activate_changes_after_sync"] (default: True)
       → if True and success_count > 0: _activate_checkmk_changes()
    5. Return result dict
    6. dispatch_job marks JobRun as completed or failed
```

### Comparison (Bulk) — `compare-nautobot-and-checkmk`

Available from the Interactive Sync page. Runs as a Celery task with results stored in the NB2CMK DB for later overlay.

```
POST /api/celery/tasks/compare-nautobot-and-checkmk

  Router: backend/routers/jobs/sync_tasks.py
    → dispatch_job.delay(job_type="compare_devices", ...)

  Executor: backend/tasks/execution/compare_executor.py → execute_compare_devices()
    1. If no target_devices: nb2cmk_service.get_devices_for_sync()
    2. Create job entry: "scheduled_compare_{task_id}"
    3. For each device: nb2cmk_service.compare_device_config(device_id)
    4. Filter diff text to remove ignored_attributes lines
    5. Store result in nb2cmk_job_results table
    6. Mark job complete
```

### Per-Device Diff

Triggered interactively from the Sync Devices page diff modal.

```
GET /api/nb2cmk/device/{device_id}/compare

  Router: backend/routers/checkmk/sync.py → compare_device_config()
  Service: NautobotToCheckMKService → DeviceComparisonService.compare_device_config()
    1. Nautobot GraphQL → normalized device dict
    2. CheckMK REST API → host attributes
    3. Strip meta_data from CheckMK attributes
    4. _compare_configurations() → list of diff strings
    5. Return DeviceComparison{result, diff, normalized_config, checkmk_config, ignored_attributes}
```

---

## Tracking and Observability

### Interactive Sync Page

- **Active Task Panel**: shows all currently running Celery tasks with live progress bars.
- **Polling**: `GET /celery/tasks/{task_id}` every 2 s via `useTaskTracking`.
- **NB2CMK DB**: `nb2cmk_jobs` + `nb2cmk_job_results` tables hold the sync history accessible via `GET /nb2cmk/jobs`.

### Job Template

- **Job Runs table** (`/jobs/runs`): records every execution with status, timing, and result.
- **Progress endpoint**: `GET /api/job-runs/{id}/progress` (Redis-backed) for live progress during a run.
- **Cancel**: `POST /api/job-runs/{id}/cancel` revokes the Celery task.

---

## Scheduling (Job Template Only)

```
beat_schedule.py
  → tasks.check_job_schedules fires every 60 s

tasks/scheduling/schedule_checker.py → check_job_schedules_task()
  → queries job_schedules WHERE is_active=true AND next_run <= now
  → for each due schedule: dispatch_job.delay(...)
  → jobs_manager.calculate_and_update_next_run(schedule_id)
```

Schedule types supported: **cron** (cron expression) and **interval** (minutes).

---

## Key Differences

| Aspect | Interactive Sync Page | Job Template |
|--------|----------------------|--------------|
| Entry point | `POST /celery/tasks/sync-devices-to-checkmk` | `POST /api/job-schedules/execute` or Beat |
| Celery task name | `services.background_jobs.sync_devices_to_checkmk` | `tasks.dispatch_job` |
| Execution code | `checkmk_device_jobs.py` | `sync_executor.py` |
| Device scope | Selected device IDs from UI | Template config (`all` or saved inventory) |
| `activate_changes_after_sync` | Request body (UI sends `true`) | Template record field |
| NB2CMK legacy DB | Written | Not written |
| JobRun tracking | Written inside the task | Written by `dispatch_job` wrapper |
| Scheduling | Not supported | Cron or interval via Celery Beat |
| Real-time feedback | Task panel polls every 2 s | Progress endpoint + Job Runs table |
| Cancel | `DELETE /celery/tasks/{task_id}` | `POST /api/job-runs/{id}/cancel` |

---

## Key File Reference

### Frontend

| File | Purpose |
|------|---------|
| [frontend/src/components/features/checkmk/sync-devices/sync-devices-page.tsx](../frontend/src/components/features/checkmk/sync-devices/sync-devices-page.tsx) | Interactive Sync page root |
| [frontend/src/components/features/checkmk/sync-devices/hooks/use-device-loader.ts](../frontend/src/components/features/checkmk/sync-devices/hooks/use-device-loader.ts) | Nautobot device list fetcher |
| [frontend/src/components/features/checkmk/sync-devices/hooks/use-device-operations.ts](../frontend/src/components/features/checkmk/sync-devices/hooks/use-device-operations.ts) | Sync / add / discovery / activate |
| [frontend/src/components/features/checkmk/sync-devices/hooks/use-task-tracking.ts](../frontend/src/components/features/checkmk/sync-devices/hooks/use-task-tracking.ts) | Celery task polling |
| [frontend/src/components/features/checkmk/shared/hooks/use-diff-comparison.ts](../frontend/src/components/features/checkmk/shared/hooks/use-diff-comparison.ts) | Per-device config diff |
| [frontend/src/components/features/checkmk/shared/hooks/use-job-management.ts](../frontend/src/components/features/checkmk/shared/hooks/use-job-management.ts) | Historical comparison job results |
| [frontend/src/components/features/checkmk/sync-devices/utils/diff-helpers.ts](../frontend/src/components/features/checkmk/sync-devices/utils/diff-helpers.ts) | Config comparison rendering |
| [frontend/src/components/features/jobs/templates/components/job-templates-page.tsx](../frontend/src/components/features/jobs/templates/components/job-templates-page.tsx) | Job Templates page root |
| [frontend/src/components/features/jobs/templates/components/template-types/SyncDevicesJobTemplate.tsx](../frontend/src/components/features/jobs/templates/components/template-types/SyncDevicesJobTemplate.tsx) | Sync Devices form fields |
| [frontend/src/components/features/jobs/templates/hooks/use-template-queries.ts](../frontend/src/components/features/jobs/templates/hooks/use-template-queries.ts) | TanStack Query hooks for templates |
| [frontend/src/components/features/jobs/templates/hooks/use-template-mutations.ts](../frontend/src/components/features/jobs/templates/hooks/use-template-mutations.ts) | Template CRUD mutations |

### Backend

| File | Purpose |
|------|---------|
| [backend/routers/jobs/sync_tasks.py](../backend/routers/jobs/sync_tasks.py) | Celery task dispatch endpoints (direct sync/compare) |
| [backend/routers/jobs/templates.py](../backend/routers/jobs/templates.py) | Job template CRUD |
| [backend/routers/jobs/schedules.py](../backend/routers/jobs/schedules.py) | Schedule management and manual execute |
| [backend/routers/jobs/runs.py](../backend/routers/jobs/runs.py) | Run history, progress, cancel |
| [backend/routers/checkmk/sync.py](../backend/routers/checkmk/sync.py) | NB2CMK compare and job history endpoints |
| [backend/routers/checkmk/main.py](../backend/routers/checkmk/main.py) | Service discovery and change activation |
| [backend/services/background_jobs/checkmk_device_jobs.py](../backend/services/background_jobs/checkmk_device_jobs.py) | Direct sync Celery tasks |
| [backend/tasks/scheduling/job_dispatcher.py](../backend/tasks/scheduling/job_dispatcher.py) | `tasks.dispatch_job` orchestrator |
| [backend/tasks/execution/sync_executor.py](../backend/tasks/execution/sync_executor.py) | `execute_sync_devices` for job templates |
| [backend/tasks/execution/compare_executor.py](../backend/tasks/execution/compare_executor.py) | `execute_compare_devices` |
| [backend/tasks/scheduling/schedule_checker.py](../backend/tasks/scheduling/schedule_checker.py) | Beat-driven schedule checker |
| [backend/services/checkmk/sync/comparison.py](../backend/services/checkmk/sync/comparison.py) | Device config comparison logic |
| [backend/services/checkmk/sync/operations.py](../backend/services/checkmk/sync/operations.py) | Add / update device operations |
| [backend/services/checkmk/sync/queries.py](../backend/services/checkmk/sync/queries.py) | Nautobot device queries and normalization |
| [backend/services/checkmk/sync/database.py](../backend/services/checkmk/sync/database.py) | NB2CMK DB service (jobs + results) |
| [backend/job_run_manager.py](../backend/job_run_manager.py) | Job run lifecycle (create / started / completed / failed) |
| [backend/job_template_manager.py](../backend/job_template_manager.py) | Template CRUD business logic |
| [backend/beat_schedule.py](../backend/beat_schedule.py) | Celery Beat schedule definitions |
