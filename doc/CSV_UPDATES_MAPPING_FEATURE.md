# CSV Updates - Column Mapping Feature

## Overview
Added a configurable column mapping feature for the CSV Updates tool that allows users to map CSV columns to lookup fields used for identifying and updating Nautobot objects.

## Implementation

### 1. New Component: MappingPanel
**Location:** `/frontend/src/components/features/nautobot/tools/csv-updates/components/mapping-panel.tsx`

**Features:**
- Collapsible panel (collapsed by default after CSV parsing)
- Dropdown selectors for each lookup field
- Maps CSV column names to lookup field names
- Real-time validation with error messages
- Shows mapping status (X of Y fields mapped)
- Visual indicators for required vs optional fields

**Lookup Fields Supported:**
- **IP Prefixes:** `prefix` (required), `namespace` (required)
  - Note: Only these 2 fields are used for lookup
- **Devices:** `name` (required), `ip_address` (optional)
- **IP Addresses:** `address` (required), `parent__namespace__name` (optional)
- **Locations:** `name` (required), `parent__name` (optional)

### 2. Main Page Updates
**Location:** `/frontend/src/components/features/nautobot/tools/csv-updates/csv-updates-page.tsx`

**Changes:**
- Added `columnMapping` state: `Record<string, string>`
- Added `autoPopulateColumnMapping()` function:
  - Automatically populates mapping when CSV is parsed
  - Checks if CSV headers match standard lookup field names
  - Only runs for IP prefixes
- Added `validateColumnMapping()` function:
  - Validates that all required lookup fields are mapped
  - Returns `true` if valid, `false` otherwise
- Updated `handleProcessUpdates()`:
  - Validates mapping before processing
  - Shows toast notification if validation fails
  - Sends column mapping to backend
- Panel is displayed after "Validation Results" and before "Update Properties"

### 3. Backend Integration
**Location:** `/frontend/src/hooks/queries/use-csv-updates-mutations.ts`

**Changes:**
- Added `columnMapping?: Record<string, string>` to `ProcessCSVUpdatesInput` interface
- Sends `column_mapping` to backend API as part of the request body

## User Flow

1. **Select Object Type:** User selects "IP Prefixes"
2. **Upload CSV:** User selects and parses CSV file
3. **Auto-Population:** System automatically maps columns using smart detection:
   - **Prefix field**: Maps `prefix` column to `prefix` lookup field
   - **Namespace field**:
     - First tries to map `namespace` column to `namespace` lookup field
     - If `namespace` column doesn't exist, maps `namespace__name` column to `namespace` lookup field
   - This handles both direct exports and Nautobot GraphQL exports (which use `namespace__name`)
4. **Manual Mapping:** If columns don't match, user must manually map them:
   - Click on "Lookup Field Mapping" to expand
   - Select CSV column for each required lookup field
   - System validates and shows errors for missing required fields
5. **Dry Run (Optional):** User clicks "Dry Run" button
   - Validates all data without making changes
   - Shows detailed comparison of current vs new values
   - Useful for preview and verification
6. **Process Updates:** User clicks "Process Updates"
   - System validates mapping
   - If invalid, shows error toast
   - If valid, sends data with mapping to backend and applies changes

## CSV Column Auto-Detection Examples

### Example 1: Standard Column Names
**CSV Headers:** `prefix`, `namespace`, `description`

**Auto-Mapping Result:**
- `prefix` lookup field → `prefix` CSV column ✅
- `namespace` lookup field → `namespace` CSV column ✅

**Status:** Fully auto-mapped, ready to process

---

### Example 2: Nautobot GraphQL Export
**CSV Headers:** `prefix`, `namespace__name`, `description`, `status__name`

**Auto-Mapping Result:**
- `prefix` lookup field → `prefix` CSV column ✅
- `namespace` lookup field → `namespace__name` CSV column ✅ (Smart detection!)

**Status:** Fully auto-mapped, ready to process

**Why This Works:** GraphQL exports from Nautobot use `namespace__name` for the namespace field. The system automatically detects this and maps it correctly.

---

### Example 3: Custom Column Names
**CSV Headers:** `network`, `ns`, `desc`, `location`

**Auto-Mapping Result:**
- `prefix` lookup field → (not mapped) ❌
- `namespace` lookup field → (not mapped) ❌

**Status:** Requires manual mapping

**User Action:**
1. Expand "Lookup Field Mapping" panel
2. Map `prefix` → `network`
3. Map `namespace` → `ns`
4. Panel turns green, ready to process

---

### Example 4: Mixed Mapping
**CSV Headers:** `prefix`, `ns_name`, `description`

**Auto-Mapping Result:**
- `prefix` lookup field → `prefix` CSV column ✅
- `namespace` lookup field → (not mapped) ❌

**Status:** Partial auto-mapping

**User Action:**
1. Expand "Lookup Field Mapping" panel
2. Map `namespace` → `ns_name`
3. Panel turns green, ready to process

## Validation Rules

- **Required Fields:** Must be mapped before processing updates
  - IP Prefixes: `prefix`, `namespace`
- **Optional Fields:** None (both fields are required)
- **Error Messages:**
  - Panel shows warning icon if required fields are missing
  - Alert shows list of missing required fields
  - Toast notification on "Process Updates" if validation fails
  - Backend validates that both columns exist in CSV

## Visual Design

### Mapping Panel
- **Collapsed by default:** Minimizes UI clutter
- **Gradient header:** Consistent with other panels (blue gradient)
- **Chevron icons:** Indicate expand/collapse state
- **Status indicator:** Shows "X of Y fields mapped" in header
- **Warning icon:** Appears in header if validation fails
- **Info alerts:** Explain how mapping works

### Action Buttons
- **Clear Button:** Outline style, resets all data
- **Dry Run Button:** Blue outline with eye icon
  - Runs validation and preview without making changes
  - Shows detailed comparison in job results
- **Process Updates Button:** Solid blue, upload icon
  - Applies changes to Nautobot
  - Both buttons share the same loading state

### UI Improvements
- ✅ Removed "Auto-ignored columns" info panel (reduces clutter)
- ✅ Added Dry Run button for safe testing
- ✅ Consistent button styling across the interface

## Backend Implementation

### 1. Router Changes (`/backend/routers/jobs/celery_api.py`)

**Updated Request Model:**
```python
class UpdateIPPrefixesRequest(BaseModel):
    csv_content: str
    csv_options: Optional[Dict[str, str]] = None
    dry_run: bool = False
    ignore_uuid: bool = True
    tags_mode: str = "replace"
    column_mapping: Optional[Dict[str, str]] = None  # NEW
```

**Updated Endpoint:**
- Passes `column_mapping` parameter to Celery task
- Updated documentation with mapping examples

### 2. Task Changes (`/backend/tasks/update_ip_prefixes_from_csv_task.py`)

**Updated Task Signature:**
```python
def update_ip_prefixes_from_csv_task(
    self,
    csv_content: str,
    csv_options: Optional[Dict[str, Any]] = None,
    dry_run: bool = False,
    ignore_uuid: bool = True,
    tags_mode: str = "replace",
    column_mapping: Optional[Dict[str, str]] = None,  # NEW
) -> dict:
```

**Mapping Logic:**
1. Creates helper function `get_csv_column()` that resolves lookup fields to actual CSV columns
2. Maps lookup fields (simplified to 2 fields):
   - `prefix` → `prefix_col`
   - `namespace` → `namespace_col`
   - `id` → `id_col` (when not ignoring UUID)
3. Uses mapped column names when extracting values from CSV rows
4. Provides clear logging of the mapping being used

**GraphQL Lookup:**
- Replaced REST API lookup with GraphQL for better performance
- Uses GraphQL query to find prefix UUID:
  ```graphql
  query ($ip_prefix: [String], $namespace: [String]) {
    prefixes(prefix: $ip_prefix, namespace: $namespace) {
      id
      prefix
      prefix_length
      namespace {
        id
        name
      }
    }
  }
  ```
- After finding UUID via GraphQL, uses REST API PATCH to update the prefix

**Example Request to Backend:**
```json
{
  "csv_content": "network,ns,description\n192.168.1.0/24,Global,Test",
  "csv_options": {
    "delimiter": ",",
    "quoteChar": "\""
  },
  "dry_run": false,
  "ignore_uuid": true,
  "tags_mode": "replace",
  "column_mapping": {
    "prefix": "network",
    "namespace": "ns"
  }
}
```

**How It Works:**
1. Task receives column mapping from frontend
2. For each CSV row, uses mapping to extract:
   - `prefix_value = row[column_mapping["prefix"]]`  → `row["network"]`
   - `namespace_value = row[column_mapping["namespace"]]` → `row["ns"]`
3. Uses extracted values in GraphQL query to find prefix UUID
4. Uses REST API PATCH to update the found prefix with other CSV data

## Future Enhancements

- [ ] Support mapping for other object types (Devices, IP Addresses, Locations)
- [ ] Add "auto-detect" button to guess column mappings
- [ ] Save mapping presets for reuse
- [ ] Show preview of how mapping will be applied
- [ ] Allow multiple lookup field strategies (OR vs AND)

## Dry Run Mode - Detailed Comparison

The backend now includes **detailed field-by-field comparison** in dry run mode:

### Features
- **Current vs New Values**: Shows what's currently in Nautobot vs what will be updated
- **Field-Level Diff**: Identifies which fields will change and which stay the same
- **Tags Comparison**: Shows added/removed tags separately
- **Custom Fields**: Nested comparison of custom field changes
- **No Changes Detection**: Reports when CSV values match current data

### Example Output (Backend Logs)
```
[DRY RUN] Would update prefix 192.168.1.0/24 (namespace: Global)
  Changes to apply:
    • description:
        Current: Old description
        New:     Updated description
    • status:
        Current: Active
        New:     Reserved
    • tags:
        Current: ['production', 'monitoring']
        New:     ['production', 'core']
        Added:   ['core']
        Removed: ['monitoring']
  Unchanged fields: location, tenant, type
```

### Response Format
Each successful dry run entry includes:
```json
{
  "row": 1,
  "prefix": "192.168.1.0/24",
  "namespace": "Global",
  "uuid": "abc-123-def",
  "updates": {
    "description": "Updated description",
    "status": "Reserved",
    "tags": ["production", "core"]
  },
  "comparison": {
    "changes": {
      "description": {
        "current": "Old description",
        "new": "Updated description"
      },
      "tags": {
        "current": ["production", "monitoring"],
        "new": ["production", "core"],
        "added": ["core"],
        "removed": ["monitoring"]
      }
    },
    "unchanged": ["location", "tenant", "type"],
    "summary": "2 field(s) will change, 3 will remain unchanged"
  },
  "dry_run": true
}
```

## Testing Checklist

- [ ] Auto-population works when CSV has standard columns
- [ ] Manual mapping works when CSV has custom columns
- [ ] Validation prevents processing with missing required fields
- [ ] Toast notification shows when validation fails
- [ ] Column mapping is sent to backend correctly
- [ ] Panel is collapsed by default
- [ ] Panel can be expanded/collapsed
- [ ] Changing object type resets mapping
- [ ] Uploading new CSV resets and auto-populates mapping
- [ ] Dry run shows detailed field-by-field comparison
- [ ] Dry run comparison shows current vs new values
- [ ] Dry run detects unchanged fields
- [ ] Tags comparison shows added/removed items
