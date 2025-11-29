# Backup Path Templates Feature

## Overview

The backup path templates feature allows users to configure custom file paths for device configuration backups using Nautobot device attributes as variables. This provides flexibility in organizing backup files based on location, device type, custom fields, or any other Nautobot attribute.

## Features

- **Templated Paths**: Use Nautobot attributes in backup paths with `{variable}` syntax
- **Nested Attributes**: Support for nested attributes like `{location.parent.name}`
- **Custom Fields**: Access custom fields using `{custom_field_data.cf_name}`
- **Fallback to Defaults**: If no template is specified, uses the original default path structure

## Usage

### Frontend Configuration

When creating or editing a **Backup** job template:

1. Navigate to **Jobs > Job Templates**
2. Create a new template or edit an existing backup template
3. Set **Type** to "Backup"
4. Configure the backup paths:
   - **Running Config Path**: Template for running configuration file path
   - **Startup Config Path**: Template for startup configuration file path

### Template Variable Syntax

Use curly braces `{variable_name}` to insert Nautobot device attributes:

#### Examples:

```
{custom_field_data.cf_net}/{location.name}/{device_name}.running_config
{location.parent.name}/{location.name}/{device_name}.startup_config
backups/{platform.name}/{device_name}-{custom_field_data.environment}.cfg
```

### Available Variables

The following Nautobot device attributes are available (based on GraphQL query):

#### Basic Device Info
- `{device_name}` or `{name}` - Device name
- `{hostname}` - Device hostname (alias for name)
- `{asset_tag}` - Asset tag
- `{serial}` - Serial number

#### Location Hierarchy
- `{location.name}` - Location name
- `{location.description}` - Location description
- `{location.location_type.name}` - Location type name
- `{location.parent.name}` - Parent location name
- `{location.parent.description}` - Parent location description
- `{location.parent.parent.name}` - Grandparent location name

#### Platform & Device Type
- `{platform.name}` - Platform name (e.g., "cisco_ios")
- `{platform.manufacturer.name}` - Platform manufacturer name
- `{device_type.model}` - Device type model
- `{device_type.manufacturer.name}` - Device type manufacturer name

#### Role & Status
- `{role.name}` - Device role name
- `{status.name}` - Device status name

#### Tenant
- `{tenant.name}` - Tenant name
- `{tenant.tenant_group.name}` - Tenant group name

#### Rack
- `{rack.name}` - Rack name
- `{rack.rack_group.name}` - Rack group name

#### Network
- `{primary_ip4.address}` - Primary IPv4 address with mask (e.g., "10.0.0.1/24")
- `{primary_ip4.host}` - Primary IPv4 host address only (e.g., "10.0.0.1")
- `{primary_ip4.mask_length}` - Subnet mask length (e.g., "24")

#### Custom Fields
- `{custom_field_data.FIELD_NAME}` - Any custom field (e.g., `{custom_field_data.cf_net}`)

#### Example Device Data Structure:

```json
{
  "name": "router01",
  "platform": {
    "name": "cisco_ios"
  },
  "location": {
    "name": "DC1",
    "parent": {
      "name": "USA"
    }
  },
  "custom_field_data": {
    "cf_net": "core",
    "environment": "production"
  }
}
```

#### Example Paths Generated:

| Template | Result |
|----------|--------|
| `{custom_field_data.cf_net}/{location.name}/{device_name}.running_config` | `core/DC1/router01.running_config` |
| `{location.parent.name}/{location.name}/{device_name}.cfg` | `USA/DC1/router01.cfg` |
| `backups/{platform.name}/{device_name}.txt` | `backups/cisco_ios/router01.txt` |

## Implementation Details

### Frontend Changes

**File**: `/frontend/src/components/jobs/job-templates-page.tsx`

- Added `backup_running_config_path` and `backup_startup_config_path` to `JobTemplate` interface
- Added form fields for backup paths (shown only when job type is "backup")
- Added validation to require both paths for backup jobs
- Updated form state management to handle new fields

### Backend Changes

#### 1. Database Model

**File**: `/backend/core/models.py`

Added columns to `JobTemplate` table:
```python
backup_running_config_path = Column(String(500))
backup_startup_config_path = Column(String(500))
```

#### 2. Pydantic Models

**File**: `/backend/models/job_templates.py`

Added fields to request/response models:
```python
backup_running_config_path: Optional[str] = Field(None, max_length=500)
backup_startup_config_path: Optional[str] = Field(None, max_length=500)
```

#### 3. Template Manager

**File**: `/backend/job_template_manager.py`

- Updated `create_job_template()` to accept backup path parameters
- Updated `update_job_template()` to handle backup path updates
- Updated `_model_to_dict()` to include backup paths in response

#### 4. Router

**File**: `/backend/routers/job_templates.py`

- Updated create and update endpoints to pass backup path parameters

#### 5. Path Template Utility

**File**: `/backend/utils/path_template.py`

New utility module for template variable replacement:

- `replace_template_variables(template, device_data)` - Main function to replace variables
- `_get_nested_value(data, path)` - Helper to access nested dictionary values
- `validate_template_path(template)` - Validates template syntax
- `sanitize_path_component(value)` - Sanitizes path components for filesystem safety

#### 6. Backup Executor

**File**: `/backend/tasks/execution/backup_executor.py`

- Loads backup path templates from job template
- Enhanced Nautobot GraphQL query to fetch location and custom_fields
- Uses `replace_template_variables()` to generate actual file paths
- Creates parent directories automatically
- Falls back to default paths if no template is configured

## Database Migration

**File**: `/backend/migrations/add_backup_path_columns.py`

Run the migration to add the new columns to existing databases:

```bash
cd backend
python migrations/add_backup_path_columns.py
```

To rollback:
```bash
python migrations/add_backup_path_columns.py downgrade
```

## Validation

### Frontend Validation

- Both running and startup config paths are required for backup jobs
- Empty values are not allowed

### Backend Validation

The path template utility includes:
- Balanced curly braces checking
- Empty variable detection
- Nested attribute path traversal

### Fallback Behavior

If template variables are not found in device data:
- The variable is left as-is in the path (for debugging)
- Logs a warning message
- Continues with backup operation

## Testing

### Test Scenarios

1. **Default Behavior**: No template configured → uses original default paths
2. **Simple Variables**: `{device_name}.cfg` → `router01.cfg`
3. **Nested Attributes**: `{location.parent.name}/file.cfg` → `USA/file.cfg`
4. **Custom Fields**: `{custom_fields.cf_net}/{device_name}.cfg` → `core/router01.cfg`
5. **Complex Template**: `{location.parent.name}/{location.name}/{custom_fields.cf_net}/{device_name}.running` → `USA/DC1/core/router01.running`

### Manual Testing

1. Create a backup job template with custom paths
2. Schedule the backup job
3. Run the job
4. Check the Git repository for files in the correct paths
5. Verify log output shows template variable replacement

## Error Handling

- **Missing Variables**: Logs warning, keeps variable in path
- **Invalid Syntax**: Frontend validation prevents submission
- **Database Issues**: Transaction rollback in migration
- **Path Creation**: Automatically creates parent directories

## Future Enhancements

Potential improvements:

1. **Variable Preview**: Show example path with sample data in UI
2. **More Attributes**: Add support for more Nautobot attributes (tenant, role, etc.)
3. **Date/Time Variables**: Add `{date}`, `{time}`, `{timestamp}` variables
4. **Path Validation**: Real-time validation of template syntax in frontend
5. **Variable Autocomplete**: Dropdown with available variables
6. **Migration Check**: Auto-run migration on startup if columns missing

## Security Considerations

- Path components are sanitized to remove invalid filesystem characters
- No code execution - only string replacement
- Template variables are limited to Nautobot data structure
- Parent directory creation is restricted to repository root

## Backwards Compatibility

- **Existing Templates**: Continue to work with default paths
- **No Breaking Changes**: All existing backup jobs function as before
- **Optional Feature**: Backup paths are optional fields
- **Migration**: Safe to run multiple times (checks for existing columns)
