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
