# Inventory Export Script

This directory contains a CLI script to export all inventories from the PostgreSQL database to JSON files.

## Overview

The `export_all_inventories.py` script allows you to:
- Export all inventories from the database
- Filter to export only active inventories
- Export to individual files or a single file
- Preserve all inventory metadata and condition trees

## Requirements

- Python 3.8+
- Access to the backend modules (script handles this automatically)
- Database connection configured in backend `.env` file

## Usage

### Basic Usage

Export all inventories to `./exports` directory (one file per inventory):

```bash
python export_all_inventories.py
```

### Export Only Active Inventories

```bash
python export_all_inventories.py --active-only
```

### Custom Output Directory

```bash
python export_all_inventories.py --output-dir /path/to/exports
```

### Single File Export

Export all inventories to a single JSON file:

```bash
python export_all_inventories.py --single-file
```

### Combined Options

```bash
python export_all_inventories.py --active-only --output-dir ./backups --single-file
```

## Output Format

### Individual Files

Each inventory is exported to a separate JSON file with the naming format:
```
inventory-<sanitized-name>-<id>.json
```

Example: `inventory-production-switches-123.json`

### Single File

All inventories are exported to a single file with timestamp:
```
all_inventories_YYYYMMDD_HHMMSS.json
```

Example: `all_inventories_20260203_143022.json`

### JSON Structure

Each exported inventory follows this structure:

```json
{
  "version": 2,
  "metadata": {
    "name": "Production Switches",
    "description": "All production switches in datacenter",
    "scope": "global",
    "exportedAt": "2026-02-03T14:30:00Z",
    "exportedBy": "export_script",
    "originalId": 123,
    "created_by": "admin",
    "created_at": "2026-01-15T10:00:00",
    "updated_at": "2026-02-01T15:30:00",
    "is_active": true
  },
  "conditionTree": {
    "type": "root",
    "internalLogic": "AND",
    "items": [
      {
        "id": "item-1",
        "field": "role",
        "operator": "equals",
        "value": "switch"
      },
      {
        "id": "group-1",
        "type": "group",
        "logic": "OR",
        "internalLogic": "AND",
        "items": [...]
      }
    ]
  }
}
```

## Features

### Format Compatibility
- Exports in Version 2 format (tree structure)
- Compatible with the frontend Import feature
- Handles legacy flat format conversion automatically

### Metadata Preservation
- Original inventory ID
- Creation and update timestamps
- Creator username
- Active/inactive status
- Scope (global/private)

### Error Handling
- Validates database connection
- Handles missing or invalid conditions
- Reports success/error counts
- Provides detailed error messages

### File Naming
- Sanitizes inventory names for safe filenames
- Removes invalid filesystem characters
- Limits filename length
- Uses lowercase for consistency

## Import Exported Files

The exported JSON files can be imported back into the application using:

1. **Web UI**: Click "Manage Inventories" → "Import Inventory" → Select file
2. **API**: POST to `/api/inventory/import` with the JSON data

## Examples

### Backup All Inventories

Create a timestamped backup of all inventories:

```bash
timestamp=$(date +%Y%m%d_%H%M%S)
python export_all_inventories.py --output-dir ./backups/inventory_backup_$timestamp
```

### Export for Migration

Export all inventories to prepare for environment migration:

```bash
python export_all_inventories.py --output-dir ./migration/inventories --single-file
```

### Daily Backup Script

Create a cron job for daily backups:

```bash
# Add to crontab: Export inventories daily at 2 AM
0 2 * * * cd /path/to/cockpit-ng/scripts/export_inventory && python export_all_inventories.py --output-dir /backups/daily/$(date +\%Y\%m\%d)
```

## Troubleshooting

### Import Error

```
Error: Failed to import backend modules
```

**Solution**: Make sure you're running the script from within the project structure where the backend directory is accessible.

### Database Connection Error

```
Error retrieving inventories from database
```

**Solution**: 
1. Check that the backend `.env` file has correct database credentials
2. Ensure PostgreSQL is running
3. Verify database connection settings

### No Inventories Found

```
No inventories found in database
```

**Solution**: This is normal if no inventories have been created yet. Create some inventories in the web UI first.

### Permission Error

```
Permission denied: ./exports
```

**Solution**: 
1. Make sure you have write permissions for the output directory
2. Use `--output-dir` to specify a directory you can write to

## Script Options

| Option | Description | Default |
|--------|-------------|---------|
| `--output-dir DIR` | Directory to save exported files | `./exports` |
| `--active-only` | Export only active inventories | `false` |
| `--single-file` | Export all to one JSON file | `false` |
| `--help` | Show help message | - |

## Notes

- The script requires the backend database to be configured and accessible
- Exported files can be version controlled (e.g., stored in Git)
- The export format is identical to the web UI export feature
- Private inventories are exported with their original creator information
- Inactive inventories are included by default (use `--active-only` to exclude)

## Related Documentation

- [Inventory Builder Documentation](../../doc/INVENTORY_BUILDER.md)
- [Backend API Documentation](../../backend/routers/inventory/)
- [Import/Export Feature Implementation](../../doc/INVENTORY_IMPORT_EXPORT.md)
