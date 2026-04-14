# Rack Management App — Implementation Notes

## What Was Built

A page at `/nautobot/racks` that lets users visualize and edit rack device assignments. It shows the front and rear face of a rack side-by-side as an HTML-based elevation diagram. Empty units have an "+ add device" button; occupied units show the device name with action buttons. The page also supports CSV-based bulk position import, name validation against Nautobot, and rack reservations (created, saved, and reloaded from Nautobot).

---

## File Map

```
frontend/src/
├── app/(dashboard)/nautobot/racks/page.tsx           # Route entry (thin wrapper)
└── components/features/nautobot/racks/
    ├── racks-page.tsx                                # Main orchestrator, all state lives here
    ├── types/index.ts                                # All TypeScript types for this feature
    ├── constants/index.ts                            # Pixel constants, stale times, import fields
    ├── utils/
    │   └── name-transform.ts                         # Regex/replace name transform utility
    ├── components/
    │   ├── rack-selector-bar.tsx                     # Location + Rack + Mode + overwriteLocation selectors
    │   ├── rack-elevation.tsx                        # Renders one rack face; dual-popover system
    │   ├── rack-view.tsx                             # Side-by-side front + rear
    │   ├── rack-actions.tsx                          # Save Rack / Cancel / Import / Validate buttons
    │   ├── unpositioned-devices-panel.tsx            # "Non-Racked Devices" panel
    │   ├── unknown-csv-devices-panel.tsx             # "Unresolved CSV Devices" panel (from import)
    │   ├── import-positions-dialog.tsx               # 4-step CSV import wizard shell
    │   ├── import-positions-step-upload.tsx          # Step 1: file upload + CSV config
    │   ├── import-positions-step-mapping.tsx         # Step 2: column mapping
    │   ├── import-positions-step-properties.tsx      # Step 3: matching strategy + name transform
    │   ├── import-positions-step-resolve.tsx         # Step 4: resolve names + preview
    │   └── validate-names-dialog.tsx                 # Validate placed device names against Nautobot
    └── hooks/
        ├── use-locations-query.ts                    # Fetches all locations
        ├── use-racks-by-location-query.ts            # REST: GET /nautobot/racks?location={id}
        ├── use-rack-metadata-query.ts                # GraphQL: rack width, u_height, status
        ├── use-rack-devices-query.ts                 # GraphQL: devices + reservations in rack
        ├── use-device-search-query.ts                # Live search for "add device" popover
        ├── use-rack-save-mutation.ts                 # Save: assigns + clears + reservations
        └── use-import-positions.ts                   # 4-step import wizard logic + state

backend/routers/nautobot/rack_reservations.py         # GET + POST + DELETE reservation endpoints
```

**Modified shared files:**
- `frontend/src/lib/query-keys.ts` — added keys under `nautobot`: `rackMetadata(id)`, `rackDevices(id)`, `deviceSearch(filters)`
- `frontend/src/components/layout/app-sidebar.tsx` — added "Racks" entry under Nautobot section (`LayoutGrid` icon)
- `frontend/src/services/nautobot-graphql.ts` — `RACK_METADATA_QUERY`, `RACK_DEVICES_QUERY` added here

---

## Key Types (types/index.ts)

```typescript
// A single device or reservation occupying space in the rack
interface RackDevice {
  id: string               // Nautobot UUID, or "__reservation__::{uuid}" for loaded reservations
  name: string
  position: number | null  // Lowest U occupied, 1-indexed from bottom; null = unpositioned
  face: 'front' | 'rear' | null
  uHeight: number          // Number of rack units consumed (from device_type.u_height)
  isReservation?: boolean
  defaultPosition?: number // Pre-fills the position selector in the Non-Racked Devices panel
}

// One slot in a face mapping
interface RackSlotAssignment {
  deviceId: string
  deviceName: string
  uHeight: number
  isReservation?: boolean
}

type RackFaceAssignments = Record<number, RackSlotAssignment | null>

type RackMode = 'all' | 'location'
type MatchingStrategy = 'exact' | 'contains' | 'starts_with'

interface NameTransform {
  mode: 'regex' | 'replace'
  pattern: string
  replacement: string
}

// A CSV device that could not be resolved to a Nautobot device
interface UnknownCsvDevice {
  csvName: string
  csvPosition: number | null
  csvFace: 'front' | 'rear' | null
}

// Payload passed from the import wizard back to racks-page via onApply()
interface RackImportApplyPayload {
  newFront: RackFaceAssignments
  newRear: RackFaceAssignments
  newUnpositioned: RackDevice[]
  unknownCsvDevices: UnknownCsvDevice[]
}

interface DeviceSearchResult {
  id: string
  name: string
  uHeight?: number
}
```

---

## Constants (constants/index.ts)

```typescript
RACK_UNIT_HEIGHT_PX = 22       // Height of one rack unit row in pixels
RACK_GUTTER_WIDTH_PX = 31      // Left gutter (unit numbers)
RACK_BODY_WIDTH_PX = 230       // Device cell width
RACK_STATUS_INDICATOR_PX = 12  // Left status-color stripe width
DEVICE_SEARCH_MIN_CHARS = 2    // Minimum characters to trigger device search

// CSV column names the import wizard recognizes for auto-detection
RACK_IMPORT_FIELDS = { rack, position, face, location, rack_group }

// TanStack Query stale times
RACK_STALE_TIMES = {
  STATIC: 5 * 60 * 1000,      // Locations, rack list
  SEMI_STATIC: 2 * 60 * 1000, // Rack metadata
  DYNAMIC: 30 * 1000,         // Rack devices (changes after saves)
}
```

---

## GraphQL Queries

Both live in `frontend/src/services/nautobot-graphql.ts`.

**Rack metadata** (fetched by `use-rack-metadata-query.ts`):
```graphql
{
  racks(id: "<rack-uuid>") {
    id
    name
    type
    width
    u_height
    status { id name }
  }
}
```

**Devices and reservations in rack** (fetched by `use-rack-devices-query.ts`):
```graphql
{
  racks(id: "<rack-uuid>") {
    devices {
      id
      name
      position
      face
      device_type { u_height }
    }
    rack_reservations {
      id
      description
      units
    }
  }
}
```

The hook maps both into a single `RackDevice[]`:
- Devices: `uHeight = device_type?.u_height ?? 1`, face normalized to lowercase
- Reservations: `id = "__reservation__::{reservation_uuid}"`, `position = Math.min(...units)`, `uHeight = max(units) - min(units) + 1`, face always `'front'`, `isReservation = true`

`position` is the lowest U number the device occupies, 1-indexed from the bottom (Nautobot convention). `face` defaults to `'front'` when null or unknown.

---

## State Management (racks-page.tsx)

All state lives in `RacksPage`:

```typescript
// Selector / mode
selectedLocationId: string
selectedRackId: string
mode: RackMode              // 'all' | 'location'
overwriteLocation: boolean  // When true, PATCH assignments also include the location field

// Editable local copies — NOT persisted until Save
localFront: RackFaceAssignments      // Record<position, RackSlotAssignment | null>
localRear: RackFaceAssignments
localUnpositioned: RackDevice[]      // Devices with no position, or moved off the rack

// Originals for Cancel
originalFront: RackFaceAssignments
originalRear: RackFaceAssignments
originalUnpositioned: RackDevice[]

// CSV import state
unknownCsvDevices: UnknownCsvDevice[] // CSV devices not resolved to Nautobot devices

// Shared between import wizard and validate-names dialog
matchingStrategy: MatchingStrategy
nameTransform: NameTransform | null

// Inline device-search popover
activeSlot: { position: number; face: 'front' | 'rear' } | null
deviceSearchQuery: string

// Dialog visibility
importDialogOpen: boolean
validateDialogOpen: boolean
```

**Sync from query** (runs when `rackDevices` or `selectedRackId` changes):
```typescript
useEffect(() => {
  const front = buildFaceAssignments(rackDevices, 'front')
  const rear  = buildFaceAssignments(rackDevices, 'rear')
  setLocalFront(front);       setOriginalFront(front)
  setLocalRear(rear);         setOriginalRear(rear)
  setLocalUnpositioned(unpositioned)
  setOriginalUnpositioned(unpositioned)
}, [rackDevices, selectedRackId])
```

**Change detection** (`hasChanges`):
```typescript
const hasChanges = useMemo(
  () =>
    !assignmentsEqual(localFront, originalFront) ||
    !assignmentsEqual(localRear, originalRear) ||
    localUnpositioned.length !== originalUnpositioned.length,
  [...]
)
```

**Handlers:**
- `handleAdd(position, face, device)` — places a device into a face slot
- `handleRemove(position, face)` — removes a device from a slot (moves to unpositioned)
- `handleMoveToUnpositioned(position, face)` — ← button in elevation; moves placed device to panel
- `handleAddSlotReservation(position, description)` — inline reservation input in elevation
- `handleAddAsReservation(position, device)` — places an unpositioned reservation device into front face
- `handleAddReservation(device: UnknownCsvDevice)` — moves unknown CSV device to unpositioned as `__reservation__::csvName`
- `handleMapUnknownDevice(csvName, device, position, face)` — maps CSV device to real Nautobot device
- `handleImportApply(payload: RackImportApplyPayload)` — applies import wizard result to local state
- `handleApplyNames(renames: Map<deviceId, matchedName>)` — applies validate-names result
- `handleSave()` — calls save mutation
- `handleCancel()` — resets all local state to originals

---

## Rack Elevation Rendering (rack-elevation.tsx)

Rendered as HTML divs (not SVG) so interactive elements work naturally.

- Outer container: `width = RACK_GUTTER_WIDTH_PX (31) + RACK_BODY_WIDTH_PX (230) = 261px`
- Each row: `height = RACK_UNIT_HEIGHT_PX = 22px`
- Rows rendered top-to-bottom from `u_height` to `1`
- Rack frame: `border-2 border-black` overlay at `zIndex: 20`, offset from the gutter

**Multi-unit devices** are rendered as absolute-positioned blocks:
```
top = (u_height - position) * RACK_UNIT_HEIGHT_PX
height = uHeight * RACK_UNIT_HEIGHT_PX
```
Units covered by a multi-unit device are tracked in `occupiedUnits: Map<unit, isReservation>` to suppress duplicate slot buttons.

**Status color stripe** (left 12px of each device cell):
```typescript
STATUS_COLORS = {
  active:           '#4caf50',  // green
  planned:          '#2196f3',  // blue
  staged:           '#9c27b0',  // purple
  failed:           '#f44336',  // red
  decommissioning:  '#ff9800',  // orange
  inventory:        '#9e9e9e',  // gray
}
```
The stripe falls back to `#9e9e9e` for unknown or missing statuses.

**Visual treatment by slot type:**

| Slot | Background | Left stripe | Label |
|------|-----------|-------------|-------|
| Device (occupied) | `#9e9e9e` | STATUS_COLORS[status] | device name |
| Reservation | `#455a64` (dark blue-gray) | `#ffb300` (amber) | `[res] description` |
| Empty | `#f7f7f7` | — | `+ add device` |

**Dual-popover system:**
Each slot has two mutually exclusive interactive overlays — only one is open at a time, and click-outside closes both:

1. **Device-search popover** (controlled by `activeSlot` lifted to `racks-page`):
   - Opened by clicking an empty slot
   - Renders an `<Input>` that drives `useDeviceSearchQuery` (min 2 chars)
   - Results appear as a dropdown; selecting a result calls `onAdd(position, device)`

2. **Reservation inline input** (controlled by local `resSlot` state):
   - Opened by clicking the reservation icon on an empty slot
   - Renders a text `<Input>` for the description
   - Pressing Enter or blur with content calls `onAddReservation(position, description)`

**Move-to-unpositioned button** (← arrow): shown on every occupied slot; calls `onMoveToUnpositioned(position)`.

---

## Non-Racked Devices Panel (unpositioned-devices-panel.tsx)

Shows all devices with no rack position — either loaded from Nautobot with no assignment, moved off the rack, or brought in by the import wizard.

- **Position selector** — lists only unoccupied positions; pre-filled by `defaultPosition` if set (from CSV)
- **F button** — assigns device to front face at selected position
- **R button** — assigns device to rear face at selected position
- **RES button** — assigns device as a reservation placeholder at selected position (only shown when `isReservation = true`)

---

## Unresolved CSV Devices Panel (unknown-csv-devices-panel.tsx)

Shown after import when CSV device names could not be resolved to Nautobot devices.

Each row shows:
- `csvName` — the name as it appeared in the CSV file
- A live search `<Input>` — drives `useDeviceSearchQuery` (min 2 chars); selecting a result calls `onMapDevice(csvName, device, csvPosition, csvFace)` which places the device correctly from the CSV position data
- `→` (ArrowRight) button — calls `onAddReservation(unknownCsvDevice)`, which moves the CSV row to the Non-Racked Devices panel as `__reservation__::csvName`

---

## Save Logic (use-rack-save-mutation.ts)

On save, the mutation computes five batches of operations from the local vs original diff:

| Batch | Condition | API call |
|-------|-----------|----------|
| `removals` | Device was in a rack slot, is not in any slot now | `PATCH /nautobot/devices/{id}` `{ clear_rack_assignment: true }` |
| `positionClears` | Device moved within same rack (avoid old slot conflict) | `PATCH /nautobot/devices/{id}` `{ clear_position_only: true }` |
| `assignments` | Device has a new position/face | `PATCH /nautobot/devices/{id}` `{ rack, position, face, [location?] }` |
| `reservationSlots` | New reservation slots (ID starts with `__reservation__::`) | `POST /nautobot/rack-reservation` per unique description |
| `reservationDeletions` | Reservation removed from rack | `DELETE /nautobot/rack-reservation?ids=...` |

`removals` and `positionClears` run first; `assignments` and `reservationSlots` run after. `willBeAssignedIds` prevents a device from being cleared and re-assigned in the wrong order.

**Multi-unit reservations:** slots sharing the same `deviceName` are grouped into a single `POST` call with `units: [u1, u2, ...]`.

**`overwriteLocation` flag:** when set, every device `PATCH` includes `{ location: locationId }` in addition to rack/position/face. This lets the import correct the Nautobot location for devices that were previously assigned to a different location.

---

## Reservation ID Convention

| Prefix format | Meaning |
|--------------|---------|
| `__reservation__::{uuid}` | Loaded from Nautobot (a real `rack_reservation` UUID) |
| `__reservation__::{csvName}` | Created locally from an unresolved CSV device; becomes a POST on save |

The save mutation uses `id.startsWith('__reservation__::')` to detect reservation slots. For deletions, it checks whether the suffix looks like a UUID to decide whether to include it in the `DELETE` call.

---

## CSV Import Wizard (use-import-positions.ts + import-positions-dialog.tsx)

A 4-step dialog. State and logic live in `use-import-positions.ts`; the dialog shell and step components (`import-positions-step-*.tsx`) handle rendering.

### Step 1 — Upload

- File picker (`.csv`, `.tsv`, `.txt`)
- CSV config: delimiter (default `,`), quote character (default `"`)
- Parse button — reads file content, splits into rows/columns
- Auto-detects candidate columns for device name, rack, position, face, location, rack_group by matching header names against `RACK_IMPORT_FIELDS`

### Step 2 — Mapping

- `deviceNameColumn`: which CSV column holds the device name (required)
- `fieldMapping`: maps each recognized import field to a CSV column index
- `locationColumn`: CSV column for location filtering (required for finish)

### Step 3 — Properties

- `matchingStrategy`: `exact` | `contains` | `starts_with` — how CSV device names are matched against Nautobot device names
- `nameTransform`: optional transform applied before matching (see Name Transform Utility below)
- `clearRackBeforeImport` toggle: if on, existing rack assignments are cleared before applying CSV positions
- `previewMatchCount`: reactive count of CSV rows that match the current rack + selected location (updates as user changes settings)

### Step 4 — Resolve (handleFinish)

1. Filter CSV rows to those matching the current rack name and location name
2. Collect unique device names from filtered rows
3. For each name: apply `nameTransform` → call `GET /nautobot/devices?name_ic=...` → apply `matchingStrategy` → map to a device ID or mark as `notFound`
4. Build `newFront` and `newRear` from CSV rows using the resolved device IDs
5. Existing unpositioned devices with unresolved positions carry over to `newUnpositioned`
6. Unresolved names become `UnknownCsvDevice[]` entries
7. Calls `onApply(RackImportApplyPayload)` to update `racks-page` state

**Navigation guard:** "Finish" is enabled only when `locationColumn !== null && previewMatchCount > 0 && !isResolving`.

---

## Validate Names Dialog (validate-names-dialog.tsx)

Accessible from `rack-actions.tsx`. Checks all currently placed devices (front + rear + unpositioned, excluding reservations) against Nautobot to catch name drift.

1. Collects unique device IDs from local state
2. For each: applies `nameTransform`, calls `GET /nautobot/devices?name_ic=...&location_id=...`, applies `matchingStrategy`
3. Displays a table: found (✓) / not-found (✗), original name, transform column (shown only when some names differ), matched Nautobot name
4. Sorted: not-found first, then alphabetically
5. **Apply Names** — calls `onApplyNames(Map<deviceId, matchedName>)` which updates `deviceName` in all three local face mappings

`matchingStrategy` and `nameTransform` are shared state from `racks-page`, so changes in this dialog apply to the import wizard as well.

---

## Name Transform Utility (utils/name-transform.ts)

Transforms a device name string before matching against Nautobot. Applied once per device, in both the import wizard and the validate-names dialog.

```typescript
function applyNameTransform(name: string, transform: NameTransform | null): string
```

| Mode | Behavior |
|------|----------|
| `regex` | Runs `RegExp.exec(name)`. Returns capture group 1 if present, else the full match. Returns original name if no match or invalid pattern. |
| `replace` | Runs `name.replace(new RegExp(pattern, 'g'), replacement)`. Empty replacement deletes the matched portion. Returns original name on invalid pattern. |

---

## REST Backend Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /nautobot/locations` | All locations (used by selector) |
| `GET /nautobot/racks?location={id}` | Racks for a location |
| `POST /nautobot/graphql` | GraphQL proxy to Nautobot |
| `GET /nautobot/devices?name_ic={q}&location_id={id}` | Device search (import wizard, validate, add-device popover) |
| `GET /nautobot/rack-reservation?rack={name}&location={name}` | Load existing rack reservations (GraphQL) |
| `POST /nautobot/rack-reservation` | Create a rack reservation |
| `DELETE /nautobot/rack-reservation?ids={id},{id},...` | Bulk-delete rack reservations |

### POST /nautobot/rack-reservation

**File:** `backend/routers/nautobot/rack_reservations.py`

```python
class RackReservationCreate(BaseModel):
    rack_id: str       # UUID of the rack
    units: list[int]   # 1-based unit numbers
    description: str   # Label (typically the CSV device name)
    location_id: str   # UUID of the location
```

The endpoint:
1. Calls `GET /api/users/tokens/?key=<configured_token>` to resolve the Nautobot user UUID
2. Calls `POST /dcim/rack-reservations/` with `{ rack, units, user, description, location }`

### DELETE /nautobot/rack-reservation

Accepts a comma-separated `ids` query parameter. Sends a bulk `DELETE /dcim/rack-reservations/` REST call to Nautobot with `[{ id }, { id }, ...]` payload.

---

## Key Patterns to Follow

- **Query key factory**: add new keys to `frontend/src/lib/query-keys.ts` under `nautobot`
- **Invalidate cache** after save: `queryKeys.nautobot.rackDevices(rackId)`
- **Face normalization**: always call `.toLowerCase().trim()` on face values from Nautobot — the API may return mixed case
- **Reservation detection**: check `id.startsWith('__reservation__::')` to distinguish reservations from real devices
- **Multi-unit devices**: always use `uHeight` from `device_type.u_height` (default 1); use absolute positioning for the elevation block, not one row per unit
- **Shared strategy state**: `matchingStrategy` and `nameTransform` are lifted to `racks-page` so both the import wizard and the validate dialog stay in sync
- **Default parameters**: use module-level constants (not inline `{}` or `[]`) for default hook parameters to avoid re-render loops
