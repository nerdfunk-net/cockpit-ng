# Rack Management App — Implementation Notes

## What Was Built

A new page at `/nautobot/racks` that lets users visualize and edit rack device assignments. It shows the front and rear face of a rack side-by-side as an HTML-based elevation diagram. Empty units have an "+ add device" button; occupied units show the device name with a "−" remove button.

---

## File Map

```
frontend/src/
├── app/(dashboard)/nautobot/racks/page.tsx           # Route entry (thin wrapper)
├── components/features/nautobot/racks/
│   ├── racks-page.tsx                                # Main orchestrator, all state lives here
│   ├── components/
│   │   ├── rack-selector-bar.tsx                     # Location + Rack + Mode selectors
│   │   ├── rack-elevation.tsx                        # Renders one rack face (front OR rear)
│   │   ├── rack-view.tsx                             # Side-by-side front + rear
│   │   └── rack-actions.tsx                          # Save Rack / Cancel buttons
│   ├── hooks/
│   │   ├── use-locations-query.ts                    # Fetches all locations
│   │   ├── use-racks-by-location-query.ts            # REST: GET /nautobot/racks?location={id}
│   │   ├── use-rack-metadata-query.ts                # GraphQL: rack width, u_height, status
│   │   ├── use-rack-devices-query.ts                 # GraphQL: devices assigned to rack
│   │   └── use-device-search-query.ts                # Live search for "add device" popover
│   ├── types/index.ts
│   └── constants/index.ts
└── services/nautobot-graphql.ts      # RACK_METADATA_QUERY, RACK_DEVICES_QUERY added here
```

**Modified files:**
- `frontend/src/lib/query-keys.ts` — added `rackMetadata(id)`, `rackDevices(id)`, `deviceSearch(filters)`
- `frontend/src/components/layout/app-sidebar.tsx` — added "Racks" entry under Nautobot section (`LayoutGrid` icon)

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

**Devices in rack** (fetched by `use-rack-devices-query.ts`):
```graphql
{
  devices(rack: "<rack-uuid>") {
    id
    name
    position
    face
  }
}
```

`position` is the lowest U number the device occupies, 1-indexed from the bottom (Nautobot convention).
`face` is normalized to lowercase in `use-rack-devices-query.ts` — Nautobot may return "front", "Front", or null. Unknown/null values default to "front".

---

## State Management (racks-page.tsx)

All state lives in `RacksPage`. Key pieces:

```typescript
// Selector state
selectedLocationId: string
selectedRackId: string
mode: RackMode  // 'all' | 'location'

// Editable local copies — NOT persisted until Save
localFront: RackFaceAssignments   // Record<position, { deviceId, deviceName } | null>
localRear:  RackFaceAssignments

// Originals for Cancel
originalFront: RackFaceAssignments
originalRear:  RackFaceAssignments

// Inline "add device" popover
activeSlot: { position: number; face: 'front' | 'rear' } | null
deviceSearchQuery: string
```

`RackFaceAssignments = Record<number, { deviceId: string; deviceName: string } | null>`

**Sync from query:**
```typescript
useEffect(() => {
  const front = buildFaceAssignments(rackDevices, 'front')
  const rear  = buildFaceAssignments(rackDevices, 'rear')
  setLocalFront(front);  setOriginalFront(front)
  setLocalRear(rear);    setOriginalRear(rear)
}, [rackDevices, selectedRackId])
```

---

## Rack Elevation Rendering (rack-elevation.tsx)

Rendered as HTML divs (not SVG) so interactive elements work naturally.

- Outer container: `width = RACK_GUTTER_WIDTH_PX (31) + RACK_BODY_WIDTH_PX (230) = 261px`
- Each row: `height = RACK_UNIT_HEIGHT_PX = 22px`
- Rows rendered from `u_height` (top) down to `1` (bottom)
- Rack frame: `border-[4px] border-black`, offset `-2px` on all sides

**Occupied unit:**
```
[status bar 12px][device name, white text, truncated][− remove btn 18px]
background: #9e9e9e
```

**Empty unit:**
```
[+ add device, always visible, gray text]
background: #f7f7f7
```

**Add device popover:** clicking an empty unit sets `activeSlot`. The unit renders an inline `<Input>` that drives `useDeviceSearchQuery`. Results appear as a dropdown overlay. Pressing Enter or clicking a result calls `onAdd(position, device)`.

---

## REST Backend Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /nautobot/locations` | All locations (used by selector) |
| `GET /nautobot/racks?location={id}` | Racks for a location |
| `POST /nautobot/graphql` | GraphQL proxy to Nautobot |
| `GET /nautobot/devices?name_ic={q}&location={id}` | Device search for "add" popover |
| `GET /nautobot/rack-reservation?rack={name}&location={name}` | Query existing rack reservations (GraphQL) |
| `POST /nautobot/rack-reservation` | Create a rack reservation for unknown/placeholder devices |

---

## Rack Reservation Flow

When importing positions via CSV, devices not found in Nautobot appear in the **Unresolved CSV Devices** panel. Each row has:
- A text input to search and map the unknown device to a real Nautobot device
- A `→` icon button to add the device as a **rack reservation** instead

### Adding a reservation

Clicking `→` moves the unknown device to the **Non-Racked Devices** panel as a reservation placeholder:
- Synthetic device ID: `__reservation__::{csvName}` (never sent to Nautobot as a real device)
- If the CSV row had a position, the Position dropdown is pre-filled
- The row shows only a **(RES)** button (no F/R buttons)

Clicking **(RES)** places the reservation into the rack's front face at the chosen position. It renders with:
- Dark blue-gray background (`#455a64`) vs normal gray (`#9e9e9e`)
- Amber left stripe (instead of the device status color)
- Label prefix `[res]` before the device name

### Saving reservations

When the user clicks **Save**, `use-rack-save-mutation.ts` separates reservation slots from regular device slots:
- **Regular devices**: `PATCH /nautobot/devices/{id}` with rack/position/face
- **Reservation slots**: `POST /nautobot/rack-reservation` with `{ rack_id, units, description, location_id }`
  - `description` = the unknown device name
  - Multiple units with the same name are grouped into one reservation call

### Backend endpoint: `POST /nautobot/rack-reservation`

**File:** `backend/routers/nautobot/rack_reservations.py`

```python
class RackReservationCreate(BaseModel):
    rack_id: str          # UUID of the rack
    units: list[int]      # 1-based unit numbers
    description: str      # Label (unknown device name)
    location_id: str      # UUID of the location
```

The endpoint:
1. Calls `GET /api/users/tokens/?key=<configured_token>` to resolve the Nautobot user UUID
2. Calls `POST /dcim/rack-reservations/` with `{ rack, units, user, description, location }`

---

## What Is NOT Yet Implemented

Rack reservations created in Nautobot are not loaded back into the rack elevation view on page reload. The view only loads `devices(rack: ...)` via GraphQL, which does not include `rack_reservations`. A future enhancement would fetch and display existing reservations in the rack elevation with the same dark-gray visual.

---

## Key Patterns to Follow

- **Reuse `useSearchableDropdown`** from `add-device/hooks/use-searchable-dropdown` — already imported by the rack selector bar
- **Reuse `SearchableDropdownInput`** from `add-device/components/searchable-dropdown-input`
- **Query key factory**: add new keys to `frontend/src/lib/query-keys.ts` under `nautobot`
- **Mutations**: follow `useDeviceMutations` pattern in `add-device/hooks/queries/use-device-mutations.ts`
- **Invalidate cache** after save: `queryKeys.nautobot.rackDevices(rackId)`
- **Face normalization**: always call `.toLowerCase().trim()` on face values from Nautobot — the API may return mixed case
