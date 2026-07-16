# Refactoring Plan: Remove Dead `'devices'` Path from the CSV Updates Mutation Hook

Addresses item 2 of `doc/TODO_LEGACY_CODE.md` (2026-07-16). **Plan only — not yet
implemented.**

## Goal

Remove the unreachable `'devices'` routing from
`frontend/src/hooks/queries/use-csv-updates-mutations.ts` and make it
structurally impossible (via the type system) for devices to flow through this
hook again. The backend endpoint `POST /api/celery/tasks/update-devices-from-csv`
and its Celery task **stay** — they have a live caller (the Bulk Edit tool).

After this refactoring:

- `useCsvUpdatesMutations` handles exactly the object types whose backend
  endpoints it can reach (`ip-prefixes`, `ip-addresses`, and the not-yet-implemented
  `locations`), enforced at compile time.
- Devices continue to flow exclusively through `useDeviceUpdatesMutations`
  (JSON payload → `celery/tasks/update-devices` → `update_devices_task.py`),
  as they already do at runtime today.
- The device-only request fields (`matchingStrategy`, `nameTransform`,
  `rackLocationColumn`) are no longer sent for prefix/address updates, where
  the backend silently ignores them anyway.

## Current state (verified 2026-07-16)

### Callers of `POST /api/celery/tasks/update-devices-from-csv`

| Caller | Location | Status |
|---|---|---|
| Bulk Edit "Bulk Update Devices from CSV" dialog | `frontend/src/components/features/nautobot/tools/bulk-edit/dialogs/csv-upload-dialog.tsx:209` (`BulkUpdateModal.handleUpdate`, direct `apiCall`, **not** via this hook) | **Live — keep the endpoint.** Sends only `csv_content`, `csv_options`, `dry_run`. |
| CSV Updates wizard via `getEndpointForObjectType('devices')` | `frontend/src/hooks/queries/use-csv-updates-mutations.ts:75-76` | **Dead.** See below. |

### Why the `'devices'` case is unreachable

`useCsvUpdatesMutations` has exactly one consumer,
`csv-update-wizard.tsx` (verified:
`grep -rln "useCsvUpdatesMutations" frontend/src` → only the hook file and the
wizard). Both wizard call sites branch on `isDevices`
(`csv-update-wizard.tsx:138` → `const isDevices = objectType === 'devices'`)
**before** reaching `processUpdates`:

- `handleDryRun` (`csv-update-wizard.tsx:216-247`): `if (isDevices) { …
  processDeviceUpdates.mutateAsync(…); return }` — line 218.
- `handleSubmit` (`csv-update-wizard.tsx:268-303`): same pattern — line 270.

So `processUpdates.mutateAsync({ objectType, … })` is only ever called with
`'ip-prefixes'`, `'ip-addresses'`, or `'locations'`. The `'devices'` case in
`getEndpointForObjectType` and the `'devices'` case in the mutation's
`onSuccess` cache-invalidation switch are dead. (Device-flow invalidation of
`queryKeys.nautobot.devices()` already happens in
`use-device-updates-mutations.ts:40` — nothing is lost by removing the dead
case.)

### Device-only fields sent to prefix/address endpoints (dead payload)

`ProcessCSVUpdatesInput` carries `matchingStrategy`, `nameTransform`, and
`rackLocationColumn`, and the wizard passes them for **all** non-device object
types. But the backend request models
`UpdateIPPrefixesRequest` / `UpdateIPAddressesRequest`
(`backend/models/celery.py:204-239`) have no such fields — Pydantic v2's
default `extra='ignore'` silently drops them. Only `UpdateDevicesRequest`
(`backend/models/celery.py:170`) accepts them, and that endpoint is exactly the
one this hook will no longer target. These three fields are therefore removed
from the hook together with the `'devices'` case.

The following input fields **stay** — the prefix/address request models accept
and use them: `csvData`, `csvOptions`, `dryRun`, `tagsMode`, `columnMapping`,
`selectedColumns`, `primaryKeyColumn`.

## Phase 0 — Preconditions (no code changes)

1. Re-run the reachability greps and confirm they still match this plan:
   ```bash
   # Hook consumers — must be only the hook itself and csv-update-wizard.tsx
   grep -rln "useCsvUpdatesMutations" frontend/src

   # Endpoint callers — must be only csv-upload-dialog.tsx (bulk-edit) and the hook
   grep -rn "update-devices-from-csv" frontend/src
   ```
2. Confirm the wizard still branches on `isDevices` before both
   `processUpdates.mutateAsync` calls (`csv-update-wizard.tsx`, `handleDryRun`
   and `handleSubmit`). If a new call path was added since this plan was
   written, stop and re-evaluate.

## Phase 1 — `frontend/src/hooks/queries/use-csv-updates-mutations.ts`

All four edits below are in this one file.

### 1.1 Narrow the input type and drop device-only fields

**Code before** (lines 5-25):

```typescript
import type { ObjectType } from '@/components/features/nautobot/tools/csv-updates/types'

interface ProcessCSVUpdatesInput {
  objectType: ObjectType
  csvData: {
    headers: string[]
    rows: string[][]
  }
  csvOptions?: {
    delimiter: string
    quoteChar: string
  }
  dryRun?: boolean
  tagsMode?: 'replace' | 'merge' // How to handle the tags field
  columnMapping?: Record<string, string> // { csvColumn: nautobotField } — only mapped columns
  selectedColumns?: string[] // CSV columns included in the update (derived from columnMapping)
  primaryKeyColumn?: string // CSV column used to look up objects in Nautobot
  matchingStrategy?: 'exact' | 'contains' | 'starts_with' // How to match objects by name
  nameTransform?: { mode: string; pattern: string; replacement: string } | null // Transform CSV name before lookup
  rackLocationColumn?: string | null // CSV column used as location filter when resolving rack UUIDs
}
```

**Code after:**

```typescript
import type { ObjectType } from '@/components/features/nautobot/tools/csv-updates/types'

/**
 * Object types this hook can submit. Devices are handled by
 * `useDeviceUpdatesMutations` (JSON payload → `celery/tasks/update-devices`)
 * and never flow through this hook — the wizard branches on `isDevices`
 * before calling `processUpdates`.
 */
type CsvUpdatesObjectType = Exclude<ObjectType, 'devices'>

interface ProcessCSVUpdatesInput {
  objectType: CsvUpdatesObjectType
  csvData: {
    headers: string[]
    rows: string[][]
  }
  csvOptions?: {
    delimiter: string
    quoteChar: string
  }
  dryRun?: boolean
  tagsMode?: 'replace' | 'merge' // How to handle the tags field
  columnMapping?: Record<string, string> // { csvColumn: nautobotField } — only mapped columns
  selectedColumns?: string[] // CSV columns included in the update (derived from columnMapping)
  primaryKeyColumn?: string // CSV column used to look up objects in Nautobot
}
```

### 1.2 Remove the dead `'devices'` endpoint case

**Code before** (lines 68-84):

```typescript
/**
 * Get the API endpoint for the given object type
 */
function getEndpointForObjectType(objectType: ObjectType): string {
  switch (objectType) {
    case 'ip-prefixes':
      return 'celery/tasks/update-ip-prefixes-from-csv'
    case 'devices':
      return 'celery/tasks/update-devices-from-csv'
    case 'ip-addresses':
      return 'celery/tasks/update-ip-addresses-from-csv'
    case 'locations':
      return 'celery/tasks/update-locations-from-csv' // TODO: Implement
    default:
      throw new Error(`Unsupported object type: ${objectType}`)
  }
}
```

**Code after:**

```typescript
/**
 * Get the API endpoint for the given object type
 */
function getEndpointForObjectType(objectType: CsvUpdatesObjectType): string {
  switch (objectType) {
    case 'ip-prefixes':
      return 'celery/tasks/update-ip-prefixes-from-csv'
    case 'ip-addresses':
      return 'celery/tasks/update-ip-addresses-from-csv'
    case 'locations':
      return 'celery/tasks/update-locations-from-csv' // TODO: Implement
    default:
      throw new Error(`Unsupported object type: ${objectType}`)
  }
}
```

(The runtime `default:` throw stays as a defence-in-depth guard; the narrowed
parameter type is the primary protection.)

### 1.3 Stop sending the device-only body fields

**Code before** (mutationFn body, lines 105-119):

```typescript
      const response = await apiCall(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          csv_content: csvContent,
          csv_options: input.csvOptions,
          dry_run: input.dryRun || false,
          tags_mode: input.tagsMode || 'replace',
          column_mapping: input.columnMapping, // Pass column mapping if provided
          selected_columns: input.selectedColumns, // Pass selected columns if provided
          primary_key_column: input.primaryKeyColumn, // Column used to look up objects
          matching_strategy: input.matchingStrategy || 'exact', // How to match by name
          name_transform: input.nameTransform ?? null, // Optional name transform before lookup
          rack_location_column: input.rackLocationColumn ?? null, // Location column for rack disambiguation
        }),
      })
```

**Code after:**

```typescript
      const response = await apiCall(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          csv_content: csvContent,
          csv_options: input.csvOptions,
          dry_run: input.dryRun || false,
          tags_mode: input.tagsMode || 'replace',
          column_mapping: input.columnMapping, // Pass column mapping if provided
          selected_columns: input.selectedColumns, // Pass selected columns if provided
          primary_key_column: input.primaryKeyColumn, // Column used to look up objects
        }),
      })
```

This is a behavioural no-op: the prefix/address request models never had these
fields, so Pydantic was already discarding them.

### 1.4 Remove the dead `'devices'` cache-invalidation case

Once `variables.objectType` is `CsvUpdatesObjectType`, the `case 'devices':`
clause is also a **compile error** (TS2678, case not comparable to the
narrowed union) — so this edit is enforced, not optional.

**Code before** (`onSuccess`, lines 123-136):

```typescript
    onSuccess: (data, variables) => {
      // Invalidate relevant caches based on object type
      switch (variables.objectType) {
        case 'devices':
          queryClient.invalidateQueries({ queryKey: queryKeys.nautobot.devices() })
          break
        case 'ip-prefixes':
        case 'ip-addresses':
          // Would invalidate IP-related queries if they existed
          break
        case 'locations':
          queryClient.invalidateQueries({ queryKey: queryKeys.nautobot.locations() })
          break
      }
```

**Code after:**

```typescript
    onSuccess: (data, variables) => {
      // Invalidate relevant caches based on object type
      switch (variables.objectType) {
        case 'ip-prefixes':
        case 'ip-addresses':
          // Would invalidate IP-related queries if they existed
          break
        case 'locations':
          queryClient.invalidateQueries({ queryKey: queryKeys.nautobot.locations() })
          break
      }
```

Device cache invalidation is not lost: the live device path
(`use-device-updates-mutations.ts:39-41`) already invalidates
`queryKeys.nautobot.devices()` in its own `onSuccess`.

## Phase 2 — `frontend/src/components/features/nautobot/tools/csv-updates/components/csv-update-wizard.tsx`

The wizard passes the three removed fields at both `processUpdates` call
sites. With Phase 1 applied they become type errors — remove them and update
the `useCallback` dependency arrays. **Do not** touch the wizard's
`matchingStrategy` / `nameTransform` / `rackLocationColumn` state itself: it
is still live for the devices flow (properties-step UI at lines 505-521 and
the client-side device payload building).

### 2.1 `handleDryRun`

**Code before** (lines 231-266, non-device branch and dependency array):

```typescript
      const response = await processUpdates.mutateAsync({
        objectType,
        csvData: { headers: selectedParsedData.headers, rows: selectedParsedData.rows },
        csvOptions: csvConfig,
        dryRun: true,
        tagsMode,
        columnMapping: columnMappingForBackend,
        selectedColumns,
        primaryKeyColumn,
        matchingStrategy,
        nameTransform,
        rackLocationColumn,
      })
      setDryRunTaskId(response.task_id)
    } catch {
      // Error handled by mutation's onError toast
    }
  }, [
    isDevices,
    selectedDeviceRows,
    primaryIpByDevice,
    effectiveDefaultProperties,
    processDeviceUpdates,
    processUpdates,
    objectType,
    selectedParsedData,
    csvConfig,
    tagsMode,
    columnMappingForBackend,
    selectedColumns,
    primaryKeyColumn,
    matchingStrategy,
    nameTransform,
    rackLocationColumn,
    setDryRunTaskId,
  ])
```

**Code after:**

```typescript
      const response = await processUpdates.mutateAsync({
        objectType,
        csvData: { headers: selectedParsedData.headers, rows: selectedParsedData.rows },
        csvOptions: csvConfig,
        dryRun: true,
        tagsMode,
        columnMapping: columnMappingForBackend,
        selectedColumns,
        primaryKeyColumn,
      })
      setDryRunTaskId(response.task_id)
    } catch {
      // Error handled by mutation's onError toast
    }
  }, [
    isDevices,
    selectedDeviceRows,
    primaryIpByDevice,
    effectiveDefaultProperties,
    processDeviceUpdates,
    processUpdates,
    objectType,
    selectedParsedData,
    csvConfig,
    tagsMode,
    columnMappingForBackend,
    selectedColumns,
    primaryKeyColumn,
    setDryRunTaskId,
  ])
```

### 2.2 `handleSubmit`

Same edit, mirrored. **Code before** (lines 285-324, non-device branch and
dependency array):

```typescript
      const response = await processUpdates.mutateAsync({
        objectType,
        csvData: { headers: selectedParsedData.headers, rows: selectedParsedData.rows },
        csvOptions: csvConfig,
        dryRun: false,
        tagsMode,
        columnMapping: columnMappingForBackend,
        selectedColumns,
        primaryKeyColumn,
        matchingStrategy,
        nameTransform,
        rackLocationColumn,
      })
      setTaskId(response.task_id)
      if (response.job_id) setJobId(parseInt(response.job_id, 10))
      goToStep('processing')
    } catch {
      // Error handled by mutation's onError toast
    }
  }, [
    isDevices,
    selectedDeviceRows,
    primaryIpByDevice,
    effectiveDefaultProperties,
    processDeviceUpdates,
    processUpdates,
    objectType,
    selectedParsedData,
    csvConfig,
    tagsMode,
    columnMappingForBackend,
    selectedColumns,
    primaryKeyColumn,
    matchingStrategy,
    nameTransform,
    rackLocationColumn,
    setTaskId,
    setJobId,
    goToStep,
  ])
```

**Code after:**

```typescript
      const response = await processUpdates.mutateAsync({
        objectType,
        csvData: { headers: selectedParsedData.headers, rows: selectedParsedData.rows },
        csvOptions: csvConfig,
        dryRun: false,
        tagsMode,
        columnMapping: columnMappingForBackend,
        selectedColumns,
        primaryKeyColumn,
      })
      setTaskId(response.task_id)
      if (response.job_id) setJobId(parseInt(response.job_id, 10))
      goToStep('processing')
    } catch {
      // Error handled by mutation's onError toast
    }
  }, [
    isDevices,
    selectedDeviceRows,
    primaryIpByDevice,
    effectiveDefaultProperties,
    processDeviceUpdates,
    processUpdates,
    objectType,
    selectedParsedData,
    csvConfig,
    tagsMode,
    columnMappingForBackend,
    selectedColumns,
    primaryKeyColumn,
    setTaskId,
    setJobId,
    goToStep,
  ])
```

### 2.3 Type-narrowing note (only if `tsc` complains)

Passing `objectType` (declared as `ObjectType`) where `CsvUpdatesObjectType`
is expected relies on TypeScript ≥ 4.4 aliased-condition narrowing: both
`objectType` and `isDevices` are `const`, and the `if (isDevices) { …; return }`
early-return narrows `objectType` to `Exclude<ObjectType, 'devices'>` in the
code that follows. This is expected to compile as-is.

**Fallback** (apply only if the build reports a type error at these two call
sites): replace `if (isDevices) {` with `if (objectType === 'devices') {` in
`handleDryRun` and `handleSubmit` (and drop `isDevices` from those two
dependency arrays in favour of `objectType`, which is already listed). Do
**not** silence the error with `as` casts — the direct comparison guarantees
the narrowing.

## Phase 3 — Verification (Definition of Done)

```bash
cd frontend
npm run lint          # must be clean (incl. react-hooks/exhaustive-deps)
npx tsc --noEmit      # confirms the narrowed union compiles at both call sites
```

Leftover sweep (must come back exactly as stated):

```bash
# Only two hits allowed: bulk-edit dialog (live) and the backend router
grep -rn "update-devices-from-csv" frontend/src backend/routers

# No device-only fields left in the hook
grep -n "matchingStrategy\|nameTransform\|rackLocationColumn\|'devices'" \
  frontend/src/hooks/queries/use-csv-updates-mutations.ts
```

Runtime click-through (backend + frontend + Celery worker running, dev env):

1. **CSV Updates → ip-prefixes** (the path whose payload changed): upload a
   prefix CSV, run **Dry Run** → task is queued against
   `celery/tasks/update-ip-prefixes-from-csv`, completes, and the summary
   matches the CSV. Repeat once for **ip-addresses** if a fixture is handy.
2. **CSV Updates → devices** (must be untouched): run a device dry run →
   request goes to `celery/tasks/update-devices` (JSON path), not the removed
   endpoint. Check the browser network tab.
3. **Bulk Edit → Bulk Update Devices from CSV** (live consumer of the kept
   endpoint, must be untouched): upload a small device CSV, run **Dry Run
   (Validate Only)** → task queued against
   `/api/celery/tasks/update-devices-from-csv`, job visible in Jobs/View.

Backend is untouched by this item — no `pytest` run required (running it is
harmless). Finally, update `doc/TODO_LEGACY_CODE.md` item 2: mark the frontend
action as done and leave the consolidation note (see below) in place.

## Explicitly out of scope (do not do in this change)

1. **The backend endpoint, task, and their tests stay untouched:**
   `backend/routers/jobs/import_update.py:29-80`,
   `backend/tasks/update_devices_from_csv_task.py`,
   `backend/tests/unit/tasks/test_update_devices_from_csv_task.py`,
   `UpdateDevicesRequest` in `backend/models/celery.py`, and the
   `tasks.update_devices_from_csv_task` queue route in
   `backend/celery_app.py:129`. The Bulk Edit dialog is a live caller.
2. **Backend dead-parameter trimming (possible follow-up, separate change):**
   after this refactoring, the endpoint's only caller (bulk-edit) sends just
   `csv_content` / `csv_options` / `dry_run`. The request/task parameters
   `tags_mode`, `column_mapping`, `selected_columns`, `primary_key_column`,
   `matching_strategy`, `name_transform`, `rack_location_column` then have no
   caller that sets them — removing them would also delete
   `_apply_name_transform` and roughly half of `_prepare_row_data` (plus their
   tests). Deliberately deferred: the TODO's guidance is to leave the backend
   alone, and bulk-edit may yet grow column-mapping support. Observation
   recorded while writing this plan: `tags_mode` is accepted and logged by
   `update_devices_from_csv_task` but never actually applied (it is not
   forwarded to `DeviceUpdateService.update_device`) — fold that into the
   follow-up when it happens.
3. **Row-prep consolidation** (`_prepare_row_data` in
   `update_devices_from_csv_task.py` vs. `_prepare_device_data` in
   `update_devices_task.py`): both feed
   `DeviceUpdateService.update_device()`; only the row/field preparation is
   duplicated. Consolidate into one shared helper only when bulk-edit is next
   touched — tracked by the note kept in `doc/TODO_LEGACY_CODE.md` item 2 and
   related to item 5 (the two CSV pipelines).
4. **The `'locations'` case** in `getEndpointForObjectType` points at an
   endpoint that does not exist yet (`update-locations-from-csv`, marked
   `// TODO: Implement`). Unrelated to this item — leave it.

## Risk notes

- **Overall risk: very low.** Frontend-only, removes code that is unreachable
  at runtime today; the type narrowing turns any future regression into a
  compile error instead of a silent re-route.
- Dropping `matching_strategy` / `name_transform` / `rack_location_column`
  from the POST body cannot change prefix/address behaviour: those request
  models never declared the fields, and Pydantic v2 (`extra='ignore'` default)
  was already discarding them.
- The only file shared with live device functionality is
  `csv-update-wizard.tsx` — the edits there are strictly limited to the two
  `processUpdates` argument lists and their dependency arrays. The wizard's
  `matchingStrategy` / `nameTransform` / `rackLocationColumn` state and the
  properties-step UI must remain untouched (still used by the devices flow).
- If an unknown external client POSTs to
  `/api/celery/tasks/update-devices-from-csv`, nothing changes for it — the
  endpoint is intentionally kept.
