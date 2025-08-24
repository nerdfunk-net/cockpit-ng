# Location Filter Specification

Machine-usable specification for the Location Filter implemented in `onboard-device-page.tsx`.
This document describes the contract, data shapes, helper functions, UI/state model, interactions,
edge cases, accessibility requirements and tests. An AI agent can use this to implement the same
filter in another app.

## Purpose

Provide a reusable UI widget that allows users to search and select a Nautobot location using
a human-friendly hierarchical path (e.g. "Region → Site → Rack").

## Contract

- Input (runtime):
	- `locationSearch: string` — user's typed query
	- `locations: LocationItem[]` — array fetched from API `nautobot/locations`

- Output:
	- `selectedLocation: LocationItem | null` — selected location object (at minimum contains `id`, `name`)
	- `filteredLocations: LocationItem[]` — list shown in the dropdown

- Error modes:
	- API/network error → present an error state and fallback to empty list
	- Cyclic parent links → break traversal and mark path as truncated

## Data Shapes

Incoming (API) location item (partial):

{
	id: string,
	name: string,
	parent?: { id: string },
	// possible other Nautobot fields (ignored)
}

Normalized internal type `LocationItem`:

{
	id: string,
	name: string,
	parent?: { id: string },
	hierarchicalPath?: string  // computed, e.g. "Region → Site → Rack"
}

## Core helpers (implement exactly these signatures)

// Compute hierarchicalPath for each location and sort the list
function buildLocationHierarchy(locations: LocationItem[]): LocationItem[]

// Build a path string for a single location by traversing parents
function buildLocationPath(location: LocationItem, locationMap: Map<string, LocationItem>): string

// Utility to choose default option by name
function findDefaultOption<T extends { id: string; name?: string; display?: string }>(
	options: T[], name: string
): T | undefined

Implementation notes:
- `buildLocationHierarchy` must:
	1. Build a Map from id → location for O(1) parent lookups.
	2. Compute `hierarchicalPath` using `buildLocationPath` for each location.
	3. Sort returned array by `hierarchicalPath` (localeCompare).

- `buildLocationPath` must:
	1. Walk `.parent?.id` up to the root collecting names.
	2. Detect cycles using a `visited` set and stop traversal if a cycle is detected.
	3. Stop traversal if a parent id is missing in the map; return partial path.
	4. Join names with ` → ` and return a single string.

Example behavior:
- Input chain A (parent B) → B (parent C) → C (no parent) → returns "C → B → A" if you choose root-first ordering, or "A → B → C" for leaf-to-root; the implementation in `onboard-device-page.tsx` returns leaf-to-root joined with ` → ` so preserve that.

## UI / State model

Required state variables (names recommended for compatibility):

- `locations: LocationItem[]` — processed list with `hierarchicalPath`
- `filteredLocations: LocationItem[]` — results currently shown in dropdown
- `locationSearch: string` — the text input bound to the search field
- `showLocationDropdown: boolean` — whether dropdown is visible
- `selectedLocationId: string | ''` — id of selected location
- `isLoading: boolean` — loading state while fetching
- `statusMessage?: { type: 'info'|'error'|'success'|'warning'; message: string }`

Behavior and interactions:

1. On mount, fetch locations from `nautobot/locations`, compute `locations = buildLocationHierarchy(...)` and set `filteredLocations = locations`.
2. When the user types into the input, update `locationSearch` and set `filteredLocations` to the subset where `location.hierarchicalPath.toLowerCase().includes(locationSearch.toLowerCase())`.
3. If `locationSearch` is empty, `filteredLocations = locations`.
4. Clicking a dropdown item sets `selectedLocationId` to that item's `id`, sets `locationSearch` to its `hierarchicalPath`, and hides the dropdown.
5. Clicking outside the dropdown sets `showLocationDropdown = false`.
6. If `locations` is large, debounce the search input and consider virtualized list rendering.

UI display guidelines:

- Show `hierarchicalPath` in each dropdown row.
- Provide a "No locations found" message when `filteredLocations` is empty.
- Limit dropdown height with `max-height` and `overflow-y: auto`.

## Accessibility

- Input: `role="combobox"`, `aria-expanded`, `aria-controls`
- Dropdown list: `role="listbox"` and each item `role="option"`
- Keyboard support: ArrowUp/ArrowDown to navigate, Enter to select, Esc to close
- Announce status messages using `aria-live` for API errors and success messages

## Edge cases

- Cycles: detect via `visited` set and return truncated path with a marker like ` (cycle)`; do not throw.
- Missing parents: return a partial hierarchical path built from known ancestors.
- Duplicate names: rely on `hierarchicalPath` to disambiguate.
- Empty API response: present "No locations configured" and disable required-field submission.

## Performance

- Compute `hierarchicalPath` once after fetch and cache it.
- Use a Map for parent lookup (O(1) per step).
- Debounce user input (150–300ms) for large sets.
- For very large lists (>1000), consider windowed/virtualized dropdown rendering.

## Tests

Unit tests (examples):

- buildLocationPath
	- simple chain: expect exact path string
	- missing parent: returns partial path
	- cycle detection: returns truncated path and does not infinite-loop

- buildLocationHierarchy
	- returns list sorted by `hierarchicalPath`
	- computes `hierarchicalPath` for each entry

Integration tests:

- Mount component with mocked `nautobot/locations` response and assert:
	- dropdown shows computed `hierarchicalPath`
	- typing filters results case-insensitively
	- clicking an item sets `selectedLocationId` and input value

## Example pseudocode (consumer-ready)

// Initialization
const raw = await apiCall('nautobot/locations')
const locations = buildLocationHierarchy(raw)
setLocations(locations)
setFilteredLocations(locations)

// On input change
function onSearchChange(q) {
	setLocationSearch(q)
	if (!q.trim()) setFilteredLocations(locations)
	else setFilteredLocations(locations.filter(l => l.hierarchicalPath.toLowerCase().includes(q.toLowerCase())))
	setShowLocationDropdown(true)
}

// On select
function onSelect(location) {
	setSelectedLocationId(location.id)
	setLocationSearch(location.hierarchicalPath)
	setShowLocationDropdown(false)
}

## Implementation notes for an AI agent

- Use the exact helper names in this spec for maximum reuse.
- Prefer computing `hierarchicalPath` once after fetch.
- Ensure cycle detection in path traversal.
- Provide keyboard and ARIA support to make the control accessible.

---

This file is intentionally implementation-oriented. If you want, I can also add a small TypeScript utility file implementing `buildLocationHierarchy` and `buildLocationPath` and a matching Jest test file.

