# Bulk Edit JSON Implementation

## Summary

Successfully implemented a new JSON-based bulk-edit endpoint that replaces the CSV conversion step with direct JSON object transmission. The old CSV-based endpoint remains functional for future use.

## Changes Made

### 1. Backend - New Celery Task

**File**: `/backend/tasks/update_devices_task.py`

- **Task Name**: `tasks.update_devices`
- **Input**: List of JSON device objects
- **Output**: Update results summary

**Key Features**:
- Accepts `devices` parameter: List of device update objects
- Each device object contains:
  - Device identifier (id/name/ip_address)
  - Update data (all device fields to update)
  - Optional interface configuration for primary_ip4
- Uses `DeviceUpdateService` for all business logic
- Tracks progress via Celery state updates
- Returns detailed success/failure/skipped counts

**Data Preparation**:
- `_prepare_device_data()` function extracts:
  - Device identifier fields (id, name, ip_address)
  - Update data (all other fields except interface config)
  - Interface config (mgmt_interface_name, mgmt_interface_type, mgmt_interface_status, namespace)

### 2. Backend - New Router Endpoint

**File**: `/backend/routers/celery_api.py`

**New Pydantic Model** (line 865):
```python
class UpdateDevicesJSONRequest(BaseModel):
    """Request model for updating devices from JSON list."""
    devices: List[Dict[str, Any]]
    dry_run: bool = False
```

**New Endpoint** (line 1277):
- **Path**: `POST /api/celery/tasks/update-devices`
- **Permission**: `nautobot.devices:write`
- **Request Body**:
  ```json
  {
    "devices": [
      {
        "id": "device-uuid",
        "name": "switch-01",
        "primary_ip4": "10.0.0.1/24",
        "mgmt_interface_name": "eth0",
        "mgmt_interface_type": "1000base-t",
        "mgmt_interface_status": "active",
        "namespace": "namespace-uuid",
        "role": "role-uuid",
        "status": "status-uuid"
      }
    ],
    "dry_run": false
  }
  ```
- **Response**: `TaskWithJobResponse` (task_id, job_id, status, message)

**Job Tracking**:
- Creates job run in job database
- Job type: `update_devices`
- Viewable in Jobs/View app

### 3. Frontend - JSON Converter

**File**: `/frontend/src/components/bulk-edit/utils/json-converter.ts` (NEW)

**Functions**:
- `convertModifiedDevicesToJSON()`: Converts Map<deviceId, changes> to JSON array
- `validateModifiedDevices()`: Validates devices have modified fields
- `extractFieldId()`: Extracts UUIDs from device field objects

**Conversion Logic**:
1. For each modified device:
   - Add device ID
   - Extract all modified fields (converting objects to UUIDs)
   - If `primary_ip4` is modified and interface config exists:
     - Add `mgmt_interface_name`
     - Add `mgmt_interface_type`
     - Add `mgmt_interface_status`
     - Add `namespace`

**Example Output**:
```json
[
  {
    "id": "abc-123",
    "name": "ROUTER-01",
    "status": "status-uuid",
    "location": "location-uuid",
    "primary_ip4": "192.168.1.1/24",
    "mgmt_interface_name": "Loopback0",
    "mgmt_interface_type": "virtual",
    "mgmt_interface_status": "active",
    "namespace": "namespace-uuid"
  }
]
```

### 4. Frontend - Bulk Edit Page Updates

**File**: `/frontend/src/components/bulk-edit/bulk-edit-page.tsx`

**Changes**:
1. **Import Updated** (line 9):
   ```typescript
   import { convertModifiedDevicesToJSON, validateModifiedDevices } from './utils/json-converter'
   ```

2. **handleSaveDevices Updated** (lines 110-156):
   - Now calls `convertModifiedDevicesToJSON()` instead of CSV converter
   - Sends to `/api/celery/tasks/update-devices` instead of CSV endpoint
   - Request body format changed from CSV to JSON

3. **handleRunDryRun Updated** (lines 162-194):
   - Now calls `convertModifiedDevicesToJSON()` for dry runs
   - Uses new JSON endpoint with `dry_run: true`

## Data Flow

### Old Flow (CSV-based, still available):
```
Bulk Edit UI → CSV Conversion → /api/celery/tasks/update-devices-from-csv
                                                    ↓
                                    update_devices_from_csv_task (refactored)
                                                    ↓
                                        DeviceUpdateService
```

### New Flow (JSON-based, now used):
```
Bulk Edit UI → JSON Conversion → /api/celery/tasks/update-devices
                                                ↓
                                    update_devices_task
                                                ↓
                                    DeviceUpdateService
```

## Benefits of JSON Format

1. **Type Safety**: No CSV parsing errors or delimiter issues
2. **Rich Data Types**: Direct transmission of arrays, objects, nulls
3. **Simpler Frontend**: No CSV escaping/quoting logic needed
4. **Better Debugging**: JSON is easier to inspect than CSV strings
5. **API Standard**: JSON is the standard for REST APIs
6. **No Data Loss**: No risk of CSV field truncation or formatting issues

## Backward Compatibility

✅ **Old CSV endpoint preserved**: `/api/celery/tasks/update-devices-from-csv` still exists and functional

This allows:
- Gradual migration if needed
- CSV import feature reuse in future
- External integrations to continue working

## Testing Checklist

- [x] Backend endpoint created and registered
- [x] Celery task created with proper structure
- [x] Pydantic request model defined
- [x] Frontend converter implemented
- [x] Bulk edit page updated to use JSON
- [x] Dry run updated to use JSON
- [ ] **Manual testing required**: Test actual bulk edit workflow
- [ ] **Verify job tracking**: Check Jobs/View app shows updates
- [ ] **Test error handling**: Verify validation errors are handled
- [ ] **Test dry run**: Verify preview works correctly

## Files Modified

### Backend:
1. `/backend/tasks/update_devices_task.py` - Overwritten with JSON-based task
2. `/backend/routers/celery_api.py` - Added UpdateDevicesJSONRequest model and new endpoint

### Frontend:
1. `/frontend/src/components/bulk-edit/utils/json-converter.ts` - NEW FILE
2. `/frontend/src/components/bulk-edit/bulk-edit-page.tsx` - Updated imports and functions

## Next Steps

1. **Test the implementation**:
   - Start backend and frontend
   - Navigate to Bulk Edit app
   - Select devices and modify properties
   - Click "Save Changes"
   - Verify progress dialog shows correctly
   - Check Jobs/View app for job status

2. **Verify dry run**:
   - Click "Preview Changes"
   - Verify preview dialog works correctly

3. **Check error handling**:
   - Test with invalid data
   - Verify error messages are clear

4. **Monitor logs**:
   - Check backend logs for task execution
   - Verify no errors during processing

## Example Request/Response

**Request to `/api/celery/tasks/update-devices`**:
```json
{
  "devices": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "primary_ip4": "10.1.1.1/24",
      "mgmt_interface_name": "eth0",
      "mgmt_interface_type": "1000base-t",
      "mgmt_interface_status": "active",
      "namespace": "global-namespace-uuid"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "role": "role-uuid",
      "status": "status-uuid",
      "location": "location-uuid"
    }
  ],
  "dry_run": false
}
```

**Response**:
```json
{
  "task_id": "celery-task-uuid",
  "job_id": "123",
  "status": "queued",
  "message": "Update devices task queued (2 device(s)): celery-task-uuid"
}
```

**Task Result** (retrieved from job):
```json
{
  "success": true,
  "devices_processed": 2,
  "successful_updates": 2,
  "failed_updates": 0,
  "skipped_updates": 0,
  "dry_run": false,
  "timestamp": "2025-12-27T00:15:30.123456",
  "results": {
    "successes": [
      {
        "device_id": "550e8400-e29b-41d4-a716-446655440000",
        "device_name": "switch-01",
        "updated_fields": ["primary_ip4"],
        "warnings": []
      },
      {
        "device_id": "660e8400-e29b-41d4-a716-446655440001",
        "device_name": "router-01",
        "updated_fields": ["role", "status", "location"],
        "warnings": []
      }
    ],
    "failures": [],
    "skipped": []
  }
}
```
