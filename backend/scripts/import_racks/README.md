# import_locations.py — Rack & Location Importer

Imports locations (buildings, rooms, …) and racks from a CSV file into Nautobot.
The import is fully driven by `config.yaml` — no code changes are needed when your
site hierarchy or CSV layout changes.

---

## Prerequisites

- Python virtual environment active
- Working directory: `backend/`
- Nautobot connection configured (environment variables / `.env`)

---

## Usage

```bash
cd backend

# Minimal — uses config.yaml next to the script
python scripts/import_racks/import_locations.py \
    --csv scripts/import_racks/sample_data.csv

# Custom config file
python scripts/import_racks/import_locations.py \
    --csv data.csv \
    --config /path/to/custom_config.yaml

# Verbose output for debugging
python scripts/import_racks/import_locations.py \
    --csv data.csv \
    --log-level DEBUG
```

### Arguments

| Argument | Required | Default | Description |
|---|---|---|---|
| `--csv` | yes | — | Path to the CSV file to import |
| `--config` | no | `config.yaml` (next to script) | Path to the YAML config file |
| `--log-level` | no | `INFO` | Logging verbosity: `DEBUG`, `INFO`, `WARNING`, `ERROR` |

---

## CSV Format

The CSV must have a header row. Column names are referenced by `config.yaml`.

Example (`sample_data.csv`):

```csv
name,position,country,city,building_short,room,rack
lab-003,10,Country A,city_a,building_a1,Room A1,A_1
lab-010,12,Country A,city_a,building_a2,Room A2,A_2
```

Only the columns referenced in `config.yaml` are used. Extra columns are ignored.

---

## Configuration (`config.yaml`)

### `import` — columns to import as Nautobot locations

Maps CSV column names to Nautobot location type names.
Each entry creates locations of that type for every unique value found in the column.

```yaml
import:
  - csv: room           # CSV column name
    nautobot: Room      # Nautobot location type name
  - csv: building_short
    nautobot: Building
```

### `dependencies` — parent-child hierarchy

Defines the location type hierarchy and which type holds the rack.

```yaml
dependencies:
  - name: Rack
    location: Room      # Nautobot location type that contains racks
  - name: Room
    parent: Building    # Room is a child of Building
  - name: Building
    parent: City
  - name: City
    parent: State
  - name: State
    parent: Country
  - name: Country
    parent: null        # Top-level — no parent
```

- `location` on the `Rack` entry tells the script which location type contains the racks.
  This is overridden by `defaults.location` (see below).
- Types not listed under `import` are not created by this script (they must already
  exist in Nautobot, e.g. Country, State, City).

### `mappings` — CSV value → Nautobot name translation

Translates raw CSV values to the names used in Nautobot.
Useful when CSV values are abbreviations or codes.

```yaml
mappings:
  building_short:               # CSV column
    - csv: building_a1          # raw CSV value
      nautobot: Building A1     # name used in Nautobot
    - csv: building_a2
      nautobot: Building A2
  city:
    - csv: city_a
      nautobot: City A
```

Values without a mapping entry are used as-is.

### `defaults` — rack creation defaults

```yaml
defaults:
  rack:
    Status: Active        # Nautobot status
    type: 4-post-cabinet  # Rack type
    width: 19 inches      # Rack width (integer prefix is parsed automatically)
    height: 42            # Rack height in rack units (U)

  # Optional: which CSV column holds the rack's location.
  # When set, overrides the 'location' field in dependencies[Rack].
  # When omitted, the location type from dependencies[Rack].location is used.
  location: room          # CSV column name
```

`defaults.location` lets you pick a specific CSV column as the rack location source,
independently of the Nautobot type hierarchy. This is useful when the column name in
your CSV does not match the Nautobot location type name, or when you want to use a
different granularity than what is declared in `dependencies`.

---

## How it works

1. **Reads** the CSV file and `config.yaml`.
2. **Determines import order** — parents are always created before children.
3. **Imports locations** type by type, skipping entries that already exist in Nautobot.
4. **Imports racks** — resolves the location UUID via the configured column, skips
   existing racks.

Output for each entry:

```
  CREATE  Room A1 [Room] -> Building A1
  SKIP    Room A2
  ERROR   Room A3 (see log for details)
```

Final summary:

```
Done. Created: 3, Skipped: 1, Errors: 0
```

---

## Complete example

**`config.yaml`**

```yaml
import:
  - csv: room
    nautobot: Room
  - csv: building_short
    nautobot: Building

dependencies:
  - name: Rack
    location: Room
  - name: Room
    parent: Building
  - name: Building
    parent: City
  - name: City
    parent: State
  - name: State
    parent: Country
  - name: Country
    parent: null

mappings:
  building_short:
    - csv: building_a1
      nautobot: Building A1
    - csv: building_a2
      nautobot: Building A2
  city:
    - csv: city_a
      nautobot: City A

defaults:
  rack:
    Status: Active
    type: 4-post-cabinet
    width: 19 inches
    height: 42
  location: room
```

**`data.csv`**

```csv
country,city,building_short,room,rack
Country A,city_a,building_a1,Room A1,A_1
Country A,city_a,building_a2,Room A2,A_2
```

**Run**

```bash
cd backend
python scripts/import_racks/import_locations.py --csv data.csv
```

**Output**

```
Import order: ['Building', 'Room'] -> Rack

--- Importing Building (column: building_short) ---
  CREATE Building A1 [Building]
  CREATE Building A2 [Building]

--- Importing Room (column: room) ---
  CREATE Room A1 [Room] -> Building A1
  CREATE Room A2 [Room] -> Building A2

--- Importing Rack (column: rack) ---
  CREATE A_1 [Rack] -> Room A1
  CREATE A_2 [Rack] -> Room A2

Done. Created: 6, Skipped: 0, Errors: 0
```
