# Quick Reference - Inventory Export Script

## Quick Start

```bash
cd /path/to/cockpit-ng/scripts/export_inventory

# Export all inventories
python export_all_inventories.py

# Test before exporting
python test_export.py
```

## Common Commands

| Command | Description |
|---------|-------------|
| `python export_all_inventories.py` | Export all inventories to `./exports` |
| `python export_all_inventories.py --active-only` | Export only active inventories |
| `python export_all_inventories.py --single-file` | Export all to one JSON file |
| `python export_all_inventories.py --output-dir /path` | Custom output directory |
| `python test_export.py` | Test database connection & format |
| `python export_all_inventories.py --help` | Show help |

## One-Liners

### Daily Backup
```bash
python export_all_inventories.py --output-dir ./backups/$(date +%Y%m%d)
```

### Production Export
```bash
python export_all_inventories.py --active-only --single-file --output-dir ./production_backup
```

### Test Everything
```bash
python test_export.py && python export_all_inventories.py --output-dir /tmp/test
```

## File Structure

```
scripts/export_inventory/
├── export_all_inventories.py  # Main export script
├── test_export.py              # Test suite
├── examples.sh                 # Usage examples
├── README.md                   # Full documentation
├── QUICK_REFERENCE.md          # This file
└── exports/                    # Default export directory
```

## Output Files

### Individual Files (default)
```
exports/
├── inventory-production-switches-1.json
├── inventory-test-environment-2.json
└── inventory-backup-devices-3.json
```

### Single File
```
exports/
└── all_inventories_20260203_143022.json
```

## JSON Structure

```json
{
  "version": 2,
  "metadata": {
    "name": "Production Switches",
    "description": "...",
    "scope": "global",
    "exportedAt": "2026-02-03T14:30:00Z",
    "originalId": 123,
    "created_by": "admin",
    "is_active": true
  },
  "conditionTree": {
    "type": "root",
    "internalLogic": "AND",
    "items": [...]
  }
}
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Import errors | Run from project root or check backend path |
| Database errors | Check `.env` file and PostgreSQL connection |
| Permission denied | Use `--output-dir` with writable path |
| No inventories | Normal for new installation, create some first |

## Environment

The script reads database configuration from:
```
backend/.env
```

Required variables:
- `DATABASE_HOST`
- `DATABASE_PORT`
- `DATABASE_NAME`
- `DATABASE_USERNAME`
- `DATABASE_PASSWORD`

## Import Exported Files

**Via Web UI:**
1. Open application
2. Click "Manage Inventories"
3. Click "Import Inventory"
4. Select exported JSON file

**Via API:**
```bash
curl -X POST http://localhost:8000/api/inventory/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d @inventory-export.json
```

## Automation

### Cron Job (Daily at 2 AM)
```bash
0 2 * * * cd /path/to/cockpit-ng/scripts/export_inventory && python export_all_inventories.py --output-dir /backups/$(date +\%Y\%m\%d)
```

### Systemd Timer
```ini
[Unit]
Description=Export inventories daily

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
```

## Tips

- Use `--active-only` for production backups
- Use `--single-file` for easier version control
- Test with `test_export.py` before first use
- Keep exports in version control
- Automate backups with cron
- Use descriptive output directories

## See Also

- [Full Documentation](README.md)
- [Usage Examples](examples.sh)
- [Backend API Docs](../../backend/routers/inventory/)
