# Custom Fields Support in CSV Updates

## Overview

The CSV Updates feature supports updating custom fields and tags for IP prefixes and devices in Nautobot.

- **Custom fields**: Identified by the `cf_` prefix in CSV column headers
- **Tags**: Comma-separated list of tag names in the `tags` column

## How It Works

### CSV Column Naming Convention

- **Regular fields**: Use the field name directly (e.g., `description`, `status__name`)
- **Custom fields**: Prefix the field name with `cf_` (e.g., `cf_vlan_id`, `cf_network_type`)
- **Tags**: Use the column name `tags` with comma-separated values (e.g., `production,core,monitored`)

### Backend Processing

When the backend processes a CSV update:

1. Detects columns starting with `cf_`
2. Removes the `cf_` prefix to get the actual custom field name
3. Groups all custom fields under a `custom_fields` dictionary
4. Converts the `tags` column (if present) from comma-separated string to a list
5. Sends the properly formatted data to Nautobot API

### Example

#### CSV File
```csv
prefix,namespace__name,description,tags,cf_vlan_id,cf_network_type,cf_is_critical
192.168.1.0/24,Global,Production Network,production,core,100,production,true
10.0.0.0/8,Global,Internal Network,internal,dev,200,internal,false
```

#### Backend Processing
The backend transforms the CSV row into:

```json
{
  "description": "Production Network",
  "tags": ["production", "core"],
  "custom_fields": {
    "vlan_id": "100",
    "network_type": "production",
    "is_critical": true
  }
}
```

## Supported Object Types

### IP Prefixes
- File: `backend/tasks/update_ip_prefixes_from_csv_task.py`
- Endpoint: `/celery/tasks/update-ip-prefixes-from-csv`
- Identifier: `prefix` + `namespace__name`

### Devices
- File: `backend/tasks/update_devices_from_csv_task.py`
- Endpoint: `/celery/tasks/update-devices-from-csv`
- Identifier: `id`, `name`, or `ip_address`

## Data Type Handling

### Tags
```csv
tags
production,core,monitored
```
→ `{"tags": ["production", "core", "monitored"]}`

**Notes:**
- Comma-separated values are automatically split into a list
- Whitespace around tag names is trimmed
- Empty elements are filtered out (e.g., `production,,core` becomes `["production", "core"]`)
- Single tag is still converted to a list (e.g., `production` → `["production"]`)

**Tags Mode (Replace vs Merge):**
When updating objects with a tags column, you can choose how to handle existing tags:

- **Replace mode** (default): CSV tags completely replace all existing tags on the object
  - Example: Object has tags `[existing1, existing2]`, CSV has `production,core` → Result: `[production, core]`
  - **Empty tags**: If CSV has an empty tags value, all existing tags are cleared
    - Example: Object has tags `[existing1, existing2]`, CSV has empty/blank tags → Result: `[]` (no tags)
  
- **Merge mode**: CSV tags are added to existing tags (no duplicates)
  - Example: Object has tags `[existing1, existing2]`, CSV has `production,core` → Result: `[existing1, existing2, production, core]`
  - If a tag already exists, it won't be duplicated
  - Example: Object has tags `[production, existing]`, CSV has `production,core` → Result: `[production, existing, core]`
  - **Empty tags**: If CSV has an empty tags value, existing tags remain unchanged (skip update)

**Setting Tags Mode:**
The tags mode is configured in the "Update Properties" panel in the frontend when the CSV contains a "tags" column.

### String Values (Default)
```csv
cf_description,cf_location_code
Network A,DC-01
```
→ `{"custom_fields": {"description": "Network A", "location_code": "DC-01"}}`

### Boolean Values
```csv
cf_is_monitored,cf_is_critical
true,false
```
→ `{"custom_fields": {"is_monitored": true, "is_critical": false}}`

### NULL/Empty Values
```csv
cf_optional_field,cf_another_field
NULL,NOOBJECT
```
→ `{"custom_fields": {"optional_field": null, "another_field": null}}`

Empty values are skipped:
```csv
cf_field1,cf_field2
,value2
```
→ `{"custom_fields": {"field2": "value2"}}` (field1 is omitted)

## Usage Examples

### Example 1: Update IP Prefix with Tags and Custom Fields

**CSV Content:**
```csv
prefix,namespace__name,description,status__name,tags,cf_vlan_id,cf_network_type,cf_cost_center
192.168.1.0/24,Global,Corporate Network,Active,production,core,100,production,IT-001
192.168.2.0/24,Global,Guest Network,Active,guest,monitored,200,guest,IT-002
```

**Result:**
- Prefix `192.168.1.0/24` is updated with:
  - description: "Corporate Network"
  - status: Active (resolved from status__name)
  - tags: ["production", "core"]
  - custom_fields:
    - vlan_id: "100"
    - network_type: "production"
    - cost_center: "IT-001"

### Example 2: Update Device with Tags and Custom Fields

**CSV Content:**
```csv
name,description,tags,cf_net,cf_checkmk_site,cf_backup_enabled
switch-01,Main Switch,production,core,netA,siteA,true
router-01,Edge Router,production,edge,netB,siteB,true
```

**Result:**
- Device `switch-01` is updated with:
  - description: "Main Switch"
  - tags: ["production", "core"]
  - custom_fields:
    - net: "netA"
    - checkmk_site: "siteA"
    - backup_enabled: true

### Example 3: Mixed Regular, Tags, and Custom Fields

**CSV Content:**
```csv
prefix,namespace__name,type,description,tags,cf_vlan_id,cf_is_monitored
192.168.1.0/24,Global,network,Test Network,production,dev,100,true
```

**Backend Data Structure:**
```json
{
  "type": "network",
  "description": "Test Network",
  "tags": ["production", "dev"],
  "custom_fields": {
    "vlan_id": "100",
    "is_monitored": true
  }
}
```

## Frontend Integration

The frontend sends CSV data as-is to the backend. No special handling is required:

1. User uploads CSV file with `cf_` prefixed columns
2. Frontend parses CSV and sends headers + rows to backend
3. Backend detects `cf_` prefix and handles custom fields automatically

## Testing

Unit tests are available at:
- `backend/tests/unit/tasks/test_update_ip_prefixes_custom_fields.py`

Test coverage includes:
- ✅ Custom fields are grouped correctly
- ✅ Boolean values are converted
- ✅ NULL values are handled
- ✅ Empty values are skipped
- ✅ Mixed regular and custom fields work together
- ✅ Excluded fields are filtered out

## Logging

When custom fields are processed, the backend logs:

```
INFO: Processing prefix 1/10: 192.168.1.0/24 (namespace: Global)
INFO:   - Custom fields to update: 3 (['vlan_id', 'network_type', 'cost_center'])
INFO: Updating prefix 192.168.1.0/24 (namespace: Global)
DEBUG: Update data: {'description': 'Corporate Network', 'custom_fields': {...}}
INFO: ✓ Successfully updated prefix: 4 fields
```

## Limitations

1. **Custom field names**: Must match exactly the custom field key in Nautobot (case-sensitive)
2. **Custom field validation**: Nautobot validates custom field values based on field type
3. **Choice fields**: Must use valid choice values defined in Nautobot
4. **Required fields**: If a custom field is required in Nautobot, it must have a value

## Troubleshooting

### Tags not updating

**Error:** `"Expected a list of items but got type \"str\"."`

**Cause:** Tags column value is being sent as a string instead of a list

**Solution:** 
- ✅ The fix is already applied - tags are automatically converted from comma-separated strings to lists
- Make sure you're using the latest version with the tags handling fix
- Example: Column `tags` with value `production,core` is automatically converted to `["production", "core"]`

**Format:**
- ✅ Correct: `production,core,monitored` (comma-separated)
- ❌ Wrong: Trying to manually format as JSON array in CSV

### Custom field not updating

**Check:**
1. CSV column starts with `cf_` prefix
2. Custom field name (after `cf_`) matches Nautobot exactly
3. Value is not empty (empty values are skipped)
4. Custom field exists in Nautobot for that object type

**Example:**
- ❌ Wrong: Column named `vlan_id` (missing prefix)
- ✅ Correct: Column named `cf_vlan_id`

### Invalid custom field value

**Error:** Nautobot returns validation error

**Check:**
1. For choice fields: Value must be one of the allowed choices
2. For URL fields: Value must be a valid URL
3. For integer fields: Value must be a number
4. For boolean fields: Use `true`/`false` (case-insensitive)

### Empty custom field not clearing in Nautobot

**Behavior:** Empty CSV values are skipped, not sent as `null`

**Solution:** To explicitly clear a custom field, use:
- `NULL` (case-insensitive)
- `NOOBJECT` (case-insensitive)

These values are converted to `null` in the API request.

## Related Files

- `backend/tasks/update_ip_prefixes_from_csv_task.py` - IP prefix updates
- `backend/tasks/update_devices_from_csv_task.py` - Device updates
- `backend/tests/unit/tasks/test_update_ip_prefixes_custom_fields.py` - Tests
- `frontend/src/components/features/nautobot/tools/csv-updates/` - UI components
- `frontend/src/hooks/queries/use-csv-updates-mutations.ts` - API integration
