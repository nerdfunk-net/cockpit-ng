# locations2checkmk

Syncs Nautobot locations to a CheckMK host tag group.

## Usage

```bash
cd backend
python scripts/locations2checkmk/sync.py
python scripts/locations2checkmk/sync.py --dry-run
python scripts/locations2checkmk/sync.py --activate
python scripts/locations2checkmk/sync.py --config path/to/config.yaml
python scripts/locations2checkmk/sync.py --log-level DEBUG
```

## Configuration

`config.yaml` accepts the following keys:

| Key | Required | Description |
|-----|----------|-------------|
| `nautobot_htg` | yes | CheckMK host tag group name to create or update |
| `nautobot_filter` | yes* | Which Nautobot locations to sync, e.g. `"location_type=Room"` |
| `value` | no | Template for the tag **title** shown in CheckMK (default: `{location.name}`) |
| `checkmk_id` | no | Template for the tag **ID** stored in CheckMK (default: slugified `value`) |
| `location_type` | deprecated | Superseded by `nautobot_filter`; still accepted for backward compatibility |

\* Either `nautobot_filter` or the legacy `location_type` must be present.

---

## `nautobot_filter`

Selects which locations are synced to CheckMK. Currently supports filtering by location type:

```yaml
nautobot_filter: "location_type=Room"
```

Multiple conditions can be combined with commas (all must match):

```yaml
nautobot_filter: "location_type=Room,name=ServerRoom"
```

---

## `value` and `checkmk_id` templates

`value` defines the **tag title** shown in CheckMK. `checkmk_id` defines the **tag ID**
stored in CheckMK (must be unique within the tag group). Both are optional templates
resolved against the location's ancestor hierarchy.

When `checkmk_id` is omitted the ID is derived automatically by slugifying the `value`
result (lowercase, non-alphanumeric characters replaced with `_`). Use `checkmk_id`
when you want a shorter or differently structured ID than what slugifying the title
would produce.

Both templates use `{expression}` placeholders:

### Syntax

```
{field.path}                          # field from the location itself
{field.path | location_type:TypeName} # field from the nearest ancestor of that type
```

- **`field.path`** — dot-notation path, e.g. `location.name`
- **`| location_type:TypeName`** — walk up the ancestor chain and use the first location
  whose type matches `TypeName` (case-insensitive)
- Multiple `{...}` expressions are joined by whatever literal text separates them

Use `{location.name}` (without a type filter) for the location's own name. The
`| location_type:X` filter is for looking up **ancestors**.

The tag ID stored in CheckMK is the slugified (lowercase, non-alphanumeric → `_`) version
of the resolved title.

### Location hierarchy

Nautobot locations form a tree. A typical hierarchy looks like:

```
Country → State → City → Building → Room
```

When syncing Rooms, `| location_type:City` traverses upward through Building until it
finds the City ancestor. The script fetches **all** locations and reconstructs full
ancestor chains in memory, so filters can reach any depth.

---

## Examples

### Example 1 — Rooms with a short ID and a descriptive title

Devices are placed in Rooms. The tag ID should be just the room name (short, stable),
while the title shown in CheckMK should include the city for human readability.

```yaml
---
nautobot_htg: location
nautobot_filter: "location_type=Room"
checkmk_id: "{location.name}"
value: "{location.name} {location.name | location_type:City}"
```

Given the hierarchy `CityA → Building A → Room A` and `CityA → Building A1 → Room A1`:

| Tag ID | Tag title |
|--------|-----------|
| `room_a` | Room A CityA |
| `room_a1` | Room A1 CityA |

`checkmk_id: "{location.name}"` slugifies to just `room_a`. Without `checkmk_id` the ID
would have been `room_a_citya` (slugified full title). `{location.name | location_type:City}`
in `value` walks up to the nearest City ancestor regardless of how many Buildings are in
between.

---

### Example 2 — Cities by name only

Simple case: one tag per city, using only the city's name.

```yaml
---
nautobot_htg: location
nautobot_filter: "location_type=City"
value: "{location.name}"
```

Given cities `Berlin`, `Hamburg`, `Munich`:

| Tag ID | Tag title |
|--------|-----------|
| `berlin` | Berlin |
| `hamburg` | Hamburg |
| `munich` | Munich |

When `value` is omitted the default is `{location.name}`, so this is equivalent to
leaving `value` out entirely.

---

### Example 3 — Buildings with their state

```yaml
---
nautobot_htg: dc_location
nautobot_filter: "location_type=Building"
value: "{location.name} ({location.name | location_type:State})"
```

Produces tags like `building_a_state_a` with title `Building A (State A)`.

---

## Behaviour

- **Additive only**: existing tags in CheckMK are never removed, only new ones are added.
- **Deduplication**: if two locations produce the same composed value they share one tag entry.
- **Fallback**: if no ancestor matches the requested `location_type`, the expression resolves
  to an empty string and the location is skipped with a warning.
- **`--dry-run`**: prints all planned additions without making any API calls.
- **`--activate`**: activates CheckMK changes after a successful sync (skipped in dry-run
  and when nothing was added).
