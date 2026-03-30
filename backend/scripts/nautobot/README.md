# Nautobot Scripts

## split_serial_devices.py

Detects Nautobot devices whose `serial` field contains multiple comma-separated
serial numbers and creates a copy for each extra serial.

**Example:** a device `fritz.box` with `serial = "12345,67890"` results in a
new device `fritz.box:2` with `serial = "67890"`. The original is untouched.

Copies carry the same role, status, location, device type, custom fields, tags,
rack, and face. Interfaces and IP addresses are **not** copied.

### Usage

```bash
cd backend

# Preview — no changes are made
python scripts/nautobot/split_serial_devices.py --dry-run

# Filter by device name (case-insensitive substring)
python scripts/nautobot/split_serial_devices.py --filter fritz

# Run for real with verbose output (shows skipped devices too)
python scripts/nautobot/split_serial_devices.py --verbose
```

### Options

| Option | Description |
|---|---|
| `--filter PATTERN` / `--name PATTERN` | Only process devices whose name contains `PATTERN` |
| `--dry-run` | Print planned changes without calling the Nautobot API |
| `--verbose` / `-v` | Also print devices that are skipped (single serial) |

### Requirements

- The Cockpit backend database must be reachable (Nautobot URL and token are
  read from the database, falling back to `NAUTOBOT_HOST` / `NAUTOBOT_TOKEN`
  environment variables).
- Run from the `backend/` directory or any path where the backend Python
  environment is active.

---

## create_virtual_chassis.py

Groups devices that share the same base hostname into a Nautobot Virtual Chassis.
Intended to be run after `split_serial_devices.py` has created the secondary
devices.

**Naming convention:** the script strips any `:N` suffix from the hostname part
(everything before the first `.`) to compute the group key.

| Device name | Group key |
|---|---|
| `fritz.box` | `fritz.box` |
| `fritz:2.box` | `fritz.box` |
| `fritz:3.box` | `fritz.box` |

Within each group the device whose hostname contains **no** `:N` suffix becomes
the **master** (VC position 1). All other members are assigned positions 2, 3, …
in the order they appear in Nautobot.

### What the script does per group

1. `POST /dcim/virtual-chassis/` — creates the VC with the canonical name
2. `PATCH /dcim/devices/{master_id}/` — assigns the master at `vc_position=1`
3. `PATCH /dcim/devices/{member_id}/` — assigns each additional member
4. `PATCH /dcim/virtual-chassis/{vc_id}/` — sets the `master` field on the VC

### Usage

```bash
cd backend

# Preview — no changes are made
python scripts/nautobot/create_virtual_chassis.py --dry-run

# Filter by device name (case-insensitive substring)
python scripts/nautobot/create_virtual_chassis.py --filter fritz

# Run for real with verbose output (shows skipped single-device groups too)
python scripts/nautobot/create_virtual_chassis.py --verbose
```

### Options

| Option | Description |
|---|---|
| `--filter PATTERN` / `--name PATTERN` | Only process devices whose name contains `PATTERN` |
| `--dry-run` | Print planned changes without calling the Nautobot API |
| `--verbose` / `-v` | Also print groups that are skipped (single device) |

### Typical workflow

```bash
# 1. Split multi-serial devices into separate entries
python scripts/nautobot/split_serial_devices.py --filter fritz

# 2. Group the resulting devices into a Virtual Chassis
python scripts/nautobot/create_virtual_chassis.py --filter fritz
```

### Requirements

- Same as `split_serial_devices.py` above.
- The backend endpoint `POST /api/nautobot/virtual-chassis` must be available
  (i.e. the Cockpit backend must be running), **or** run the script standalone —
  it calls the Nautobot API directly via `NautobotService` without going through
  the Cockpit HTTP layer.
