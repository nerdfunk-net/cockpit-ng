# TODO: Legacy / Duplicated Code Cleanup

Findings from the CSV Import job-template rework (2026-07-16), where device
creation was unified onto `DeviceCreationService` (same code as the Add
Device form and the CSV Updates tool's "Add Missing Devices"). While tracing
that change, several other legacy or duplicated code paths turned up. None
of these were touched by that work — listed here so they aren't forgotten.

## 1. Dead backend: `DeviceImportService` / `import_devices_task.py`

`backend/services/nautobot/devices/import_service.py` (`DeviceImportService`)
used to be the device-creation path for CSV import. After this rework it has
exactly one real caller left:

- `backend/services/network/tools/baseline.py` (`BaselineImportService`) —
  a live, unrelated feature (Nautobot schema baseline generation), reachable
  via `backend/routers/tools/schema.py`. **Keep.**

The other consumer is dead:

- `backend/tasks/import_devices_task.py` (`import_devices_from_csv_task`,
  Celery task `tasks.import_devices_from_csv`) — wired to
  `POST /api/celery/tasks/import-devices-from-csv` in
  `backend/routers/jobs/import_update.py:249`. **No frontend caller found**
  (`grep -rn "import-devices-from-csv" frontend/src` — empty). This looks
  like an earlier, now-superseded device-import endpoint.

**Action:** confirm nothing external hits `/api/celery/tasks/import-devices-from-csv`,
then delete `backend/tasks/import_devices_task.py`, its router endpoint, and
its tests. `DeviceImportService` and `import_service.py` can likely be
deleted too once `baseline.py` is checked/ported (or keep it if baseline.py
is judged to need its own simpler path — it doesn't need the full
`AddDeviceRequest`/workflow-status machinery `DeviceCreationService` has).

## 2. Dead backend: `update_devices_from_csv_task.py` endpoint

`backend/routers/jobs/import_update.py:30` exposes
`POST /api/celery/tasks/update-devices-from-csv` →
`backend/tasks/update_devices_from_csv_task.py`. It has its own CSV parser
(`_prepare_row_data`) and duplicates the device-update logic that
`backend/tasks/update_devices_task.py` (the CSV Updates tool's real path)
already implements — both ultimately call
`services/nautobot/devices/update.py::DeviceUpdateService.update_device()`,
so the parsing/row-prep is the only duplicated part.

Frontend reachability:

- **Live caller:** `frontend/src/components/features/nautobot/tools/bulk-edit/dialogs/csv-upload-dialog.tsx`
  (a different feature, "Bulk Edit"). **Keep the endpoint for this.**
- **Dead caller:** `frontend/src/hooks/queries/use-csv-updates-mutations.ts`
  `getEndpointForObjectType()` has a `'devices'` case that also points at
  this endpoint — but `csv-update-wizard.tsx` always branches on
  `isDevices` *before* reaching `processUpdates`, routing devices through
  `processDeviceUpdates` (→ `update_devices_task.py`) instead. The
  `'devices'` case in `getEndpointForObjectType` is **unreachable**.

**Action:** remove the dead `'devices'` case from `getEndpointForObjectType`
(`frontend/src/hooks/queries/use-csv-updates-mutations.ts:75-76`) — devices
never flow through `processUpdates`. Leave the backend endpoint alone since
bulk-edit still needs it, but note it duplicates `_prepare_row_data`-style
parsing that `update_devices_task.py` also has (`_prepare_device_data`) —
worth consolidating into one shared row-prep helper if bulk-edit is ever
touched again.

## 3. Dead frontend: three unused components in `csv-updates/components/`

None of these are imported by anything except the barrel `index.ts`, and the
barrel itself is never imported from outside the folder (`grep -rn "tools/csv-updates/components'" frontend/src` finds no external consumer). They appear
to be leftovers from before the wizard was refactored into
`csv-configure-step.tsx` / `csv-properties-step.tsx` /
`shared/csv/components/csv-field-mapping-panel.tsx` (last touched
2026-07-05, same day as the current wizard files — a refactor that didn't
clean up its predecessors):

- `frontend/src/components/features/nautobot/tools/csv-updates/components/properties-panel.tsx` (267 lines)
- `frontend/src/components/features/nautobot/tools/csv-updates/components/mapping-panel.tsx` (194 lines)
- `frontend/src/components/features/nautobot/tools/csv-updates/components/legacy-mapping-panel.tsx` (187 lines)

**Action:** delete all three and their exports in
`frontend/src/components/features/nautobot/tools/csv-updates/components/index.ts`
(run `knip`/`ts-prune` first to be certain, then verify `npm run lint` and a
manual click-through of the CSV Updates wizard still work).

## 4. Duplicate `CsvFieldMappingPanel`

Two components with the same name and similar purpose:

- `frontend/src/components/features/nautobot/shared/csv/components/csv-field-mapping-panel.tsx`
  — the live one, used by `csv-updates/components/csv-configure-step.tsx`
  and `racks/components/import-positions-step-mapping.tsx`.
- `frontend/src/components/features/nautobot/tools/csv-updates/components/csv-field-mapping-panel.tsx`
  — a second, csv-updates-local copy. Not imported anywhere (superseded by
  the shared one, similar to item 3).

**Action:** diff the two; if the local copy really is superseded, delete it
as part of the item-3 cleanup.

## 5. Structural divergence: two independent CSV import/update pipelines

Documented in more detail during the CSV Import job-template rework
conversation, still true after that change:

- **Job templates ("CSV Import" job type)** →
  `backend/services/nautobot/imports/csv_import_service.py::CsvImportService`
  — own CSV parsing, own multi-row-per-device ("cockpit format") grouping,
  own column-mapping/defaults application, GraphQL-based object lookup.
- **CSV Updates tool** → client-side parsing/grouping in
  `frontend/src/components/features/nautobot/tools/csv-updates/utils/csv-parser.ts`
  and `device-merge.ts`, backend tasks
  (`update_devices_task.py`, `update_ip_prefixes_from_csv_task.py`,
  `update_ip_addresses_from_csv_task.py`) with their own row prep.

They now **converge** for device create (`DeviceCreationService`) and device
update (`DeviceUpdateService`), but the CSV **parsing** and **cockpit-format
row-grouping** logic remains duplicated: once in Python
(`CsvImportService._process_cockpit_rows`) and once in TypeScript
(`device-merge.ts` `buildDeviceRows`/`buildDeviceUpdatePayloads`). Non-device
object types (`ip-prefixes`, `ip-addresses`) also still diverge completely:
the job-template path POSTs/PATCHes Nautobot directly via
`nautobot_service.rest_request()`, while the CSV Updates tool goes through
the dedicated `PrefixUpdateService`.

**Action (larger, not urgent):** if CSV import/update logic is touched
again, consider extracting the "cockpit format" row-grouping into a single
place (either move it fully server-side and have the frontend just upload
raw CSV/agent text everywhere, or vice versa) and route non-device
job-template imports through `PrefixUpdateService` instead of raw REST
calls.

## 6. Minor: `AddDeviceRequest` drops unsupported CSV columns on creation

Now that `CsvImportService._build_add_device_request()` (added in this
rework) maps CSV/profile data onto `AddDeviceRequest`, any CSV column that
isn't one of `_DEVICE_CREATE_FIELDS` (e.g. a Nautobot export's `comments`
column) is silently dropped with a `logger.warning` on **creation** only —
**updates** still forward all mapped fields via `DeviceUpdateService`. Not a
bug, but worth knowing if a future CSV format needs more device fields on
create: extend `_DEVICE_CREATE_FIELDS` in `csv_import_service.py`.
