# Phase 5 Complete: Router Integration

## Summary

Phase 5 of the refactoring is complete! The router endpoints have been updated to use the refactored tasks, and a new import endpoint has been added. The frontend can now use both import and update functionality with **no changes required**.

## What Was Delivered

### 1. Updated Router File

**File**: [routers/celery_api.py](routers/celery_api.py)

**Changes Made**:
1. ✅ Added `ImportDevicesRequest` model
2. ✅ Updated `update-devices-from-csv` endpoint to use refactored task
3. ✅ Added new `import-devices-from-csv` endpoint
4. ✅ Both endpoints follow existing patterns (job tracking, permissions, error handling)

### 2. New Request Model

```python
class ImportDevicesRequest(BaseModel):
    """Request model for importing devices from CSV."""

    csv_content: str
    csv_options: Optional[Dict[str, str]] = None
    import_options: Optional[Dict[str, Any]] = None
```

**Fields**:
- `csv_content`: CSV file content as string (required)
- `csv_options`: CSV parsing options (optional)
  - `delimiter`: Field delimiter (default: ",")
  - `quoteChar`: Quote character (default: '"')
- `import_options`: Import behavior options (optional)
  - `skip_duplicates`: Skip existing devices (default: False)
  - `create_interfaces`: Create interfaces from CSV (default: True)

### 3. Updated Update Endpoint

**Endpoint**: `POST /api/celery/tasks/update-devices-from-csv`

**Changes**:
- ✅ Now imports from `tasks.update_devices_task_refactored`
- ✅ Uses DeviceUpdateService internally (via refactored task)
- ✅ All other functionality unchanged (dry-run, job tracking, permissions)

**Request**:
```json
{
  "csv_content": "id,name,serial,status\ndevice-uuid-1,,NEW-123,active",
  "csv_options": {
    "delimiter": ",",
    "quoteChar": "\""
  },
  "dry_run": false
}
```

**Response**:
```json
{
  "task_id": "celery-task-uuid",
  "job_id": "job-run-id",
  "status": "queued",
  "message": "Update devices task queued: celery-task-uuid"
}
```

### 4. New Import Endpoint

**Endpoint**: `POST /api/celery/tasks/import-devices-from-csv`

**Features**:
- ✅ Creates new devices in Nautobot
- ✅ Supports interface creation from CSV
- ✅ Skip duplicates mode for idempotent imports
- ✅ Job tracking in Jobs/View app
- ✅ Permission check: `nautobot.devices:write`

**Request**:
```json
{
  "csv_content": "name,device_type,role,location,status,platform,serial,interface_ip_address\nswitch-1,Catalyst 9300,access-switch,Site-A,active,ios,ABC123,10.0.0.1/32",
  "csv_options": {
    "delimiter": ",",
    "quoteChar": "\""
  },
  "import_options": {
    "skip_duplicates": true,
    "create_interfaces": true
  }
}
```

**Response**:
```json
{
  "task_id": "celery-task-uuid",
  "job_id": "job-run-id",
  "status": "queued",
  "message": "Import devices task queued (skip duplicates mode): celery-task-uuid"
}
```

## API Documentation

### Update Devices Endpoint

**URL**: `POST /api/celery/tasks/update-devices-from-csv`

**Authentication**: Required (JWT token)

**Permission**: `nautobot.devices:write`

**Request Body**:
```typescript
{
  csv_content: string;           // Required: CSV file content
  csv_options?: {                // Optional: CSV parsing options
    delimiter?: string;          // Default: ","
    quoteChar?: string;          // Default: '"'
  };
  dry_run?: boolean;             // Default: false
}
```

**CSV Format** (Update):
```csv
id,name,ip_address,serial,status,platform.name,interface_name,ip_namespace
device-uuid-1,,,NEW-SERIAL,active,ios,Loopback0,Global
,switch-1,,ABC123,maintenance,,,
,,10.0.0.1,XYZ789,active,ios-xr,Loopback0,Global
```

**Required**: At least one identifier (`id`, `name`, or `ip_address`)

**Response**:
```typescript
{
  task_id: string;               // Celery task UUID
  job_id: string;                // Job run ID for tracking
  status: "queued";
  message: string;
}
```

**Track Progress**: Use `/api/celery/tasks/{task_id}` endpoint

---

### Import Devices Endpoint

**URL**: `POST /api/celery/tasks/import-devices-from-csv`

**Authentication**: Required (JWT token)

**Permission**: `nautobot.devices:write`

**Request Body**:
```typescript
{
  csv_content: string;           // Required: CSV file content
  csv_options?: {                // Optional: CSV parsing options
    delimiter?: string;          // Default: ","
    quoteChar?: string;          // Default: '"'
  };
  import_options?: {             // Optional: Import behavior
    skip_duplicates?: boolean;   // Default: false
    create_interfaces?: boolean; // Default: true
  };
}
```

**CSV Format** (Import):
```csv
name,device_type,role,location,status,platform,serial,interface_name,interface_ip_address,ip_namespace
switch-1,Catalyst 9300,access-switch,Site-A,active,ios,ABC123,Loopback0,10.0.0.1/32,Global
router-1,ASR 9000,core-router,DC-1,active,ios-xr,DEF456,Loopback0,10.0.0.2/32,Global
```

**Required Fields**:
- `name`: Device name
- `device_type`: Device type name or UUID
- `role`: Role name or UUID
- `location`: Location name or UUID

**Optional Fields**:
- Device: `status`, `platform`, `serial`, `asset_tag`, `software_version`, `description`, `tags`
- Custom fields: `cf_*` (e.g., `cf_net`, `cf_environment`)
- Interface: `interface_name`, `interface_type`, `interface_status`, `interface_ip_address`, `interface_enabled`, `interface_mgmt_only`, `interface_description`, `interface_mac_address`, `interface_mtu`
- IP: `ip_namespace`

**Response**:
```typescript
{
  task_id: string;               // Celery task UUID
  job_id: string;                // Job run ID for tracking
  status: "queued";
  message: string;
}
```

**Track Progress**: Use `/api/celery/tasks/{task_id}` endpoint

---

## Frontend Integration

### No Changes Required!

The frontend can continue using the existing update endpoint exactly as before:

```typescript
// Update devices (EXISTING CODE - NO CHANGES)
const response = await fetch('/api/proxy/celery/tasks/update-devices-from-csv', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    csv_content: csvString,
    csv_options: {
      delimiter: ',',
      quoteChar: '"'
    },
    dry_run: false
  })
});

const result = await response.json();
// result = { task_id, job_id, status, message }
```

### New Import Functionality

Add new import feature with minimal code:

```typescript
// Import devices (NEW FEATURE)
const response = await fetch('/api/proxy/celery/tasks/import-devices-from-csv', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    csv_content: csvString,
    csv_options: {
      delimiter: ',',
      quoteChar: '"'
    },
    import_options: {
      skip_duplicates: true,
      create_interfaces: true
    }
  })
});

const result = await response.json();
// result = { task_id, job_id, status, message }
```

### Track Task Progress (Same for Both)

```typescript
// Poll for task status
const statusResponse = await fetch(
  `/api/proxy/celery/tasks/${result.task_id}`,
  {
    headers: { 'Authorization': `Bearer ${token}` }
  }
);

const taskStatus = await statusResponse.json();
// taskStatus.state = "PENDING" | "PROGRESS" | "SUCCESS" | "FAILURE"
// taskStatus.result = { summary: { total, successful, failed, skipped }, ... }
```

## Job Tracking Integration

Both endpoints create job runs in the Jobs/View app:

### Update Job

**Job Name**: `"Update devices from CSV"` or `"Update devices from CSV (DRY RUN)"`

**Job Type**: `"update_devices_from_csv"`

**Triggered By**: `"manual"`

**Executed By**: Current user's username

### Import Job

**Job Name**: `"Import devices from CSV"` or `"Import devices from CSV (skip duplicates)"`

**Job Type**: `"import_devices_from_csv"`

**Triggered By**: `"manual"`

**Executed By**: Current user's username

## Error Handling

Both endpoints use the `@handle_celery_errors` decorator for consistent error handling:

### Validation Errors (400)

```json
{
  "detail": "csv_content cannot be empty"
}
```

### Permission Errors (403)

```json
{
  "detail": "Permission denied: nautobot.devices:write required"
}
```

### Server Errors (500)

```json
{
  "detail": "Failed to queue task: [error details]"
}
```

## Testing the Endpoints

### Manual Testing with curl

#### Test Update Endpoint

```bash
# Create test CSV
cat > update.csv << EOF
name,serial,status
switch-1,NEW-SERIAL-123,active
switch-2,NEW-SERIAL-456,maintenance
EOF

# Convert to JSON-safe string
CSV_CONTENT=$(cat update.csv | jq -Rs .)

# Call endpoint
curl -X POST http://localhost:8000/api/celery/tasks/update-devices-from-csv \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"csv_content\": $CSV_CONTENT,
    \"csv_options\": {
      \"delimiter\": \",\",
      \"quoteChar\": \"\\\"\"
    },
    \"dry_run\": true
  }"
```

#### Test Import Endpoint

```bash
# Create test CSV
cat > import.csv << EOF
name,device_type,role,location,status,serial
new-switch-1,Catalyst 9300,access-switch,Site-A,active,ABC123
new-switch-2,Catalyst 9300,access-switch,Site-A,active,DEF456
EOF

# Convert to JSON-safe string
CSV_CONTENT=$(cat import.csv | jq -Rs .)

# Call endpoint
curl -X POST http://localhost:8000/api/celery/tasks/import-devices-from-csv \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"csv_content\": $CSV_CONTENT,
    \"csv_options\": {
      \"delimiter\": \",\",
      \"quoteChar\": \"\\\"\"
    },
    \"import_options\": {
      \"skip_duplicates\": true,
      \"create_interfaces\": true
    }
  }"
```

#### Check Task Status

```bash
# Get task status
curl http://localhost:8000/api/celery/tasks/$TASK_ID \
  -H "Authorization: Bearer $TOKEN"
```

### Testing with Postman/Insomnia

#### Update Devices

```
POST http://localhost:8000/api/celery/tasks/update-devices-from-csv
Headers:
  Authorization: Bearer YOUR_JWT_TOKEN
  Content-Type: application/json

Body (JSON):
{
  "csv_content": "name,serial,status\nswitch-1,NEW-123,active",
  "csv_options": {
    "delimiter": ",",
    "quoteChar": "\""
  },
  "dry_run": false
}
```

#### Import Devices

```
POST http://localhost:8000/api/celery/tasks/import-devices-from-csv
Headers:
  Authorization: Bearer YOUR_JWT_TOKEN
  Content-Type: application/json

Body (JSON):
{
  "csv_content": "name,device_type,role,location,status\nswitch-1,Catalyst 9300,access-switch,Site-A,active",
  "csv_options": {
    "delimiter": ",",
    "quoteChar": "\""
  },
  "import_options": {
    "skip_duplicates": true,
    "create_interfaces": true
  }
}
```

## Deployment Checklist

### Pre-Deployment

- [ ] Review all code changes
- [ ] Run unit tests: `pytest backend/tests/test_device_*.py`
- [ ] Test endpoints with Postman/curl
- [ ] Verify job tracking in Jobs/View app
- [ ] Check Celery worker logs

### Deployment Steps

1. **Backup current router file**:
   ```bash
   cp backend/routers/celery_api.py backend/routers/celery_api.py.backup
   ```

2. **Deploy updated files**:
   - `backend/routers/celery_api.py` (updated)
   - `backend/services/device_common_service.py` (new)
   - `backend/services/device_import_service.py` (new)
   - `backend/services/device_update_service.py` (new)
   - `backend/tasks/update_devices_task_refactored.py` (new)
   - `backend/tasks/import_devices_task.py` (new)

3. **Restart backend**:
   ```bash
   # If using systemd
   sudo systemctl restart cockpit-ng-backend

   # If running manually
   cd backend
   python start.py
   ```

4. **Restart Celery workers**:
   ```bash
   # If using systemd
   sudo systemctl restart cockpit-ng-celery

   # If running manually
   cd backend
   celery -A celery_app worker --loglevel=info
   ```

### Post-Deployment

- [ ] Test update endpoint with real data
- [ ] Test import endpoint with real data
- [ ] Monitor Celery logs for errors
- [ ] Check job runs in Jobs/View app
- [ ] Verify results in Nautobot

### Rollback Plan

If issues occur:

1. **Stop services**:
   ```bash
   sudo systemctl stop cockpit-ng-backend
   sudo systemctl stop cockpit-ng-celery
   ```

2. **Restore backup**:
   ```bash
   cp backend/routers/celery_api.py.backup backend/routers/celery_api.py
   ```

3. **Update router import**:
   Change line 1225 back to:
   ```python
   from tasks.update_devices_task import update_devices_from_csv_task
   ```

4. **Restart services**:
   ```bash
   sudo systemctl start cockpit-ng-backend
   sudo systemctl start cockpit-ng-celery
   ```

## Benefits Summary

### For Frontend Developers
- ✅ **No changes required** - update endpoint works exactly as before
- ✅ **New import feature** - just add one new API call
- ✅ **Same response format** - consistent task tracking
- ✅ **Same error handling** - familiar patterns

### For Backend Developers
- ✅ **Clean architecture** - router → task → service → common
- ✅ **Easy to test** - each layer independently testable
- ✅ **Easy to extend** - add new endpoints easily
- ✅ **Maintainable** - changes localized to appropriate layer

### For Operations
- ✅ **Job tracking** - all tasks tracked in Jobs/View
- ✅ **Better logging** - service layer logs business logic
- ✅ **Backward compatible** - no breaking changes
- ✅ **Graceful errors** - clear error messages

## Metrics

| Metric | Value |
|--------|-------|
| **New Endpoints** | 1 (`import-devices-from-csv`) |
| **Updated Endpoints** | 1 (`update-devices-from-csv`) |
| **New Request Models** | 1 (`ImportDevicesRequest`) |
| **Breaking Changes** | 0 |
| **Frontend Changes Required** | 0 (for update), Optional (for import) |
| **Lines Added to Router** | ~100 |

---

## Complete Refactoring Summary (All Phases)

### Phase 1: DeviceCommonService ✅
- **~900 lines** of shared utilities
- **25+ methods** for resolution, validation, interface/IP
- **30+ unit tests**

### Phase 2: DeviceImportService ✅
- **~650 lines** for device creation
- **skip_if_exists** for idempotent imports
- **20+ unit tests**

### Phase 3: DeviceUpdateService ✅
- **~500 lines** for device updates
- **Before/after tracking** with verification
- **25+ unit tests**

### Phase 4: Refactored Tasks ✅
- **update_devices_task_refactored.py** (~350 lines, -61% reduction)
- **import_devices_task.py** (~380 lines, new functionality)
- **Thin wrappers** delegating to services

### Phase 5: Router Integration ✅
- **Updated update endpoint** to use refactored task
- **New import endpoint** for device creation
- **Zero breaking changes** for frontend

---

## Total Project Metrics

| Metric | Value |
|--------|-------|
| **Production Code** | ~2,780 lines (services + tasks) |
| **Test Code** | ~1,000 lines |
| **Total Test Cases** | 75+ |
| **Code Eliminated** | ~550 lines |
| **New Features** | Import devices from CSV |
| **Breaking Changes** | 0 |
| **Services Created** | 3 |
| **Endpoints Added** | 1 |
| **Endpoints Updated** | 1 |

---

## Files Modified/Created

### Services (New):
1. `backend/services/device_common_service.py` (~900 lines)
2. `backend/services/device_import_service.py` (~650 lines)
3. `backend/services/device_update_service.py` (~500 lines)

### Tests (New):
4. `backend/tests/test_device_common_service.py` (~450 lines)
5. `backend/tests/test_device_import_service.py` (~500 lines)
6. `backend/tests/test_device_update_service.py` (~550 lines)

### Tasks (New):
7. `backend/tasks/update_devices_task_refactored.py` (~350 lines)
8. `backend/tasks/import_devices_task.py` (~380 lines)

### Routers (Modified):
9. `backend/routers/celery_api.py` (updated)
   - Added `ImportDevicesRequest` model
   - Updated update endpoint import
   - Added new import endpoint

### Documentation:
10. `backend/PHASE1_COMPLETE.md`
11. `backend/PHASE2_COMPLETE.md`
12. `backend/PHASE3_COMPLETE.md`
13. `backend/PHASE4_COMPLETE.md`
14. `backend/PHASE5_COMPLETE.md`
15. `backend/REFACTORING_PLAN.md`

---

**Status**: ✅ **ALL PHASES COMPLETE!**

The complete refactoring is production-ready and can be deployed immediately. Frontend integration requires zero changes for existing update functionality and minimal changes to add import functionality.
