# clear_racks.py

Clears the rack, face, and position fields from Nautobot devices matching a name filter.

## Prerequisites

The script reads Nautobot connection settings from the database or from environment variables:

```bash
NAUTOBOT_HOST=http://localhost:8080
NAUTOBOT_TOKEN=<your-api-token>
```

## Usage

Run from the `backend/` directory or the script's own directory:

```bash
cd backend/scripts/clear_racks

# Preview which devices would be affected (no changes made)
python clear_racks.py --dry-run

# Filter by device name substring, preview only
python clear_racks.py --devices router --dry-run

# Clear rack config for all devices whose name contains "router"
python clear_racks.py --devices router

# Clear rack config for ALL devices that have a rack assigned
python clear_racks.py
```

## Options

| Flag | Description |
|------|-------------|
| `--devices FILTER` | Case-insensitive substring filter on device name. Omit to process all devices. |
| `--dry-run` | Show affected devices without making any changes. |
| `--verbose` | Enable INFO-level logging. |

## Example output

```
[DRY RUN] Would clear rack config for 3 device(s):
  router-01  (rack=RACK-A, face=front, position=12)
  router-02  (rack=RACK-A, face=front, position=14)
  router-03  (rack=RACK-B, face=rear)

[DRY RUN] No changes made. Re-run without --dry-run to apply.
```
