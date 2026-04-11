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

## REST Backend Endpoints Already Available

| Endpoint | Purpose |
|----------|---------|
| `GET /nautobot/locations` | All locations (used by selector) |
| `GET /nautobot/racks?location={id}` | Racks for a location |
| `POST /nautobot/graphql` | GraphQL proxy to Nautobot |
| `GET /nautobot/devices?name_ic={q}&location={id}` | Device search for "add" popover |

---

## What Is NOT Yet Implemented

### 1. Add Device to Rack (backend)

The frontend "add device" flow is complete: the user searches for a device, clicks it, and it appears in the rack unit locally. But there is **no backend call** to persist this to Nautobot.

**What needs to happen:**
When a device is assigned to a rack unit, Nautobot must be updated with:
- `rack` = rack UUID
- `position` = unit number (1-based from bottom)
- `face` = `"front"` or `"rear"`

This is a **PATCH** on the device in Nautobot:
```
PATCH /dcim/devices/{device-id}/
Body: { "rack": "<rack-uuid>", "position": 10, "face": "front" }
```

A new backend endpoint is needed, e.g.:
```
PATCH /nautobot/devices/{device-id}/rack-assignment
Body: { rack_id, position, face }
```

Or alternatively, the existing `PUT/PATCH /nautobot/devices/{id}` endpoint (if it exists).

### 2. Remove Device from Rack (backend)

Removing a device from a rack slot means clearing its rack assignment in Nautobot:
```
PATCH /dcim/devices/{device-id}/
Body: { "rack": null, "position": null, "face": null }
```

Same new endpoint can handle this (pass `rack_id: null`).

### 3. Save Rack (frontend wiring)

`handleSave()` in `racks-page.tsx` currently just logs the payload:
```typescript
const handleSave = useCallback(() => {
  const payload = { rackId: selectedRackId, front: localFront, rear: localRear }
  console.log('[RackSave] payload:', payload)
}, [selectedRackId, localFront, localRear])
```

**What needs to happen:**
Compare `localFront` / `localRear` with `originalFront` / `originalRear` to find:
- **Added assignments**: positions present in local but not in original → PATCH device to assign rack
- **Removed assignments**: positions present in original but not in local → PATCH device to clear rack

Then call the backend for each diff entry. A mutation hook is needed:

```typescript
// hooks/use-rack-save-mutation.ts
export function useRackSaveMutation() {
  const { apiCall } = useApi()
  return useMutation({
    mutationFn: async (changes: RackChange[]) => {
      // changes: Array<{ deviceId, rack, position, face } | { deviceId, rack: null }>
      await Promise.all(changes.map(c =>
        apiCall(`nautobot/devices/${c.deviceId}/rack-assignment`, {
          method: 'PATCH',
          body: JSON.stringify(c),
        })
      ))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.nautobot.rackDevices(rackId) })
    },
  })
}
```

After save succeeds, update `originalFront`/`originalRear` to match local state so `hasChanges` resets to false.

---

## Key Patterns to Follow

- **Reuse `useSearchableDropdown`** from `add-device/hooks/use-searchable-dropdown` — already imported by the rack selector bar
- **Reuse `SearchableDropdownInput`** from `add-device/components/searchable-dropdown-input`
- **Query key factory**: add new keys to `frontend/src/lib/query-keys.ts` under `nautobot`
- **Mutations**: follow `useDeviceMutations` pattern in `add-device/hooks/queries/use-device-mutations.ts`
- **Invalidate cache** after save: `queryKeys.nautobot.rackDevices(rackId)`
- **Face normalization**: always call `.toLowerCase().trim()` on face values from Nautobot — the API may return mixed case
